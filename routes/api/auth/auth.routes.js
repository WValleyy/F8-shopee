import { Router } from 'express';

import authController from '../../../controllers/api/auth/auth.controller.js';
import authSessionController from '../../../controllers/api/auth/auth-session.controller.js';
import emailVerificationController from '../../../controllers/api/auth/email-verification.controller.js';
import passwordResetController from '../../../controllers/api/auth/password-reset.controller.js';
import { requireStrictApiAuth } from '../../../middlewares/auth.middleware.js';
import { requireCustomer } from '../../../middlewares/role.middleware.js';
import {
    currentPasswordRateLimit,
    loginAccountRateLimit,
    loginIpRateLimit,
    passwordOtpIpRateLimit,
    refreshRateLimit,
    registerIpEmailRateLimit,
    registerIpRateLimit,
} from '../../../middlewares/rate-limit.middleware.js';

const router = Router();

router.post(
    '/register',
    registerIpRateLimit,
    registerIpEmailRateLimit,
    authController.register,
);
router.post(
    '/login',
    loginIpRateLimit,
    loginAccountRateLimit,
    authController.login,
);
router.post(
    '/email/verify/request',
    requireStrictApiAuth,
    emailVerificationController.requestVerificationOtp,
);
router.get(
    '/email/verify/status',
    requireStrictApiAuth,
    emailVerificationController.verificationOtpStatus,
);
router.post('/email/verify', requireStrictApiAuth, emailVerificationController.verifyEmail);
router.post(
    '/password/forgot',
    passwordOtpIpRateLimit,
    passwordResetController.forgotPassword,
);
router.get('/password/forgot/status', passwordResetController.passwordOtpStatus);
router.post(
    '/password/forgot/resend',
    passwordOtpIpRateLimit,
    passwordResetController.resendPasswordOtp,
);
router.post('/password/verify-otp', passwordResetController.verifyPasswordOtp);
router.post('/password/reset', passwordResetController.resetPassword);
router.use('/email-change', requireStrictApiAuth, requireCustomer);
router.post(
    '/email-change/request',
    currentPasswordRateLimit,
    emailVerificationController.requestEmailChange,
);
router.get(
    '/email-change/status',
    emailVerificationController.emailChangeOtpStatus,
);
router.post(
    '/email-change/confirm',
    emailVerificationController.confirmEmailChange,
);
router.post(
    '/email-change/resend',
    emailVerificationController.resendEmailChangeOtp,
);
router.post('/session/refresh', refreshRateLimit, authSessionController.refresh);
router.post('/session/logout', authSessionController.logout);
router.delete('/sessions/:sessionId', requireStrictApiAuth, authSessionController.revokeAuthSession);
router.post('/logout-all', requireStrictApiAuth, authSessionController.logoutAll);

export default router;
