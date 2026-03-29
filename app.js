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
        const { messages } = req.body;

        // Normalize to array of messages
        let msgList;
        if (Array.isArray(messages)) {
            msgList = messages;
        } else {
            msgList = [{
                firstName: req.body.firstName || 'User',
                lastName: req.body.lastName || '',
                customemojiid: req.body.customEmojiId || null,
                message: req.body.message || '',
                nameColorId: req.body.nameColorId || 0,
                inputImageBuffer: req.body.avatarBase64 ? Buffer.from(req.body.avatarBase64.split(',')[1], 'base64') : null,
                replySender: req.body.replySender || null,
                replyMessage: req.body.replyMessage || null,
                replysendercolor: req.body.replySenderColor || 0,
                entities: req.body.entities || [],
                id: '1',
                isAbsoluteLast: true
            }];
        }

        const buffer = await createImage(msgList);

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
