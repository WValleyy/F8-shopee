import assert from 'node:assert/strict';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    cleanupUploadedImages,
    createPendingCloudinaryImage,
    cleanupUploadedImage,
    uploadCloudinaryImage,
} from '../../../services/image/cloudinary-image.service.js';

vi.mock('../../../services/image/cloudinary-client.js', () => ({
    default: {
        url: vi.fn(publicId => `https://res.cloudinary.com/test/image/upload/${publicId}`),
        uploader: {
            destroy: vi.fn(),
            upload_stream: vi.fn(),
        },
    },
}));

vi.mock('../../../utils/error/app-error-logger.js', () => ({
    logAppEvent: vi.fn().mockResolvedValue(undefined),
}));

import cloudinary from '../../../services/image/cloudinary-client.js';
import { logAppEvent } from '../../../utils/error/app-error-logger.js';

// Cloudinary image helpers isolate upload and cleanup side effects.
describe('cloudinary-image.service boundary unit tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates pending metadata with a generated publicId before upload', () => {
        const source = {
            buffer: Buffer.from('fake-image-content'),
            mimetype: 'image/png',
        };
        const pendingImage = createPendingCloudinaryImage(source, {
            folder: 'f8-shopee/products/product-id',
        });

        expect(pendingImage.source).toBe(source);
        expect(pendingImage.publicId).toMatch(
            /^f8-shopee\/products\/product-id\/[0-9a-f-]{36}$/,
        );
        expect(pendingImage.url).toBe(
            `https://res.cloudinary.com/test/image/upload/${pendingImage.publicId}`,
        );
    });

    it('uploads with the publicId prepared by the application', async () => {
        let receivedOptions;
        cloudinary.uploader.upload_stream.mockImplementation((options, callback) => {
            receivedOptions = options;
            callback(null, {
                secure_url: 'https://example.com/product-image.jpg',
                public_id: options.public_id,
                width: 100,
                height: 100,
                format: 'jpg',
                bytes: 100,
            });
            return { end: vi.fn() };
        });

        await uploadCloudinaryImage(
            {
                buffer: Buffer.from('fake-image-content'),
                mimetype: 'image/jpeg',
            },
            { publicId: 'f8-shopee/products/product-id/image-id' },
        );

        expect(receivedOptions).toMatchObject({
            public_id: 'f8-shopee/products/product-id/image-id',
            overwrite: false,
            unique_filename: false,
            resource_type: 'image',
        });
    });

    it('handles cleanup failures without rejecting', async () => {
        const publicId = 'valid/asset';
        cloudinary.uploader.destroy.mockRejectedValueOnce(new Error('Cloudinary API error'));

        await expect(cleanupUploadedImage(publicId, 'unit-test-scope')).resolves.toBeUndefined();
        expect(logAppEvent).toHaveBeenCalledWith(
            'unit-test-scope',
            'warning',
            {
                publicId,
                error: 'Cloudinary API error',
            },
        );
    });

    it('cleanupUploadedImages handles individual destroy rejections without throwing', async () => {
        cloudinary.uploader.destroy
            .mockResolvedValueOnce({ result: 'ok' })
            .mockRejectedValueOnce(new Error('Cloudinary API error'));

        const assets = [
            { publicId: 'valid/asset1', url: 'https://example.com/1.png' },
            { publicId: 'valid/asset2', url: 'https://example.com/2.png' },
        ];

        // Should resolve cleanly despite second asset failing destroy
        await expect(cleanupUploadedImages(assets, 'unit-test-scope')).resolves.toBeUndefined();
        expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(2);
        expect(logAppEvent).toHaveBeenCalledWith(
            'unit-test-scope',
            'warning',
            {
                publicId: 'valid/asset2',
                error: 'Cloudinary API error',
            },
        );
    });
});
