require('dotenv').config();

const puppeteer  = require('puppeteer');
const { createCanvas, registerFont } = require('canvas');
const fs         = require('fs');
const path       = require('path');
const sharp      = require('sharp');
const axios      = require('axios');

// =============================================================================
// FONT SETUP — scan system fonts for canvas rendering
// =============================================================================
const SCAN_DIRS = [
    '/usr/share/fonts/truetype/noto-manual',
    '/usr/share/fonts/truetype/noto',
    '/usr/share/fonts/truetype/noto-extra',
    '/usr/share/fonts/opentype/noto',
    '/usr/share/fonts/truetype/noto-cjk',
    '/usr/share/fonts/opentype/noto-cjk',
    '/usr/share/fonts/noto',
    '/usr/share/fonts/noto-cjk',
    '/usr/local/share/fonts',
    'C:\\Windows\\Fonts',
];

// Font family name mapping for registerFont
const CANVAS_NAME_MAP = [
    { r: /NotoSansSymbols2/i,             n: 'Noto Sans Symbols2' },
    { r: /NotoSansSymbols/i,              n: 'Noto Sans Symbols' },
    { r: /NotoSansMath/i,                 n: 'Noto Sans Math' },
    { r: /NotoMusic/i,                    n: 'Noto Music' },
    { r: /NotoSansCJK/i,                  n: 'Noto Sans CJK' },
    { r: /NotoSerifCJK/i,                 n: 'Noto Serif CJK' },
    { r: /NotoColorEmoji/i,               n: 'Noto Color Emoji' },
    { r: /NotoSansArabic/i,               n: 'Noto Sans Arabic' },
    { r: /NotoSansDevanagari/i,           n: 'Noto Sans Devanagari' },
    { r: /NotoSansBengali/i,              n: 'Noto Sans Bengali' },
    { r: /NotoSansTamil/i,                n: 'Noto Sans Tamil' },
    { r: /NotoSansTelugu/i,               n: 'Noto Sans Telugu' },
    { r: /NotoSansKannada/i,              n: 'Noto Sans Kannada' },
    { r: /NotoSansMalayalam/i,            n: 'Noto Sans Malayalam' },
    { r: /NotoSansGujarati/i,             n: 'Noto Sans Gujarati' },
    { r: /NotoSansGurmukhi/i,             n: 'Noto Sans Gurmukhi' },
    { r: /NotoSansOriya/i,                n: 'Noto Sans Oriya' },
    { r: /NotoSansSinhala/i,              n: 'Noto Sans Sinhala' },
    { r: /NotoSansThai/i,                 n: 'Noto Sans Thai' },
    { r: /NotoSansLao/i,                  n: 'Noto Sans Lao' },
    { r: /NotoSansKhmer/i,                n: 'Noto Sans Khmer' },
    { r: /NotoSansMyanmar/i,              n: 'Noto Sans Myanmar' },
    { r: /NotoSansHebrew/i,               n: 'Noto Sans Hebrew' },
    { r: /NotoSansSyriac/i,               n: 'Noto Sans Syriac' },
    { r: /NotoSansThaana/i,               n: 'Noto Sans Thaana' },
    { r: /NotoSansGeorgian/i,             n: 'Noto Sans Georgian' },
    { r: /NotoSansArmenian/i,             n: 'Noto Sans Armenian' },
    { r: /NotoSansEthiopic/i,             n: 'Noto Sans Ethiopic' },
    { r: /NotoSansMongolian/i,            n: 'Noto Sans Mongolian' },
    { r: /NotoSansRunic/i,                n: 'Noto Sans Runic' },
    { r: /NotoSansOgham/i,                n: 'Noto Sans Ogham' },
    { r: /NotoSansGothic/i,               n: 'Noto Sans Gothic' },
    { r: /NotoSansOldItalic/i,            n: 'Noto Sans Old Italic' },
    { r: /NotoSansCuneiform/i,            n: 'Noto Sans Cuneiform' },
    { r: /NotoSansEgyptianHieroglyphs/i,  n: 'Noto Sans Egyptian Hieroglyphs' },
    { r: /NotoSansDuployan/i,             n: 'Noto Sans Duployan' },
    { r: /NotoSansLinearB/i,              n: 'Noto Sans Linear B' },
    { r: /NotoSansLinearA/i,              n: 'Noto Sans Linear A' },
    { r: /NotoSansPhoenician/i,           n: 'Noto Sans Phoenician' },
    { r: /NotoSansOldPersian/i,           n: 'Noto Sans Old Persian' },
    { r: /NotoSansOldTurkic/i,            n: 'Noto Sans Old Turkic' },
    { r: /NotoSansAdlam/i,                n: 'Noto Sans Adlam' },
    { r: /NotoSansBalinese/i,             n: 'Noto Sans Balinese' },
    { r: /NotoSansBamum/i,                n: 'Noto Sans Bamum' },
    { r: /NotoSansBatak/i,                n: 'Noto Sans Batak' },
    { r: /NotoSansBuginese/i,             n: 'Noto Sans Buginese' },
    { r: /NotoSansChakma/i,               n: 'Noto Sans Chakma' },
    { r: /NotoSansCham/i,                 n: 'Noto Sans Cham' },
    { r: /NotoSansCoptic/i,               n: 'Noto Sans Coptic' },
    { r: /NotoSansDeseret/i,              n: 'Noto Sans Deseret' },
    { r: /NotoSansDuployan/i,             n: 'Noto Sans Duployan' },
    { r: /NotoSansElbasan/i,              n: 'Noto Sans Elbasan' },
    { r: /NotoSansGlagolitic/i,           n: 'Noto Sans Glagolitic' },
    { r: /NotoSansHanifiRohingya/i,       n: 'Noto Sans Hanifi Rohingya' },
    { r: /NotoSansHanunoo/i,              n: 'Noto Sans Hanunoo' },
    { r: /NotoSansJavanese/i,             n: 'Noto Sans Javanese' },
    { r: /NotoSansKannada/i,              n: 'Noto Sans Kannada' },
    { r: /NotoSansKayahLi/i,              n: 'Noto Sans Kayah Li' },
    { r: /NotoSansLepcha/i,               n: 'Noto Sans Lepcha' },
    { r: /NotoSansLimbu/i,                n: 'Noto Sans Limbu' },
    { r: /NotoSansLisu/i,                 n: 'Noto Sans Lisu' },
    { r: /NotoSansMandaic/i,              n: 'Noto Sans Mandaic' },
    { r: /NotoSansMarchen/i,              n: 'Noto Sans Marchen' },
    { r: /NotoSansMasaramGondi/i,         n: 'Noto Sans Masaram Gondi' },
    { r: /NotoSansMeeteiMayek/i,          n: 'Noto Sans Meetei Mayek' },
    { r: /NotoSansMiao/i,                 n: 'Noto Sans Miao' },
    { r: /NotoSansNewa/i,                 n: 'Noto Sans Newa' },
    { r: /NotoSansNKo/i,                  n: 'Noto Sans NKo' },
    { r: /NotoSansOlChiki/i,              n: 'Noto Sans Ol Chiki' },
    { r: /NotoSansOsage/i,                n: 'Noto Sans Osage' },
    { r: /NotoSansOsmanya/i,              n: 'Noto Sans Osmanya' },
    { r: /NotoSansPahawhHmong/i,          n: 'Noto Sans Pahawh Hmong' },
    { r: /NotoSansRejang/i,               n: 'Noto Sans Rejang' },
    { r: /NotoSansSamaritan/i,            n: 'Noto Sans Samaritan' },
    { r: /NotoSansSaurashtra/i,           n: 'Noto Sans Saurashtra' },
    { r: /NotoSansShavian/i,              n: 'Noto Sans Shavian' },
    { r: /NotoSansSignWriting/i,          n: 'Noto Sans SignWriting' },
    { r: /NotoSansSoyombo/i,              n: 'Noto Sans Soyombo' },
    { r: /NotoSansSundanese/i,            n: 'Noto Sans Sundanese' },
    { r: /NotoSansSylotiNagri/i,          n: 'Noto Sans Syloti Nagri' },
    { r: /NotoSansTagalog/i,              n: 'Noto Sans Tagalog' },
    { r: /NotoSansTagbanwa/i,             n: 'Noto Sans Tagbanwa' },
    { r: /NotoSansTaiLe/i,                n: 'Noto Sans Tai Le' },
    { r: /NotoSansTaiTham/i,              n: 'Noto Sans Tai Tham' },
    { r: /NotoSansTaiViet/i,              n: 'Noto Sans Tai Viet' },
    { r: /NotoSansTifinagh/i,             n: 'Noto Sans Tifinagh' },
    { r: /NotoSansUgaritic/i,             n: 'Noto Sans Ugaritic' },
    { r: /NotoSansVai/i,                  n: 'Noto Sans Vai' },
    { r: /NotoSansWancho/i,               n: 'Noto Sans Wancho' },
    { r: /NotoSansYi/i,                   n: 'Noto Sans Yi' },
    { r: /NotoSansZanabazarSquare/i,      n: 'Noto Sans Zanabazar Square' },
    { r: /NotoSerifTangut/i,              n: 'Noto Serif Tangut' },
    { r: /NotoSerifTibetan/i,             n: 'Noto Serif Tibetan' },
    { r: /NotoTraditionalNushu/i,         n: 'Noto Traditional Nushu' },
    // Generic must be last
    { r: /NotoSans/i,                     n: 'Noto Sans' },
    { r: /NotoSerif/i,                    n: 'Noto Serif' },
    { r: /NotoMono/i,                     n: 'Noto Mono' },
    { r: /seguisym/i,                     n: 'Segoe UI Symbol' },
    { r: /seguiemj/i,                     n: 'Segoe UI Emoji' },
    { r: /arial/i,                        n: 'Arial' },
];

function deriveCanvasName(filename) {
    for (const rule of CANVAS_NAME_MAP) {
        if (rule.r.test(filename)) return rule.n;
    }
    return 'Noto Sans';
}

// Register all system fonts with node-canvas at startup
// Canvas uses Pango/FreeType which handles ALL scripts natively
// This means names rendered via canvas will NEVER show tofu
;(function registerAllFonts() {
    const loaded = new Set();
    let count = 0;
    for (const dir of SCAN_DIRS) {
        if (!fs.existsSync(dir)) continue;
        let files;
        try { files = fs.readdirSync(dir); } catch { continue; }
        for (const file of files) {
            if (!/\.(ttf|otf)$/i.test(file)) continue;
            const fullPath = path.join(dir, file);
            if (loaded.has(fullPath)) continue;
            loaded.add(fullPath);
            try {
                registerFont(fullPath, { family: deriveCanvasName(file) });
                count++;
            } catch (_) {}
        }
    }
    console.log(`✅ Registered ${count} fonts with node-canvas`);
})();

// Canvas font stack — all families registered above are available
const CANVAS_FONT = [
    'Noto Sans', 'Noto Sans Symbols2', 'Noto Sans Symbols',
    'Noto Sans Math', 'Noto Music',
    'Noto Sans CJK', 'Noto Sans Arabic', 'Noto Sans Devanagari',
    'Noto Sans Bengali', 'Noto Sans Tamil', 'Noto Sans Telugu',
    'Noto Sans Thai', 'Noto Sans Hebrew', 'Noto Sans Georgian',
    'Noto Sans Armenian', 'Noto Sans Ethiopic', 'Noto Sans Mongolian',
    'Noto Sans Runic', 'Noto Sans Gothic', 'Noto Sans Cuneiform',
    'Noto Sans Egyptian Hieroglyphs', 'Noto Sans Duployan',
    'sans-serif'
].map(f => `'${f}'`).join(', ');

// =============================================================================
// SHARED BROWSER — created once, reused for every request
// This is the #1 speed optimization: browser startup = ~2s, reuse = ~0ms
// =============================================================================
let sharedBrowser = null;
let browserLock   = false;

async function getBrowser() {
    // If browser exists and is still connected, return it immediately
    if (sharedBrowser && sharedBrowser.connected) return sharedBrowser;

    // Simple lock to prevent multiple simultaneous launches
    if (browserLock) {
        // Wait for the other launch to finish
        await new Promise(r => setTimeout(r, 100));
        return getBrowser();
    }

    browserLock = true;
    try {
        console.log('🌐 Launching Chromium browser...');
        sharedBrowser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--no-zygote',
                '--single-process',
                '--hide-scrollbars',
                '--disable-web-security',
                // Performance: disable unused features
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-default-apps',
                '--disable-sync',
                '--disable-translate',
                '--metrics-recording-only',
                '--no-first-run',
                '--safebrowsing-disable-auto-update',
                // Memory: reduce footprint
                '--js-flags=--max-old-space-size=512',
            ]
        });
        sharedBrowser.on('disconnected', () => {
            console.log('⚠️  Browser disconnected — will relaunch on next request');
            sharedBrowser = null;
        });
        console.log('✅ Browser ready');
    } finally {
        browserLock = false;
    }
    return sharedBrowser;
}

// Pre-warm browser at startup so first request is fast
getBrowser().catch(e => console.error('⚠️  Browser pre-warm failed:', e.message));

// =============================================================================
// PAGE POOL — reuse pages instead of creating/closing per request
// Creating a new page costs ~100-200ms. Reusing a pooled page costs ~0ms.
// =============================================================================
const PAGE_POOL     = [];
const PAGE_POOL_MAX = 3; // max concurrent pages

async function acquirePage() {
    // Return a free page from pool if available
    if (PAGE_POOL.length > 0) {
        const page = PAGE_POOL.pop();
        // Make sure it's still usable
        try {
            await page.evaluate(() => true);
            return page;
        } catch {
            // Page is dead, create a new one
        }
    }
    // Create a new page
    const browser = await getBrowser();
    const page    = await browser.newPage();

    // Disable images/css/fonts from EXTERNAL sources for speed
    // We use base64 data URIs for everything so this is safe
    await page.setRequestInterception(true);
    page.on('request', req => {
        const url = req.url();
        // Block external requests EXCEPT emoji CDN (we need those images)
        if (
            url.startsWith('data:') ||
            url.includes('cdn.jsdelivr.net') ||
            url.includes('fonts.gstatic.com')
        ) {
            req.continue();
        } else if (
            url.startsWith('http') &&
            !url.includes('cdn.jsdelivr.net')
        ) {
            // Block Google Fonts and other external CSS/JS — we use inline CSS
            req.abort();
        } else {
            req.continue();
        }
    });

    await page.setViewport({ width: 5000, height: 5000, deviceScaleFactor: 1 });
    return page;
}

function releasePage(page) {
    if (PAGE_POOL.length < PAGE_POOL_MAX) {
        PAGE_POOL.push(page);
    } else {
        page.close().catch(() => {});
    }
}

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
// NAME RENDERING — canvas → base64 PNG
// node-canvas uses Pango which calls into FreeType + system fonts.
// Every font we registered above is available here.
// Result: names with ANY Unicode script render perfectly with NO tofu.
// =============================================================================
function renderChunkImg(text, fontSize, color) {
    const tmp = createCanvas(1, 1);
    const tc  = tmp.getContext('2d');
    tc.font   = `600 ${fontSize}px ${CANVAS_FONT}`;
    const w   = Math.max(1, Math.ceil(tc.measureText(text).width) + 4);
    const h   = Math.max(1, Math.ceil(fontSize * 1.5));
    const cv  = createCanvas(w, h);
    const ctx = cv.getContext('2d');
    ctx.font         = `600 ${fontSize}px ${CANVAS_FONT}`;
    ctx.fillStyle    = color;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 2, h / 2);
    return `data:image/png;base64,${cv.toBuffer('image/png').toString('base64')}`;
}

function nameToHtml(text, color, fontSize) {
    if (!text) return '';
    const seg = new Intl.Segmenter();
    let res = '', chunk = '';
    const flushChunk = () => {
        if (!chunk) return;
        res += `<img src="${renderChunkImg(chunk, fontSize, color)}" `
             + `style="height:1em;vertical-align:middle;margin:0;padding:0;display:inline-block;"/>`;
        chunk = '';
    };
    for (const { segment: c } of seg.segment(text)) {
        if (IS_EMOJI.test(c)) {
            flushChunk();
            res += `<img src="${toAppleEmojiUrl(c)}" class="emoji" onerror="this.style.display='none'"/>`;
        } else {
            chunk += c;
        }
    }
    flushChunk();
    return res;
}

// =============================================================================
// EMOJI
// =============================================================================
function toAppleEmojiUrl(emoji) {
    const r = []; let c = 0, p = 0;
    for (let i = 0; i < emoji.length; i++) {
        c = emoji.charCodeAt(i);
        if (p) {
            r.push((0x10000 + ((p - 0xD800) << 10) + (c - 0xDC00)).toString(16));
            p = 0;
        } else if (0xD800 <= c && c <= 0xDBFF) {
            p = c;
        } else {
            r.push(c.toString(16));
        }
    }
    let cp = r.join('-');
    if (!cp.includes('200d')) cp = cp.replace(/-fe0f/g, '');
    return `https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/${cp}.png`;
}

const IS_EMOJI = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base})/u;

// =============================================================================
// PREMIUM EMOJI CACHE
// =============================================================================
const ECACHE = new Map();

async function getPremiumEmojiB64(id) {
    if (ECACHE.has(id)) return ECACHE.get(id);
    try {
        const BOT_TOKEN = process.env.BOT_TOKEN;
        const { data: d1 } = await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/getCustomEmojiStickers`,
            { custom_emoji_ids: [id] }, { timeout: 5000 }
        );
        const st = d1.result?.[0]; if (!st) return null;
        const { data: d2 } = await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/getFile`,
            { file_id: st.thumbnail?.file_id || st.file_id }, { timeout: 5000 }
        );
        const { data: raw } = await axios.get(
            `https://api.telegram.org/file/bot${BOT_TOKEN}/${d2.result.file_path}`,
            { responseType: 'arraybuffer', timeout: 5000 }
        );
        const b64 = `data:image/png;base64,${(await sharp(raw).resize(128, 128).png().toBuffer()).toString('base64')}`;
        ECACHE.set(id, b64);
        return b64;
    } catch { return null; }
}

// =============================================================================
// MESSAGE HTML BUILDER — unchanged from your original working version
// =============================================================================
async function msgToHtml(text, entities = []) {
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
                out += `<img src="${toAppleEmojiUrl(c)}" class="emoji"/>`;
            else
                out += escapeHtml(c);
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
// AVATAR GENERATOR
// =============================================================================
async function dummyAvatar(f, l, color) {
    const S = 200;
    const cv  = createCanvas(S, S);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle    = '#fff';
    ctx.font         = `bold ${S * 0.38}px ${CANVAS_FONT}`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(((f?.[0] || '') + (l?.[0] || '')).toUpperCase().substring(0, 2) || '?', S / 2, S / 2);
    return cv.toBuffer('image/png');
}

// =============================================================================
// MAIN IMAGE GENERATOR
// =============================================================================
async function createImage(
    firstName, lastName, customemojiid, message,
    nameColorId, inputImageBuffer, replySender, replyMessage,
    replysendercolor, messageEntities = []
) {
    const BOT_TOKEN = process.env.BOT_TOKEN;

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

    // ── Pre-process all messages in parallel ──────────────────────────────────
    const rows = await Promise.all(msgList.map(async (d) => {
        const name    = `${d.firstName || ''} ${d.lastName || ''}`.trim() || 'User';
        const color   = getTelegramColor(d.nameColorId);
        const nameHtml = nameToHtml(name, color, NAME_FS);

        const rawAvatar = d.inputImageBuffer
            ? await sharp(d.inputImageBuffer).png().toBuffer()
            : await dummyAvatar(d.firstName, d.lastName, color);
        const avatarB64 = `data:image/png;base64,${rawAvatar.toString('base64')}`;

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
        const rName     = d.replySender ? nameToHtml(d.replySender, rColor, NAME_FS * 0.85) : '';
        const fName     = d.forwardName ? nameToHtml(d.forwardName, '#64b5f6', NAME_FS * 0.75) : '';
        const statusB64 = d.customemojiid ? await getPremiumEmojiB64(d.customemojiid) : null;
        const msgHtml   = await msgToHtml(d.message || '', d.entities || []);

        return {
            name, color, nameHtml, avatarB64, mediaB64, isSticker,
            rColor, rName, rMsg: d.replyMessage, statusB64, msgHtml,
            userId: d.id || name, fName, isAbsoluteLast: d.isAbsoluteLast
        };
    }));

    // ── Compute message grouping ──────────────────────────────────────────────
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

    // ── CSS — identical to your original, NO changes to layout/styling ────────
    const css = `
:root { --r: ${20 * SCALE}px; --rs: ${5 * SCALE}px; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Noto Sans','Noto Sans Symbols2','Noto Sans Symbols','Noto Sans CJK','Noto Sans Arabic','Noto Sans Devanagari',sans-serif; background: transparent; -webkit-font-smoothing: antialiased; }
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
.f-line { font-size: ${MSG_FS * 0.75}px; color: #64b5f6; margin-bottom: ${4 * SCALE}px; opacity: 0.9; }
.premium-emoji { width: ${18 * SCALE}px; height: ${18 * SCALE}px; margin-left: ${2 * SCALE}px; }
.link { color: #64b5f6; display: inline-block; word-break: break-all; text-decoration: none; }
.reply-block { background: rgba(255,255,255,0.06); border-radius: ${6 * SCALE}px; padding: ${6 * SCALE}px ${10 * SCALE}px; border-left: ${4 * SCALE}px solid; margin-bottom: ${10 * SCALE}px; max-width: ${300 * SCALE}px; overflow: hidden; }
.reply-name { font-size: ${MSG_FS * 0.72}px; font-weight: 600; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.reply-text { font-size: ${MSG_FS * 0.7}px; color: #7f91a4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.emoji { height: 1.2em; width: 1.2em; vertical-align: middle; }
.msg-emoji { height: 1.3em; width: 1.3em; vertical-align: middle; }
code { font-family: 'Consolas', 'Courier New', monospace; background: rgba(255,255,255,0.1); padding: 0.1em 0.3em; border-radius: 4px; font-size: 0.9em; }
pre { font-family: 'Consolas', 'Courier New', monospace; background: rgba(255,255,255,0.08); padding: 8px; border-radius: 6px; margin: 4px 0; display: block; white-space: pre-wrap; word-break: break-all; font-size: 0.85em; border-left: 3px solid rgba(255,255,255,0.2); }
.spoiler { background: rgba(255,255,255,0.15); color: transparent; border-radius: 4px; filter: blur(5px); }
.blockquote { display: block; border-left: 3px solid #64b5f6; padding-left: 10px; margin: 4px 0; font-style: italic; color: #7f91a4; }
`;

    // ── Build HTML body — identical structure to your original ────────────────
    const htmlBody = items.map(m => {
        let bInner = '';
        if (m.isSticker) {
            bInner = m.mediaB64
                ? `<img src="${m.mediaB64}" class="sticker-img"/>`
                : `<div style="font-style:italic;color:#7f91a4;font-size:0.7em">[Sticker]</div>`;
        } else {
            if (m.fName)    bInner += `<div class="f-line">Forwarded from ${m.fName}</div>`;
            if (m.showName) bInner += `<div class="bubble-name" style="color:${m.color}">${m.nameHtml}${m.statusB64 ? `<img src="${m.statusB64}" class="premium-emoji"/>` : ''}</div>`;
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

    // ── Full HTML — NO external font requests (all fonts are system/inline) ───
    // Removed Google Fonts link — that was causing networkidle0 to wait ~500ms
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

    // ── Render via Puppeteer ──────────────────────────────────────────────────
    console.log('🎨 Starting Puppeteer render...');
    const t0   = Date.now();
    const page = await acquirePage();

    try {
        // Use domcontentloaded instead of networkidle0 — MUCH faster
        // All our content is inline (base64) so there's nothing to wait for
        // EXCEPT emoji images from CDN — we handle those with waitForSelector
        await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });

        // Wait for emoji images to load (they come from CDN)
        // Use a short timeout — if CDN is slow we still render
        await page.evaluate(() => {
            return new Promise(resolve => {
                const imgs = [...document.querySelectorAll('img')];
                if (imgs.length === 0) return resolve();
                let loaded = 0;
                const done = () => { if (++loaded >= imgs.length) resolve(); };
                const timeout = setTimeout(resolve, 3000); // max 3s wait
                imgs.forEach(img => {
                    if (img.complete) done();
                    else { img.onload = done; img.onerror = done; }
                });
            });
        });

        const element = await page.$('#wrap');
        if (!element) throw new Error('Could not find #wrap element');

        const screenshot = await element.screenshot({
            omitBackground: true,
            type: 'png',
        });

        console.log(`✅ Puppeteer render done in ${Date.now() - t0}ms`);

        return await sharp(screenshot)
            .trim({ threshold: 5 })
            .sharpen({ sigma: 0.5 })
            .webp({ quality: 100, lossless: true })
            .toBuffer();

    } finally {
        // Return page to pool instead of closing it
        releasePage(page);
    }
}

module.exports = createImage;

// =============================================================================
// HEALTH CHECK SERVER
// =============================================================================
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
