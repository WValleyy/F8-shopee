import dataSeedConfig from './config.js';
import { loadProductInfo } from './product-info.js';

async function main() {
    const source = await loadProductInfo(dataSeedConfig.productInfoPath);
    const productsByLeaf = new Map();

    source.products.forEach((product) => {
        const key = [
            product.category.parent.name,
            product.category.leaf.name,
        ].join(' > ');
        productsByLeaf.set(key, (productsByLeaf.get(key) || 0) + 1);
    });

    console.log('Product seed data is valid.');
    console.table(source.summary);
    console.table(
        [...productsByLeaf].map(([category, products]) => ({
            category,
            products,
        })),
    );
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
