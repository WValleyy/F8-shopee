import authConfig from '../../../config/auth.js';
import {
    isAppErrorCode,
} from '../../../utils/error/app-error.js';
import {
    requestPasswordReset,
    resendPasswordResetOtp,
    resetPasswordWithOtp,
} from '../../../services/auth/auth-account.service.js';
import {
    getPasswordResetOtpStatus,
    verifyOtpCode,
} from '../../../services/auth/auth-otp.service.js';
import {
    parseForgotPasswordInput,
    parseOtpInput,
    parseResetPasswordInput,
} from '../../requests-parser/auth/auth.request.js';
import {
    clearAuthCookies,
    clearOtpCookie,
    getOtpCookieName,
    setOtpCookie,
} from './auth-http-state.js';

const passwordResetController = {
    async forgotPassword(req, res) {
        const input = parseForgotPasswordInput(req.body);
        const result = await requestPasswordReset(input.email);

        setOtpCookie(res, 'RESET_PASSWORD', result.challengeId);

        return res.json({});
    },

    async passwordOtpStatus(req, res) {
        const rawChallengeId = req.cookies?.[
            getOtpCookieName('RESET_PASSWORD')
        ];
        const status = await getPasswordResetOtpStatus(rawChallengeId);

        return res.json({
            data: status,
        });
    },

    async resendPasswordOtp(req, res) {
        const rawChallengeId = req.cookies?.[getOtpCookieName('RESET_PASSWORD')];
        const result = await resendPasswordResetOtp(rawChallengeId);

        setOtpCookie(res, 'RESET_PASSWORD', result.challengeId);

        return res.json({
            data: {
                resendCooldownSeconds: authConfig.otp.resendCooldownSeconds,
            },
        });
    },

    async verifyPasswordOtp(req, res) {
        const { otp } = parseOtpInput(req.body);
        const rawChallengeId = req.cookies?.[getOtpCookieName('RESET_PASSWORD')];
        await verifyOtpCode(
            rawChallengeId,
            'RESET_PASSWORD',
            otp,
        );

        return res.json({});
    },

    async resetPassword(req, res) {
        const input = parseResetPasswordInput(req.body);

        try {
            await resetPasswordWithOtp(
                req.cookies?.[getOtpCookieName('RESET_PASSWORD')],
                input.password,
            );
        } catch (error) {
            if (isAppErrorCode(error, 'USER_EMAIL_CHANGED'))
                clearOtpCookie(res, 'RESET_PASSWORD');

            throw error;
        }

        clearAuthCookies(res);
        clearOtpCookie(res, 'RESET_PASSWORD');
        return res.json({});
    },
};

export default passwordResetController;
