import { listAddresses } from '../../../services/user/address.service.js';
import { getCartState } from '../../../services/commerce/cart.service.js';
import {
    getCheckoutPageState,
} from '../../../services/commerce/checkout/checkout-page.service.js';
import {
    parseCheckoutAddressQuery,
    parseCheckoutPageQuery,
} from '../../requests-parser/commerce/checkout.request.js';
import {
    isAppErrorCode,
    requestError,
} from '../../../utils/error/app-error.js';
import { renderPartial } from '../shared/render-response.js';
import { applyViewConfig } from '../shared/view-config.js';

async function cart(req, res) {
    const title = 'Shopee Việt Nam | Giỏ hàng';
    const cartState = await getCartState(req.authUserId);

    applyViewConfig(res, 'cart', { title });

    res.render('pages/storefront/cart', {
        cart: cartState,
        isGuestCart: !req.authUserId,
    });
}

async function checkout(req, res) {
    const title = 'Shopee Việt Nam | Thanh toán';
    applyViewConfig(res, 'checkout', { title });

    const { draftId } = parseCheckoutPageQuery(req.query);
    let checkoutState;

    try {
        checkoutState = await getCheckoutPageState(req.authUserId, draftId);
    } catch (error) {
        if (isAppErrorCode(error, 'CHECKOUT_EXPIRED'))
            throw requestError('CHECKOUT_NOT_FOUND');

        if (isAppErrorCode(error, 'CHECKOUT_ITEMS_UNAVAILABLE')) {
            throw requestError('CHECKOUT_ITEMS_UNAVAILABLE', {
                viewAction: {
                    actionHref: '/cart',
                    actionLabel: 'Quay lại giỏ hàng',
                },
            });
        }

        throw error;
    }

    res.render('pages/storefront/checkout/checkout', {
        checkout: checkoutState,
        draftId,
    });
}

async function checkoutAddressPartials(req, res) {
    const { selectedAddressId: requestedId } = parseCheckoutAddressQuery(req.query);
    const addresses = await listAddresses(req.authUserId);
    const activeAddress = addresses.find(address => address.id === requestedId)
        || addresses.find(address => address.isDefault)
        || null;
    const selectedAddressId = activeAddress?.id || '';

    return renderPartial(res, {
        view: 'pages/storefront/checkout/address-list',
        data: { addresses, selectedAddressId },
    });
}

export default {
    cart,
    checkout,
    checkoutAddressPartials,
};
