# Domain: Admin

## 1. Authorization boundary

Tất cả `/api/admin/*` đi qua strict API auth + ADMIN authorization. Admin view router cũng yêu cầu strict view auth và admin role.

## 2. Dashboard and App Logs

Admin có server-rendered dashboard và app-log page. App-log UI đọc dữ liệu `AppLog` trong MongoDB; file log không phải fallback data source của UI.

Chi tiết xem tại [`../operations/logging.md`](../operations/logging.md).

## 3. User management

Admin có thể:

- lọc và liệt kê người dùng, gồm tổng chi tiêu;
- block/unblock user có role `USER` chưa xóa tài khoản;
- purge user đã lên lịch xóa và đến `purgeAfter`.

Không được thay đổi trạng thái hoạt động của user ADMIN bằng thao tác quản lý user thông thường. Việc khóa user phải thu hồi các session đang hoạt động; tài khoản đã lên lịch xóa được coi là terminal state trong workflow đổi trạng thái và không được kích hoạt lại qua workflow đó.

Quy tắc xóa dữ liệu: [`user-account.md`](./user-account.md).  
Luồng thực thi: [`../workflows/account-deletion-flow.md`](../workflows/account-deletion-flow.md).

## 4. Category management

Thao tác tạo và cập nhật danh mục giữ các quy tắc:

- parent category tồn tại;
- category không thể chọn chính nó làm parent;
- category tree không có cycle;
- product không được gán trực tiếp cho category đã có category con;
- khi thêm category con đầu tiên, product hiện có của parent có thể được chuyển xuống category "Khác";
- các category cùng parent không trùng tên và slug là duy nhất trong toàn bộ category tree.

Thao tác thay đổi category và chỉnh sửa product cùng dùng category-tree serialization lock, nhờ đó các bước validation không chạy trên hai state khác nhau của category tree. Chi tiết nằm trong [`../workflows/admin-category-flow.md`](../workflows/admin-category-flow.md).

## 5. Product management

Tạo hoặc cập nhật `Product` gồm dữ liệu chung, specifications, variants và images.

Các điều kiện nghiệp vụ:

- category được chọn phải tồn tại, là leaf category và đang hoạt động trên toàn bộ parent chain;
- product được publish phải có ít nhất một variant được publish;
- specification attribute phải thuộc category đã chọn;
- variant đã xuất hiện trong order không thể bị xóa;
- editor mở từ dữ liệu cũ không được ghi đè thay đổi đã được lưu bởi request khác.

Chi tiết xem tại: [`../workflows/admin-product-flow.md`](../workflows/admin-product-flow.md).  


## 6. Product bulk actions

Các actions:

- `PUBLISH`;
- `UNPUBLISH`;
- `REFRESH_RATING`.

Thao tác publish chỉ thành công khi product có ít nhất một variant được publish.

## 7. Product deletion

Product không được xóa vĩnh viễn nếu đã xuất hiện trong order. Với product chưa có order, workflow xóa các wishlist, variants và product liên quan, sau đó cleanup image trên Cloudinary.

## 8. Order management

Admin dùng cùng quy tắc chuyển trạng thái order với người dùng nhưng có actor `ADMIN`:

- `SHIPPING → COMPLETED`;
- `SHIPPING → CANCELLED`.

Thao tác cancel chỉ hoàn lại tồn kho một lần; lý do hủy ghi rõ người thực hiện là admin hay customer.

## 9. Review moderation

Admin có thể ẩn hoặc hiện review. Trạng thái hiển thị của review và `Product.rating` aggregate được cập nhật nhất quán trong cùng transaction.
