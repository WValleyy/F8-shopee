# Workflow: Returns and Reviews

Tài liệu này mô tả việc hoàn trả hàng, tạo đánh giá, đánh dấu hữu ích và thay đổi trạng thái hiển thị của đánh giá.

## 1. Return Processing

```text
POST /api/orders/:orderId/returns
→ requireStrictApiAuth
→ requireCustomer
→ validateObjectIdParam(orderId)
→ parseReturnRequestInput(body)
→ createOrderReturnRequest(userId, orderId, input)
```

Service yêu cầu ít nhất một item, giới hạn số variant theo cart config và cộng dồn số lượng khi một variant xuất hiện nhiều lần.

### 1.1 Return Transaction

```text
xác nhận USER vẫn hoạt động và chưa được lên lịch xóa
→ lấy Order của USER ở trạng thái COMPLETED
→ kiểm tra completedAt còn trong thời hạn hoàn trả
→ đối chiếu từng variant với order item
→ kiểm tra số lượng không vượt phần còn có thể hoàn
→ tạo snapshot item và tính amount
→ tạo OrderReturnRequest
→ tăng ProductVariant.stock
→ giảm Product.sold
→ tăng orderItem.returnedQuantity
→ lưu Order
→ commit
```

Return được áp dụng ngay, không có bước chờ admin duyệt. Bản ghi return, tồn kho, `Product.sold` và `returnedQuantity` được cập nhật trong cùng transaction.

## 2. Review Creation

```text
POST /api/reviews/products/:productId
→ requireStrictApiAuth
→ validateObjectIdParam(productId)
→ uploadReviewImages
→ parseCreateReviewInput
→ createProductReview(productId, userId, input)
```

Điều kiện đánh giá được kiểm tra theo composite key `user + order + product + variant`:

- đơn thuộc người dùng và đã `COMPLETED`;
- item tương ứng có trong đơn;
- item chưa được hoàn trả toàn bộ;
- chưa có review cho cùng item trong đơn.

### 2.1 Images and Transaction

```text
kiểm tra điều kiện mua hàng lần đầu
→ tạo pending Cloudinary images
→ upload ảnh với rollback=true
→ transaction
    → kiểm tra lại điều kiện mua hàng
    → tạo Review ở trạng thái isPublished=true
    → applyProductRatingDelta(productId, rating, +1)
→ commit
```

Nếu thao tác ghi MongoDB thất bại sau khi upload, service gọi `cleanupUploadedImages`. Duplicate-key error được đổi thành `REVIEW_ALREADY_EXISTS`.

## 3. Marking Reviews as Helpful

```text
PUT /api/reviews/:id/helpful
DELETE /api/reviews/:id/helpful
→ requireLightApiAuth
→ validateObjectIdParam(id)
→ setReviewHelpful(reviewId, userId, true|false)
```

`PUT` dùng `$addToSet` để thêm người dùng vào `likedBy`; `DELETE` dùng `$pull`. Chỉ review đang hiển thị mới được thay đổi. Đây là engagement state có rủi ro thấp nên route dùng light auth: chỉ kiểm tra access JWT, không đọc `AuthSession` từ MongoDB.

## 4. Review Visibility

```text
PATCH /api/admin/reviews/:id/publication
→ requireStrictApiAuth
→ requireAdmin
→ validateObjectIdParam(id)
→ parseReviewPublicationInput
→ setAdminReviewPublication(reviewId, isPublished)
    → transaction
        → lấy Review
        → nếu trạng thái không đổi: kết thúc
        → cập nhật isPublished
        → cộng hoặc trừ rating và review count của Product
→ {}
```

Trạng thái hiển thị của review và rating aggregate của product được cập nhật trong cùng transaction.

## 5. Failure behavior

| Điểm lỗi | Kết quả |
| --- | --- |
| Item hoàn trả không hợp lệ hoặc quá thời hạn | Không ghi dữ liệu hoàn trả |
| Ghi tồn kho hoặc số lượng bán thất bại | Transaction hoàn trả rollback |
| Upload ảnh review thất bại | Không bắt đầu transaction review |
| Transaction review thất bại sau upload | Dữ liệu MongoDB rollback và ảnh mới được cleanup |
| Transaction publication thất bại | Review và rating aggregate cùng rollback |
