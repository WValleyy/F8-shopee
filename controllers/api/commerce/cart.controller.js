import {
    addCartItem,
    getCartPreviewAfterMutation,
    removeCartItem,
    removeCartItems,
    updateCartItem,
} from '../../../services/commerce/cart.service.js';
import {
    parseAddCartItemInput,
    parseRemoveCartItemsInput,
    parseUpdateCartItemInput,
} from '../../requests-parser/commerce/cart.request.js';

const cartApiController = {
    async addItem(req, res) {
        const { variantId, quantity } = parseAddCartItemInput(req.body);

        await addCartItem(req.authUserId, variantId, quantity);

        return res.json({
            data: {
                cartPreview: await getCartPreviewAfterMutation(req.authUserId),
            },
        });
    },

    async updateItem(req, res) {
        const { quantity } = parseUpdateCartItemInput(req.body);

        await updateCartItem(
            req.authUserId,
            req.params.variantId,
            quantity,
        );

        return res.json({
            data: {
                cartPreview: await getCartPreviewAfterMutation(req.authUserId),
            },
        });
    },

    async removeItem(req, res) {
        await removeCartItem(req.authUserId, req.params.variantId);

        return res.json({
            data: {
                cartPreview: await getCartPreviewAfterMutation(req.authUserId),
            },
        });
    },

    async removeItems(req, res) {
        const { variantIds } = parseRemoveCartItemsInput(req.body);
        await removeCartItems(
            req.authUserId,
            variantIds,
        );

        return res.json({
            data: {
                cartPreview: await getCartPreviewAfterMutation(req.authUserId),
            },
        });
    },
};

export default cartApiController;
