import { Router } from 'express';

import { validateObjectIdParam } from '../../../middlewares/validation.middleware.js';
import userManagementController from '../../../controllers/api/admin/user.controller.js';

const router = Router();

router.patch(
    '/users/:id/active',
    validateObjectIdParam('id', 'User ID'),
    userManagementController.setActive,
);
router.delete(
    '/users/:id',
    validateObjectIdParam('id', 'User ID'),
    userManagementController.purge,
);

export default router;
