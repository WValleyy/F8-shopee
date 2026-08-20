import {
    createProductReview,
    setReviewHelpful,
} from '../../../services/catalog/review.service.js';
import { parseCreateReviewInput } from '../../requests-parser/catalog/review.request.js';

const reviewApiController = {
    async markHelpful(req, res) {
        await setReviewHelpful(
            req.params.id,
            req.authUserId,
            true,
        );

        return res.json({});
    },

    async unmarkHelpful(req, res) {
        await setReviewHelpful(
            req.params.id,
            req.authUserId,
            false,
        );

        return res.json({});
    },

    async createProductReview(req, res) {
        const input = parseCreateReviewInput(
            req.body,
            req.files || [],
        );

        await createProductReview(
            req.params.productId,
            req.authUserId,
            input,
        );

        return res.json({});
    },
};

export default reviewApiController;
