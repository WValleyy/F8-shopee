import nodemailer from 'nodemailer';

import env from '../../config/load-env.js';

const gmailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: env.email.gmailUser,
        pass: env.email.gmailAppPassword,
    },
});

export default gmailTransporter;
