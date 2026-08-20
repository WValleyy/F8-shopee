import { Router } from 'express';

import { uploadAvatarImage } from '../../../middlewares/image-upload.middleware.js';
import { currentPasswordRateLimit } from '../../../middlewares/rate-limit.middleware.js';
import profileController from '../../../controllers/api/user/profile.controller.js';

const router = Router();

router.patch('/profile', uploadAvatarImage, profileController.update);
router.patch('/password', currentPasswordRateLimit, profileController.changePassword);
router.delete('/account', currentPasswordRateLimit, profileController.deleteAccount);

export default router;
