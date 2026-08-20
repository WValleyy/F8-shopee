import {
    listAdminCategories,
    listAdminCategoryOptions,
    listAdminCategoriesPage,
} from '../../../services/admin/catalog/admin-category.service.js';
import { parseAdminCategoryQuery } from '../../requests-parser/admin/category.request.js';
import {
    getAdminProduct,
    listAdminProductAttributes,
    listAdminProductsPage,
} from '../../../services/admin/catalog/admin-product.service.js';
import { parseAdminProductQuery } from '../../requests-parser/admin/product.request.js';
import { listAdminReviewsPage } from '../../../services/admin/catalog/admin-review.service.js';
import { parseAdminReviewQuery } from '../../requests-parser/admin/review.request.js';
import { renderPageResponse } from '../shared/render-response.js';
import { applyViewConfig } from '../shared/view-config.js';
import { requestError } from '../../../utils/error/app-error.js';

const catalogController = {
    async categories(req, res) {
        applyViewConfig(res, 'admin');
        const [state, categoryOptions] = await Promise.all([
            listAdminCategoriesPage(parseAdminCategoryQuery(req.query)),
            listAdminCategoryOptions(),
        ]);
        const title = 'Quản lý danh mục';

        return renderPageResponse(req, res, {
            layout: 'layouts/admin-layout',
            pageView: 'pages/admin/category/categories',
            collectionView: 'pages/admin/category/categories-results',
            pageData: {
                ...state,
                categoryOptions,
                title,
                currentPage: 'categories',
                activeSection: 'categories',
                adminUser: req.authUser,
            },
        });
    },

    async products(req, res) {
        applyViewConfig(res, 'admin');
        const [state, categories] = await Promise.all([
            listAdminProductsPage(parseAdminProductQuery(req.query)),
            listAdminCategories(),
        ]);
        const title = 'Quản lý sản phẩm';

        return renderPageResponse(req, res, {
            layout: 'layouts/admin-layout',
            pageView: 'pages/admin/product/products',
            collectionView: 'pages/admin/product/products-results',
            pageData: {
                ...state,
                categories,
                title,
                currentPage: 'products',
                activeSection: 'products',
                adminUser: req.authUser,
            },
        });
    },

    async newProduct(req, res) {
        applyViewConfig(res, 'admin');
        const title = 'Thêm sản phẩm';
        const [categories, attributes] = await Promise.all([
            listAdminCategories(),
            listAdminProductAttributes(),
        ]);

        return renderPageResponse(req, res, {
            layout: 'layouts/admin-layout',
            pageView: 'pages/admin/product/product-editor',
            pageData: {
                categories,
                attributes,
                product: {
                    id: '',
                    name: '',
                    description: '',
                    categoryId: '',
                    brand: '',
                    specifications: [],
                    isPublished: false,
                    gallery: [],
                    variants: [{
                        id: '',
                        sku: '',
                        options: [],
                        price: 0,
                        originalPrice: 0,
                        stock: 0,
                        isPublished: true,
                    }],
                },
                title,
                currentPage: 'product-editor',
                activeSection: 'products',
                adminUser: req.authUser,
            },
        });
    },

    async editProduct(req, res) {
        applyViewConfig(res, 'admin');
        const product = await getAdminProduct(req.params.id);

        if (!product)
            throw requestError('PRODUCT_NOT_FOUND', {
                viewAction: {
                    actionHref: '/admin/products',
                    actionLabel: 'Quay lại sản phẩm',
                },
            });

        const [categories, attributes] = await Promise.all([
            listAdminCategories(),
            listAdminProductAttributes(),
        ]);

        const title = `Chỉnh sửa ${product.name}`;
        return renderPageResponse(req, res, {
            layout: 'layouts/admin-layout',
            pageView: 'pages/admin/product/product-editor',
            pageData: {
                product,
                categories,
                attributes,
                title,
                currentPage: 'product-editor',
                activeSection: 'products',
                adminUser: req.authUser,
            },
        });
    },

    async reviews(req, res) {
        applyViewConfig(res, 'admin');
        const state = await listAdminReviewsPage(
            parseAdminReviewQuery(req.query),
        );
        const title = 'Quản lý đánh giá';

        return renderPageResponse(req, res, {
            layout: 'layouts/admin-layout',
            pageView: 'pages/admin/review/reviews',
            collectionView: 'pages/admin/review/reviews-results',
            pageData: {
                ...state,
                title,
                currentPage: 'reviews',
                activeSection: 'reviews',
                adminUser: req.authUser,
            },
        });
    },
};

export default catalogController;
