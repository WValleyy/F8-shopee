import authConfig from '../../config/auth.js';
import env from '../../config/load-env.js';
import gmailTransporter from './gmail-transporter.js';
import { incidentError } from '../../utils/error/app-error.js';
import { renderEmailTemplate } from './email-template.service.js';

const RETRY_DELAYS_MS = [250, 750];

function isRetryableEmailError(error) {
    const responseCode = Number(error?.responseCode);

    if (responseCode >= 400 && responseCode <= 499)
        return true;

    return [
        'ECONNECTION',
        'ETIMEDOUT',
        'ECONNRESET',
    ].includes(error?.code);
}

async function sendEmail(message) {
    const rendered = await renderEmailTemplate(message.template, message.data);
    let lastError = null;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
        try {
            await sendWithTransporter({ ...message, ...rendered });
            return;
        } catch (error) {
            lastError = error;

            if (
                !isRetryableEmailError(error)
                || attempt >= RETRY_DELAYS_MS.length
            )
                break;

            await new Promise(resolve => setTimeout(
                resolve,
                RETRY_DELAYS_MS[attempt],
            ));
        }
    }

    throw incidentError('Unable to send email.', {
        cause: lastError,
        context: {
            template: message.template,
            recipient: message.to,
            providerCode: lastError?.code ?? null,
            providerResponseCode: lastError?.responseCode ?? null,
            providerCommand: lastError?.command ?? null,
        },
    });
}

async function sendOtpEmail(user, purpose, otp) {
    const subjectByPurpose = {
        VERIFY_EMAIL: 'Mã xác minh email',
        RESET_PASSWORD: 'Mã đặt lại mật khẩu',
        CHANGE_EMAIL: 'Mã xác minh email mới',
    };

    await sendEmail({
        to: purpose === 'CHANGE_EMAIL' ? user.targetEmail : user.email,
        subject: subjectByPurpose[purpose],
        template: 'otp',
        data: {
            userName: user.name,
            otp,
            purpose,
            expiresMinutes: Math.ceil(authConfig.otp.ttlSeconds / 60),
        },
    });
}

async function sendEmailChangedAlert(user, oldEmail) {
    await sendEmail({
        to: oldEmail,
        subject: 'Địa chỉ email tài khoản đã thay đổi',
        template: 'email-changed',
        data: { userName: user.name, newEmail: user.email },
    });
}

async function sendRefreshTokenReuseAlert(user, metadata) {
    await sendEmail({
        to: user.email,
        subject: 'Cảnh báo bảo mật tài khoản',
        template: 'refresh-token-reuse',
        data: {
            userName: user.name,
            detectedAt: new Intl.DateTimeFormat('vi-VN', {
                dateStyle: 'medium',
                timeStyle: 'medium',
                timeZone: 'Asia/Ho_Chi_Minh',
            }).format(new Date()),
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
        },
    });
}

async function sendWithTransporter(message) {
    await gmailTransporter.sendMail({
        from: `${env.email.fromName} <${env.email.gmailUser}>`,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
    });
}

export {
    sendEmailChangedAlert,
    sendOtpEmail,
    sendRefreshTokenReuseAlert,
};
