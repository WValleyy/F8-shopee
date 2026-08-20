import express from 'express';
import expressLayouts from 'express-ejs-layouts';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import env from './config/load-env.js';
import inputLimits from './config/input-limits.js';
import { uploadLimits } from './config/upload-image.js';
import adminApiRoutes from './routes/api/admin/index.routes.js';
import authApiRoutes from './routes/api/auth/auth.routes.js';
import cartApiRoutes from './routes/api/commerce/cart.routes.js';
import checkoutApiRoutes from './routes/api/commerce/checkout.routes.js';
import catalogApiRoutes from './routes/api/catalog/catalog.routes.js';
import notificationApiRoutes from './routes/api/user/notification.routes.js';
import orderApiRoutes from './routes/api/commerce/order.routes.js';
import reviewApiRoutes from './routes/api/catalog/review.routes.js';
import searchHistoryApiRoutes from './routes/api/user/search-history.routes.js';
import accountApiRoutes from './routes/api/user/account.routes.js';
import wishlistApiRoutes from './routes/api/user/wishlist.routes.js';
import adminViewRoutes from './routes/view/admin.routes.js';
import storefrontViewRoutes from './routes/view/storefront.routes.js';
import userViewRoutes from './routes/view/user.routes.js';
import {
    attachLightAuth,
    refreshExpiredViewSession,
} from './middlewares/auth.middleware.js';
import {
    handleAppError,
    handleNotFoundRequest,
} from './middlewares/error.middleware.js';
import {
    applySecurityHeaders,
    requireSameOrigin,
} from './middlewares/security.middleware.js';
import { attachHeaderState } from './middlewares/view-state.middleware.js';
import {
    serializeJsonForHtml,
} from './utils/serialize-json-for-html.js';
import {
    formatCurrency,
    formatDate,
    formatDateOnly,
} from './views/shared/formatter.js';

const app = express();
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

app.disable('x-powered-by');

const viewRoutes = [
    ['/', storefrontViewRoutes],
    ['/user', userViewRoutes],
    ['/admin', adminViewRoutes],
];
const apiRoutes = [
    ['/api/admin', adminApiRoutes],
    ['/api/account', accountApiRoutes],
    ['/api/auth', authApiRoutes],
    ['/api/cart', cartApiRoutes],
    ['/api/checkout', checkoutApiRoutes],
    ['/api/catalog', catalogApiRoutes],
    ['/api/notifications', notificationApiRoutes],
    ['/api/orders', orderApiRoutes],
    ['/api/reviews', reviewApiRoutes],
    ['/api/search-history', searchHistoryApiRoutes],
    ['/api/wishlist', wishlistApiRoutes],
];

const trustProxyValue = env.trustProxy;
if (trustProxyValue && trustProxyValue !== '0' && trustProxyValue !== 'false') {
    app.set(
        'trust proxy',
        /^\d+$/.test(trustProxyValue) ? Number(trustProxyValue) : trustProxyValue,
    );
}

// ================= Middleware =================

app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(applySecurityHeaders);

app.use(express.static(path.join(projectRoot, 'public')));
app.use(attachLightAuth);
app.use(requireSameOrigin);

// ================= View Engine =================

app.use(expressLayouts);

app.set('view engine', 'ejs');
app.set('views', path.join(projectRoot, 'views'));
app.set('layout', 'layouts/base-layout');
app.locals.inputLimits = inputLimits;
app.locals.uploadLimits = uploadLimits;
app.locals.serializeJsonForHtml = serializeJsonForHtml;
app.locals.formatCurrency = formatCurrency;
app.locals.formatDate = formatDate;
app.locals.formatDateOnly = formatDateOnly;

// ================= Routes =================

viewRoutes.forEach(([path, router]) => {
    app.use(path, refreshExpiredViewSession, router);
});

apiRoutes.forEach(([path, router]) => {
    app.use(path, router);
});

// ================= Error Handling =================

app.use((req, res, next) => {
    const isApiRequest = req.path.startsWith('/api/');
    const isPartialRequest = Boolean(req.get('X-Partial-Target'));

    if (isApiRequest || isPartialRequest) {
        next();
        return;
    }

    return attachHeaderState(req, res, next);
});

app.use(handleNotFoundRequest);

app.use(handleAppError);

export default app;
