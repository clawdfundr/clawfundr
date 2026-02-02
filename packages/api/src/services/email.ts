import { getEnvConfig } from '../config/env';

type MailResult =
    | { sent: true }
    | { sent: false; reason: string };

interface SendApiKeyEmailParams {
    to: string;
    apiKey: string;
    userId: string;
}

export function isEmailConfigured() {
    const config = getEnvConfig();
    return Boolean(config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS && config.SMTP_FROM);
}

export async function sendApiKeyEmail(params: SendApiKeyEmailParams): Promise<MailResult> {
    const config = getEnvConfig();

    if (!isEmailConfigured()) {
        return {
            sent: false,
            reason: 'Email service is not configured on the server (missing SMTP_* env vars).',
        };
    }

    let nodemailer: any;
    try {
        nodemailer = require('nodemailer');
    } catch (_error) {
        return {
            sent: false,
            reason: 'Server is missing nodemailer dependency. Run: npm install -w packages/api nodemailer',
        };
    }

    const transporter = nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: parseInt(config.SMTP_PORT, 10),
        secure: config.SMTP_SECURE === 'true',
        auth: {
            user: config.SMTP_USER,
            pass: config.SMTP_PASS,
        },
    });

    const subject = 'Your Clawfundr API key';
    const text = [
        'Your Clawfundr API key has been generated.',
        '',
        `User ID: ${params.userId}`,
        `API key: ${params.apiKey}`,
        '',
        'Keep this key secure and do not share it publicly.',
    ].join('\n');

    const html = `
        <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; line-height: 1.6; color: #111;">
            <h2 style="margin: 0 0 12px;">Clawfundr API key generated</h2>
            <p style="margin: 0 0 8px;">Your API key is ready:</p>
            <p style="margin: 0 0 8px;"><strong>User ID:</strong> ${params.userId}</p>
            <p style="margin: 0 0 14px;"><strong>API key:</strong><br /><code>${params.apiKey}</code></p>
            <p style="margin: 0;">Keep this key secure and do not share it publicly.</p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: config.SMTP_FROM,
            to: params.to,
            subject,
            text,
            html,
        });

        return { sent: true };
    } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown email error';
        return { sent: false, reason };
    }
}
