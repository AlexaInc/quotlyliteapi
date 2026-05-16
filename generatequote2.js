require('dotenv').config();

const puppeteer = require('puppeteer');
const { createCanvas, registerFont } = require('canvas');
const fs    = require('fs');
const path  = require('path');
const sharp = require('sharp');
const axios = require('axios');

// =============================================================================
// FONT REGISTRATION
// Scans every system font directory and registers all .ttf/.otf files
// with node-canvas. Canvas uses Pango/FreeType which natively supports ALL
// Unicode scripts, so registered names render perfectly with no tofu.
// =============================================================================
const SCAN_DIRS = [
    '/usr/share/fonts/truetype/noto-manual',
    '/usr/share/fonts/truetype/noto',
    '/usr/share/fonts/truetype/noto-cjk',
    '/usr/share/fonts/truetype/noto-extra',
    '/usr/share/fonts/opentype/noto',
    '/usr/share/fonts/opentype/noto-cjk',
    '/usr/share/fonts/truetype/dejavu',
    '/usr/share/fonts/truetype/liberation',
    '/usr/share/fonts/truetype/liberation2',
    '/usr/share/fonts/truetype/freefont',
    '/usr/share/fonts/opentype/freefont',
    '/usr/share/fonts/truetype/ancient-scripts',
    '/usr/share/fonts/truetype/unifont',
    '/usr/share/fonts/truetype/abyssinica',
    '/usr/share/fonts/truetype/symbola',
    '/usr/share/fonts/truetype/sil',
    '/usr/share/fonts/truetype/lohit-deva',
    '/usr/share/fonts/truetype/lohit-bengali',
    '/usr/share/fonts/truetype/lohit-gujarati',
    '/usr/share/fonts/truetype/lohit-kannada',
    '/usr/share/fonts/truetype/lohit-malayalam',
    '/usr/share/fonts/truetype/lohit-oriya',
    '/usr/share/fonts/truetype/lohit-punjabi',
    '/usr/share/fonts/truetype/lohit-tamil',
    '/usr/share/fonts/truetype/lohit-telugu',
    '/usr/share/fonts/truetype/samyak',
    '/usr/share/fonts/truetype/samyak-fonts',
    '/usr/share/fonts/truetype/sarai',
    '/usr/share/fonts/truetype/smc',
    '/usr/share/fonts/truetype/yrsa-rasa',
    '/usr/share/fonts/truetype/tibetan-machine',
    '/usr/share/fonts/truetype/tlwg',
    '/usr/share/fonts/truetype/lklug-sinhala',
    '/usr/share/fonts/truetype/khmeros',
    '/usr/share/fonts/truetype/lao',
    '/usr/share/fonts/truetype/padauk',
    '/usr/share/fonts/truetype/mondulkiri',
    '/usr/share/fonts/truetype/arphic',
    '/usr/share/fonts/truetype/vlgothic',
    '/usr/share/fonts/truetype/takao',
    '/usr/share/fonts/truetype/takao-gothic',
    '/usr/share/fonts/truetype/takao-mincho',
    '/usr/share/fonts/opentype/ipafont',
    '/usr/share/fonts/opentype/ipafont-gothic',
    '/usr/share/fonts/opentype/ipafont-mincho',
    '/usr/share/fonts/opentype/ipaexfont',
    '/usr/share/fonts/opentype/ipaexfont-gothic',
    '/usr/share/fonts/opentype/ipaexfont-mincho',
    '/usr/share/fonts/truetype/unfonts-core',
    '/usr/share/fonts/truetype/unfonts-extra',
    '/usr/share/fonts/truetype/nanum',
    '/usr/share/fonts/truetype/baekmuk',
    '/usr/share/fonts/truetype/wqy',
    '/usr/share/fonts/truetype/culmus',
    '/usr/share/fonts/truetype/kacst',
    '/usr/share/fonts/truetype/kacst-one',
    '/usr/share/fonts/truetype/scheherazade',
    '/usr/share/fonts/truetype/farsiweb',
    '/usr/share/fonts/truetype/nafees',
    '/usr/share/fonts/truetype/thabit',
    '/usr/share/fonts/truetype/hosny-amiri',
    '/usr/share/fonts/truetype/droid',
    '/usr/share/fonts/truetype/roboto',
    '/usr/share/fonts/truetype/roboto/unhinted',
    '/usr/share/fonts/truetype/cantarell',
    '/usr/share/fonts/truetype/open-sans',
    '/usr/share/fonts/truetype/firacode',
    '/usr/share/fonts/opentype/firacode',
    '/usr/share/fonts/truetype/jetbrains-mono',
    '/usr/share/fonts/truetype/inconsolata',
    '/usr/share/fonts/truetype/mononoki',
    '/usr/share/fonts/opentype/mathjax',
    '/usr/share/fonts/opentype/stix',
    '/usr/share/fonts/truetype/lyx',
    '/usr/share/fonts/opentype/lyx',
    '/usr/share/fonts/truetype/texgyre',
    '/usr/share/fonts/opentype/texgyre',
    '/usr/share/fonts/truetype',
    '/usr/share/fonts/opentype',
    '/usr/share/fonts',
    '/usr/local/share/fonts',
    'C:\\Windows\\Fonts',
];

// ── Map filename → clean family name for node-canvas ─────────────────────────
const NAME_MAP = [
    // ── ULTIMATE FALLBACKS (very wide coverage) ──────────────────────────────
    { r: /unifont_upper/i,                n: 'Unifont Upper' },
    { r: /[Uu]nifont/i,                   n: 'Unifont' },
    { r: /Symbola/i,                      n: 'Symbola' },
    { r: /DejaVuSansMono/i,               n: 'DejaVu Sans Mono' },
    { r: /DejaVuSans-Bold/i,              n: 'DejaVu Sans' },
    { r: /DejaVuSans(?!Mono|Condensed)/i, n: 'DejaVu Sans' },
    { r: /DejaVuSerif/i,                  n: 'DejaVu Serif' },
    { r: /LiberationSans/i,               n: 'Liberation Sans' },
    { r: /LiberationSerif/i,              n: 'Liberation Serif' },
    { r: /LiberationMono/i,               n: 'Liberation Mono' },
    { r: /FreeSans/i,                     n: 'FreeSans' },
    { r: /FreeSerif/i,                    n: 'FreeSerif' },
    { r: /FreeMono/i,                     n: 'FreeMono' },
    // ── NOTO SYMBOLS / MATH (must be before generic NotoSans) ────────────────
    { r: /NotoSansSymbols2/i,             n: 'Noto Sans Symbols2' },
    { r: /NotoSansSymbols/i,              n: 'Noto Sans Symbols' },
    { r: /NotoSansMath/i,                 n: 'Noto Sans Math' },
    { r: /NotoMusic/i,                    n: 'Noto Music' },
    { r: /NotoColorEmoji/i,               n: 'Noto Color Emoji' },
    // ── NOTO CJK ──────────────────────────────────────────────────────────────
    { r: /NotoSansCJKsc/i,                n: 'Noto Sans CJK SC' },
    { r: /NotoSansCJKtc/i,                n: 'Noto Sans CJK TC' },
    { r: /NotoSansCJKjp/i,                n: 'Noto Sans CJK JP' },
    { r: /NotoSansCJKkr/i,                n: 'Noto Sans CJK KR' },
    { r: /NotoSansCJK/i,                  n: 'Noto Sans CJK' },
    { r: /NotoSerifCJK/i,                 n: 'Noto Serif CJK' },
    // ── NOTO SCRIPT-SPECIFIC (alphabetical) ──────────────────────────────────
    { r: /NotoSansAdlam/i,                n: 'Noto Sans Adlam' },
    { r: /NotoSansAhom/i,                 n: 'Noto Sans Ahom' },
    { r: /NotoSansAnatolianHieroglyphs/i, n: 'Noto Sans Anatolian Hieroglyphs' },
    { r: /NotoSansArabicUI/i,             n: 'Noto Sans Arabic UI' },
    { r: /NotoSansArabic/i,               n: 'Noto Sans Arabic' },
    { r: /NotoSansArmenian/i,             n: 'Noto Sans Armenian' },
    { r: /NotoSansAvestan/i,              n: 'Noto Sans Avestan' },
    { r: /NotoSansBalinese/i,             n: 'Noto Sans Balinese' },
    { r: /NotoSansBamum/i,                n: 'Noto Sans Bamum' },
    { r: /NotoSansBassaVah/i,             n: 'Noto Sans Bassa Vah' },
    { r: /NotoSansBatak/i,                n: 'Noto Sans Batak' },
    { r: /NotoSansBengaliUI/i,            n: 'Noto Sans Bengali UI' },
    { r: /NotoSansBengali/i,              n: 'Noto Sans Bengali' },
    { r: /NotoSansBhaiksuki/i,            n: 'Noto Sans Bhaiksuki' },
    { r: /NotoSansBrahmi/i,               n: 'Noto Sans Brahmi' },
    { r: /NotoSansBuginese/i,             n: 'Noto Sans Buginese' },
    { r: /NotoSansBuhid/i,                n: 'Noto Sans Buhid' },
    { r: /NotoSansCanadianAboriginal/i,   n: 'Noto Sans Canadian Aboriginal' },
    { r: /NotoSansCarian/i,               n: 'Noto Sans Carian' },
    { r: /NotoSansCaucasianAlbanian/i,    n: 'Noto Sans Caucasian Albanian' },
    { r: /NotoSansChakma/i,               n: 'Noto Sans Chakma' },
    { r: /NotoSansCham/i,                 n: 'Noto Sans Cham' },
    { r: /NotoSansCherokee/i,             n: 'Noto Sans Cherokee' },
    { r: /NotoSansChorasmian/i,           n: 'Noto Sans Chorasmian' },
    { r: /NotoSansCoptic/i,               n: 'Noto Sans Coptic' },
    { r: /NotoSansCuneiform/i,            n: 'Noto Sans Cuneiform' },
    { r: /NotoSansCypriot/i,              n: 'Noto Sans Cypriot' },
    { r: /NotoSansCyproMinoan/i,          n: 'Noto Sans Cypro Minoan' },
    { r: /NotoSansDeseret/i,              n: 'Noto Sans Deseret' },
    { r: /NotoSansDevanagariUI/i,         n: 'Noto Sans Devanagari UI' },
    { r: /NotoSansDevanagari/i,           n: 'Noto Sans Devanagari' },
    { r: /NotoSansDogra/i,                n: 'Noto Sans Dogra' },
    { r: /NotoSansDuployan/i,             n: 'Noto Sans Duployan' },
    { r: /NotoSansEgyptianHieroglyphs/i,  n: 'Noto Sans Egyptian Hieroglyphs' },
    { r: /NotoSansElbasan/i,              n: 'Noto Sans Elbasan' },
    { r: /NotoSansElymaic/i,              n: 'Noto Sans Elymaic' },
    { r: /NotoSansEthiopic/i,             n: 'Noto Sans Ethiopic' },
    { r: /NotoSansGeorgian/i,             n: 'Noto Sans Georgian' },
    { r: /NotoSansGlagolitic/i,           n: 'Noto Sans Glagolitic' },
    { r: /NotoSansGothic/i,               n: 'Noto Sans Gothic' },
    { r: /NotoSansGrantha/i,              n: 'Noto Sans Grantha' },
    { r: /NotoSansGujaratiUI/i,           n: 'Noto Sans Gujarati UI' },
    { r: /NotoSansGujarati/i,             n: 'Noto Sans Gujarati' },
    { r: /NotoSansGunjalaGondi/i,         n: 'Noto Sans Gunjala Gondi' },
    { r: /NotoSansGurmukhiUI/i,           n: 'Noto Sans Gurmukhi UI' },
    { r: /NotoSansGurmukhi/i,             n: 'Noto Sans Gurmukhi' },
    { r: /NotoSansHanifiRohingya/i,       n: 'Noto Sans Hanifi Rohingya' },
    { r: /NotoSansHanunoo/i,              n: 'Noto Sans Hanunoo' },
    { r: /NotoSansHatran/i,               n: 'Noto Sans Hatran' },
    { r: /NotoSansHebrew/i,               n: 'Noto Sans Hebrew' },
    { r: /NotoSansImperialAramaic/i,      n: 'Noto Sans Imperial Aramaic' },
    { r: /NotoSansIndicSiyaqNumbers/i,    n: 'Noto Sans Indic Siyaq Numbers' },
    { r: /NotoSansInscriptionalPahlavi/i, n: 'Noto Sans Inscriptional Pahlavi' },
    { r: /NotoSansInscriptionalParthian/i,n: 'Noto Sans Inscriptional Parthian' },
    { r: /NotoSansJavanese/i,             n: 'Noto Sans Javanese' },
    { r: /NotoSansKaithi/i,               n: 'Noto Sans Kaithi' },
    { r: /NotoSansKannadaUI/i,            n: 'Noto Sans Kannada UI' },
    { r: /NotoSansKannada/i,              n: 'Noto Sans Kannada' },
    { r: /NotoSansKawi/i,                 n: 'Noto Sans Kawi' },
    { r: /NotoSansKayahLi/i,              n: 'Noto Sans Kayah Li' },
    { r: /NotoSansKharoshthi/i,           n: 'Noto Sans Kharoshthi' },
    { r: /NotoSansKhmer/i,                n: 'Noto Sans Khmer' },
    { r: /NotoSansKhojki/i,               n: 'Noto Sans Khojki' },
    { r: /NotoSansKhudawadi/i,            n: 'Noto Sans Khudawadi' },
    { r: /NotoSansLao/i,                  n: 'Noto Sans Lao' },
    { r: /NotoSansLepcha/i,               n: 'Noto Sans Lepcha' },
    { r: /NotoSansLimbu/i,                n: 'Noto Sans Limbu' },
    { r: /NotoSansLinearA/i,              n: 'Noto Sans Linear A' },
    { r: /NotoSansLinearB/i,              n: 'Noto Sans Linear B' },
    { r: /NotoSansLisu/i,                 n: 'Noto Sans Lisu' },
    { r: /NotoSansLycian/i,               n: 'Noto Sans Lycian' },
    { r: /NotoSansLydian/i,               n: 'Noto Sans Lydian' },
    { r: /NotoSansMahajani/i,             n: 'Noto Sans Mahajani' },
    { r: /NotoSansMakasar/i,              n: 'Noto Sans Makasar' },
    { r: /NotoSansMalayalamUI/i,          n: 'Noto Sans Malayalam UI' },
    { r: /NotoSansMalayalam/i,            n: 'Noto Sans Malayalam' },
    { r: /NotoSansMandaic/i,              n: 'Noto Sans Mandaic' },
    { r: /NotoSansManichaean/i,           n: 'Noto Sans Manichaean' },
    { r: /NotoSansMarchen/i,              n: 'Noto Sans Marchen' },
    { r: /NotoSansMasaramGondi/i,         n: 'Noto Sans Masaram Gondi' },
    { r: /NotoSansMayanNumerals/i,        n: 'Noto Sans Mayan Numerals' },
    { r: /NotoSansMedefaidrin/i,          n: 'Noto Sans Medefaidrin' },
    { r: /NotoSansMeeteiMayek/i,          n: 'Noto Sans Meetei Mayek' },
    { r: /NotoSansMendeKikakui/i,         n: 'Noto Sans Mende Kikakui' },
    { r: /NotoSansMeroitic/i,             n: 'Noto Sans Meroitic' },
    { r: /NotoSansMiao/i,                 n: 'Noto Sans Miao' },
    { r: /NotoSansModi/i,                 n: 'Noto Sans Modi' },
    { r: /NotoSansMongolian/i,            n: 'Noto Sans Mongolian' },
    { r: /NotoSansMro/i,                  n: 'Noto Sans Mro' },
    { r: /NotoSansMultani/i,              n: 'Noto Sans Multani' },
    { r: /NotoSansMyanmarUI/i,            n: 'Noto Sans Myanmar UI' },
    { r: /NotoSansMyanmar/i,              n: 'Noto Sans Myanmar' },
    { r: /NotoSansNabataean/i,            n: 'Noto Sans Nabataean' },
    { r: /NotoSansNandinagari/i,          n: 'Noto Sans Nandinagari' },
    { r: /NotoSansNewTaiLue/i,            n: 'Noto Sans New Tai Lue' },
    { r: /NotoSansNewa/i,                 n: 'Noto Sans Newa' },
    { r: /NotoSansNKo/i,                  n: 'Noto Sans NKo' },
    { r: /NotoSansNushuPua/i,             n: 'Noto Sans Nushu Pua' },
    { r: /NotoSansNyiakengPuachueHmong/i, n: 'Noto Sans Nyiakeng Puachue Hmong' },
    { r: /NotoSansOgham/i,                n: 'Noto Sans Ogham' },
    { r: /NotoSansOlChiki/i,              n: 'Noto Sans Ol Chiki' },
    { r: /NotoSansOldHungarian/i,         n: 'Noto Sans Old Hungarian' },
    { r: /NotoSansOldItalic/i,            n: 'Noto Sans Old Italic' },
    { r: /NotoSansOldNorthArabian/i,      n: 'Noto Sans Old North Arabian' },
    { r: /NotoSansOldPermic/i,            n: 'Noto Sans Old Permic' },
    { r: /NotoSansOldPersian/i,           n: 'Noto Sans Old Persian' },
    { r: /NotoSansOldSogdian/i,           n: 'Noto Sans Old Sogdian' },
    { r: /NotoSansOldSouthArabian/i,      n: 'Noto Sans Old South Arabian' },
    { r: /NotoSansOldTurkic/i,            n: 'Noto Sans Old Turkic' },
    { r: /NotoSansOldUyghur/i,            n: 'Noto Sans Old Uyghur' },
    { r: /NotoSansOriyaUI/i,              n: 'Noto Sans Oriya UI' },
    { r: /NotoSansOriya/i,                n: 'Noto Sans Oriya' },
    { r: /NotoSansOsage/i,                n: 'Noto Sans Osage' },
    { r: /NotoSansOsmanya/i,              n: 'Noto Sans Osmanya' },
    { r: /NotoSansPahawhHmong/i,          n: 'Noto Sans Pahawh Hmong' },
    { r: /NotoSansPalmyrene/i,            n: 'Noto Sans Palmyrene' },
    { r: /NotoSansPauCinHau/i,            n: 'Noto Sans Pau Cin Hau' },
    { r: /NotoSansPhagsPa/i,              n: 'Noto Sans Phags Pa' },
    { r: /NotoSansPhoenician/i,           n: 'Noto Sans Phoenician' },
    { r: /NotoSansPsalterPahlavi/i,       n: 'Noto Sans Psalter Pahlavi' },
    { r: /NotoSansRejang/i,               n: 'Noto Sans Rejang' },
    { r: /NotoSansRunic/i,                n: 'Noto Sans Runic' },
    { r: /NotoSansSamaritan/i,            n: 'Noto Sans Samaritan' },
    { r: /NotoSansSaurashtra/i,           n: 'Noto Sans Saurashtra' },
    { r: /NotoSansSharada/i,              n: 'Noto Sans Sharada' },
    { r: /NotoSansShavian/i,              n: 'Noto Sans Shavian' },
    { r: /NotoSansSiddham/i,              n: 'Noto Sans Siddham' },
    { r: /NotoSansSignWriting/i,          n: 'Noto Sans SignWriting' },
    { r: /NotoSansSinhalaUI/i,            n: 'Noto Sans Sinhala UI' },
    { r: /NotoSansSinhala/i,              n: 'Noto Sans Sinhala' },
    { r: /NotoSansSogdian/i,              n: 'Noto Sans Sogdian' },
    { r: /NotoSansSoraSompeng/i,          n: 'Noto Sans Sora Sompeng' },
    { r: /NotoSansSoyombo/i,              n: 'Noto Sans Soyombo' },
    { r: /NotoSansSundanese/i,            n: 'Noto Sans Sundanese' },
    { r: /NotoSansSylotiNagri/i,          n: 'Noto Sans Syloti Nagri' },
    { r: /NotoSansSyriac/i,               n: 'Noto Sans Syriac' },
    { r: /NotoSansTagalog/i,              n: 'Noto Sans Tagalog' },
    { r: /NotoSansTagbanwa/i,             n: 'Noto Sans Tagbanwa' },
    { r: /NotoSansTaiLe/i,                n: 'Noto Sans Tai Le' },
    { r: /NotoSansTaiTham/i,              n: 'Noto Sans Tai Tham' },
    { r: /NotoSansTaiViet/i,              n: 'Noto Sans Tai Viet' },
    { r: /NotoSansTakri/i,                n: 'Noto Sans Takri' },
    { r: /NotoSansTamilSupplement/i,      n: 'Noto Sans Tamil Supplement' },
    { r: /NotoSansTamilUI/i,              n: 'Noto Sans Tamil UI' },
    { r: /NotoSansTamil/i,                n: 'Noto Sans Tamil' },
    { r: /NotoSansTangsa/i,               n: 'Noto Sans Tangsa' },
    { r: /NotoSansTeluguUI/i,             n: 'Noto Sans Telugu UI' },
    { r: /NotoSansTelugu/i,               n: 'Noto Sans Telugu' },
    { r: /NotoSansThaana/i,               n: 'Noto Sans Thaana' },
    { r: /NotoSansThai/i,                 n: 'Noto Sans Thai' },
    { r: /NotoSansTifinagh/i,             n: 'Noto Sans Tifinagh' },
    { r: /NotoSansTirhuta/i,              n: 'Noto Sans Tirhuta' },
    { r: /NotoSansToto/i,                 n: 'Noto Sans Toto' },
    { r: /NotoSansUgaritic/i,             n: 'Noto Sans Ugaritic' },
    { r: /NotoSansVai/i,                  n: 'Noto Sans Vai' },
    { r: /NotoSansVithkuqi/i,             n: 'Noto Sans Vithkuqi' },
    { r: /NotoSansWancho/i,               n: 'Noto Sans Wancho' },
    { r: /NotoSansWarangCiti/i,           n: 'Noto Sans Warang Citi' },
    { r: /NotoSansYi/i,                   n: 'Noto Sans Yi' },
    { r: /NotoSansZanabazarSquare/i,      n: 'Noto Sans Zanabazar Square' },
    { r: /NotoSerifTangut/i,              n: 'Noto Serif Tangut' },
    { r: /NotoSerifTibetan/i,             n: 'Noto Serif Tibetan' },
    { r: /NotoSerifYezidi/i,              n: 'Noto Serif Yezidi' },
    { r: /NotoTraditionalNushu/i,         n: 'Noto Traditional Nushu' },
    { r: /NotoLoopedLao/i,                n: 'Noto Looped Lao' },
    { r: /NotoLoopedThai/i,               n: 'Noto Looped Thai' },
    { r: /NotoRashiHebrew/i,              n: 'Noto Rashi Hebrew' },
    // ── GENERIC NOTO (must be after specific ones) ───────────────────────────
    { r: /NotoSans/i,                     n: 'Noto Sans' },
    { r: /NotoSerif/i,                    n: 'Noto Serif' },
    { r: /NotoMono/i,                     n: 'Noto Mono' },
    // ── OTHER SCRIPT-SPECIFIC FONTS ──────────────────────────────────────────
    { r: /Padauk/i,                       n: 'Padauk' },
    { r: /Scheherazade/i,                 n: 'Scheherazade' },
    { r: /Amiri/i,                        n: 'Amiri' },
    { r: /Lateef/i,                       n: 'Lateef' },
    { r: /Charis/i,                       n: 'Charis SIL' },
    { r: /Gentium/i,                      n: 'Gentium' },
    { r: /Andika/i,                       n: 'Andika' },
    { r: /Doulos/i,                       n: 'Doulos SIL' },
    { r: /Abyssinica/i,                   n: 'Abyssinica SIL' },
    { r: /Ezra/i,                         n: 'Ezra SIL' },
    { r: /KhmerOS/i,                      n: 'Khmer OS' },
    { r: /Phetsarath/i,                   n: 'Phetsarath' },
    { r: /Lohit/i,                        n: 'Lohit' },
    { r: /Samyak/i,                       n: 'Samyak' },
    { r: /Yrsa|Rasa/i,                    n: 'Yrsa' },
    { r: /SaraiBold|Sarai/i,              n: 'Sarai' },
    { r: /Meera/i,                        n: 'Meera' },
    { r: /Rachana/i,                      n: 'Rachana' },
    { r: /AnjaliOldLipi/i,                n: 'AnjaliOldLipi' },
    { r: /TibMachUni/i,                   n: 'TibMachUni' },
    { r: /[Kk]inn?ari/i,                  n: 'Kinnari' },
    { r: /[Gg]aruda/i,                    n: 'Garuda' },
    { r: /[Ll]aksaman/i,                  n: 'Laksaman' },
    { r: /[Pp]urisa/i,                    n: 'Purisa' },
    { r: /[Nn]orasi/i,                    n: 'Norasi' },
    { r: /[Ss]awasdee/i,                  n: 'Sawasdee' },
    { r: /[Ww]aree/i,                     n: 'Waree' },
    { r: /[Uu]mpush/i,                    n: 'Umpush' },
    { r: /Loma/i,                         n: 'Loma' },
    { r: /[Tt]akao/i,                     n: 'Takao' },
    { r: /VL[- ]Gothic|VLGothic/i,        n: 'VL Gothic' },
    { r: /IPAGothic|IPAex.*Gothic/i,      n: 'IPAGothic' },
    { r: /IPAMincho|IPAex.*Mincho/i,      n: 'IPAMincho' },
    { r: /UnBatang/i,                     n: 'UnBatang' },
    { r: /UnDotum/i,                      n: 'UnDotum' },
    { r: /Baekmuk/i,                      n: 'Baekmuk' },
    { r: /[Nn]anum/i,                     n: 'Nanum Gothic' },
    { r: /[Aa][Rr][Pp][Ll].*Uming/i,      n: 'AR PL UMing' },
    { r: /[Aa][Rr][Pp][Ll].*Ukai/i,       n: 'AR PL UKai' },
    { r: /WenQuanYi.*Micro/i,             n: 'WenQuanYi Micro Hei' },
    { r: /WenQuanYi.*Zen/i,               n: 'WenQuanYi Zen Hei' },
    { r: /Mukti/i,                        n: 'Mukti' },
    { r: /Roboto/i,                       n: 'Roboto' },
    { r: /OpenSans/i,                     n: 'Open Sans' },
    { r: /[Cc]antarell/i,                 n: 'Cantarell' },
    { r: /FiraCode/i,                     n: 'Fira Code' },
    { r: /JetBrainsMono/i,                n: 'JetBrains Mono' },
    { r: /Inconsolata/i,                  n: 'Inconsolata' },
    { r: /Mononoki/i,                     n: 'Mononoki' },
    { r: /STIX/i,                         n: 'STIX' },
    { r: /MathJax/i,                      n: 'MathJax' },
    // ── WINDOWS LOCAL DEV ─────────────────────────────────────────────────────
    { r: /seguisym/i,                     n: 'Segoe UI Symbol' },
    { r: /seguiemj/i,                     n: 'Segoe UI Emoji' },
    { r: /arial/i,                        n: 'Arial' },
];

// ── Bitmap-only fonts that crash some renderers — skip them ──────────────────
const SKIP_PATTERNS = [
    /\.ttc$/i,
];

function deriveCanvasName(filename) {
    for (const rule of NAME_MAP) {
        if (rule.r.test(filename)) return rule.n;
    }
    return path.basename(filename, path.extname(filename))
        .replace(/[-_](Regular|Bold|Italic|Light|Medium|Thin|Black|SemiBold|ExtraBold|Heavy)/gi, '')
        .replace(/[-_]/g, ' ').trim() || 'Generic';
}

// ── Register every font found on the system ──────────────────────────────────
;(function registerAllFonts() {
    const loaded = new Set();
    let count = 0, skipped = 0;
    const startTime = Date.now();

    for (const dir of SCAN_DIRS) {
        if (!fs.existsSync(dir)) continue;
        let files;
        try { files = fs.readdirSync(dir); } catch { continue; }
        for (const file of files) {
            if (!/\.(ttf|otf)$/i.test(file)) continue;
            if (SKIP_PATTERNS.some(p => p.test(file))) { skipped++; continue; }

            const fullPath = path.join(dir, file);
            if (loaded.has(fullPath)) continue;
            loaded.add(fullPath);

            try {
                registerFont(fullPath, { family: deriveCanvasName(file) });
                count++;
            } catch (_) { skipped++; }
        }
    }

    const elapsed = Date.now() - startTime;
    console.log(`✅ Registered ${count} fonts with node-canvas in ${elapsed}ms`);
    console.log(`⏭️  Skipped ${skipped} incompatible files`);
})();

// ── Font stack for both canvas and CSS ───────────────────────────────────────
// Order matters: Pango tries each font in order for each character
const FONT_STACK_ARRAY = [
    // Base Latin fonts
    'Noto Sans', 'DejaVu Sans', 'Liberation Sans', 'FreeSans',
    // Symbol fonts (catches fancy text characters)
    'Noto Sans Math', 'Noto Sans Symbols2', 'Noto Sans Symbols',
    'Symbola', 'Noto Music',
    // CJK
    'Noto Sans CJK', 'Noto Sans CJK SC', 'Noto Sans CJK JP',
    'Noto Sans CJK KR', 'WenQuanYi Micro Hei', 'AR PL UMing',
    'VL Gothic', 'IPAGothic', 'Nanum Gothic', 'UnBatang',
    // Arabic family
    'Noto Sans Arabic', 'Amiri', 'Scheherazade', 'Lateef',
    // Indic
    'Noto Sans Devanagari', 'Noto Sans Bengali', 'Noto Sans Tamil',
    'Noto Sans Telugu', 'Noto Sans Kannada', 'Noto Sans Malayalam',
    'Noto Sans Gujarati', 'Noto Sans Gurmukhi', 'Noto Sans Oriya',
    'Noto Sans Sinhala', 'Lohit', 'Samyak', 'Padauk',
    // Southeast Asian
    'Noto Sans Thai', 'Noto Sans Lao', 'Noto Sans Khmer',
    'Noto Sans Myanmar', 'Khmer OS', 'Garuda', 'Kinnari',
    // Other living scripts
    'Noto Sans Hebrew', 'Noto Sans Syriac', 'Noto Sans Thaana',
    'Noto Sans Georgian', 'Noto Sans Armenian', 'Noto Sans Ethiopic',
    'Noto Sans Mongolian', 'Noto Serif Tibetan', 'TibMachUni',
    'Noto Sans Cherokee', 'Noto Sans Canadian Aboriginal',
    'Noto Sans Tifinagh', 'Noto Sans Vai', 'Noto Sans NKo',
    'Noto Sans Adlam', 'Noto Sans Bamum', 'Abyssinica SIL',
    // Historic / ancient
    'Noto Sans Runic', 'Noto Sans Ogham', 'Noto Sans Gothic',
    'Noto Sans Old Italic', 'Noto Sans Old Persian',
    'Noto Sans Old Turkic', 'Noto Sans Phoenician',
    'Noto Sans Ugaritic', 'Noto Sans Cuneiform',
    'Noto Sans Egyptian Hieroglyphs', 'Noto Sans Linear A',
    'Noto Sans Linear B', 'Noto Sans Glagolitic',
    'Noto Sans Imperial Aramaic', 'Noto Sans Nabataean',
    'Noto Sans Avestan', 'Noto Sans Brahmi', 'Noto Sans Carian',
    'Noto Sans Lycian', 'Noto Sans Lydian',
    // Rare/uncommon scripts (the "cool name" fonts)
    'Noto Sans Duployan', 'Noto Sans SignWriting',
    'Noto Sans Deseret', 'Noto Sans Shavian', 'Noto Sans Osmanya',
    'Noto Sans Osage', 'Noto Sans Elbasan', 'Noto Sans Coptic',
    'Noto Sans Hanifi Rohingya',
    // ABSOLUTE LAST RESORT — guarantees no tofu
    'Unifont Upper', 'Unifont',
    // Generic fallback
    'sans-serif'
];

const CANVAS_FONT = FONT_STACK_ARRAY.map(f => `'${f}'`).join(', ');
const CSS_FONT    = FONT_STACK_ARRAY.map(f => `'${f}'`).join(',');

// =============================================================================
// BROWSER POOL
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
            headless: true,
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

// Pre-warm at module load
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
        catch { /* dead page, create new */ }
    }
    const browser = await getBrowser();
    const page    = await browser.newPage();

    await page.setRequestInterception(true);
    page.on('request', req => {
        const url = req.url();
        if (url.startsWith('data:') || url.includes('cdn.jsdelivr.net')) req.continue();
        else if (url.startsWith('http')) req.abort();
        else req.continue();
    });

    await page.setViewport({ width: 5000, height: 5000, deviceScaleFactor: 1 });
    return page;
}

function releasePage(page) {
    if (PAGE_POOL.length < PAGE_POOL_MAX) PAGE_POOL.push(page);
    else page.close().catch(() => {});
}

// =============================================================================
// BOT TOKEN CHECK
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
// NAME RENDERING via canvas
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
        } else { chunk += c; }
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
    } catch { return null; }
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
                out += `<img src="${toAppleEmojiUrl(c)}" class="emoji"/>`;
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
// AVATAR GENERATOR
// =============================================================================
async function dummyAvatar(f, l, color) {
    const S = 200;
    const cv  = createCanvas(S, S);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(S/2, S/2, S/2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `bold ${S*0.38}px ${CANVAS_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(((f?.[0]||'')+(l?.[0]||'')).toUpperCase().substring(0,2)||'?', S/2, S/2);
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
.f-line { font-size: ${MSG_FS * 0.75}px; color: #64b5f6; margin-bottom: ${4 * SCALE}px; opacity: 0.9; }
.premium-emoji { width: ${18 * SCALE}px; height: ${18 * SCALE}px; margin-left: ${2 * SCALE}px; }
.link { color: #64b5f6; display: inline-block; word-break: break-all; text-decoration: none; }
.reply-block { background: rgba(255,255,255,0.06); border-radius: ${6 * SCALE}px; padding: ${6 * SCALE}px ${10 * SCALE}px; border-left: ${4 * SCALE}px solid; margin-bottom: ${10 * SCALE}px; max-width: ${300 * SCALE}px; overflow: hidden; }
.reply-name { font-size: ${MSG_FS * 0.72}px; font-weight: 600; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.reply-text { font-size: ${MSG_FS * 0.7}px; color: #7f91a4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.emoji { height: 1.2em; width: 1.2em; vertical-align: middle; }
.msg-emoji { height: 1.3em; width: 1.3em; vertical-align: middle; }
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
                let loaded = 0;
                const done = () => { if (++loaded >= imgs.length) resolve(); };
                setTimeout(resolve, 3000);
                imgs.forEach(img => {
                    if (img.complete) done();
                    else { img.onload = done; img.onerror = done; }
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
