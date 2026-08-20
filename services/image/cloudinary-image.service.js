import crypto from 'node:crypto';

import cloudinary from './cloudinary-client.js';
import { logAppEvent } from '../../utils/error/app-error-logger.js';

function createPendingCloudinaryImage(source, { folder }) {
    const imageId = crypto.randomUUID();
    const publicId = `${folder}/${imageId}`;

    return {
        source,
        publicId,
        url: cloudinary.url(publicId, {
            secure: true,
            resource_type: 'image',
            type: 'upload',
        }),
    };
}

async function cleanupUploadedImage(publicId, scope) {
    try {
        await cloudinary.uploader.destroy(publicId, {
            invalidate: true,
            resource_type: 'image',
        });
    } catch (error) {
        // Accepted best-effort policy for rollback and post-commit cleanup:
        // a failed destroy may leave an orphaned asset, so log its public ID.
        await logAppEvent(scope, 'warning', {
            publicId,
            error: error?.message || String(error),
        }).catch(() => { });
    }
}

async function cleanupUploadedImages(images, scope) {
    await Promise.all(
        images.map(image => cleanupUploadedImage(image.publicId, scope)),
    );
}

async function uploadCloudinaryImage(source, options) {
    const {
        publicId,
        rollback,
    } = options;
    const uploadOptions = {
        resource_type: 'image',
        overwrite: false,
        unique_filename: false,
        public_id: publicId,
    };
    try {
        await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                uploadOptions,
                error => {
                    if (error)
                        reject(error);
                    else
                        resolve();
                },
            );

            stream.end(source.buffer);
        });
    } catch (error) {
        await logAppEvent('cloudinary-image-upload-failed', 'warning', {
            publicId,
            error: error?.message || String(error),
        }).catch(() => { });

        if (rollback)
            throw error;
    }
}

async function uploadCloudinaryImages(images, options) {
    const {
        rollback,
        cleanupScope,
    } = options;
    if (!rollback) {
        await Promise.all(
            images.map(image => uploadCloudinaryImage(image.source, {
                publicId: image.publicId,
                rollback: false,
            })),
        );

        return;
    }

    const rollbackCandidates = [];

    try {
        for (const image of images) {
            // A network failure can occur after Cloudinary creates this asset.
            rollbackCandidates.push(image);
            await uploadCloudinaryImage(image.source, {
                publicId: image.publicId,
                rollback: true,
            });
        }
    } catch (error) {
        await cleanupUploadedImages(
            rollbackCandidates,
            cleanupScope,
        );
        throw error;
    }
}

export {
    cleanupUploadedImage,
    cleanupUploadedImages,
    createPendingCloudinaryImage,
    uploadCloudinaryImage,
    uploadCloudinaryImages,
};
