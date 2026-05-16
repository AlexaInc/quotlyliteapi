FROM node:18

# =============================================================================
# SYSTEM BUILD DEPENDENCIES
# =============================================================================
RUN apt-get update && apt-get install -y \
    git wget curl unzip fontconfig \
    libcairo2-dev libjpeg-dev libpango1.0-dev libgif-dev \
    build-essential g++ python3 \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxcomposite1 libxdamage1 libxext6 libxfixes3 libxrandr2 \
    libgbm1 libasound2 libxshmfence1 \
    chromium \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# =============================================================================
# ALL APT FONT PACKAGES - maximum coverage from debian repos
# =============================================================================
RUN apt-get update && apt-get install -y \
    # ── Noto family (Google's universal coverage) ────────────────────────────
    fonts-noto \
    fonts-noto-core \
    fonts-noto-extra \
    fonts-noto-ui-core \
    fonts-noto-ui-extra \
    fonts-noto-cjk \
    fonts-noto-cjk-extra \
    fonts-noto-color-emoji \
    fonts-noto-mono \
    # ── DejaVu (wide Unicode coverage) ────────────────────────────────────────
    fonts-dejavu \
    fonts-dejavu-core \
    fonts-dejavu-extra \
    # ── Liberation (Microsoft font substitutes) ──────────────────────────────
    fonts-liberation \
    fonts-liberation2 \
    # ── GNU FreeFont (comprehensive Unicode) ──────────────────────────────────
    fonts-freefont-ttf \
    fonts-freefont-otf \
    # ── Symbola - covers virtually every symbol Unicode has ──────────────────
    fonts-symbola \
    # ── Ancient/Historic scripts ──────────────────────────────────────────────
    fonts-ancient-scripts \
    # ── Unifont - LAST RESORT, has EVERY single Unicode codepoint ────────────
    fonts-unifont \
    # ── Arabic family ─────────────────────────────────────────────────────────
    fonts-arabeyes \
    fonts-hosny-amiri \
    fonts-kacst \
    fonts-kacst-one \
    fonts-sil-scheherazade \
    fonts-sil-lateef \
    fonts-thabit \
    fonts-farsiweb \
    fonts-nafees \
    # ── Indic scripts ─────────────────────────────────────────────────────────
    fonts-deva \
    fonts-beng \
    fonts-gujr \
    fonts-knda \
    fonts-mlym \
    fonts-orya \
    fonts-guru \
    fonts-taml \
    fonts-telu \
    fonts-sinhala \
    fonts-lohit-deva \
    fonts-lohit-beng-assamese \
    fonts-lohit-beng-bengali \
    fonts-lohit-gujr \
    fonts-lohit-knda \
    fonts-lohit-mlym \
    fonts-lohit-orya \
    fonts-lohit-guru \
    fonts-lohit-taml \
    fonts-lohit-taml-classical \
    fonts-lohit-telu \
    fonts-pagul \
    fonts-samyak-deva \
    fonts-samyak-gujr \
    fonts-samyak-mlym \
    fonts-samyak-taml \
    fonts-sarai \
    fonts-smc \
    fonts-yrsa-rasa \
    # ── Southeast Asian scripts ───────────────────────────────────────────────
    fonts-tibetan-machine \
    fonts-tlwg-garuda \
    fonts-tlwg-kinnari \
    fonts-tlwg-laksaman \
    fonts-tlwg-loma \
    fonts-tlwg-mono \
    fonts-tlwg-norasi \
    fonts-tlwg-purisa \
    fonts-tlwg-sawasdee \
    fonts-tlwg-typewriter \
    fonts-tlwg-typist \
    fonts-tlwg-typo \
    fonts-tlwg-umpush \
    fonts-tlwg-waree \
    fonts-lklug-sinhala \
    fonts-khmeros \
    fonts-khmeros-core \
    fonts-lao \
    fonts-sil-padauk \
    fonts-sil-mondulkiri \
    fonts-sil-charis \
    fonts-sil-gentium \
    fonts-sil-gentium-basic \
    fonts-sil-abyssinica \
    fonts-sil-ezra \
    fonts-sil-andika \
    fonts-sil-doulos \
    # ── East Asian (CJK supplements) ──────────────────────────────────────────
    fonts-arphic-ukai \
    fonts-arphic-uming \
    fonts-vlgothic \
    fonts-takao \
    fonts-takao-gothic \
    fonts-takao-mincho \
    fonts-takao-pgothic \
    fonts-ipafont \
    fonts-ipafont-gothic \
    fonts-ipafont-mincho \
    fonts-ipaexfont \
    fonts-ipaexfont-gothic \
    fonts-ipaexfont-mincho \
    fonts-unfonts-core \
    fonts-unfonts-extra \
    fonts-nanum \
    fonts-nanum-coding \
    fonts-nanum-extra \
    fonts-baekmuk \
    fonts-wqy-microhei \
    fonts-wqy-zenhei \
    # ── Hebrew ────────────────────────────────────────────────────────────────
    fonts-hosny-thabit \
    culmus \
    culmus-fancy \
    # ── Ethiopic ──────────────────────────────────────────────────────────────
    fonts-abyssinica \
    # ── Tibetan ───────────────────────────────────────────────────────────────
    fonts-bpg-georgian \
    # ── Misc ──────────────────────────────────────────────────────────────────
    fonts-droid-fallback \
    fonts-roboto \
    fonts-cantarell \
    fonts-open-sans \
    fonts-firacode \
    fonts-firacode-otf \
    fonts-jetbrains-mono \
    fonts-inconsolata \
    fonts-mononoki \
    fonts-mathjax \
    fonts-stix \
    fonts-lyx \
    fonts-texgyre \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/* || true

# =============================================================================
# DOWNLOAD COMPLETE NOTO STACK
# Every single Noto font family that exists - covers every script Unicode has
# =============================================================================
RUN mkdir -p /usr/share/fonts/truetype/noto-manual

ENV NOTO_BASE="https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf"

# Helper macro: try to download, never fail the build
# ── SYMBOLS, MATH, MUSIC (highest priority for tofu prevention) ───────────────
RUN set -e; for font in \
    "NotoSansSymbols/NotoSansSymbols-Regular.ttf" \
    "NotoSansSymbols/NotoSansSymbols-Bold.ttf" \
    "NotoSansSymbols/NotoSansSymbols-Light.ttf" \
    "NotoSansSymbols/NotoSansSymbols-Medium.ttf" \
    "NotoSansSymbols/NotoSansSymbols-SemiBold.ttf" \
    "NotoSansSymbols/NotoSansSymbols-Thin.ttf" \
    "NotoSansSymbols2/NotoSansSymbols2-Regular.ttf" \
    "NotoSansMath/NotoSansMath-Regular.ttf" \
    "NotoMusic/NotoMusic-Regular.ttf" \
    ; do \
    wget -q -O "/usr/share/fonts/truetype/noto-manual/$(basename $font)" "${NOTO_BASE}/${font}" || echo "skip $font"; \
    done

# ── EVERY SCRIPT-SPECIFIC NOTO FONT ───────────────────────────────────────────
# This is the complete list of Noto script families
RUN set -e; for script in \
    Adlam Ahom AnatolianHieroglyphs Arabic ArabicUI Armenian Avestan \
    Balinese Bamum BassaVah Batak Bengali BengaliUI Bhaiksuki Brahmi \
    Buginese Buhid CanadianAboriginal Carian CaucasianAlbanian Chakma \
    Cham Cherokee Chorasmian Coptic Cuneiform Cypriot CyproMinoan \
    Deseret Devanagari DevanagariUI Dogra Duployan EgyptianHieroglyphs \
    Elbasan Elymaic Ethiopic Georgian Glagolitic Gothic Grantha \
    Gujarati GujaratiUI GunjalaGondi Gurmukhi GurmukhiUI HanifiRohingya \
    Hanunoo Hatran Hebrew ImperialAramaic IndicSiyaqNumbers \
    InscriptionalPahlavi InscriptionalParthian Javanese Kaithi Kannada \
    KannadaUI Kawi KayahLi Kharoshthi Khmer Khojki Khudawadi Lao \
    Lepcha Limbu LinearA LinearB Lisu Lycian Lydian Mahajani Makasar \
    Malayalam MalayalamUI Mandaic Manichaean Marchen MasaramGondi \
    MayanNumerals MedefaidrinScript MeeteiMayek MendeKikakui Meroitic \
    Miao Modi Mongolian Mro Multani Myanmar MyanmarUI Nabataean \
    Nandinagari Newa NewTaiLue NKo NushuPua NyiakengPuachueHmong Ogham \
    OlChiki OldHungarian OldItalic OldNorthArabian OldPermic OldPersian \
    OldSogdian OldSouthArabian OldTurkic OldUyghur Oriya OriyaUI Osage \
    Osmanya PahawhHmong Palmyrene PauCinHau PhagsPa Phoenician \
    PsalterPahlavi Rejang Runic Samaritan Saurashtra Sharada Shavian \
    Siddham SignWriting Sinhala SinhalaUI Sogdian SoraSompeng Soyombo \
    Sundanese SylotiNagri Syriac SyriacEastern SyriacEstrangela \
    SyriacWestern Tagalog Tagbanwa TaiLe TaiTham TaiViet Takri Tamil \
    TamilSupplement TamilUI Tangsa Telugu TeluguUI Thaana Thai \
    Tifinagh TifinaghAdrar TifinaghAgrawImazighen TifinaghAhaggar \
    TifinaghAir TifinaghAPT TifinaghAzawagh TifinaghGhat \
    TifinaghHawad TifinaghRhissaIxa TifinaghSIL TifinaghTawellemmet \
    Tirhuta Toto Ugaritic Vai Vithkuqi Wancho WarangCiti Yi \
    ZanabazarSquare \
    ; do \
    for weight in Regular Bold Light Medium SemiBold Thin ExtraBold Black; do \
        wget -q -O "/usr/share/fonts/truetype/noto-manual/NotoSans${script}-${weight}.ttf" \
            "${NOTO_BASE}/NotoSans${script}/NotoSans${script}-${weight}.ttf" 2>/dev/null || true; \
    done; \
    done && echo "✅ Noto Sans script fonts downloaded"

# ── SERIF VARIANTS ────────────────────────────────────────────────────────────
RUN set -e; for script in \
    Armenian Balinese Bengali Devanagari Display Dogra Ethiopic \
    Georgian Grantha Gujarati Gurmukhi Hebrew Kannada Khitan Khmer \
    Khojki Lao Makasar Malayalam Myanmar NPHmong Oriya Ottoman \
    Sinhala Tamil Tangut Telugu Thai Tibetan Toto Vithkuqi Yezidi \
    ; do \
    for weight in Regular Bold Light Medium SemiBold; do \
        wget -q -O "/usr/share/fonts/truetype/noto-manual/NotoSerif${script}-${weight}.ttf" \
            "${NOTO_BASE}/NotoSerif${script}/NotoSerif${script}-${weight}.ttf" 2>/dev/null || true; \
    done; \
    done && echo "✅ Noto Serif script fonts downloaded"

# ── SPECIAL NOTO FONTS ────────────────────────────────────────────────────────
RUN set -e; for font in \
    "NotoTraditionalNushu/NotoTraditionalNushu-Regular.ttf" \
    "NotoSerifTangut/NotoSerifTangut-Regular.ttf" \
    "NotoLoopedLao/NotoLoopedLao-Regular.ttf" \
    "NotoLoopedThai/NotoLoopedThai-Regular.ttf" \
    "NotoRashiHebrew/NotoRashiHebrew-Regular.ttf" \
    ; do \
    wget -q -O "/usr/share/fonts/truetype/noto-manual/$(basename $font)" "${NOTO_BASE}/${font}" 2>/dev/null || true; \
    done

# =============================================================================
# DOWNLOAD GNU UNIFONT - THE ULTIMATE TOFU KILLER
# Has bitmap glyphs for EVERY single Unicode codepoint that exists
# If no other font has the character, Unifont guarantees it renders
# =============================================================================
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/unifont-15.1.05.otf \
    "https://unifoundry.com/pub/unifont/unifont-15.1.05/font-builds/unifont-15.1.05.otf" || \
    echo "Unifont OTF download failed - using apt version"

RUN wget -q -O /usr/share/fonts/truetype/noto-manual/unifont_upper-15.1.05.otf \
    "https://unifoundry.com/pub/unifont/unifont-15.1.05/font-builds/unifont_upper-15.1.05.otf" || \
    echo "Unifont upper plane download failed"

# =============================================================================
# DOWNLOAD SYMBOLA - MAXIMUM SYMBOL COVERAGE
# =============================================================================
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/Symbola.ttf \
    "https://github.com/ChiefMikeK/ttf-symbola/raw/master/Symbola-13.ttf" || \
    echo "Symbola download failed - using apt version"

# =============================================================================
# REBUILD FONT CACHE
# =============================================================================
RUN fc-cache -fv && \
    echo "════════════════════════════════════════" && \
    echo "Total font files installed:" && \
    find /usr/share/fonts -name "*.ttf" -o -name "*.otf" | wc -l && \
    echo "Total disk usage by fonts:" && \
    du -sh /usr/share/fonts && \
    echo "════════════════════════════════════════"

# =============================================================================
# APP SETUP
# =============================================================================
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
RUN git clone https://github.com/AlexaInc/quotlyliteapi.git .

RUN npm install --legacy-peer-deps && \
    npm rebuild sharp canvas

ENV PORT=7860
EXPOSE 7860
CMD ["node", "app.js"]
