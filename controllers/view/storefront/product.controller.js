import {
    getProductDetailBySlug,
    getStorefrontProductBySlug,
    listFeaturedProducts,
    listRelatedProducts,
} from '../../../services/catalog/product-query.service.js';
import { parseProductSlugParam } from '../../requests-parser/catalog/product.request.js';
import { parseProductReviewQuery } from '../../requests-parser/catalog/review.request.js';
import { listProductReviewsPage } from '../../../services/catalog/review.service.js';
import { requestError } from '../../../utils/error/app-error.js';
import { renderPartial } from '../shared/render-response.js';
import { applyViewConfig } from '../shared/view-config.js';

async function product(req, res) {
    const slug = parseProductSlugParam(req.params.slug);

    const productState = await getProductDetailBySlug(slug, {
        currentUserId: req.authUserId,
    });

    if (!productState) {
        throw requestError('PRODUCT_NOT_FOUND');
    }

    const [reviewPage, relatedProducts, featuredProducts] = await Promise.all([
        listProductReviewsPage(productState.id, {
            rating: null,
            page: 1,
            currentUserId: req.authUserId,
        }),
        listRelatedProducts({
            categoryId: productState.categoryId,
            excludeProductId: productState.id,
            limit: 4,
            currentUserId: req.authUserId,
        }),
        listFeaturedProducts({
            excludeProductId: productState.id,
            limit: 3,
            currentUserId: req.authUserId,
        }),
    ]);

    const reviewState = {
        reviews: reviewPage.reviews,
        pagination: reviewPage.pagination,
        rating: null,
    };

    applyViewConfig(res, 'product', {
        title: `Shopee Việt Nam | ${productState.name}`,
    });

    res.render('pages/storefront/product/product', {
        product: productState,
        reviewState,
        featuredProducts,
        relatedProducts,
    });
}

async function listProductReviews(req, res) {
    const slug = parseProductSlugParam(req.params.slug);
    const input = parseProductReviewQuery(req.query);
    const product = await getStorefrontProductBySlug(slug);

    if (!product) {
        throw requestError('PRODUCT_NOT_FOUND');
    }

    const reviewPage = await listProductReviewsPage(product._id, {
        rating: input.rating,
        page: input.page,
        currentUserId: req.authUserId,
    });

    return renderPartial(res, {
        view: 'pages/storefront/product/reviews-content',
        data: {
            reviews: reviewPage.reviews,
            rating: input.rating,
        },
        payload: {
            rating: input.rating || 0,
            pagination: reviewPage.pagination,
        },
    });
}

export default {
    product,
    listProductReviews,
};
