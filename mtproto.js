// =============================================================================
// MTProto Premium Emoji Fetcher
// 
// Connects DIRECTLY to Telegram's data centers via MTProto protocol.
// Handles animated (.tgs, .webm) emojis by extracting their static thumbnail,
// which is what we need for image rendering.
// =============================================================================

const { TelegramClient, Api } = require('telegram');
const { StringSession }       = require('telegram/sessions');
const fs                      = require('fs');
const path                    = require('path');

const API_ID    = parseInt(process.env.API_ID || '0', 10);
const API_HASH  = process.env.API_HASH || '';
const BOT_TOKEN = process.env.BOT_TOKEN;

const SESSION_FILE = path.join(__dirname, '.mtproto_session');

function loadSession() {
    if (process.env.TG_SESSION) return process.env.TG_SESSION;
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
            connectionRetries: 5,
            useWSS: true,
            requestRetries: 2,
            timeout: 15,
            autoReconnect: true,
            baseLogger: {
                debug: () => {}, info: () => {},
                warn:  (msg) => console.log(`  [MTProto] ${msg}`),
                error: (msg) => console.log(`  [MTProto] ❌ ${msg}`),
            },
        });

        // Start as bot — no SMS, no user account
        await c.start({
            botAuthToken: BOT_TOKEN,
            onError: (err) => {
                console.error(`❌ MTProto auth error: ${err.message}`);
            },
        });

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
// Download ONE emoji document — handles animated/static automatically
// 
// Returns: { buffer, mimeType, isStaticThumb } or null

// ... existing code ...
async function downloadEmojiDocument(c, doc) {
    if (!doc || doc.className === 'DocumentEmpty' || !doc.id) return null;

    try {
        let mediaToDownload = doc; 
        let isStaticThumb   = false;
        let resolvedMime    = doc.mimeType;

        const isAnimated =
            doc.mimeType === 'application/x-tgsticker' ||
            doc.mimeType === 'video/webm' ||
            doc.mimeType === 'application/x-tgwallpattern';

        if (isAnimated && doc.thumbs && doc.thumbs.length > 0) {
            // Priority list for thumbnail types
            const priority = ['m', 's', 'a', 'b', 'v'];
            let staticThumb = null;
            
            for (const type of priority) {
                staticThumb = doc.thumbs.find(t => t.type === type && !(t instanceof Api.VideoSize));
                if (staticThumb) break;
            }

            if (staticThumb) {
                mediaToDownload = new Api.InputDocumentFileLocation({
                    id: BigInt(doc.id.toString()),
                    accessHash: BigInt(doc.accessHash.toString()),
                    fileReference: doc.fileReference,
                    thumbSize: staticThumb.type, 
                });
                isStaticThumb = true;
                resolvedMime  = 'image/jpeg';
            }
        }

        const buffer = await c.downloadMedia(mediaToDownload, { 
            workers: 1,
            timeout: 20 
        });

        if (!buffer || buffer.length < 10) return null;

        return {
            buffer,
            mimeType: resolvedMime,
            isStaticThumb,
            originalMime: doc.mimeType,
        };
    } catch (e) {
        console.warn(`   [MTProto] Download failed for ${doc.id}: ${e.message}`);
        return null;
    }
}
        }

        // Use a higher timeout for downloads
        const buffer = await c.downloadMedia(mediaToDownload, { 
            workers: 1,
            timeout: 20 // 20 seconds
        });

        if (!buffer || buffer.length < 10) return null;

        return {
            buffer,
            mimeType: resolvedMime,
            isStaticThumb,
            originalMime: doc.mimeType,
        };
// ... existing code ...

// =============================================================================
// MAIN BATCH FETCHER
// Returns Map<originalIdString, Buffer>
// =============================================================================
async function fetchPremiumEmojis(ids) {
    const result = new Map();
    if (!Array.isArray(ids) || ids.length === 0) return result;

    try {
        const c = await getClient();

        // ── Prepare ID list — gramjs accepts string IDs in the array ──────────
        // (no BigInt conversion needed — gramjs handles it internally)
        const documentIds = ids
            .map(id => String(id).trim())
            .filter(id => id && id !== 'null' && id !== 'undefined');

        if (documentIds.length === 0) return result;

        console.log(`   [MTProto] Requesting ${documentIds.length} document(s)...`);

        // ── Invoke the API ────────────────────────────────────────────────────
        let documents;
        try {
            documents = await c.invoke(
                new Api.messages.GetCustomEmojiDocuments({
                    documentId: documentIds,
                })
            );
        } catch (e) {
            console.error(`   [MTProto] API call failed: ${e.message}`);
            return result;
        }

        if (!documents || !Array.isArray(documents) || documents.length === 0) {
            console.warn(`   [MTProto] No emoji documents returned`);
            return result;
        }

        console.log(`   [MTProto] Got ${documents.length} document(s) in response`);

        // ── Process each document in parallel ─────────────────────────────────
        await Promise.all(documents.map(async (doc, idx) => {
            if (!doc) {
                console.warn(`   [MTProto] [${idx}] null document`);
                return;
            }

            if (doc.className === 'DocumentEmpty') {
                console.warn(`   [MTProto] [${idx}] DocumentEmpty for id ${doc.id}`);
                return;
            }

            // Match document back to original request ID
            // Use position-based matching as fallback if IDs don't match
            const docIdStr = doc.id ? doc.id.toString() : '';
            const originalId = documentIds.includes(docIdStr)
                ? docIdStr
                : (documentIds[idx] || docIdStr);

            const downloaded = await downloadEmojiDocument(c, doc);
            if (downloaded && downloaded.buffer) {
                result.set(originalId, downloaded.buffer);
                console.log(
                    `   [MTProto] ✅ ${originalId} ` +
                    `(${downloaded.buffer.length} bytes, ` +
                    `orig=${downloaded.originalMime}, ` +
                    `${downloaded.isStaticThumb ? 'thumb' : 'full'})`
                );
            } else {
                console.warn(`   [MTProto] ⚠️  Could not download ${originalId}`);
            }
        }));

    } catch (e) {
        console.error(`❌ MTProto batch fetch failed: ${e.message}`);
        console.error(e.stack);
    }

    return result;
}

function isAvailable() {
    return !!(API_ID && API_HASH && BOT_TOKEN);
}

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
