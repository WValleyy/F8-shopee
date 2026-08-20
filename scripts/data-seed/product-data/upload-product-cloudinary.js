import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import cloudinary from '../../../services/image/cloudinary-client.js';

const BASE_DIR = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_PATH = path.join(BASE_DIR, 'cloudinary-assets.json');
const PRODUCTS_PATH = path.join(BASE_DIR, 'product-info.json');

function getCloudinaryUrl(publicId) {
    return cloudinary.url(publicId, {
        secure: true,
        resource_type: 'image',
        type: 'upload',
    });
}

async function readJson(filePath) {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJsonAtomically(filePath, value) {
    const temporaryPath = `${filePath}.${process.pid}.tmp`;

    await fs.writeFile(
        temporaryPath,
        `${JSON.stringify(value, null, 2)}\n`,
        'utf8',
    );
    await fs.rename(temporaryPath, filePath);
}

function validateAssets(assets) {
    const publicIds = new Set();

    assets.forEach((asset, index) => {
        if (!asset.publicId)
            throw new Error(`Asset ${index} is missing publicId.`);

        if (!asset.sourcePath)
            throw new Error(`Asset ${asset.publicId} is missing sourcePath.`);

        if (publicIds.has(asset.publicId))
            throw new Error(`Duplicate publicId: ${asset.publicId}`);

        publicIds.add(asset.publicId);
    });
}

async function uploadAsset(asset) {
    const sourcePath = path.resolve(asset.sourcePath);

    await fs.access(sourcePath);

    const lastSlashIndex = asset.publicId.lastIndexOf('/');
    if (lastSlashIndex < 1)
        throw new Error(`Invalid publicId folder: ${asset.publicId}`);

    const uploaded = await cloudinary.uploader.upload(sourcePath, {
        public_id: asset.publicId,
        asset_folder: asset.publicId.slice(0, lastSlashIndex),
        resource_type: 'image',
        type: 'upload',
        overwrite: false,
        unique_filename: false,
        use_asset_folder_as_public_id_prefix: false,
    });

    return uploaded.secure_url || getCloudinaryUrl(asset.publicId);
}

function buildImageReferences(products) {
    const referencesByPublicId = new Map();

    function addReference(image) {
        const references = referencesByPublicId.get(image.publicId) || [];
        references.push(image);
        referencesByPublicId.set(image.publicId, references);
    }

    products.forEach(product => {
        product.images.forEach(addReference);
        product.variants.forEach(variant => addReference(variant.image));
    });

    return referencesByPublicId;
}

function updateImageReferences(referencesByPublicId, publicId, url) {
    const references = referencesByPublicId.get(publicId);

    if (!references?.length)
        throw new Error(`Missing product reference: ${publicId}`);

    references.forEach(image => {
        image.url = url;
    });
}

async function main() {
    const manifest = await readJson(ASSETS_PATH);
    const products = await readJson(PRODUCTS_PATH);
    const assets = manifest.assets || [];

    validateAssets(assets);

    const referencesByPublicId = buildImageReferences(products);

    for (const [index, asset] of assets.entries()) {
        if (asset.url)
            continue;

        const url = await uploadAsset(asset);

        asset.url = url;
        updateImageReferences(
            referencesByPublicId,
            asset.publicId,
            url,
        );

        await writeJsonAtomically(ASSETS_PATH, manifest);
        await writeJsonAtomically(PRODUCTS_PATH, products);

        console.log(
            `[${index + 1}/${assets.length}] Uploaded ${asset.publicId}`,
        );
    }

    console.log(`Updated ${PRODUCTS_PATH}`);
    console.log(`Updated ${ASSETS_PATH}`);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
