import { listAdminOrdersPage } from '../../../services/admin/commerce/admin-order.service.js';
import { parseAdminOrderQuery } from '../../requests-parser/admin/order.request.js';
import { renderPageResponse } from '../shared/render-response.js';
import { applyViewConfig } from '../shared/view-config.js';

const commerceController = {
    async orders(req, res) {
        applyViewConfig(res, 'admin');
        const state = await listAdminOrdersPage(
            parseAdminOrderQuery(req.query),
        );
        const title = 'Quản lý đơn hàng';

        return renderPageResponse(req, res, {
            layout: 'layouts/admin-layout',
            pageView: 'pages/admin/order/orders',
            collectionView: 'pages/admin/order/orders-results',
            pageData: {
                ...state,
                title,
                currentPage: 'orders',
                activeSection: 'orders',
                adminUser: req.authUser,
            },
        });
    },
};

export default commerceController;
