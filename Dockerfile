FROM node:18

# Install system dependencies for Canvas, Puppeteer and Git
RUN apt-get update && apt-get install -y \
    git \
    libcairo2-dev \
    libjpeg-dev \
    libpango1.0-dev \
    libgif-dev \
    build-essential \
    g++ \
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
    wget \
    unzip \
    fontconfig \
    fonts-noto \
    fonts-noto-cjk \
    fonts-noto-cjk-extra \
    fonts-noto-color-emoji \
    fonts-noto-ui-core \
    fonts-noto-extra \
    fonts-noto-ui-extra \
    chromium \
    python3 \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# ── Download the Noto fonts that apt does NOT package ──────────────────────────
# These cover: Symbols, Symbols2, Math, Music, and rare historic scripts
RUN mkdir -p /usr/share/fonts/truetype/noto-extra

# Noto Sans Symbols (technical symbols, arrows, box-drawing, etc.)
RUN wget -q -O /usr/share/fonts/truetype/noto-extra/NotoSansSymbols-Regular.ttf \
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansSymbols/NotoSansSymbols-Regular.ttf"

# Noto Sans Symbols 2 (more symbols, rare scripts fallback)
RUN wget -q -O /usr/share/fonts/truetype/noto-extra/NotoSansSymbols2-Regular.ttf \
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansSymbols2/NotoSansSymbols2-Regular.ttf"

# Noto Sans Math
RUN wget -q -O /usr/share/fonts/truetype/noto-extra/NotoSansMath-Regular.ttf \
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansMath/NotoSansMath-Regular.ttf"

# Noto Music
RUN wget -q -O /usr/share/fonts/truetype/noto-extra/NotoMusic-Regular.ttf \
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoMusic/NotoMusic-Regular.ttf"

# Noto Sans Arabic
RUN wget -q -O /usr/share/fonts/truetype/noto-extra/NotoSansArabic-Regular.ttf \
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansArabic/NotoSansArabic-Regular.ttf"

# Noto Sans Devanagari (Hindi, Sanskrit, etc.)
RUN wget -q -O /usr/share/fonts/truetype/noto-extra/NotoSansDevanagari-Regular.ttf \
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf"

# Noto Sans Thai
RUN wget -q -O /usr/share/fonts/truetype/noto-extra/NotoSansThai-Regular.ttf \
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansThai/NotoSansThai-Regular.ttf"

# Noto Sans Hebrew
RUN wget -q -O /usr/share/fonts/truetype/noto-extra/NotoSansHebrew-Regular.ttf \
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansHebrew/NotoSansHebrew-Regular.ttf"

# Noto Sans Bengali
RUN wget -q -O /usr/share/fonts/truetype/noto-extra/NotoSansBengali-Regular.ttf \
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansBengali/NotoSansBengali-Regular.ttf"

# Noto Sans Tamil
RUN wget -q -O /usr/share/fonts/truetype/noto-extra/NotoSansTamil-Regular.ttf \
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansTamil/NotoSansTamil-Regular.ttf"

# Noto Sans Telugu
RUN wget -q -O /usr/share/fonts/truetype/noto-extra/NotoSansTelugu-Regular.ttf \
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansTelugu/NotoSansTelugu-Regular.ttf"

# Noto Sans Kannada
RUN wget -q -O /usr/share/fonts/truetype/noto-extra/NotoSansKannada-Regular.ttf \
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansKannada/NotoSansKannada-Regular.ttf"

# Noto Sans Malayalam
RUN wget -q -O /usr/share/fonts/truetype/noto-extra/NotoSansMalayalam-Regular.ttf \
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansMalayalam/NotoSansMalayalam-Regular.ttf"

# Noto Sans Georgian
RUN wget -q -O /usr/share/fonts/truetype/noto-extra/NotoSansGeorgian-Regular.ttf \
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansGeorgian/NotoSansGeorgian-Regular.ttf"

# Noto Sans Armenian
RUN wget -q -O /usr/share/fonts/truetype/noto-extra/NotoSansArmenian-Regular.ttf \
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansArmenian/NotoSansArmenian-Regular.ttf"

# Noto Sans Ethiopic
RUN wget -q -O /usr/share/fonts/truetype/noto-extra/NotoSansEthiopic-Regular.ttf \
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansEthiopic/NotoSansEthiopic-Regular.ttf"

# Noto Sans Khmer
RUN wget -q -O /usr/share/fonts/truetype/noto-extra/NotoSansKhmer-Regular.ttf \
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansKhmer/NotoSansKhmer-Regular.ttf"

# Noto Sans Myanmar
RUN wget -q -O /usr/share/fonts/truetype/noto-extra/NotoSansMyanmar-Regular.ttf \
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansMyanmar/NotoSansMyanmar-Regular.ttf"

# Noto Sans Mongolian
RUN wget -q -O /usr/share/fonts/truetype/noto-extra/NotoSansMongolian-Regular.ttf \
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansMongolian/NotoSansMongolian-Regular.ttf"

# Noto Sans Sinhala
RUN wget -q -O /usr/share/fonts/truetype/noto-extra/NotoSansSinhala-Regular.ttf \
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansSinhala/NotoSansSinhala-Regular.ttf"

# Noto Sans Lao
RUN wget -q -O /usr/share/fonts/truetype/noto-extra/NotoSansLao-Regular.ttf \
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansLao/NotoSansLao-Regular.ttf"

# Noto Sans Tibetan
RUN wget -q -O /usr/share/fonts/truetype/noto-extra/NotoSerifTibetan-Regular.ttf \
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSerifTibetan/NotoSerifTibetan-Regular.ttf"

# Noto Sans Duployan (covers rare shorthand characters like the one in your example)
RUN wget -q -O /usr/share/fonts/truetype/noto-extra/NotoSansDuployan-Regular.ttf \
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansDuployan/NotoSansDuployan-Regular.ttf"

# Noto Sans Balinese
RUN wget -q -O /usr/share/fonts/truetype/noto-extra/NotoSansBalinese-Regular.ttf \
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansBalinese/NotoSansBalinese-Regular.ttf"

# Noto Sans Javanese
RUN wget -q -O /usr/share/fonts/truetype/noto-extra/NotoSansJavanese-Regular.ttf \
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansJavanese/NotoSansJavanese-Regular.ttf"

# Noto Sans Sundanese
RUN wget -q -O /usr/share/fonts/truetype/noto-extra/NotoSansSundanese-Regular.ttf \
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansSundanese/NotoSansSundanese-Regular.ttf"

# Noto Traditional Nushu (very rare Unicode block)
RUN wget -q -O /usr/share/fonts/truetype/noto-extra/NotoTraditionalNushu-Regular.ttf \
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoTraditionalNushu/NotoTraditionalNushu-Regular.ttf"

# Noto Sans SignWriting
RUN wget -q -O /usr/share/fonts/truetype/noto-extra/NotoSansSignWriting-Regular.ttf \
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansSignWriting/NotoSansSignWriting-Regular.ttf"

# ── Rebuild the system font cache so apps can find all fonts ──────────────────
RUN fc-cache -fv

# Set environment variable for Puppeteer to use the pre-installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Set working directory
WORKDIR /app

# Clone the repository
RUN git clone https://github.com/AlexaInc/quotlyliteapi.git .

# Install dependencies with legacy peer deps and rebuild native modules
RUN npm install --legacy-peer-deps && \
    npm rebuild sharp canvas

ENV PORT=7860
EXPOSE 7860

CMD ["node", "app.js"]
