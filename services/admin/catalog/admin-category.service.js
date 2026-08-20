import mongoose from 'mongoose';
import slugify from 'slugify';
import paginationConfig from '../../../config/pagination.js';
import Category from '../../../models/catalog/category.model.js';
import Product from '../../../models/catalog/product.model.js';
import AdminResourceLock from '../../../models/catalog/catalog-lock.model.js';
import { requestError } from '../../../utils/error/app-error.js';
import { buildPagination } from '../../../utils/pagination.js';
import { escapeRegex } from '../../../utils/regex.js';

const CATEGORY_TREE_LOCK_ID = 'category-tree';

async function lockCategoryTree(session) {
    await AdminResourceLock.updateOne(
        { _id: CATEGORY_TREE_LOCK_ID },
        { $currentDate: { updatedAt: true } },
        { upsert: true, session },
    );
}

async function listAdminCategoriesPage({ q, status, page }) {
    const filters = { q, status };

    const query = {};

    if (q)
        query.name = new RegExp(escapeRegex(q), 'i');

    if (status !== 'all')
        query.isActive = status === 'active';

    const totalItems = await Category.countDocuments(query);
    const pagination = buildPagination({ page, limit: paginationConfig.admin, totalItems });

    const categories = await Category
        .find(query)
        .populate('parent', 'name')
        .sort({ sortOrder: 1, name: 1 })
        .skip((pagination.page - 1) * paginationConfig.admin)
        .limit(paginationConfig.admin)
        .lean();
    const productCounts = await Product.aggregate([
        { $match: { category: { $in: categories.map(category => category._id) } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    const countByCategory = new Map(productCounts.map(item => [item._id.toString(), item.count]));

    return {
        categories: categories.map(category => ({
            id: category._id.toString(),
            name: category.name,
            slug: category.slug,
            parentId: category.parent?._id?.toString?.() || '',
            parentName: category.parent?.name || '',
            sortOrder: category.sortOrder,
            isActive: Boolean(category.isActive),
            productCount: countByCategory.get(category._id.toString()) ?? 0,
        })),
        filters,
        pagination,
    };
}

async function listAdminCategories() {
    const categories = await Category
        .find({})
        .sort({ sortOrder: 1, name: 1 })
        .lean();
    const parentIds = new Set(
        categories
            .map(category => category.parent?.toString())
            .filter(Boolean),
    );
    const categoryById = new Map(
        categories.map(category => [category._id.toString(), category]),
    );

    function getCategoryLabel(category) {
        const path = [];
        const visited = new Set();
        let current = category;

        while (current && !visited.has(current._id.toString())) {
            const id = current._id.toString();
            visited.add(id);
            path.unshift(current.name);
            current = current.parent
                ? categoryById.get(current.parent.toString())
                : null;
        }

        return path.join(' / ');
    }

    return categories.map(category => ({
        id: category._id.toString(),
        name: category.name,
        label: getCategoryLabel(category),
        isActive: Boolean(category.isActive),
        isLeaf: !parentIds.has(category._id.toString()),
    }));
}

async function listAdminCategoryOptions() {
    const categories = await Category.find({}).sort({ sortOrder: 1, name: 1 }).lean();
    const byParent = new Map();

    for (const category of categories) {
        const parentId = category.parent?.toString?.() || '';
        if (!byParent.has(parentId))
            byParent.set(parentId, []);
        byParent.get(parentId).push(category);
    }

    const options = [];
    const appendChildren = (parentId = '', parentPath = [], ancestry = new Set()) => {
        for (const category of byParent.get(parentId) || []) {
            const id = category._id.toString();
            if (ancestry.has(id))
                continue;
            const path = [...parentPath, category.name];
            options.push({ id, label: path.join(' / ') });
            appendChildren(id, path, new Set([...ancestry, id]));
        }
    };
    appendChildren();
    return options;
}

async function saveAdminCategory(categoryId, data) {
    const {
        name,
        parentId,
        sortOrder,
        isActive,
    } = data;
    const normalizedSlug = slugify(name, { lower: true, strict: true });

    try {
        await mongoose.connection.transaction(async (session) => {
            await lockCategoryTree(session);

            let currentCategory = null;

            if (categoryId) {
                currentCategory = await Category
                    .findById(categoryId)
                    .session(session);

                if (!currentCategory)
                    throw requestError('CATEGORY_NOT_FOUND');

                if (parentId === currentCategory._id.toString())
                    throw requestError('CATEGORY_SELF_PARENT');
            }

            let shouldMoveParentProducts = false;

            if (parentId) {
                const parent = await Category.findById(parentId).session(session);

                if (!parent)
                    throw requestError('CATEGORY_PARENT_NOT_FOUND');

                const parentHasDirectProducts = await Product
                    .exists({ category: parentId })
                    .session(session);

                shouldMoveParentProducts = Boolean(parentHasDirectProducts);

                if (parentHasDirectProducts && normalizedSlug !== 'khac')
                    throw requestError('CATEGORY_PARENT_HAS_PRODUCTS');

                if (
                    parentHasDirectProducts
                    && categoryId
                    && await Category.exists({ parent: categoryId }).session(session)
                )
                    throw requestError('CATEGORY_OTHER_MUST_BE_LEAF');

                let ancestor = parent;
                while (categoryId && ancestor) {
                    if (ancestor._id.toString() === categoryId)
                        throw requestError('CATEGORY_PARENT_CYCLE');

                    ancestor = ancestor.parent
                        ? await Category.findById(ancestor.parent).session(session)
                        : null;
                }
            }

            const value = {
                name,
                slug: normalizedSlug,
                parent: parentId || null,
                sortOrder,
                isActive,
            };
            let savedCategory = null;

            if (currentCategory) {
                currentCategory.set(value);
                savedCategory = await currentCategory.save({ session });
            } else {
                [savedCategory] = await Category.create([value], { session });
            }

            if (savedCategory && shouldMoveParentProducts) {
                await Product.updateMany(
                    { category: parentId },
                    { $set: { category: savedCategory._id } },
                    { session },
                );
            }

            return savedCategory;
        });

    } catch (error) {
        if (error?.code === 11000)
            throw requestError('CATEGORY_NAME_OR_SLUG_CONFLICT');

        throw error;
    }
}

export {
    listAdminCategories,
    listAdminCategoryOptions,
    listAdminCategoriesPage,
    lockCategoryTree,
    saveAdminCategory,
};
