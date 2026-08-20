import authConfig from '../../../config/auth.js';
import inputLimits from '../../../config/input-limits.js';
import { requestError } from '../../../utils/error/app-error.js';
import {
    readBoolean,
    readObjectBody,
    readRequiredString,
} from '../shared/request-value.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_ID_PATTERN = /^session-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readEmail(value) {
    const email = readRequiredString(value, 'Email', {
        maxLength: inputLimits.user.emailMaxLength,
    }).toLowerCase();
    if (!EMAIL_PATTERN.test(email))
        throw requestError('INVALID_EMAIL');
    return email;
}

function readPassword(value, label = 'Password') {
    return readRequiredString(value, label, {
        minLength: inputLimits.auth.passwordMinLength,
        maxLength: inputLimits.auth.passwordMaxLength,
    });
}

function parseRegisterInput(rawBody) {
    const body = readObjectBody(rawBody);
    const password = readPassword(body.password);
    const confirmPassword = readPassword(body.confirmPassword, 'Password confirmation');
    if (password !== confirmPassword)
        throw requestError('PASSWORD_CONFIRMATION_MISMATCH');
    return {
        name: readRequiredString(body.name, 'Name', {
            maxLength: inputLimits.user.nameMaxLength,
        }),
        email: readEmail(body.email),
        password,
    };
}

function parseLoginInput(rawBody) {
    const body = readObjectBody(rawBody);
    return {
        email: readEmail(body.email),
        password: readPassword(body.password),
        rememberMe: readBoolean(body.rememberMe, 'rememberMe'),
        force: readBoolean(body.force, 'force'),
    };
}

function parseForgotPasswordInput(rawBody) {
    const body = readObjectBody(rawBody);
    return { email: readEmail(body.email) };
}

function parseResetPasswordInput(rawBody) {
    const body = readObjectBody(rawBody);
    const password = readPassword(body.password);
    const confirmPassword = readPassword(body.confirmPassword, 'Password confirmation');
    if (password !== confirmPassword)
        throw requestError('PASSWORD_CONFIRMATION_MISMATCH');
    return { password };
}

function parseChangePasswordInput(rawBody) {
    const body = readObjectBody(rawBody);
    const currentPassword = readPassword(body.currentPassword, 'Current password');
    const newPassword = readPassword(body.newPassword, 'New password');
    const confirmPassword = readPassword(body.confirmPassword, 'Password confirmation');
    if (newPassword !== confirmPassword)
        throw requestError('PASSWORD_CONFIRMATION_MISMATCH');
    return { currentPassword, newPassword };
}

function parseDeleteAccountInput(rawBody) {
    const body = readObjectBody(rawBody);
    return { password: readPassword(body.password) };
}

function parseRequestEmailChangeInput(rawBody) {
    const body = readObjectBody(rawBody);
    return {
        email: readEmail(body.email),
        currentPassword: readPassword(body.currentPassword, 'Current password'),
    };
}

function parseOtpInput(rawBody) {
    const body = readObjectBody(rawBody);
    const otp = readRequiredString(body.otp, 'OTP');
    if (!new RegExp(`^\\d{${authConfig.otp.codeLength}}$`).test(otp))
        throw requestError('INVALID_OTP');
    return { otp };
}

function parseSessionIdParam(value) {
    if (typeof value !== 'string' || !SESSION_ID_PATTERN.test(value))
        throw requestError('INVALID_SESSION_ID');
    return value;
}

function truncateMetadata(value, maxLength) {
    return typeof value === 'string'
        ? value.trim().slice(0, maxLength)
        : '';
}

function parseSessionMetadataInput({
    rememberMe = false,
    userAgent,
    platform,
} = {}) {
    return {
        rememberMe,
        userAgent: truncateMetadata(
            userAgent,
            inputLimits.authSession.userAgentMaxLength,
        ),
        deviceLabel: truncateMetadata(
            platform,
            inputLimits.authSession.deviceLabelMaxLength,
        ).replace(/^"|"$/g, ''),
    };
}

export {
    parseChangePasswordInput,
    parseDeleteAccountInput,
    parseForgotPasswordInput,
    parseLoginInput,
    parseOtpInput,
    parseRegisterInput,
    parseRequestEmailChangeInput,
    parseResetPasswordInput,
    parseSessionIdParam,
    parseSessionMetadataInput,
};
