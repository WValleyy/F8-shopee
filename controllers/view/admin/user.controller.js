import { listUsersPage } from '../../../services/admin/user/user-management.service.js';
import { parseUserManagementQuery } from '../../requests-parser/admin/user.request.js';
import { renderPageResponse } from '../shared/render-response.js';
import { applyViewConfig } from '../shared/view-config.js';

async function users(req, res) {
    applyViewConfig(res, 'admin');
    const state = await listUsersPage(
        parseUserManagementQuery(req.query),
    );
    const title = 'Quản lý người dùng';

    return renderPageResponse(req, res, {
        layout: 'layouts/admin-layout',
        pageView: 'pages/admin/user/users',
        collectionView: 'pages/admin/user/users-results',
        pageData: {
            ...state,
            currentAdminId: req.authUserId || '',
            title,
            currentPage: 'users',
            activeSection: 'users',
            adminUser: req.authUser,
        },
    });
}

export default { users };
