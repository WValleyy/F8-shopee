import { Router } from 'express';

import { uploadProductImages } from '../../../middlewares/image-upload.middleware.js';
import { validateObjectIdParam } from '../../../middlewares/validation.middleware.js';
import adminProductController from '../../../controllers/api/admin/product.controller.js';

const router = Router();

router.post('/products', uploadProductImages, adminProductController.create);
router.post('/products/actions', adminProductController.applyBulkAction);
router.patch(
    '/products/:id',
    validateObjectIdParam('id', 'Product ID'),
    uploadProductImages,
    adminProductController.update,
);
router.delete(
    '/products/:id',
    validateObjectIdParam('id', 'Product ID'),
    adminProductController.remove,
);

export default router;
