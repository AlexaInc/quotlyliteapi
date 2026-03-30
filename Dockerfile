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
    fonts-noto \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    fonts-noto-ui-core \
    chromium \
    python3 \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

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

# Ensure Puppeteer can find Chromium
ENV PORT=7860

# Expose port
EXPOSE 7860

# Start the Web Interface
CMD ["node", "app.js"]
