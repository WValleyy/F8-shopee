import { listOrdersPage } from '../../../services/commerce/order/order-list.service.js';
import { parsePurchaseQuery } from '../../requests-parser/commerce/order-query.request.js';
import { renderPageResponse } from '../shared/render-response.js';
import { applyViewConfig } from '../shared/view-config.js';

async function purchase(req, res) {
    const state = await listOrdersPage(req.authUserId, parsePurchaseQuery(req.query));
    const title = 'Đơn mua';
    applyViewConfig(res, 'user', { title });

    return renderPageResponse(req, res, {
        layout: 'layouts/user-layout',
        pageView: 'pages/user/purchase/purchase',
        collectionView: 'pages/user/purchase/purchase-results',
        pageData: {
            ...state,
            title,
            currentPage: 'purchase',
            activeSection: 'purchase',
        },
    });
}

export default { purchase };
