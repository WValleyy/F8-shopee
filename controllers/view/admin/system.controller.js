import { listAdminAppLogsPage } from '../../../services/admin/system/admin-app-log.service.js';
import { parseAdminAppLogQuery } from '../../requests-parser/admin/app-log.request.js';
import { getAdminDashboard } from '../../../services/admin/system/dashboard.service.js';
import { renderPageResponse } from '../shared/render-response.js';
import { applyViewConfig } from '../shared/view-config.js';

const systemController = {
    async appLogs(req, res) {
        applyViewConfig(res, 'admin');
        const state = await listAdminAppLogsPage(
            parseAdminAppLogQuery(req.query),
        );
        const title = 'Nhật ký ứng dụng';

        return renderPageResponse(req, res, {
            layout: 'layouts/admin-layout',
            pageView: 'pages/admin/app-log/app-logs',
            collectionView: 'pages/admin/app-log/app-logs-results',
            pageData: {
                ...state,
                title,
                currentPage: 'app-logs',
                activeSection: 'app-logs',
                adminUser: req.authUser,
            },
        });
    },

    async dashboard(req, res) {
        applyViewConfig(res, 'admin');
        const title = 'Tổng quan';
        const dashboardData = await getAdminDashboard();

        return renderPageResponse(req, res, {
            layout: 'layouts/admin-layout',
            pageView: 'pages/admin/dashboard',
            pageData: {
                ...dashboardData,
                title,
                currentPage: 'dashboard',
                activeSection: 'dashboard',
                adminUser: req.authUser,
            },
        });
    },
};

export default systemController;
