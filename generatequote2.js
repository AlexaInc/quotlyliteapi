require('dotenv').config();
const fs = require('fs');
const path = require('path');
const satori = require('satori').default;
const { Resvg } = require('@resvg/resvg-js');
const parse = require('html-react-parser').default;
const { createCanvas, registerFont } = require('canvas');
const sharp = require('sharp');
const axios = require('axios');

// --- MULTI-FONT LOADER ---
function loadFonts() {
    const families = [];
    const paths = [
        { name: 'Noto Sans', path: '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf', weight: 600 },
        { name: 'Noto Sans', path: '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf', weight: 400 },
        { name: 'Noto Symbols', path: '/usr/share/fonts/truetype/noto/NotoSansSymbols-Regular.ttf', weight: 400 },
        { name: 'Arial', path: 'C:\\Windows\\Fonts\\arial.ttf', weight: 400 },
        { name: 'Segoe UI Symbol', path: 'C:\\Windows\\Fonts\\seguisym.ttf', weight: 400 }
    ];

    paths.forEach(f => {
        if (fs.existsSync(f.path)) {
            families.push({ name: f.name, data: fs.readFileSync(f.path), weight: f.weight, style: 'normal' });
            try { registerFont(f.path, { family: f.name }); } catch {}
            console.log(`✅ Loaded font: ${f.name} from ${f.path}`);
        }
    });
    return families;
}
const fonts = loadFonts();
console.log(`ℹ️ Total fonts loaded: ${fonts.length}`);

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
    console.error('❌ FATAL: BOT_TOKEN is missing in environment variables.');
    process.exit(1);
}

// ─── Tone down the logs ────────────────────────────────────────────────────────
function getTelegramColor(id) {
    const map = new Map([[0, '#FF516A'], [1, '#FF9442'], [2, '#C66FFF'], [3, '#50D892'], [4, '#64D4F5'], [5, '#5095ED'], [6, '#FF66A6'], [7, '#FF8280'], [8, '#EDD64E'], [9, '#C66FFF']]);
    return map.get(parseInt(id) % 10) || '#00ffff';
}

function escapeHtml(t) {
    return t ? t.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;") : '';
}

function renderChunkImg(text, fontSize, color) {
    const tmp = createCanvas(1, 1); const tc = tmp.getContext('2d');
    tc.font = `600 ${fontSize}px sans-serif`;
    const w = Math.max(1, tc.measureText(text).width);
    const h = Math.max(1, fontSize * 1.4);
    const cv = createCanvas(w, h); const ctx = cv.getContext('2d');
    ctx.font = `600 ${fontSize}px sans-serif`;
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
    console.log(`🔍 Fetching premium emoji: ${id}`);
    try {
        const { data: d1 } = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/getCustomEmojiStickers`, { custom_emoji_ids: [id] }, { timeout: 5000 });
        const st = d1.result?.[0]; if (!st) return null;
        const { data: d2 } = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/getFile`, { file_id: st.thumbnail?.file_id || st.file_id }, { timeout: 5000 });
        const { data: raw } = await axios.get(`https://api.telegram.org/file/bot${BOT_TOKEN}/${d2.result.file_path}`, { responseType: 'arraybuffer', timeout: 5000 });
        const b64 = `data:image/png;base64,${(await sharp(raw).resize(128, 128).png().toBuffer()).toString('base64')}`;
        ECACHE.set(id, b64); return b64;
    } catch (e) { console.error(`❌ Premium emoji fetch failed: ${id}`, e.message); return null; }
}

async function msgToHtml(text, entities = []) {
    console.log(`📝 Processing message to HTML (text length: ${text?.length})`);
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
                if (plain.length > 0 && /[a-z0-9\u0D80-\u0DFF]$/i.test(plain) && !html.endsWith('<br/>')) { html += '<br/>'; }
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

    const SCALE = 2.0;
    const PP_SIZE = 38 * SCALE;
    const NAME_FS = 16 * SCALE;
    const MSG_FS = 16 * SCALE;

    const items = await Promise.all(msgList.map(async d => {
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
        let groupClass = 'single';
        if (samePrev && sameNext) groupClass = 'middle';
        else if (samePrev) groupClass = 'last';
        else if (sameNext) groupClass = 'first';
        return { ...m, groupClass, showName: !samePrev && !m.isSticker, showAvatar: !sameNext, samePrev };
    });

    const MSG_IN = '#111112';
    const nodes = {
        type: 'div',
        props: {
            style: { display: 'flex', flexDirection: 'column', padding: 40 * SCALE, background: 'transparent' },
            children: rows.map(m => {
                const isTail = m.groupClass === 'last' || m.groupClass === 'single';
                return {
                    type: 'div',
                    props: {
                        style: {
                            display: 'flex',
                            alignItems: 'flex-end',
                            position: 'relative',
                            width: 'auto',
                            margin: `${2 * SCALE}px 0`,
                            marginTop: (!m.samePrev && items.indexOf(m) > 0) ? 10 * SCALE : 2 * SCALE,
                            gap: 6 * SCALE
                        },
                        children: [
                            { type: 'div', props: { style: { width: PP_SIZE, height: PP_SIZE, borderRadius: '50%', backgroundSize: 'cover', backgroundImage: `url(${m.avatarB64})`, border: `${1 * SCALE}px solid rgba(255,255,255,0.05)`, opacity: m.showAvatar ? 1 : 0 } } },
                            {
                                type: 'div',
                                props: {
                                    style: {
                                        position: 'relative',
                                        padding: `${10 * SCALE}px ${16 * SCALE}px`,
                                        background: m.isSticker ? 'transparent' : MSG_IN,
                                        color: '#fff',
                                        fontSize: MSG_FS,
                                        lineHeight: 1.4,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        width: 'auto',
                                        maxWidth: 450 * SCALE,
                                        borderRadius: 18 * SCALE,
                                        borderTopLeftRadius: (m.groupClass === 'middle' || m.groupClass === 'last') ? 5 * SCALE : 18 * SCALE,
                                        borderBottomLeftRadius: (m.groupClass === 'single' || m.groupClass === 'last') ? 0 : 5 * SCALE
                                    },
                                    children: [
                                        isTail && !m.isSticker ? {
                                            type: 'svg',
                                            props: {
                                                width: 8 * SCALE,
                                                height: 10 * SCALE,
                                                style: { position: 'absolute', bottom: 0, left: -8 * SCALE + 0.5 },
                                                children: [{ type: 'path', props: { d: `M 8 0 L 8 10 L 0 10 Q 4 10 8 0`, fill: MSG_IN } }]
                                            }
                                        } : null,
                                        m.isSticker ? { type: 'img', props: { src: m.mediaB64, style: { width: 200 * SCALE, borderRadius: 8 * SCALE } } } : {
                                            type: 'div',
                                            props: {
                                                style: { display: 'flex', flexDirection: 'column' },
                                                children: [
                                                    m.fName ? { type: 'div', props: { style: { fontSize: MSG_FS * 0.75, color: '#64b5f6', marginBottom: 4 * SCALE }, children: `Forwarded from ${m.fName}` } } : null,
                                                    m.showName ? { type: 'div', props: { style: { fontSize: NAME_FS, fontWeight: 600, color: m.color, marginBottom: 4 * SCALE, display: 'flex', alignItems: 'center' }, children: [parse(m.nameHtml), m.statusB64 ? { type: 'img', props: { src: m.statusB64, style: { width: 18 * SCALE, height: 18 * SCALE, marginLeft: 2 * SCALE } } } : null] } } : null,
                                                    m.rName ? { type: 'div', props: { style: { background: 'rgba(255,255,255,0.06)', borderRadius: 6 * SCALE, padding: `${6 * SCALE}px`, borderLeft: `${4 * SCALE}px solid ${m.rColor}`, marginBottom: 10 * SCALE }, children: [{ type: 'div', props: { style: { fontSize: MSG_FS * 0.7, fontWeight: 600, color: m.rColor }, children: parse(m.rName) } }, { type: 'div', props: { style: { fontSize: MSG_FS * 0.65, color: '#7f91a4' }, children: m.rMsg } }] } } : null,
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

    console.log('🎨 Starting Satori render...');
    const startTime = Date.now();
    const svg = await satori(nodes, {
        width: 1200,
        height: 1500,
        fonts: fonts.length > 0 ? fonts : []
    });
    console.log(`✅ Satori render complete in ${Date.now() - startTime}ms`);

    const resvg = new Resvg(svg, { background: 'rgba(0,0,0,0)', fitTo: { mode: 'original' } });
    const pngBuffer = resvg.render().asPng();

    return await sharp(pngBuffer).trim({ threshold: 5 }).sharpen({ sigma: 0.5 }).webp({ quality: 100, lossless: true }).toBuffer();
}

module.exports = createImage;

if (require.main === module) {
    const http = require('http');
    http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Satori Engine Running! 🚀\n');
    }).listen(process.env.PORT || 7860);
}