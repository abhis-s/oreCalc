const crypto = require('crypto');

const PAIRING_TOKEN_TTL_MS = 90 * 1000; // 90 seconds (1.5 minutes)

/**
 * @typedef {Object} PairingChallenge
 * @property {string} username
 * @property {string} userId
 * @property {number} expiresAt
 * @property {'pending'|'claimed'|'expired'} [status]
 * @property {boolean} [claimed]
 * @property {boolean} [claiming]
 * @property {boolean} [alreadyLinked]
 * @property {string|null} [deviceName]
 * @property {string|null} [sessionId]
 * @property {number} [claimedAt]
 */

/** @type {Map<string, PairingChallenge>} */
const pairingChallenges = new Map();

// Periodic cleanup of expired pairing tokens every 60 seconds
setInterval(() => {
    const now = Date.now();
    for (const [token, record] of pairingChallenges.entries()) {
        if (now > record.expiresAt) {
            pairingChallenges.delete(token);
        }
    }
}, 60 * 1000).unref();

/**
 * Creates an ephemeral pairing token for cross-device authentication.
 *
 * @param {string} username - Account username.
 * @param {string} userId - User identifier.
 * @returns {{ pairingToken: string, expiresIn: number }}
 */
function createPairingToken(username, userId) {
    const token = 'ptk_' + crypto.randomUUID().replace(/-/g, '');
    const expiresAt = Date.now() + PAIRING_TOKEN_TTL_MS;
    pairingChallenges.set(token, {
        username,
        userId,
        expiresAt,
        status: 'pending',
        claimed: false,
        claiming: false,
        alreadyLinked: false,
        deviceName: null,
        sessionId: null
    });

    return {
        pairingToken: token,
        expiresIn: Math.floor(PAIRING_TOKEN_TTL_MS / 1000)
    };
}

/**
 * Atomically reserves an unexpired, unclaimed pairing token prior to async persistence.
 *
 * @param {string} token - Candidate pairing token.
 * @returns {{ username: string, userId: string }|null}
 */
function reservePairingToken(token) {
    if (!token || typeof token !== 'string') return null;
    const challenge = pairingChallenges.get(token);
    if (!challenge) return null;
    if (challenge.claimed || challenge.claiming) return null;
    if (Date.now() > challenge.expiresAt) {
        pairingChallenges.delete(token);
        return null;
    }

    challenge.claiming = true;
    return {
        username: challenge.username,
        userId: challenge.userId
    };
}

/**
 * Finalizes a reserved pairing token after session resolution and persistence.
 *
 * @param {string} token - Reserved pairing token.
 * @param {{ deviceName?: string, sessionId?: string, alreadyLinked?: boolean }} [clientContext]
 * @returns {boolean}
 */
function completePairingClaim(token, clientContext = {}) {
    if (!token || typeof token !== 'string') return false;
    const challenge = pairingChallenges.get(token);
    if (!challenge || challenge.claimed) return false;

    challenge.claiming = false;
    challenge.claimed = true;
    challenge.status = 'claimed';
    challenge.deviceName = clientContext.deviceName || 'Mobile Device';
    challenge.sessionId = clientContext.sessionId || null;
    challenge.alreadyLinked = Boolean(clientContext.alreadyLinked);
    challenge.claimedAt = Date.now();
    return true;
}

/**
 * Releases a reserved pairing token if async claim persistence failed.
 *
 * @param {string} token - Reserved pairing token.
 */
function releasePairingToken(token) {
    if (!token || typeof token !== 'string') return;
    const challenge = pairingChallenges.get(token);
    if (challenge && !challenge.claimed) {
        challenge.claiming = false;
    }
}

/**
 * Consumes a single-use pairing token synchronously if valid and unexpired.
 *
 * @param {string} token - Candidate pairing token.
 * @param {{ deviceName?: string, sessionId?: string, alreadyLinked?: boolean }} [clientContext] - Claiming device context.
 * @returns {{ username: string, userId: string }|null}
 */
function consumePairingToken(token, clientContext = {}) {
    const reserved = reservePairingToken(token);
    if (!reserved) return null;
    completePairingClaim(token, clientContext);
    return reserved;
}

/**
 * Retrieves current status of an ephemeral pairing token.
 *
 * @param {string} token - Candidate pairing token.
 * @returns {{ status: 'pending'|'claimed'|'expired'|'notFound', deviceName?: string, sessionId?: string, alreadyLinked?: boolean }}
 */
function getPairingTokenStatus(token) {
    if (!token || typeof token !== 'string') return { status: 'notFound' };
    const challenge = pairingChallenges.get(token);
    if (!challenge) return { status: 'notFound' };

    if (challenge.claimed) {
        return {
            status: 'claimed',
            deviceName: challenge.deviceName,
            sessionId: challenge.sessionId,
            alreadyLinked: Boolean(challenge.alreadyLinked)
        };
    }

    if (Date.now() > challenge.expiresAt) {
        return { status: 'expired' };
    }

    return { status: 'pending' };
}

/**
 * Cancels and invalidates an ephemeral pairing token immediately.
 *
 * @param {string} token - Candidate pairing token.
 * @param {string} [username] - Optional username guard to verify issuer ownership.
 * @returns {boolean} Whether the challenge was found and successfully deleted.
 */
function cancelPairingToken(token, username) {
    if (!token || typeof token !== 'string') return false;
    const challenge = pairingChallenges.get(token);
    if (!challenge) return false;

    if (username && typeof username === 'string' && challenge.username.toLowerCase() !== username.toLowerCase()) {
        return false;
    }

    return pairingChallenges.delete(token);
}

module.exports = {
    createPairingToken,
    reservePairingToken,
    completePairingClaim,
    releasePairingToken,
    consumePairingToken,
    getPairingTokenStatus,
    cancelPairingToken
};
