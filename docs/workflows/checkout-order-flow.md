# Workflow: Checkout and Orders

Luồng này bắt đầu từ lựa chọn sản phẩm, tạo `CheckoutDraft`, đặt đơn và thay đổi trạng thái đơn.

## 1. CheckoutDraft Creation

```text
POST /api/checkout/drafts
→ requireStrictApiAuth
→ requireCustomer
→ parseCreateCheckoutDraftInput
→ createCheckoutDraft(userId, source, items)
    → gộp số lượng của các variant trùng nhau
    → buildCheckoutSelection(...)
    → kiểm tra sản phẩm, variant, danh mục, tồn kho và giới hạn đơn
    → snapshot unitPrice cho từng dòng
    → transaction
        → xác nhận USER vẫn hoạt động
        → đếm draft còn hiệu lực
        → xóa draft cũ nhất khi đã đạt giới hạn
        → tạo CheckoutDraft kèm expiresAt
→ data = draftId
```

Tạo draft không giữ chỗ và không giảm tồn kho.

## 2. Checkout Page Rendering

```text
GET /checkout?draft=<id>
→ requireStrictViewAuth
→ requireCustomer
→ attachHeaderState
→ parseCheckoutPageQuery
→ getCheckoutPageState(userId, draftId)
    → lấy draft còn hiệu lực
    → kiểm tra lại lựa chọn bằng buildCheckoutSelection
    → lấy danh sách địa chỉ và địa chỉ mặc định
→ render pages/storefront/checkout/checkout
```

Draft hết hạn được đổi thành lỗi `CHECKOUT_NOT_FOUND`. Khi product không còn khả dụng, error view nhận action quay về `/cart`.

## 3. Order Placement

```text
POST /api/orders
→ requireStrictApiAuth
→ requireCustomer
→ parseCreateOrderInput
→ placeOrder(userId, input)
    → kiểm tra Order có cùng _id=draftId
    → lấy draft còn hiệu lực
    → tạo snapshot địa chỉ giao hàng
    → transaction
        → kiểm tra lại idempotency theo Order _id
        → đọc lại CheckoutDraft
        → xác nhận USER vẫn hoạt động
        → kiểm tra lại sản phẩm, variant, danh mục và tồn kho
        → kiểm tra giới hạn số lượng, đơn giá và tổng tiền
        → tạo Order ở trạng thái SHIPPING
        → giảm tồn kho từng variant bằng điều kiện stock đủ
        → tăng Product.sold
        → nếu source=cart: xóa các variant đã mua khỏi Cart
        → xóa CheckoutDraft
→ {}
```

`Order._id` dùng chính `draftId`, vì vậy cùng một draft không tạo được hai đơn. Mọi thay đổi đơn hàng, tồn kho, số lượng đã bán, giỏ hàng và draft nằm trong cùng transaction.

Giá của order item lấy từ `unitPrice` đã lưu trong draft. `buildCheckoutSelection` dùng giá hiện tại làm fallback khi đầu vào không có snapshot hợp lệ, nhưng draft do hệ thống tạo luôn lưu `unitPrice`.

## 4. Order Completion

Người dùng gọi `PATCH /api/orders/:orderId/status`; admin gọi `PATCH /api/admin/orders/:id/status`. Cả hai route dùng `order-transition.service.js` với actor tương ứng.

```text
action=complete
→ getOrderTransition(action, actor)
→ transaction
    → lấy Order phù hợp đang ở SHIPPING
    → đặt status=COMPLETED
    → đặt completedAt
    → lưu Order
→ commit
→ tạo notification ORDER_COMPLETED
→ controller người dùng lấy notificationPreview
```

Thông báo được tạo sau commit. Lỗi tạo thông báo được ghi app log và không rollback trạng thái order. Với endpoint người dùng, response chỉ chứa `notificationPreview` khi action hoàn thành trả về một `completedOrder`; các action khác trả `data: {}`.

## 5. Order Cancellation

```text
action=cancel
→ transaction
    → lấy Order phù hợp đang ở SHIPPING
    → đặt status=CANCELLED
    → đặt cancellationReason theo USER hoặc ADMIN
    → lưu Order để tạo write conflict sớm
    → restoreOrderInventory(order, session)
        → claim inventoryRestoredAt khi đang null
        → giảm Product.sold
        → tăng ProductVariant.stock
→ commit
```

`inventoryRestoredAt` là idempotency marker của thao tác hoàn lại tồn kho. Khi marker đã tồn tại, service không cộng tồn kho lần nữa.

## 6. Failure behavior

| Điểm lỗi | Kết quả |
| --- | --- |
| Draft hết hạn hoặc sản phẩm không khả dụng | Không tạo đơn |
| Một lần giảm kho hay tăng `sold` thất bại | Transaction đặt đơn rollback |
| Cập nhật đơn hoặc hoàn kho thất bại | Transaction chuyển trạng thái rollback |
| Tạo thông báo hoàn thành thất bại | Đơn vẫn `COMPLETED`; lỗi được ghi log |
