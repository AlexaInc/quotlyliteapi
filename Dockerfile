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
# FIXED: 6 package names corrected for Debian Bookworm
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
    # ── Georgian ──────────────────────────────────────────────────────────────
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
# DOWNLOAD NOTO SYMBOLS/MATH/MUSIC
# =============================================================================
RUN mkdir -p /usr/share/fonts/truetype/noto-manual

ENV NOTO_BASE="https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf"

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

# =============================================================================
# ADDITIONAL NOTO SCRIPT FONTS
# =============================================================================
RUN mkdir -p /usr/share/fonts/truetype/google-extra

RUN set -e; for family in \
    "NotoSansAdlam" "NotoSansAvestan" "NotoSansBamum" "NotoSansBatak" \
    "NotoSansBuginese" "NotoSansBuhid" "NotoSansCham" "NotoSansCherokee" \
    "NotoSansCoptic" "NotoSansEthiopic" "NotoSansGeorgian" "NotoSansGothic" \
    "NotoSansHanunoo" "NotoSansImperialAramaic" "NotoSansJavanese" \
    "NotoSansKayahLi" "NotoSansLepcha" "NotoSansLimbu" "NotoSansLisu" \
    "NotoSansMandaic" "NotoSansMeeteiMayek" "NotoSansMongolian" \
    "NotoSansNKo" "NotoSansNewTaiLue" "NotoSansOgham" "NotoSansOlChiki" \
    "NotoSansOldItalic" "NotoSansOldPersian" "NotoSansOsmanya" \
    "NotoSansPhoenician" "NotoSansRejang" "NotoSansRunic" \
    "NotoSansSamaritan" "NotoSansSaurashtra" "NotoSansSundanese" \
    "NotoSansSylotiNagri" "NotoSansTagalog" "NotoSansTagbanwa" \
    "NotoSansTaiLe" "NotoSansTaiTham" "NotoSansTaiViet" \
    "NotoSansThaana" "NotoSansTifinagh" "NotoSansVai" "NotoSansYi" \
    ; do \
        wget -q -O "/usr/share/fonts/truetype/google-extra/${family}-Regular.ttf" \
            "${NOTO_BASE}/${family}/${family}-Regular.ttf" 2>/dev/null || true; \
    done

# =============================================================================
# EXTRA WEBFONTS (Inter)
# =============================================================================
RUN mkdir -p /usr/share/fonts/truetype/extra-webfonts && \
    wget -q -O /tmp/inter.zip "https://github.com/rsms/inter/releases/download/v4.0/Inter-4.0.zip" && \
    unzip -qo /tmp/inter.zip -d /tmp/inter 2>/dev/null || true && \
    find /tmp/inter -name "*.ttf" -exec cp {} /usr/share/fonts/truetype/extra-webfonts/ \; 2>/dev/null || true && \
    rm -rf /tmp/inter /tmp/inter.zip || true

# =============================================================================
# FONTCONFIG
# =============================================================================
RUN mkdir -p /etc/fonts/conf.d && \
    cat > /etc/fonts/local.conf << 'EOF'
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
    <match target="font">
        <edit name="antialias" mode="assign"><bool>true</bool></edit>
        <edit name="hinting" mode="assign"><bool>true</bool></edit>
        <edit name="hintstyle" mode="assign"><const>hintslight</const></edit>
        <edit name="rgba" mode="assign"><const>rgb</const></edit>
        <edit name="lcdfilter" mode="assign"><const>lcddefault</const></edit>
    </match>
    <alias>
        <family>sans-serif</family>
        <prefer>
            <family>Noto Sans</family>
            <family>Noto Sans CJK SC</family>
            <family>Noto Sans CJK TC</family>
            <family>Noto Sans CJK JP</family>
            <family>Noto Sans CJK KR</family>
            <family>Noto Sans Arabic</family>
            <family>Noto Sans Hebrew</family>
            <family>Noto Sans Devanagari</family>
            <family>Noto Sans Bengali</family>
            <family>Noto Sans Tamil</family>
            <family>Noto Sans Telugu</family>
            <family>Noto Sans Kannada</family>
            <family>Noto Sans Malayalam</family>
            <family>Noto Sans Gujarati</family>
            <family>Noto Sans Gurmukhi</family>
            <family>Noto Sans Oriya</family>
            <family>Noto Sans Sinhala</family>
            <family>Noto Sans Thai</family>
            <family>Noto Sans Lao</family>
            <family>Noto Sans Myanmar</family>
            <family>Noto Sans Khmer</family>
            <family>Noto Sans Tibetan</family>
            <family>Noto Sans Georgian</family>
            <family>Noto Sans Armenian</family>
            <family>Noto Sans Ethiopic</family>
            <family>Noto Sans Cherokee</family>
            <family>Noto Sans Mongolian</family>
            <family>DejaVu Sans</family>
            <family>Liberation Sans</family>
            <family>FreeSans</family>
            <family>Unifont</family>
        </prefer>
    </alias>
    <alias>
        <family>serif</family>
        <prefer>
            <family>Noto Serif</family>
            <family>Noto Serif CJK SC</family>
            <family>DejaVu Serif</family>
            <family>Liberation Serif</family>
            <family>FreeSerif</family>
            <family>Unifont</family>
        </prefer>
    </alias>
    <alias>
        <family>monospace</family>
        <prefer>
            <family>JetBrains Mono</family>
            <family>Fira Code</family>
            <family>Noto Sans Mono</family>
            <family>DejaVu Sans Mono</family>
            <family>Liberation Mono</family>
            <family>FreeMono</family>
            <family>Unifont</family>
        </prefer>
    </alias>
    <match target="pattern">
        <edit name="family" mode="append"><string>Noto Sans</string></edit>
        <edit name="family" mode="append"><string>Noto Sans Symbols</string></edit>
        <edit name="family" mode="append"><string>Noto Sans Symbols 2</string></edit>
        <edit name="family" mode="append"><string>Symbola</string></edit>
        <edit name="family" mode="append"><string>Unifont</string></edit>
    </match>
</fontconfig>
EOF

RUN fc-cache -fv

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
