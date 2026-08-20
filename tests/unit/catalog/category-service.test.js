import { describe, expect, it } from 'vitest';

import {
    buildEffectiveActiveLeafCategoryIds,
} from '../../../services/catalog/category.service.js';

function activeLeafIds(categories) {
    return [...buildEffectiveActiveLeafCategoryIds(categories)].sort();
}

// Category visibility depends on the complete active ancestor chain.
describe('category effective active leaves', () => {
    it('returns active leaves whose full ancestor chain is active', () => {
        expect(activeLeafIds([
            { _id: 'root', parent: null, isActive: true },
            { _id: 'phones', parent: 'root', isActive: true },
            { _id: 'laptops', parent: 'root', isActive: true },
        ])).toEqual(['laptops', 'phones']);
    });

    it('excludes descendants of an inactive parent', () => {
        expect(activeLeafIds([
            { _id: 'root', parent: null, isActive: false },
            { _id: 'phones', parent: 'root', isActive: true },
        ])).toEqual([]);
    });

    it('rejects categories with a missing parent', () => {
        expect(() => activeLeafIds([
            { _id: 'orphan', parent: 'missing', isActive: true },
        ])).toThrow('Category hierarchy contains a missing parent.');
    });

    it('rejects categories with a parent cycle', () => {
        expect(() => activeLeafIds([
            { _id: 'cycle-a', parent: 'cycle-b', isActive: true },
            { _id: 'cycle-b', parent: 'cycle-a', isActive: true },
        ])).toThrow('Category hierarchy contains a cycle.');
    });

    it('uses structural children when determining whether a category is a leaf', () => {
        expect(activeLeafIds([
            { _id: 'root', parent: null, isActive: true },
            { _id: 'inactive-child', parent: 'root', isActive: false },
        ])).toEqual([]);
    });
});
