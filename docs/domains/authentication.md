# Domain: Authentication

## 1. Authentication model

Xác thực kết hợp:

```text
access JWT cookie
+ refresh JWT cookie
+ AuthSession trong MongoDB
```

JWT không thay thế session được lưu phía server. Strict auth yêu cầu claims trong token hợp lệ, đồng thời session và người dùng trong database vẫn hoạt động.

## 2. Token and Cookie Policy

Các hằng số xác thực hiện tại:

- Access token: HS256, TTL **15 phút**.
- Refresh token: gắn với người dùng và session, được thay thế qua refresh-token rotation.
- Access cookie: `f8sp_access_token`, path `/`.
- Refresh cookie: `f8sp_refresh_token`, path `/api/auth/session`.
- Cả hai dùng `HttpOnly`, `SameSite=Lax` và dùng `Secure` trong môi trường production.

Đường dẫn hẹp của refresh cookie khiến trình duyệt không gửi refresh token tới các API nghiệp vụ khác.

## 3. Session lifetime

| Session | Idle TTL | Absolute TTL |
| --- | ---: | ---: |
| thường | 12 giờ | 24 giờ |
| remember-me | 30 ngày | 90 ngày |

Mỗi người dùng có tối đa **5 phiên đang hoạt động**. Khi đạt giới hạn, request đăng nhập có thể xác nhận thay thế phiên cũ nhất qua tùy chọn `force`.

Grace window cho các request đồng thời trong refresh-token rotation là **10 giây**.

## 4. Strict auth vs light auth

### Strict auth

Kiểm tra thông tin trong access token cùng trạng thái phiên và người dùng trong cơ sở dữ liệu. Cơ chế này được dùng cho thanh toán, đơn hàng, tài khoản, quản trị, quản lý phiên và xác minh email.

### Light auth

Chấp nhận access token còn hạn mà không kiểm tra lại trạng thái phiên và người dùng trong cơ sở dữ liệu. Cơ chế này được dùng cho các thao tác có mức rủi ro thấp hơn như thay đổi giỏ hàng, danh sách yêu thích, trạng thái đọc thông báo, lịch sử tìm kiếm và đánh dấu đánh giá hữu ích.

Hệ quả: sau khi phiên bị thu hồi, endpoint dùng light auth vẫn có thể chấp nhận access token cũ cho tới khi token hết hạn.

Chi tiết xem tại [`../contracts/authentication-contract.md`](../contracts/authentication-contract.md).

## 5. Refresh rotation invariants

Một refresh thành công:

- chỉ áp dụng cho session đang hoạt động, chưa hết idle TTL hoặc absolute TTL;
- xoay vòng hash refresh token;
- cập nhật idle expiry nhưng không vượt absolute expiry;
- tạo grace record ngắn hạn chứa cặp token mới đã mã hóa để các request đồng thời dùng token cũ nhận cùng kết quả;
- coi refresh token không khớp và không có grace record hợp lệ là dấu hiệu token reuse, sau đó thu hồi session.

Cảnh báo bảo mật khi phát hiện sử dụng lại refresh token là best-effort side effect; việc thu hồi phiên không phụ thuộc kết quả gửi email.

Chi tiết xem tại [`../workflows/authentication-flows.md`](../workflows/authentication-flows.md).

## 6. Registration/login invariants

- Email là duy nhất và được chuẩn hóa thành chữ thường theo model và parser tài khoản.
- Password được hash bằng Argon2.
- Người dùng không hoạt động hoặc đã lên lịch xóa không được đăng nhập.
- Đăng nhập cập nhật `lastLoginAt` và tạo phiên xác thực.
- Đăng ký tạo `User` trước rồi tạo phiên xác thực. Nếu người dùng đã được tạo nhưng không tạo được phiên, tài khoản không rollback và client được yêu cầu đăng nhập lại.

## 7. OTP domain

Các mục đích:

- `VERIFY_EMAIL`;
- `RESET_PASSWORD`;
- `CHANGE_EMAIL`.

Quy tắc OTP:

- 6 digits;
- TTL **15 phút**;
- resend cooldown **45 giây**;
- resend/send limit **10/giờ**;
- verify limit **10/giờ/challenge**;
- challenge id lưu HttpOnly cookie path `/api/auth`;
- plaintext OTP không được lưu trong database; chỉ OTP hash được lưu;
- challenge mới thay thế challenge cũ chưa sử dụng của cùng người dùng và mục đích.

Khi gửi email thất bại, challenge và rate-limit state đã ghi không được rollback. Chi tiết nằm trong [`../workflows/authentication-flows.md`](../workflows/authentication-flows.md#6-otp-issuance) và [`../operations/email.md`](../operations/email.md).

## 8. Password/email changes

### Change password

Người dùng phải cung cấp mật khẩu hiện tại, mật khẩu mới phải khác mật khẩu hiện tại. Cập nhật mật khẩu và thu hồi toàn bộ phiên được commit trong cùng transaction. Sau khi thành công, client bị xóa cookie xác thực và phải đăng nhập lại.

### Reset password

Challenge đã xác minh cấp quyền đổi mật khẩu trong thời gian còn hiệu lực. Việc đặt lại chỉ hợp lệ khi email được lưu trong challenge vẫn khớp email hiện tại của tài khoản. Khi thành công, hệ thống thu hồi toàn bộ phiên và đánh dấu challenge đã sử dụng.

### Change email

Người dùng phải qua strict auth, đã xác minh email, cung cấp mật khẩu hiện tại và chọn email mới chưa tồn tại trong hệ thống. Xác nhận OTP cập nhật email, giữ phiên hiện tại nhưng thu hồi các phiên khác. Cảnh báo tới email cũ được gửi best-effort sau commit.

## 9. Account deletion interaction

Lên lịch xóa tài khoản làm người dùng mất trạng thái hoạt động và thu hồi toàn bộ phiên. Chi tiết nằm trong [`user-account.md`](./user-account.md) và [`../workflows/account-deletion-flow.md`](../workflows/account-deletion-flow.md).
