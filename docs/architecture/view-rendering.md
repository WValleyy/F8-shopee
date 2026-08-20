# View Rendering and Partial HTML

## 1. Server-rendered first

F8 Shopee render HTML bằng EJS. JavaScript xử lý navigation và interaction, còn view route vẫn tạo được HTML từ server.

Các layout chính:

- `views/layouts/base-layout.ejs`;
- `views/layouts/user-layout.ejs`;
- `views/layouts/admin-layout.ejs`.

Shared UI nằm dưới `views/shared/` gồm components, partials và modals.

## 2. Current Rendering Patterns

### 2.1 Page Families Using `renderPageResponse()`

Nhiều home/user/admin page dùng shared helper `controllers/view/shared/render-response.js`.

Không có `X-Partial-Target`:

```text
renderPageResponse(...)
→ res.render(pageView, layout + pageData)
→ full HTML document
```

Có `X-Partial-Target: paginated-collection` và controller cung cấp `collectionView`:

```text
render collectionView với layout:false
→ JSON { html, pagination }
```

Có partial target khác:

```text
render pageView với layout:false
→ JSON { html, title, currentPage, activeSection }
```

Đây là **same-route page partial navigation**: cùng page route có thể trả full HTML hoặc fragment tùy header.

### 2.2 Direct Full-page Controller Rendering

Storefront product/cart/checkout hiện render full page bằng `res.render(...)` trực tiếp thay vì đi qua `renderPageResponse()`:

- `controllers/view/storefront/product.controller.js` → product page;
- `controllers/view/storefront/checkout.controller.js` → cart và checkout page.


### 2.3 Dedicated fragment endpoint

Một số fragment có **route riêng** và query/view model riêng:

- `GET /product/:slug/reviews` → review list fragment;
- `GET /checkout/addresses` → checkout address-list fragment.

Các route này gọi `renderPartial(...)` trực tiếp và trả:

```json
{
  "html": "..."
}
```

cộng payload bổ sung khi controller cung cấp.

Dedicated fragment endpoint không phải “full page bị cắt bớt”; nó là một HTTP contract độc lập.

## 3. Partial contract

### Same-route page partial navigation

Khi cùng một page route hỗ trợ cả full và partial qua `X-Partial-Target`, authorization và business rules không thay đổi. Partial chỉ thay phần HTML được render và response format; header partial không bỏ qua validation hoặc business guard.

View model có thể chỉ render collection fragment khi `paginated-collection`, nhưng state nghiệp vụ của page được tạo theo contract của cùng route.

### Dedicated fragment endpoint

Dedicated fragment route được phép:

- chạy query hẹp hơn full page;
- có parser/query parameters riêng;
- trả payload metadata riêng;
- không cần xây toàn bộ full-page view model.

Route vẫn áp dụng auth và business guard tương ứng.

## 4. View configuration

`controllers/view/shared/view-config.js` tập trung cấu hình page family như:

- styles;
- entry script;
- header variant/state;
- layout-related metadata.

## 5. Header state

`attachHeaderState` chuẩn bị state như cart preview/notification preview cho full page. Header EJS serialize state bằng `data-header-state`; `widgets/header/header.js` đọc lại phía client.

Full-page 404 cũng đi qua `attachHeaderState` trước error view. API/partial 404 không cần bước này.

## 6. JSON Bootstrap and XSS Boundary

Không nhúng `JSON.stringify(data)` thẳng vào `<script>` khi dữ liệu có thể chứa text động. `serializeJsonForHtml()` thay các ký tự HTML-sensitive như `<`, `>`, `&` và separator Unicode bằng JavaScript Unicode escapes.

Ví dụ giá trị có `</script>` được render thành dạng không còn literal closing tag đối với HTML parser, nhưng JavaScript/JSON parser vẫn phục hồi giá trị dữ liệu đúng.

Các EJS bootstrap hiện dùng `type="application/json"` + `data-page-initial-state`/`data-header-state` và `<%- serializeJsonForHtml(...) %>`.

## 7. Auth Refresh for Full HTML GET

View routers được mount sau `refreshExpiredViewSession`. Middleware này chỉ dùng full HTML bridge khi access token expired và strict claims của token cũ vẫn hợp lệ.

Bridge render `views/pages/auth/refresh-bridge.ejs` với status 401 để browser-side flow refresh session rồi navigation lại.

Partial request không dùng full HTML bridge; auth middleware trả error response giống API để navigation JavaScript xử lý.
