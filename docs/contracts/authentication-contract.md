# Contract: Authentication and Authorization

## 1. Auth Level Selection

Auth policy được chọn theo hậu quả của việc chấp nhận một session đã cũ hoặc bị thu hồi, không chỉ dựa vào việc endpoint có `userId`.

### Strict auth

Dùng cho các thao tác:

- thay đổi thông tin bảo mật hoặc danh tính của tài khoản;
- tạo hoặc chuyển commerce state liên quan đến tiền và tồn kho;
- đọc hoặc thay đổi dữ liệu riêng tư cần xác nhận session vẫn còn hiệu lực;
- thực hiện chức năng quản trị.

### Light auth

Chỉ dùng khi chấp nhận đánh đổi rằng access token có thể giữ trạng thái cũ trong suốt TTL của nó, và thao tác không được dùng để xác định trạng thái quan trọng.

## 2. Auth matrix

| Capability | Policy |
| --- | --- |
| public catalog/product/cart page shell | public/light view state |
| cart mutation | light API auth |
| wishlist | light API auth |
| search history | light API auth |
| notification read state | light API auth |
| review helpful | light API auth |
| create review | strict API auth |
| checkout draft | strict USER |
| place/transition/return order | strict USER |
| account/profile/address/password/delete | strict USER |
| email verification | strict auth |
| email change | strict USER |
| session list/revoke/logout-all sensitive operations | strict auth where route requires it |
| admin views/API | strict ADMIN |

## 3. `attachLightAuth`

Global middleware đọc access cookie và gắn claims cùng trạng thái xác thực vào request nếu token hợp lệ. Refresh token cũng được giữ trên request cho các auth/session flow phía sau.

Không dùng `req.authUserId` do light auth cung cấp để cấp quyền cho thao tác xóa dữ liệu hoặc thao tác tài chính nếu route chưa đi qua middleware phù hợp.

## 4. Strict API behavior

`requireStrictApiAuth` thực hiện:

- validate access-token claims;
- kiểm tra `AuthSession` vẫn hoạt động, chưa bị thu hồi và chưa hết hạn;
- kiểm tra `User` vẫn hoạt động;
- gắn `req.authUser` vào request.

Nếu access token đã expired nhưng claims vẫn xác minh được, middleware phân biệt session bị revoke với access token hết hạn. Session bị revoke làm auth cookies bị xóa và trả lỗi riêng của session; token hết hạn trả code để `authFetch` thực hiện refresh.

## 5. View auth

Strict view auth dùng redirect hoặc refresh bridge phù hợp với HTML navigation. Full-page GET đi qua `refreshExpiredViewSession` trước view router; partial request dùng auth path giống API để frontend nhận JSON error thay vì một HTML redirect ngoài ý muốn.

## 6. Role boundary

`requireCustomer` và `requireAdmin` chạy sau authentication để chặn user có role không phù hợp.

## 7. Refresh contract

Frontend chỉ tự refresh khi request cùng origin trả 401 với code `ACCESS_TOKEN_EXPIRED` hoặc `ACCESS_TOKEN_MISSING`. Request ban đầu được retry tối đa một lần.

Refresh endpoint dựa vào HttpOnly refresh cookie; frontend không đọc refresh token.

## 8. Revocation semantics

Strict auth nhận biết phiên đã bị thu hồi ngay ở yêu cầu tiếp theo vì kiểm tra phiên trong cơ sở dữ liệu. Light auth có thể vẫn chấp nhận token truy cập hiện tại đến khi nó hết hạn; TTL được định nghĩa tại [`../domains/authentication.md`](../domains/authentication.md).
