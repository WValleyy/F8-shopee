import { Router } from 'express';

import { requireAdmin } from '../../../middlewares/role.middleware.js';
import { requireStrictApiAuth } from '../../../middlewares/auth.middleware.js';
import userManagementRoutes from './user.routes.js';
import adminCategoryRoutes from './category.routes.js';
import adminProductRoutes from './product.routes.js';
import adminReviewRoutes from './review.routes.js';
import adminOrderRoutes from './order.routes.js';

const router = Router();

router.use(requireStrictApiAuth, requireAdmin);
router.use(adminOrderRoutes);
router.use(userManagementRoutes);
router.use(adminCategoryRoutes);
router.use(adminProductRoutes);
router.use(adminReviewRoutes);

export default router;
