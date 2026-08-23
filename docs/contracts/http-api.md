# Contract: HTTP/API

## 1. Route namespaces

`app.js` mount:

| Namespace | Mục đích |
| --- | --- |
| `/api/auth` | auth, OTP, session |
| `/api/account` | profile/password/account/address |
| `/api/cart` | cart mutation |
| `/api/checkout` | checkout draft |
| `/api/orders` | tạo, transition và return order |
| `/api/catalog` | catalog helper API |
| `/api/reviews` | review create/helpful |
| `/api/wishlist` | wishlist |
| `/api/notifications` | notification read state |
| `/api/search-history` | authenticated history |
| `/api/admin` | admin mutations |

## 2. Success response convention

Success response không bắt buộc dùng chung một envelope. Hai shape chính hiện tại:

```json
{}
```

hoặc:

```json
{
  "data": {}
}
```

`data` chỉ xuất hiện khi caller cần response payload. Ví dụ, cart mutation trả `data.cartPreview`, notification mutation trả `data.notificationPreview`, checkout draft trả draft id và profile update trả kết quả cập nhật.

## 3. Error response

API và partial request đi qua error middleware chung, trả mã lỗi, thông báo và metadata an toàn theo cấu hình `AppError`. Controller và service chuyển lỗi tới middleware này thay vì tự tạo một định dạng JSON lỗi khác.

Chi tiết xem [`error-handling.md`](./error-handling.md).

## 4. Mutation security

`requireSameOrigin` được áp dụng globally cho các HTTP method thay đổi state. Browser request phải có `Sec-Fetch-Site` hoặc `Origin` phù hợp với `APP_ORIGIN`.

Auth vẫn là một layer riêng; same-origin check không thay thế authentication hoặc authorization.

## 5. Auth API

### Public/flow-state endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/password/forgot`
- `GET /api/auth/password/forgot/status`
- `POST /api/auth/password/forgot/resend`
- `POST /api/auth/password/verify-otp`
- `POST /api/auth/password/reset`
- `POST /api/auth/session/refresh`
- `POST /api/auth/session/logout`

### Strict-auth endpoints

- email verification request/status/confirm;
- email-change subtree (strict USER);
- `DELETE /api/auth/sessions/:sessionId`;
- `POST /api/auth/logout-all`.

Việc set và clear auth cookie là một phần của HTTP contract, được tập trung trong `controllers/api/auth/auth-http-state.js`.

## 6. Account API

Toàn bộ `/api/account` yêu cầu strict auth và role `USER`. Các path sau khi mount router gồm:

- `PATCH /api/account/profile`
- `PATCH /api/account/password`
- `DELETE /api/account/account`
- `POST /api/account/addresses`
- `PATCH /api/account/addresses/:id`
- `DELETE /api/account/addresses/:id`
- `PATCH /api/account/addresses/:id/default`


## 7. Commerce API

### Cart — light auth

- `POST /api/cart/items`
- `PATCH /api/cart/items/:variantId`
- `DELETE /api/cart/items`
- `DELETE /api/cart/items/:variantId`

### Checkout — strict USER

- `POST /api/checkout/drafts`

### Orders — strict USER

- `POST /api/orders`
- `PATCH /api/orders/:orderId/status`
- `POST /api/orders/:orderId/returns`

## 8. Catalog/engagement API

- `GET /api/catalog/search-suggestions` — public catalog helper;
- `POST /api/reviews/products/:productId` — strict auth + multipart review images;
- `PUT|DELETE /api/reviews/:id/helpful` — light auth;
- `PUT|DELETE /api/wishlist/:productId` — light auth;
- notification read endpoints — light auth;
- search-history GET/PUT/DELETE — light auth.

## 9. Admin API

Tất cả strict ADMIN:

- categories create/update;
- order status transition;
- products create/update/delete/bulk actions;
- review publication;
- thay đổi trạng thái hoạt động và purge user.

## 10. Partial view response

Có hai contract khác nhau:

1. **Same-route page partial navigation** — cùng page route nhận `X-Partial-Target` và trả JSON chứa server-rendered HTML; `paginated-collection` có HTML + pagination, target page có page metadata.
2. **Dedicated fragment endpoint** — route riêng như `GET /product/:slug/reviews` hoặc `GET /checkout/addresses` chỉ load view model cần cho fragment rồi trả partial payload.

Chi tiết rendering xem tại [`../architecture/view-rendering.md`](../architecture/view-rendering.md).
