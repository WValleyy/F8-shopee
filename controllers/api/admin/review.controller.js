import { parseReviewPublicationInput } from '../../requests-parser/admin/review.request.js';
import { setAdminReviewPublication } from '../../../services/admin/catalog/admin-review.service.js';

const adminReviewController = {
    async setPublication(req, res) {
        const { isPublished } = parseReviewPublicationInput(req.body);
        await setAdminReviewPublication(
            req.params.id,
            isPublished,
        );

        return res.json({});
    },
};

export default adminReviewController;
