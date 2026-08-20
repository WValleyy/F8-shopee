import {
    logoutAuthSession,
    refreshAccessToken,
    revokeAllAuthSessions,
    revokeAuthSessionById,
} from '../../../services/auth/auth-session.service.js';
import { isAppErrorCode } from '../../../utils/error/app-error.js';
import { parseSessionIdParam } from '../../requests-parser/auth/auth.request.js';
import {
    clearAuthCookies,
    setAuthCookies,
} from './auth-http-state.js';

const authSessionController = {
    async refresh(req, res) {
        let session;

        try {
            session = await refreshAccessToken(req.authRefreshToken, {
                ipAddress: req.ip || req.socket?.remoteAddress || '',
                userAgent: req.get('user-agent') || '',
            });
        } catch (error) {
            if (isAppErrorCode(error, 'SESSION_INVALID')) {
                clearAuthCookies(res);
            }

            throw error;
        }

        setAuthCookies(res, session);
        return res.json({});
    },

    async logout(req, res) {
        await logoutAuthSession(
            req.authRefreshToken,
            req.authUserId,
            req.authSessionId,
        );

        clearAuthCookies(res);
        return res.json({});
    },

    async logoutAll(req, res) {
        await revokeAllAuthSessions(req.authUser._id);
        clearAuthCookies(res);
        return res.json({});
    },

    async revokeAuthSession(req, res) {
        const sessionId = parseSessionIdParam(req.params.sessionId);
        await revokeAuthSessionById(
            sessionId,
            req.authUserId,
            'user_revoked',
        );

        const revokedCurrentSession = sessionId === req.authSessionId;

        if (revokedCurrentSession)
            clearAuthCookies(res);

        return res.json({
            data: { revokedCurrentSession },
        });
    },
};

export default authSessionController;
