# Contract: Image lifecycle

## 1. Shared upload validation

Multer dùng memory storage. Middleware không chỉ tin MIME type do client gửi; buffer được `file-type` kiểm tra định dạng thực và chỉ chấp nhận JPEG, PNG hoặc WebP.

Upload limits:

| Domain | Max files | Max/file | Max total |
| --- | ---: | ---: | ---: |
| review | 3 | 1 MB | 3 MB |
| product gallery | 8 product images | 1 MB | 4 MB tổng dung lượng file trong request |
| avatar | 1 | 1 MB | 1 MB |

Product upload middleware nhận nhiều field ảnh variant. Giới hạn 4 MB được tính trên tổng dung lượng của tất cả file product và variant, không phải toàn bộ multipart body.

## 2. PublicId ownership

Cloudinary folders:

- product: `f8-shopee/products`;
- avatar: `f8-shopee/avatars`;
- review: `f8-shopee/reviews`.

`createPendingCloudinaryImage()` tạo UUID `publicId` trước, sau đó tính Cloudinary URL cố định từ `publicId`.

## 3. Admin product policy

Admin create/update:

```text
validate/prepare pending publicIds
→ MongoDB transaction commit product/variants
→ upload Cloudinary rollback:false
→ cleanup removed/old assets best-effort
```

Lỗi upload lên Cloudinary **không rollback MongoDB**. URL và `publicId` đã nằm trong database; UI có thể nhận URL của asset chưa được tạo và warning log được dùng để truy vết.

Nếu upload lỗi, admin có thể upload lại ảnh

### Historical variant image

Khi variant đã xuất hiện trong order, ảnh cũ của variant được giữ lại vì Order snapshot lưu image URL.

## 4. Avatar policy — MongoDB authoritative

Profile avatar cũng:

```text
MongoDB update URL/publicId
→ best-effort Cloudinary upload
→ best-effort cleanup avatar cũ
```

Nếu upload không tạo được asset, URL đã ghi trong database vẫn được giữ và UI có thể render ảnh lỗi. Dữ liệu không bị rollback khi Cloudinary báo lỗi; người dùng có thể upload lại avatar.

## 5. Review policy — Cloudinary-first + rollback

```text
prepare pending images
→ upload Cloudinary rollback:true
→ MongoDB transaction create review + rating delta
→ nếu DB fail: cleanup uploaded images
```

Tất cả ảnh review phải được upload thành công trước khi review được lưu, vì project không có tính năng chỉnh sửa review.

## 6. Cleanup semantics

`cleanupUploadedImage(s)` chạy best-effort. Nếu xóa thất bại, Cloudinary có thể còn orphaned asset; service ghi `publicId` và scope vào log để truy vết.

Trong workflow post-commit best-effort, lỗi cleanup không rollback MongoDB transaction đã commit.
