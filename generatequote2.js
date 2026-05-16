require('dotenv').config();

const fs = require('fs');
const path = require('path');
const satori = require('satori').default;
const { Resvg } = require('@resvg/resvg-js');
const parse = require('html-react-parser').default;
const { createCanvas, registerFont } = require('canvas');
const sharp = require('sharp');
const axios = require('axios');

// =============================================================================
// FONT LOADER - Universal Unicode Coverage
// Validates every font before giving it to Satori.
// Bitmap fonts (NotoColorEmoji, some CJK) crash Satori — we skip them.
// Fonts are loaded ONCE at startup and reused for every request.
// =============================================================================

// Satori uses opentype.js internally. We use the same parser to pre-validate
// every font file so we never pass an incompatible font to Satori.
const opentype = require('@shuding/opentype.js');

function isSatoriCompatible(buffer) {
    try {
        const font = opentype.parse(buffer.buffer || buffer, { lowMemory: true });
        // Must have outline tables (TrueType or CFF)
        // Bitmap-only fonts (CBDT/CBLC or EBDT/EBLC without outlines) will throw
        // or have no glyphs with outlines
        return !!(font && font.glyphs && font.glyphs.length > 0);
    } catch (e) {
        return false;
    }
}

function loadFonts() {
    const families  = [];
    const loaded    = new Set();
    let   skipped   = 0;
    let   validated = 0;

    // ── Scan directories in priority order ────────────────────────────────────
    const SCAN_DIRS = [
        '/usr/share/fonts/truetype/noto-manual',  // our wget'd specific fonts
        '/usr/share/fonts/truetype/noto',          // apt: fonts-noto base
        '/usr/share/fonts/truetype/noto-extra',
        '/usr/share/fonts/opentype/noto',          // apt: CJK opentype
        '/usr/share/fonts/truetype/noto-cjk',
        '/usr/share/fonts/opentype/noto-cjk',
        '/usr/share/fonts/noto',
        '/usr/share/fonts/noto-cjk',
        '/usr/local/share/fonts',
        'C:\\Windows\\Fonts',                      // local dev
    ];

    // ── Files to ALWAYS skip (bitmap / color fonts that crash Satori) ─────────
    const SKIP_PATTERNS = [
        /NotoColorEmoji/i,       // CBDT/CBLC bitmap — no outlines
        /NotoEmoji(?!.*Mono)/i,  // older bitmap emoji font
        /LastResort/i,           // Apple last-resort font
        /\.ttc$/i,               // TTC collections — Satori can't handle them
    ];

    // ── Font family name mapping (filename → Satori family name) ─────────────
    const NAME_MAP = [
        // Symbols FIRST — highest priority for rare codepoints
        { r: /NotoSansSymbols2/i,             n: 'Noto Sans Symbols2' },
        { r: /NotoSansSymbols/i,              n: 'Noto Sans Symbols' },
        { r: /NotoSansMath/i,                 n: 'Noto Sans Math' },
        { r: /NotoMusic/i,                    n: 'Noto Music' },
        // CJK
        { r: /NotoSansCJKsc/i,               n: 'Noto Sans CJK SC' },
        { r: /NotoSansCJKtc/i,               n: 'Noto Sans CJK TC' },
        { r: /NotoSansCJKjp/i,               n: 'Noto Sans CJK JP' },
        { r: /NotoSansCJKkr/i,               n: 'Noto Sans CJK KR' },
        { r: /NotoSansCJK/i,                 n: 'Noto Sans CJK' },
        { r: /NotoSerifCJK/i,                n: 'Noto Serif CJK' },
        // Script-specific (alphabetical)
        { r: /NotoSansAdlam/i,               n: 'Noto Sans Adlam' },
        { r: /NotoSansAhom/i,                n: 'Noto Sans Ahom' },
        { r: /NotoSansArabic/i,              n: 'Noto Sans Arabic' },
        { r: /NotoSansArmenian/i,            n: 'Noto Sans Armenian' },
        { r: /NotoSansAvestan/i,             n: 'Noto Sans Avestan' },
        { r: /NotoSansBalinese/i,            n: 'Noto Sans Balinese' },
        { r: /NotoSansBamum/i,               n: 'Noto Sans Bamum' },
        { r: /NotoSansBatak/i,               n: 'Noto Sans Batak' },
        { r: /NotoSansBengali/i,             n: 'Noto Sans Bengali' },
        { r: /NotoSansBrahmi/i,              n: 'Noto Sans Brahmi' },
        { r: /NotoSansBuginese/i,            n: 'Noto Sans Buginese' },
        { r: /NotoSansBuhid/i,               n: 'Noto Sans Buhid' },
        { r: /NotoSansCanadianAboriginal/i,  n: 'Noto Sans Canadian Aboriginal' },
        { r: /NotoSansCarian/i,              n: 'Noto Sans Carian' },
        { r: /NotoSansChakma/i,              n: 'Noto Sans Chakma' },
        { r: /NotoSansCham/i,                n: 'Noto Sans Cham' },
        { r: /NotoSansCoptic/i,              n: 'Noto Sans Coptic' },
        { r: /NotoSansCuneiform/i,           n: 'Noto Sans Cuneiform' },
        { r: /NotoSansCypriot/i,             n: 'Noto Sans Cypriot' },
        { r: /NotoSansDeseret/i,             n: 'Noto Sans Deseret' },
        { r: /NotoSansDevanagari/i,          n: 'Noto Sans Devanagari' },
        { r: /NotoSansDuployan/i,            n: 'Noto Sans Duployan' },
        { r: /NotoSansEgyptianHieroglyphs/i, n: 'Noto Sans Egyptian Hieroglyphs' },
        { r: /NotoSansElbasan/i,             n: 'Noto Sans Elbasan' },
        { r: /NotoSansEthiopic/i,            n: 'Noto Sans Ethiopic' },
        { r: /NotoSansGeorgian/i,            n: 'Noto Sans Georgian' },
        { r: /NotoSansGlagolitic/i,          n: 'Noto Sans Glagolitic' },
        { r: /NotoSansGothic/i,              n: 'Noto Sans Gothic' },
        { r: /NotoSansGujarati/i,            n: 'Noto Sans Gujarati' },
        { r: /NotoSansGurmukhi/i,            n: 'Noto Sans Gurmukhi' },
        { r: /NotoSansHanifiRohingya/i,      n: 'Noto Sans Hanifi Rohingya' },
        { r: /NotoSansHanunoo/i,             n: 'Noto Sans Hanunoo' },
        { r: /NotoSansHebrew/i,              n: 'Noto Sans Hebrew' },
        { r: /NotoSansImperialAramaic/i,     n: 'Noto Sans Imperial Aramaic' },
        { r: /NotoSansJavanese/i,            n: 'Noto Sans Javanese' },
        { r: /NotoSansKannada/i,             n: 'Noto Sans Kannada' },
        { r: /NotoSansKayahLi/i,             n: 'Noto Sans Kayah Li' },
        { r: /NotoSansKharoshthi/i,          n: 'Noto Sans Kharoshthi' },
        { r: /NotoSansKhmer/i,               n: 'Noto Sans Khmer' },
        { r: /NotoSansLao/i,                 n: 'Noto Sans Lao' },
        { r: /NotoSansLepcha/i,              n: 'Noto Sans Lepcha' },
        { r: /NotoSansLimbu/i,               n: 'Noto Sans Limbu' },
        { r: /NotoSansLinearA/i,             n: 'Noto Sans Linear A' },
        { r: /NotoSansLinearB/i,             n: 'Noto Sans Linear B' },
        { r: /NotoSansLisu/i,                n: 'Noto Sans Lisu' },
        { r: /NotoSansLycian/i,              n: 'Noto Sans Lycian' },
        { r: /NotoSansLydian/i,              n: 'Noto Sans Lydian' },
        { r: /NotoSansMalayalam/i,           n: 'Noto Sans Malayalam' },
        { r: /NotoSansMandaic/i,             n: 'Noto Sans Mandaic' },
        { r: /NotoSansMarchen/i,             n: 'Noto Sans Marchen' },
        { r: /NotoSansMasaramGondi/i,        n: 'Noto Sans Masaram Gondi' },
        { r: /NotoSansMeeteiMayek/i,         n: 'Noto Sans Meetei Mayek' },
        { r: /NotoSansMiao/i,                n: 'Noto Sans Miao' },
        { r: /NotoSansMongolian/i,           n: 'Noto Sans Mongolian' },
        { r: /NotoSansMyanmar/i,             n: 'Noto Sans Myanmar' },
        { r: /NotoSansNewa/i,                n: 'Noto Sans Newa' },
        { r: /NotoSansNKo/i,                 n: 'Noto Sans NKo' },
        { r: /NotoSansOgham/i,               n: 'Noto Sans Ogham' },
        { r: /NotoSansOlChiki/i,             n: 'Noto Sans Ol Chiki' },
        { r: /NotoSansOldItalic/i,           n: 'Noto Sans Old Italic' },
        { r: /NotoSansOldPersian/i,          n: 'Noto Sans Old Persian' },
        { r: /NotoSansOldSouthArabian/i,     n: 'Noto Sans Old South Arabian' },
        { r: /NotoSansOldTurkic/i,           n: 'Noto Sans Old Turkic' },
        { r: /NotoSansOriya/i,               n: 'Noto Sans Oriya' },
        { r: /NotoSansOsage/i,               n: 'Noto Sans Osage' },
        { r: /NotoSansOsmanya/i,             n: 'Noto Sans Osmanya' },
        { r: /NotoSansPahawhHmong/i,         n: 'Noto Sans Pahawh Hmong' },
        { r: /NotoSansPhoenician/i,          n: 'Noto Sans Phoenician' },
        { r: /NotoSansRejang/i,              n: 'Noto Sans Rejang' },
        { r: /NotoSansRunic/i,               n: 'Noto Sans Runic' },
        { r: /NotoSansSamaritan/i,           n: 'Noto Sans Samaritan' },
        { r: /NotoSansSaurashtra/i,          n: 'Noto Sans Saurashtra' },
        { r: /NotoSansShavian/i,             n: 'Noto Sans Shavian' },
        { r: /NotoSansSignWriting/i,         n: 'Noto Sans SignWriting' },
        { r: /NotoSansSinhala/i,             n: 'Noto Sans Sinhala' },
        { r: /NotoSansSoyombo/i,             n: 'Noto Sans Soyombo' },
        { r: /NotoSansSundanese/i,           n: 'Noto Sans Sundanese' },
        { r: /NotoSansSylotiNagri/i,         n: 'Noto Sans Syloti Nagri' },
        { r: /NotoSansSyriac/i,              n: 'Noto Sans Syriac' },
        { r: /NotoSansTagalog/i,             n: 'Noto Sans Tagalog' },
        { r: /NotoSansTagbanwa/i,            n: 'Noto Sans Tagbanwa' },
        { r: /NotoSansTaiLe/i,               n: 'Noto Sans Tai Le' },
        { r: /NotoSansTaiTham/i,             n: 'Noto Sans Tai Tham' },
        { r: /NotoSansTaiViet/i,             n: 'Noto Sans Tai Viet' },
        { r: /NotoSansTamil/i,               n: 'Noto Sans Tamil' },
        { r: /NotoSansTelugu/i,              n: 'Noto Sans Telugu' },
        { r: /NotoSansThaana/i,              n: 'Noto Sans Thaana' },
        { r: /NotoSansThai/i,                n: 'Noto Sans Thai' },
        { r: /NotoSansTifinagh/i,            n: 'Noto Sans Tifinagh' },
        { r: /NotoSansUgaritic/i,            n: 'Noto Sans Ugaritic' },
        { r: /NotoSansVai/i,                 n: 'Noto Sans Vai' },
        { r: /NotoSansWancho/i,              n: 'Noto Sans Wancho' },
        { r: /NotoSansYi/i,                  n: 'Noto Sans Yi' },
        { r: /NotoSansZanabazarSquare/i,     n: 'Noto Sans Zanabazar Square' },
        { r: /NotoSerifTangut/i,             n: 'Noto Serif Tangut' },
        { r: /NotoSerifTibetan/i,            n: 'Noto Serif Tibetan' },
        { r: /NotoTraditionalNushu/i,        n: 'Noto Traditional Nushu' },
        // Generic Noto Sans/Serif — must be AFTER all specific entries
        { r: /NotoSans/i,                    n: 'Noto Sans' },
        { r: /NotoSerif/i,                   n: 'Noto Serif' },
        { r: /NotoMono/i,                    n: 'Noto Mono' },
        // Windows
        { r: /seguisym/i,                    n: 'Segoe UI Symbol' },
        { r: /seguiemj/i,                    n: 'Segoe UI Emoji' },
        { r: /arial/i,                       n: 'Arial' },
    ];

    // Satori fallback order — first match wins per glyph
    const PRIORITY = [
        'Noto Sans',
        'Noto Sans Symbols', 'Noto Sans Symbols2',
        'Noto Sans Math', 'Noto Music',
        'Noto Sans Arabic', 'Noto Sans Devanagari', 'Noto Sans Bengali',
        'Noto Sans Tamil', 'Noto Sans Telugu', 'Noto Sans Kannada',
        'Noto Sans Malayalam', 'Noto Sans Gujarati', 'Noto Sans Gurmukhi',
        'Noto Sans Oriya', 'Noto Sans Sinhala',
        'Noto Sans Thai', 'Noto Sans Lao', 'Noto Sans Khmer',
        'Noto Sans Myanmar', 'Noto Sans Tai Le', 'Noto Sans Tai Tham',
        'Noto Sans Tai Viet', 'Noto Sans New Tai Lue',
        'Noto Sans Hebrew', 'Noto Sans Syriac', 'Noto Sans Thaana',
        'Noto Sans Mandaic', 'Noto Sans Samaritan',
        'Noto Sans Imperial Aramaic', 'Noto Sans Nabataean',
        'Noto Sans Georgian', 'Noto Sans Armenian', 'Noto Sans Ethiopic',
        'Noto Sans Mongolian', 'Noto Serif Tibetan',
        'Noto Sans Runic', 'Noto Sans Ogham', 'Noto Sans Glagolitic',
        'Noto Sans Gothic', 'Noto Sans Old Italic', 'Noto Sans Old Persian',
        'Noto Sans Old Turkic', 'Noto Sans Phoenician', 'Noto Sans Ugaritic',
        'Noto Sans Cuneiform', 'Noto Sans Egyptian Hieroglyphs',
        'Noto Sans Linear A', 'Noto Sans Linear B',
        'Noto Sans Duployan', 'Noto Sans SignWriting',
        'Noto Sans Canadian Aboriginal',
        'Noto Sans Tifinagh', 'Noto Sans Vai', 'Noto Sans Bamum',
        'Noto Sans Miao', 'Noto Sans Yi', 'Noto Sans Lisu',
        'Noto Sans Adlam', 'Noto Sans Batak', 'Noto Sans Buginese',
        'Noto Sans Javanese', 'Noto Sans Sundanese', 'Noto Sans Balinese',
        'Noto Sans Rejang', 'Noto Sans Hanunoo', 'Noto Sans Tagalog',
        'Noto Sans Tagbanwa', 'Noto Sans Buhid',
        'Noto Sans Meetei Mayek', 'Noto Sans Kayah Li',
        'Noto Sans Lepcha', 'Noto Sans Limbu', 'Noto Sans Ol Chiki',
        'Noto Sans NKo', 'Noto Sans Osmanya', 'Noto Sans Deseret',
        'Noto Sans Shavian', 'Noto Sans Osage', 'Noto Sans Elbasan',
        'Noto Sans Coptic', 'Noto Sans Chakma', 'Noto Sans Cham',
        'Noto Sans Pahawh Hmong', 'Noto Sans Masaram Gondi',
        'Noto Sans Soyombo', 'Noto Sans Zanabazar Square',
        'Noto Sans Marchen', 'Noto Sans Newa', 'Noto Sans Wancho',
        'Noto Traditional Nushu', 'Noto Serif Tangut',
        'Noto Sans Hanifi Rohingya',
        // CJK last — largest files, slowest to search
        'Noto Sans CJK', 'Noto Sans CJK SC', 'Noto Sans CJK TC',
        'Noto Sans CJK JP', 'Noto Sans CJK KR', 'Noto Serif CJK',
        // Windows
        'Segoe UI Symbol', 'Segoe UI Emoji', 'Arial',
    ];

    function guessWeight(f) {
        if (/Black/i.test(f))                         return 900;
        if (/ExtraBold|Extra[-_]Bold|Heavy/i.test(f)) return 800;
        if (/Bold/i.test(f))                          return 700;
        if (/SemiBold|Semi[-_]Bold/i.test(f))        return 600;
        if (/Medium/i.test(f))                        return 500;
        if (/Light/i.test(f))                         return 300;
        if (/Thin|ExtraLight/i.test(f))               return 100;
        return 400;
    }

    function guessStyle(f) {
        return /Italic|Oblique/i.test(f) ? 'italic' : 'normal';
    }

    function deriveName(filename) {
        for (const rule of NAME_MAP) {
            if (rule.r.test(filename)) return rule.n;
        }
        return path.basename(filename, path.extname(filename))
            .replace(/[-_](Regular|Bold|Italic|Light|Medium|Thin|Black|SemiBold|ExtraBold)/gi, '')
            .replace(/[-_]/g, ' ').trim() || 'Unknown';
    }

    // ── Scan ──────────────────────────────────────────────────────────────────
    for (const dir of SCAN_DIRS) {
        if (!fs.existsSync(dir)) continue;
        let files;
        try { files = fs.readdirSync(dir); } catch { continue; }

        for (const file of files) {
            // Only TTF and OTF — skip TTC collections entirely
            if (!/\.(ttf|otf)$/i.test(file)) continue;

            const fullPath = path.join(dir, file);
            if (loaded.has(fullPath)) continue;
            loaded.add(fullPath);

            // Skip known-incompatible fonts before even reading them
            if (SKIP_PATTERNS.some(p => p.test(file))) {
                console.log(`⏭️  Skipped (bitmap/collection): ${file}`);
                skipped++;
                continue;
            }

            let data;
            try { data = fs.readFileSync(fullPath); }
            catch (e) { console.warn(`⚠️  Cannot read: ${file}`); continue; }

            // ── VALIDATE with opentype.js before giving to Satori ─────────────
            // This is the key fix: if opentype can't parse it, Satori will crash
            if (!isSatoriCompatible(data)) {
                console.log(`⏭️  Skipped (no outlines/incompatible): ${file}`);
                skipped++;
                continue;
            }

            validated++;
            const name   = deriveName(file);
            const weight = guessWeight(file);
            const style  = guessStyle(file);

            families.push({ name, data, weight, style });

            // Register with node-canvas (for renderChunkImg name rendering)
            try { registerFont(fullPath, { family: name }); } catch (_) {}

            console.log(`✅ [${name}] w${weight} ${style} ← ${file}`);
        }
    }

    // ── Sort by priority ──────────────────────────────────────────────────────
    families.sort((a, b) => {
        const ai = PRIORITY.indexOf(a.name);
        const bi = PRIORITY.indexOf(b.name);
        return (ai === -1 ? 9999 : ai) - (bi === -1 ? 9999 : bi);
    });

    console.log(`\n📦 Font pipeline ready:`);
    console.log(`   ✅ Loaded   : ${validated} font faces`);
    console.log(`   ⏭️  Skipped  : ${skipped} incompatible files`);
    console.log(`   📋 Families : ${[...new Set(families.map(f => f.name))].length} unique families\n`);

    if (families.length === 0) {
        console.error('❌ CRITICAL: No fonts loaded! All text will be tofu.');
    }

    return families;
}

// Load once at startup — never reload per request
const fonts = loadFonts();

// =============================================================================
// BOT TOKEN
// =============================================================================
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
    console.error('❌ FATAL: BOT_TOKEN is missing in environment variables.');
    process.exit(1);
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
// NAME RENDERING via node-canvas
// node-canvas uses system fonts (Pango/FreeType) which support ALL scripts.
// We render name text to tiny canvas PNGs and embed them as <img> tags.
// This means names NEVER go through Satori's font lookup = no tofu in names.
// =============================================================================
function renderChunkImg(text, fontSize, color) {
    const fontStack = [
        'Noto Sans', 'Noto Sans Symbols2', 'Noto Sans Symbols',
        'Noto Sans Math', 'Noto Music',
        'Noto Sans CJK', 'Noto Sans Arabic', 'Noto Sans Devanagari',
        'Noto Sans Thai', 'Noto Sans Hebrew', 'sans-serif'
    ].join(', ');

    const tmp = createCanvas(1, 1);
    const tc  = tmp.getContext('2d');
    tc.font   = `600 ${fontSize}px ${fontStack}`;
    const w   = Math.max(1, Math.ceil(tc.measureText(text).width) + 2);
    const h   = Math.max(1, Math.ceil(fontSize * 1.5));

    const cv  = createCanvas(w, h);
    const ctx = cv.getContext('2d');
    ctx.font         = `600 ${fontSize}px ${fontStack}`;
    ctx.fillStyle    = color;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 1, h / 2);

    return `data:image/png;base64,${cv.toBuffer('image/png').toString('base64')}`;
}

function nameToHtml(text, color, fontSize) {
    if (!text) return '';
    const seg = new Intl.Segmenter();
    let res = '', chunk = '';

    const flushChunk = () => {
        if (!chunk) return;
        res += `<img src="${renderChunkImg(chunk, fontSize, color)}" `
             + `style="height:1em;vertical-align:middle;margin:0;padding:0;display:inline-flex;"/>`;
        chunk = '';
    };

    for (const { segment: c } of seg.segment(text)) {
        if (IS_EMOJI.test(c)) { flushChunk(); res += `<img src="${toAppleEmojiUrl(c)}" style="height:1.2em;width:1.2em;vertical-align:middle;"/>`; }
        else chunk += c;
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
        if (p) { r.push((0x10000 + ((p - 0xD800) << 10) + (c - 0xDC00)).toString(16)); p = 0; }
        else if (0xD800 <= c && c <= 0xDBFF) p = c;
        else r.push(c.toString(16));
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
    console.log(`🔍 Fetching premium emoji: ${id}`);
    try {
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
    } catch (e) { console.error(`❌ Premium emoji fetch failed: ${id}`, e.message); return null; }
}

// =============================================================================
// MESSAGE HTML BUILDER
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
                out += `<img src="${toAppleEmojiUrl(c)}" style="height:1.2em;width:1.2em;vertical-align:middle;"/>`;
            else out += escapeHtml(c);
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
            if      (e.type === 'bold')        html += '<b>';
            else if (e.type === 'italic')      html += '<i>';
            else if (e.type === 'underline')   html += '<u>';
            else if (e.type === 'strikethrough') html += '<s>';
            else if (e.type === 'code')        html += '<code>';
            else if (e.type === 'pre')         html += '<pre>';
            else if (e.type === 'spoiler')     html += '<span style="background:rgba(255,255,255,0.15);color:transparent;border-radius:4px;">';
            else if (e.type === 'blockquote' || e.type === 'expandable_blockquote')
                html += '<span style="display:block;border-left:3px solid #64b5f6;padding-left:10px;margin:4px 0;font-style:italic;color:#7f91a4;">';
            else if (['url','text_url','mention','bot_command'].includes(e.type))
                html += '<span style="color:#64b5f6;">';
            else if (e.type === 'custom_emoji') {
                const b64 = await getPremiumEmojiB64(e.custom_emoji_id);
                if (b64) html += `<img src="${b64}" style="height:1.3em;width:1.3em;vertical-align:middle;"/>`;
                cursor = e.offset + e.length;
                while (i + 1 < tags.length && tags[i + 1].info === e) i++;
            }
        } else {
            const e = t.info;
            if      (e.type === 'bold')        html += '</b>';
            else if (e.type === 'italic')      html += '</i>';
            else if (e.type === 'underline')   html += '</u>';
            else if (e.type === 'strikethrough') html += '</s>';
            else if (e.type === 'code')        html += '</code>';
            else if (e.type === 'pre')         html += '</pre>';
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
    const cv = createCanvas(S, S); const ctx = cv.getContext('2d');
    ctx.fillStyle = color; ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `bold ${S * 0.38}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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
    let msgList = Array.isArray(firstName)
        ? firstName
        : [{ firstName, lastName, customemojiid, message, nameColorId,
             inputImageBuffer, replySender, replyMessage, replysendercolor,
             entities: messageEntities, id: '1', isAbsoluteLast: true }];

    const SCALE   = 2.0;
    const PP_SIZE = 38 * SCALE;
    const NAME_FS = 16 * SCALE;
    const MSG_FS  = 16 * SCALE;

    const items = await Promise.all(msgList.map(async d => {
        const name     = `${d.firstName || ''} ${d.lastName || ''}`.trim() || 'User';
        const color    = getTelegramColor(d.nameColorId);
        const nameHtml = nameToHtml(name, color, NAME_FS);

        const rawAvatar = d.inputImageBuffer
            ? await sharp(d.inputImageBuffer).png().toBuffer()
            : await dummyAvatar(d.firstName, d.lastName, color);
        const avatarB64 = `data:image/png;base64,${rawAvatar.toString('base64')}`;

        let mediaB64 = null;
        if (d.mediaBuffer) {
            try {
                const mb = await sharp(d.mediaBuffer).resize(800, 800, { fit: 'inside' }).png().toBuffer();
                mediaB64 = `data:image/png;base64,${mb.toString('base64')}`;
            } catch { mediaB64 = null; }
        }

        const isSticker = !!d.mediaBuffer && (!d.message || !d.message.trim());
        const rColor    = getTelegramColor(d.replysendercolor || 0);
        const rName     = d.replySender ? nameToHtml(d.replySender, rColor, NAME_FS * 0.85) : '';
        const fName     = d.forwardName ? nameToHtml(d.forwardName, '#64b5f6', NAME_FS * 0.75) : '';
        const statusB64 = d.customemojiid ? await getPremiumEmojiB64(d.customemojiid) : null;
        const msgHtml   = await msgToHtml(d.message || '', d.entities || []);

        return { name, color, nameHtml, avatarB64, mediaB64, isSticker,
                 rColor, rName, rMsg: d.replyMessage, statusB64, msgHtml,
                 userId: d.id || name, fName, isAbsoluteLast: d.isAbsoluteLast };
    }));

    const rows = items.map((m, i) => {
        const prev = items[i - 1], next = items[i + 1];
        const samePrev = prev && prev.userId === m.userId && !m.fName;
        const sameNext = next && next.userId === m.userId && !next.fName;
        let groupClass = 'single';
        if      (samePrev && sameNext) groupClass = 'middle';
        else if (samePrev)             groupClass = 'last';
        else if (sameNext)             groupClass = 'first';
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
                            display: 'flex', alignItems: 'flex-end', position: 'relative',
                            width: 'auto', margin: `${2 * SCALE}px 0`,
                            marginTop: (!m.samePrev && items.indexOf(m) > 0) ? 10 * SCALE : 2 * SCALE,
                            gap: 6 * SCALE
                        },
                        children: [
                            {
                                type: 'div',
                                props: {
                                    style: {
                                        width: PP_SIZE, height: PP_SIZE, borderRadius: '50%',
                                        backgroundSize: 'cover', backgroundImage: `url(${m.avatarB64})`,
                                        border: `${1 * SCALE}px solid rgba(255,255,255,0.05)`,
                                        opacity: m.showAvatar ? 1 : 0, flexShrink: 0
                                    }
                                }
                            },
                            {
                                type: 'div',
                                props: {
                                    style: {
                                        position: 'relative', padding: `${10 * SCALE}px ${16 * SCALE}px`,
                                        background: m.isSticker ? 'transparent' : MSG_IN,
                                        color: '#fff', fontSize: MSG_FS, lineHeight: 1.4,
                                        display: 'flex', flexDirection: 'column', width: 'auto',
                                        maxWidth: 450 * SCALE, borderRadius: 18 * SCALE,
                                        borderTopLeftRadius: (m.groupClass === 'middle' || m.groupClass === 'last') ? 5 * SCALE : 18 * SCALE,
                                        borderBottomLeftRadius: (m.groupClass === 'single' || m.groupClass === 'last') ? 0 : 5 * SCALE
                                    },
                                    children: [
                                        isTail && !m.isSticker ? {
                                            type: 'svg',
                                            props: {
                                                width: 8 * SCALE, height: 10 * SCALE,
                                                style: { position: 'absolute', bottom: 0, left: -8 * SCALE + 0.5 },
                                                children: [{ type: 'path', props: { d: `M 8 0 L 8 10 L 0 10 Q 4 10 8 0`, fill: MSG_IN } }]
                                            }
                                        } : null,

                                        m.isSticker ? {
                                            type: 'img',
                                            props: { src: m.mediaB64, style: { width: 200 * SCALE, borderRadius: 8 * SCALE } }
                                        } : {
                                            type: 'div',
                                            props: {
                                                style: { display: 'flex', flexDirection: 'column' },
                                                children: [
                                                    m.fName ? {
                                                        type: 'div',
                                                        props: { style: { fontSize: MSG_FS * 0.75, color: '#64b5f6', marginBottom: 4 * SCALE }, children: `Forwarded from ${m.fName}` }
                                                    } : null,

                                                    m.showName ? {
                                                        type: 'div',
                                                        props: {
                                                            style: { fontSize: NAME_FS, fontWeight: 600, color: m.color, marginBottom: 4 * SCALE, display: 'flex', alignItems: 'center' },
                                                            children: [
                                                                parse(m.nameHtml),
                                                                m.statusB64 ? { type: 'img', props: { src: m.statusB64, style: { width: 18 * SCALE, height: 18 * SCALE, marginLeft: 2 * SCALE } } } : null
                                                            ].filter(Boolean)
                                                        }
                                                    } : null,

                                                    m.rName ? {
                                                        type: 'div',
                                                        props: {
                                                            style: { background: 'rgba(255,255,255,0.06)', borderRadius: 6 * SCALE, padding: `${6 * SCALE}px`, borderLeft: `${4 * SCALE}px solid ${m.rColor}`, marginBottom: 10 * SCALE },
                                                            children: [
                                                                { type: 'div', props: { style: { fontSize: MSG_FS * 0.7, fontWeight: 600, color: m.rColor }, children: parse(m.rName) } },
                                                                { type: 'div', props: { style: { fontSize: MSG_FS * 0.65, color: '#7f91a4' }, children: m.rMsg } }
                                                            ]
                                                        }
                                                    } : null,

                                                    m.mediaB64 ? {
                                                        type: 'img',
                                                        props: { src: m.mediaB64, style: { width: 400 * SCALE, borderRadius: 8 * SCALE, marginBottom: 6 * SCALE } }
                                                    } : null,

                                                    m.msgHtml ? {
                                                        type: 'div',
                                                        props: { style: { display: 'flex', flexDirection: 'column' }, children: [parse(m.msgHtml)] }
                                                    } : null
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
    const t0 = Date.now();
    const svg = await satori(nodes, { width: 1200, height: 1500, fonts });
    console.log(`✅ Satori done in ${Date.now() - t0}ms`);

    const resvg = new Resvg(svg, { background: 'rgba(0,0,0,0)', fitTo: { mode: 'original' } });
    const pngBuffer = resvg.render().asPng();

    return await sharp(pngBuffer)
        .trim({ threshold: 5 })
        .sharpen({ sigma: 0.5 })
        .webp({ quality: 100, lossless: true })
        .toBuffer();
}

module.exports = createImage;

if (require.main === module) {
    const http = require('http');
    http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Satori Engine Running! 🚀\n');
    }).listen(process.env.PORT || 7860);
}
