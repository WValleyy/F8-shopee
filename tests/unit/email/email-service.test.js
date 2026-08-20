import assert from 'node:assert/strict';
import {
    afterEach,
    describe,
    it,
    vi,
} from 'vitest';

import env from '../../../config/load-env.js';
import gmailTransporter from '../../../services/email/gmail-transporter.js';
import { sendOtpEmail } from '../../../services/email/email.service.js';

const user = {
    name: 'Valley',
    email: 'user@example.com',
};

// Email service behavior is verified without sending real provider requests.
describe('email service', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('renders an OTP email before sending', async () => {
        const sendMail = vi
            .spyOn(gmailTransporter, 'sendMail')
            .mockResolvedValue(undefined);

        const result = await sendOtpEmail(user, 'VERIFY_EMAIL', '427726');

        const [sentMessage] = sendMail.mock.calls[0];
        assert.equal(result, undefined);
        assert.match(sentMessage.html, /427726/);
        assert.match(sentMessage.text, /427726/);
        assert.equal(sentMessage.to, user.email);
        assert.equal(sentMessage.subject, 'Mã xác minh email');
        assert.equal(
            sentMessage.from,
            `${env.email.fromName} <${env.email.gmailUser}>`,
        );
    });

    it('retries temporary SMTP failures', async () => {
        vi.useFakeTimers();
        const temporaryError = Object.assign(
            new Error('Temporary SMTP failure'),
            { code: 'EENVELOPE', responseCode: 451 },
        );
        const sendMail = vi
            .spyOn(gmailTransporter, 'sendMail')
            .mockRejectedValueOnce(temporaryError)
            .mockRejectedValueOnce(temporaryError)
            .mockResolvedValueOnce(undefined);

        const resultPromise = sendOtpEmail(user, 'RESET_PASSWORD', '123456');
        await vi.runAllTimersAsync();
        await resultPromise;

        assert.equal(sendMail.mock.calls.length, 3);
    });

    it('retries transient network failures', async () => {
        vi.useFakeTimers();
        const connectionError = Object.assign(
            new Error('Connection reset'),
            { code: 'ECONNRESET' },
        );
        const sendMail = vi
            .spyOn(gmailTransporter, 'sendMail')
            .mockRejectedValueOnce(connectionError)
            .mockResolvedValueOnce(undefined);

        const resultPromise = sendOtpEmail(user, 'VERIFY_EMAIL', '123456');
        await vi.runAllTimersAsync();
        await resultPromise;

        assert.equal(sendMail.mock.calls.length, 2);
    });

    it('does not retry unexpected runtime errors', async () => {
        const sendMail = vi
            .spyOn(gmailTransporter, 'sendMail')
            .mockRejectedValue(new Error('Unexpected runtime error'));

        await assert.rejects(
            () => sendOtpEmail(user, 'VERIFY_EMAIL', '123456'),
            error => (
                error.message === 'Unable to send email.'
                && error.cause?.message === 'Unexpected runtime error'
                && error.logSeverity === 'error'
            ),
        );
        assert.equal(sendMail.mock.calls.length, 1);
    });

    it('does not retry SMTP 5xx rejections', async () => {
        const rejection = Object.assign(
            new Error('Mailbox rejected'),
            { code: 'EENVELOPE', responseCode: 550 },
        );
        const sendMail = vi
            .spyOn(gmailTransporter, 'sendMail')
            .mockRejectedValue(rejection);

        await assert.rejects(
            () => sendOtpEmail(user, 'VERIFY_EMAIL', '123456'),
            /Unable to send email\./,
        );
        assert.equal(sendMail.mock.calls.length, 1);
    });

    it('does not retry SMTP authentication failures', async () => {
        const authenticationError = Object.assign(
            new Error('Invalid login'),
            { code: 'EAUTH', responseCode: 535 },
        );
        const sendMail = vi
            .spyOn(gmailTransporter, 'sendMail')
            .mockRejectedValue(authenticationError);

        await assert.rejects(
            () => sendOtpEmail(user, 'VERIFY_EMAIL', '123456'),
            /Unable to send email\./,
        );
        assert.equal(sendMail.mock.calls.length, 1);
    });
});
