import AuthRateLimit from '../../models/auth/auth-rate-limit.model.js';
import AuthSession from '../../models/auth/auth-session.model.js';
import EmailOtpChallenge from '../../models/auth/email-otp-challenge.model.js';
import RefreshRotationGrace from '../../models/auth/refresh-rotation-grace.model.js';
import Attribute from '../../models/catalog/attribute.model.js';
import AdminResourceLock from '../../models/catalog/catalog-lock.model.js';
import Category from '../../models/catalog/category.model.js';
import Product from '../../models/catalog/product.model.js';
import ProductVariant from '../../models/catalog/product-variant.model.js';
import Review from '../../models/catalog/review.model.js';
import Cart from '../../models/commerce/cart.model.js';
import CheckoutDraft from '../../models/commerce/checkout-draft.model.js';
import Order from '../../models/commerce/order.model.js';
import OrderReturnRequest from '../../models/commerce/order-return-request.model.js';
import UserNotification from '../../models/user/notification.model.js';
import UserSearchHistory from '../../models/user/search-history.model.js';
import UserAddress from '../../models/user/user-address.model.js';
import User from '../../models/user/user.model.js';
import WishList from '../../models/user/wish-list.model.js';

async function resetSeedableData() {
    const steps = [
        ['auth rate limits', AuthRateLimit],
        ['auth sessions', AuthSession],
        ['OTP challenges', EmailOtpChallenge],
        ['refresh rotation grace', RefreshRotationGrace],
        ['checkout drafts', CheckoutDraft],
        ['carts', Cart],
        ['return requests', OrderReturnRequest],
        ['reviews', Review],
        ['orders', Order],
        ['wishlists', WishList],
        ['search history', UserSearchHistory],
        ['notifications', UserNotification],
        ['addresses', UserAddress],
        ['variants', ProductVariant],
        ['products', Product],
        ['attributes', Attribute],
        ['categories', Category],
        ['catalog locks', AdminResourceLock],
        ['users', User],
    ];

    for (const [label, Model] of steps) {
        await Model.deleteMany({});
        console.log(`Cleared ${label}.`);
    }
}

export { resetSeedableData };
