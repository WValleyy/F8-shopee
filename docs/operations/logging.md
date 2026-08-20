# Operations: Application logging

## 1. Logger entry point

Application code ghi structured log event qua:

```text
logAppEvent(scope, severity, context)
```

`AppLog` schema hỗ trợ các severity:

```text
info
warning
error
```

Logger normalize các trường:

- `scope`;
- `message` tóm tắt sự kiện;
- structured `context`;
- `stack` nếu có;
- `searchText` dạng lowercase dùng cho admin search trên MongoDB.

Các giới hạn độ dài nằm trong `config/app-log.js`.

## 2. Log sinks

MongoDB luôn là một log sink. File log chỉ được thêm làm sink khi ứng dụng không chạy trên Vercel. Các sink ghi song song bằng `Promise.all` và tự xử lý lỗi nội bộ.

### File log

Path:

```text
<process.cwd()>/logs/app.logs
```

Quy trình ghi:

```text
mkdir logs/ recursive
→ appendFile(app.logs, formatted entry, utf8)
```

Mỗi entry chứa timestamp, severity, scope, message, context và stack nếu có.

### MongoDB

Model: `AppLog`.

Mongo insert chỉ chạy khi:

```text
mongoose.connection.readyState === 1
```

Nếu DB chưa sẵn sàng, thao tác ghi MongoDB bỏ qua sự kiện. Ngoài Vercel, file log vẫn được thử ghi.

## 3. Best-effort failure behavior

Lỗi ghi file hoặc MongoDB không thay thế lỗi ứng dụng hay luồng xử lý ban đầu.

- file write fail → `console.error('[app-logger] failed to write file log', ...)`;
- Mongo insert fail → `console.error('[app-logger] failed to write MongoDB log', ...)`;
- helper tự bắt lỗi nên `logAppEvent()` không throw.

Do đó, việc không có bản ghi `AppLog` không chứng minh sự kiện chưa từng xảy ra. Cơ sở dữ liệu có thể chưa sẵn sàng hoặc thao tác ghi MongoDB có thể thất bại. Ngoài Vercel, file log vẫn có thể đã được ghi thành công.

## 4. Admin Log UI Reads MongoDB Instead of Files

Admin route:

```text
GET /admin/app-logs
```

strict admin view → `listAdminAppLogsPage()` → query `AppLog` collection.

Admin UI lọc, tìm kiếm và phân trang trực tiếp trên các MongoDB record. `logs/app.logs` không được parse làm fallback data source.
