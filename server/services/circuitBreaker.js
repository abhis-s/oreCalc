const {
    shouldSendAlertEmail,
    recordAlertSent,
    sendMailSafely,
    notify503RecoveryIfActive,
    resolveEmailDomain,
    outageState
} = require('./alertThrottle.js');

const clashApiStatus = {
    isOffline: false,
    trippedAt: 0,
    tripDurationMs: 2 * 60 * 1000, // 2 minutes (was 5 minutes)
    consecutive503Failures: 0,
    lastFailureTime: 0
};

/**
 * Checks whether the Clash of Clans API circuit breaker is currently active.
 * Automatically resets if the cooldown period has expired.
 *
 * @returns {boolean} True if the breaker is open (API is considered offline).
 */
function checkCircuitBreaker() {
    if (clashApiStatus.isOffline) {
        const elapsed = Date.now() - clashApiStatus.trippedAt;
        if (elapsed > clashApiStatus.tripDurationMs) {
            clashApiStatus.isOffline = false;
            clashApiStatus.consecutive503Failures = 0;
            console.log("[Circuit Breaker] Resetting Clash API breaker. Retrying live fetches.");
            return false;
        }
        return true;
    }
    return false;
}

/**
 * Trips the circuit breaker, activating offline fallback mode and triggering throttled 503 alert email.
 *
 * @param {number} [statusCode=503] - HTTP status code triggering the breaker.
 * @param {Record<string, any>} [endpointContext={}] - Triggering route/URL context.
 * @returns {Promise<boolean>} True if breaker was tripped.
 */
async function tripCircuitBreaker(statusCode = 503, endpointContext = {}) {
    const now = Date.now();

    if (statusCode === 503) {
        const isExplicitMaintenance = endpointContext.reason === 'inMaintenance' || endpointContext.isExplicit;
        if (!isExplicitMaintenance) {
            if (now - clashApiStatus.lastFailureTime < 30000) {
                clashApiStatus.consecutive503Failures++;
            } else {
                clashApiStatus.consecutive503Failures = 1;
            }
            clashApiStatus.lastFailureTime = now;

            if (clashApiStatus.consecutive503Failures < 2) {
                console.warn(`[Circuit Breaker] Transient 503 recorded for ${endpointContext.endpoint || 'proxy'}. Failures: 1/2. Not opening breaker yet.`);
                return false;
            }
        }
    }

    clashApiStatus.isOffline = true;
    clashApiStatus.trippedAt = now;
    outageState.is503Active = true;
    outageState.outageStartedAt = now;
    outageState.failingRoute = endpointContext.endpoint || '/api/proxy/players/:tag';
    outageState.failingUrl = endpointContext.url || '';
    outageState.outageDomain = resolveEmailDomain(endpointContext.environment, endpointContext.host, endpointContext.url);

    console.warn(`[Circuit Breaker] Tripped due to HTTP ${statusCode}. Offline mode active for 2 minutes.`);

    if (statusCode === 503) {
        const alertDecision = shouldSendAlertEmail({
            userId: 'server_proxy',
            environment: outageState.outageDomain,
            message: 'Supercell Clash of Clans API returned 503 Maintenance Break'
        });

        if (alertDecision.shouldSend) {
            // Immediate mutex claim before SMTP network await to eliminate race condition
            recordAlertSent(alertDecision.signature);

            const recipientEmail = process.env.RECIPIENT_EMAIL_ALERTS;
            if (recipientEmail) {
                const nowIso = new Date(now).toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
                const domain = outageState.outageDomain;
                const route = endpointContext.endpoint || '/v1/players/{tag}';
                const targetProxy = process.env.COC_API_BASE_URL || 'cocproxy.royaleapi.dev';

                const mailOptions = {
                    from: `"ClashCalc Alert" <${process.env.EMAIL_FROM || 'noreply@clashcalc.com'}>`,
                    to: recipientEmail,
                    subject: `[${domain}] Supercell 503 Outage: ${route} (API Offline)`,
                    text: [
                        '================================================================================',
                        'SUPERCELL API OUTAGE DETECTED (HTTP 503)',
                        '================================================================================',
                        '',
                        'INCIDENT DETAILS',
                        '--------------------------------------------------------------------------------',
                        `Environment     : ${domain} (Cloud Run API)`,
                        `Detected At     : ${nowIso}`,
                        `Failing Route   : ${route}`,
                        `Target Proxy    : ${targetProxy}`,
                        `Upstream URL    : ${endpointContext.url || 'N/A'}`,
                        `Upstream Status : HTTP 503 (${endpointContext.reason || 'inMaintenance'})`,
                        '',
                        'SYSTEM ACTION',
                        '--------------------------------------------------------------------------------',
                        'Circuit breaker activated for 2 minutes.',
                        'Subsequent requests will serve cached local memory or Firestore snapshots.',
                        '',
                        'A follow-up resolution email will be sent automatically once the API recovers.',
                        '',
                        '================================================================================',
                        'Notification managed by ClashCalc Error Monitoring'
                    ].join('\n')
                };

                const sent = await sendMailSafely(mailOptions);
                if (sent) {
                    console.log(`[Circuit Breaker] 503 Outage alert email dispatched to ${recipientEmail}.`);
                }
            }
        }
    }
    return true;
}

/**
 * Marks upstream Clash API as healthy and dispatches recovery notification if an outage was active.
 *
 * @param {Record<string, any>} [endpointContext={}] - Recovery route/domain context.
 */
async function markClashApiHealthy(endpointContext = {}) {
    clashApiStatus.consecutive503Failures = 0;
    if (clashApiStatus.isOffline) {
        clashApiStatus.isOffline = false;
    }
    await notify503RecoveryIfActive(endpointContext);
}

module.exports = {
    clashApiStatus,
    checkCircuitBreaker,
    tripCircuitBreaker,
    markClashApiHealthy
};
