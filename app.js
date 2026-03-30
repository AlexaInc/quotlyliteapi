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

        // Normalize to array of messages and process base64 buffers
        let msgList;
        if (Array.isArray(messages)) {
            msgList = messages.map(m => {
                const item = { ...m };
                if (m.avatarBase64) item.inputImageBuffer = Buffer.from(m.avatarBase64.split(',')[1], 'base64');
                if (m.mediaBase64) item.mediaBuffer = Buffer.from(m.mediaBase64.split(',')[1], 'base64');
                return item;
            });
        } else {
            msgList = [{
                firstName: req.body.firstName || 'User',
                lastName: req.body.lastName || '',
                customemojiid: req.body.customEmojiId || null,
                message: req.body.message || '',
                nameColorId: req.body.nameColorId || 0,
                inputImageBuffer: req.body.avatarBase64 ? Buffer.from(req.body.avatarBase64.split(',')[1], 'base64') : null,
                mediaBuffer: req.body.mediaBase64 ? Buffer.from(req.body.mediaBase64.split(',')[1], 'base64') : null,
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

// Update endpoint
app.post('/api/update', (req, res) => {
    const { exec } = require('child_process');
    console.log('🔄 Update requested via Web UI...');

    exec('git pull', (err, stdout, stderr) => {
        if (err) {
            console.error('❌ Git pull failed:', err);
            return res.status(500).json({ error: 'Update failed', details: err.message });
        }
        console.log('✅ Git pull success:', stdout);
        res.json({ message: 'Update success. Restarting...', output: stdout });

        // Schedule restart
        setTimeout(() => {
            console.log('⚙️ Restarting process now!');
            process.exit(0);
        }, 1000);
    });
});

// Start server
app.listen(port, () => {
    console.log(`\n🚀 Premium Quoter UI: http://localhost:${port}`);
    console.log(`ℹ️ Hugging Face Space is now active.\n`);
});
