import gmailTransporter from '../services/email/gmail-transporter.js';
import env from '../config/load-env.js';

const recipient = ""

const result = await gmailTransporter.sendMail({
    from: `${env.email.fromName} <${env.email.gmailUser}>`,
    to: recipient,
    subject: 'F8 Shopee Gmail SMTP smoke test',
    text: 'Gmail SMTP is configured correctly.',
    html: '<p>Gmail SMTP is configured correctly.</p>',
});

console.log(`Email sent: ${result.messageId}`);
