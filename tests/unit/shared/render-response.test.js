import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    renderPageResponse,
    renderPartial,
} from '../../../controllers/view/shared/render-response.js';

function createRequest(headers = {}) {
    return {
        get: name => headers[name] || '',
    };
}

function createResponse(html = '<div>Template</div>') {
    return {
        json: vi.fn(payload => payload),
        render: vi.fn((view, data, callback) => {
            if (callback)
                callback(null, html);
        }),
    };
}

// View response helpers render pages and partials with the expected contract.
describe('render-response helper', () => {
    it('renders full page response when X-Partial-Target is omitted', async () => {
        const req = createRequest();
        const res = createResponse();

        await renderPageResponse(req, res, {
            layout: 'layouts/admin-layout',
            pageView: 'pages/admin/dashboard',
            pageData: {
                title: 'Dashboard',
                currentPage: 'dashboard',
                activeSection: 'dashboard',
            },
        });

        expect(res.render).toHaveBeenCalledWith(
            'pages/admin/dashboard',
            {
                layout: 'layouts/admin-layout',
                title: 'Dashboard',
                currentPage: 'dashboard',
                activeSection: 'dashboard',
            },
        );
    });

    it('returns page partial JSON with title, currentPage, and activeSection when X-Partial-Target is page', async () => {
        const req = createRequest({ 'X-Partial-Target': 'page' });
        const res = createResponse('<section>Dashboard</section>');

        await renderPageResponse(req, res, {
            layout: 'layouts/admin-layout',
            pageView: 'pages/admin/dashboard',
            pageData: {
                title: 'Tổng quan',
                currentPage: 'dashboard',
                activeSection: 'dashboard',
            },
        });

        expect(res.json).toHaveBeenCalledWith({
            html: '<section>Dashboard</section>',
            title: 'Tổng quan',
            currentPage: 'dashboard',
            activeSection: 'dashboard',
        });
    });

    it('returns paginated collection partial JSON when X-Partial-Target is paginated-collection', async () => {
        const req = createRequest({ 'X-Partial-Target': 'paginated-collection' });
        const res = createResponse('<div>Orders Table</div>');

        await renderPageResponse(req, res, {
            layout: 'layouts/admin-layout',
            pageView: 'pages/admin/order/orders',
            collectionView: 'pages/admin/order/orders-results',
            pageData: {
                orders: [],
                pagination: { page: 1, totalPages: 5 },
            },
        });

        expect(res.json).toHaveBeenCalledWith({
            html: '<div>Orders Table</div>',
            pagination: { page: 1, totalPages: 5 },
        });
    });

    it('renders standalone partial JSON via renderPartial', async () => {
        const res = createResponse('<p>Fragment</p>');

        await renderPartial(res, {
            view: 'pages/shared/fragment',
            data: { key: 'val' },
        });

        expect(res.json).toHaveBeenCalledWith({
            html: '<p>Fragment</p>',
        });
    });
});
