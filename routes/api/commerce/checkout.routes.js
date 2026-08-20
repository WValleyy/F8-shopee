import { Router } from 'express';

import checkoutApiController from '../../../controllers/api/commerce/checkout.controller.js';
import {
    requireStrictApiAuth,
} from '../../../middlewares/auth.middleware.js';
import { requireCustomer } from '../../../middlewares/role.middleware.js';

const router = Router();

router.use(requireStrictApiAuth, requireCustomer);

router.post('/drafts', checkoutApiController.createDraft);

export default router;
