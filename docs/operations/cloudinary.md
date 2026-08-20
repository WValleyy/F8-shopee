# Operations: Cloudinary

## 1. Credentials

Required environment:

- `CLOUDINARY_CLOUD_NAME`;
- `CLOUDINARY_API_KEY`;
- `CLOUDINARY_API_SECRET`.

## 2. Namespace

Root folders hiện tại:

```text
f8-shopee/products
f8-shopee/avatars
f8-shopee/reviews
```

`publicId` của variant image nằm trong namespace riêng của product, do admin product service tạo.

## 3. Pending image model

Source buffer → `createPendingCloudinaryImage()` → UUID `publicId` + secure URL cố định. Nhờ vậy document có URL và `publicId` trước khi upload thực sự bắt đầu.

Đây là cơ sở cho workflow DB-first, best-effort của ảnh product và avatar.

## 4. Upload modes

### `rollback:false`

Các upload chạy best-effort và có thể chạy song song. Lỗi của từng upload được ghi log nhưng không throw, vì vậy state mà caller đã commit không bị rollback.

### `rollback:true`

Service theo dõi từng upload. Khi có lỗi, nó cleanup các image có thể đã upload rồi throw lại lỗi. Mode này được dùng khi tạo review.

## 5. Destroy/cleanup

Thao tác xóa dùng `invalidate:true`. Lỗi cleanup không làm thất bại thao tác nghiệp vụ đã commit; service ghi warning log kèm `publicId` và scope. Cleanup có tính idempotent và chạy best-effort vì lỗi network có thể xảy ra sau khi Cloudinary đã xử lý request.
