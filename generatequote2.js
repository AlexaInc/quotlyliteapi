require('dotenv').config();

const puppeteer = require('puppeteer');
const fs    = require('fs');
const path  = require('path');
const sharp = require('sharp');
const axios = require('axios');

// =============================================================================
// ENVIRONMENT CONFIGURATION
// =============================================================================
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
    console.error('❌ FATAL: BOT_TOKEN is missing in environment variables.');
    process.exit(1);
}

// Custom Telegram API root — supports self-hosted Bot API or HF Space proxies
const TG_API_ROOT  = (process.env.TG_API_ROOT  || 'https://api.telegram.org').replace(/\/$/, '');
const TG_FILE_ROOT = (process.env.TG_FILE_ROOT || `${TG_API_ROOT}/file`).replace(/\/$/, '');
const HF_TOKEN     = process.env.HFTOKEN || process.env.HF_TOKEN || '';

console.log(`📡 Telegram API root : ${TG_API_ROOT}`);
console.log(`📁 Telegram file root: ${TG_FILE_ROOT}`);
if (HF_TOKEN) console.log(`🤗 HF token detected — will inject auth on .hf.space requests`);

// Helper: build axios options with conditional HF auth header
function buildTgRequestOptions(url, extra = {}) {
    const options = { timeout: 8000, ...extra };
    options.headers = { ...(options.headers || {}) };
    if (HF_TOKEN && /\.hf\.space/i.test(url)) {
        options.headers['Authorization'] = `Bearer ${HF_TOKEN}`;
        options.headers['Referer']       = 'https://huggingface.co';
    }
    return options;
}

// =============================================================================
// FONT INVENTORY (informational — Chromium loads all via fontconfig)
// =============================================================================
;(function inventoryFonts() {
    const SCAN_DIRS = [
        '/usr/share/fonts',
        '/usr/local/share/fonts',
        '/root/.fonts',
    ];

    const counts = { ttf: 0, otf: 0, ttc: 0, woff: 0, woff2: 0, other: 0, total: 0 };

    function walk(dir) {
        if (!fs.existsSync(dir)) return;
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) walk(full);
            else if (ent.isFile()) {
                const ext = path.extname(ent.name).toLowerCase();
                counts.total++;
                if      (ext === '.ttf')   counts.ttf++;
                else if (ext === '.otf')   counts.otf++;
                else if (ext === '.ttc')   counts.ttc++;
                else if (ext === '.woff')  counts.woff++;
                else if (ext === '.woff2') counts.woff2++;
                else                       counts.other++;
            }
        }
    }

    const t0 = Date.now();
    SCAN_DIRS.forEach(walk);
    const elapsed = Date.now() - t0;

    console.log(`\n📦 Font inventory (${elapsed}ms):`);
    console.log(`   .ttf  : ${counts.ttf}`);
    console.log(`   .otf  : ${counts.otf}`);
    console.log(`   .ttc  : ${counts.ttc}  (collections — each contains 2-4 fonts)`);
    console.log(`   .woff : ${counts.woff}`);
    console.log(`   .woff2: ${counts.woff2}`);
    console.log(`   total : ${counts.total} font files\n`);
    console.log(`✅ Chromium will access all of these via fontconfig`);
})();

// =============================================================================
// SHARED BROWSER (single instance, reused across all requests)
// =============================================================================
let sharedBrowser = null;
let browserLock   = false;

async function getBrowser() {
    if (sharedBrowser && sharedBrowser.connected) return sharedBrowser;
    if (browserLock) {
        await new Promise(r => setTimeout(r, 100));
        return getBrowser();
    }
    browserLock = true;
    try {
        console.log('🌐 Launching Chromium browser...');
        sharedBrowser = await puppeteer.launch({
            headless: 'new',
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                '--no-sandbox', '--disable-setuid-sandbox',
                '--disable-gpu', '--disable-dev-shm-usage',
                '--no-zygote', '--single-process',
                '--hide-scrollbars', '--disable-web-security',
                '--disable-extensions', '--disable-background-networking',
                '--disable-default-apps', '--disable-sync',
                '--disable-translate', '--metrics-recording-only',
                '--no-first-run', '--safebrowsing-disable-auto-update',
                '--js-flags=--max-old-space-size=512',
                '--font-render-hinting=none',
                '--enable-font-antialiasing',
            ]
        });
        sharedBrowser.on('disconnected', () => {
            console.log('⚠️  Browser disconnected — will relaunch on next request');
            sharedBrowser = null;
        });
        console.log('✅ Browser ready');
    } finally { browserLock = false; }
    return sharedBrowser;
}

getBrowser().catch(e => console.error('⚠️  Browser pre-warm failed:', e.message));

// =============================================================================
// PAGE POOL
// =============================================================================
const PAGE_POOL     = [];
const PAGE_POOL_MAX = 3;

async function acquirePage() {
    if (PAGE_POOL.length > 0) {
        const page = PAGE_POOL.pop();
        try { await page.evaluate(() => true); return page; }
        catch { /* dead page */ }
    }
    const browser = await getBrowser();
    const page    = await browser.newPage();

    await page.setRequestInterception(true);
    page.on('request', req => {
        const url = req.url();
        if (
            url.startsWith('data:') ||
            url.includes('cdn.jsdelivr.net') ||
            url.includes('twemoji.maxcdn.com')
        ) {
            req.continue();
        } else if (url.startsWith('http')) {
            req.abort();
        } else {
            req.continue();
        }
    });

    await page.setViewport({ width: 5000, height: 5000, deviceScaleFactor: 1 });
    return page;
}

function releasePage(page) {
    if (PAGE_POOL.length < PAGE_POOL_MAX) PAGE_POOL.push(page);
    else page.close().catch(() => {});
}

// =============================================================================
// FONT STACK FOR CSS
// =============================================================================
const FONT_STACK_ARRAY = [
    'Noto Sans', 'DejaVu Sans', 'Liberation Sans', 'FreeSans',
    'Noto Sans Math', 'Noto Sans Symbols2', 'Noto Sans Symbols',
    'Symbola', 'Noto Music',
    'Noto Sans CJK', 'Noto Sans CJK SC', 'Noto Sans CJK JP',
    'Noto Sans CJK KR', 'WenQuanYi Micro Hei',
    'Noto Sans Arabic', 'Amiri', 'Scheherazade',
    'Noto Sans Devanagari', 'Noto Sans Bengali', 'Noto Sans Tamil',
    'Noto Sans Telugu', 'Noto Sans Kannada', 'Noto Sans Malayalam',
    'Noto Sans Gujarati', 'Noto Sans Gurmukhi', 'Noto Sans Oriya',
    'Noto Sans Sinhala',
    'Noto Sans Thai', 'Noto Sans Lao', 'Noto Sans Khmer', 'Noto Sans Myanmar',
    'Noto Sans Hebrew', 'Noto Sans Syriac', 'Noto Sans Thaana',
    'Noto Sans Georgian', 'Noto Sans Armenian', 'Noto Sans Ethiopic',
    'Noto Sans Mongolian', 'Noto Serif Tibetan',
    'Noto Sans Cherokee', 'Noto Sans Canadian Aboriginal',
    'Noto Sans Tifinagh', 'Noto Sans Vai', 'Noto Sans NKo',
    'Noto Sans Adlam', 'Noto Sans Bamum',
    'Noto Sans Runic', 'Noto Sans Ogham', 'Noto Sans Gothic',
    'Noto Sans Old Italic', 'Noto Sans Old Persian',
    'Noto Sans Old Turkic', 'Noto Sans Phoenician',
    'Noto Sans Ugaritic', 'Noto Sans Cuneiform',
    'Noto Sans Egyptian Hieroglyphs', 'Noto Sans Linear A',
    'Noto Sans Linear B', 'Noto Sans Glagolitic',
    'Noto Sans Duployan', 'Noto Sans SignWriting',
    'Noto Sans Deseret', 'Noto Sans Shavian', 'Noto Sans Osmanya',
    'Unifont Upper', 'Unifont',
    'sans-serif'
];

const CSS_FONT = FONT_STACK_ARRAY.map(f => `'${f}'`).join(',');

// =============================================================================
// UTILITIES
// =============================================================================
function getTelegramColor(id) {
    const map = new Map([
        [0, '#FF516A'], [1, '#FF9442'], [2, '#C66FFF'],
        [3, '#50D892'], [4, '#64D4F5'], [5, '#5095ED'],
        [6, '#FF66A6'], [7, '#FF8280'], [8, '#EDD64E'], [9, '#C66FFF']
    ]);
    return map.get(parseInt(id) % 10) || '#00ffff';
}

function escapeHtml(t) {
    return t
        ? t.toString()
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;')
        : '';
}

// =============================================================================
// EMOJI UTILITIES — multi-provider CDN with automatic fallback chain
// =============================================================================
const IS_EMOJI = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base})/u;

// Emoji provider URL builders — each returns a list of candidate URLs
const EMOJI_PROVIDERS = {
    apple: (cps) => {
        const variants = buildCodepointVariants(cps);
        return variants.map(cp =>
            `https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/${cp}.png`
        );
    },
    google: (cps) => {
        const variants = buildCodepointVariants(cps);
        return variants.map(cp =>
            `https://cdn.jsdelivr.net/npm/emoji-datasource-google/img/google/64/${cp}.png`
        );
    },
    twitter: (cps) => {
        const variants = buildCodepointVariants(cps);
        return variants.map(cp =>
            `https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/${cp}.png`
        );
    },
    facebook: (cps) => {
        const variants = buildCodepointVariants(cps);
        return variants.map(cp =>
            `https://cdn.jsdelivr.net/npm/emoji-datasource-facebook/img/facebook/64/${cp}.png`
        );
    },
    microsoft: (cps) => {
        const variants = buildCodepointVariants(cps);
        return variants.map(cp =>
            `https://cdn.jsdelivr.net/npm/emoji-datasource-microsoft/img/microsoft/64/${cp}.png`
        );
    },
    samsung: (cps) => {
        const variants = buildCodepointVariants(cps);
        return variants.map(cp =>
            `https://cdn.jsdelivr.net/npm/emoji-datasource-samsung/img/samsung/64/${cp}.png`
        );
    },
    whatsapp: (cps) => {
        const variants = buildCodepointVariants(cps);
        return variants.map(cp =>
            `https://cdn.jsdelivr.net/npm/emoji-datasource-whatsapp/img/whatsapp/64/${cp}.png`
        );
    },
    openmoji: (cps) => {
        const variants = buildCodepointVariants(cps);
        // OpenMoji uses UPPERCASE codepoints
        return variants.map(cp =>
            `https://cdn.jsdelivr.net/npm/openmoji@latest/color/72x72/${cp.toUpperCase()}.png`
        );
    },
    emojione: (cps) => {
        const variants = buildCodepointVariants(cps);
        return variants.map(cp =>
            `https://cdn.jsdelivr.net/npm/emoji-datasource-joypixels/img/joypixels/64/${cp}.png`
        );
    },
};

function emojiToCodepoints(emoji) {
    const r = []; let c = 0, p = 0;
    for (let i = 0; i < emoji.length; i++) {
        c = emoji.charCodeAt(i);
        if (p) {
            r.push((0x10000 + ((p - 0xD800) << 10) + (c - 0xDC00)).toString(16));
            p = 0;
        } else if (0xD800 <= c && c <= 0xDBFF) p = c;
        else r.push(c.toString(16));
    }
    return r;
}

function buildCodepointVariants(cps) {
    const joined      = cps.join('-');
    const noFe0f      = cps.filter(c => c !== 'fe0f').join('-');
    const noZwjFe0f   = joined.includes('200d') ? joined : noFe0f;
    const baseOnly    = cps[0];
    const noFe0fNoVar = cps.filter(c => c !== 'fe0f' && c !== '200d').join('-');

    return [...new Set([
        noZwjFe0f, joined, noFe0f, noFe0fNoVar, baseOnly,
    ])].filter(Boolean);
}

// Build URL list for selected provider, then add cross-provider fallbacks
function buildEmojiUrls(emoji, provider = 'apple') {
    const cps = emojiToCodepoints(emoji);
    if (cps.length === 0) return [];

    const primaryProvider = EMOJI_PROVIDERS[provider] ? provider : 'apple';
    const urls = [];

    // 1. User's chosen provider first
    urls.push(...EMOJI_PROVIDERS[primaryProvider](cps));

    // 2. Cross-provider fallback chain
    const fallbackOrder = ['apple', 'google', 'twitter', 'facebook'];
    for (const fp of fallbackOrder) {
        if (fp === primaryProvider) continue;
        urls.push(...EMOJI_PROVIDERS[fp](cps));
    }

    return urls;
}

function emojiImgTag(emoji, cssClass = 'emoji', provider = 'apple') {
    const urls = buildEmojiUrls(emoji, provider);
    if (urls.length === 0) return escapeHtml(emoji);

    let onerror = `this.style.display='none';this.onerror=null;`;
    for (let i = urls.length - 1; i >= 1; i--) {
        onerror = `this.onerror=function(){${onerror}};this.src='${urls[i]}';`;
    }
    return `<img src="${urls[0]}" class="${cssClass}" onerror="${onerror}"/>`;
}

// =============================================================================
// PREMIUM EMOJI CACHE (Telegram custom emojis)
// =============================================================================
const ECACHE = new Map();

async function getPremiumEmojiB64(id) {
    if (ECACHE.has(id)) return ECACHE.get(id);
    try {
        const stickersUrl = `${TG_API_ROOT}/bot${BOT_TOKEN}/getCustomEmojiStickers`;
        const { data: d1 } = await axios.post(
            stickersUrl, { custom_emoji_ids: [id] },
            buildTgRequestOptions(stickersUrl)
        );
        const st = d1.result?.[0];
        if (!st) return null;

        const getFileUrl = `${TG_API_ROOT}/bot${BOT_TOKEN}/getFile`;
        const { data: d2 } = await axios.post(
            getFileUrl, { file_id: st.thumbnail?.file_id || st.file_id },
            buildTgRequestOptions(getFileUrl)
        );

        const fileUrl = `${TG_FILE_ROOT}/bot${BOT_TOKEN}/${d2.result.file_path}`;
        const { data: raw } = await axios.get(
            fileUrl,
            buildTgRequestOptions(fileUrl, { responseType: 'arraybuffer' })
        );

        const b64 = `data:image/png;base64,${(await sharp(raw).resize(128, 128).png().toBuffer()).toString('base64')}`;
        ECACHE.set(id, b64);
        return b64;
    } catch (e) {
        console.error(`❌ Premium emoji fetch failed: ${id} — ${e.message}`);
        return null;
    }
}

// =============================================================================
// NAME RENDERING (pure HTML — Puppeteer handles all Unicode natively)
// =============================================================================
function nameToHtml(text, provider = 'apple') {
    if (!text) return '';
    const seg = new Intl.Segmenter();
    let out = '';
    for (const { segment: c } of seg.segment(text)) {
        if (IS_EMOJI.test(c))
            out += emojiImgTag(c, 'emoji', provider);
        else
            out += escapeHtml(c);
    }
    return out;
}

// =============================================================================
// MESSAGE HTML BUILDER
// =============================================================================
async function msgToHtml(text, entities = [], provider = 'apple') {
    if (!text) return '';
    text = text.replace(/ (https?:\/\/|t\.me\/|Telegram\.me\/|@\w+)/gi, '\n$1');

    const sorted = (entities || []).sort((a, b) => a.offset - b.offset || b.length - a.length);
    let tags = [];
    for (const e of sorted) {
        tags.push({ pos: e.offset,            type: 'open',  info: e });
        tags.push({ pos: e.offset + e.length, type: 'close', info: e });
    }
    tags.sort((a, b) => a.pos - b.pos || (a.type === 'close' ? -1 : 1));

    let html = '', cursor = 0;
    const seg = new Intl.Segmenter();

    const applyText = (str) => {
        if (!str) return '';
        let out = '';
        for (const { segment: c } of seg.segment(str)) {
            if (IS_EMOJI.test(c))
                out += emojiImgTag(c, 'emoji', provider);
            else
                out += escapeHtml(c);
        }
        return out.replace(/\n/g, '<br/>');
    };

    for (let i = 0; i < tags.length; i++) {
        const t = tags[i];
        if (t.pos > cursor) { html += applyText(text.substring(cursor, t.pos)); cursor = t.pos; }
        if (t.type === 'open') {
            const e = t.info;
            if (['url','text_url','mention','bot_command'].includes(e.type)) {
                const plain = html.replace(/<[^>]*>/g, '');
                if (plain.length > 0 && /[a-z0-9\u0D80-\u0DFF]$/i.test(plain) && !html.endsWith('<br/>'))
                    html += '<br/>';
            }
            if      (e.type === 'bold')          html += '<b>';
            else if (e.type === 'italic')        html += '<i>';
            else if (e.type === 'underline')     html += '<u>';
            else if (e.type === 'strikethrough') html += '<s>';
            else if (e.type === 'code')          html += '<code>';
            else if (e.type === 'pre')           html += '<pre>';
            else if (e.type === 'spoiler')       html += '<span class="spoiler">';
            else if (e.type === 'blockquote' || e.type === 'expandable_blockquote')
                html += '<span class="blockquote">';
            else if (['url','text_url','mention','bot_command'].includes(e.type))
                html += '<span class="link">';
            else if (e.type === 'custom_emoji') {
                const b64 = await getPremiumEmojiB64(e.custom_emoji_id);
                if (b64) html += `<img src="${b64}" class="msg-emoji"/>`;
                cursor = e.offset + e.length;
                while (i + 1 < tags.length && tags[i + 1].info === e) i++;
            }
        } else {
            const e = t.info;
            if      (e.type === 'bold')          html += '</b>';
            else if (e.type === 'italic')        html += '</i>';
            else if (e.type === 'underline')     html += '</u>';
            else if (e.type === 'strikethrough') html += '</s>';
            else if (e.type === 'code')          html += '</code>';
            else if (e.type === 'pre')           html += '</pre>';
            else if (['spoiler','blockquote','expandable_blockquote',
                      'url','text_url','mention','bot_command'].includes(e.type))
                html += '</span>';
        }
    }
    html += applyText(text.substring(cursor));
    return html;
}

// =============================================================================
// AVATAR GENERATOR (SVG → base64, no canvas needed)
// =============================================================================
function dummyAvatarB64(f, l, color) {
    const initials = ((f?.[0] || '') + (l?.[0] || '')).toUpperCase().substring(0, 2) || '?';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
<circle cx="100" cy="100" r="100" fill="${color}"/>
<text x="100" y="100" text-anchor="middle" dominant-baseline="central"
      fill="white" font-family="Noto Sans, DejaVu Sans, sans-serif"
      font-weight="bold" font-size="76">${escapeHtml(initials)}</text>
</svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// =============================================================================
// MAIN IMAGE GENERATOR
// =============================================================================
async function createImage(
    firstName, lastName, customemojiid, message,
    nameColorId, inputImageBuffer, replySender, replyMessage,
    replysendercolor, messageEntities = []
) {
    let msgList = Array.isArray(firstName)
        ? firstName
        : [{
            firstName, lastName, customemojiid, message, nameColorId,
            inputImageBuffer, replySender, replyMessage, replysendercolor,
            entities: messageEntities, id: '1', isAbsoluteLast: true
        }];

    const SCALE   = 4.5;
    const PP_SIZE = 38 * SCALE;
    const NAME_FS = 16 * SCALE;
    const MSG_FS  = 16 * SCALE;

    const rows = await Promise.all(msgList.map(async (d) => {
        // Per-message emoji provider — default to 'apple' if not set
        const provider = d.emojiProvider || 'apple';

        const name     = `${d.firstName || ''} ${d.lastName || ''}`.trim() || 'User';
        const color    = getTelegramColor(d.nameColorId);
        const nameHtml = nameToHtml(name, provider);

        const avatarB64 = d.inputImageBuffer
            ? `data:image/png;base64,${(await sharp(d.inputImageBuffer).png().toBuffer()).toString('base64')}`
            : dummyAvatarB64(d.firstName, d.lastName, color);

        let mediaB64 = null;
        if (d.mediaBuffer) {
            try {
                const mb = await sharp(d.mediaBuffer)
                    .resize(1000, 1000, { fit: 'inside', kernel: 'lanczos3' })
                    .png().toBuffer();
                mediaB64 = `data:image/png;base64,${mb.toString('base64')}`;
            } catch { mediaB64 = null; }
        }

        const isSticker = !!d.mediaBuffer && (!d.message || !d.message.trim());
        const rColor    = getTelegramColor(d.replysendercolor || 0);
        const rName     = d.replySender ? nameToHtml(d.replySender, provider) : '';
        const fName     = d.forwardName ? nameToHtml(d.forwardName, provider) : '';
        const statusB64 = d.customemojiid ? await getPremiumEmojiB64(d.customemojiid) : null;
        const msgHtml   = await msgToHtml(d.message || '', d.entities || [], provider);

        return {
            name, color, nameHtml, avatarB64, mediaB64, isSticker,
            rColor, rName, rMsg: d.replyMessage, statusB64, msgHtml,
            userId: d.id || name, fName, isAbsoluteLast: d.isAbsoluteLast
        };
    }));

    const items = rows.map((m, i) => {
        const prev = rows[i - 1], next = rows[i + 1];
        const samePrev = prev && prev.userId === m.userId && !m.fName;
        const sameNext = next && next.userId === m.userId && !next.fName;
        let groupClass = 'single-message';
        if      (samePrev && sameNext) groupClass = 'middle-in-group';
        else if (samePrev)             groupClass = 'last-in-group';
        else if (sameNext)             groupClass = 'first-in-group';
        const breakClass = (!samePrev && i > 0) ? 'sender-break' : '';
        return { ...m, groupClass, breakClass, showName: !samePrev && !m.isSticker, showAvatar: !sameNext };
    });

    const MSG_IN = '#111112';

    const css = `
:root { --r: ${20 * SCALE}px; --rs: ${5 * SCALE}px; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: ${CSS_FONT}; background: transparent; -webkit-font-smoothing: antialiased; }
#wrap { display: inline-flex; flex-direction: column; gap: 0; padding: ${30 * SCALE}px; background: transparent; }
.bubble-container { display: flex; align-items: flex-end; position: relative; width: max-content; min-width: ${100 * SCALE}px; max-width: ${400 * SCALE}px; margin: ${2 * SCALE}px ${10 * SCALE}px; gap: ${6 * SCALE}px; }
.bubble-container.sender-break { margin-top: ${10 * SCALE}px; }
.bubble-pp { width: ${PP_SIZE}px; height: ${PP_SIZE}px; border-radius: 50%; flex-shrink: 0; margin-right: ${10 * SCALE}px; background-size: cover; background-position: center; border: ${1 * SCALE}px solid rgba(255,255,255,0.05); }
.bubble-pp.hidden { opacity: 0; pointer-events: none; }
.bubble { position: relative; padding: ${11 * SCALE}px ${24 * SCALE}px ${11 * SCALE}px ${16 * SCALE}px; background: ${MSG_IN}; color: #fff; font-size: ${MSG_FS}px; line-height: 1.48; width: fit-content; max-width: 100%; overflow-wrap: break-word; border-radius: var(--r); }
.bubble-container.in.single-message .bubble { border-bottom-left-radius: 0 !important; }
.bubble-container.in.first-in-group .bubble { border-bottom-left-radius: var(--rs); border-top-left-radius: var(--r); }
.bubble-container.in.middle-in-group .bubble { border-top-left-radius: var(--rs); border-bottom-left-radius: var(--rs); }
.bubble-container.in.last-in-group .bubble { border-top-left-radius: var(--rs); border-bottom-left-radius: 0 !important; }
.bubble::before { content: ""; display: none; position: absolute; }
.bubble-container.in.last-in-group .bubble::before, .bubble-container.in.single-message .bubble::before { display: block; bottom: 0; left: -${8 * SCALE}px; width: 0; height: 0; border-style: solid; border-width: 0 0 ${10 * SCALE}px ${8 * SCALE}px; border-color: transparent transparent ${MSG_IN} transparent; }
.bubble-container.is-sticker { max-width: ${200 * SCALE}px; align-items: flex-end; margin-bottom: ${18 * SCALE}px; gap: 0; }
.bubble-container.is-sticker .bubble { background: transparent !important; box-shadow: none !important; padding: 0 !important; }
.bubble-container.is-sticker .bubble::before { display: none !important; }
.sticker-img { width: ${200 * SCALE}px; display: block; border-radius: ${8 * SCALE}px; }
.bubble-name { font-size: ${NAME_FS}px; font-weight: 600; margin-bottom: ${4 * SCALE}px; display: flex; align-items: center; white-space: nowrap; }
.bubble-name .name-text { display: inline-block; }
.f-line { font-size: ${MSG_FS * 0.75}px; color: #64b5f6; margin-bottom: ${4 * SCALE}px; opacity: 0.9; }
.premium-emoji { width: ${18 * SCALE}px; height: ${18 * SCALE}px; margin-left: ${2 * SCALE}px; }
.link { color: #64b5f6; display: inline-block; word-break: break-all; text-decoration: none; }
.reply-block { background: rgba(255,255,255,0.06); border-radius: ${6 * SCALE}px; padding: ${6 * SCALE}px ${10 * SCALE}px; border-left: ${4 * SCALE}px solid; margin-bottom: ${10 * SCALE}px; max-width: ${300 * SCALE}px; overflow: hidden; }
.reply-name { font-size: ${MSG_FS * 0.72}px; font-weight: 600; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.reply-text { font-size: ${MSG_FS * 0.7}px; color: #7f91a4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.emoji { height: 1.2em; width: 1.2em; vertical-align: middle; display: inline-block; }
.msg-emoji { height: 1.3em; width: 1.3em; vertical-align: middle; display: inline-block; }
code { font-family: 'JetBrains Mono','Fira Code','Consolas','Courier New',monospace; background: rgba(255,255,255,0.1); padding: 0.1em 0.3em; border-radius: 4px; font-size: 0.9em; }
pre { font-family: 'JetBrains Mono','Fira Code','Consolas','Courier New',monospace; background: rgba(255,255,255,0.08); padding: 8px; border-radius: 6px; margin: 4px 0; display: block; white-space: pre-wrap; word-break: break-all; font-size: 0.85em; border-left: 3px solid rgba(255,255,255,0.2); }
.spoiler { background: rgba(255,255,255,0.15); color: transparent; border-radius: 4px; filter: blur(5px); }
.blockquote { display: block; border-left: 3px solid #64b5f6; padding-left: 10px; margin: 4px 0; font-style: italic; color: #7f91a4; }
`;

    const htmlBody = items.map(m => {
        let bInner = '';
        if (m.isSticker) {
            bInner = m.mediaB64
                ? `<img src="${m.mediaB64}" class="sticker-img"/>`
                : `<div style="font-style:italic;color:#7f91a4;font-size:0.7em">[Sticker]</div>`;
        } else {
            if (m.fName)    bInner += `<div class="f-line">Forwarded from <span style="color:#64b5f6">${m.fName}</span></div>`;
            if (m.showName) bInner += `<div class="bubble-name" style="color:${m.color}"><span class="name-text">${m.nameHtml}</span>${m.statusB64 ? `<img src="${m.statusB64}" class="premium-emoji"/>` : ''}</div>`;
            if (m.rName)    bInner += `<div class="reply-block" style="border-left-color:${m.rColor}"><div class="reply-name" style="color:${m.rColor}">${m.rName}</div><div class="reply-text">${escapeHtml(m.rMsg)}</div></div>`;
            if (m.mediaB64) bInner += `<img src="${m.mediaB64}" class="sticker-img" style="margin-bottom:${6 * SCALE}px;"/>`;
            if (m.msgHtml)  bInner += `<div class="bubble-content">${m.msgHtml}</div>`;
        }
        return `
<div class="bubble-container in ${m.groupClass} ${m.isAbsoluteLast ? 'is-absolute-last' : ''} ${m.isSticker ? 'is-sticker' : ''} ${m.breakClass}">
    <div class="bubble-pp ${m.showAvatar ? '' : 'hidden'}" style="background-image:url(${m.avatarB64})"></div>
    <div class="bubble">${bInner}</div>
</div>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>${css}</style>
</head>
<body>
<div id="wrap">${htmlBody}</div>
</body>
</html>`;

    console.log('🎨 Starting Puppeteer render...');
    const t0   = Date.now();
    const page = await acquirePage();

    try {
        await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });

        await page.evaluate(() => {
            return new Promise(resolve => {
                const imgs = [...document.querySelectorAll('img')];
                if (imgs.length === 0) return resolve();
                let settled = 0;
                const done = () => { if (++settled >= imgs.length) resolve(); };
                setTimeout(resolve, 5000);
                imgs.forEach(img => {
                    if (img.complete && img.naturalWidth > 0) done();
                    else if (img.complete) done();
                    else {
                        let fired = false;
                        const handler = () => { if (!fired) { fired = true; done(); } };
                        img.addEventListener('load',  handler);
                        img.addEventListener('error', () => setTimeout(handler, 100));
                    }
                });
            });
        });

        const element = await page.$('#wrap');
        if (!element) throw new Error('Could not find #wrap element');

        const screenshot = await element.screenshot({ omitBackground: true, type: 'png' });
        console.log(`✅ Puppeteer render done in ${Date.now() - t0}ms`);

        return await sharp(screenshot)
            .trim({ threshold: 5 })
            .sharpen({ sigma: 0.5 })
            .webp({ quality: 100, lossless: true })
            .toBuffer();

    } finally {
        releasePage(page);
    }
}

module.exports = createImage;

if (require.main === module) {
    const http = require('http');
    const port = process.env.PORT || 7860;
    http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Premium Quoter Engine is Running! 🚀\n');
    }).listen(port, '0.0.0.0', () => {
        console.log(`\n✅ Quoter Engine: http://0.0.0.0:${port}\n`);
    });
}
