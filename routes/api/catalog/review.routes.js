import express from 'express';

import reviewApiController from '../../../controllers/api/catalog/review.controller.js';
import {
    requireLightApiAuth,
    requireStrictApiAuth,
} from '../../../middlewares/auth.middleware.js';
import { uploadReviewImages } from '../../../middlewares/image-upload.middleware.js';
import { validateObjectIdParam } from '../../../middlewares/validation.middleware.js';

const router = express.Router();

router.post(
    '/products/:productId',
    requireStrictApiAuth,
    validateObjectIdParam('productId', 'Product ID'),
    uploadReviewImages,
    reviewApiController.createProductReview,
);

// Helpful reactions are non-critical demo state. They intentionally use JWT-only
// auth and do not claim mutable User state during a revoke or purge race.
router.put(
    '/:id/helpful',
    requireLightApiAuth,
    validateObjectIdParam('id', 'Review ID'),
    reviewApiController.markHelpful,
);

router.delete(
    '/:id/helpful',
    requireLightApiAuth,
    validateObjectIdParam('id', 'Review ID'),
    reviewApiController.unmarkHelpful,
);

export default router;
