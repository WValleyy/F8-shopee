import { Router } from 'express';

import { validateObjectIdParam } from '../../../middlewares/validation.middleware.js';
import adminReviewController from '../../../controllers/api/admin/review.controller.js';

const router = Router();

router.patch(
    '/reviews/:id/publication',
    validateObjectIdParam('id', 'Review ID'),
    adminReviewController.setPublication,
);

export default router;
