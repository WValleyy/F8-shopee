import { Router } from 'express';

import { validateObjectIdParam } from '../../../middlewares/validation.middleware.js';
import adminOrderController from '../../../controllers/api/admin/order.controller.js';

const router = Router();

router.patch(
    '/orders/:id/status',
    validateObjectIdParam('id', 'Order ID'),
    adminOrderController.updateStatus,
);
export default router;
