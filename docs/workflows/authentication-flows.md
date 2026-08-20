# Workflow: Authentication

Tài liệu này mô tả các luồng xác thực đang được triển khai qua route, controller và service.

## 1. Login

```text
POST /api/auth/login
→ loginIpRateLimit
→ loginAccountRateLimit
→ parseLoginInput
→ loginUser(email, password, sessionMetadata)
    → tìm người dùng đang hoạt động và lấy passwordHash
    → xác minh mật khẩu bằng Argon2
    → cập nhật lastLoginAt
    → createAuthSession(...)
        → transaction
            → xác nhận người dùng vẫn hoạt động
            → kiểm tra giới hạn phiên
            → có thể thu hồi phiên cũ nhất khi force=true
            → tạo AuthSession và lưu hash của refresh token
→ setAuthCookies
→ {}
```

`lastLoginAt` được cập nhật trước khi tạo phiên và hai thao tác không nằm trong cùng transaction. Vì vậy, thời điểm đăng nhập có thể đã thay đổi dù bước tạo phiên sau đó thất bại.

## 2. Registration

```text
POST /api/auth/register
→ registerIpRateLimit
→ registerIpEmailRateLimit
→ parseRegisterInput
→ registerUser(...)
    → hash password bằng Argon2
    → tạo User
    → thử tạo AuthSession
    → thử tạo thông báo yêu cầu xác minh email
→ nếu có phiên: đặt cookie và trả authenticated=true
→ nếu không tạo được phiên: trả authenticated=false
```

Việc tạo User không rollback khi bước tạo session thất bại. Lỗi tạo thông báo yêu cầu xác minh email chỉ được ghi log và không làm đăng ký thất bại.

## 3. API session refresh

```text
POST /api/auth/session/refresh
→ refreshRateLimit
→ refreshAccessToken(refreshToken, metadata)
    → kiểm tra refresh JWT
    → kiểm tra AuthSession, idle TTL và absolute TTL
    → so sánh hash của refresh token hiện tại
    → tạo cặp access token và refresh token mới
    → transaction
        → thay refresh-token hash bằng optimistic concurrency check
        → cập nhật lastUsedAt và idleExpiresAt
        → tạo RefreshRotationGrace chứa cặp token mới đã mã hóa
→ setAuthCookies
→ {}
```

Khi hai request đồng thời dùng cùng refresh token, request không cập nhật được session có thể đọc cặp token đã tạo từ `RefreshRotationGrace`. Nếu hash không khớp và không có grace record hợp lệ, session bị thu hồi với lý do `refresh_token_reused`; warning được ghi log và email cảnh báo được gửi best-effort.

Controller xóa cookie xác thực trước khi trả lỗi `SESSION_INVALID`.

## 4. HTML refresh bridge

```text
GET một view route
→ attachLightAuth
→ refreshExpiredViewSession
→ request là GET toàn trang và access token đã hết hạn
    → validateStrictAccessClaims(accessTokenClaims)
    → phiên còn hợp lệ: render pages/auth/refresh-bridge với status 401
    → phiên không hợp lệ: xóa cookie rồi tiếp tục route
```

Middleware này không xử lý access token bị thiếu hoặc không hợp lệ. Partial request cũng không dùng HTML refresh bridge; middleware xác thực của route trả lỗi xác thực để frontend xử lý.

## 5. Session Revocation

### 5.1 Current Session Logout

```text
POST /api/auth/session/logout
→ logoutAuthSession(refreshToken, userId, sessionId)
    → ưu tiên xác định phiên từ refresh token hợp lệ
    → nếu không được, dùng userId và sessionId từ access token
→ xóa access cookie và refresh cookie
→ {}
```

Cookie vẫn được xóa khi server không xác định được phiên cần thu hồi.

### 5.2 Single Session Revocation

```text
DELETE /api/auth/sessions/:sessionId
→ requireStrictApiAuth
→ revokeAuthSessionById(sessionId, currentUserId, "user_revoked")
→ nếu là phiên hiện tại: xóa cookie xác thực
→ data.revokedCurrentSession
```

### 5.3 All-session Logout

```text
POST /api/auth/logout-all
→ requireStrictApiAuth
→ revokeAllAuthSessions(currentUserId)
→ xóa cookie xác thực
→ {}
```

## 6. OTP Issuance

Ba mục đích `VERIFY_EMAIL`, `CHANGE_EMAIL` và `RESET_PASSWORD` dùng cùng thứ tự xử lý:

```text
kiểm tra điều kiện của tài khoản
→ checkOtpSendRateLimit(userId, purpose)
→ issueOtpChallenge(...)
    → transaction
        → xóa challenge chưa dùng cùng user và purpose
        → tạo challenge mới, chỉ lưu hash OTP
→ sendOtpEmail(...)
→ controller đặt cookie challenge HttpOnly
→ trả response thành công
```

`checkOtpSendRateLimit` consume cooldown counter trước, sau đó mới consume hourly budget. Challenge và rate-limit state đã ghi không rollback khi gửi email thất bại. Controller chỉ set cookie sau khi service hoàn tất, vì vậy response lỗi SMTP không tạo challenge cookie mới trên trình duyệt.

Chi tiết về gửi email nằm tại [`../operations/email.md`](../operations/email.md).

## 7. Email Verification

### 7.1 Request and Status Check

```text
POST /api/auth/email/verify/request
→ requireStrictApiAuth
→ requestEmailVerificationOtp(currentUserId)
→ phát hành OTP VERIFY_EMAIL
→ đặt cookie challenge
→ data.resendCooldownSeconds

GET /api/auth/email/verify/status
→ requireStrictApiAuth
→ tìm challenge VERIFY_EMAIL còn hiệu lực của currentUserId
→ data.active
```

Nếu người dùng đã được xác minh, service trả `null`; controller trả `{}` và không tạo cookie mới.

### 7.2 Confirmation

```text
POST /api/auth/email/verify
→ requireStrictApiAuth
→ verifyOtpCode(...)
    → consume OTP verification budget theo challenge
    → xác minh OTP bằng Argon2
    → đặt verifiedAt
→ transaction
    → lấy challenge đã xác minh, chưa dùng và chưa hết hạn
    → đặt User.isVerified=true
    → đặt challenge.usedAt
→ xóa cookie VERIFY_EMAIL
→ trả notificationPreview hiện tại
```

## 8. Password Reset

### 8.1 Request, Resend, and OTP Verification

```text
POST /api/auth/password/forgot
→ passwordOtpIpRateLimit
→ tìm tài khoản đang hoạt động theo email
→ phát hành RESET_PASSWORD challenge kèm emailSnapshot
→ gửi OTP và đặt cookie challenge

POST /api/auth/password/forgot/resend
→ passwordOtpIpRateLimit
→ đọc challenge hiện tại từ cookie
→ kiểm tra lại người dùng đang hoạt động
→ thay challenge và gửi OTP mới
→ thay cookie challenge

POST /api/auth/password/verify-otp
→ verifyOtpCode(...)
→ đặt challenge.verifiedAt
```

`GET /api/auth/password/forgot/status` trả trạng thái `active` và `verified` của challenge trong cookie.

### 8.2 New Password Update

```text
POST /api/auth/password/reset
→ yêu cầu RESET_PASSWORD challenge đã xác minh
→ hash password mới
→ transaction
    → lấy lại challenge chưa dùng và chưa hết hạn
    → lấy người dùng đang hoạt động
    → so sánh emailSnapshot với email hiện tại
    → cập nhật passwordHash
    → thu hồi toàn bộ phiên với lý do password_reset
    → đặt challenge.usedAt
→ xóa cookie xác thực và cookie challenge
→ {}
```

Khi email đã thay đổi sau lúc phát hành challenge, transaction đánh dấu challenge đã dùng rồi trả `USER_EMAIL_CHANGED`; controller xóa cookie challenge trước khi chuyển lỗi cho error middleware.

## 9. Password Change

```text
PATCH /api/account/password
→ requireStrictApiAuth
→ requireCustomer
→ currentPasswordRateLimit
→ changeUserPassword(...)
    → xác minh mật khẩu hiện tại
    → từ chối mật khẩu mới trùng mật khẩu hiện tại
    → transaction
        → cập nhật passwordHash bằng điều kiện passwordHash cũ
        → thu hồi toàn bộ phiên với lý do password_changed
→ xóa cookie xác thực
→ data.requiresReauth=true
```

Điều kiện trên `passwordHash` ngăn request dùng kết quả kiểm tra mật khẩu đã cũ để ghi đè một thay đổi đồng thời.

## 10. Email Change

### 10.1 OTP Request and Resend

```text
POST /api/auth/email-change/request
→ requireStrictApiAuth + requireCustomer
→ currentPasswordRateLimit
→ yêu cầu USER đang hoạt động và đã xác minh email
→ xác minh mật khẩu hiện tại
→ kiểm tra email mới khác email hiện tại và chưa được sử dụng
→ phát hành CHANGE_EMAIL challenge chứa targetEmail
→ gửi OTP tới email mới
→ đặt cookie challenge

POST /api/auth/email-change/resend
→ requireStrictApiAuth + requireCustomer
→ đọc challenge hiện tại
→ kiểm tra lại USER đang hoạt động
→ thay challenge nhưng giữ nguyên targetEmail
→ gửi OTP và thay cookie challenge
```

`GET /api/auth/email-change/status` trả `active` và `targetEmail` của challenge hiện tại.

### 10.2 New Email Confirmation

```text
POST /api/auth/email-change/confirm
→ requireStrictApiAuth + requireCustomer
→ verifyOtpCode(...)
→ transaction
    → lấy challenge đã xác minh, chưa dùng và chưa hết hạn
    → kiểm tra lại email mới chưa được sử dụng
    → cập nhật User.email và giữ isVerified=true
    → thu hồi mọi phiên khác, giữ phiên hiện tại
    → đặt challenge.usedAt
→ gửi cảnh báo tới email cũ theo cơ chế best-effort
→ xóa cookie CHANGE_EMAIL
→ {}
```

Lỗi gửi cảnh báo sau commit được ghi log và không rollback email mới.

## 11. Account Deletion

Luồng lên lịch xóa và purge tài khoản được mô tả tại [`account-deletion-flow.md`](./account-deletion-flow.md).
