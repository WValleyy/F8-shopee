import { listWishListPage } from '../../../services/user/wishlist.service.js';
import { parseWishlistQuery } from '../../requests-parser/user/wishlist.request.js';
import { listNotificationsPage } from '../../../services/user/notification.service.js';
import { parseNotificationQuery } from '../../requests-parser/user/notification.request.js';
import * as notificationPresentation from '../../../views/shared/notification-presentation.js';
import { renderPageResponse } from '../shared/render-response.js';
import { applyViewConfig } from '../shared/view-config.js';

const engagementController = {
    async notifications(req, res) {
        const state = await listNotificationsPage(req.authUserId, parseNotificationQuery(req.query));
        const title = 'Thông báo';
        applyViewConfig(res, 'user', { title });

        return renderPageResponse(req, res, {
            layout: 'layouts/user-layout',
            pageView: 'pages/user/notification/notifications',
            collectionView: 'pages/user/notification/notifications-results',
            pageData: {
                ...state,
                title,
                currentPage: 'notifications',
                activeSection: 'notifications',
                notificationPresentation,
            },
        });
    },

    async wishlist(req, res) {
        const state = await listWishListPage(req.authUserId, parseWishlistQuery(req.query));
        const title = 'Sản phẩm yêu thích';
        applyViewConfig(res, 'user', { title });

        return renderPageResponse(req, res, {
            layout: 'layouts/user-layout',
            pageView: 'pages/user/wishlist/wishlist',
            collectionView: 'pages/user/wishlist/wishlist-results',
            pageData: {
                ...state,
                title,
                currentPage: 'wishlist',
                activeSection: 'wishlist',
            },
        });
    },
};

export default engagementController;
