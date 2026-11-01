const nodemailer = require('nodemailer');
const {
    isIgnoredNoise,
    isBotTraffic,
    resolveEmailDomain,
    normalizeErrorMessage,
    formatIncidentCard,
    computeErrorSignature
} = require('./alertDiagnostics.js');

const ALERT_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

/** @type {Map<string, number>} */
const recentAlertTimestamps = new Map();

const outageState = {
    is503Active: false,
    last503AlertSent: 0,
    outageStartedAt: 0,
    failingRoute: '',
    failingUrl: '',
    outageDomain: 'clashcalc.com'
};

const BATCH_WINDOW_MS = 15 * 1000; // 15 seconds incident collection window

/** @type {Map<string, { userId: string, domain: string, environment: string, errors: any[], timer: any, firstSeenAt: number }>} */
const pendingUserBatches = new Map();

/** @type {Map<string, number>} */
const recentUserAlertTimestamps = new Map();

/**
 * Evaluates whether an error should trigger an email alert.
 *
 * @param {{ userId?: string, environment?: string, message: string, source?: string, line?: number, stack?: string, userAgent?: string, url?: string }} errorData
 * @returns {{ shouldSend: boolean, reason: string, signature: string }}
 */
function shouldSendAlertEmail(errorData) {
    const { userId, message, source, line, stack, userAgent, url } = errorData;

    // Discard noise, injected scripts, or clipboard reading denial
    if (isIgnoredNoise(message, source, line, stack) || /clipboard|readText|NotAllowedError/i.test(message)) {
        return { shouldSend: false, reason: 'ignored_noise', signature: '' };
    }

    // Discard search crawler / bot traffic (Googlebot, Bingbot, Lighthouse, etc.)
    if (isBotTraffic(userAgent, message, url)) {
        return { shouldSend: false, reason: 'bot_crawler_traffic', signature: '' };
    }

    // Anonymous / unknown traffic logged in DB only
    if (!userId || userId === 'unknown' || userId === 'null' || userId === 'undefined') {
        return { shouldSend: false, reason: 'anonymous_user_db_only', signature: '' };
    }

    // Check 503 outage state
    const is503 = message.includes('503') || message.includes('apiErrors.503') || message.includes('inMaintenance');
    const signature = computeErrorSignature(message, source || '');
    const now = Date.now();

    if (is503) {
        if (now - outageState.last503AlertSent < ALERT_COOLDOWN_MS) {
            return { shouldSend: false, reason: 'cooldown_active_503', signature };
        }
        return { shouldSend: true, reason: 'supercell_503_alert', signature };
    }

    // Enforce cooldown for critical errors (413, TypeError, etc.)
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
 * Queues a client error into a 15-second debounce batch for the user.
 * Dispatches a consolidated incident email when the batch timer fires.
 *
 * @param {any} errorData - Incoming client error data object.
 * @returns {{ queued: boolean, reason?: string, batchSize?: number }}
 */
function queueClientErrorAlert(errorData) {
    const alertDecision = shouldSendAlertEmail(errorData);
    if (!alertDecision.shouldSend) {
        return { queued: false, reason: alertDecision.reason };
    }

    const { userId, environment, url } = errorData;
    const now = Date.now();
    const lastUserAlert = recentUserAlertTimestamps.get(userId) || 0;
    if (now - lastUserAlert < ALERT_COOLDOWN_MS) {
        return { queued: false, reason: 'user_cooldown_active' };
    }

    const domain = resolveEmailDomain(environment, '', url);
    let batch = pendingUserBatches.get(userId);
    if (batch) {
        if (batch.errors.length < 10) {
            batch.errors.push(errorData);
        }
        return { queued: true, batchSize: batch.errors.length };
    }

    batch = {
        userId,
        domain,
        environment: environment || domain,
        errors: [errorData],
        firstSeenAt: now,
        timer: setTimeout(() => {
            flushUserBatch(userId).catch(err => {
                console.error('[ALERT THROTTLE] Error flushing batch for user:', userId, err);
            });
        }, BATCH_WINDOW_MS)
    };
    if (batch.timer && typeof batch.timer.unref === 'function') {
        batch.timer.unref();
    }
    pendingUserBatches.set(userId, batch);
    return { queued: true, batchSize: 1 };
}

/**
 * Flushes and dispatches a single user's pending error alert batch as one email.
 *
 * @param {string} userId - User identifier.
 * @returns {Promise<boolean>} True if email was sent.
 */
async function flushUserBatch(userId) {
    const batch = pendingUserBatches.get(userId);
    if (!batch) return false;
    pendingUserBatches.delete(userId);
    if (batch.timer) {
        clearTimeout(batch.timer);
    }

    // Immediately claim cooldown to avoid race condition
    const now = Date.now();
    recentUserAlertTimestamps.set(userId, now);
    for (const err of batch.errors) {
        const sig = computeErrorSignature(err.message, err.source || '');
        recentAlertTimestamps.set(sig, now);
    }

    const recipientEmail = process.env.RECIPIENT_EMAIL_ALERTS;
    if (!recipientEmail) return false;

    const shortUserId = userId.substring(0, 8);
    const domain = batch.domain || 'clashcalc.com';
    const count = batch.errors.length;

    let subject = '';
    if (count === 1) {
        const single = batch.errors[0];
        const norm = normalizeErrorMessage(single.message);
        const cleanTitle = norm.split('\n')[0].replace(/\s+/g, ' ').substring(0, 50);
        subject = `[${domain}] Client Error: ${cleanTitle} (User ${shortUserId})`;
    } else {
        subject = `[${domain}] Incident Alert: ${count} client errors captured (User ${shortUserId})`;
    }

    const mailOptions = {
        from: `"ClashCalc Error Alert" <${process.env.EMAIL_FROM || 'noreply@clashcalc.com'}>`,
        to: recipientEmail,
        subject,
        text: formatIncidentCard(batch)
    };

    return await sendMailSafely(mailOptions);
}

/**
 * Flushes all currently active user error batches immediately (used for graceful shutdown and tests).
 *
 * @returns {Promise<void>}
 */
async function flushAllPendingBatches() {
    const userIds = Array.from(pendingUserBatches.keys());
    for (const uid of userIds) {
        await flushUserBatch(uid);
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
        port: Number(process.env.SMTP_PORT) || 587,
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
 * @param {Record<string, any>} [recoveryContext={}] - Context containing verified route, domain, etc.
 * @returns {Promise<boolean>} True if recovery email was sent.
 */
async function notify503RecoveryIfActive(recoveryContext = {}) {
    if (!outageState.is503Active) return false;
    outageState.is503Active = false;

    const recipientEmail = process.env.RECIPIENT_EMAIL_ALERTS;
    if (!recipientEmail) return false;

    const now = Date.now();
    const nowUtc = new Date(now).toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    const domain = recoveryContext.domain || outageState.outageDomain || 'clashcalc.com';
    const testedRoute = recoveryContext.endpoint || outageState.failingRoute || '/api/proxy/players/:tag';
    const targetProxy = process.env.COC_API_BASE_URL || 'cocproxy.royaleapi.dev';

    let downtimeStr = 'N/A';
    if (outageState.outageStartedAt) {
        const diffSec = Math.round((now - outageState.outageStartedAt) / 1000);
        const mins = Math.floor(diffSec / 60);
        const secs = diffSec % 60;
        downtimeStr = mins > 0 ? `~${mins} min ${secs} sec` : `~${secs} sec`;
    }

    const mailOptions = {
        from: `"ClashCalc Alert" <${process.env.EMAIL_FROM || 'noreply@clashcalc.com'}>`,
        to: recipientEmail,
        subject: `[${domain}] RESOLVED: Supercell API is Back Online (Live Proxies Restored)`,
        text: [
            '================================================================================',
            'RESOLVED: SUPERCELL API IS BACK ONLINE',
            '================================================================================',
            '',
            'RECOVERY DETAILS',
            '--------------------------------------------------------------------------------',
            `Environment     : ${domain} (Cloud Run API)`,
            `Recovered At    : ${nowUtc}`,
            `Verified Route  : ${testedRoute} (HTTP 200 OK)`,
            `Downtime Window : ${downtimeStr}`,
            `Target Proxy    : ${targetProxy}`,
            '',
            'SYSTEM ACTION',
            '--------------------------------------------------------------------------------',
            'Circuit breaker reset. Normal live proxying to Supercell has resumed.',
            '',
            '================================================================================',
            'Notification managed by ClashCalc Error Monitoring'
        ].join('\n')
    };

    const sent = await sendMailSafely(mailOptions);
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
    recentUserAlertTimestamps.clear();
    for (const batch of pendingUserBatches.values()) {
        if (batch.timer) clearTimeout(batch.timer);
    }
    pendingUserBatches.clear();
    outageState.is503Active = false;
    outageState.last503AlertSent = 0;
    outageState.outageStartedAt = 0;
    outageState.failingRoute = '';
    outageState.failingUrl = '';
    outageState.outageDomain = 'clashcalc.com';
}

module.exports = {
    ALERT_COOLDOWN_MS,
    BATCH_WINDOW_MS,
    outageState,
    shouldSendAlertEmail,
    recordAlertSent,
    sendMailSafely,
    notify503RecoveryIfActive,
    resetThrottleState,
    queueClientErrorAlert,
    flushUserBatch,
    flushAllPendingBatches,
    pendingUserBatches,
    recentUserAlertTimestamps
};
