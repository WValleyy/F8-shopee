import mongoose from 'mongoose';

import Category from '../../models/catalog/category.model.js';

async function getEffectiveActiveLeafCategoryIds(options = {}) {
    const {
        session,
    } = options;
    const query = Category.find({}).select('_id parent isActive').lean();

    if (session)
        query.session(session);

    const categories = await query;

    return [...buildEffectiveActiveLeafCategoryIds(categories)]
        .map(id => new mongoose.Types.ObjectId(id));
}

async function getCategoryAssignmentState(categoryId, options = {}) {
    const {
        session,
    } = options;
    const query = Category.find({})
        .select('_id parent name slug isActive')
        .lean();

    if (session)
        query.session(session);

    const categories = await query;
    const selectedCategoryId = String(categoryId);
    const exists = categories.some(
        category => categoryIdOf(category) === selectedCategoryId,
    );
    const activeIds = buildEffectiveActiveCategoryIds(categories);
    const parentIds = new Set(
        categories
            .map(parentIdOf)
            .filter(Boolean),
    );

    return {
        exists,
        isEffectivelyActive: activeIds.has(selectedCategoryId),
        isLeaf: exists && !parentIds.has(selectedCategoryId),
        categoryPath: exists
            ? buildCategoryPath(categories, selectedCategoryId)
            : [],
    };
}

async function isCategoryEffectivelyActiveLeaf(categoryId, options = {}) {
    const categoryState = await getCategoryAssignmentState(categoryId, options);

    return categoryState.isEffectivelyActive && categoryState.isLeaf;
}

function buildEffectiveActiveLeafCategoryIds(categories = []) {
    const activeIds = buildEffectiveActiveCategoryIds(categories);
    const parentIds = new Set(
        categories
            .map(parentIdOf)
            .filter(Boolean),
    );

    return new Set(
        [...activeIds].filter(categoryId => !parentIds.has(categoryId)),
    );
}

function buildEffectiveActiveCategoryIds(categories = []) {
    const byId = new Map(
        categories.map(category => [categoryIdOf(category), category]),
    );
    const memo = new Map();

    function isActive(categoryId, trail = new Set()) {
        if (memo.has(categoryId))
            return memo.get(categoryId);

        const category = byId.get(categoryId);

        if (!category)
            throw new Error('Category hierarchy contains a missing parent.');
        if (trail.has(categoryId))
            throw new Error('Category hierarchy contains a cycle.');

        const parentId = parentIdOf(category);
        const parentIsActive = !parentId || isActive(
            parentId,
            new Set(trail).add(categoryId),
        );
        const result = category.isActive !== false && parentIsActive;

        memo.set(categoryId, result);
        return result;
    }

    return new Set([...byId.keys()].filter(categoryId => isActive(categoryId)));
}

function buildCategoryPath(categories, selectedCategoryId) {
    const byId = new Map(
        categories.map(category => [categoryIdOf(category), category]),
    );
    const categoryPath = [];
    let category = byId.get(String(selectedCategoryId));

    while (category) {
        categoryPath.unshift({
            id: categoryIdOf(category),
            name: category.name,
            slug: category.slug,
        });

        const parentId = parentIdOf(category);
        category = parentId ? byId.get(parentId) : null;
    }

    return categoryPath;
}

function categoryIdOf(category) {
    return String(category._id);
}

function parentIdOf(category) {
    return category.parent ? String(category.parent) : '';
}

export {
    buildCategoryPath,
    buildEffectiveActiveCategoryIds,
    buildEffectiveActiveLeafCategoryIds,
    getCategoryAssignmentState,
    getEffectiveActiveLeafCategoryIds,
    isCategoryEffectivelyActiveLeaf,
};
