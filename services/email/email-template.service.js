import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ejs from 'ejs';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const emailPagePath = path.resolve(
    currentDirectory,
    '../../views/pages/email/email.ejs',
);
const emailStylesPath = path.resolve(
    currentDirectory,
    '../../public/css/pages/email.css',
);
const emailStylesPromise = fs.readFile(emailStylesPath, 'utf8');

async function renderEmailTemplate(template, data) {
    const viewModel = buildEmailViewModel(template, data);
    const emailStyles = await emailStylesPromise;
    const html = await ejs.renderFile(emailPagePath, {
        ...viewModel,
        emailStyles,
    }, {
        async: false,
    });

    return {
        html,
        text: renderPlainText(viewModel),
    };
}

function buildEmailViewModel(template, data) {
    const common = {
        userName: data.userName,
        details: [],
    };

    switch (template) {
    case 'otp':
        return {
            ...common,
            otp: data.otp,
            heading: data.purpose === 'RESET_PASSWORD'
                ? 'Đặt lại mật khẩu'
                : data.purpose === 'CHANGE_EMAIL'
                    ? 'Xác minh email mới'
                    : 'Xác minh tài khoản',
            paragraphs: [
                'Mã xác minh của bạn là:',
                `Mã có hiệu lực trong ${data.expiresMinutes} phút. Không chia sẻ mã này với bất kỳ ai.`,
            ],
        };
    case 'email-changed':
        return {
            ...common,
            heading: 'Địa chỉ email đã thay đổi',
            paragraphs: [
                `Địa chỉ email tài khoản đã được thay đổi thành ${data.newEmail}.`,
                'Nếu bạn không thực hiện thay đổi này, hãy đổi mật khẩu và kiểm tra các phiên đăng nhập ngay.',
            ],
        };
    case 'refresh-token-reuse':
        return {
            ...common,
            heading: 'Cảnh báo bảo mật tài khoản',
            paragraphs: [
                'Hệ thống phát hiện một refresh token cũ được sử dụng lại. Phiên đăng nhập liên quan đã bị thu hồi.',
                'Nếu bạn không nhận ra hoạt động này, hãy đổi mật khẩu ngay.',
            ],
            details: [
                { label: 'Thời gian', value: data.detectedAt },
                {
                    label: 'Địa chỉ IP',
                    value: data.ipAddress || 'Không xác định',
                },
                {
                    label: 'Thiết bị',
                    value: data.userAgent || 'Không xác định',
                },
            ],
        };
    default:
        throw new Error(`Unknown email template: ${template}`);
    }
}

function renderPlainText(viewModel) {
    if (viewModel.otp) {
        return [
            `Chào ${viewModel.userName},`,
            viewModel.paragraphs[0],
            viewModel.otp,
            ...viewModel.paragraphs.slice(1),
        ].join('\n\n');
    }

    const sections = [
        `Chào ${viewModel.userName},`,
        ...viewModel.paragraphs,
    ];

    if (viewModel.details.length) {
        sections.push(
            viewModel.details
                .map(detail => `${detail.label}: ${detail.value}`)
                .join('\n'),
        );
    }

    return sections.join('\n\n');
}

export { renderEmailTemplate };
