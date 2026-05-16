// =============================================================================
// MTProto Premium Emoji Fetcher
// 
// Connects DIRECTLY to Telegram's data centers via MTProto protocol.
// This bypasses the Bot API entirely and works for ANY premium emoji,
// even ones that Bot API can't fetch.
//
// Uses bot token authentication — no user account required.
// =============================================================================

const { TelegramClient } = require('telegram');
const { StringSession }  = require('telegram/sessions');
const { Api }            = require('telegram');
const fs                 = require('fs');
const path               = require('path');

const API_ID    = parseInt(process.env.TG_API_ID || '0', 10);
const API_HASH  = process.env.TG_API_HASH || '';
const BOT_TOKEN = process.env.BOT_TOKEN;

// Session storage — save to disk so we don't re-login on restart
const SESSION_FILE = path.join(__dirname, '.mtproto_session');

function loadSession() {
    // 1. Prefer env variable (production/HF deploys)
    if (process.env.TG_SESSION) return process.env.TG_SESSION;
    // 2. Fall back to disk file (local dev)
    if (fs.existsSync(SESSION_FILE)) {
        try { return fs.readFileSync(SESSION_FILE, 'utf-8').trim(); }
        catch { return ''; }
    }
    return '';
}

function saveSession(sessionStr) {
    try {
        fs.writeFileSync(SESSION_FILE, sessionStr, 'utf-8');
        console.log(`💾 MTProto session saved to ${SESSION_FILE}`);
        console.log(`   Set TG_SESSION env var to: ${sessionStr.substring(0, 30)}...`);
    } catch (e) {
        console.warn(`⚠️  Could not save MTProto session: ${e.message}`);
    }
}

let client = null;
let connecting = null;

async function getClient() {
    if (client && client.connected) return client;
    if (connecting) return connecting;

    connecting = (async () => {
        if (!API_ID || !API_HASH || !BOT_TOKEN) {
            throw new Error('MTProto disabled: missing TG_API_ID, TG_API_HASH, or BOT_TOKEN');
        }

        const sessionStr = loadSession();
        const stringSession = new StringSession(sessionStr);

        console.log('🔌 Connecting to Telegram MTProto...');

        const c = new TelegramClient(stringSession, API_ID, API_HASH, {
            connectionRetries: 3,
            useWSS: true,           // websocket (works behind firewalls)
            requestRetries: 2,
            timeout: 15,
            autoReconnect: true,
            // Silence the verbose console output
            baseLogger: {
                debug: () => {}, info: () => {},
                warn:  (msg) => console.log(`  [MTProto] ${msg}`),
                error: (msg) => console.log(`  [MTProto] ❌ ${msg}`),
            },
        });

        // ── Authenticate as BOT (no SMS, no user account needed) ──────────────
        await c.start({
            botAuthToken: BOT_TOKEN,
            onError: (err) => {
                console.error(`❌ MTProto auth error: ${err.message}`);
            },
        });

        // Save session for next time
        const newSessionStr = c.session.save();
        if (newSessionStr && newSessionStr !== sessionStr) {
            saveSession(newSessionStr);
        }

        console.log('✅ MTProto connected as bot');
        client = c;
        connecting = null;
        return c;
    })();

    return connecting;
}

// =============================================================================
// FETCH PREMIUM EMOJI FILE — direct from Telegram DC
// =============================================================================

async function fetchCustomEmojiDocuments(ids) {
    const c = await getClient();

    // Convert IDs to BigInt — required by gramjs
    const documentIds = ids.map(id => {
        try { return BigInt(String(id).trim()); }
        catch { return null; }
    }).filter(Boolean);

    if (documentIds.length === 0) return [];

    // ── API call: messages.getCustomEmojiDocuments ────────────────────────────
    // This is the EXACT same API call Telegram clients use internally
    // Returns Document objects we can download directly
    const result = await c.invoke(
        new Api.messages.GetCustomEmojiDocuments({
            documentId: documentIds,
        })
    );

    // result is an array of Document objects (or null entries for missing IDs)
    return result || [];
}

// Download a Document's binary data and return as Buffer
async function downloadDocument(c, document) {
    if (!document) return null;
    try {
        const buf = await c.downloadMedia(document, {
            // Get the best-quality static representation
            // (premium emojis are usually animated, we want the static thumb)
            thumb: 0,
        });
        return buf;
    } catch (e) {
        // Try without thumb (for static emojis)
        try {
            return await c.downloadMedia(document);
        } catch {
            return null;
        }
    }
}

// =============================================================================
// MAIN EXPORT: batch fetch many emoji IDs, return Map<id, Buffer>
// =============================================================================

async function fetchPremiumEmojis(ids) {
    const result = new Map();
    if (!Array.isArray(ids) || ids.length === 0) return result;

    try {
        const c = await getClient();

        // Telegram supports up to 200 IDs per call
        const BATCH_SIZE = 200;
        for (let i = 0; i < ids.length; i += BATCH_SIZE) {
            const batch = ids.slice(i, i + BATCH_SIZE);
            const docs  = await fetchCustomEmojiDocuments(batch);

            // Download all documents in parallel
            await Promise.all(docs.map(async (doc, idx) => {
                if (!doc) return;
                const idStr = String(doc.id);
                try {
                    const buf = await downloadDocument(c, doc);
                    if (buf && buf.length > 100) {
                        result.set(idStr, buf);
                    }
                } catch (e) {
                    console.warn(`⚠️  MTProto download failed for ${idStr}: ${e.message}`);
                }
            }));
        }
    } catch (e) {
        console.error(`❌ MTProto fetch failed: ${e.message}`);
    }

    return result;
}

// Check if MTProto is available (credentials configured)
function isAvailable() {
    return !!(API_ID && API_HASH && BOT_TOKEN);
}

// Graceful shutdown
async function disconnect() {
    if (client && client.connected) {
        try { await client.disconnect(); }
        catch (_) {}
        client = null;
    }
}

process.on('SIGINT',  () => disconnect().then(() => process.exit(0)));
process.on('SIGTERM', () => disconnect().then(() => process.exit(0)));

module.exports = {
    fetchPremiumEmojis,
    isAvailable,
    getClient,
    disconnect,
};
