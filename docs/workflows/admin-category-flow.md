# Workflow: Category Management

Luồng quản lý danh mục tạo hoặc cập nhật cây danh mục và có thể chuyển sản phẩm từ danh mục cha xuống danh mục con `khac`.

## 1. HTTP entry points

```text
POST  /api/admin/categories
PATCH /api/admin/categories/:id
→ requireStrictApiAuth
→ requireAdmin
→ validateObjectIdParam(id) đối với PATCH
→ parseCategoryInput
→ saveAdminCategory(categoryId|null, data)
```

Parser đọc `name`, `parentId`, `sortOrder` và `isActive`. Slug được tạo từ `name` bằng `slugify` trước transaction. `name` và `slug` đều unique trên toàn bộ cây danh mục.

## 2. Category-tree serialization lock

Transaction bắt đầu bằng:

```text
AdminResourceLock.updateOne(
  { _id: "category-tree" },
  { $currentDate: { updatedAt: true } },
  { upsert: true, session }
)
```

Mọi transaction sửa danh mục cùng ghi vào một document khóa. `saveAdminProduct` cũng ghi document này trước khi kiểm tra danh mục, nhờ đó việc sửa danh mục và lưu sản phẩm không xác minh trên hai trạng thái cây khác nhau cùng lúc.

## 3. Current and Parent Category Validation

Khi cập nhật, service đọc category hiện tại trong transaction. Nếu không tìm thấy, service trả `CATEGORY_NOT_FOUND`; nếu chọn chính category đó làm parent, service trả `CATEGORY_SELF_PARENT`.

Khi có `parentId`, service:

1. lấy danh mục cha;
2. kiểm tra danh mục cha có sản phẩm trực tiếp hay không;
3. đi ngược chuỗi tổ tiên để phát hiện chu trình.

Danh mục cha không tồn tại trả `CATEGORY_PARENT_NOT_FOUND`. Nếu một tổ tiên trùng với danh mục đang cập nhật, service trả `CATEGORY_PARENT_CYCLE`.

## 4. `khac` Child Category Case

Category đang chứa product trực tiếp không được chọn làm parent thông thường. Nếu slug mới khác `khac`, service trả `CATEGORY_PARENT_HAS_PRODUCTS`.

Slug `khac` là trường hợp riêng: service cho phép tạo hoặc chuyển category con xuống dưới parent đang có product và đặt `shouldMoveParentProducts=true`. Nếu category `khac` đang cập nhật có category con riêng, service trả `CATEGORY_OTHER_MUST_BE_LEAF`.

## 5. Transactional Data Write

```text
lockCategoryTree
→ kiểm tra danh mục hiện tại, parent và chu trình
→ tạo hoặc cập nhật Category
→ nếu shouldMoveParentProducts:
    chuyển mọi Product có category=parentId sang category mới lưu
→ commit
```

Việc lưu danh mục và chuyển sản phẩm nằm trong cùng transaction. Lỗi unique index `11000` được đổi thành `CATEGORY_NAME_OR_SLUG_CONFLICT`.

## 6. Mutation result

| Thao tác | Dữ liệu thay đổi |
| --- | --- |
| Tạo danh mục | Một `Category` mới |
| Cập nhật danh mục | `name`, `slug`, `parent`, `sortOrder`, `isActive` |
| Tạo hoặc chuyển danh mục `khac` dưới parent có sản phẩm | `Category` và `Product.category` |
| Transaction thất bại | Toàn bộ thay đổi trên được rollback |

Luồng lưu sản phẩm dùng cùng khóa được mô tả tại [`admin-product-flow.md`](./admin-product-flow.md).
