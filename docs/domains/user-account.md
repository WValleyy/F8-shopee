# Domain: User account

## 1. Profile

Người dùng có thể cập nhật các profile field theo giới hạn của parser và model. Avatar lưu URL cùng Cloudinary `publicId`; MongoDB là authoritative source, còn thao tác với Cloudinary chạy best-effort theo image contract.

## 2. Address book

Địa chỉ thuộc người dùng và được lưu thành shipping-address snapshot khi tạo order.

Quy tắc hiện tại:

- tối đa **10 địa chỉ cho mỗi người dùng**;
- địa chỉ đầu tiên trở thành địa chỉ mặc định;
- service và cơ sở dữ liệu duy trì duy nhất một địa chỉ mặc định;
- không được xóa địa chỉ mặc định khi chưa chọn địa chỉ mặc định khác;
- order đã tạo giữ shipping-address snapshot và không thay đổi theo lần sửa địa chỉ sau đó.

## 3. Password/email/session

Giao diện tài khoản hỗ trợ đổi mật khẩu, xác minh hoặc đổi email và quản lý phiên. Các quy tắc xác thực nằm trong [`authentication.md`](./authentication.md); luồng thực thi nằm trong [`../workflows/authentication-flows.md`](../workflows/authentication-flows.md).

## 4. Wishlist

Thêm hoặc xóa wishlist dùng light auth. Chỉ product đủ điều kiện hiển thị trên storefront mới được thêm; quan hệ wishlist được đồng bộ với bộ đếm `Product.likes`.

## 5. Search history

Người dùng đã xác thực lưu tối đa **6 mục** ở server. Lịch sử của khách được frontend lưu trong `localStorage` với khóa `f8-shopee.home-search-history`, cũng giới hạn 6 mục.

## 6. Notifications

Các loại thông báo hiện tại:

- `EMAIL_VERIFICATION_REQUIRED`;
- `ORDER_COMPLETED`.

Notification preview được hiển thị ở header. Thao tác đánh dấu đã đọc hoặc đọc tất cả dùng light auth và trả preview mới cho giao diện.

## 7. Scheduled account deletion

Xóa tài khoản có **hai giai đoạn**, không xóa vĩnh viễn ngay khi người dùng gửi yêu cầu.

### Stage 1 — customer schedule

Quy tắc nghiệp vụ:

- người dùng có role `USER` và request đi qua strict auth;
- phải cung cấp mật khẩu hiện tại;
- không được lên lịch nếu còn đơn hàng `SHIPPING`;
- tài khoản chuyển sang không hoạt động ngay khi lên lịch;
- `purgeAfter` được đặt **20 phút** sau thời điểm schedule;
- toàn bộ `AuthSession` bị thu hồi; `RefreshRotationGrace` và `EmailOtpChallenge` liên quan bị xóa;
- client bị xóa cookie xác thực sau khi thao tác thành công.

Khoảng chờ 20 phút là một phần của account-deletion policy, nhằm đảm bảo access token cũ đã hết hạn trước khi account bị purge.

### Stage 2 — admin purge

Purge được thực hiện khi:

- tài khoản đã được lên lịch (`purgeAfter` tồn tại);
- đã đến thời điểm xóa.

Purge sẽ:

- xóa dữ liệu riêng tư và tạm thời thuộc người dùng;
- giảm bộ đếm `Product.likes` theo danh sách yêu thích trước khi xóa danh sách;
- **ẩn danh, không xóa vĩnh viễn** lịch sử đơn hàng, trả hàng và đánh giá;
- xóa người dùng khỏi quan hệ đánh dấu đánh giá hữu ích;
- xóa `User` sau khi dọn dẹp và ẩn danh dữ liệu;
- thử xóa ảnh đại diện trên Cloudinary sau khi commit cơ sở dữ liệu.

Chi tiết xem tại [`../workflows/account-deletion-flow.md`](../workflows/account-deletion-flow.md).
