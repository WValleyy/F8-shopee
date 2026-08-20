# Operations: Testing and quality tooling

> **Source of truth:** `package.json`, `vitest.config.js`, `vitest.integration.config.js`, `tests/` và `eslint.config.js`.

## 1. Test stack

Vitest được chia thành unit suite và integration suite:

```bash
npm run test:unit
npm run test:integration
npm run test:all
```

Unit tests nằm trong `tests/unit/`. Integration tests nằm trong `tests/integration/` và dùng config riêng. Cả hai config đều đặt `fileParallelism:false` để các file không chạy song song khi dùng chung state.

## 2. Unit tests

Unit tests cô lập module, service hoặc business rule. External dependencies được mock khi cần, nên suite không yêu cầu MongoDB, Cloudinary, Gmail, HTTP server hoặc browser thật.

Chạy một file cụ thể:

```bash
npx vitest run tests/unit/email/email-service.test.js
```

Unit-test coverage hiện có gồm auth, middleware, error handling, catalog query, admin product, Cloudinary image, cart, order, return, wishlist và email.

`frontend-smoke.test.js` compile toàn bộ EJS và kiểm tra các include tĩnh, public asset cùng relative JavaScript import. Test này chỉ kiểm tra cấu trúc source, không chạy DOM hoặc hành vi trên browser.

## 3. Integration tests

Integration tests kết hợp service, model và MongoDB thật. Các suite hiện có bao phủ:

- authentication và session;
- email OTP trong auth flow;
- order placement, transition và return;
- product rating;
- admin product deletion;
- admin product image lifecycle.

`vitest.integration.config.js` chỉ nhận `tests/integration/**/*.test.js`, load `tests/integration/setup.js` và đặt timeout 60 giây.

Integration suite yêu cầu `.env.test`. Helper `tests/support/test-database.js` từ chối kết nối nếu `MONGODB_DB_NAME` không kết thúc bằng `-test`, nhằm tránh dùng nhầm development hoặc production database.

Chạy một file cụ thể:

```bash
npx vitest run --config vitest.integration.config.js tests/integration/auth.test.js
```

## 4. Lint and formatting

```bash
npm run lint
npm run format:check:css
npm run format:css
npm run format
```

- `lint` kiểm tra JavaScript trong backend, frontend và scripts;
- `format:check:css` chỉ kiểm tra CSS formatting;
- `format:css` ghi lại CSS bằng Prettier;
- `format` ghi lại JavaScript trong `public/js` bằng Prettier.

`format:css` và `format` ghi thay đổi vào source theo cấu hình Prettier.

## 5. Email smoke test

`npm run email:smoke` gửi email thật qua Gmail SMTP nên không phải isolated test. Cấu hình và cách xử lý lỗi nằm trong [`email.md`](./email.md).
