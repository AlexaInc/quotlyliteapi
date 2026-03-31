require('dotenv').config();

const fs = require('fs');
const path = require('path');
const satori = require('satori').default;
const { Resvg } = require('@resvg/resvg-js');
const parse = require('html-react-parser').default;
const { createCanvas, registerFont } = require('canvas');
const sharp = require('sharp');
const axios = require('axios');

// --- FONTS LOADER ---
function getFontBuffer() {
    const paths = [
        '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf',
        '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
        'C:\\Windows\\Fonts\\arial.ttf',
        'C:\\Windows\\Fonts\\segoeui.ttf'
    ];
    for (const f of paths) {
        if (fs.existsSync(f)) return fs.readFileSync(f);
    }
    // Fallback?
    return null;
}
const fontData = getFontBuffer();

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
    console.error('❌ FATAL: BOT_TOKEN is missing in environment variables.');
    process.exit(1);
}

// ─── Colour helpers ───────────────────────────────────────────────────────────
function getTelegramColor(id) {
    const map = new Map([[0, '#FF516A'], [1, '#FF9442'], [2, '#C66FFF'], [3, '#50D892'], [4, '#64D4F5'], [5, '#5095ED'], [6, '#FF66A6'], [7, '#FF8280'], [8, '#EDD64E'], [9, '#C66FFF']]);
    return map.get(parseInt(id) % 10) || '#00ffff';
}

function escapeHtml(t) {
    return t ? t.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;") : '';
}

function renderChunkImg(text, fontSize, color) {
    const tmp = createCanvas(1, 1); const tc = tmp.getContext('2d');
    const FONT_S = `600 ${fontSize}px sans-serif`;
    tc.font = FONT_S;
    const w = Math.max(1, tc.measureText(text).width);
    const h = Math.max(1, fontSize * 1.4);
    const cv = createCanvas(w, h); const ctx = cv.getContext('2d');
    ctx.font = FONT_S;
    ctx.fillStyle = color; ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, h / 2);
    return `data:image/png;base64,${cv.toBuffer('image/png').toString('base64')}`;
}

function nameToHtml(text, color, fontSize) {
    if (!text) return '';
    const seg = new Intl.Segmenter();
    let res = ''; let chunk = '';
    const flushChunk = () => { if (!chunk) return; res += `<img src="${renderChunkImg(chunk, fontSize, color)}" style="height:1em;vertical-align:middle;margin:0;padding:0;display:flex;"/>`; chunk = ''; };
    for (const { segment: c } of seg.segment(text)) {
        if (IS_EMOJI.test(c)) { flushChunk(); res += `<img src="${toAppleEmojiUrl(c)}" style="height:1.2em;width:1.2em;vertical-align:middle;"/>`; }
        else { chunk += c; }
    }
    flushChunk(); return res;
}

function toAppleEmojiUrl(emoji) {
    const r = []; let c = 0, p = 0;
    for (let i = 0; i < emoji.length; i++) {
        c = emoji.charCodeAt(i);
        if (p) { r.push((0x10000 + ((p - 0xD800) << 10) + (c - 0xDC00)).toString(16)); p = 0; }
        else if (0xD800 <= c && c <= 0xDBFF) p = c;
        else r.push(c.toString(16));
    }
    let cp = r.join('-');
    if (!cp.includes('200d')) cp = cp.replace(/-fe0f/g, '');
    return `https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/${cp}.png`;
}
const IS_EMOJI = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base})/u;

const ECACHE = new Map();
async function getPremiumEmojiB64(id) {
    if (ECACHE.has(id)) return ECACHE.get(id);
    try {
        const { data: d1 } = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/getCustomEmojiStickers`, { custom_emoji_ids: [id] });
        const st = d1.result?.[0]; if (!st) return null;
        const { data: d2 } = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/getFile`, { file_id: st.thumbnail?.file_id || st.file_id });
        const { data: raw } = await axios.get(`https://api.telegram.org/file/bot${BOT_TOKEN}/${d2.result.file_path}`, { responseType: 'arraybuffer' });
        const b64 = `data:image/png;base64,${(await sharp(raw).resize(128, 128).png().toBuffer()).toString('base64')}`;
        ECACHE.set(id, b64); return b64;
    } catch { return null; }
}

async function msgToHtml(text, entities = []) {
    if (!text) return '';
    text = text.replace(/ (https?:\/\/|t\.me\/|Telegram\.me\/|@\w+)/gi, "\n$1");
    const sorted = (entities || []).sort((a, b) => a.offset - b.offset || b.length - a.length);
    let tags = [];
    for (const e of sorted) {
        tags.push({ pos: e.offset, type: 'open', info: e });
        tags.push({ pos: e.offset + e.length, type: 'close', info: e });
    }
    tags.sort((a, b) => a.pos - b.pos || (a.type === 'close' ? -1 : 1));

    let html = '', cursor = 0;
    const seg = new Intl.Segmenter();

    const applyText = (str) => {
        let out = '';
        if (!str) return '';
        for (const { segment: c } of seg.segment(str)) {
            if (IS_EMOJI.test(c)) out += `<img src="${toAppleEmojiUrl(c)}" style="height:1.2em;width:1.2em;vertical-align:middle;"/>`;
            else out += escapeHtml(c);
        }
        return out.replace(/\n/g, '<br/>');
    };

    for (let i = 0; i < tags.length; i++) {
        const t = tags[i];
        if (t.pos > cursor) {
            html += applyText(text.substring(cursor, t.pos));
            cursor = t.pos;
        }

        if (t.type === 'open') {
            const e = t.info;
            if (e.type === 'url' || e.type === 'text_url' || e.type === 'mention' || e.type === 'bot_command') {
                const plain = html.replace(/<[^>]*>/g, '');
                if (plain.length > 0 && /[a-z0-9\u0D80-\u0DFF]$/i.test(plain) && !html.endsWith('<br/>')) {
                    html += '<br/>';
                }
            }

            if (e.type === 'bold') html += '<b>';
            else if (e.type === 'italic') html += '<i>';
            else if (e.type === 'underline') html += '<u>';
            else if (e.type === 'strikethrough') html += '<s>';
            else if (e.type === 'code') html += '<code>';
            else if (e.type === 'pre') html += '<pre>';
            else if (e.type === 'spoiler') html += '<span style="background:rgba(255,255,255,0.15);color:transparent;border-radius:4px;">';
            else if (e.type === 'blockquote' || e.type === 'expandable_blockquote') html += '<span style="display:block;border-left:3px solid #64b5f6;padding-left:10px;margin:4px 0;font-style:italic;color:#7f91a4;">';
            else if (e.type === 'url' || e.type === 'text_url' || e.type === 'mention' || e.type === 'bot_command') html += '<span style="color:#64b5f6;">';
            else if (e.type === 'custom_emoji') {
                const b64 = await getPremiumEmojiB64(e.custom_emoji_id);
                if (b64) html += `<img src="${b64}" style="height:1.3em;width:1.3em;vertical-align:middle;"/>`;
                cursor = e.offset + e.length;
                while (i + 1 < tags.length && tags[i + 1].info === e) { i++; }
            }
        } else {
            const e = t.info;
            if (e.type === 'bold') html += '</b>';
            else if (e.type === 'italic') html += '</i>';
            else if (e.type === 'underline') html += '</u>';
            else if (e.type === 'strikethrough') html += '</s>';
            else if (e.type === 'code') html += '</code>';
            else if (e.type === 'pre') html += '</pre>';
            else if (e.type === 'spoiler' || e.type === 'blockquote' || e.type === 'expandable_blockquote' || e.type === 'url' || e.type === 'text_url' || e.type === 'mention' || e.type === 'bot_command') html += '</span>';
        }
    }
    html += applyText(text.substring(cursor));
    return html;
}

async function dummyAvatar(f, l, color) {
    const S = 200;
    const cv = createCanvas(S, S); const ctx = cv.getContext('2d');
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `bold ${S * 0.38}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(((f?.[0] || '') + (l?.[0] || '')).toUpperCase().substring(0, 2) || '?', S / 2, S / 2);
    return cv.toBuffer('image/png');
}

async function createImage(firstName, lastName, customemojiid, message, nameColorId, inputImageBuffer, replySender, replyMessage, replysendercolor, messageEntities = []) {
    let msgList = Array.isArray(firstName) ? firstName : [{ firstName, lastName, customemojiid, message, nameColorId, inputImageBuffer, replySender, replyMessage, replysendercolor, entities: messageEntities, id: '1', isAbsoluteLast: true }];

    const SCALE = 2.0; // Satori is clear even at lower scale, saves perf
    const PP_SIZE = 38 * SCALE;
    const NAME_FS = 16 * SCALE;
    const MSG_FS = 16 * SCALE;

    const items = await Promise.all(msgList.map(async (d, idx) => {
        const name = `${d.firstName || ''} ${d.lastName || ''}`.trim() || 'User';
        const color = getTelegramColor(d.nameColorId);
        const nameHtml = nameToHtml(name, color, NAME_FS);
        const rawAvatar = d.inputImageBuffer ? await sharp(d.inputImageBuffer).png().toBuffer() : await dummyAvatar(d.firstName, d.lastName, color);
        const avatarB64 = `data:image/png;base64,${rawAvatar.toString('base64')}`;

        let mediaB64 = null;
        if (d.mediaBuffer) {
            try {
                const mb = await sharp(d.mediaBuffer).resize(800, 800, { fit: 'inside' }).png().toBuffer();
                mediaB64 = `data:image/png;base64,${mb.toString('base64')}`;
            } catch { mediaB64 = null; }
        }
        const isSticker = !!d.mediaBuffer && (!d.message || !d.message.trim());
        const rColor = getTelegramColor(d.replysendercolor || 0);
        const rName = d.replySender ? nameToHtml(d.replySender, rColor, NAME_FS * 0.85) : '';
        const fName = d.forwardName ? nameToHtml(d.forwardName, '#64b5f6', NAME_FS * 0.75) : '';
        const statusB64 = d.customemojiid ? await getPremiumEmojiB64(d.customemojiid) : null;
        const msgHtml = await msgToHtml(d.message || '', d.entities || []);

        return { name, color, nameHtml, avatarB64, mediaB64, isSticker, rColor, rName, rMsg: d.replyMessage, statusB64, msgHtml, userId: d.id || name, fName, isAbsoluteLast: d.isAbsoluteLast };
    }));

    const rows = items.map((m, i) => {
        const prev = items[i - 1], next = items[i + 1];
        const samePrev = prev && prev.userId === m.userId && !m.fName;
        const sameNext = next && next.userId === m.userId && !next.fName;
        let groupClass = '';
        if (samePrev && sameNext) groupClass = 'middle';
        else if (samePrev) groupClass = 'last';
        else if (sameNext) groupClass = 'first';
        else groupClass = 'single';
        const showName = !samePrev && !m.isSticker;
        const showAvatar = !sameNext;
        return { ...m, groupClass, showName, showAvatar, samePrev };
    });

    const MSG_IN = '#111112';

    // Build Virtual DOM for Satori
    const nodes = {
        type: 'div',
        props: {
            id: 'wrap',
            style: {
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
                padding: 30 * SCALE,
                background: 'transparent',
                fontFamily: 'sans-serif'
            },
            children: rows.map(m => {
                const isTail = m.groupClass === 'last' || m.groupClass === 'single';
                const tailStyle = isTail ? {
                    position: 'absolute',
                    bottom: 0,
                    left: -8 * SCALE,
                    width: 8 * SCALE,
                    height: 10 * SCALE,
                    background: MSG_IN,
                    clipPath: 'polygon(100% 0, 100% 100%, 0 100%)'
                } : null;

                return {
                    type: 'div',
                    props: {
                        style: {
                            display: 'flex',
                            alignItems: 'flex-end',
                            position: 'relative',
                            width: 'auto',
                            minWidth: 100 * SCALE,
                            maxWidth: 600 * SCALE,
                            margin: `${2 * SCALE}px ${10 * SCALE}px`,
                            marginTop: (!m.samePrev && items.indexOf(m) > 0) ? 10 * SCALE : 2 * SCALE,
                            gap: 6 * SCALE
                        },
                        children: [
                            {
                                type: 'div',
                                props: {
                                    style: {
                                        width: PP_SIZE,
                                        height: PP_SIZE,
                                        borderRadius: '50%',
                                        flexShrink: 0,
                                        marginRight: 10 * SCALE,
                                        backgroundSize: 'cover',
                                        backgroundImage: `url(${m.avatarB64})`,
                                        border: `${1 * SCALE}px solid rgba(255,255,255,0.05)`,
                                        opacity: m.showAvatar ? 1 : 0
                                    }
                                }
                            },
                            {
                                type: 'div',
                                props: {
                                    style: {
                                        position: 'relative',
                                        padding: `${11 * SCALE}px ${24 * SCALE}px ${11 * SCALE}px ${16 * SCALE}px`,
                                        background: m.isSticker ? 'transparent' : MSG_IN,
                                        color: '#fff',
                                        fontSize: MSG_FS,
                                        lineHeight: 1.48,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        width: 'auto',
                                        maxWidth: '100%',
                                        borderRadius: 20 * SCALE,
                                        borderTopLeftRadius: (m.groupClass === 'middle' || m.groupClass === 'last') ? 5 * SCALE : 20 * SCALE,
                                        borderBottomLeftRadius: (m.groupClass === 'single' || m.groupClass === 'last') ? 0 : 5 * SCALE
                                    },
                                    children: [
                                        tailStyle ? { type: 'div', props: { style: tailStyle } } : null,
                                        m.isSticker ? (m.mediaB64 ? { type: 'img', props: { src: m.mediaB64, style: { width: 200 * SCALE, borderRadius: 8 * SCALE } } } : { type: 'div', props: { children: '[Failed sticker]' } }) : {
                                            type: 'div',
                                            props: {
                                                style: { display: 'flex', flexDirection: 'column' },
                                                children: [
                                                    m.fName ? { type: 'div', props: { style: { fontSize: MSG_FS * 0.75, color: '#64b5f6', marginBottom: 4 * SCALE, opacity: 0.9 }, children: `Forwarded from ${m.fName}` } } : null,
                                                    m.showName ? { 
                                                        type: 'div', 
                                                        props: { 
                                                            style: { fontSize: NAME_FS, fontWeight: 600, marginBottom: 4 * SCALE, display: 'flex', alignItems: 'center' },
                                                            children: [parse(m.nameHtml), m.statusB64 ? { type: 'img', props: { src: m.statusB64, style: { width: 18 * SCALE, height: 18 * SCALE, marginLeft: 2 * SCALE } } } : null]
                                                        } 
                                                    } : null,
                                                    m.rName ? {
                                                        type: 'div',
                                                        props: {
                                                            style: { background: 'rgba(255,255,255,0.06)', borderRadius: 6 * SCALE, padding: `${6 * SCALE}px ${10 * SCALE}px`, borderLeft: `${4 * SCALE}px solid ${m.rColor}`, marginBottom: 10 * SCALE, display: 'flex', flexDirection: 'column' },
                                                            children: [
                                                                { type: 'div', props: { style: { fontSize: MSG_FS * 0.72, fontWeight: 600, color: m.rColor }, children: parse(m.rName) } },
                                                                { type: 'div', props: { style: { fontSize: MSG_FS * 0.7, color: '#7f91a4' }, children: m.rMsg } }
                                                            ]
                                                        }
                                                    } : null,
                                                    m.mediaB64 ? { type: 'img', props: { src: m.mediaB64, style: { width: 400 * SCALE, borderRadius: 8 * SCALE, marginBottom: 6 * SCALE } } } : null,
                                                    m.msgHtml ? { type: 'div', props: { style: { display: 'flex', flexDirection: 'column' }, children: [parse(m.msgHtml)] } } : null
                                                ].filter(Boolean)
                                            }
                                        }
                                    ].filter(Boolean)
                                }
                            }
                        ]
                    }
                };
            })
        }
    };

    const svg = await satori(nodes, {
        width: 1200,
        height: 3000, // Large enough, will trim later
        fonts: fontData ? [{
            name: 'sans-serif',
            data: fontData,
            weight: 400,
            style: 'normal'
        }] : []
    });

    const resvg = new Resvg(svg, {
        background: 'rgba(0,0,0,0)',
        fitTo: { mode: 'original' }
    });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    return await sharp(pngBuffer)
        .trim({ threshold: 5 })
        .sharpen({ sigma: 0.5 })
        .webp({ quality: 100, lossless: true })
        .toBuffer();
}

module.exports = createImage;

if (require.main === module) {
    const http = require('http');
    const port = process.env.PORT || 7860;
    http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Satori Quoter Engine is Running! 🚀\n');
    }).listen(port, '0.0.0.0', () => {
        console.log(`\n✅ Satori Engine Health Server: http://0.0.0.0:${port}`);
    });
}