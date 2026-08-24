# Workflow: Account Deletion

Xóa tài khoản gồm hai giai đoạn: user lên lịch xóa, sau đó admin purge account khi thời gian chờ đã hết.

## 1. Deletion Scheduling

```text
DELETE /api/account/account
→ requireStrictApiAuth
→ requireCustomer
→ currentPasswordRateLimit
→ parseDeleteAccountInput
→ scheduleAccountDeletion(userId, password)
```

Service tìm `USER` đang hoạt động và chưa có `purgeAfter`, sau đó dùng Argon2 để kiểm tra mật khẩu với `passwordHash`.

### 1.1 Transaction

```text
đọc lại USER đang hoạt động và chưa được lên lịch xóa
→ kiểm tra không có Order ở trạng thái SHIPPING
→ tính purgeAfter theo account-deletion config
→ cập nhật User bằng điều kiện passwordHash ban đầu
    isActive=false
    purgeAfter=<thời điểm purge>
→ thu hồi toàn bộ AuthSession
→ xóa RefreshRotationGrace
→ xóa EmailOtpChallenge
→ commit
```

Điều kiện `passwordHash` ngăn việc lên lịch xóa bằng kết quả xác minh đã cũ nếu mật khẩu thay đổi đồng thời. Khi service hoàn tất, controller xóa cookie xác thực và trả `{}`.

Ở giai đoạn này, dữ liệu hồ sơ, giỏ hàng, đơn hàng và đánh giá vẫn còn trong MongoDB. Người dùng không còn đăng nhập được vì `isActive=false` và các phiên đã bị thu hồi.

## 2. Admin Purge

```text
DELETE /api/admin/users/:id
→ requireStrictApiAuth
→ requireAdmin
→ validateObjectIdParam
→ purgeUserAccount(targetUserId, actingAdminId)
```

Service từ chối purge chính quản trị viên đang thao tác, tài khoản chưa được lên lịch, tài khoản còn hoạt động hoặc thời điểm `purgeAfter` chưa tới. Trạng thái đến hạn được kiểm tra lại trong transaction trước khi xóa dữ liệu.

## 3. Purge Transaction

### 3.1 Wishlist Counter Adjustment

Service đọc các `WishList` của người dùng và giảm `Product.likes` một lần cho mỗi wishlist record. Unique index trên cặp `user + product` bảo đảm mỗi sản phẩm chỉ xuất hiện một lần trong wishlist của cùng một người dùng. Giá trị được chặn ở mức tối thiểu `0`. Việc điều chỉnh diễn ra trước khi xóa các wishlist.

### 3.2 Private and Temporary Data Deletion

Các collection sau được xóa theo `userId` trong cùng transaction:

- `AuthSession`;
- `RefreshRotationGrace`;
- `EmailOtpChallenge`;
- `Cart`;
- `CheckoutDraft`;
- `UserAddress`;
- `UserNotification`;
- `UserSearchHistory`;
- `WishList`.

### 3.3 Transaction History Anonymization

`Order` không bị xóa. Service cập nhật:

```text
user = null
customerDeletedAt = <thời điểm purge>
shippingAddress = thông tin tài khoản đã xóa
note = ""
updatedAt = customerDeletedAt
```

`OrderReturnRequest` cũng được giữ lại, nhưng `user` được đặt thành `null` và `updatedAt` được cập nhật.

Đối với review:

```text
review do người dùng tạo:
  user = null
  authorDeletedAt = <thời điểm purge>

review được người dùng đánh dấu hữu ích:
  xóa userId khỏi likedBy
```

### 3.4 User Deletion

`User.deleteOne` chạy sau khi dữ liệu phụ đã được xóa hoặc ẩn danh. Điều kiện xóa vẫn yêu cầu tài khoản không còn hoạt động và `purgeAfter` đã tới hạn. Toàn bộ thay đổi MongoDB ở các bước trên được rollback nếu transaction thất bại.

## 4. Avatar Deletion

Sau khi transaction commit, service gọi `cleanupUploadedImage` nếu account có `avatarPublicId`. Đây là best-effort cleanup trên Cloudinary; lỗi xóa ảnh được ghi log và không khôi phục account đã purge.

## 5. Failure behavior

| Điểm lỗi | Trạng thái dữ liệu |
| --- | --- |
| Sai mật khẩu hoặc còn đơn `SHIPPING` | Không lên lịch xóa |
| Transaction lên lịch thất bại | Trạng thái người dùng và phiên được rollback |
| Tài khoản chưa tới hạn purge | Không bắt đầu xóa dữ liệu |
| Transaction purge thất bại | Các thay đổi MongoDB được rollback |
| Xóa ảnh sau commit thất bại | Tài khoản vẫn đã purge; lỗi được ghi log |
