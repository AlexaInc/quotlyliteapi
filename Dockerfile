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
# FIXED: 6 package names for Debian Bookworm compatibility
#   fonts-thabit -> fonts-hosny-thabit
#   fonts-sinhala -> fonts-lklug-sinhala  
#   fonts-khmeros-core -> fonts-khmeros
#   fonts-takao-pgothic -> fonts-takao
#   fonts-abyssinica -> fonts-sil-abyssinica
#   fonts-firacode-otf -> fonts-firacode
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
    fonts-hosny-thabit \
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
    fonts-lklug-sinhala \
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
    fonts-sil-abyssinica \
    # ── Tibetan ───────────────────────────────────────────────────────────────
    fonts-bpg-georgian \
    # ── Misc ──────────────────────────────────────────────────────────────────
    fonts-droid-fallback \
    fonts-roboto \
    fonts-cantarell \
    fonts-open-sans \
    fonts-firacode \
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
    TifinaghAir TifinaghAPT TifinaghAzawagh TifinaghGhat TifinaghHawad \
    TifinaghRhissaIxa TifinaghSIL TifinaghTawellemmet Tirhuta Ugaritic \
    Vai Vithkuqi Wancho WarangCiti Yezidi Yi Zanabazar \
    ; do \
    wget -q -O "/usr/share/fonts/truetype/noto-manual/NotoSans${script}-Regular.ttf" \
        "${NOTO_BASE}/NotoSans${script}/NotoSans${script}-Regular.ttf" 2>/dev/null || true; \
    done

# ── DOWNLOAD INTER FONT ───────────────────────────────────────────────────────
RUN mkdir -p /usr/share/fonts/truetype/inter && \
    wget -q -O /tmp/inter.zip "https://github.com/rsms/inter/releases/download/v4.0/Inter-4.0.zip" && \
    unzip -qo /tmp/inter.zip -d /tmp/inter 2>/dev/null || true && \
    find /tmp/inter -name "*.ttf" -exec cp {} /usr/share/fonts/truetype/inter/ \; 2>/dev/null || true && \
    rm -rf /tmp/inter /tmp/inter.zip || true

# Rebuild font cache
RUN fc-cache -fv && \
    echo "Font count:" && fc-list | wc -l

# =============================================================================
# APPLICATION SETUP
# =============================================================================
WORKDIR /app

# Tell Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROMIUM_PATH=/usr/bin/chromium

# Copy package files and install
COPY package.json ./
RUN npm install --production

# Copy application code
COPY . .

# Expose port
EXPOSE 7860

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:7860/ || exit 1

# Start the application
CMD ["node", "app.js"]
