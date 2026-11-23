const crypto = require('crypto');

const MAX_SESSIONS = 15;
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const TOKEN_RENEWAL_WINDOW_MS = 15 * 24 * 60 * 60 * 1000; // 15 days
const SESSION_ACTIVITY_THROTTLE_MS = 30 * 60 * 1000; // 30 minutes
const VALID_CLIENT_PLATFORMS = new Set(['iPadOS', 'iOS', 'Android', 'macOS', 'Windows', 'Linux']);

/** @type {Map<string, number>} */
const sessionActivityCache = new Map();

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
    if (/iPad/i.test(ua)) {
        platform = 'iPadOS';
    } else if (/iPhone|iPod/i.test(ua)) {
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
    if (/Edg\/|EdgiOS\//i.test(ua)) {
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
 * Resolves iPadOS accurately when desktop-mode Safari/WebKit sends a macOS User-Agent.
 *
 * @param {import('express').Request | Record<string, any>} req - Express request.
 * @param {string} sessionId - Unique session ID.
 * @returns {{ sessionId: string, platform: string, browser: string, ip: string, createdAt: number, lastActiveAt: number }}
 */
function createSessionRecord(req, sessionId) {
    const ua = req.headers ? req.headers['user-agent'] : '';
    const { platform: parsedPlatform, browser } = parseUserAgent(typeof ua === 'string' ? ua : '');
    let platform = parsedPlatform;

    const rawClientPlatform = req?.body?.clientPlatform;
    if (
        typeof rawClientPlatform === 'string' &&
        VALID_CLIENT_PLATFORMS.has(rawClientPlatform) &&
        rawClientPlatform === 'iPadOS' &&
        (platform === 'macOS' || platform === 'Other' || platform === 'Unknown' || platform === 'iPadOS')
    ) {
        platform = 'iPadOS';
    }

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
 * Removes expired sessions that have been inactive beyond the configured TTL.
 *
 * @param {Array<any>} sessions - Stored session records.
 * @param {number} [now=Date.now()] - Reference timestamp in ms.
 * @param {number} [ttlMs=SESSION_TTL_MS] - Session inactivity lifetime in ms.
 * @returns {Array<any>} Active non-expired session records.
 */
function pruneExpiredSessions(sessions, now = Date.now(), ttlMs = SESSION_TTL_MS) {
    if (!Array.isArray(sessions)) return [];
    return sessions.filter((s) => {
        if (!s || typeof s !== 'object') return false;
        const lastSeen = Number(s.lastActiveAt || s.createdAt) || 0;
        if (!lastSeen) return false;
        return now - lastSeen <= ttlMs;
    });
}

/**
 * Appends a new session to the account sessions array, pruning expired sessions
 * and evicting the earliest-seen (LRU) sessions beyond MAX_SESSIONS.
 *
 * @param {Array<any>} existingSessions - Current session array.
 * @param {any} newSession - Newly generated session record.
 * @param {number} [now] - Optional reference timestamp for expiration pruning.
 * @returns {Array<any>} Trimmed updated sessions array sorted newest-first.
 */
function appendSession(existingSessions, newSession, now) {
    const referenceNow = Number.isFinite(now)
        ? Number(now)
        : (Number(newSession?.lastActiveAt || newSession?.createdAt) || Date.now());
    const active = pruneExpiredSessions(existingSessions, referenceNow);
    const filtered = newSession?.sessionId
        ? active.filter(s => s.sessionId !== newSession.sessionId)
        : active;
    const list = [newSession, ...filtered];
    list.sort((a, b) => (Number(b.lastActiveAt || b.createdAt) || 0) - (Number(a.lastActiveAt || a.createdAt) || 0));
    if (list.length > MAX_SESSIONS) {
        list.length = MAX_SESSIONS;
    }
    return list;
}

/**
 * Resolves the session update for a QR pairing claim, deduplicating an already logged-in
 * device on the same account instead of creating a duplicate session entry.
 *
 * @param {Array<any>} existingSessions - Stored sessions on target account.
 * @param {{ sessionId: string, platform: string, browser: string, ip: string, createdAt: number, lastActiveAt: number }} candidateSession
 * @param {{ username?: string, userId?: string, sid?: string|null }|null} callerAuth - Authenticated caller from Bearer JWT, if any.
 * @param {{ username?: string, userId?: string }} targetAccount - Target account owning the pairing token.
 * @param {number} [now] - Optional reference timestamp.
 * @returns {{ sessions: Array<any>, sessionId: string, alreadyLinked: boolean }}
 */
function resolveClaimSession(existingSessions, candidateSession, callerAuth, targetAccount, now) {
    const referenceNow = Number.isFinite(now)
        ? Number(now)
        : (Number(candidateSession?.lastActiveAt || candidateSession?.createdAt) || Date.now());
    const active = pruneExpiredSessions(existingSessions, referenceNow);

    const isSameAccount = Boolean(
        callerAuth?.userId &&
        callerAuth?.username &&
        targetAccount?.userId &&
        callerAuth.userId === targetAccount.userId &&
        String(callerAuth.username).toLowerCase() === String(targetAccount.username || '').toLowerCase()
    );

    if (isSameAccount) {
        let matchIdx = -1;
        if (callerAuth.sid) {
            matchIdx = active.findIndex(s => s.sessionId === callerAuth.sid);
        } else {
            matchIdx = active.findIndex(s =>
                s.browser === candidateSession.browser &&
                (s.platform === candidateSession.platform || (candidateSession.platform === 'iPadOS' && s.platform === 'macOS'))
            );
        }

        if (matchIdx !== -1) {
            const existing = active[matchIdx];
            const updatedPlatform = (candidateSession.platform && candidateSession.platform !== 'Unknown')
                ? candidateSession.platform
                : existing.platform;
            const updatedBrowser = (candidateSession.browser && candidateSession.browser !== 'Browser')
                ? candidateSession.browser
                : existing.browser;

            const updatedSessions = [...active];
            updatedSessions[matchIdx] = {
                ...existing,
                platform: updatedPlatform,
                browser: updatedBrowser,
                ip: candidateSession.ip || existing.ip || '',
                lastActiveAt: referenceNow
            };
            updatedSessions.sort((a, b) => (Number(b.lastActiveAt || b.createdAt) || 0) - (Number(a.lastActiveAt || a.createdAt) || 0));
            return {
                sessions: updatedSessions,
                sessionId: existing.sessionId,
                alreadyLinked: true
            };
        }
    }

    return {
        sessions: appendSession(active, candidateSession, referenceNow),
        sessionId: candidateSession.sessionId,
        alreadyLinked: false
    };
}

/**
 * Validates whether an authenticated caller's session is still active (not expired, revoked,
 * or evicted), refreshes activity, and signals 15-day sliding token renewal or legacy upgrade.
 *
 * @param {Array<any>} existingSessions - Stored sessions on account.
 * @param {{ sessionId: string, platform: string, browser: string, ip: string, createdAt: number, lastActiveAt: number }} candidateSession
 * @param {{ sid?: string|null, exp?: number|null }} callerAuth - Decoded caller JWT context.
 * @param {number} [now=Date.now()] - Reference timestamp in ms.
 * @returns {{ valid: boolean, reason?: string, sessionId?: string, sessions: Array<any>, changed: boolean, shouldRenewToken?: boolean }}
 */
function validateAndRefreshSession(existingSessions, candidateSession, callerAuth, now = Date.now()) {
    const rawList = Array.isArray(existingSessions) ? existingSessions : [];
    const pruned = pruneExpiredSessions(rawList, now);
    const prunedChanged = pruned.length !== rawList.length;

    if (callerAuth?.sid) {
        const idx = pruned.findIndex(s => s.sessionId === callerAuth.sid);
        if (idx === -1) {
            return {
                valid: false,
                reason: 'sessionRevoked',
                sessions: pruned,
                changed: prunedChanged
            };
        }

        const existing = pruned[idx];
        const lastActive = Number(existing.lastActiveAt || existing.createdAt) || 0;
        const needsTouch = now - lastActive >= SESSION_ACTIVITY_THROTTLE_MS;
        const shouldRenewToken = typeof callerAuth.exp === 'number' && ((callerAuth.exp * 1000) - now <= TOKEN_RENEWAL_WINDOW_MS);
        const needsPlatformSelfHeal = candidateSession?.platform === 'iPadOS' && existing.platform !== 'iPadOS';

        if (!needsTouch && !shouldRenewToken && !needsPlatformSelfHeal) {
            return {
                valid: true,
                sessionId: existing.sessionId,
                sessions: pruned,
                changed: prunedChanged,
                shouldRenewToken: false
            };
        }

        const updatedSessions = [...pruned];
        updatedSessions[idx] = {
            ...existing,
            platform: needsPlatformSelfHeal ? 'iPadOS' : (existing.platform || candidateSession.platform),
            browser: existing.browser || candidateSession.browser,
            ip: candidateSession?.ip || existing.ip || '',
            lastActiveAt: now
        };
        updatedSessions.sort((a, b) => (Number(b.lastActiveAt || b.createdAt) || 0) - (Number(a.lastActiveAt || a.createdAt) || 0));

        return {
            valid: true,
            sessionId: existing.sessionId,
            sessions: updatedSessions,
            changed: true,
            shouldRenewToken
        };
    }

    // Legacy JWT issued without sid: adopt matching platform+browser session or append one, and issue sid-bound token
    const legacyMatchIdx = pruned.findIndex(s =>
        s.browser === candidateSession.browser &&
        (s.platform === candidateSession.platform || (candidateSession.platform === 'iPadOS' && s.platform === 'macOS'))
    );

    if (legacyMatchIdx !== -1) {
        const existing = pruned[legacyMatchIdx];
        const updatedSessions = [...pruned];
        updatedSessions[legacyMatchIdx] = {
            ...existing,
            platform: (candidateSession.platform && candidateSession.platform !== 'Unknown') ? candidateSession.platform : existing.platform,
            ip: candidateSession?.ip || existing.ip || '',
            lastActiveAt: now
        };
        updatedSessions.sort((a, b) => (Number(b.lastActiveAt || b.createdAt) || 0) - (Number(a.lastActiveAt || a.createdAt) || 0));
        return {
            valid: true,
            sessionId: existing.sessionId,
            sessions: updatedSessions,
            changed: true,
            shouldRenewToken: true
        };
    }

    const updatedSessions = appendSession(pruned, candidateSession, now);
    return {
        valid: true,
        sessionId: candidateSession.sessionId,
        sessions: updatedSessions,
        changed: true,
        shouldRenewToken: true
    };
}

/**
 * Removes a target session on logout while pruning any expired sessions.
 *
 * @param {Array<any>} existingSessions - Current session array.
 * @param {string|null} sid - Active session ID from JWT.
 * @param {{ platform?: string, browser?: string }|null} [fallbackMeta=null] - Fallback platform/browser for legacy non-sid tokens.
 * @param {number} [now=Date.now()] - Reference timestamp in ms.
 * @returns {Array<any>} Updated sessions array.
 */
function removeSession(existingSessions, sid, fallbackMeta = null, now = Date.now()) {
    const active = pruneExpiredSessions(existingSessions, now);
    if (sid) {
        return active.filter(s => s.sessionId !== sid);
    }
    if (fallbackMeta?.platform && fallbackMeta?.browser) {
        let removedOne = false;
        return active.filter((s) => {
            if (!removedOne && s.platform === fallbackMeta.platform && s.browser === fallbackMeta.browser) {
                removedOne = true;
                return false;
            }
            return true;
        });
    }
    return active;
}

/**
 * Throttled fire-and-forget updater for session lastActiveAt during authenticated activity.
 *
 * @param {string} username - Account username.
 * @param {string|null} sid - Active session ID.
 * @param {any} dbInstance - Firestore database instance.
 * @returns {Promise<void>}
 */
async function touchSessionActivity(username, sid, dbInstance) {
    if (!username || !sid || !dbInstance) return;
    const now = Date.now();
    const cleanUsername = String(username).trim().toLowerCase();
    const cacheKey = `${cleanUsername}:${sid}`;
    const lastTouched = sessionActivityCache.get(cacheKey) || 0;
    if (now - lastTouched < SESSION_ACTIVITY_THROTTLE_MS) {
        return;
    }

    if (sessionActivityCache.size > 5000) {
        for (const [k, ts] of sessionActivityCache.entries()) {
            if (now - ts >= SESSION_ACTIVITY_THROTTLE_MS) {
                sessionActivityCache.delete(k);
            }
        }
    }
    sessionActivityCache.set(cacheKey, now);

    try {
        const accountRef = dbInstance.collection('accounts').doc(cleanUsername);
        const doc = await accountRef.get();
        if (!doc.exists) return;

        const rawSessions = Array.isArray(doc.data()?.sessions) ? doc.data().sessions : [];
        const active = pruneExpiredSessions(rawSessions, now);
        const idx = active.findIndex(s => s.sessionId === sid);
        if (idx === -1) return;

        const existing = active[idx];
        const prevActiveAt = Number(existing.lastActiveAt || existing.createdAt) || 0;
        const prunedChanged = active.length !== rawSessions.length;
        const needsUpdate = now - prevActiveAt >= SESSION_ACTIVITY_THROTTLE_MS;
        if (!prunedChanged && !needsUpdate) return;

        const updated = [...active];
        if (needsUpdate) {
            updated[idx] = { ...existing, lastActiveAt: now };
            updated.sort((a, b) => (Number(b.lastActiveAt || b.createdAt) || 0) - (Number(a.lastActiveAt || a.createdAt) || 0));
        }
        await accountRef.update({ sessions: updated });
    } catch (_) {}
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

module.exports = {
    MAX_SESSIONS,
    SESSION_TTL_MS,
    TOKEN_RENEWAL_WINDOW_MS,
    SESSION_ACTIVITY_THROTTLE_MS,
    parseUserAgent,
    generateSessionId,
    createSessionRecord,
    pruneExpiredSessions,
    appendSession,
    resolveClaimSession,
    validateAndRefreshSession,
    removeSession,
    touchSessionActivity,
    formatSessionsForClient
};
