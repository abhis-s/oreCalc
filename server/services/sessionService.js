const crypto = require('crypto');

const MAX_SESSIONS = 20;
const PAIRING_TOKEN_TTL_MS = 90 * 1000; // 90 seconds (1.5 minutes)

/**
 * @typedef {Object} PairingChallenge
 * @property {string} username
 * @property {string} userId
 * @property {number} expiresAt
 * @property {'pending'|'claimed'|'expired'} [status]
 * @property {boolean} [claimed]
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
 * Parses user agent string to extract platform and browser identifiers.
 *
 * @param {string|undefined} ua - User Agent header string.
 * @returns {{ platform: string, browser: string }}
 */
function parseUserAgent(ua) {
    if (!ua || typeof ua !== 'string') {
        return { platform: 'Unknown', browser: 'Browser' };
    }

    let platform = 'Other';
    if (/iPhone|iPad|iPod/i.test(ua)) {
        platform = 'iOS';
    } else if (/Android/i.test(ua)) {
        platform = 'Android';
    } else if (/Macintosh|Mac OS X/i.test(ua)) {
        platform = 'macOS';
    } else if (/Windows NT/i.test(ua)) {
        platform = 'Windows';
    } else if (/Linux/i.test(ua)) {
        platform = 'Linux';
    }

    let browser = 'Browser';
    if (/Edg\//i.test(ua)) {
        browser = 'Edge';
    } else if (/Chrome\/|CriOS\//i.test(ua)) {
        browser = 'Chrome';
    } else if (/Firefox\/|FxiOS\//i.test(ua)) {
        browser = 'Firefox';
    } else if (/Safari\//i.test(ua) && !/Chrome\/|CriOS\//i.test(ua)) {
        browser = 'Safari';
    }

    return { platform, browser };
}

/**
 * Generates a cryptographically random session identifier.
 *
 * @returns {string} Session ID.
 */
function generateSessionId() {
    return 'sess_' + crypto.randomUUID().replace(/-/g, '');
}

/**
 * Constructs a session metadata record from the incoming request.
 *
 * @param {import('express').Request} req - Express request.
 * @param {string} sessionId - Unique session ID.
 * @returns {{ sessionId: string, platform: string, browser: string, ip: string, createdAt: number, lastActiveAt: number }}
 */
function createSessionRecord(req, sessionId) {
    const ua = req.headers ? req.headers['user-agent'] : '';
    const { platform, browser } = parseUserAgent(typeof ua === 'string' ? ua : '');
    const ip = (req.headers && typeof req.headers['cf-connecting-ip'] === 'string')
        ? req.headers['cf-connecting-ip']
        : (req.ip || '');

    const now = Date.now();
    return {
        sessionId,
        platform,
        browser,
        ip,
        createdAt: now,
        lastActiveAt: now
    };
}

/**
 * Appends a new session to the account sessions array, capping at MAX_SESSIONS.
 *
 * @param {Array<any>} existingSessions - Current session array.
 * @param {any} newSession - Newly generated session record.
 * @returns {Array<any>} Trimmed updated sessions array.
 */
function appendSession(existingSessions, newSession) {
    const list = Array.isArray(existingSessions) ? [...existingSessions] : [];
    list.unshift(newSession);
    if (list.length > MAX_SESSIONS) {
        list.length = MAX_SESSIONS;
    }
    return list;
}

/**
 * Formats sessions for client response, marking the active session and sorting.
 *
 * @param {Array<any>} sessions - Stored session records.
 * @param {string|null} currentSid - Active session ID from JWT.
 * @returns {Array<{ sessionId: string, platform: string, browser: string, createdAt: number, lastActiveAt: number, isCurrent: boolean }>}
 */
function formatSessionsForClient(sessions, currentSid) {
    if (!Array.isArray(sessions)) return [];

    const formatted = sessions.map(s => ({
        sessionId: s.sessionId,
        platform: s.platform || 'Other',
        browser: s.browser || 'Browser',
        createdAt: s.createdAt || Date.now(),
        lastActiveAt: s.lastActiveAt || Date.now(),
        isCurrent: Boolean(currentSid && s.sessionId === currentSid)
    }));

    // Sort current session to the top, then newest lastActiveAt
    formatted.sort((a, b) => {
        if (a.isCurrent) return -1;
        if (b.isCurrent) return 1;
        return b.lastActiveAt - a.lastActiveAt;
    });

    return formatted;
}

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
        deviceName: null,
        sessionId: null
    });

    return {
        pairingToken: token,
        expiresIn: Math.floor(PAIRING_TOKEN_TTL_MS / 1000)
    };
}

/**
 * Consumes a single-use pairing token if valid and unexpired.
 *
 * @param {string} token - Candidate pairing token.
 * @param {{ deviceName?: string, sessionId?: string }} [clientContext] - Claiming device context.
 * @returns {{ username: string, userId: string }|null}
 */
function consumePairingToken(token, clientContext = {}) {
    if (!token || typeof token !== 'string') return null;
    const challenge = pairingChallenges.get(token);
    if (!challenge) return null;
    if (challenge.claimed) return null;
    if (Date.now() > challenge.expiresAt) {
        pairingChallenges.delete(token);
        return null;
    }

    challenge.claimed = true;
    challenge.status = 'claimed';
    challenge.deviceName = clientContext.deviceName || 'Mobile Device';
    challenge.sessionId = clientContext.sessionId || null;
    challenge.claimedAt = Date.now();

    return {
        username: challenge.username,
        userId: challenge.userId
    };
}

/**
 * Retrieves current status of an ephemeral pairing token.
 *
 * @param {string} token - Candidate pairing token.
 * @returns {{ status: 'pending'|'claimed'|'expired'|'notFound', deviceName?: string, sessionId?: string }}
 */
function getPairingTokenStatus(token) {
    if (!token || typeof token !== 'string') return { status: 'notFound' };
    const challenge = pairingChallenges.get(token);
    if (!challenge) return { status: 'notFound' };

    if (challenge.claimed) {
        return {
            status: 'claimed',
            deviceName: challenge.deviceName,
            sessionId: challenge.sessionId
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
    MAX_SESSIONS,
    parseUserAgent,
    generateSessionId,
    createSessionRecord,
    appendSession,
    formatSessionsForClient,
    createPairingToken,
    consumePairingToken,
    getPairingTokenStatus,
    cancelPairingToken
};
