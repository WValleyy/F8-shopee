# Operations: Auth rate limiting

## 1. Storage model

Rate-limit state được lưu bằng MongoDB model `AuthRateLimit`:

```text
_id              = SHA-256(scope + ":" + identifier)
scope            = scope đã normalize
count            = số lần consume trong fixed window hiện tại
windowExpiresAt  = thời điểm fixed window kết thúc
createdAt/updatedAt
```

TTL index:

```text
{ windowExpiresAt: 1 }, expireAfterSeconds: 0
```

MongoDB dọn document hết TTL theo cơ chế bất đồng bộ, nhưng rate limiter không phụ thuộc vào thời điểm document thực sự bị xóa. Khi request đến sau `windowExpiresAt`, update pipeline reset `count` và window ngay trên document hiện có.

## 2. Fixed-window consume semantics

`consumeAuthRateLimit()`:

1. bypass hoàn toàn nếu `AUTH_RATE_LIMIT_ENABLED=false`;
2. hash `scope:identifier` để tạo `_id`;
3. atomically `findOneAndUpdate` bằng update pipeline;
4. nếu window hiện tại còn hiệu lực → `count + 1` và giữ nguyên expiry;
5. nếu window đã hết hạn hoặc chưa tồn tại → `count=1`, expiry=`now + windowMs`;
6. `allowed = count <= limit`;
7. nếu bị từ chối → trả `retryAfter` tính tới thời điểm window hiện tại hết hạn.

Khi hai request đồng thời tạo counter đầu tiên, một request có thể gặp duplicate-key error `11000`. Request đó retry bằng update không dùng upsert, nhờ vậy cả hai request vẫn được tính vào cùng một counter.

## 3. HTTP error behavior

Limiter middleware/service tạo `RATE_LIMITED` với `context.retryAfter`.

Central error middleware map thành HTTP `429` và set:

```text
Retry-After: <ceil(seconds)>
```

Frontend HTTP client đọc header này và các auth/email workflows có thể dùng để chạy countdown.

## 4. Current Route-level Budgets

| Scope/capability | Identifier | Limit | Window |
| --- | --- | ---: | ---: |
| login IP | client IP | 30 | 15 phút |
| login account | email đã normalize | 20 | 15 phút |
| register IP | client IP | 30 | 15 phút |
| register IP + email | `IP:normalizedEmail` | 5 | 15 phút |
| shared current-password | user id đã xác thực | 10 | 15 phút |
| refresh | client IP | 60 | 60 giây |
| password-reset OTP route gate | client IP | 10 | 15 phút |

Chi tiết xem tại `middlewares/rate-limit.middleware.js`.

## 5. Shared current-password budget

`currentPasswordRateLimit` dùng chung một budget theo user cho các action cần current password:

- `PATCH /api/account/password`;
- `DELETE /api/account/account`;
- `POST /api/auth/email-change/request`.

## 6. OTP send budgets

Ngoài route-level limiter, OTP service có persistent budgets theo **identifier + purpose**.

`checkOtpSendRateLimit(identifier, purpose)` consume budget theo thứ tự:

```text
send cooldown
→ nếu được phép, consume hourly send budget
```

Config hiện tại:

| Budget | Limit | Window |
| --- | ---: | ---: |
| resend/send cooldown | 1 | 45 giây |
| send hourly | 10 | 1 giờ |

Trong các OTP flow hiện tại, identifier là user id; purpose tách riêng `VERIFY_EMAIL`, `RESET_PASSWORD` và `CHANGE_EMAIL`.

### Partial consumption nuance

Cooldown counter được consume trước hourly counter. Nếu cooldown cho phép nhưng hourly budget từ chối, lần consume cooldown vừa ghi không rollback.

## 7. OTP verification budget

OTP verify budget dùng `challengeIdHash` làm key, không dùng raw OTP hoặc email:

| Budget | Limit | Window |
| --- | ---: | ---: |
| verify attempts per challenge | 10 | 1 giờ |

Budget được consume trước khi Argon2 so sánh OTP, sau khi xác nhận challenge còn active và chưa verified.

## 8. Two-layer IP and User-purpose Guards for Password Reset

`POST /api/auth/password/forgot` và `/forgot/resend` có `passwordOtpIpRateLimit` ở route, sau đó service còn chạy OTP send cooldown/hourly theo user/purpose nếu account/challenge được resolve.

Một lớp bảo vệ theo IP route traffic, lớp kia bảo vệ issuance theo account/purpose.

## 9. Global disable switch

`AUTH_RATE_LIMIT_ENABLED=false` làm `consumeAuthRateLimit()` trả:

```text
{ allowed: true, retryAfter: 0 }
```

Điều này bypass cả middleware budgets và OTP budgets vì chúng dùng chung service.


## 10. Trust proxy

Default identifier IP lấy:

```text
req.ip
|| req.socket?.remoteAddress
|| "unknown"
```

`req.ip` phụ thuộc cấu hình `trust proxy` của Express. Khi ứng dụng đứng sau reverse proxy, cấu hình quá rộng có thể cho địa chỉ do client cung cấp ảnh hưởng rate-limit identifier; cấu hình thiếu có thể gộp nhiều request theo địa chỉ proxy.

Chi tiết cấu hình nằm trong [`configuration.md`](./configuration.md).
