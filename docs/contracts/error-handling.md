# Contract: Error handling

## 1. Main Error Categories

### Request/operational error

`requestError(code, options)` biểu diễn operational error từ request hoặc business rule, chẳng hạn input không hợp lệ, không tìm thấy dữ liệu, conflict, auth failure hoặc rate limit. Mỗi code có một mapping trong error config.

Khi `logSeverity` là `null`, lỗi không được ghi như một incident.

### Incident/system error

`incidentError(...)` và các unexpected error đã được normalize đại diện cho system failure cần observability. Internal context và stack không được trả cho client.

## 2. Safe metadata vs internal context

- `meta` dùng cho dữ liệu an toàn mà response có thể cần.
- `context` dùng cho diagnostics nội bộ và dữ liệu điều khiển central middleware; nó không được serialize vào response body.

Token, password, OTP, secret hoặc raw sensitive input không đưa vào `meta`/message trả client.

## 3. Central middleware

`handleAppError` sở hữu error response format và normalize các lỗi framework phổ biến như:

- body quá lớn;
- malformed JSON;
- Multer upload errors.

Controller không tự dùng `try/catch` chỉ để trả `res.status(...).json(...)` cho business error thông thường.

## 4. API/partial response

API request và request có `X-Partial-Target` nhận JSON error gồm code, message và safe metadata khi lỗi có cung cấp.

Response bị rate limit có header `Retry-After` lấy từ `context.retryAfter`.

## 5. Full-page error

HTML navigation nhận error view. Với lỗi server (`>=500`), UI không render trực tiếp exception message nội bộ. Operational error có thể kèm action dành cho error view.

Full-page 404 được gắn header state trước khi render error template; API và partial 404 không thực hiện bước này.

## 6. Logging

Incident và unexpected error đi qua app logger. Logger lưu best-effort; logging failure không che mất response chính.

Lỗi từ Cloudinary hoặc email side effect được ghi warning/error log theo từng scope, kèm `publicId` hoặc context của provider. Việc rollback tuân theo policy của workflow tương ứng.

## 7. Service error mapping

Service tạo lỗi mang ý nghĩa nghiệp vụ. Các lỗi từ MongoDB hoặc dịch vụ bên ngoài được xử lý theo cách hiện tại:

- operational error có mapping được chuyển thành `requestError`;
- lỗi hệ thống được bọc bằng `incidentError` và giữ `cause` cùng `context`;
- lỗi ảnh hưởng atomicity được chuyển tiếp tới error middleware;
- lỗi của side effect best-effort được ghi log và không làm thất bại thao tác chính.
