from __future__ import annotations

import hashlib
import json
import math
import random
import re
import unicodedata
from pathlib import Path

import pandas as pd


# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
ARTICLES_CSV_PATH = BASE_DIR / "articles.csv"
OUTPUT_PATH = BASE_DIR / "product-info.json"
CLOUDINARY_ASSETS_OUTPUT_PATH = BASE_DIR / "cloudinary-assets.json"
IMAGE_SOURCE_ROOT = Path(
    r"F:\h-and-m-personalized-fashion-recommendations_2\images"
)

# Keep the public ID namespace aligned with the application's product uploads.
# The upload step will create the final URL from Cloudinary's response.
CLOUDINARY_PRODUCT_FOLDER = "f8-shopee/products"

MAX_COLORS_PER_PRODUCT = 2
UNKNOWN_SPEC_VALUE = "Không xác định"
BRAND = "H&M"
RANDOM_SEED = "f8-shopee-product-seed-v1"

DISCOUNT_PRODUCT_RATIO = 0.80
DISCOUNT_RATES = (0.10, 0.20, 0.30)
STOCK_MIN = 5
STOCK_MAX = 100
OUT_OF_STOCK_RATIO = 0.05

SIZES = {
    "adult": ("S", "M", "L"),
    "kids": ("110", "122", "134"),
}

# productCount is intentionally configured per leaf. Each leaf receives
# between 30 and 40 products, selected deterministically from valid candidates.
CATEGORY_TREE = {
    "Ladieswear": {
        "name": "Thời trang nữ",
        "slug": "thoi-trang-nu",
        "children": {
            "Garment Upper body": {
                "name": "Áo nữ",
                "slug": "ao-nu",
                "sizeGroup": "adult",
                "minColors": 4,
                "productCount": {"min": 10, "max": 20},
                "priceRange": {"min": 129_000, "max": 699_000},
            },
            "Garment Lower body": {
                "name": "Quần nữ",
                "slug": "quan-nu",
                "sizeGroup": "adult",
                "minColors": 4,
                "productCount": {"min": 10, "max": 20},
                "priceRange": {"min": 179_000, "max": 799_000},
            },
            "Accessories": {
                "name": "Phụ kiện nữ",
                "slug": "phu-kien-nu",
                "sizeGroup": None,
                "minColors": 4,
                "productCount": {"min": 10, "max": 20},
                "priceRange": {"min": 79_000, "max": 599_000},
            },
        },
    },
    "Menswear": {
        "name": "Thời trang nam",
        "slug": "thoi-trang-nam",
        "children": {
            "Garment Upper body": {
                "name": "Áo nam",
                "slug": "ao-nam",
                "sizeGroup": "adult",
                "minColors": 4,
                "productCount": {"min": 10, "max": 20},
                "priceRange": {"min": 149_000, "max": 799_000},
            },
            "Garment Lower body": {
                "name": "Quần nam",
                "slug": "quan-nam",
                "sizeGroup": "adult",
                "minColors": 4,
                "productCount": {"min": 10, "max": 20},
                "priceRange": {"min": 199_000, "max": 899_000},
            },
            "Accessories": {
                "name": "Phụ kiện nam",
                "slug": "phu-kien-nam",
                "sizeGroup": None,
                "minColors": 4,
                "productCount": {"min": 10, "max": 20},
                "priceRange": {"min": 79_000, "max": 599_000},
            },
        },
    },
    "Baby/Children": {
        "name": "Thời trang trẻ em",
        "slug": "thoi-trang-tre-em",
        "children": {
            "Garment Upper body": {
                "name": "Áo trẻ em",
                "slug": "ao-tre-em",
                "sizeGroup": "kids",
                "minColors": 4,
                "productCount": {"min": 10, "max": 20},
                "priceRange": {"min": 99_000, "max": 499_000},
            },
            "Garment Lower body": {
                "name": "Quần trẻ em",
                "slug": "quan-tre-em",
                "sizeGroup": "kids",
                "minColors": 4,
                "productCount": {"min": 10, "max": 20},
                "priceRange": {"min": 99_000, "max": 499_000},
            },
            "Accessories": {
                "name": "Phụ kiện trẻ em",
                "slug": "phu-kien-tre-em",
                "sizeGroup": None,
                "minColors": 4,
                "productCount": {"min": 10, "max": 20},
                "priceRange": {"min": 79_000, "max": 399_000},
            },
        },
    },
    "Sport": {
        "name": "Thể thao",
        "slug": "the-thao",
        "children": {
            "Garment Upper body": {
                "name": "Áo thể thao",
                "slug": "ao-the-thao",
                "sizeGroup": "adult",
                "minColors": 2,
                "productCount": {"min": 10, "max": 20},
                "priceRange": {"min": 149_000, "max": 699_000},
            },
            "Garment Lower body": {
                "name": "Quần thể thao",
                "slug": "quan-the-thao",
                "sizeGroup": "adult",
                "minColors": 2,
                "productCount": {"min": 10, "max": 20},
                "priceRange": {"min": 169_000, "max": 749_000},
            },
            "Accessories": {
                "name": "Phụ kiện thể thao",
                "slug": "phu-kien-the-thao",
                "sizeGroup": None,
                "minColors": 2,
                "productCount": {"min": 10, "max": 20},
                "priceRange": {"min": 79_000, "max": 599_000},
            },
        },
    },
}

SPECIFICATION_FIELDS = (
    ("Loại sản phẩm", "product_type_name"),
    ("Họa tiết", "graphical_appearance_name"),
    ("Dòng hàng", "garment_group_name"),
    ("Bộ sưu tập", "section_name"),
)

REQUIRED_COLUMNS = {
    "article_id",
    "product_code",
    "prod_name",
    "product_type_name",
    "product_group_name",
    "graphical_appearance_name",
    "colour_group_name",
    "index_group_name",
    "section_name",
    "garment_group_name",
    "detail_desc",
}


# -----------------------------------------------------------------------------
# Generic helpers
# -----------------------------------------------------------------------------


def clean(value) -> str | None:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None

    text = str(value).strip()
    return text or None


def first_non_empty(series: pd.Series) -> str | None:
    for value in series:
        cleaned = clean(value)
        if cleaned is not None:
            return cleaned
    return None


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_value).strip("-").lower()
    return slug or "product"


def stable_random(seed_text: str) -> random.Random:
    digest = hashlib.sha256(
        f"{RANDOM_SEED}:{seed_text}".encode("utf-8")
    ).digest()
    seed = int.from_bytes(digest[:8], "big")
    return random.Random(seed)


def build_source_image_path(article_id: str) -> Path:
    return (
        IMAGE_SOURCE_ROOT
        / article_id[:3]
        / f"{article_id}.jpg"
    )


def snap_price(value: float) -> int:
    # Keep prices on familiar x9,000 VND points, matching the old seed style.
    return max(9_000, round(value / 10_000) * 10_000 - 1_000)


# -----------------------------------------------------------------------------
# Input + taxonomy
# -----------------------------------------------------------------------------


def load_articles(path: Path) -> pd.DataFrame:
    dataframe = pd.read_csv(
        path,
        dtype={"article_id": "string", "product_code": "string"},
        keep_default_na=True,
    )

    missing_columns = REQUIRED_COLUMNS.difference(dataframe.columns)
    if missing_columns:
        missing = ", ".join(sorted(missing_columns))
        raise ValueError(f"articles.csv thiếu các cột bắt buộc: {missing}")

    return dataframe


def resolve_category(index_group_name: str, product_group_name: str):
    parent = CATEGORY_TREE.get(index_group_name)
    if parent is None:
        return None

    leaf = parent["children"].get(product_group_name)
    if leaf is None:
        return None

    return parent, leaf


# -----------------------------------------------------------------------------
# Product data builders
# -----------------------------------------------------------------------------


def build_specifications(product_rows: pd.DataFrame) -> list[dict]:
    specifications = []

    for attribute_name, column in SPECIFICATION_FIELDS:
        value = first_non_empty(product_rows[column]) or UNKNOWN_SPEC_VALUE
        specifications.append({
            "attribute": attribute_name,
            "value": value,
        })

    return specifications


def count_colourways(product_rows: pd.DataFrame) -> int:
    colours = set()

    for row in product_rows.itertuples(index=False):
        article_id = clean(row.article_id)
        colour_name = clean(row.colour_group_name)

        if (
            article_id is not None
            and colour_name is not None
            and build_source_image_path(article_id).is_file()
        ):
            colours.add(colour_name)

    return len(colours)


def select_colorways(product_rows: pd.DataFrame) -> list[dict]:
    # Keep the first valid article encountered for each colour name, then cap
    # the number of colours. This makes the first selected colourway the one
    # whose image becomes Product.images[0].
    selected = []
    seen_colours = set()

    for row in product_rows.itertuples(index=False):
        article_id = clean(row.article_id)
        colour_name = clean(row.colour_group_name)

        if article_id is None or colour_name is None:
            continue
        if not build_source_image_path(article_id).is_file():
            continue
        if colour_name in seen_colours:
            continue

        seen_colours.add(colour_name)
        selected.append({
            "articleId": article_id,
            "colourName": colour_name,
        })

        if len(selected) >= MAX_COLORS_PER_PRODUCT:
            break

    return selected


def build_product_image(product_code: str, article_id: str) -> dict:
    public_id = (
        f"{CLOUDINARY_PRODUCT_FOLDER}/{product_code}/{article_id}"
    )
    return {
        "url": "",
        "publicId": public_id,
    }


def build_variant_image(product_code: str, article_id: str) -> dict:
    public_id = (
        f"{CLOUDINARY_PRODUCT_FOLDER}/{product_code}/variants/{article_id}"
    )
    return {
        "url": "",
        "publicId": public_id,
    }


def build_price(
    price_key: str,
    leaf: dict,
    used_prices: set[int] | None = None,
) -> tuple[int, int]:
    minimum = leaf["priceRange"]["min"]
    maximum = leaf["priceRange"]["max"]
    if used_prices is None:
        used_prices = set()

    for attempt in range(100):
        rng = stable_random(f"price:{price_key}:{attempt}")
        original_price = snap_price(rng.randint(minimum, maximum))

        if rng.random() >= DISCOUNT_PRODUCT_RATIO:
            price = original_price
        else:
            discount_rate = rng.choice(DISCOUNT_RATES)
            price = snap_price(original_price * (1 - discount_rate))
            price = min(price, original_price)

            if price == original_price:
                price = max(9_000, original_price - 10_000)

        if price not in used_prices:
            return price, original_price

    raise ValueError(
        f"Không thể tạo giá khác nhau cho {price_key} trong khoảng giá "
        f"{minimum}..{maximum}."
    )


def build_stock(sku: str) -> int:
    rng = stable_random(f"stock:{sku}")

    if rng.random() < OUT_OF_STOCK_RATIO:
        return 0

    return rng.randint(STOCK_MIN, STOCK_MAX)


def make_sku(article_id: str, size: str | None) -> str:
    return f"HM-{article_id}-{size or 'OS'}".upper()


def build_variant_options(colour_name: str, size: str | None) -> list[dict]:
    options = [{"name": "Màu sắc", "value": colour_name}]

    if size is not None:
        options.append({"name": "Size", "value": size})

    return options


def build_variants(
    product_code: str,
    colorways: list[dict],
    leaf: dict,
) -> list[dict]:
    size_group = leaf["sizeGroup"]
    sizes = SIZES[size_group] if size_group else (None,)
    variants = []
    used_prices = set()

    for colorway in colorways:
        article_id = colorway["articleId"]
        colour_name = colorway["colourName"]
        image = build_variant_image(product_code, article_id)
        price, original_price = build_price(
            f"{product_code}:{article_id}",
            leaf,
            used_prices,
        )
        used_prices.add(price)

        for size in sizes:
            sku = make_sku(article_id, size)
            variants.append({
                "articleId": article_id,
                "sku": sku,
                "options": build_variant_options(colour_name, size),
                "price": price,
                "originalPrice": original_price,
                "stock": build_stock(sku),
                "image": image,
                "isPublished": True,
            })

    return variants


def build_product(
    product_code: str,
    product_rows: pd.DataFrame,
    parent: dict,
    leaf: dict,
) -> dict | None:
    name = first_non_empty(product_rows["prod_name"])
    if name is None:
        return None

    if count_colourways(product_rows) < leaf["minColors"]:
        return None

    colorways = select_colorways(product_rows)
    if not colorways:
        return None

    description = first_non_empty(product_rows["detail_desc"])
    first_article_id = colorways[0]["articleId"]

    return {
        "source": {
            "productCode": product_code,
        },
        "name": name,
        "slug": f"{slugify(name)}-{product_code}",
        "description": description or "",
        "category": {
            "parent": {
                "name": parent["name"],
                "slug": parent["slug"],
            },
            "leaf": {
                "name": leaf["name"],
                "slug": leaf["slug"],
            },
        },
        "brand": BRAND,
        "images": [build_product_image(product_code, first_article_id)],
        "specifications": build_specifications(product_rows),
        "rating": {
            "sum": 0,
            "average": 0,
            "count": 0,
        },
        "likes": 0,
        "sold": 0,
        "isPublished": True,
        "variants": build_variants(
            product_code,
            colorways,
            leaf,
        ),
    }


# -----------------------------------------------------------------------------
# Selection by leaf
# -----------------------------------------------------------------------------


def candidate_rank(leaf_slug: str, product_code: str) -> str:
    return hashlib.sha256(
        f"leaf:{leaf_slug}:product:{product_code}".encode("utf-8")
    ).hexdigest()


def select_products_for_leaf(products: list[dict], leaf: dict) -> list[dict]:
    minimum = leaf["productCount"]["min"]
    maximum = leaf["productCount"]["max"]

    if minimum < 0 or maximum < minimum:
        raise ValueError(
            f"productCount không hợp lệ cho {leaf['slug']}: {minimum}..{maximum}"
        )

    count_rng = stable_random(f"count:{leaf['slug']}")
    target_count = count_rng.randint(
        minimum,
        maximum,
    )

    ordered = sorted(
        products,
        key=lambda product: candidate_rank(
            leaf["slug"], product["source"]["productCode"]
        ),
    )

    return ordered[:min(target_count, len(ordered))]


def build_products(dataframe: pd.DataFrame) -> list[dict]:
    products = []

    for index_group_name, parent in CATEGORY_TREE.items():
        for product_group_name, leaf in parent["children"].items():
            leaf_rows = dataframe[
                (dataframe["index_group_name"] == index_group_name)
                & (dataframe["product_group_name"] == product_group_name)
            ]

            candidates = []
            for product_code, product_rows in leaf_rows.groupby(
                "product_code", sort=False, dropna=True
            ):
                product_code = clean(product_code)
                if product_code is None:
                    continue

                product = build_product(
                    product_code,
                    product_rows,
                    parent,
                    leaf,
                )
                if product is not None:
                    candidates.append(product)

            selected = select_products_for_leaf(candidates, leaf)
            products.extend(selected)
            print(
                f"[{parent['name']} > {leaf['name']}] "
                f"{len(selected)}/{len(candidates)} product được chọn"
            )

    return products


# -----------------------------------------------------------------------------
# Output validation
# -----------------------------------------------------------------------------


def validate_products(products: list[dict]) -> None:
    product_codes = set()
    slugs = set()
    skus = set()

    for product in products:
        product_code = product["source"]["productCode"]

        if product_code in product_codes:
            raise ValueError(f"Trùng productCode: {product_code}")
        product_codes.add(product_code)

        if product["slug"] in slugs:
            raise ValueError(f"Trùng product slug: {product['slug']}")
        slugs.add(product["slug"])

        if len(product["images"]) != 1:
            raise ValueError(
                f"{product_code} phải có đúng 1 ảnh product, "
                f"nhưng có {len(product['images'])}."
            )

        colour_values = {
            option["value"]
            for variant in product["variants"]
            for option in variant["options"]
            if option["name"] == "Màu sắc"
        }
        if len(colour_values) > MAX_COLORS_PER_PRODUCT:
            raise ValueError(
                f"{product_code} có {len(colour_values)} màu, vượt giới hạn "
                f"{MAX_COLORS_PER_PRODUCT}."
            )

        for specification in product["specifications"]:
            if not specification["value"]:
                raise ValueError(
                    f"{product_code} có specification không có value."
                )

        for variant in product["variants"]:
            if variant["sku"] in skus:
                raise ValueError(f"Trùng SKU: {variant['sku']}")
            skus.add(variant["sku"])

            if variant["price"] > variant["originalPrice"]:
                raise ValueError(
                    f"{variant['sku']} có price > originalPrice."
                )

            if variant["stock"] < 0:
                raise ValueError(f"{variant['sku']} có stock âm.")


def write_products(products: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(products, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def build_cloudinary_assets(products: list[dict]) -> dict:
    assets_by_public_id = {}

    def add_asset(
        image: dict,
        asset_type: str,
        product_code: str,
        article_id: str,
    ) -> None:
        asset = {
            "publicId": image["publicId"],
            "url": image["url"],
            "assetType": asset_type,
            "productCode": product_code,
            "articleId": article_id,
            "sourcePath": str(build_source_image_path(article_id)),
        }
        existing = assets_by_public_id.get(asset["publicId"])

        if existing is not None and existing != asset:
            raise ValueError(
                f"Public ID trùng với metadata khác: {asset['publicId']}"
            )

        assets_by_public_id[asset["publicId"]] = asset

    for product in products:
        product_code = product["source"]["productCode"]
        first_article_id = product["variants"][0]["articleId"]

        add_asset(
            product["images"][0],
            "product",
            product_code,
            first_article_id,
        )

        for variant in product["variants"]:
            add_asset(
                variant["image"],
                "variant",
                product_code,
                variant["articleId"],
            )

    return {
        "provider": "cloudinary",
        "assets": list(assets_by_public_id.values()),
    }


def write_cloudinary_assets(products: list[dict], path: Path) -> None:
    manifest = build_cloudinary_assets(products)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------


def main() -> None:
    articles = load_articles(ARTICLES_CSV_PATH)
    products = build_products(articles)
    validate_products(products)
    write_products(products, OUTPUT_PATH)
    write_cloudinary_assets(products, CLOUDINARY_ASSETS_OUTPUT_PATH)

    variant_count = sum(len(product["variants"]) for product in products)
    print(
        f"Đã tạo {OUTPUT_PATH} với {len(products)} products "
        f"và {variant_count} variants.\n"
        f"Đã tạo {CLOUDINARY_ASSETS_OUTPUT_PATH}."
    )


if __name__ == "__main__":
    main()
