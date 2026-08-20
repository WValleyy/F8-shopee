import express from 'express';

import wishlistApiController from '../../../controllers/api/user/wishlist.controller.js';
import { requireLightApiAuth } from '../../../middlewares/auth.middleware.js';
import { validateObjectIdParam } from '../../../middlewares/validation.middleware.js';

const router = express.Router();

// Intentional light-auth policy: engagement mutations remain available until
// a valid access token expires, even after its session is revoked.
router.use(requireLightApiAuth);

router.put(
    '/:productId',
    validateObjectIdParam('productId', 'Product ID'),
    wishlistApiController.add,
);

router.delete(
    '/:productId',
    validateObjectIdParam('productId', 'Product ID'),
    wishlistApiController.remove,
);

export default router;
