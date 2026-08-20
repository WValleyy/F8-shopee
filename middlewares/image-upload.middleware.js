import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';

import inputLimits from '../config/input-limits.js';
import { uploadLimits } from '../config/upload-image.js';
import { requestError } from '../utils/error/app-error.js';

const ALLOWED_IMAGE_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
]);
const MULTI_UPLOAD_FIELD_LIMIT = 20;
const MULTI_UPLOAD_FIELD_SIZE_LIMIT = 256 * 1024;
const SINGLE_UPLOAD_FIELD_LIMIT = 10;
const SINGLE_UPLOAD_FIELD_SIZE_LIMIT = 32 * 1024;

function imageFileFilter(req, file, callback) {
    // MIME metadata is client-controlled. The buffer is validated after Multer
    // reads it, so this filter only allows the upload to reach that check.
    callback(null, true);
}

async function validateImageContent(files) {
    for (const file of files) {
        const detectedType = await fileTypeFromBuffer(file.buffer);

        if (
            !detectedType
            || !ALLOWED_IMAGE_MIME_TYPES.has(detectedType.mime)
            || detectedType.mime !== file.mimetype
        ) {
            throw requestError('IMAGE_TYPE_INVALID');
        }
    }
}

function createImageUploadMiddleware({
    maxFiles,
    maxFileBytes,
    maxTotalBytes,
}, fieldName = 'images') {
    const upload = multer({
        storage: multer.memoryStorage(),
        fileFilter: imageFileFilter,
        limits: {
            files: maxFiles,
            fileSize: maxFileBytes,
            fields: MULTI_UPLOAD_FIELD_LIMIT,
            fieldSize: MULTI_UPLOAD_FIELD_SIZE_LIMIT,
            parts: maxFiles + MULTI_UPLOAD_FIELD_LIMIT,
        },
    }).array(fieldName, maxFiles);

    return (req, res, next) => {
        upload(req, res, async (error) => {
            if (error) {
                next(error);
                return;
            }

            try {
                await validateImageContent(req.files || []);
            } catch (validationError) {
                next(validationError);
                return;
            }

            const totalBytes = (req.files || []).reduce(
                (total, file) => total + Number(file.size || 0),
                0,
            );

            if (totalBytes > maxTotalBytes) {
                next(requestError('TOTAL_IMAGE_SIZE_EXCEEDED', {
                    messageParams: {
                        limitMegabytes: Math.ceil(maxTotalBytes / (1024 * 1024)),
                    },
                }));
                return;
            }

            next();
        });
    };
}

function createSingleImageUploadMiddleware({
    maxFileBytes,
}, fieldName) {
    const upload = multer({
        storage: multer.memoryStorage(),
        fileFilter: imageFileFilter,
        limits: {
            files: 1,
            fileSize: maxFileBytes,
            fields: SINGLE_UPLOAD_FIELD_LIMIT,
            fieldSize: SINGLE_UPLOAD_FIELD_SIZE_LIMIT,
            parts: 1 + SINGLE_UPLOAD_FIELD_LIMIT,
        },
    }).single(fieldName);

    return (req, res, next) => {
        upload(req, res, async (error) => {
            if (error) {
                next(error);
                return;
            }

            try {
                await validateImageContent(req.file ? [req.file] : []);
            } catch (validationError) {
                next(validationError);
                return;
            }

            next();
        });
    };
}

function createFieldsImageUploadMiddleware({
    maxFileBytes,
    maxTotalBytes,
}, fields) {
    if (
        !Array.isArray(fields)
        || fields.some(field => !Number.isInteger(field?.maxCount) || field.maxCount < 1)
    ) {
        throw new Error('Image upload field maxCount must be a positive integer.');
    }

    const totalMaxFiles = fields.reduce((sum, field) => sum + field.maxCount, 0);

    const upload = multer({
        storage: multer.memoryStorage(),
        fileFilter: imageFileFilter,
        limits: {
            files: totalMaxFiles,
            fileSize: maxFileBytes,
            fields: MULTI_UPLOAD_FIELD_LIMIT,
            fieldSize: MULTI_UPLOAD_FIELD_SIZE_LIMIT,
            parts: totalMaxFiles + MULTI_UPLOAD_FIELD_LIMIT,
        },
    }).fields(fields);

    return (req, res, next) => {
        upload(req, res, async (error) => {
            if (error) {
                next(error);
                return;
            }

            const allFiles = Object.values(req.files || {}).flat();

            try {
                await validateImageContent(allFiles);
            } catch (validationError) {
                next(validationError);
                return;
            }

            const totalBytes = allFiles.reduce(
                (total, file) => total + Number(file.size || 0),
                0,
            );

            if (totalBytes > maxTotalBytes) {
                next(requestError('TOTAL_IMAGE_SIZE_EXCEEDED', {
                    messageParams: {
                        limitMegabytes: Math.ceil(maxTotalBytes / (1024 * 1024)),
                    },
                }));
                return;
            }

            next();
        });
    };
}

const uploadProductImages = createFieldsImageUploadMiddleware(
    uploadLimits.product,
    [
        { name: 'productImages', maxCount: uploadLimits.product.maxFiles },
        { name: 'variantImages', maxCount: inputLimits.adminProduct.maxVariants },
    ],
);
const uploadReviewImages = createImageUploadMiddleware(uploadLimits.review);
const uploadAvatarImage = createSingleImageUploadMiddleware({
    maxFileBytes: uploadLimits.avatar.maxFileBytes,
}, 'avatar');

export {
    uploadAvatarImage,
    uploadProductImages,
    uploadReviewImages,
};
