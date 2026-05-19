require('dotenv').config();
const express    = require('express');
const path       = require('path');
const fs         = require('fs');
const bodyParser = require('body-parser');

// Lazy-load createImage to not block startup
let createImage = null;
const getCreateImage = () => {
    if (!createImage) {
        createImage = require('./generatequote2');
    }
    return createImage;
};

const app  = express();
// HuggingFace Spaces sets PORT env variable - must use it!
const port = parseInt(process.env.PORT, 10) || 7860;

console.log(`[STARTUP] Using port: ${port} (from env: ${process.env.PORT || 'not set'})`);

// ── Password for the update endpoint (read from env) ─────────────────────────
// If UPDATE_PASSWORD is not set, the update endpoint is DISABLED for safety
const UPDATE_PASSWORD = process.env.UPDATE_PASSWORD || '';
if (!UPDATE_PASSWORD) {
    console.warn('⚠️  UPDATE_PASSWORD not set in env — /api/update endpoint is DISABLED');
} else {
    console.log('🔐 Update endpoint password protection: ENABLED');
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// ── Health check endpoint (HuggingFace Spaces checks this) ────────────────────
app.get('/health', (req, res) => {
    console.log(`[${new Date().toISOString()}] Health check hit`);
    res.status(200).send('OK');
});

// ── Root endpoint - respond immediately ───────────────────────────────────────
app.get('/', (req, res) => {
    console.log(`[${new Date().toISOString()}] Root endpoint hit`);
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        // Fallback if index.html doesn't exist
        res.status(200).send(`
            <!DOCTYPE html>
            <html>
            <head><title>Quotly Lite API</title></head>
            <body style="font-family: sans-serif; padding: 40px; background: #1a1a2e; color: #fff;">
                <h1>🚀 Quotly Lite API is running!</h1>
                <p>POST to <code>/api/generate</code> to create quote images.</p>
                <p>Server time: ${new Date().toISOString()}</p>
            </body>
            </html>
        `);
    }
});

// ── Generate sticker endpoint ─────────────────────────────────────────────────
app.post('/api/generate', async (req, res) => {
    console.log(`[${new Date().toISOString()}] Generate request received`);
    try {
        const createImageFn = getCreateImage();
        const { messages, emojiProvider } = req.body;

        // Default to 'apple' (iPhone) if no provider specified
        const provider = emojiProvider || req.body.emojiProvider || 'apple';

        let msgList;
        if (Array.isArray(messages)) {
            msgList = messages.map(m => {
                const item = { ...m };
                if (m.avatarBase64) item.inputImageBuffer = Buffer.from(m.avatarBase64.split(',')[1], 'base64');
                if (m.mediaBase64)  item.mediaBuffer      = Buffer.from(m.mediaBase64.split(',')[1], 'base64');
                if (!item.emojiProvider) item.emojiProvider = provider;
                return item;
            });
        } else {
            msgList = [{
                firstName:        req.body.firstName || 'User',
                lastName:         req.body.lastName || '',
                customemojiid:    req.body.customEmojiId || null,
                message:          req.body.message || '',
                nameColorId:      req.body.nameColorId || 0,
                inputImageBuffer: req.body.avatarBase64 ? Buffer.from(req.body.avatarBase64.split(',')[1], 'base64') : null,
                mediaBuffer:      req.body.mediaBase64  ? Buffer.from(req.body.mediaBase64.split(',')[1], 'base64')  : null,
                replySender:      req.body.replySender || null,
                replyMessage:     req.body.replyMessage || null,
                replysendercolor: req.body.replySenderColor || 0,
                entities:         req.body.entities || [],
                emojiProvider:    provider,
                id:               '1',
                isAbsoluteLast:   true
            }];
        }

        const buffer = await createImageFn(msgList);

        res.set('Content-Type', 'image/webp');
        res.send(buffer);
    } catch (err) {
        console.error('❌ Error generating image:', err);
        res.status(500).json({ error: 'Failed to generate quote image', details: err.message });
    }
});

// ── Helper: constant-time string comparison (prevents timing attacks) ─────────
function safeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    let mismatch = 0;
    for (let i = 0; i < a.length; i++) {
        mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return mismatch === 0;
}

// ── Password-protected update endpoint ────────────────────────────────────────
app.post('/api/update', (req, res) => {
    const { exec } = require('child_process');

    // 1. If no password is configured in env, deny all updates
    if (!UPDATE_PASSWORD) {
        console.warn('⚠️  Update attempt blocked — UPDATE_PASSWORD not configured');
        return res.status(503).json({
            error: 'Update endpoint disabled',
            details: 'Server administrator must set UPDATE_PASSWORD env variable'
        });
    }

    // 2. Get password from either body or Authorization header
    const headerPwd = (req.headers['x-update-password'] || '').toString();
    const bodyPwd   = (req.body && req.body.password) ? req.body.password.toString() : '';
    const submittedPassword = bodyPwd || headerPwd;

    // 3. Reject if no password supplied
    if (!submittedPassword) {
        console.warn('🚫 Update attempt without password from IP:', req.ip);
        return res.status(401).json({
            error: 'Password required',
            details: 'Provide password in request body as "password" or X-Update-Password header'
        });
    }

    // 4. Validate password using constant-time comparison
    if (!safeCompare(submittedPassword, UPDATE_PASSWORD)) {
        console.warn('🚫 Update attempt with WRONG password from IP:', req.ip);
        // Small artificial delay to slow down brute force attempts
        return setTimeout(() => {
            res.status(403).json({ error: 'Invalid password' });
        }, 1500);
    }

    // 5. Password is correct — proceed with git pull
    console.log('🔄 Authorized update request from IP:', req.ip);

    exec('git pull', (err, stdout, stderr) => {
        if (err) {
            console.error('❌ Git pull failed:', err);
            return res.status(500).json({ error: 'Update failed', details: err.message });
        }
        console.log('✅ Git pull success:', stdout);
        res.json({ message: 'Update success. Restarting...', output: stdout });

        setTimeout(() => {
            console.log('⚙️  Restarting process now!');
            process.exit(0);
        }, 1000);
    });
});

// ── Start server ──────────────────────────────────────────────────────────────
// Bind to 0.0.0.0 so HuggingFace Spaces (and Docker) can access it externally
const server = app.listen(port, '0.0.0.0', () => {
    console.log(`\n🚀 Premium Quoter UI: http://0.0.0.0:${port}`);
    console.log(`ℹ️  Hugging Face Space is now active.`);
    console.log(`[READY] Server accepting connections on port ${port}\n`);
});

server.on('error', (err) => {
    console.error('❌ Server error:', err);
    process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    server.close(() => process.exit(0));
});
