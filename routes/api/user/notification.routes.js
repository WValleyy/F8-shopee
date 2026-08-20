import { Router } from 'express';

import notificationApiController from '../../../controllers/api/user/notification.controller.js';
import { requireLightApiAuth } from '../../../middlewares/auth.middleware.js';
import { validateObjectIdParam } from '../../../middlewares/validation.middleware.js';

const router = Router();

// Intentional light-auth policy: engagement mutations remain available until
// a valid access token expires, even after its session is revoked.
router.use(requireLightApiAuth);

router.patch('/read-all', notificationApiController.markAllRead);

router.patch(
    '/:id/read',
    validateObjectIdParam('id', 'Notification ID'),
    notificationApiController.markRead,
);

export default router;
