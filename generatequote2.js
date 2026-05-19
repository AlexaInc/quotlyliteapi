require('dotenv').config();

const puppeteer = require('puppeteer');
const fs    = require('fs');
const path  = require('path');
const sharp = require('sharp');
const axios = require('axios');
const mtproto = require('./mtproto');

// =============================================================================
// ENVIRONMENT CONFIGURATION
// =============================================================================
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
    console.error('❌ FATAL: BOT_TOKEN is missing in environment variables.');
    process.exit(1);
}

const TG_API_ROOT  = (process.env.TG_API_ROOT  || 'https://api.telegram.org').replace(/\/$/, '');
const TG_FILE_ROOT = (process.env.TG_FILE_ROOT || `${TG_API_ROOT}/file`).replace(/\/$/, '');
const HF_TOKEN     = process.env.HFTOKEN || process.env.HF_TOKEN || '';

console.log(`📡 Telegram API root : ${TG_API_ROOT}`);
console.log(`📁 Telegram file root: ${TG_FILE_ROOT}`);
if (HF_TOKEN) console.log(`🤗 HF token detected — auth header sent on ALL requests`);
if (mtproto.isAvailable()) {
    console.log(`🚀 MTProto enabled — premium emojis fetched directly from Telegram DC`);
} else {
    console.log(`ℹ️  MTProto disabled (set TG_API_ID + TG_API_HASH) — using Bot API for premium emojis`);
}

// =============================================================================
// HTTP REQUEST HELPER
// =============================================================================
function buildTgRequestOptions(url, extra = {}) {
    const extraHeaders = extra.headers || {};
    const { headers: _, ...rest } = extra;

    const options = { timeout: 15000, ...rest };
    options.headers = { ...extraHeaders };

    if (HF_TOKEN) {
        options.headers['Authorization'] = `Bearer ${HF_TOKEN}`;
        options.headers['Referer']       = 'https://huggingface.co';
    }
    return options;
}

// =============================================================================
// BOT API CALLER (used as fallback when MTProto fails)
// =============================================================================
async function callTelegramAPI(method, params = {}) {
    const baseUrl = `${TG_API_ROOT}/bot${BOT_TOKEN}/${method}`;

    const buildQueryString = (p) => {
        const parts = [];
        for (const [k, v] of Object.entries(p)) {
            const value = (typeof v === 'object') ? JSON.stringify(v) : String(v);
            parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(value)}`);
        }
        return parts.join('&');
    };

    const qs = buildQueryString(params);

    // Try GET with query string
    try {
        const url = `${baseUrl}?${qs}`;
        const opts = buildTgRequestOptions(url, {
            headers: { 'Accept': 'application/json' },
            validateStatus: () => true,
        });
        const res = await axios.get(url, opts);
        if (res.status === 200) {
            const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
            if (data && typeof data.ok === 'boolean') return data;
        }
    } catch (e) { /* fall through */ }

    // Try POST with form-urlencoded
    try {
        const opts = buildTgRequestOptions(baseUrl, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            validateStatus: () => true,
        });
        const res = await axios.post(baseUrl, qs, opts);
        if (res.status === 200) {
            const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
            if (data && typeof data.ok === 'boolean') return data;
        }
    } catch (e) { /* fall through */ }

    throw new Error(`Bot API failed for ${method}`);
}

// =============================================================================
// FONT INVENTORY
// =============================================================================
;(function inventoryFonts() {
    const SCAN_DIRS = ['/usr/share/fonts', '/usr/local/share/fonts', '/root/.fonts'];
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
    console.log(`\n📦 Font inventory (${Date.now() - t0}ms):`);
    console.log(`   .ttf  : ${counts.ttf}`);
    console.log(`   .otf  : ${counts.otf}`);
    console.log(`   .ttc  : ${counts.ttc}  (collections — each contains 2-4 fonts)`);
    console.log(`   .woff : ${counts.woff}`);
    console.log(`   .woff2: ${counts.woff2}`);
    console.log(`   total : ${counts.total} font files\n`);
    console.log(`✅ Chromium will access all of these via fontconfig`);
})();

// =============================================================================
// SHARED BROWSER
// =============================================================================
let browserInstance = null;

async function getBrowser() {
    if (browserInstance && browserInstance.isConnected()) return browserInstance;

    const launchArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--font-render-hinting=none',
        '--disable-font-subpixel-positioning',
        '--enable-font-antialiasing',
    ];

    browserInstance = await puppeteer.launch({
        headless: 'new',
        args: launchArgs,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        defaultViewport: { width: 512, height: 512, deviceScaleFactor: 2 },
    });

    console.log('🌐 Browser launched');
    return browserInstance;
}

// =============================================================================
// EMOJI PROVIDERS
// =============================================================================
const EMOJI_CDN_PROVIDERS = {
    apple:     (code) => `https://cdn.jsdelivr.net/gh/nicbou/emoji-cdn@master/apple/${code}.png`,
    google:    (code) => `https://cdn.jsdelivr.net/gh/nicbou/emoji-cdn@master/google/${code}.png`,
    twitter:   (code) => `https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/${code}.png`,
    facebook:  (code) => `https://cdn.jsdelivr.net/gh/nicbou/emoji-cdn@master/facebook/${code}.png`,
    samsung:   (code) => `https://cdn.jsdelivr.net/gh/nicbou/emoji-cdn@master/samsung/${code}.png`,
    microsoft: (code) => `https://cdn.jsdelivr.net/gh/nicbou/emoji-cdn@master/microsoft/${code}.png`,
    whatsapp:  (code) => `https://cdn.jsdelivr.net/gh/nicbou/emoji-cdn@master/whatsapp/${code}.png`,
};

function getEmojiUrl(emoji, provider = 'apple') {
    const codes = [...emoji].map(c => c.codePointAt(0).toString(16)).join('-');
    const getUrl = EMOJI_CDN_PROVIDERS[provider] || EMOJI_CDN_PROVIDERS.apple;
    return getUrl(codes);
}

// =============================================================================
// PREMIUM EMOJI RESOLVER
// =============================================================================
const premiumEmojiCache = new Map();

async function fetchPremiumEmojiAsBase64(emojiId) {
    if (premiumEmojiCache.has(emojiId)) return premiumEmojiCache.get(emojiId);

    try {
        // Try MTProto first
        if (mtproto.isAvailable()) {
            const docs = await mtproto.getCustomEmojiDocuments([emojiId]);
            if (docs && docs.size > 0) {
                const doc = docs.values().next().value;
                if (doc && doc.buffer) {
                    let imgBuf = doc.buffer;
                    // Convert to PNG if needed
                    if (doc.mimeType !== 'image/png' && doc.mimeType !== 'image/webp') {
                        try {
                            imgBuf = await sharp(imgBuf).png().toBuffer();
                        } catch (e) { /* use original */ }
                    }
                    const b64 = `data:image/png;base64,${imgBuf.toString('base64')}`;
                    premiumEmojiCache.set(emojiId, b64);
                    return b64;
                }
            }
        }

        // Fallback: Bot API getCustomEmojiStickers
        const result = await callTelegramAPI('getCustomEmojiStickers', {
            custom_emoji_ids: JSON.stringify([emojiId])
        });

        if (result && result.ok && result.result && result.result.length > 0) {
            const sticker = result.result[0];
            let fileId = sticker.thumbnail ? sticker.thumbnail.file_id : sticker.file_id;

            const fileResult = await callTelegramAPI('getFile', { file_id: fileId });
            if (fileResult && fileResult.ok && fileResult.result) {
                const fileUrl = `${TG_FILE_ROOT}/bot${BOT_TOKEN}/${fileResult.result.file_path}`;
                const opts = buildTgRequestOptions(fileUrl, { responseType: 'arraybuffer' });
                const response = await axios.get(fileUrl, opts);

                let imgBuf = Buffer.from(response.data);
                try {
                    imgBuf = await sharp(imgBuf).resize(100, 100, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
                } catch (e) { /* use original */ }

                const b64 = `data:image/png;base64,${imgBuf.toString('base64')}`;
                premiumEmojiCache.set(emojiId, b64);
                return b64;
            }
        }
    } catch (e) {
        console.warn(`⚠️  Failed to fetch premium emoji ${emojiId}: ${e.message}`);
    }

    premiumEmojiCache.set(emojiId, null);
    return null;
}

async function renderPremiumEmojiOrFallback(emojiId, fallbackText, provider, cssClass = 'msg-emoji') {
    const b64 = await fetchPremiumEmojiAsBase64(emojiId);
    if (b64) {
        return `<img src="${b64}" class="${cssClass}" alt="${fallbackText}" style="width:20px;height:20px;vertical-align:middle;display:inline-block;" />`;
    }
    return `<span class="${cssClass}">${escapeHtml(fallbackText)}</span>`;
}

// =============================================================================
// HTML HELPERS
// =============================================================================
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Telegram name color palette
const NAME_COLORS = [
    '#FC5C57', // 0 - red
    '#33B5E5', // 1 - blue
    '#8E24AA', // 2 - purple
    '#4CAF50', // 3 - green
    '#FF9800', // 4 - orange
    '#E91E63', // 5 - pink
    '#00BCD4', // 6 - cyan
    '#FFEB3B', // 7 - yellow
    '#795548', // 8 - brown
    '#607D8B', // 9 - blue grey
];

function getNameColor(colorId) {
    const id = parseInt(colorId, 10) || 0;
    return NAME_COLORS[id % NAME_COLORS.length];
}

// =============================================================================
// ENTITY PARSER - Telegram entities to HTML
// =============================================================================
async function entitiesToHtml(text, entities = [], provider = 'apple') {
    if (!text) return '';
    if (!entities || entities.length === 0) return escapeHtml(text);

    // Build open/close tags sorted by position
    const tags = [];
    for (const e of entities) {
        tags.push({ pos: e.offset, type: 'open', info: e });
        tags.push({ pos: e.offset + e.length, type: 'close', info: e });
    }
    tags.sort((a, b) => a.pos - b.pos || (a.type === 'open' ? -1 : 1));

    let html = '';
    let cursor = 0;

    for (let i = 0; i < tags.length; i++) {
        const t = tags[i];

        // Add text before this tag
        if (t.pos > cursor) {
            html += escapeHtml(text.substring(cursor, t.pos));
            cursor = t.pos;
        }

        if (t.type === 'open') {
            const e = t.info;
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
                const fallbackText = text.substring(e.offset, e.offset + e.length);
                const emojiId      = String(e.custom_emoji_id);
                html += await renderPremiumEmojiOrFallback(
                    emojiId, fallbackText, provider, 'msg-emoji'
                );
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
            else if (e.type === 'spoiler')       html += '</span>';
            else if (e.type === 'blockquote' || e.type === 'expandable_blockquote')
                html += '</span>';
            else if (['url','text_url','mention','bot_command'].includes(e.type))
                html += '</span>';
        }
    }

    // Remaining text after last entity
    if (cursor < text.length) {
        html += escapeHtml(text.substring(cursor));
    }

    return html;
}

// =============================================================================
// AVATAR HELPER
// =============================================================================
function generateAvatarSvg(firstName, lastName, colorId) {
    const initials = ((firstName || '')[0] || '') + ((lastName || '')[0] || '');
    const color = getNameColor(colorId);
    return `data:image/svg+xml,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
            <rect width="100" height="100" rx="50" fill="${color}"/>
            <text x="50" y="50" text-anchor="middle" dominant-baseline="central"
                  font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="white">
                ${initials.toUpperCase()}
            </text>
        </svg>
    `)}`;
}

// =============================================================================
// BUILD QUOTE HTML
// =============================================================================
async function buildQuoteHtml(messages) {
    let messagesHtml = '';

    for (let idx = 0; idx < messages.length; idx++) {
        const msg = messages[idx];
        const firstName = msg.firstName || 'User';
        const lastName  = msg.lastName || '';
        const colorId   = parseInt(msg.nameColorId || msg.namecolorid || 0, 10);
        const nameColor = getNameColor(colorId);
        const provider  = msg.emojiProvider || 'apple';
        const isLast    = idx === messages.length - 1;

        // Avatar
        let avatarSrc;
        if (msg.inputImageBuffer) {
            const b64 = Buffer.isBuffer(msg.inputImageBuffer)
                ? msg.inputImageBuffer.toString('base64')
                : msg.inputImageBuffer;
            avatarSrc = `data:image/png;base64,${b64}`;
        } else {
            avatarSrc = generateAvatarSvg(firstName, lastName, colorId);
        }

        // Message content
        const messageHtml = await entitiesToHtml(
            msg.message || '',
            msg.entities || [],
            provider
        );

        // Reply section
        let replyHtml = '';
        if (msg.replySender || msg.replyMessage) {
            const replyColor = getNameColor(msg.replysendercolor || msg.replySenderColor || 0);
            replyHtml = `
                <div class="reply-block" style="border-left: 2px solid ${replyColor}; padding-left: 8px; margin-bottom: 6px; opacity: 0.7;">
                    <div class="reply-sender" style="color: ${replyColor}; font-size: 13px; font-weight: 600;">${escapeHtml(msg.replySender || '')}</div>
                    <div class="reply-text" style="font-size: 13px; color: #aaa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px;">${escapeHtml(msg.replyMessage || '')}</div>
                </div>
            `;
        }

        // Media section
        let mediaHtml = '';
        if (msg.mediaBuffer) {
            const mediaBuf = Buffer.isBuffer(msg.mediaBuffer)
                ? msg.mediaBuffer
                : Buffer.from(msg.mediaBuffer, 'base64');
            const mediaB64 = `data:image/png;base64,${mediaBuf.toString('base64')}`;
            mediaHtml = `<div class="media-block" style="margin-bottom: 6px;"><img src="${mediaB64}" style="max-width: 100%; border-radius: 8px;" /></div>`;
        }

        // Name display with optional custom emoji
        let nameHtml = `<span style="color: ${nameColor}; font-weight: 600; font-size: 14px;">${escapeHtml(firstName)} ${escapeHtml(lastName)}</span>`;

        if (msg.customemojiid) {
            const emojiHtml = await renderPremiumEmojiOrFallback(
                String(msg.customemojiid), '⭐', provider, 'name-emoji'
            );
            nameHtml += ` ${emojiHtml}`;
        }

        const tailSvg = isLast ? `
            <div class="tail" style="position: absolute; bottom: 0; left: -8px; width: 20px; height: 20px;">
                <svg viewBox="0 0 11 20" width="11" height="20">
                    <path d="M11 0 C11 0 10 7 6 12 C2 17 0 20 0 20 L11 20 Z" fill="#1E2A3A"/>
                </svg>
            </div>
        ` : '';

        messagesHtml += `
            <div class="message-row" style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: ${isLast ? '0' : '2'}px;">
                ${idx === 0 ? `<img class="avatar" src="${avatarSrc}" style="width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;" />` : '<div style="width: 42px; flex-shrink: 0;"></div>'}
                <div class="bubble" style="
                    background: #1E2A3A;
                    border-radius: ${idx === 0 ? '12px 12px' : '4px 12px'} ${isLast ? '12px 0px' : '12px 4px'};
                    padding: 7px 10px;
                    max-width: 380px;
                    min-width: 100px;
                    position: relative;
                    word-wrap: break-word;
                ">
                    ${idx === 0 ? nameHtml + '<br/>' : ''}
                    ${replyHtml}
                    ${mediaHtml}
                    <div class="msg-text" style="color: #fff; font-size: 15px; line-height: 1.4; font-family: 'Noto Sans', 'Noto Sans CJK SC', 'Noto Sans Arabic', 'Noto Sans Devanagari', 'Noto Sans Bengali', 'Noto Color Emoji', 'Segoe UI', Roboto, Arial, sans-serif;">${messageHtml || '&nbsp;'}</div>
                    ${tailSvg}
                </div>
            </div>
        `;
    }

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                background: transparent;
                padding: 8px;
                display: inline-block;
            }
            .quote-container {
                display: inline-flex;
                flex-direction: column;
                gap: 1px;
            }
            code {
                background: rgba(0,0,0,0.3);
                padding: 1px 4px;
                border-radius: 4px;
                font-family: 'JetBrains Mono', 'Fira Code', 'Noto Sans Mono', monospace;
                font-size: 13px;
            }
            pre {
                background: rgba(0,0,0,0.3);
                padding: 8px;
                border-radius: 6px;
                font-family: 'JetBrains Mono', 'Fira Code', 'Noto Sans Mono', monospace;
                font-size: 13px;
                overflow-x: auto;
                white-space: pre-wrap;
                margin: 4px 0;
            }
            .spoiler {
                background: #666;
                color: #666;
                border-radius: 2px;
                padding: 0 2px;
            }
            .blockquote {
                display: block;
                border-left: 3px solid #6366f1;
                padding-left: 8px;
                margin: 4px 0;
            }
            .link {
                color: #60a5fa;
            }
            .msg-emoji {
                width: 20px;
                height: 20px;
                vertical-align: middle;
                display: inline-block;
            }
            .name-emoji {
                width: 18px;
                height: 18px;
                vertical-align: middle;
                display: inline-block;
            }
            img.avatar {
                image-rendering: auto;
            }
        </style>
    </head>
    <body>
        <div class="quote-container">
            ${messagesHtml}
        </div>
    </body>
    </html>
    `;
}

// =============================================================================
// MAIN: GENERATE QUOTE IMAGE
// =============================================================================
async function createImage(messages) {
    if (!messages || messages.length === 0) {
        throw new Error('No messages provided');
    }

    const html = await buildQuoteHtml(messages);
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
        // Set viewport
        await page.setViewport({ width: 512, height: 512, deviceScaleFactor: 2 });

        // Set content
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

        // Wait for any images to load
        await page.evaluate(() => {
            return Promise.all(
                Array.from(document.querySelectorAll('img')).map(img => {
                    if (img.complete) return Promise.resolve();
                    return new Promise(resolve => {
                        img.onload = resolve;
                        img.onerror = resolve;
                    });
                })
            );
        });

        // Get bounding box of content
        const boundingBox = await page.evaluate(() => {
            const el = document.querySelector('.quote-container');
            if (!el) return null;
            const rect = el.getBoundingClientRect();
            return {
                x: Math.floor(rect.x),
                y: Math.floor(rect.y),
                width: Math.ceil(rect.width),
                height: Math.ceil(rect.height),
            };
        });

        if (!boundingBox || boundingBox.width === 0 || boundingBox.height === 0) {
            throw new Error('Failed to get content dimensions');
        }

        // Screenshot the quote area
        const pngBuffer = await page.screenshot({
            type: 'png',
            clip: {
                x: boundingBox.x * 2,
                y: boundingBox.y * 2,
                width: boundingBox.width * 2,
                height: boundingBox.height * 2,
            },
            omitBackground: true,
        });

        // Convert to WebP with sharp
        const webpBuffer = await sharp(pngBuffer)
            .resize({
                width: 512,
                height: Math.min(Math.ceil(512 * (boundingBox.height / boundingBox.width)), 512),
                fit: 'inside',
                withoutEnlargement: true,
            })
            .webp({ quality: 90 })
            .toBuffer();

        return webpBuffer;
    } finally {
        await page.close().catch(() => {});
    }
}

module.exports = createImage;
