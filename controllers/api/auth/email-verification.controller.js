import authConfig from '../../../config/auth.js';
import {
    confirmEmailChangeWithOtp,
    getEmailChangeOtpStatus,
    getEmailVerificationOtpStatus,
    requestEmailChange,
    requestEmailVerificationOtp,
    resendEmailChangeOtp,
    verifyEmailOtp,
} from '../../../services/auth/auth-account.service.js';
import {
    getNotificationPreview,
} from '../../../services/user/notification.service.js';
import {
    parseOtpInput,
    parseRequestEmailChangeInput,
} from '../../requests-parser/auth/auth.request.js';
import {
    clearOtpCookie,
    getOtpCookieName,
    setOtpCookie,
} from './auth-http-state.js';

const emailVerificationController = {
    async requestVerificationOtp(req, res) {
        const result = await requestEmailVerificationOtp(req.authUserId);

        if (!result)
            return res.json({});

        setOtpCookie(res, 'VERIFY_EMAIL', result.challengeId);

        return res.json({
            data: {
                resendCooldownSeconds: authConfig.otp.resendCooldownSeconds,
            },
        });
    },

    async verificationOtpStatus(req, res) {
        const status = await getEmailVerificationOtpStatus(
            req.cookies?.[getOtpCookieName('VERIFY_EMAIL')],
            req.authUserId,
        );

        return res.json({
            data: status,
        });
    },

    async verifyEmail(req, res) {
        const { otp } = parseOtpInput(req.body);
        await verifyEmailOtp(
            req.cookies?.[getOtpCookieName('VERIFY_EMAIL')],
            otp,
            req.authUserId,
        );

        clearOtpCookie(res, 'VERIFY_EMAIL');
        return res.json({
            data: {
                notificationPreview: await getNotificationPreview(
                    req.authUserId,
                ),
            },
        });
    },

    async requestEmailChange(req, res) {
        const input = parseRequestEmailChangeInput(req.body);
        const emailChange = await requestEmailChange(
            req.authUserId,
            input.currentPassword,
            input.email,
        );

        setOtpCookie(res, 'CHANGE_EMAIL', emailChange.challengeId);
        return res.json({
            data: {
                resendCooldownSeconds: authConfig.otp.resendCooldownSeconds,
            },
        });
    },

    async emailChangeOtpStatus(req, res) {
        const status = await getEmailChangeOtpStatus(
            req.cookies?.[getOtpCookieName('CHANGE_EMAIL')],
            req.authUserId,
        );

        return res.json({
            data: status,
        });
    },

    async confirmEmailChange(req, res) {
        const { otp } = parseOtpInput(req.body);
        await confirmEmailChangeWithOtp(
            req.cookies?.[getOtpCookieName('CHANGE_EMAIL')],
            otp,
            req.authUserId,
            req.authSessionId,
        );

        clearOtpCookie(res, 'CHANGE_EMAIL');

        return res.json({});
    },

    async resendEmailChangeOtp(req, res) {
        const rawChallengeId = req.cookies?.[getOtpCookieName('CHANGE_EMAIL')];
        const result = await resendEmailChangeOtp(
            req.authUserId,
            rawChallengeId,
        );
        setOtpCookie(res, 'CHANGE_EMAIL', result.challengeId);

        return res.json({
            data: {
                resendCooldownSeconds: authConfig.otp.resendCooldownSeconds,
            },
        });
    },
};

export default emailVerificationController;
