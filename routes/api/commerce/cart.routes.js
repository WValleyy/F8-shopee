import { Router } from 'express';

import cartApiController from '../../../controllers/api/commerce/cart.controller.js';
import {
    requireLightApiAuth,
} from '../../../middlewares/auth.middleware.js';
import {
    validateObjectIdBody,
    validateObjectIdParam,
} from '../../../middlewares/validation.middleware.js';

const router = Router();

// Intentional light-auth policy: cart mutations remain available until a valid
// access token expires after session revocation. Checkout revalidates state.
router.post(
    '/items',
    requireLightApiAuth,
    validateObjectIdBody('variantId', 'variantId'),
    cartApiController.addItem,
);

router.patch(
    '/items/:variantId',
    requireLightApiAuth,
    validateObjectIdParam('variantId', 'variantId'),
    cartApiController.updateItem,
);

router.delete('/items', requireLightApiAuth, cartApiController.removeItems);

router.delete(
    '/items/:variantId',
    requireLightApiAuth,
    validateObjectIdParam('variantId', 'variantId'),
    cartApiController.removeItem,
);

export default router;
