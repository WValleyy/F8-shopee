import {
    setProductWishlistState,
} from '../../../services/user/wishlist.service.js';

const wishlistApiController = {
    async add(req, res) {
        await setProductWishlistState(
            req.params.productId,
            req.authUserId,
            true,
        );

        return res.json({});
    },

    async remove(req, res) {
        await setProductWishlistState(
            req.params.productId,
            req.authUserId,
            false,
        );

        return res.json({});
    },
};

export default wishlistApiController;
