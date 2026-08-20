import { Router } from 'express';

import addressRoutes from './address.routes.js';
import { requireStrictApiAuth } from '../../../middlewares/auth.middleware.js';
import { requireCustomer } from '../../../middlewares/role.middleware.js';
import profileRoutes from './profile.routes.js';

const router = Router();

router.use(requireStrictApiAuth, requireCustomer);
router.use(profileRoutes);
router.use(addressRoutes);

export default router;
