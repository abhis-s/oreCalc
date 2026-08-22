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
 * Trips the circuit breaker, activating offline fallback mode for 5 minutes.
 *
 * @param {number} [statusCode=503] - HTTP status code triggering the breaker.
 */
function tripCircuitBreaker(statusCode = 503) {
    clashApiStatus.isOffline = true;
    clashApiStatus.trippedAt = Date.now();
    console.warn(`[Circuit Breaker] Tripped due to HTTP ${statusCode}. Offline mode active for 5 minutes.`);
}

module.exports = {
    clashApiStatus,
    checkCircuitBreaker,
    tripCircuitBreaker
};
