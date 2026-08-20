import {
    createCheckoutDraft,
} from '../../../services/commerce/checkout/checkout-draft.service.js';
import { parseCreateCheckoutDraftInput } from '../../requests-parser/commerce/checkout.request.js';

const checkoutApiController = {
    async createDraft(req, res) {
        const input = parseCreateCheckoutDraftInput(req.body);
        const { draftId } = await createCheckoutDraft(
            req.authUserId,
            input.source,
            input.items,
        );

        return res.json({
            data: draftId,
        });
    },

};

export default checkoutApiController;
