import { catalogSortGroups } from '../../../config/catalog.js';
import { getHomeCatalogState } from '../../../services/catalog/catalog-browse.service.js';
import { renderPageResponse } from '../shared/render-response.js';
import { applyViewConfig } from '../shared/view-config.js';
import { parseCatalogQuery } from '../../requests-parser/catalog/catalog.request.js';

async function home(req, res) {
    const title = 'Shopee Việt Nam | Mua sắm Online';
    const input = parseCatalogQuery(req.query);
    const catalog = await getHomeCatalogState({
        ...input,
        currentUserId: req.authUserId,
    });

    applyViewConfig(res, 'home', { title });

    return renderPageResponse(req, res, {
        layout: null,
        pageView: 'pages/storefront/home/home',
        collectionView: 'pages/storefront/home/home-product-list',
        pageData: {
            title,
            catalog,
            catalogSortGroups,
            products: catalog.products,
            pagination: catalog.pagination,
        },
    });
}

export default { home };
