import {
    parseAdminOrderActionInput,
} from '../../requests-parser/admin/order.request.js';
import {
    transitionOrderStatusAsAdmin,
} from '../../../services/commerce/order/order-transition.service.js';

const adminOrderController = {
    async updateStatus(req, res) {
        const { action } = parseAdminOrderActionInput(req.body);
        await transitionOrderStatusAsAdmin(req.params.id, action);

        return res.json({});
    },
};

export default adminOrderController;
