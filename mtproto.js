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
