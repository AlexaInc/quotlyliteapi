FROM node:18

# ── System build dependencies ─────────────────────────────────────────────────
RUN apt-get update && apt-get install -y \
    git \
    wget \
    curl \
    unzip \
    fontconfig \
    libcairo2-dev \
    libjpeg-dev \
    libpango1.0-dev \
    libgif-dev \
    build-essential \
    g++ \
    python3 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libxshmfence1 \
    chromium \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# ── APT font packages ─────────────────────────────────────────────────────────
# These cover the most common scripts via debian packages
RUN apt-get update && apt-get install -y \
    fonts-noto \
    fonts-noto-ui-core \
    fonts-noto-ui-extra \
    fonts-noto-extra \
    fonts-noto-cjk \
    fonts-noto-cjk-extra \
    fonts-noto-color-emoji \
    fonts-noto-mono \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# ── Create directory for manually downloaded fonts ────────────────────────────
RUN mkdir -p /usr/share/fonts/truetype/noto-manual

# ── Download fonts NOT available in apt packages ──────────────────────────────
# These are the fonts that cover rare/uncommon Unicode blocks
# that users put in their names as "cool" characters
# Base GitHub URL for Noto fonts
ENV NOTO_BASE="https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf"

# Symbols - CRITICAL: covers hundreds of rare Unicode blocks
# This single font covers more rare codepoints than any other
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansSymbols-Regular.ttf \
    "${NOTO_BASE}/NotoSansSymbols/NotoSansSymbols-Regular.ttf" && \
    wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansSymbols-Bold.ttf \
    "${NOTO_BASE}/NotoSansSymbols/NotoSansSymbols-Bold.ttf"

# Symbols2 - CRITICAL: covers even more rare Unicode blocks
# Covers Braille, Sutton SignWriting, box drawing, game symbols, etc.
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansSymbols2-Regular.ttf \
    "${NOTO_BASE}/NotoSansSymbols2/NotoSansSymbols2-Regular.ttf"

# Math - Mathematical operators, letterlike symbols
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansMath-Regular.ttf \
    "${NOTO_BASE}/NotoSansMath/NotoSansMath-Regular.ttf"

# Music notation
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoMusic-Regular.ttf \
    "${NOTO_BASE}/NotoMusic/NotoMusic-Regular.ttf"

# Duployan shorthand - users put these in names
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansDuployan-Regular.ttf \
    "${NOTO_BASE}/NotoSansDuployan/NotoSansDuployan-Regular.ttf"

# Egyptian Hieroglyphs - people use these in names
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansEgyptianHieroglyphs-Regular.ttf \
    "${NOTO_BASE}/NotoSansEgyptianHieroglyphs/NotoSansEgyptianHieroglyphs-Regular.ttf"

# Cuneiform - ancient script used in names
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansCuneiform-Regular.ttf \
    "${NOTO_BASE}/NotoSansCuneiform/NotoSansCuneiform-Regular.ttf"

# Linear B Syllabary and Ideograms
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansLinearB-Regular.ttf \
    "${NOTO_BASE}/NotoSansLinearB/NotoSansLinearB-Regular.ttf"

# Linear A
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansLinearA-Regular.ttf \
    "${NOTO_BASE}/NotoSansLinearA/NotoSansLinearA-Regular.ttf"

# Gothic
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansGothic-Regular.ttf \
    "${NOTO_BASE}/NotoSansGothic/NotoSansGothic-Regular.ttf"

# Old Turkic
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansOldTurkic-Regular.ttf \
    "${NOTO_BASE}/NotoSansOldTurkic/NotoSansOldTurkic-Regular.ttf"

# Runic - very popular for "cool" names
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansRunic-Regular.ttf \
    "${NOTO_BASE}/NotoSansRunic/NotoSansRunic-Regular.ttf"

# Ogham
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansOgham-Regular.ttf \
    "${NOTO_BASE}/NotoSansOgham/NotoSansOgham-Regular.ttf"

# Glagolitic - old Slavic script
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansGlagolitic-Regular.ttf \
    "${NOTO_BASE}/NotoSansGlagolitic/NotoSansGlagolitic-Regular.ttf"

# Phoenician
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansPhoenician-Regular.ttf \
    "${NOTO_BASE}/NotoSansPhoenician/NotoSansPhoenician-Regular.ttf"

# Old Persian
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansOldPersian-Regular.ttf \
    "${NOTO_BASE}/NotoSansOldPersian/NotoSansOldPersian-Regular.ttf"

# Imperial Aramaic
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansImperialAramaic-Regular.ttf \
    "${NOTO_BASE}/NotoSansImperialAramaic/NotoSansImperialAramaic-Regular.ttf"

# Tifinagh - Berber script
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansTifinagh-Regular.ttf \
    "${NOTO_BASE}/NotoSansTifinagh/NotoSansTifinagh-Regular.ttf"

# Vai
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansVai-Regular.ttf \
    "${NOTO_BASE}/NotoSansVai/NotoSansVai-Regular.ttf"

# Bamum
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansBamum-Regular.ttf \
    "${NOTO_BASE}/NotoSansBamum/NotoSansBamum-Regular.ttf"

# Batak
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansBatak-Regular.ttf \
    "${NOTO_BASE}/NotoSansBatak/NotoSansBatak-Regular.ttf"

# Buginese
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansBuginese-Regular.ttf \
    "${NOTO_BASE}/NotoSansBuginese/NotoSansBuginese-Regular.ttf"

# Cham
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansCham-Regular.ttf \
    "${NOTO_BASE}/NotoSansCham/NotoSansCham-Regular.ttf"

# Coptic
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansCoptic-Regular.ttf \
    "${NOTO_BASE}/NotoSansCoptic/NotoSansCoptic-Regular.ttf"

# Deseret - Mormon phonetic alphabet
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansDeseret-Regular.ttf \
    "${NOTO_BASE}/NotoSansDeseret/NotoSansDeseret-Regular.ttf"

# Elbasan
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansElbasan-Regular.ttf \
    "${NOTO_BASE}/NotoSansElbasan/NotoSansElbasan-Regular.ttf"

# Hanifi Rohingya
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansHanifiRohingya-Regular.ttf \
    "${NOTO_BASE}/NotoSansHanifiRohingya/NotoSansHanifiRohingya-Regular.ttf"

# Hanunoo
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansHanunoo-Regular.ttf \
    "${NOTO_BASE}/NotoSansHanunoo/NotoSansHanunoo-Regular.ttf"

# Kayah Li
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansKayahLi-Regular.ttf \
    "${NOTO_BASE}/NotoSansKayahLi/NotoSansKayahLi-Regular.ttf"

# Lepcha
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansLepcha-Regular.ttf \
    "${NOTO_BASE}/NotoSansLepcha/NotoSansLepcha-Regular.ttf"

# Limbu
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansLimbu-Regular.ttf \
    "${NOTO_BASE}/NotoSansLimbu/NotoSansLimbu-Regular.ttf"

# Lisu
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansLisu-Regular.ttf \
    "${NOTO_BASE}/NotoSansLisu/NotoSansLisu-Regular.ttf"

# Mandaic
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansMandaic-Regular.ttf \
    "${NOTO_BASE}/NotoSansMandaic/NotoSansMandaic-Regular.ttf"

# Meetei Mayek
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansMeeteiMayek-Regular.ttf \
    "${NOTO_BASE}/NotoSansMeeteiMayek/NotoSansMeeteiMayek-Regular.ttf"

# New Tai Lue
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansNewTaiLue-Regular.ttf \
    "${NOTO_BASE}/NotoSansNewTaiLue/NotoSansNewTaiLue-Regular.ttf"

# NKo
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansNKo-Regular.ttf \
    "${NOTO_BASE}/NotoSansNKo/NotoSansNKo-Regular.ttf"

# Ol Chiki
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansOlChiki-Regular.ttf \
    "${NOTO_BASE}/NotoSansOlChiki/NotoSansOlChiki-Regular.ttf"

# Old Italic - used for "cool" names
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansOldItalic-Regular.ttf \
    "${NOTO_BASE}/NotoSansOldItalic/NotoSansOldItalic-Regular.ttf"

# Old South Arabian
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansOldSouthArabian-Regular.ttf \
    "${NOTO_BASE}/NotoSansOldSouthArabian/NotoSansOldSouthArabian-Regular.ttf"

# Osmanya
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansOsmanya-Regular.ttf \
    "${NOTO_BASE}/NotoSansOsmanya/NotoSansOsmanya-Regular.ttf"

# Pahawh Hmong
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansPahawhHmong-Regular.ttf \
    "${NOTO_BASE}/NotoSansPahawhHmong/NotoSansPahawhHmong-Regular.ttf"

# Rejang
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansRejang-Regular.ttf \
    "${NOTO_BASE}/NotoSansRejang/NotoSansRejang-Regular.ttf"

# Samaritan
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansSamaritan-Regular.ttf \
    "${NOTO_BASE}/NotoSansSamaritan/NotoSansSamaritan-Regular.ttf"

# Saurashtra
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansSaurashtra-Regular.ttf \
    "${NOTO_BASE}/NotoSansSaurashtra/NotoSansSaurashtra-Regular.ttf"

# Shavian - Shaw alphabet
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansShavian-Regular.ttf \
    "${NOTO_BASE}/NotoSansShavian/NotoSansShavian-Regular.ttf"

# Syloti Nagri
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansSylotiNagri-Regular.ttf \
    "${NOTO_BASE}/NotoSansSylotiNagri/NotoSansSylotiNagri-Regular.ttf"

# Tagalog
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansTagalog-Regular.ttf \
    "${NOTO_BASE}/NotoSansTagalog/NotoSansTagalog-Regular.ttf"

# Tagbanwa
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansTagbanwa-Regular.ttf \
    "${NOTO_BASE}/NotoSansTagbanwa/NotoSansTagbanwa-Regular.ttf"

# Tai Le
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansTaiLe-Regular.ttf \
    "${NOTO_BASE}/NotoSansTaiLe/NotoSansTaiLe-Regular.ttf"

# Tai Tham
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansTaiTham-Regular.ttf \
    "${NOTO_BASE}/NotoSansTaiTham/NotoSansTaiTham-Regular.ttf"

# Tai Viet
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansTaiViet-Regular.ttf \
    "${NOTO_BASE}/NotoSansTaiViet/NotoSansTaiViet-Regular.ttf"

# Thaana
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansThaana-Regular.ttf \
    "${NOTO_BASE}/NotoSansThaana/NotoSansThaana-Regular.ttf"

# Tibetan
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSerifTibetan-Regular.ttf \
    "${NOTO_BASE}/NotoSerifTibetan/NotoSerifTibetan-Regular.ttf"

# Ugaritic
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansUgaritic-Regular.ttf \
    "${NOTO_BASE}/NotoSansUgaritic/NotoSansUgaritic-Regular.ttf"

# Yi
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansYi-Regular.ttf \
    "${NOTO_BASE}/NotoSansYi/NotoSansYi-Regular.ttf"

# Adlam
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansAdlam-Regular.ttf \
    "${NOTO_BASE}/NotoSansAdlam/NotoSansAdlam-Regular.ttf"

# Chakma
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansChakma-Regular.ttf \
    "${NOTO_BASE}/NotoSansChakma/NotoSansChakma-Regular.ttf"

# Miao
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansMiao-Regular.ttf \
    "${NOTO_BASE}/NotoSansMiao/NotoSansMiao-Regular.ttf"

# SignWriting
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansSignWriting-Regular.ttf \
    "${NOTO_BASE}/NotoSansSignWriting/NotoSansSignWriting-Regular.ttf"

# Traditional Nushu
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoTraditionalNushu-Regular.ttf \
    "${NOTO_BASE}/NotoTraditionalNushu/NotoTraditionalNushu-Regular.ttf"

# Wancho
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansWancho-Regular.ttf \
    "${NOTO_BASE}/NotoSansWancho/NotoSansWancho-Regular.ttf"

# Zanabazar Square
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansZanabazarSquare-Regular.ttf \
    "${NOTO_BASE}/NotoSansZanabazarSquare/NotoSansZanabazarSquare-Regular.ttf"

# Masaram Gondi
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansMasaramGondi-Regular.ttf \
    "${NOTO_BASE}/NotoSansMasaramGondi/NotoSansMasaramGondi-Regular.ttf"

# Soyombo
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansSoyombo-Regular.ttf \
    "${NOTO_BASE}/NotoSansSoyombo/NotoSansSoyombo-Regular.ttf"

# Marchen
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansMarchen-Regular.ttf \
    "${NOTO_BASE}/NotoSansMarchen/NotoSansMarchen-Regular.ttf"

# Newa
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansNewa-Regular.ttf \
    "${NOTO_BASE}/NotoSansNewa/NotoSansNewa-Regular.ttf"

# Osage
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSansOsage-Regular.ttf \
    "${NOTO_BASE}/NotoSansOsage/NotoSansOsage-Regular.ttf"

# Tangut
RUN wget -q -O /usr/share/fonts/truetype/noto-manual/NotoSerifTangut-Regular.ttf \
    "${NOTO_BASE}/NotoSerifTangut/NotoSerifTangut-Regular.ttf"

# ── Rebuild font cache ────────────────────────────────────────────────────────
RUN fc-cache -fv && \
    echo "✅ Font cache rebuilt" && \
    fc-list | wc -l | xargs echo "Total system fonts:"

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
RUN git clone https://github.com/AlexaInc/quotlyliteapi.git .

RUN npm install --legacy-peer-deps && \
    npm rebuild sharp canvas

ENV PORT=7860
EXPOSE 7860
CMD ["node", "app.js"]
