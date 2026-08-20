import { Router } from 'express';

import { validateObjectIdParam } from '../../../middlewares/validation.middleware.js';
import addressController from '../../../controllers/api/user/address.controller.js';

const router = Router();

router.post('/addresses', addressController.create);
router.delete(
    '/addresses/:id',
    validateObjectIdParam('id', 'Address ID'),
    addressController.remove,
);
router.patch(
    '/addresses/:id',
    validateObjectIdParam('id', 'Address ID'),
    addressController.update,
);
router.patch(
    '/addresses/:id/default',
    validateObjectIdParam('id', 'Address ID'),
    addressController.setDefault,
);

export default router;
