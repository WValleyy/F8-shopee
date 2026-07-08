import renderAccountPage from '../../utils/render-account-page.js';

const accountController = {
    redirectToProfile(req, res) {
        return res.redirect('/account/profile');
    },

    profile(req, res) {
        return renderAccountPage(req, res, {
            view: 'profile',
            title: 'Hồ sơ của tôi',
        });
    },

    purchase(req, res) {
        return renderAccountPage(req, res, {
            view: 'purchase',
            title: 'Đơn mua',
        });
    },

    address(req, res) {
        return renderAccountPage(req, res, {
            view: 'address',
            title: 'Địa chỉ của tôi',
        });
    },

    paymentMethod(req, res) {
        return renderAccountPage(req, res, {
            view: 'payment-method',
            title: 'Thẻ thanh toán',
        });
    },

    password(req, res) {
        return renderAccountPage(req, res, {
            view: 'password',
            title: 'Đổi mật khẩu',
        });
    },

    privacy(req, res) {
        return renderAccountPage(req, res, {
            view: 'privacy',
            title: 'Những thiết lập riêng tư',
        });
    },

    voucher(req, res) {
        return renderAccountPage(req, res, {
            view: 'voucher',
            title: 'Kho Voucher',
        });
    },
};

export default accountController;