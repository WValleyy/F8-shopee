# F8 Shopee Technical Documentation

README ở thư mục gốc trình bày cách cài đặt và tổng quan nhanh. Thư mục `docs/` mô tả architecture, domain rules, technical contracts, workflows, operations và các quyết định kiến trúc.

## 1. Documentation Structure

| Thư mục | Nội dung |
| --- | --- |
| [`architecture/`](./architecture/system-overview.md) | System architecture và trách nhiệm của từng layer |
| [`domains/`](./domains/authentication.md) | Domain model, state và invariant |
| [`contracts/`](./contracts/authentication-contract.md) | Các contract về authentication, HTTP, error handling và image lifecycle |
| [`workflows/`](./workflows/authentication-flows.md) | Luồng thực thi của các use case quan trọng |
| [`operations/`](./operations/configuration.md) | Configuration, rate limit, email, logging, seed và testing |
| [`decisions/`](./decisions/ADR-001-strict-and-light-auth-policies.md) | Các quyết định kiến trúc có chủ đích |

## 2. Documentation Scope

| Phạm vi | Tài liệu |
| --- | --- |
| Request flow và backend layering | [`architecture/system-overview.md`](./architecture/system-overview.md), [`architecture/backend-architecture.md`](./architecture/backend-architecture.md) |
| Full-page render, same-route partial và dedicated fragment | [`architecture/view-rendering.md`](./architecture/view-rendering.md) |
| Frontend modules và DOM lifecycle | [`architecture/frontend-architecture.md`](./architecture/frontend-architecture.md) |
| Quan hệ dữ liệu và dữ liệu hỗ trợ hệ thống | [`architecture/data-model.md`](./architecture/data-model.md) |
| Mô hình nghiệp vụ xác thực, phiên và OTP | [`domains/authentication.md`](./domains/authentication.md) |
| Strict auth và light auth contract | [`contracts/authentication-contract.md`](./contracts/authentication-contract.md) |
| Authentication workflows: đăng nhập, refresh session, OTP, mật khẩu và email | [`workflows/authentication-flows.md`](./workflows/authentication-flows.md) |
| Auth rate limiting | [`operations/auth-rate-limiting.md`](./operations/auth-rate-limiting.md) |
| Gmail SMTP và lỗi gửi OTP | [`operations/email.md`](./operations/email.md) |
| Quy tắc danh mục và sản phẩm | [`domains/catalog.md`](./domains/catalog.md) |
| Thay đổi cấu trúc danh mục trong trang quản trị | [`workflows/admin-category-flow.md`](./workflows/admin-category-flow.md) |
| Thay đổi product và variant trong trang quản trị | [`workflows/admin-product-flow.md`](./workflows/admin-product-flow.md) |
| Giỏ hàng, `CheckoutDraft` và đơn hàng | [`domains/cart-checkout-order.md`](./domains/cart-checkout-order.md), [`workflows/checkout-order-flow.md`](./workflows/checkout-order-flow.md) |
| Trả hàng và đánh giá | [`domains/review-return.md`](./domains/review-return.md), [`workflows/return-review-flow.md`](./workflows/return-review-flow.md) |
| Hồ sơ, địa chỉ và vòng đời tài khoản | [`domains/user-account.md`](./domains/user-account.md) |
| Xóa và ẩn danh dữ liệu tài khoản | [`workflows/account-deletion-flow.md`](./workflows/account-deletion-flow.md) |
| Phạm vi chức năng quản trị | [`domains/admin.md`](./domains/admin.md) |
| HTTP API và error handling contracts | [`contracts/http-api.md`](./contracts/http-api.md), [`contracts/error-handling.md`](./contracts/error-handling.md) |
| Quyền sở hữu và vòng đời hình ảnh Cloudinary | [`contracts/image-lifecycle.md`](./contracts/image-lifecycle.md), [`operations/cloudinary.md`](./operations/cloudinary.md) |
| Ghi log lỗi ứng dụng | [`operations/logging.md`](./operations/logging.md) |
| Biến môi trường | [`operations/configuration.md`](./operations/configuration.md) |
| MongoDB và dữ liệu seed | [`operations/database-and-seeding.md`](./operations/database-and-seeding.md) |
| Kiểm thử, lint và định dạng | [`operations/testing-and-quality.md`](./operations/testing-and-quality.md) |
| Các quyết định kiến trúc | [`decisions/ADR-001-strict-and-light-auth-policies.md`](./decisions/ADR-001-strict-and-light-auth-policies.md), [`decisions/ADR-002-mongodb-authoritative-product-image-write.md`](./decisions/ADR-002-mongodb-authoritative-product-image-write.md) |

## 3. Reading Guide

### Project Onboarding

1. [`architecture/system-overview.md`](./architecture/system-overview.md)
2. [`architecture/backend-architecture.md`](./architecture/backend-architecture.md)
3. [`architecture/view-rendering.md`](./architecture/view-rendering.md)
4. [`architecture/frontend-architecture.md`](./architecture/frontend-architecture.md)
5. Tài liệu nghiệp vụ liên quan.
6. Technical contract liên quan.
7. Workflow của use case cần tìm hiểu.
