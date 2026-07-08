import { Router } from 'express';

import accountController from '../controllers/views/account.controller.js';

const router = Router();

// Redirect

router.get(
    '/',
    accountController.redirectToProfile
);

// Profile

router.get(
    '/profile',
    accountController.profile
);

// Purchase

router.get(
    '/purchase',
    accountController.purchase
);

// Address

router.get(
    '/address',
    accountController.address
);

// Payment Method

router.get(
    '/payment-method',
    accountController.paymentMethod
);

// Password

router.get(
    '/password',
    accountController.password
);

// Privacy

router.get(
    '/privacy',
    accountController.privacy
);

// Voucher

router.get(
    '/voucher',
    accountController.voucher
);

export default router;