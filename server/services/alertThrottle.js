const nodemailer = require('nodemailer');

const ALERT_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

/** @type {Map<string, number>} */
const recentAlertTimestamps = new Map();

const outageState = {
    is503Active: false,
    last503AlertSent: 0
};

/**
 * Checks whether an incoming error message matches ignored client noise patterns.
 * Ignored noise includes opaque extension script errors, tag lookups 404, CWL/War state logs, etc.
 *
 * @param {string} message - Error message to inspect.
 * @returns {boolean} True if the error is safe to discard completely.
 */
function isIgnoredNoise(message) {
    if (!message || typeof message !== 'string') return true;
    const str = message.trim();

    // 1. Browser extension / opaque cross-origin script error
    if (str === 'Script error.' || str === 'Console Error: Script error.' || str.includes('Script error.')) {
        return true;
    }

    // 2. Player tag / Clan search 404 or syntax typos
    if (
        str.includes('apiErrors.notFound') ||
        str.includes('Invalid Clash of Clans tag format') ||
        str.includes('Failed to load player data: apiErrors.notFound') ||
        str.includes('Failed to load player preview data: apiErrors.notFound')
    ) {
        return true;
    }

    // 3. Expected game states (CWL inactive, private war log)
    if (
        str.includes('CWL league group: apiErrors.notFound') ||
        str.includes('CWL') ||
        str.includes('clan war log') ||
        str.includes('Clan war log is private') ||
        str.includes('apiErrors.privateWarLog')
    ) {
        return true;
    }

    // 4. Service Worker lifecycle / background polling drops
    if (
        str.includes('SW registration failed') ||
        str.includes('SW update check failed') ||
        str.includes('ServiceWorker') ||
        str.includes('ResizeObserver')
    ) {
        return true;
    }

    return false;
}

/**
 * Checks whether an incoming request/error originates from a search crawler, bot, or automated renderer.
 *
 * @param {string} [userAgent=''] - User-Agent header or client-reported userAgent string.
 * @param {string} [message=''] - Error message text.
 * @param {string} [url=''] - URL where the error occurred.
 * @returns {boolean} True if the traffic comes from a crawler, scraper, or bot.
 */
function isBotTraffic(userAgent = '', message = '', url = '') {
    const ua = String(userAgent || '').toLowerCase();
    const msg = String(message || '').toLowerCase();
    const pageUrl = String(url || '').toLowerCase();

    // Known search engine crawlers, preview bots, security scanners, and headless renderers
    const botPatterns = [
        'googlebot',
        'google-inspectiontool',
        'storebot-google',
        'googleother',
        'mediapartners-google',
        'adsbot-google',
        'bingbot',
        'bingpreview',
        'msnbot',
        'microsoftpreview',
        'slurp',
        'duckduckbot',
        'duckduckgo-favicons-bot',
        'baiduspider',
        'yandex',
        'sogou',
        'exabot',
        'facebot',
        'facebookexternalhit',
        'meta-externalagent',
        'ia_archiver',
        'twitterbot',
        'telegrambot',
        'discordbot',
        'whatsapp',
        'petalbot',
        'semrushbot',
        'ahrefsbot',
        'dotbot',
        'mj12bot',
        'screaming frog',
        'headlesschrome',
        'phantomjs',
        'lighthouse',
        'chrome-lighthouse',
        'pagespeed',
        'prerender',
        'bytespider',
        'tiktokbot',
        'applebot',
        'amazonbot',
        'cohere-ai',
        'gptbot',
        'chatgpt-user',
        'anthropic-ai',
        'claude-web',
        'perplexitybot',
        'ccbot',
        'crawler',
        'spider',
        'scraper',
        'bot/',
        'bot;'
    ];

    if (botPatterns.some(pattern => ua.includes(pattern))) {
        return true;
    }

    if (msg.includes('googlebot') || msg.includes('bingbot') || msg.includes('headlesschrome')) {
        return true;
    }

    return false;
}

/**
 * Computes a standardized signature key for throttling duplicate errors.
 *
 * @param {string} message - Error message.
 * @param {string} [source=''] - Source file.
 * @returns {string} Signature key.
 */
function computeErrorSignature(message, source = '') {
    if (message.includes('503') || message.includes('apiErrors.503') || message.includes('inMaintenance')) {
        return 'supercell_503_outage';
    }
    if (message.includes('413') || message.includes('apiErrors.413')) {
        return 'payload_too_large_413';
    }
    if (
        message.includes('dynamically imported module') ||
        message.includes('Importing a module script failed') ||
        message.includes('dynamic import')
    ) {
        return 'chunk_deployment_mismatch';
    }
    if (message.includes('702') || message.includes('apiErrors.702')) {
        return 'api_error_702';
    }
    if (
        message.includes('Failed to fetch') ||
        message.includes('Load failed') ||
        message.includes('NetworkError')
    ) {
        return 'transient_network_drop';
    }
    const cleanMsg = message.split('\n')[0].replace(/\s+/g, ' ').substring(0, 100);
    return `${cleanMsg}::${source}`;
}

/**
 * Evaluates whether an error should trigger an email alert.
 *
 * @param {{ userId?: string, environment?: string, message: string, source?: string, userAgent?: string, url?: string }} errorData
 * @returns {{ shouldSend: boolean, reason: string, signature: string }}
 */
function shouldSendAlertEmail(errorData) {
    const { userId, message, source, userAgent, url } = errorData;

    // 1. Check if noise
    if (isIgnoredNoise(message)) {
        return { shouldSend: false, reason: 'ignored_noise', signature: '' };
    }

    // 2. Check if search crawler / bot traffic (Googlebot, Bingbot, Lighthouse, etc. - even if holding a guest userId)
    if (isBotTraffic(userAgent, message, url)) {
        return { shouldSend: false, reason: 'bot_crawler_traffic', signature: '' };
    }

    // 3. Check if anonymous / unknown traffic (log in DB only)
    if (!userId || userId === 'unknown' || userId === 'null' || userId === 'undefined') {
        return { shouldSend: false, reason: 'anonymous_user_db_only', signature: '' };
    }

    // 4. Check 503 outage state
    const is503 = message.includes('503') || message.includes('apiErrors.503') || message.includes('inMaintenance');
    const signature = computeErrorSignature(message, source || '');
    const now = Date.now();

    if (is503) {
        if (now - outageState.last503AlertSent < ALERT_COOLDOWN_MS) {
            return { shouldSend: false, reason: 'cooldown_active_503', signature };
        }
        return { shouldSend: true, reason: 'supercell_503_alert', signature };
    }

    // 5. Check 10-minute cooldown for critical errors (413, TypeError, etc.)
    const lastSent = recentAlertTimestamps.get(signature) || 0;
    if (now - lastSent < ALERT_COOLDOWN_MS) {
        return { shouldSend: false, reason: 'cooldown_active', signature };
    }

    return { shouldSend: true, reason: 'critical_alert_allowed', signature };
}

/**
 * Marks an alert signature as dispatched in the cooldown tracker.
 *
 * @param {string} signature - Dispatched signature key.
 */
function recordAlertSent(signature) {
    if (!signature) return;
    const now = Date.now();
    recentAlertTimestamps.set(signature, now);
    if (signature === 'supercell_503_outage') {
        outageState.is503Active = true;
        outageState.last503AlertSent = now;
    }
}

/**
 * Creates a nodemailer SMTP transporter using environment variables.
 *
 * @returns {any|null} Nodemailer transporter or null if unconfigured.
 */
function createSmtpTransporter() {
    if (!process.env.SMTP_USER || !process.env.SMTP_HOST) return null;
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
}

/**
 * Sends an email notification if SMTP is configured.
 *
 * @param {any} mailOptions - Nodemailer mail options.
 * @returns {Promise<boolean>} True if mail was sent successfully.
 */
async function sendMailSafely(mailOptions) {
    const transporter = createSmtpTransporter();
    if (!transporter) return false;
    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (err) {
        console.error('[ALERT THROTTLE] Failed to send email:', err.message);
        return false;
    }
}

/**
 * Checks if a 503 outage was active and sends a resolution email upon successful recovery.
 *
 * @returns {Promise<boolean>} True if recovery email was sent.
 */
async function notify503RecoveryIfActive() {
    if (!outageState.is503Active) return false;
    outageState.is503Active = false;

    const recipientEmail = process.env.RECIPIENT_EMAIL_ALERTS;
    if (!recipientEmail) return false;

    const nowIso = new Date().toISOString();
    const mailOptions = {
        from: `"OreCalc Alert" <${process.env.EMAIL_FROM || 'noreply@clashcalc.com'}>`,
        to: recipientEmail,
        subject: `[OreCalc Alert] RESOLVED: Supercell Clash of Clans API is Back Online`,
        text: `Hello,\n\nThe Supercell Clash of Clans API has recovered from maintenance break and is back online.\n\nRecovery Details:\n- Status: RESOLVED\n- Resolved At: ${nowIso}\n- API Target: ${process.env.COC_API_BASE_URL || 'Supercell Clash API'}\n\nNormal upstream proxying has resumed.\n\nRegards,\nOreCalc Error Monitoring`
    };

    const sent = await sendMailSafely(mailOptions);
    outageState.is503Active = false;
    if (sent) {
        console.log('[ALERT THROTTLE] 503 Recovery notification email sent successfully.');
    }
    return sent;
}

/**
 * Clears throttling state (used for automated test verification).
 */
function resetThrottleState() {
    recentAlertTimestamps.clear();
    outageState.is503Active = false;
    outageState.last503AlertSent = 0;
}

module.exports = {
    ALERT_COOLDOWN_MS,
    outageState,
    isIgnoredNoise,
    isBotTraffic,
    shouldSendAlertEmail,
    recordAlertSent,
    sendMailSafely,
    notify503RecoveryIfActive,
    resetThrottleState
};
