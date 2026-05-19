/**
 * MTProto module for Telegram custom emoji downloading
 * Provides direct DC access for premium emoji stickers
 */

let Api;
let TelegramClient;
let StringSession;
let client = null;
let isReady = false;

// Try to load telegram library
try {
    const telegram = require('telegram');
    Api = telegram.Api;
    TelegramClient = telegram.TelegramClient;
    const sessions = require('telegram/sessions');
    StringSession = sessions.StringSession;
} catch (e) {
    // telegram library not available
}

const API_ID   = parseInt(process.env.TG_API_ID || '0', 10);
const API_HASH = process.env.TG_API_HASH || '';
const SESSION  = process.env.TG_SESSION || '';

/**
 * Check if MTProto is available and configured
 */
function isAvailable() {
    return !!(Api && TelegramClient && API_ID && API_HASH);
}

/**
 * Initialize the MTProto client (call once at startup)
 */
async function init() {
    if (!isAvailable()) return false;
    if (isReady && client) return true;

    try {
        const session = new StringSession(SESSION);
        client = new TelegramClient(session, API_ID, API_HASH, {
            connectionRetries: 3,
            timeout: 30,
        });
        await client.start({ botAuthToken: process.env.BOT_TOKEN });
        isReady = true;
        console.log('✅ MTProto client connected');
        return true;
    } catch (e) {
        console.warn(`⚠️  MTProto init failed: ${e.message}`);
        isReady = false;
        client = null;
        return false;
    }
}

/**
 * Get the active MTProto client
 */
function getClient() {
    return isReady ? client : null;
}

/**
 * Download a custom emoji document via MTProto
 * Falls back to static thumbnail for animated stickers
 */
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
    } catch (e) {
        console.warn(`   [MTProto] Download failed for ${doc.id}: ${e.message}`);
        return null;
    }
}

/**
 * Fetch custom emoji documents by their IDs
 * Returns a Map of emojiId -> document info
 */
async function getCustomEmojiDocuments(emojiIds) {
    if (!isReady || !client || !Api) return new Map();

    try {
        const result = await client.invoke(
            new Api.messages.GetCustomEmojiDocuments({
                documentId: emojiIds.map(id => BigInt(id)),
            })
        );

        const docs = new Map();
        if (result && Array.isArray(result)) {
            for (const doc of result) {
                if (doc && doc.id) {
                    const downloaded = await downloadEmojiDocument(client, doc);
                    if (downloaded) {
                        docs.set(doc.id.toString(), downloaded);
                    }
                }
            }
        }
        return docs;
    } catch (e) {
        console.warn(`[MTProto] getCustomEmojiDocuments failed: ${e.message}`);
        return new Map();
    }
}

module.exports = {
    isAvailable,
    init,
    getClient,
    downloadEmojiDocument,
    getCustomEmojiDocuments,
};
