# Domain: Returns and Reviews

## 1. Return eligibility

Yêu cầu trả hàng được tạo khi:

- người dùng có role `USER`, tài khoản đang hoạt động và chưa được lên lịch xóa;
- đơn hàng thuộc người dùng;
- đơn hàng đang ở trạng thái `COMPLETED` và có `completedAt` hợp lệ;
- yêu cầu được gửi trong **7 ngày** kể từ `completedAt`;
- variant cần trả có trong order;
- tổng `returnedQuantity` cũ và số lượng trả mới không vượt số lượng đã mua.


## 2. Return semantics

Yêu cầu trả hàng **không có trạng thái chờ duyệt, chấp nhận hoặc từ chối**.

Một lần trả hàng thành công ghi dữ liệu trả hàng và cập nhật số lượng của đơn hàng, tồn kho cùng các bộ đếm liên quan trong một transaction. Việc trả hàng được **áp dụng ngay**, không tạo yêu cầu chờ admin duyệt.

Chi tiết nằm trong [`../workflows/return-review-flow.md`](../workflows/return-review-flow.md).

## 3. Review eligibility

Việc tạo review yêu cầu strict auth. Người dùng được đánh giá product hoặc variant thuộc đơn hàng đã hoàn thành, kể cả khi item đã được trả lại toàn bộ.

## 4. Review data

- rating 1–5;
- content tối đa 2000 ký tự;
- tối đa 3 hình ảnh, mỗi file 1 MB, tổng 3 MB;
- `isPublished` quyết định đánh giá có đóng góp vào điểm hiển thị trên cửa hàng hay không;
- `likedBy` lưu những người dùng đã đánh dấu đánh giá hữu ích.

## 5. Rating aggregate

Đánh giá đang hiển thị đóng góp vào `Product.rating`. Việc tạo đánh giá hoặc đổi trạng thái hiển thị cập nhật review và rating aggregate trong cùng transaction.

## 6. Review image lifecycle

Ảnh review dùng policy Cloudinary-first: ảnh đã upload được cleanup nếu transaction không commit thành công. Cách xử lý này khác ảnh product và avatar, nơi MongoDB là authoritative source.

Chi tiết nằm trong [`../contracts/image-lifecycle.md`](../contracts/image-lifecycle.md).
