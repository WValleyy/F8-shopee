import Order from '../../../models/commerce/order.model.js';
import Product from '../../../models/catalog/product.model.js';
import ProductVariant from '../../../models/catalog/product-variant.model.js';
import { incidentError } from '../../../utils/error/app-error.js';

async function restoreOrderInventory(order, session) {
    if (!session)
        throw new TypeError('Order inventory restoration requires a session.');

    const restoredAt = new Date();
    const claim = await Order.updateOne(
        {
            _id: order._id,
            inventoryRestoredAt: null,
        },
        { $set: { inventoryRestoredAt: restoredAt } },
        { session },
    );

    if (claim.modifiedCount !== 1)
        return;

    for (const item of order.items) {
        const quantity = item.quantity;

        const productResult = await Product.updateOne(
            {
                _id: item.product,
                sold: { $gte: quantity },
            },
            { $inc: { sold: -quantity } },
            { session },
        );

        if (productResult.modifiedCount !== 1) {
            throw incidentError('Inventory could not be restored.', {
                code: 'INVENTORY_RESTORE_FAILED',
            });
        }

        const variantResult = await ProductVariant.updateOne(
            { _id: item.variant },
            { $inc: { stock: quantity } },
            { session },
        );

        if (variantResult.matchedCount !== 1) {
            throw incidentError('Inventory could not be restored.', {
                code: 'INVENTORY_RESTORE_FAILED',
            });
        }
    }

    order.inventoryRestoredAt = restoredAt;
}

export {
    restoreOrderInventory,
};
