# Domain: Catalog

## 1. Category tree

Category có `parent`, `name`, `slug`, `sortOrder`, `isActive`.

`name` và `slug` đều unique trên toàn bộ cây danh mục. Slug được tạo từ name, vì vậy các danh mục ở những nhánh khác nhau vẫn phải dùng tên riêng biệt.

Một category chỉ khả dụng khi chính nó và toàn bộ parent chain đều active. Điều kiện hiển thị product trên storefront dựa vào toàn bộ chain này, không chỉ `category.isActive` của category hiện tại.

Product được gán vào leaf category. Các thao tác quản trị giữ category tree không tự tham chiếu, không tạo cycle và đồng bộ với việc chỉnh sửa product. Chi tiết nằm trong [`../workflows/admin-category-flow.md`](../workflows/admin-category-flow.md).

## 2. Attribute

`Attribute` thuộc một danh mục và định nghĩa tên cùng đơn vị tùy chọn cho thông số sản phẩm.

Thông số sản phẩm quản trị chỉ hợp lệ khi `Attribute` được tham chiếu thuộc danh mục của sản phẩm đang chọn.

## 3. Product and Variant

`Product` giữ dữ liệu chung, gallery, category, specifications, trạng thái đăng bán và các counter.

`ProductVariant` giữ SKU, options, giá bán, giá gốc, tồn kho, hình ảnh và trạng thái publish. Tồn kho được quản lý theo variant.

Một product được publish phải có ít nhất một variant được publish. Điều kiện hiển thị và mua hàng yêu cầu category, product và variant tương ứng đều khả dụng.

## 4. Storefront eligibility

Một sản phẩm có thể mua khi các điều kiện sau đều đúng:

- sản phẩm đang đăng bán;
- category là leaf category và toàn bộ parent chain đều active;
- có variant được publish;
- với cart, checkout và order, variant cụ thể vẫn được publish và tồn kho đáp ứng số lượng.

## 5. Search

Tên Atlas Search index hiện tại là `product-search`.

Tìm kiếm ưu tiên tên product, sau đó tới thương hiệu và mô tả theo cấu hình hiện tại; Atlas Search dùng fuzzy search và autocomplete tương ứng.

Nếu deployment không hỗ trợ Atlas Search, dùng regex fallback.

## 6. Sort/pagination

Mỗi trang danh mục hiện có tối đa **10** sản phẩm. Các chế độ sắp xếp gồm phổ biến, mới nhất, nhiều lượt thích nhất, giá tăng dần và giá giảm dần.

## 7. Rating aggregate

`Product.rating` giữ aggregate `sum`, `count`, `average` thay vì tính toàn bộ reviews mỗi lần đọc.

Chỉ review đang hiển thị đóng góp vào rating aggregate. Việc tạo review hoặc thay đổi trạng thái hiển thị cập nhật `Product.rating` trong cùng transaction.

## 8. Likes vs wishlist

`Product.likes` là bộ đếm gắn với `WishList`. Thêm hoặc xóa danh sách yêu thích cập nhật quan hệ và bộ đếm trong cùng transaction. Khi xóa dữ liệu tài khoản, hệ thống giảm bộ đếm trước khi xóa danh sách yêu thích của người dùng.
