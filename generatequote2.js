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
// Scans ALL system Noto directories and loads every font file found.
// Order matters: Satori uses the FIRST font that contains the glyph.
// =============================================================================
function loadFonts() {
    const families = [];
    const loaded = new Set(); // prevent duplicate loading

    // ── Directories to scan in priority order ─────────────────────────────────
    // noto-manual first = our wget fonts take priority over apt subset fonts
    const SCAN_DIRS = [
        '/usr/share/fonts/truetype/noto-manual',   // our manually downloaded full stack
        '/usr/share/fonts/truetype/noto',           // apt: fonts-noto base
        '/usr/share/fonts/truetype/noto-extra',     // apt: fonts-noto-extra (some systems)
        '/usr/share/fonts/opentype/noto',           // apt: fonts-noto-cjk (opentype format)
        '/usr/share/fonts/truetype/noto-cjk',
        '/usr/share/fonts/opentype/noto-cjk',
        '/usr/share/fonts/noto',
        '/usr/share/fonts/noto-cjk',
        '/usr/share/fonts/truetype',                // catch-all for any other system fonts
        '/usr/local/share/fonts',
        // Windows paths for local development
        'C:\\Windows\\Fonts',
    ];

    // ── Font family name mapping ──────────────────────────────────────────────
    // Maps filename patterns to clean family names that Satori groups together.
    // MORE SPECIFIC patterns must come BEFORE less specific ones.
    const NAME_MAP = [
        // CJK variants
        { r: /NotoSansCJKsc/i,                   n: 'Noto Sans CJK SC' },
        { r: /NotoSansCJKtc/i,                   n: 'Noto Sans CJK TC' },
        { r: /NotoSansCJKjp/i,                   n: 'Noto Sans CJK JP' },
        { r: /NotoSansCJKkr/i,                   n: 'Noto Sans CJK KR' },
        { r: /NotoSansCJK/i,                     n: 'Noto Sans CJK' },
        { r: /NotoSerifCJK/i,                    n: 'Noto Serif CJK' },
        // Emoji
        { r: /NotoColorEmoji/i,                  n: 'Noto Color Emoji' },
        // Symbols - must come before generic NotoSans
        { r: /NotoSansSymbols2/i,                n: 'Noto Sans Symbols2' },
        { r: /NotoSansSymbols/i,                 n: 'Noto Sans Symbols' },
        { r: /NotoSansMath/i,                    n: 'Noto Sans Math' },
        { r: /NotoMusic/i,                       n: 'Noto Music' },
        // Script-specific faces
        { r: /NotoSansAdlam/i,                   n: 'Noto Sans Adlam' },
        { r: /NotoSansAhom/i,                    n: 'Noto Sans Ahom' },
        { r: /NotoSansAnatolianHieroglyphs/i,    n: 'Noto Sans Anatolian Hieroglyphs' },
        { r: /NotoSansArabic/i,                  n: 'Noto Sans Arabic' },
        { r: /NotoSansArmenian/i,                n: 'Noto Sans Armenian' },
        { r: /NotoSansAvestan/i,                 n: 'Noto Sans Avestan' },
        { r: /NotoSansBalinese/i,                n: 'Noto Sans Balinese' },
        { r: /NotoSansBamum/i,                   n: 'Noto Sans Bamum' },
        { r: /NotoSansBassaVah/i,                n: 'Noto Sans Bassa Vah' },
        { r: /NotoSansBatak/i,                   n: 'Noto Sans Batak' },
        { r: /NotoSansBengali/i,                 n: 'Noto Sans Bengali' },
        { r: /NotoSansBhaiksuki/i,               n: 'Noto Sans Bhaiksuki' },
        { r: /NotoSansBrahmi/i,                  n: 'Noto Sans Brahmi' },
        { r: /NotoSansBuginese/i,                n: 'Noto Sans Buginese' },
        { r: /NotoSansBuhid/i,                   n: 'Noto Sans Buhid' },
        { r: /NotoSansCanadianAboriginal/i,      n: 'Noto Sans Canadian Aboriginal' },
        { r: /NotoSansCarian/i,                  n: 'Noto Sans Carian' },
        { r: /NotoSansCaucasianAlbanian/i,       n: 'Noto Sans Caucasian Albanian' },
        { r: /NotoSansChakma/i,                  n: 'Noto Sans Chakma' },
        { r: /NotoSansCham/i,                    n: 'Noto Sans Cham' },
        { r: /NotoSansCoptic/i,                  n: 'Noto Sans Coptic' },
        { r: /NotoSansCuneiform/i,               n: 'Noto Sans Cuneiform' },
        { r: /NotoSansCypriot/i,                 n: 'Noto Sans Cypriot' },
        { r: /NotoSansDeseret/i,                 n: 'Noto Sans Deseret' },
        { r: /NotoSansDevanagari/i,              n: 'Noto Sans Devanagari' },
        { r: /NotoSansDuployan/i,                n: 'Noto Sans Duployan' },
        { r: /NotoSansEgyptianHieroglyphs/i,     n: 'Noto Sans Egyptian Hieroglyphs' },
        { r: /NotoSansElbasan/i,                 n: 'Noto Sans Elbasan' },
        { r: /NotoSansElymaic/i,                 n: 'Noto Sans Elymaic' },
        { r: /NotoSansEthiopic/i,                n: 'Noto Sans Ethiopic' },
        { r: /NotoSansGeorgian/i,                n: 'Noto Sans Georgian' },
        { r: /NotoSansGlagolitic/i,              n: 'Noto Sans Glagolitic' },
        { r: /NotoSansGothic/i,                  n: 'Noto Sans Gothic' },
        { r: /NotoSansGrantha/i,                 n: 'Noto Sans Grantha' },
        { r: /NotoSansGujarati/i,                n: 'Noto Sans Gujarati' },
        { r: /NotoSansGunjalaGondi/i,            n: 'Noto Sans Gunjala Gondi' },
        { r: /NotoSansGurmukhi/i,                n: 'Noto Sans Gurmukhi' },
        { r: /NotoSansHanifiRohingya/i,          n: 'Noto Sans Hanifi Rohingya' },
        { r: /NotoSansHanunoo/i,                 n: 'Noto Sans Hanunoo' },
        { r: /NotoSansHatran/i,                  n: 'Noto Sans Hatran' },
        { r: /NotoSansHebrew/i,                  n: 'Noto Sans Hebrew' },
        { r: /NotoSansImperialAramaic/i,         n: 'Noto Sans Imperial Aramaic' },
        { r: /NotoSansIndicSiyaqNumbers/i,       n: 'Noto Sans Indic Siyaq Numbers' },
        { r: /NotoSansInscriptionalPahlavi/i,    n: 'Noto Sans Inscriptional Pahlavi' },
        { r: /NotoSansInscriptionalParthian/i,   n: 'Noto Sans Inscriptional Parthian' },
        { r: /NotoSansJavanese/i,                n: 'Noto Sans Javanese' },
        { r: /NotoSansKaithi/i,                  n: 'Noto Sans Kaithi' },
        { r: /NotoSansKannada/i,                 n: 'Noto Sans Kannada' },
        { r: /NotoSansKayahLi/i,                 n: 'Noto Sans Kayah Li' },
        { r: /NotoSansKharoshthi/i,              n: 'Noto Sans Kharoshthi' },
        { r: /NotoSansKhmer/i,                   n: 'Noto Sans Khmer' },
        { r: /NotoSansKhojki/i,                  n: 'Noto Sans Khojki' },
        { r: /NotoSansKhudawadi/i,               n: 'Noto Sans Khudawadi' },
        { r: /NotoSansLao/i,                     n: 'Noto Sans Lao' },
        { r: /NotoSansLepcha/i,                  n: 'Noto Sans Lepcha' },
        { r: /NotoSansLimbu/i,                   n: 'Noto Sans Limbu' },
        { r: /NotoSansLinearA/i,                 n: 'Noto Sans Linear A' },
        { r: /NotoSansLinearB/i,                 n: 'Noto Sans Linear B' },
        { r: /NotoSansLisu/i,                    n: 'Noto Sans Lisu' },
        { r: /NotoSansLycian/i,                  n: 'Noto Sans Lycian' },
        { r: /NotoSansLydian/i,                  n: 'Noto Sans Lydian' },
        { r: /NotoSansMahajani/i,                n: 'Noto Sans Mahajani' },
        { r: /NotoSansMalayalam/i,               n: 'Noto Sans Malayalam' },
        { r: /NotoSansMandaic/i,                 n: 'Noto Sans Mandaic' },
        { r: /NotoSansManichaean/i,              n: 'Noto Sans Manichaean' },
        { r: /NotoSansMarchen/i,                 n: 'Noto Sans Marchen' },
        { r: /NotoSansMasaramGondi/i,            n: 'Noto Sans Masaram Gondi' },
        { r: /NotoSansMayaNumerals/i,            n: 'Noto Sans Maya Numerals' },
        { r: /NotoSansMeeteiMayek/i,             n: 'Noto Sans Meetei Mayek' },
        { r: /NotoSansMendeKikakui/i,            n: 'Noto Sans Mende Kikakui' },
        { r: /NotoSansMeroitic/i,                n: 'Noto Sans Meroitic' },
        { r: /NotoSansMiao/i,                    n: 'Noto Sans Miao' },
        { r: /NotoSansModi/i,                    n: 'Noto Sans Modi' },
        { r: /NotoSansMongolian/i,               n: 'Noto Sans Mongolian' },
        { r: /NotoSansMro/i,                     n: 'Noto Sans Mro' },
        { r: /NotoSansMultani/i,                 n: 'Noto Sans Multani' },
        { r: /NotoSansMyanmar/i,                 n: 'Noto Sans Myanmar' },
        { r: /NotoSansNabataean/i,               n: 'Noto Sans Nabataean' },
        { r: /NotoSansNewTaiLue/i,               n: 'Noto Sans New Tai Lue' },
        { r: /NotoSansNewa/i,                    n: 'Noto Sans Newa' },
        { r: /NotoSansNKo/i,                     n: 'Noto Sans NKo' },
        { r: /NotoSansOgham/i,                   n: 'Noto Sans Ogham' },
        { r: /NotoSansOlChiki/i,                 n: 'Noto Sans Ol Chiki' },
        { r: /NotoSansOldHungarian/i,            n: 'Noto Sans Old Hungarian' },
        { r: /NotoSansOldItalic/i,               n: 'Noto Sans Old Italic' },
        { r: /NotoSansOldNorthArabian/i,         n: 'Noto Sans Old North Arabian' },
        { r: /NotoSansOldPermic/i,               n: 'Noto Sans Old Permic' },
        { r: /NotoSansOldPersian/i,              n: 'Noto Sans Old Persian' },
        { r: /NotoSansOldSogdian/i,              n: 'Noto Sans Old Sogdian' },
        { r: /NotoSansOldSouthArabian/i,         n: 'Noto Sans Old South Arabian' },
        { r: /NotoSansOldTurkic/i,               n: 'Noto Sans Old Turkic' },
        { r: /NotoSansOldUyghur/i,               n: 'Noto Sans Old Uyghur' },
        { r: /NotoSansOriya/i,                   n: 'Noto Sans Oriya' },
        { r: /NotoSansOsage/i,                   n: 'Noto Sans Osage' },
        { r: /NotoSansOsmanya/i,                 n: 'Noto Sans Osmanya' },
        { r: /NotoSansPahawhHmong/i,             n: 'Noto Sans Pahawh Hmong' },
        { r: /NotoSansPalmyrene/i,               n: 'Noto Sans Palmyrene' },
        { r: /NotoSansPauCinHau/i,               n: 'Noto Sans Pau Cin Hau' },
        { r: /NotoSansPhagsPa/i,                 n: 'Noto Sans Phags Pa' },
        { r: /NotoSansPhoenician/i,              n: 'Noto Sans Phoenician' },
        { r: /NotoSansPsalterPahlavi/i,          n: 'Noto Sans Psalter Pahlavi' },
        { r: /NotoSansRejang/i,                  n: 'Noto Sans Rejang' },
        { r: /NotoSansRunic/i,                   n: 'Noto Sans Runic' },
        { r: /NotoSansSamaritan/i,               n: 'Noto Sans Samaritan' },
        { r: /NotoSansSaurashtra/i,              n: 'Noto Sans Saurashtra' },
        { r: /NotoSansSharada/i,                 n: 'Noto Sans Sharada' },
        { r: /NotoSansShavian/i,                 n: 'Noto Sans Shavian' },
        { r: /NotoSansSiddham/i,                 n: 'Noto Sans Siddham' },
        { r: /NotoSansSignWriting/i,             n: 'Noto Sans SignWriting' },
        { r: /NotoSansSinhala/i,                 n: 'Noto Sans Sinhala' },
        { r: /NotoSansSogdian/i,                 n: 'Noto Sans Sogdian' },
        { r: /NotoSansSoraSompeng/i,             n: 'Noto Sans Sora Sompeng' },
        { r: /NotoSansSoyombo/i,                 n: 'Noto Sans Soyombo' },
        { r: /NotoSansSundanese/i,               n: 'Noto Sans Sundanese' },
        { r: /NotoSansSylotiNagri/i,             n: 'Noto Sans Syloti Nagri' },
        { r: /NotoSansSyriac/i,                  n: 'Noto Sans Syriac' },
        { r: /NotoSansTagalog/i,                 n: 'Noto Sans Tagalog' },
        { r: /NotoSansTagbanwa/i,                n: 'Noto Sans Tagbanwa' },
        { r: /NotoSansTaiLe/i,                   n: 'Noto Sans Tai Le' },
        { r: /NotoSansTaiTham/i,                 n: 'Noto Sans Tai Tham' },
        { r: /NotoSansTaiViet/i,                 n: 'Noto Sans Tai Viet' },
        { r: /NotoSansTakri/i,                   n: 'Noto Sans Takri' },
        { r: /NotoSansTamil/i,                   n: 'Noto Sans Tamil' },
        { r: /NotoSansTamilSupplement/i,         n: 'Noto Sans Tamil Supplement' },
        { r: /NotoSansTelugu/i,                  n: 'Noto Sans Telugu' },
        { r: /NotoSansThaana/i,                  n: 'Noto Sans Thaana' },
        { r: /NotoSansThai/i,                    n: 'Noto Sans Thai' },
        { r: /NotoSansTifinagh/i,                n: 'Noto Sans Tifinagh' },
        { r: /NotoSansTirhuta/i,                 n: 'Noto Sans Tirhuta' },
        { r: /NotoSansUgaritic/i,                n: 'Noto Sans Ugaritic' },
        { r: /NotoSansVai/i,                     n: 'Noto Sans Vai' },
        { r: /NotoSansWancho/i,                  n: 'Noto Sans Wancho' },
        { r: /NotoSansWarangCiti/i,              n: 'Noto Sans Warang Citi' },
        { r: /NotoSansYi/i,                      n: 'Noto Sans Yi' },
        { r: /NotoSansZanabazarSquare/i,         n: 'Noto Sans Zanabazar Square' },
        { r: /NotoSerifTangut/i,                 n: 'Noto Serif Tangut' },
        { r: /NotoSerifTibetan/i,                n: 'Noto Serif Tibetan' },
        { r: /NotoTraditionalNushu/i,            n: 'Noto Traditional Nushu' },
        // Generic Noto Sans/Serif - must be LAST in Noto block
        { r: /NotoSans(?!CJK|Symbols|Math)/i,   n: 'Noto Sans' },
        { r: /NotoSerif(?!CJK|Tangut|Tibetan)/i,n: 'Noto Serif' },
        // Windows/system fonts
        { r: /seguisym/i,                        n: 'Segoe UI Symbol' },
        { r: /seguiemj/i,                        n: 'Segoe UI Emoji' },
        { r: /seguisl/i,                         n: 'Segoe UI' },
        { r: /arial/i,                           n: 'Arial' },
    ];

    // ── Helper: detect font weight from filename ──────────────────────────────
    function guessWeight(filename) {
        if (/Black/i.test(filename))                    return 900;
        if (/ExtraBold|Extra[-_]Bold|Heavy/i.test(filename)) return 800;
        if (/Bold/i.test(filename))                     return 700;
        if (/SemiBold|Semi[-_]Bold|DemiBold/i.test(filename)) return 600;
        if (/Medium/i.test(filename))                   return 500;
        if (/Light/i.test(filename))                    return 300;
        if (/ExtraLight|Extra[-_]Light|Thin/i.test(filename)) return 100;
        return 400;
    }

    // ── Helper: detect font style from filename ───────────────────────────────
    function guessStyle(filename) {
        return /Italic|Oblique/i.test(filename) ? 'italic' : 'normal';
    }

    // ── Helper: map filename to clean family name ─────────────────────────────
    function deriveName(filename) {
        for (const rule of NAME_MAP) {
            if (rule.r.test(filename)) return rule.n;
        }
        // Fallback: clean up the filename stem
        return path.basename(filename, path.extname(filename))
            .replace(/[-_](Regular|Bold|Italic|Light|Medium|Thin|Black|SemiBold|ExtraBold|Heavy)/gi, '')
            .replace(/[-_]/g, ' ')
            .trim() || 'Unknown';
    }

    // ── Scan all directories ──────────────────────────────────────────────────
    for (const dir of SCAN_DIRS) {
        if (!fs.existsSync(dir)) continue;

        let files;
        try {
            files = fs.readdirSync(dir);
        } catch (e) {
            console.warn(`⚠️  Cannot read dir: ${dir} — ${e.message}`);
            continue;
        }

        for (const file of files) {
            if (!/\.(ttf|otf)$/i.test(file)) continue;

            const fullPath = path.join(dir, file);
            if (loaded.has(fullPath)) continue;
            loaded.add(fullPath);

            let data;
            try {
                data = fs.readFileSync(fullPath);
            } catch (e) {
                console.warn(`⚠️  Cannot read font: ${fullPath} — ${e.message}`);
                continue;
            }

            const name   = deriveName(file);
            const weight = guessWeight(file);
            const style  = guessStyle(file);

            families.push({ name, data, weight, style });

            // Register with node-canvas too so renderChunkImg gets the same fonts
            try { registerFont(fullPath, { family: name }); } catch (_) {}

            console.log(`✅ Font: [${name}] w${weight} ${style} ← ${file}`);
        }
    }

    // ── Sort by priority ──────────────────────────────────────────────────────
    // Satori checks fonts in array order for each glyph.
    // Latin base first (fastest hit), CJK last (largest file, slowest to search).
    const PRIORITY = [
        'Noto Sans', 'Noto Serif',
        'Noto Sans Symbols', 'Noto Sans Symbols2', 'Noto Sans Math', 'Noto Music',
        'Noto Sans Arabic', 'Noto Sans Devanagari', 'Noto Sans Bengali',
        'Noto Sans Tamil', 'Noto Sans Telugu', 'Noto Sans Kannada',
        'Noto Sans Malayalam', 'Noto Sans Gujarati', 'Noto Sans Gurmukhi',
        'Noto Sans Oriya', 'Noto Sans Sinhala',
        'Noto Sans Thai', 'Noto Sans Lao', 'Noto Sans Khmer', 'Noto Sans Myanmar',
        'Noto Sans Tai Le', 'Noto Sans Tai Tham', 'Noto Sans Tai Viet',
        'Noto Sans New Tai Lue',
        'Noto Sans Hebrew', 'Noto Sans Syriac', 'Noto Sans Thaana',
        'Noto Sans Mandaic', 'Noto Sans Samaritan',
        'Noto Sans Arabic', 'Noto Sans Imperial Aramaic', 'Noto Sans Nabataean',
        'Noto Sans Georgian', 'Noto Sans Armenian', 'Noto Sans Ethiopic',
        'Noto Sans Mongolian', 'Noto Sans Tibetan', 'Noto Serif Tibetan',
        'Noto Sans Runic', 'Noto Sans Ogham', 'Noto Sans Glagolitic',
        'Noto Sans Gothic', 'Noto Sans Old Italic', 'Noto Sans Old Persian',
        'Noto Sans Old Turkic', 'Noto Sans Phoenician', 'Noto Sans Ugaritic',
        'Noto Sans Cuneiform', 'Noto Sans Egyptian Hieroglyphs',
        'Noto Sans Linear A', 'Noto Sans Linear B',
        'Noto Sans Duployan', 'Noto Sans SignWriting',
        'Noto Sans Canadian Aboriginal', 'Noto Sans Cherokee',
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
        'Noto Sans Pahawh Hmong', 'Noto Sans Mende Kikakui',
        'Noto Sans Masaram Gondi', 'Noto Sans Gunjala Gondi',
        'Noto Sans Soyombo', 'Noto Sans Zanabazar Square',
        'Noto Sans Marchen', 'Noto Sans Newa', 'Noto Sans Wancho',
        'Noto Traditional Nushu', 'Noto Serif Tangut',
        'Noto Sans Hanifi Rohingya',
        // CJK last - large files
        'Noto Sans CJK', 'Noto Sans CJK SC', 'Noto Sans CJK TC',
        'Noto Sans CJK JP', 'Noto Sans CJK KR', 'Noto Serif CJK',
        // Color emoji very last
        'Noto Color Emoji',
        // Windows fallbacks
        'Segoe UI Symbol', 'Segoe UI Emoji', 'Arial',
    ];

    families.sort((a, b) => {
        const ai = PRIORITY.indexOf(a.name);
        const bi = PRIORITY.indexOf(b.name);
        const an = ai === -1 ? 9999 : ai;
        const bn = bi === -1 ? 9999 : bi;
        return an - bn;
    });

    console.log(`\n📦 Font pipeline ready: ${families.length} font faces loaded`);
    console.log(`📋 Unique families: ${[...new Set(families.map(f => f.name))].join(', ')}\n`);

    if (families.length === 0) {
        console.error('❌ CRITICAL: No fonts loaded! Every character will render as tofu.');
    }

    return families;
}

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
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;")
        : '';
}

// =============================================================================
// NAME RENDERING
// Splits name text into chunks, renders each chunk to a tiny canvas PNG,
// and embeds it as a base64 <img> so that node-canvas (which uses system
// fonts and therefore has full Unicode) does the actual glyph rendering.
// This completely bypasses Satori's font lookup for name text.
// =============================================================================
function renderChunkImg(text, fontSize, color) {
    const tmp = createCanvas(1, 1);
    const tc = tmp.getContext('2d');
    // Use ALL loaded font families in the font stack for canvas too
    const fontFamilyStack = 'Noto Sans, Noto Sans Symbols2, Noto Sans Symbols, ' +
        'Noto Sans CJK, Noto Sans Arabic, Noto Sans Devanagari, ' +
        'Noto Sans Math, Noto Music, sans-serif';
    tc.font = `600 ${fontSize}px ${fontFamilyStack}`;
    const w = Math.max(1, Math.ceil(tc.measureText(text).width));
    const h = Math.max(1, Math.ceil(fontSize * 1.5));
    const cv = createCanvas(w, h);
    const ctx = cv.getContext('2d');
    ctx.font = `600 ${fontSize}px ${fontFamilyStack}`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, h / 2);
    return `data:image/png;base64,${cv.toBuffer('image/png').toString('base64')}`;
}

function nameToHtml(text, color, fontSize) {
    if (!text) return '';
    const seg = new Intl.Segmenter();
    let res = '';
    let chunk = '';

    const flushChunk = () => {
        if (!chunk) return;
        res += `<img src="${renderChunkImg(chunk, fontSize, color)}" style="height:1em;vertical-align:middle;margin:0;padding:0;display:inline-flex;"/>`;
        chunk = '';
    };

    for (const { segment: c } of seg.segment(text)) {
        if (IS_EMOJI.test(c)) {
            flushChunk();
            res += `<img src="${toAppleEmojiUrl(c)}" style="height:1.2em;width:1.2em;vertical-align:middle;"/>`;
        } else {
            chunk += c;
        }
    }
    flushChunk();
    return res;
}

// =============================================================================
// EMOJI UTILITIES
// =============================================================================
function toAppleEmojiUrl(emoji) {
    const r = [];
    let c = 0, p = 0;
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
// PREMIUM EMOJI (custom emoji / stickers in names)
// =============================================================================
const ECACHE = new Map();

async function getPremiumEmojiB64(id) {
    if (ECACHE.has(id)) return ECACHE.get(id);
    console.log(`🔍 Fetching premium emoji: ${id}`);
    try {
        const { data: d1 } = await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/getCustomEmojiStickers`,
            { custom_emoji_ids: [id] },
            { timeout: 5000 }
        );
        const st = d1.result?.[0];
        if (!st) return null;
        const { data: d2 } = await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/getFile`,
            { file_id: st.thumbnail?.file_id || st.file_id },
            { timeout: 5000 }
        );
        const { data: raw } = await axios.get(
            `https://api.telegram.org/file/bot${BOT_TOKEN}/${d2.result.file_path}`,
            { responseType: 'arraybuffer', timeout: 5000 }
        );
        const b64 = `data:image/png;base64,${(await sharp(raw).resize(128, 128).png().toBuffer()).toString('base64')}`;
        ECACHE.set(id, b64);
        return b64;
    } catch (e) {
        console.error(`❌ Premium emoji fetch failed: ${id}`, e.message);
        return null;
    }
}

// =============================================================================
// MESSAGE HTML BUILDER
// =============================================================================
async function msgToHtml(text, entities = []) {
    console.log(`📝 Processing message to HTML (text length: ${text?.length})`);
    if (!text) return '';

    text = text.replace(/ (https?:\/\/|t\.me\/|Telegram\.me\/|@\w+)/gi, "\n$1");

    const sorted = (entities || []).sort((a, b) => a.offset - b.offset || b.length - a.length);
    let tags = [];
    for (const e of sorted) {
        tags.push({ pos: e.offset, type: 'open',  info: e });
        tags.push({ pos: e.offset + e.length, type: 'close', info: e });
    }
    tags.sort((a, b) => a.pos - b.pos || (a.type === 'close' ? -1 : 1));

    let html = '', cursor = 0;
    const seg = new Intl.Segmenter();

    const applyText = (str) => {
        if (!str) return '';
        let out = '';
        for (const { segment: c } of seg.segment(str)) {
            if (IS_EMOJI.test(c)) {
                out += `<img src="${toAppleEmojiUrl(c)}" style="height:1.2em;width:1.2em;vertical-align:middle;"/>`;
            } else {
                out += escapeHtml(c);
            }
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

            if      (e.type === 'bold')        html += '<b>';
            else if (e.type === 'italic')      html += '<i>';
            else if (e.type === 'underline')   html += '<u>';
            else if (e.type === 'strikethrough') html += '<s>';
            else if (e.type === 'code')        html += '<code>';
            else if (e.type === 'pre')         html += '<pre>';
            else if (e.type === 'spoiler')     html += '<span style="background:rgba(255,255,255,0.15);color:transparent;border-radius:4px;">';
            else if (e.type === 'blockquote' || e.type === 'expandable_blockquote')
                html += '<span style="display:block;border-left:3px solid #64b5f6;padding-left:10px;margin:4px 0;font-style:italic;color:#7f91a4;">';
            else if (e.type === 'url' || e.type === 'text_url' || e.type === 'mention' || e.type === 'bot_command')
                html += '<span style="color:#64b5f6;">';
            else if (e.type === 'custom_emoji') {
                const b64 = await getPremiumEmojiB64(e.custom_emoji_id);
                if (b64) html += `<img src="${b64}" style="height:1.3em;width:1.3em;vertical-align:middle;"/>`;
                cursor = e.offset + e.length;
                while (i + 1 < tags.length && tags[i + 1].info === e) { i++; }
            }
        } else {
            const e = t.info;
            if      (e.type === 'bold')        html += '</b>';
            else if (e.type === 'italic')      html += '</i>';
            else if (e.type === 'underline')   html += '</u>';
            else if (e.type === 'strikethrough') html += '</s>';
            else if (e.type === 'code')        html += '</code>';
            else if (e.type === 'pre')         html += '</pre>';
            else if (e.type === 'spoiler' || e.type === 'blockquote' ||
                     e.type === 'expandable_blockquote' || e.type === 'url' ||
                     e.type === 'text_url' || e.type === 'mention' || e.type === 'bot_command')
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
    const cv = createCanvas(S, S);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${S * 0.38}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
        ((f?.[0] || '') + (l?.[0] || '')).toUpperCase().substring(0, 2) || '?',
        S / 2, S / 2
    );
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
    // Normalize input to array format
    let msgList = Array.isArray(firstName)
        ? firstName
        : [{
            firstName, lastName, customemojiid, message, nameColorId,
            inputImageBuffer, replySender, replyMessage, replysendercolor,
            entities: messageEntities, id: '1', isAbsoluteLast: true
        }];

    const SCALE    = 2.0;
    const PP_SIZE  = 38 * SCALE;
    const NAME_FS  = 16 * SCALE;
    const MSG_FS   = 16 * SCALE;

    // ── Pre-process each message ──────────────────────────────────────────────
    const items = await Promise.all(msgList.map(async d => {
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
                    .resize(800, 800, { fit: 'inside' })
                    .png()
                    .toBuffer();
                mediaB64 = `data:image/png;base64,${mb.toString('base64')}`;
            } catch { mediaB64 = null; }
        }

        const isSticker = !!d.mediaBuffer && (!d.message || !d.message.trim());
        const rColor   = getTelegramColor(d.replysendercolor || 0);
        const rName    = d.replySender ? nameToHtml(d.replySender, rColor, NAME_FS * 0.85) : '';
        const fName    = d.forwardName ? nameToHtml(d.forwardName, '#64b5f6', NAME_FS * 0.75) : '';
        const statusB64 = d.customemojiid ? await getPremiumEmojiB64(d.customemojiid) : null;
        const msgHtml  = await msgToHtml(d.message || '', d.entities || []);

        return {
            name, color, nameHtml, avatarB64, mediaB64, isSticker,
            rColor, rName, rMsg: d.replyMessage, statusB64, msgHtml,
            userId: d.id || name, fName, isAbsoluteLast: d.isAbsoluteLast
        };
    }));

    // ── Compute grouping (consecutive messages from same user) ────────────────
    const rows = items.map((m, i) => {
        const prev = items[i - 1];
        const next = items[i + 1];
        const samePrev = prev && prev.userId === m.userId && !m.fName;
        const sameNext = next && next.userId === m.userId && !next.fName;
        let groupClass = 'single';
        if      (samePrev && sameNext) groupClass = 'middle';
        else if (samePrev)             groupClass = 'last';
        else if (sameNext)             groupClass = 'first';
        return { ...m, groupClass, showName: !samePrev && !m.isSticker, showAvatar: !sameNext, samePrev };
    });

    const MSG_IN = '#111112';

    // ── Build Satori node tree ────────────────────────────────────────────────
    const nodes = {
        type: 'div',
        props: {
            style: {
                display: 'flex',
                flexDirection: 'column',
                padding: 40 * SCALE,
                background: 'transparent'
            },
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
                            marginTop: (!m.samePrev && items.indexOf(m) > 0)
                                ? 10 * SCALE : 2 * SCALE,
                            gap: 6 * SCALE
                        },
                        children: [
                            // Avatar
                            {
                                type: 'div',
                                props: {
                                    style: {
                                        width: PP_SIZE,
                                        height: PP_SIZE,
                                        borderRadius: '50%',
                                        backgroundSize: 'cover',
                                        backgroundImage: `url(${m.avatarB64})`,
                                        border: `${1 * SCALE}px solid rgba(255,255,255,0.05)`,
                                        opacity: m.showAvatar ? 1 : 0,
                                        flexShrink: 0
                                    }
                                }
                            },
                            // Message bubble
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
                                        borderTopLeftRadius: (m.groupClass === 'middle' || m.groupClass === 'last')
                                            ? 5 * SCALE : 18 * SCALE,
                                        borderBottomLeftRadius: (m.groupClass === 'single' || m.groupClass === 'last')
                                            ? 0 : 5 * SCALE
                                    },
                                    children: [
                                        // Bubble tail
                                        isTail && !m.isSticker ? {
                                            type: 'svg',
                                            props: {
                                                width: 8 * SCALE,
                                                height: 10 * SCALE,
                                                style: { position: 'absolute', bottom: 0, left: -8 * SCALE + 0.5 },
                                                children: [{
                                                    type: 'path',
                                                    props: {
                                                        d: `M 8 0 L 8 10 L 0 10 Q 4 10 8 0`,
                                                        fill: MSG_IN
                                                    }
                                                }]
                                            }
                                        } : null,

                                        // Content
                                        m.isSticker ? {
                                            type: 'img',
                                            props: {
                                                src: m.mediaB64,
                                                style: { width: 200 * SCALE, borderRadius: 8 * SCALE }
                                            }
                                        } : {
                                            type: 'div',
                                            props: {
                                                style: { display: 'flex', flexDirection: 'column' },
                                                children: [
                                                    // Forward header
                                                    m.fName ? {
                                                        type: 'div',
                                                        props: {
                                                            style: { fontSize: MSG_FS * 0.75, color: '#64b5f6', marginBottom: 4 * SCALE },
                                                            children: `Forwarded from ${m.fName}`
                                                        }
                                                    } : null,

                                                    // Name row
                                                    m.showName ? {
                                                        type: 'div',
                                                        props: {
                                                            style: {
                                                                fontSize: NAME_FS,
                                                                fontWeight: 600,
                                                                color: m.color,
                                                                marginBottom: 4 * SCALE,
                                                                display: 'flex',
                                                                alignItems: 'center'
                                                            },
                                                            children: [
                                                                parse(m.nameHtml),
                                                                m.statusB64 ? {
                                                                    type: 'img',
                                                                    props: {
                                                                        src: m.statusB64,
                                                                        style: { width: 18 * SCALE, height: 18 * SCALE, marginLeft: 2 * SCALE }
                                                                    }
                                                                } : null
                                                            ].filter(Boolean)
                                                        }
                                                    } : null,

                                                    // Reply block
                                                    m.rName ? {
                                                        type: 'div',
                                                        props: {
                                                            style: {
                                                                background: 'rgba(255,255,255,0.06)',
                                                                borderRadius: 6 * SCALE,
                                                                padding: `${6 * SCALE}px`,
                                                                borderLeft: `${4 * SCALE}px solid ${m.rColor}`,
                                                                marginBottom: 10 * SCALE
                                                            },
                                                            children: [
                                                                {
                                                                    type: 'div',
                                                                    props: {
                                                                        style: { fontSize: MSG_FS * 0.7, fontWeight: 600, color: m.rColor },
                                                                        children: parse(m.rName)
                                                                    }
                                                                },
                                                                {
                                                                    type: 'div',
                                                                    props: {
                                                                        style: { fontSize: MSG_FS * 0.65, color: '#7f91a4' },
                                                                        children: m.rMsg
                                                                    }
                                                                }
                                                            ]
                                                        }
                                                    } : null,

                                                    // Media image
                                                    m.mediaB64 ? {
                                                        type: 'img',
                                                        props: {
                                                            src: m.mediaB64,
                                                            style: { width: 400 * SCALE, borderRadius: 8 * SCALE, marginBottom: 6 * SCALE }
                                                        }
                                                    } : null,

                                                    // Message text
                                                    m.msgHtml ? {
                                                        type: 'div',
                                                        props: {
                                                            style: { display: 'flex', flexDirection: 'column' },
                                                            children: [parse(m.msgHtml)]
                                                        }
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

    // ── Render ────────────────────────────────────────────────────────────────
    console.log('🎨 Starting Satori render...');
    const startTime = Date.now();

    const svg = await satori(nodes, {
        width: 1200,
        height: 1500,
        fonts: fonts.length > 0 ? fonts : []
    });

    console.log(`✅ Satori render complete in ${Date.now() - startTime}ms`);

    const resvg = new Resvg(svg, {
        background: 'rgba(0,0,0,0)',
        fitTo: { mode: 'original' }
    });
    const pngBuffer = resvg.render().asPng();

    return await sharp(pngBuffer)
        .trim({ threshold: 5 })
        .sharpen({ sigma: 0.5 })
        .webp({ quality: 100, lossless: true })
        .toBuffer();
}

module.exports = createImage;

// ── Dev server ────────────────────────────────────────────────────────────────
if (require.main === module) {
    const http = require('http');
    http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Satori Engine Running! 🚀\n');
    }).listen(process.env.PORT || 7860);
}
