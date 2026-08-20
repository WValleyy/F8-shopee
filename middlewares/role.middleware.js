import { requestError } from '../utils/error/app-error.js';

function requireAdmin(req, res, next) {
    if (req.authUser?.role !== 'ADMIN')
        return next(requestError('ADMIN_ROLE_REQUIRED'));

    return next();
}

function requireCustomer(req, res, next) {
    if (req.authUser?.role !== 'USER')
        return next(requestError('CUSTOMER_ACCOUNT_REQUIRED'));

    return next();
}

export {
    requireAdmin,
    requireCustomer,
};
