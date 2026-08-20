import { Router } from 'express';

import orderApiController from '../../../controllers/api/commerce/order.controller.js';
import {
    requireStrictApiAuth,
} from '../../../middlewares/auth.middleware.js';
import { requireCustomer } from '../../../middlewares/role.middleware.js';
import { validateObjectIdParam } from '../../../middlewares/validation.middleware.js';

const router = Router();

router.use(
    requireStrictApiAuth,
    requireCustomer,
);

router.post('/', orderApiController.createOrder);
router.patch(
    '/:orderId/status',
    validateObjectIdParam('orderId', 'Order ID'),
    orderApiController.updateStatus,
);

router.post(
    '/:orderId/returns',
    validateObjectIdParam('orderId', 'Order ID'),
    orderApiController.createReturn,
);

export default router;
