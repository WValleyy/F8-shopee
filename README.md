# F8 Shopee

F8 Shopee là ứng dụng thương mại điện tử **server-rendered** xây dựng bằng Node.js,
Express, EJS và MongoDB, tham khảo thiết kế của Shopee.

> README này là entry point để cài đặt, chạy và giới thiệu repository. Tài liệu kỹ thuật
> chi tiết nằm tại [`docs/README.md`](./docs/README.md).

## Live demo

- Website: [Mở trang cửa hàng](https://f8-shopee-ten.vercel.app)
- Admin: [Mở trang quản trị](https://f8-shopee-ten.vercel.app/admin)

Trang quản trị yêu cầu đăng nhập bằng tài khoản có role `ADMIN`. Thông tin tài khoản demo nằm trong phần [Seed data](#seed-data).

## Tech stack

| Area | Current implementation |
| --- | --- |
| Runtime | Node.js + npm |
| Backend | Express 5 |
| Views | EJS + `express-ejs-layouts` |
| Database | MongoDB + Mongoose 9 |
| Authentication | JWT access/refresh cookies + MongoDB `AuthSession` |
| Password hashing | Argon2 |
| Frontend | Vanilla JavaScript ES modules + CSS |
| Image upload/storage | Multer + `file-type` + Cloudinary |
| Email | Nodemailer + Gmail SMTP |
| Test | Vitest |
| Quality | ESLint + Prettier |

## Requirements

### Node.js

```text
Node.js >= 22
```

### MongoDB

Nhiều flow của application dùng MongoDB transaction. Môi trường chạy đầy đủ phải hỗ
trợ transaction, ví dụ:

- MongoDB Atlas.
- local MongoDB replica set.

### External services

Để startup với config hiện tại, cần có:

- Cloudinary account;
- Gmail account + App Password dùng cho SMTP.

`config/load-env.js` validate toàn bộ required environment variables ngay khi module được
load. Thiếu Cloudinary/Gmail config có thể làm process fail ngay cả trước khi request
đầu tiên dùng hai service này.

## Installation

Clone repository rồi cài dependency:

```bash
git clone https://github.com/WValleyy/F8-shopee.git
cd F8-shopee
npm ci / npm install
```

## Environment configuration

Tạo `.env` từ `.env.example`:

Các biến được loader hiện tại yêu cầu:

```text
NODE_ENV
MONGODB_URI
MONGODB_DB_NAME
ACCESS_TOKEN_SECRET
REFRESH_TOKEN_SECRET
AUTH_GRACE_ENCRYPTION_KEY
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
GMAIL_USER
GMAIL_APP_PASSWORD
EMAIL_FROM_NAME
APP_ORIGIN
TRUST_PROXY
AUTH_RATE_LIMIT_ENABLED
```

`PORT` dùng cho local development và production server truyền thống; nếu không khai báo,
server dùng `3000`.

Xem mô tả của từng biến tại [`docs/operations/configuration.md`](./docs/operations/configuration.md).

## Run local

```bash
npm start
```

Command thực thi:

```text
node server.js
```

`server.js` kết nối MongoDB thành công trước khi mở HTTP listener. Port lấy từ `PORT`.
Với `.env.example`, URL local là:

```text
http://localhost:3000
```

Trong quá trình phát triển, chạy `npm run dev` để Nodemon tự khởi động lại server khi file
backend thay đổi. Production dùng `npm start`.

## Deploy Vercel

Repository triển khai Express qua Vercel Function `api/index.js`. Local vẫn chạy qua
`server.js`; Vercel không dùng `app.listen()` của ứng dụng.

1. Import repository vào Vercel và giữ `vercel.json` trong repository.
2. Khai báo các biến trong `.env.example` trên Vercel, trừ `PORT`.
3. Dùng `NODE_ENV=production`, `TRUST_PROXY=1` và đặt `APP_ORIGIN` bằng URL public chính xác,
   ví dụ `https://shop.example.com`.
4. Cấu hình MongoDB Atlas cho phép kết nối từ Vercel và dùng Cloudinary/Gmail credentials của
   môi trường deploy.

`dotenv.config()` vẫn an toàn trên Vercel: không có file `.env` thì các biến Vercel đã inject
vào `process.env` vẫn được dùng. Function chỉ ghi app log vào MongoDB qua biến VERCEL = 1 vì filesystem của Vercel không phù hợp để lưu file log lâu dài.

## Seed data

Chạy full seed pipeline:

```bash
npm run seed
```

> **Note**: seed hiện là destructive reset đối với các collection được application
> quản lý. Không chạy command này trên database có dữ liệu cần giữ.

Seed tạo catalog, user và business activity phục vụ phát triển/demo. Sau khi seed thành
công, script in các demo credential hiện tại:

```text
USER  demo.customer@example.com / 123456
USER  demo.edge@example.com     / 123456
ADMIN admin@example.com         / 123456
```

Chi tiết pipeline, nguồn dữ liệu và invariant được kiểm tra sau seed:
[`docs/operations/database-and-seeding.md`](./docs/operations/database-and-seeding.md).

## NPM scripts

### Commands

| Command | Mục đích |
| --- | --- |
| `npm start` | Chạy Node server thông thường |
| `npm run dev` | Chạy local với Nodemon tự restart khi backend thay đổi |
| `npm run seed` | Reset và seed dữ liệu development/demo |
| `npm run test:unit` | Chạy unit suite |
| `npm run test:integration` | Chạy integration suite với MongoDB test riêng |
| `npm run test:all` | Chạy unit suite, sau đó integration suite |
| `npm run lint` | Chạy ESLint cho source frontend/backend |
| `npm run format:check:css` | Kiểm tra định dạng `public/css` bằng Prettier |
| `npm run format:css` | Định dạng lại `public/css` bằng Prettier |
| `npm run format` | Định dạng lại `public/js` bằng Prettier |
| `npm run email:smoke` | Gửi email thật qua Gmail SMTP |

Integration test không dùng seed data. Cấu hình `.env.test` với `MONGODB_URI` và giữ
`MONGODB_DB_NAME` kết thúc bằng `-test`. Helper test sẽ từ chối kết nối nếu database name không
có hậu tố này, để tránh ghi nhầm vào database development/production.

Chi tiết về test đọc thêm tại [`docs/operations/testing-and-quality.md`](./docs/operations/testing-and-quality.md).

## Product scope

Các capability chính của source hiện tại:

- đăng ký, đăng nhập, JWT/session refresh và quản lý session;
- email verification, password reset, change email/password;
- profile, avatar, address và scheduled account deletion;
- category/product/variant catalog và search;
- wishlist, cart và buy-now checkout draft;
- COD checkout và order lifecycle;
- return và product review;
- notifications và search history;
- admin dashboard, users, categories, products, orders, reviews và app logs;
- Cloudinary image lifecycle cho product/variant/avatar/review.

Business rule chi tiết xem tại [`docs/domains/`](./docs/domains/README.md).

## Architecture overview

```text
Browser
  ├─ full-page HTML / partial / fragment requests
  └─ JSON API requests
           ↓
        Express
           ↓
 routes → controllers → request parsers/services
                           ↓
                    Mongoose / MongoDB
                           ├─ Cloudinary
                           └─ Gmail SMTP

View controllers → EJS → Browser
```

Application là server-rendered. Browser JavaScript bổ sung partial
navigation, fragment loading, modal/form workflows và mutation API.

Hệ thống có nhiều rendering/response pattern khác nhau; không phải mọi view controller
đều đi qua cùng một renderer.

## Repository layout

```text
F8-shopee/
├── api/
│   └── index.js
├── app.js
├── server.js
├── vercel.json
├── config/
├── controllers/
├── middlewares/
├── models/
├── routes/
├── services/
├── utils/
├── views/
├── public/
│   ├── css/
│   └── js/
├── scripts/
├── tests/
└── docs/
```

Backend business logic chủ yếu nằm trong `services/`; HTTP parsing/normalization được tách
khỏi service bằng controller/request-parser layer. Frontend được tổ chức theo shared,
features, widgets và page modules.

## License

MIT. Xem [LICENSE](./LICENSE).
