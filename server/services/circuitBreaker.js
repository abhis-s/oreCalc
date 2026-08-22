const { shouldSendAlertEmail, recordAlertSent, sendMailSafely, notify503RecoveryIfActive } = require('./alertThrottle.js');

const clashApiStatus = {
    isOffline: false,
    trippedAt: 0,
    tripDurationMs: 5 * 60 * 1000
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
 */
async function tripCircuitBreaker(statusCode = 503) {
    clashApiStatus.isOffline = true;
    clashApiStatus.trippedAt = Date.now();
    console.warn(`[Circuit Breaker] Tripped due to HTTP ${statusCode}. Offline mode active for 5 minutes.`);

    if (statusCode === 503) {
        const alertDecision = shouldSendAlertEmail({
            userId: 'server_proxy',
            environment: process.env.NODE_ENV || 'production',
            message: 'Supercell Clash of Clans API returned 503 Maintenance Break'
        });

        if (alertDecision.shouldSend) {
            const recipientEmail = process.env.RECIPIENT_EMAIL_ALERTS;
            if (recipientEmail) {
                const nowIso = new Date().toISOString();
                const mailOptions = {
                    from: `"OreCalc Alert" <${process.env.EMAIL_FROM || 'noreply@clashcalc.com'}>`,
                    to: recipientEmail,
                    subject: `[OreCalc Alert] Supercell API Maintenance (503) Detected`,
                    text: `Hello,\n\nThe Supercell Clash of Clans upstream API returned HTTP 503 Maintenance Break.\n\nOutage Details:\n- Status: 503 In Maintenance\n- Detected At: ${nowIso}\n- API Target: ${process.env.COC_API_BASE_URL || 'Supercell Clash API'}\n- Action: Circuit breaker activated (caching & offline fallbacks engaged).\n\nYou will receive a follow-up recovery email automatically when the API comes back online.\n\nRegards,\nOreCalc Error Monitoring`
                };

                const sent = await sendMailSafely(mailOptions);
                if (sent) {
                    recordAlertSent(alertDecision.signature);
                    console.log(`[Circuit Breaker] 503 Outage alert email dispatched to ${recipientEmail}.`);
                }
            }
        }
    }
}

/**
 * Marks upstream Clash API as healthy and dispatches recovery notification if an outage was active.
 */
async function markClashApiHealthy() {
    if (clashApiStatus.isOffline) {
        clashApiStatus.isOffline = false;
    }
    await notify503RecoveryIfActive();
}

module.exports = {
    clashApiStatus,
    checkCircuitBreaker,
    tripCircuitBreaker,
    markClashApiHealthy
};
