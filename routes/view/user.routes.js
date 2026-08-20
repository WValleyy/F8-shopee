import { Router } from 'express';

import accountController from '../../controllers/view/user/account.controller.js';
import engagementController from '../../controllers/view/user/engagement.controller.js';
import purchaseController from '../../controllers/view/user/purchase.controller.js';
import {
    requireLightViewAuth,
    requireStrictViewAuth,
} from '../../middlewares/auth.middleware.js';
import { requireCustomer } from '../../middlewares/role.middleware.js';
import { attachHeaderState } from '../../middlewares/view-state.middleware.js';

const router = Router();


router.get(
    '/',
    accountController.redirectToProfile
);

router.get(
    '/account',
    accountController.redirectToProfile
);

router.get(
    '/account/profile',
    requireStrictViewAuth,
    attachHeaderState,
    requireCustomer,
    accountController.profile
);

router.get(
    '/account/address',
    requireStrictViewAuth,
    attachHeaderState,
    requireCustomer,
    accountController.address
);

router.get(
    '/account/password',
    requireStrictViewAuth,
    attachHeaderState,
    requireCustomer,
    accountController.password
);

router.get(
    '/account/privacy',
    requireStrictViewAuth,
    attachHeaderState,
    requireCustomer,
    accountController.privacy
);

router.get(
    '/purchase',
    requireStrictViewAuth,
    attachHeaderState,
    requireCustomer,
    purchaseController.purchase
);

router.get(
    '/notifications',
    requireLightViewAuth,
    attachHeaderState,
    engagementController.notifications
);

router.get(
    '/wishlist',
    requireLightViewAuth,
    attachHeaderState,
    engagementController.wishlist
);

export default router;
