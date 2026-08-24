# Operations: Database and seeding

## 1. Database startup

`server.js` gọi `connectDB()` trước khi mở HTTP listener. Connection helper retry một số lỗi mạng và server-selection error; ứng dụng chỉ nhận request sau khi kết nối MongoDB thành công.

## 2. Transaction requirement

Nhiều luồng nghiệp vụ dùng MongoDB transaction. MongoDB cục bộ cần chạy dưới dạng replica set; MongoDB Atlas hỗ trợ transaction trên deployment phù hợp.

## 3. Seed command and reset scope

```bash
npm run seed
```

Entry point là `scripts/data-seed/index.js`. Lệnh này reset toàn bộ collection do seed quản lý, không thêm fixture vào dữ liệu hiện có.

Reset hiện xóa dữ liệu auth/OTP/grace/session, cart/checkout/order/return/review, wishlist/search/notification/address, product/variant/attribute/category/catalog lock và user.

Không chạy seed trên database cần giữ dữ liệu.

## 4. Product data workflow

`scripts/data-seed/product-data/` chứa CSV nguồn H&M, dữ liệu catalog trung gian, Cloudinary image manifest và các script chuẩn bị dữ liệu.

Tạo lại `product-info.json` và `cloudinary-assets.json`:

```bash
python scripts/data-seed/product-data/create_product_info.py
```

Upload ảnh theo manifest và cập nhật URL vào dữ liệu trung gian:

```bash
node scripts/data-seed/product-data/upload-product-cloudinary.js
```

Chạy riêng product-data preflight:

```bash
node scripts/data-seed/preflight.js
```

Preflight chỉ đọc `product-info.json`; nó không kết nối hoặc thay đổi MongoDB. `product-info.js` kiểm tra:

- uniqueness của product code, product name, slug và SKU;
- uniqueness của category name/slug và quan hệ category parent/leaf;
- cấu trúc image, specification và variant option;
- kiểu dữ liệu và giới hạn của price, original price và stock.

## 5. Seed pipeline

Pipeline có năm pha:

1. Đọc và validate product data trước khi kết nối MongoDB.
2. Kết nối MongoDB và reset dữ liệu do seed quản lý.
3. Seed category, attribute, product và variant.
4. Seed user và business activity, sau đó validate các quan hệ trong memory.
5. Query lại MongoDB để verify các invariant đã được persist.

Nếu product data không hợp lệ ở pha đầu, pipeline dừng trước destructive reset.

Postflight đối chiếu product likes/sold/rating counters, variant stock, returned quantity và default address. Nó cũng xác nhận auth session, OTP challenge, auth rate-limit, refresh rotation grace và checkout draft vẫn rỗng.

## 6. Seeded users

Synthetic user không có avatar, có đúng một default shipping address, có wishlist và order. Một phần user có cart và return data.

Demo accounts:

```text
demo.customer@example.com / 123456
demo.edge@example.com / 123456
admin@example.com / 123456
```

`demo.edge@example.com` có completed order còn hoặc hết return window, partial/full return, shipping order và cancelled order để kiểm tra các trạng thái UI. Admin không có shipping address hoặc business activity.

## 7. Randomness

Business activity dùng `Math.random()`, vì vậy các lần seed không tạo ra cùng một kết quả cố định.
