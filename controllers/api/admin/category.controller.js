import { parseCategoryInput } from '../../requests-parser/admin/category.request.js';
import { saveAdminCategory } from '../../../services/admin/catalog/admin-category.service.js';

const adminCategoryController = {
    async create(req, res) {
        await saveAdminCategory(
            null,
            parseCategoryInput(req.body),
        );

        return res.status(201).json({});
    },

    async update(req, res) {
        await saveAdminCategory(
            req.params.id,
            parseCategoryInput(req.body),
        );

        return res.json({});
    },

};

export default adminCategoryController;
