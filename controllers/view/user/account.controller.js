import { listAddresses } from '../../../services/user/address.service.js';
import { listAuthSessions } from '../../../services/auth/auth-session.service.js';
import { renderPageResponse } from '../shared/render-response.js';
import { applyViewConfig } from '../shared/view-config.js';

function toProfileUser(user) {
    return {
        userName: user.userName,
        name: user.name,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        avatar: user.avatar,
        birthday: user.birthday
            ? new Date(user.birthday).toISOString().slice(0, 10)
            : '',
        isVerified: user.isVerified,
    };
}

const accountController = {
    redirectToProfile(req, res) {
        return res.redirect('/user/account/profile');
    },

    profile(req, res) {
        const title = 'Hồ sơ của tôi';
        applyViewConfig(res, 'user', { title });

        return renderPageResponse(req, res, {
            layout: 'layouts/user-layout',
            pageView: 'pages/user/account/profile',
            pageData: {
                currentUser: toProfileUser(req.authUser),
                title,
                currentPage: 'profile',
                activeSection: 'profile',
            },
        });
    },

    async address(req, res) {
        const title = 'Địa chỉ của tôi';
        applyViewConfig(res, 'user', { title });

        return renderPageResponse(req, res, {
            layout: 'layouts/user-layout',
            pageView: 'pages/user/account/address',
            pageData: {
                addresses: await listAddresses(req.authUserId),
                title,
                currentPage: 'address',
                activeSection: 'address',
            },
        });
    },

    password(req, res) {
        const title = 'Đổi mật khẩu';
        applyViewConfig(res, 'user', { title });

        return renderPageResponse(req, res, {
            layout: 'layouts/user-layout',
            pageView: 'pages/user/account/password',
            pageData: {
                title,
                currentPage: 'password',
                activeSection: 'password',
            },
        });
    },

    async privacy(req, res) {
        const title = 'Thiết lập riêng tư';
        applyViewConfig(res, 'user', { title });

        return renderPageResponse(req, res, {
            layout: 'layouts/user-layout',
            pageView: 'pages/user/account/privacy',
            pageData: {
                authSessions: await listAuthSessions(
                    req.authUserId,
                    req.authSessionId,
                ),
                title,
                currentPage: 'privacy',
                activeSection: 'privacy',
            },
        });
    },
};

export default accountController;
