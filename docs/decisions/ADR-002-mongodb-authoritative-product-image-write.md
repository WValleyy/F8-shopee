# ADR-002: MongoDB-authoritative product image write

## Context

Thao tác tạo hoặc cập nhật sản phẩm quản trị vừa thay đổi dữ liệu danh mục trong MongoDB vừa tải hình ảnh lên Cloudinary. Cloudinary không tham gia transaction của MongoDB, nên hai hệ thống không thể tạo một atomic commit chung.

## Decision

Admin product flow commit MongoDB trước với URL và `publicId` đã được xác định, sau đó upload ảnh lên Cloudinary với `rollback:false`.

Lỗi Cloudinary được ghi log và **không rollback catalog document**.

MongoDB commit có nhiều validation và transaction condition hơn Cloudinary upload, nên database được commit trước.

## Consequences

- Product và variant state trong MongoDB là authoritative.
- URL trong database có thể chưa có asset tương ứng nếu upload thất bại.
- Cleanup hình ảnh cũ hoặc đã gỡ là best-effort và có thể để lại orphaned asset.
- Policy này khác review image upload, nơi Cloudinary upload thành công là một phần của điều kiện tạo review.
