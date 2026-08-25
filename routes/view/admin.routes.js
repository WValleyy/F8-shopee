import { Router } from 'express';

import accountController from '../../controllers/view/admin/user.controller.js';
import catalogController from '../../controllers/view/admin/catalog.controller.js';
import commerceController from '../../controllers/view/admin/commerce.controller.js';
import systemController from '../../controllers/view/admin/system.controller.js';
import { requireAdmin } from '../../middlewares/role.middleware.js';
import { requireStrictViewAuth } from '../../middlewares/auth.middleware.js';
import { validateObjectIdParam } from '../../middlewares/validation.middleware.js';

const router = Router();

router.use(
    requireStrictViewAuth,
    requireAdmin,
);

router.get('/', systemController.dashboard);
router.get('/app-logs', systemController.appLogs);
router.get('/orders', commerceController.orders);
router.get('/products', catalogController.products);
router.get('/products/new', catalogController.newProduct);
router.get(
    '/products/:id/edit',
    validateObjectIdParam('id', 'Product ID'),
    catalogController.editProduct,
);
router.get('/reviews', catalogController.reviews);
router.get('/users', accountController.users);
router.get('/categories', catalogController.categories);

export default router;
