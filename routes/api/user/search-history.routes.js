import { Router } from 'express';

import searchHistoryApiController from '../../../controllers/api/user/search-history.controller.js';
import { requireLightApiAuth } from '../../../middlewares/auth.middleware.js';

const router = Router();

// Intentional light-auth policy: engagement mutations remain available until
// a valid access token expires, even after its session is revoked.
router.use(requireLightApiAuth);

router.get('/', searchHistoryApiController.list);
router.put('/', searchHistoryApiController.record);
router.delete('/', searchHistoryApiController.remove);

export default router;
