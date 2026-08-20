import {
    parseProductBulkActionInput,
    parseProductInput,
} from '../../requests-parser/admin/product.request.js';
import {
    applyAdminProductBulkAction,
    deleteAdminProduct,
    saveAdminProduct,
} from '../../../services/admin/catalog/admin-product.service.js';

const adminProductController = {
    async create(req, res) {
        const input = parseProductInput(req.body, req.files);
        await saveAdminProduct(null, input);

        return res.status(201).json({});
    },

    async update(req, res) {
        const input = parseProductInput(req.body, req.files);
        await saveAdminProduct(req.params.id, input);

        return res.json({});
    },

    async remove(req, res) {
        await deleteAdminProduct(req.params.id);
        return res.json({});
    },

    async applyBulkAction(req, res) {
        const { productIds, action } = parseProductBulkActionInput(req.body);
        await applyAdminProductBulkAction(productIds, action);

        return res.json({});
    },
};

export default adminProductController;
