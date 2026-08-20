# Frontend architecture

## 1. Architecture overview

Frontend dùng Vanilla JavaScript ES modules trên server-rendered HTML. Nó không quản lý toàn bộ route và view state như một SPA framework.

```text
server-rendered EJS
      ↓
page entry module
      ↓
page orchestration
      ├── shared infrastructure
      ├── feature modules
      └── widgets
```

## 2. Folder responsibilities

### `shared/`

Infrastructure dùng lại ở nhiều page hoặc feature, ví dụ HTTP client, navigation, modal và form helpers. Shared module không phụ thuộc vào một page cụ thể.

### `features/`

Feature đóng gói một chức năng nghiệp vụ hoặc hành vi UI có thể được mount trong nhiều context. Feature có thể gọi API và shared utilities nhưng không đóng vai trò page router.

### `widgets/`

Widget là shared UI component ở cấp layout hoặc component lớn, ví dụ header. Widget có lifecycle riêng nhưng không quản lý navigation của toàn page.

### `pages/`

Đây là page entry và orchestration layer. Page module biết DOM của trang, mount đúng feature và phối hợp partial navigation; loader được chọn theo page hiện tại tại đây.

## 3. HTTP Client and Auth Retry

`public/js/shared/api/http-client.js` cung cấp `authFetch()`.

Với mọi request cùng nguồn đi qua `authFetch()`, nếu response là 401 với `ACCESS_TOKEN_EXPIRED` hoặc `ACCESS_TOKEN_MISSING`, client gọi `POST /api/auth/session/refresh` **một lần**, sau đó gửi lại request ban đầu **một lần**. Logic này không áp dụng cho request khác nguồn và không tự làm mới khi chính endpoint làm mới phiên trả lỗi.

## 4. Partial navigation

`shared/navigation/partial-region.js`:

- gửi `X-Partial-Target`;
- dùng `authFetch`;
- abort request cũ khi navigation mới thay thế;
- thay fragment HTML;
- cập nhật History API;
- chuyển sang full navigation khi partial request trả lỗi.

`page-navigation.js` quản lý page loader và `popstate`. `collection.js` chuyên cho paginated collection với target `paginated-collection`.

## 5. Modal workflow

`shared/ui/modal.js` quản lý active modal và workflow state toàn cục:

- open/close;
- step transition;
- browser Back/Forward qua History API;
- focus restoration và focus trap;
- đóng workflow khi navigation khác tiếp quản.

Feature dùng contract này khi mở modal thay vì tự quản lý history hoặc modal state riêng.

## 6. Form infrastructure

`shared/ui/forms.js` dùng semantic hooks:

- `[data-form-field]`;
- `[data-form-message]`;
- `[data-form-notice]`;
- `aria-invalid` cho trạng thái lỗi.

## 7. Dynamic page loaders

User entry `public/js/pages/user/user.js` có loader cho profile, address, password, privacy, purchase, notifications và wishlist.

Admin entry có loader cho categories, orders, users, products, product editor và reviews. Dashboard/app-log vẫn có thể hoạt động server-rendered mà không cần page-specific dynamic loader.

Page module được mount trên fragment hoặc root tương ứng. Khi page bị thay, module cleanup listener và request; `AbortSignal` ngăn chúng tiếp tục tồn tại sau navigation.

## 8. State Bootstrap from EJS

Pagination/sort/header state được nhúng bằng:

```html
<script type="application/json" data-page-initial-state>...</script>
<script type="application/json" data-header-state>...</script>
```

Server serialize bằng `serializeJsonForHtml()` trước khi nhúng. Frontend đọc `.textContent` rồi `JSON.parse`.

Đây là bootstrap state, không phải persistent store ở trình duyệt.
