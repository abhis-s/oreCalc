/**
 * Escapes HTML special characters for safe interpolation into email markup.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeEmailHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Builds the plain-text and HTML email content for a minted supporter code.
 *
 * @param {{ supporterName?: string, code: string }} params
 * @returns {{ subject: string, text: string, html: string }}
 */
function buildSupporterCodeEmail({ supporterName = '', code }) {
    const cleanName = typeof supporterName === 'string' ? supporterName.trim().slice(0, 80) : '';
    const greeting = cleanName ? `Hi ${cleanName},` : 'Hi there,';
    const safeGreeting = escapeEmailHtml(greeting);
    const safeCode = escapeEmailHtml(code);

    const subject = 'Your ClashCalc Supporter Code';
    const text = [
        greeting,
        '',
        'Thank you for supporting ClashCalc! Your support directly helps cover server and infrastructure costs.',
        '',
        'Your single-use Supporter redemption code is:',
        '',
        `    ${code}`,
        '',
        'How to redeem:',
        '1. Sign in to your ClashCalc account at https://clashcalc.com/account/',
        '2. Click the Supporter badge next to your username.',
        '3. Click "Redeem Code", paste the code above, and submit.',
        '',
        'This unlocks your verified Supporter badge and the exclusive Dragon Duke (Prestige) animated avatar.',
        '',
        'If you run into any issues redeeming your code, just reply to this email.',
        '',
        'Thank you again,',
        'ClashCalc'
    ].join('\n');

    const html = [
        '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937; line-height: 1.6;">',
        `<p>${safeGreeting}</p>`,
        '<p>Thank you for supporting <strong>ClashCalc</strong>! Your support directly helps cover server and infrastructure costs.</p>',
        '<p>Your single-use Supporter redemption code is:</p>',
        `<div style="margin: 20px 0; padding: 16px 20px; background: #111827; color: #f9fafb; border-radius: 10px; text-align: center; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 20px; font-weight: 700; letter-spacing: 2px;">${safeCode}</div>`,
        '<p><strong>How to redeem:</strong></p>',
        '<ol style="padding-left: 20px;">',
        '<li>Sign in to your account at <a href="https://clashcalc.com/account/">clashcalc.com/account/</a>.</li>',
        '<li>Click the Supporter badge next to your username.</li>',
        '<li>Click <strong>Redeem Code</strong>, paste the code above, and submit.</li>',
        '</ol>',
        '<p>This unlocks your verified Supporter badge and the exclusive <strong>Dragon Duke (Prestige)</strong> animated avatar.</p>',
        '<p style="color: #6b7280; font-size: 13px;">If you run into any issues redeeming your code, simply reply to this email.</p>',
        '</div>'
    ].join('');

    return { subject, text, html };
}

/**
 * Creates a configured nodemailer SMTP transporter from environment variables.
 *
 * @param {Record<string, string | undefined>} env
 */
function createSmtpTransporter(env) {
    const nodemailer = require('nodemailer');
    return nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: Number(env.SMTP_PORT) || 587,
        secure: env.SMTP_SECURE === 'true',
        auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS
        }
    });
}

/**
 * Builds the plain-text admin notification email when a user redeems a supporter code.
 *
 * @param {{
 *     username: string,
 *     userId?: string,
 *     source?: string,
 *     note?: string,
 *     bmcEventId?: string | null,
 *     codeHash?: string,
 *     redeemedAt?: number
 * }} params
 * @returns {{ subject: string, text: string }}
 */
function buildSupporterRedeemedAdminEmail({
    username,
    userId = '',
    source = 'manual',
    note = '',
    bmcEventId = null,
    codeHash = '',
    redeemedAt = Date.now()
}) {
    const safeUsername = String(username || 'unknown').trim();
    const shortHash = typeof codeHash === 'string' && codeHash.length >= 12 ? codeHash.slice(0, 12) : 'n/a';
    const isoTime = new Date(redeemedAt).toISOString();

    const subject = `[ClashCalc] Supporter Code Redeemed by ${safeUsername}`;
    const text = [
        '================================================================================',
        'SUPPORTER CODE REDEMPTION',
        '================================================================================',
        '',
        `Username     : ${safeUsername}`,
        `User ID      : ${userId || 'unknown'}`,
        `Source       : ${source || 'manual'}`,
        `Note         : ${note || 'none'}`,
        `BMC Event ID : ${bmcEventId || 'none'}`,
        `Code Hash    : ${shortHash}...`,
        `Redeemed At  : ${isoTime}`,
        '',
        '================================================================================',
        'Notification managed by ClashCalc Supporter System'
    ].join('\n');

    return { subject, text };
}

/**
 * Sends a supporter redemption code email via configured SMTP transport.
 * Returns { sent: false, skipped: true } gracefully when SMTP is unconfigured.
 *
 * @param {{
 *     toEmail: string,
 *     supporterName?: string,
 *     code: string,
 *     env?: Record<string, string | undefined>,
 *     transporterOverride?: { sendMail: (opts: any) => Promise<any> }
 * }} params
 * @returns {Promise<{ sent: boolean, skipped?: boolean, error?: string }>}
 */
async function sendSupporterCodeEmail({
    toEmail,
    supporterName = '',
    code,
    env = process.env,
    transporterOverride = null
}) {
    const cleanEmail = typeof toEmail === 'string' ? toEmail.trim() : '';
    if (!cleanEmail || !code) {
        return { sent: false, skipped: true };
    }

    if (!transporterOverride && (!env.SMTP_USER || !env.SMTP_HOST)) {
        console.warn('[SupporterMail] [WARN] SMTP credentials not configured; skipping automated supporter code email.');
        return { sent: false, skipped: true };
    }

    try {
        const transporter = transporterOverride || createSmtpTransporter(env);
        const { subject, text, html } = buildSupporterCodeEmail({ supporterName, code });
        const mailOptions = {
            from: `"ClashCalc" <${env.EMAIL_FROM || 'noreply@clashcalc.com'}>`,
            to: cleanEmail,
            replyTo: env.RECIPIENT_EMAIL_SUPPORT || 'support@clashcalc.com',
            subject,
            text,
            html
        };

        await transporter.sendMail(mailOptions);
        console.log('[SupporterMail] [OK] Supporter redemption code email dispatched.');
        return { sent: true };
    } catch (err) {
        console.error('[SupporterMail] [ERROR] Failed to send supporter code email:', err);
        return { sent: false, error: err instanceof Error ? err.message : String(err) };
    }
}

/**
 * Sends an admin notification email whenever a user newly activates supporter status.
 *
 * @param {{
 *     username: string,
 *     userId?: string,
 *     source?: string,
 *     note?: string,
 *     bmcEventId?: string | null,
 *     codeHash?: string,
 *     redeemedAt?: number,
 *     env?: Record<string, string | undefined>,
 *     transporterOverride?: { sendMail: (opts: any) => Promise<any> }
 * }} params
 * @returns {Promise<{ sent: boolean, skipped?: boolean, error?: string }>}
 */
async function sendSupporterRedeemedAdminEmail({
    username,
    userId = '',
    source = 'manual',
    note = '',
    bmcEventId = null,
    codeHash = '',
    redeemedAt = Date.now(),
    env = process.env,
    transporterOverride = null
}) {
    const toRecipient = env.RECIPIENT_EMAIL_ALERTS || env.RECIPIENT_EMAIL_SUPPORT || '';
    if (!toRecipient) {
        return { sent: false, skipped: true };
    }

    if (!transporterOverride && (!env.SMTP_USER || !env.SMTP_HOST)) {
        return { sent: false, skipped: true };
    }

    try {
        const transporter = transporterOverride || createSmtpTransporter(env);
        const { subject, text } = buildSupporterRedeemedAdminEmail({
            username,
            userId,
            source,
            note,
            bmcEventId,
            codeHash,
            redeemedAt
        });

        await transporter.sendMail({
            from: `"ClashCalc System" <${env.EMAIL_FROM || 'noreply@clashcalc.com'}>`,
            to: toRecipient,
            subject,
            text
        });
        console.log(`[SupporterMail] [OK] Admin redemption notification sent for ${username}.`);
        return { sent: true };
    } catch (err) {
        console.error('[SupporterMail] [ERROR] Failed to send admin redemption notification:', err);
        return { sent: false, error: err instanceof Error ? err.message : String(err) };
    }
}

module.exports = {
    buildSupporterCodeEmail,
    buildSupporterRedeemedAdminEmail,
    sendSupporterCodeEmail,
    sendSupporterRedeemedAdminEmail
};
