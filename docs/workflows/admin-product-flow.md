# Workflow: Product Management

Tài liệu này mô tả workflow tạo, cập nhật, thực hiện bulk action và xóa product, đồng thời làm rõ transaction boundary giữa MongoDB và Cloudinary.

## 1. HTTP entry points

Các route sản phẩm nằm dưới `requireStrictApiAuth` và `requireAdmin` của `/api/admin`:

```text
POST   /api/admin/products
PATCH  /api/admin/products/:id
POST   /api/admin/products/actions
DELETE /api/admin/products/:id
```

Route tạo và cập nhật dùng `uploadProductImages` để đọc multipart. Controller gọi `parseProductInput(req.body, req.files)` trước khi chuyển dữ liệu cho `saveAdminProduct`.

## 2. Pre-transaction Data Preparation

`saveAdminProduct` thực hiện các bước sau trước khi ghi MongoDB:

```text
nếu cập nhật: load Product và ProductVariant hiện tại
→ kiểm tra product được publish có ít nhất một variant được publish
→ kiểm tra ID, nhóm option và tổ hợp option của các variant gửi lên
→ xác định variant không còn trong payload
→ kiểm tra retainedImagePublicIds thuộc gallery hiện tại
→ tạo pending `publicId` và URL cho product image cùng variant image mới
→ tạo danh sách gallery sẽ lưu vào Product
```

Ở bước này ảnh chưa được upload. URL và `publicId` dự kiến được tạo trước để ghi vào MongoDB.

## 3. Create or Update Transaction

```text
lockCategoryTree(session)
→ getCategoryAssignmentState(categoryId)
→ yêu cầu category tồn tại, là leaf category và toàn bộ parent chain đều active
→ yêu cầu mọi Attribute trong specifications thuộc danh mục đã chọn
→ nếu xóa variant:
    từ chối variant đã xuất hiện trong Order
→ tạo hoặc cập nhật Product
→ tạo hoặc cập nhật ProductVariant
→ xóa các variant không còn trong payload
→ trả danh sách ảnh cũ cần cleanup
→ commit
```

Khóa `category-tree` được dùng chung với transaction sửa danh mục. Chi tiết nằm tại [`admin-category-flow.md`](./admin-category-flow.md).

## 4. Optimistic concurrency control

Khi cập nhật sản phẩm, editor gửi `updatedAt` của Product và từng variant hiện có.

```text
Product.findOne({ _id, updatedAt: expectedProductUpdatedAt })
ProductVariant.updateOne({ _id, product, updatedAt: expectedVariantUpdatedAt })
```

Không khớp điều kiện trả `PRODUCT_EDIT_CONFLICT`. Cơ chế này ngăn dữ liệu từ editor cũ ghi đè thay đổi mới hơn, bao gồm tồn kho đã thay đổi khi đặt đơn.

Variant có ID phải thuộc đúng sản phẩm hiện tại. Các variant gửi lên phải có cùng tập tên option và không được trùng tổ hợp `name + value` sau khi chuẩn hóa chữ thường.

## 5. Post-commit Image Processing

Sau khi MongoDB commit:

```text
uploadCloudinaryImages(pendingImages, { rollback: false })
→ xác định ảnh gallery đã bị bỏ
→ kiểm tra ảnh variant bị thay có còn được Order tham chiếu hay không
→ cleanup ảnh gallery cũ, ảnh variant không còn tham chiếu và ảnh của variant đã xóa
```

MongoDB là authoritative source trong workflow này. Lỗi upload sau commit không xóa product vừa lưu. Cleanup ảnh cũ chạy best-effort và không rollback dữ liệu MongoDB.

Ảnh variant bị thay chỉ được cleanup khi variant đó chưa xuất hiện trong Order. Ảnh của variant bị xóa đã được kiểm tra không có lịch sử đơn hàng ngay trong transaction.

## 6. Bulk actions

```text
POST /api/admin/products/actions
→ parseProductBulkActionInput
→ applyAdminProductBulkAction(productIds, action)
```

Ba action hiện có:

- `REFRESH_RATING`: tính lại rating từ review;
- `UNPUBLISH`: đặt `Product.isPublished=false` bằng `updateMany`;
- `PUBLISH`: trong transaction, kiểm tra mọi product có ít nhất một variant được publish rồi đặt `Product.isPublished=true`.

Nếu một product trong action `PUBLISH` không có variant được publish, transaction trả `PUBLISHED_PRODUCT_REQUIRES_PUBLISHED_VARIANT` và không publish danh sách.

## 7. Product Deletion

```text
DELETE /api/admin/products/:id
→ validateObjectIdParam
→ deleteAdminProduct(productId)
    → transaction
        → lấy Product
        → từ chối nếu Order tham chiếu Product
        → thu thập gallery và ảnh variant
        → xóa WishList của Product
        → xóa ProductVariant
        → xóa Product
    → commit
    → cleanup ảnh trên Cloudinary
→ {}
```

Sản phẩm đã xuất hiện trong lịch sử đơn hàng trả `PRODUCT_HAS_ORDERS`. Ảnh chỉ được xóa sau khi transaction MongoDB commit.

## 8. Failure behavior

| Điểm lỗi | Trạng thái dữ liệu |
| --- | --- |
| Parser hoặc kiểm tra trước transaction thất bại | Không ghi Product mới |
| Kiểm tra danh mục, variant hoặc xung đột cập nhật thất bại | Transaction rollback |
| Commit MongoDB thất bại | Product và ProductVariant rollback cùng nhau |
| Upload ảnh sau commit thất bại | Dữ liệu MongoDB vẫn giữ nguyên |
| Cleanup ảnh cũ thất bại | Dữ liệu MongoDB vẫn giữ nguyên; lỗi cleanup được xử lý theo image service |
