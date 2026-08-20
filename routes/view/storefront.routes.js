import { Router } from 'express';

import checkoutController from '../../controllers/view/storefront/checkout.controller.js';
import homeController from '../../controllers/view/storefront/home.controller.js';
import productController from '../../controllers/view/storefront/product.controller.js';
import {
    requireStrictViewAuth,
} from '../../middlewares/auth.middleware.js';
import { requireCustomer } from '../../middlewares/role.middleware.js';
import { attachHeaderState } from '../../middlewares/view-state.middleware.js';

const router = Router();

// Home

router.get(
    '/',
    attachHeaderState,
    homeController.home
);

// Product

router.get(
    '/product/:slug/reviews',
    productController.listProductReviews,
);

router.get(
    '/product/:slug',
    attachHeaderState,
    productController.product
);

// Cart

router.get(
    '/cart',
    attachHeaderState,
    checkoutController.cart,
);

// Checkout

router.get(
    '/checkout',
    requireStrictViewAuth,
    requireCustomer,
    attachHeaderState,
    checkoutController.checkout,
);
router.get(
    '/checkout/addresses',
    requireStrictViewAuth,
    requireCustomer,
    checkoutController.checkoutAddressPartials,
);
export default router;
