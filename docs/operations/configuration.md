# Operations: Configuration

## 1. Environment loading

`config/load-env.js` validate environment khi module được load. Nếu cấu hình bắt buộc bị thiếu hoặc không hợp lệ, process dừng ngay thay vì tiếp tục với giá trị mặc định.

Các secret auth dài ít nhất 32 ký tự và ba secret security (`ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `AUTH_GRACE_ENCRYPTION_KEY`) khác nhau.

## 2. Environment variables

| Variable | Mục đích |
| --- | --- |
| `NODE_ENV` | Xác định runtime environment: development, test hoặc production |
| `PORT` | Cổng HTTP cho môi trường local hoặc server truyền thống; tùy chọn, mặc định `3000` |
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_DB_NAME` | Tên database |
| `ACCESS_TOKEN_SECRET` | Ký và xác minh access JWT |
| `REFRESH_TOKEN_SECRET` | Ký và xác minh refresh JWT |
| `AUTH_GRACE_ENCRYPTION_KEY` | Mã hóa token payload trong refresh grace record |
| `CLOUDINARY_CLOUD_NAME` | Tên Cloudinary account |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `GMAIL_USER` | Gmail SMTP account |
| `GMAIL_APP_PASSWORD` | Gmail app password |
| `EMAIL_FROM_NAME` | Tên hiển thị trong trường `From` |
| `APP_ORIGIN` | Origin được chấp nhận bởi same-origin middleware |
| `TRUST_PROXY` | Cấu hình `trust proxy` của Express |
| `AUTH_RATE_LIMIT_ENABLED` | Bật hoặc tắt auth rate limiting |

`PORT` là biến tùy chọn. Các biến còn lại trong bảng là bắt buộc; `AUTH_RATE_LIMIT_ENABLED` phải có giá trị boolean mà loader hiện tại đọc được.

## 3. `APP_ORIGIN`

Same-origin middleware dùng `APP_ORIGIN` làm origin hợp lệ khi kiểm tra request.

## 4. Trust proxy

`app.js` chỉ gọi `app.set('trust proxy', ...)` khi giá trị khác `0` hoặc `false`.

Giá trị `trust proxy` ảnh hưởng `req.ip`, rate limit và địa chỉ IP trong cảnh báo refresh-token reuse. Cấu hình production hiện được xác định theo cấu trúc reverse proxy của môi trường triển khai.

## 5. Auth Constants Outside `.env`

TTL, session policy và cookie names được khai báo trực tiếp trong `config/auth.js`, không lấy từ environment variables.

## 6. Commerce Constants Outside `.env`

Commerce limits và TTL nằm trong `config/commerce.js`, không lấy từ environment variables. Chi tiết nằm trong [`../domains/cart-checkout-order.md`](../domains/cart-checkout-order.md) và [`../domains/review-return.md`](../domains/review-return.md).


## 7. Vercel

Vercel đưa các biến môi trường đã cấu hình trực tiếp vào `process.env`; file `.env` không được tải lên môi trường triển khai. `PORT` không được ứng dụng sử dụng để lắng nghe khi chạy dưới dạng Vercel Function.

Khi chạy trên Vercel, ứng dụng đọc `NODE_ENV`, `TRUST_PROXY` và `APP_ORIGIN` từ
`process.env`. `APP_ORIGIN` được dùng cho same-origin validation của các request thay đổi dữ liệu,
còn `TRUST_PROXY` quyết định cách Express xác định địa chỉ IP qua proxy.

Vercel entry point là `api/index.js`. Module này kết nối MongoDB qua `connectDB()` rồi chuyển request
vào Express app. `connectDB()` tái sử dụng Mongoose connection khi function instance còn tồn tại. File
log bị tắt trên Vercel; app log vẫn được ghi vào MongoDB.
