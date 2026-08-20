import { Router } from 'express';

import catalogApiController from '../../../controllers/api/catalog/catalog.controller.js';

const router = Router();

router.get('/search-suggestions', catalogApiController.suggestions);

export default router;
