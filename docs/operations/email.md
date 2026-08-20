# Operations: Email

## 1. Transport

Transactional email dùng Nodemailer với Gmail SMTP (`service: gmail`) và credentials:

- `GMAIL_USER`;
- `GMAIL_APP_PASSWORD`;
- `EMAIL_FROM_NAME`.

## 2. Email rendering

HTML email render qua `views/pages/email/email.ejs`; email CSS được đưa vào template rendering bởi email-template service.

Các nhóm email hiện tại gồm:

- OTP: verify email, reset password, change email;
- email-changed alert gửi về địa chỉ cũ;
- refresh-token reuse security alert.

## 3. Retry policy

`sendEmail()` retry với các transient error sau:

- SMTP response code 4xx;
- `ECONNECTION`;
- `ETIMEDOUT`;
- `ECONNRESET`.

Retry delays là:

```text
250 ms
750 ms
```

Khi đã hết số lần retry hoặc gặp lỗi không thể retry, service throw `incidentError('Unable to send email.')` kèm metadata do email provider trả về.

## 4. Email failure policies

### 4.1 OTP Delivery Required for HTTP Success

OTP flow **không phải best-effort email**.

Thứ tự thực tế:

```text
OTP rate-limit state được consume
→ challenge cũ có thể bị thay
→ challenge mới được persist
→ sendOtpEmail()
→ chỉ khi send thành công controller mới set challenge cookie
→ success response
```

Nếu SMTP vẫn thất bại sau retry:

- HTTP request thất bại;
- challenge/rate-limit đã ghi **không rollback**.
- challenge cookie mới **không được set**, vì controller chưa tới bước set cookie.
- user nhận lỗi 5xx.

### 4.2 Best-effort Post-commit Email

Ví dụ:

- alert về old email sau email change;
- refresh-token reuse alert.

Các workflow này bắt lỗi gửi email, ghi warning log và **không rollback state nghiệp vụ hoặc bảo mật đã commit**.

## 5. Smoke test

`npm run email:smoke` chạy `scripts/test-email.js` và gửi email thật.
