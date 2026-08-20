import assert from 'node:assert/strict';
import {
    afterEach,
    describe,
    it,
} from 'vitest';

import express from 'express';

import {
    uploadProductImages,
    uploadReviewImages,
} from '../../../middlewares/image-upload.middleware.js';

const servers = [];
const PNG_FIXTURE = Uint8Array.from(Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
));

async function startUploadServer(middleware) {
    const app = express();

    app.post('/upload', middleware, (req, res) => {
        res.json({
            files: req.files.map(file => ({
                mimetype: file.mimetype,
                size: file.size,
            })),
        });
    });
    app.use((error, req, res, next) => {
        res.status(error.statusCode || 400).json({
            code: error.code,
            message: error.message,
        });
    });

    const server = await new Promise((resolve) => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    servers.push(server);
    const address = server.address();

    return `http://127.0.0.1:${address.port}/upload`;
}

function appendImage(formData, size, name, fieldName = 'images') {
    const bytes = new Uint8Array(size);
    bytes.set(PNG_FIXTURE.subarray(0, Math.min(size, PNG_FIXTURE.length)));

    formData.append(
        fieldName,
        new Blob([bytes], { type: 'image/png' }),
        name,
    );
}

afterEach(async () => {
    await Promise.all(
        servers.splice(0).map(server => new Promise((resolve, reject) => {
            server.close(error => (error ? reject(error) : resolve()));
        })),
    );
});

// Image upload middleware enforces file and request boundaries.
describe('image upload middleware', () => {
    it('accepts three review images within the configured limits', async () => {
        const url = await startUploadServer(uploadReviewImages);
        const formData = new FormData();

        appendImage(formData, 128, 'one.png');
        appendImage(formData, 256, 'two.png');
        appendImage(formData, 512, 'three.png');

        const response = await fetch(url, {
            method: 'POST',
            body: formData,
        });
        const payload = await response.json();

        assert.equal(response.status, 200);
        assert.deepEqual(
            payload.files.map(file => file.size),
            [128, 256, 512],
        );
    });

    it('rejects a product image batch above the total byte limit', async () => {
        const url = await startUploadServer(uploadProductImages);
        const formData = new FormData();

        for (let index = 0; index < 6; index += 1)
            appendImage(
                formData,
                800 * 1024,
                `${index}.png`,
                'productImages',
            );

        const response = await fetch(url, {
            method: 'POST',
            body: formData,
        });
        const payload = await response.json();

        assert.equal(response.status, 413);
        assert.equal(payload.code, 'TOTAL_IMAGE_SIZE_EXCEEDED');
        assert.equal(
            payload.message,
            'Tổng dung lượng ảnh không được vượt quá 4 MB.',
        );
    });
});
