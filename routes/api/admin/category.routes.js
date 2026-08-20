import { Router } from 'express';

import { validateObjectIdParam } from '../../../middlewares/validation.middleware.js';
import adminCategoryController from '../../../controllers/api/admin/category.controller.js';

const router = Router();

router.post('/categories', adminCategoryController.create);
router.patch(
    '/categories/:id',
    validateObjectIdParam('id', 'Category ID'),
    adminCategoryController.update,
);
export default router;
