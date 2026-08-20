# Backend architecture

## 1. Layering

Luồng API:

```text
Route
  → middleware
  → controller
      ├→ request parser → service
      └→ service
  → model / external service
  → controller response
```

Request parser chỉ xuất hiện khi endpoint có input cần chuẩn hóa hoặc kiểm tra trước khi gọi service.

View layer hiện có **ba cách render HTML**:

```text
A. Page family dùng shared renderer
View route
  → auth/header middleware
  → view controller
  → query/service
  → renderPageResponse()
  → full EJS hoặc same-route partial payload

B. Controller render full page trực tiếp
View route
  → middleware
  → view controller
  → query/service
  → res.render(...)

C. Endpoint riêng cho fragment
View route riêng
  → middleware
  → view controller
  → query/service dành cho fragment
  → renderPartial(...)
  → JSON { html, ...payload }
```

Chi tiết về cách render view nằm trong [`view-rendering.md`](./view-rendering.md).

## 2. `routes/`

Route chịu trách nhiệm cho HTTP wiring:

- method + path;
- auth/role middleware;
- upload/param validation middleware;
- controller cuối cùng.

## 3. `middlewares/`

Middleware xử lý các tác vụ chung trước hoặc sau controller:

- `auth.middleware.js`: light/strict auth và expired-view refresh bridge;
- `role.middleware.js`: USER/ADMIN authorization;
- `security.middleware.js`: security headers và same-origin protection;
- `rate-limit.middleware.js`: auth rate limits;
- `image-upload.middleware.js`: multipart limits + real file type validation;
- `validation.middleware.js`: kiểm tra ObjectId tại HTTP boundary;
- `view-state.middleware.js`: dữ liệu header cho page render.

Middleware không chứa logic nghiệp vụ.

## 4. `controllers/requests-parser/`

Request parser là ranh giới tiếp nhận dữ liệu HTTP. Nó chuyển `req.body`, `req.query`, `req.params`, file multipart và header cần thiết thành dữ liệu đã được chuẩn hóa, kiểm tra trước khi chuyển cho service.

Ví dụ:

```text
req.body + req.files
→ parseProductInput(...)
→ saveAdminProduct(...)
```

Service nhận dữ liệu theo cấu trúc mà parser đã xác lập, không xử lý trực tiếp cấu trúc form của trình duyệt.

## 5. `controllers/api/`

API controller có vai trò:

1. parse request;
2. gọi service;
3. set hoặc clear cookie nếu workflow yêu cầu;
4. trả HTTP status + JSON.

Nhiều mutation thành công trả `{}`; một số trả `{ data: ... }` khi frontend cần state mới, chẳng hạn cart preview, notification preview, draft id hoặc kết quả cập nhật profile.

Controller không tự bắt `AppError` trừ khi cần điều chỉnh HTTP state trước khi throw lại; lỗi cuối cùng đi qua error middleware chung.

## 6. `controllers/view/`

View controller xây view model rồi chọn một trong các rendering pattern hiện có:

- `renderPageResponse()` cho page family hỗ trợ full render + same-route partial navigation;
- `res.render(...)` cho full-page controller không dùng shared renderer;
- `renderPartial(...)` cho dedicated fragment endpoint;
- redirect khi route chỉ là alias (user/account -> user/account/profile).

Dedicated fragment endpoint có thể có query/view model hẹp hơn full page vì nó là một HTTP contract riêng, không phải same-route partial của page đó.

## 7. `services/`

Service chứa business logic và xác định transaction boundary. Một service có thể gọi service khác khi dùng chung một tác vụ, ví dụ:

- order transition gọi logic hoàn lại tồn kho;
- review/admin review gọi product rating delta;
- account deletion gọi logic revoke auth session;
- admin product gọi Cloudinary image service sau DB transaction.

Atomicity được đảm bảo tại service, không nằm trong controller.

## 8. `models/`

Mongoose model chịu trách nhiệm:

- schema/type/enum/range;
- index và uniqueness;
- quy tắc lưu dữ liệu có TTL;
- document-level validation/pre-validation có tính dữ liệu cục bộ.

Các quy tắc nghiệp vụ liên quan nhiều document vẫn nằm ở service. Ví dụ, điều kiện product phải thuộc một leaf category có toàn bộ parent chain đang active để được đăng bán không chỉ dựa vào schema `Product`.

## 9. Error boundary

Service/parser/middleware dùng central `AppError` helpers:

- `requestError(code, ...)`: operational error đã được cấu hình, an toàn để trả cho client;
- `incidentError(...)`: lỗi hệ thống cần ghi log, trả mã lỗi 500 cho người dùng hoặc trạng thái 5xx do nơi gọi chỉ định;
- unexpected error được `handleAppError` normalize và cũng trả 5xx.

Xem chi tiết tại [`../contracts/error-handling.md`](../contracts/error-handling.md).

## 10. Transaction boundary

Hệ thống dùng transaction khi nhiều document hoặc counter phải được cập nhật đồng bộ. Các side effect nằm ngoài MongoDB được xử lý theo ba trường hợp:

- side effect có thể rollback hoặc cancel;
- side effect chạy best-effort sau commit;
- MongoDB hoặc hệ thống bên ngoài là authoritative source tùy từng workflow.

Vòng đời hình ảnh có cách xử lý khác nhau cho sản phẩm quản trị, ảnh đại diện và đánh giá. Sản phẩm quản trị cùng ảnh đại diện lưu cơ sở dữ liệu trước khi gửi ảnh lên Cloudinary; đánh giá gửi ảnh lên Cloudinary trước khi lưu cơ sở dữ liệu. Chi tiết nằm trong [`../contracts/image-lifecycle.md`](../contracts/image-lifecycle.md).

## 11. Catalog search runtime fallback

Tìm kiếm product ưu tiên Atlas Search khi môi trường hỗ trợ `$search`. Khi ứng dụng xác định `mongot` hoặc Atlas Search không khả dụng, query layer chuyển sang regex và cache kết quả này ở process level để không tiếp tục thử `$search` ở các request sau.

Dù dùng search engine nào, hệ thống vẫn áp dụng storefront eligibility theo [`../domains/catalog.md`](../domains/catalog.md).
