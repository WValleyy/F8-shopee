import { placeOrder } from '../../../services/commerce/order/order-placement.service.js';
import { transitionOrderStatus } from '../../../services/commerce/order/order-transition.service.js';
import {
    createOrderReturnRequest,
} from '../../../services/commerce/order/order-return.service.js';
import {
    parseCreateOrderInput,
    parseUserOrderActionInput,
} from '../../requests-parser/commerce/order.request.js';
import { parseReturnRequestInput } from '../../requests-parser/commerce/return.request.js';
import {
    getNotificationPreview,
} from '../../../services/user/notification.service.js';

const orderApiController = {
    async createOrder(req, res) {
        const input = parseCreateOrderInput(req.body);

        await placeOrder(req.authUserId, input);

        return res.json({});
    },

    async updateStatus(req, res) {
        const { action } = parseUserOrderActionInput(req.body);
        const completedOrder = await transitionOrderStatus(
            req.authUserId,
            req.params.orderId,
            action,
        );

        return res.json({
            data: completedOrder
                ? {
                    notificationPreview: await getNotificationPreview(
                        req.authUserId,
                    ),
                }
                : {},
        });
    },

    async createReturn(req, res) {
        const input = parseReturnRequestInput(req.body);
        await createOrderReturnRequest(
            req.authUserId,
            req.params.orderId,
            input,
        );

        return res.json({});
    },
};

export default orderApiController;
