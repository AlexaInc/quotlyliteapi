require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const createImage = require('./generatequote2');

const app = express();
const port = process.env.PORT || 7860;

// Middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Serve static UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint to generate quote sticker
app.post('/api/generate', async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            customEmojiId,
            message,
            nameColorId,
            replySender,
            replyMessage,
            replySenderColor,
            entities
        } = req.body;

        // Process images if provided as base64
        let inputImageBuffer = null;
        if (req.body.avatarBase64) {
            inputImageBuffer = Buffer.from(req.body.avatarBase64.split(',')[1], 'base64');
        }

        const buffer = await createImage(
            firstName || 'User',
            lastName || '',
            customEmojiId || null,
            message || '',
            nameColorId || 0,
            inputImageBuffer,
            replySender || null,
            replyMessage || null,
            replySenderColor || 0,
            entities || []
        );

        res.set('Content-Type', 'image/webp');
        res.send(buffer);
    } catch (err) {
        console.error('❌ Error generating image:', err);
        res.status(500).json({ error: 'Failed to generate quote image', details: err.message });
    }
});

// Start server
app.listen(port, () => {
    console.log(`\n🚀 Premium Quoter UI: http://localhost:${port}`);
    console.log(`ℹ️ Hugging Face Space is now active.\n`);
});
