# ADR-001: Separate Strict and Light Auth Policies

## Context

Không phải mọi mutation của người dùng đều có cùng mức ảnh hưởng bảo mật. Kiểm tra `AuthSession` trong database cho mọi thao tác engagement làm tăng coupling và database load. Trong khi đó, cart, wishlist, trạng thái đã đọc notification và đánh dấu review hữu ích có thể chấp nhận access token giữ dữ liệu cũ trong một khoảng ngắn.

## Decision

Duy trì hai auth policy:

- **strict auth**: JWT hợp lệ, `AuthSession` hiện tại và `User` đang hoạt động;
- **light auth**: chỉ yêu cầu access JWT hợp lệ.

Strict auth dùng cho tài khoản, bảo mật, checkout, order, admin và các state quan trọng. Light auth được dùng có chủ đích cho cart, wishlist, trạng thái đã đọc notification, search history và đánh dấu review hữu ích.

## Consequences

- Strict revocation có hiệu lực ngay ở strict endpoints.
- Light endpoints có thể chấp nhận access token cũ tới khi JWT hết hạn.
- Logic xử lý state quan trọng không dùng kết quả của mutation qua light auth làm bằng chứng cấp quyền.
