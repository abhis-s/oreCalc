/**
 * Client Session and Cross-Device QR Pairing Service.
 * Manages active session lifecycle, sliding token renewal, sign-out revocation, and QR pairing.
 * Tier 3: Core Domain Service.
 */

import { detectOperatingSystem } from '../utils/devicePlatform.js';
import { getApiBaseUrl } from './apiService.js';
import {
    applyAuthSession,
    decodeJwtPayload,
    getAuthenticatedUser,
    getRequestHeaders,
    isTokenLocallyExpired,
    logout,
    throwApiError
} from './authClientService.js';

const SESSION_VERIFIED_AT_KEY = 'clashCalc_sessionVerifiedAt';
const SESSION_CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const TOKEN_RENEWAL_WINDOW_MS = 15 * 24 * 60 * 60 * 1000; // 15 days

/** @type {Promise<{ status: 'guest'|'valid'|'renewed'|'expired'|'offline', renewed?: boolean }> | null} */
let activeSessionValidationPromise = null;

/**
 * Clears the cached session verification timestamp from sessionStorage.
 */
function clearSessionVerificationTimestamp() {
    if (typeof sessionStorage === 'undefined') return;
    try {
        sessionStorage.removeItem(SESSION_VERIFIED_AT_KEY);
    } catch (_) {}
}

/**
 * Stamps the current timestamp as the latest verified session check.
 */
function markSessionVerifiedNow() {
    if (typeof sessionStorage === 'undefined') return;
    try {
        sessionStorage.setItem(SESSION_VERIFIED_AT_KEY, String(Date.now()));
    } catch (_) {}
}

/**
 * Reads the last verified session check timestamp safely.
 *
 * @returns {number}
 */
function getSessionVerifiedAt() {
    if (typeof sessionStorage === 'undefined') return 0;
    try {
        return Number(sessionStorage.getItem(SESSION_VERIFIED_AT_KEY)) || 0;
    } catch {
        return 0;
    }
}

/**
 * Revokes the current active device session on the server before clearing local storage.
 * Swallows network errors and times out rapidly so offline sign-out is never blocked.
 *
 * @returns {Promise<void>}
 */
export async function revokeCurrentSession() {
    clearSessionVerificationTimestamp();
    if (!getAuthenticatedUser() || typeof fetch !== 'function') return;

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 2000) : null;

    try {
        await fetch(`${getApiBaseUrl()}/api/auth/logout`, {
            method: 'POST',
            headers: getRequestHeaders(),
            keepalive: true,
            ...(controller ? { signal: controller.signal } : {})
        });
    } catch (_) {
        // Proceed with local sign-out even if server is unreachable
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}

/**
 * Validates the current authenticated session across pages, revoking locally if expired
 * or revoked server-side, and silently renewing the JWT when within 15 days of expiry.
 *
 * @param {{ force?: boolean }} [options={}]
 * @returns {Promise<{ status: 'guest'|'valid'|'renewed'|'expired'|'offline', renewed?: boolean }>}
 */
export async function validateAndRenewSession(options = {}) {
    if (activeSessionValidationPromise) {
        return activeSessionValidationPromise;
    }

    const run = async () => {
        const user = getAuthenticatedUser();
        if (!user) {
            return { status: /** @type {'guest'} */ ('guest') };
        }

        if (isTokenLocallyExpired(user.token)) {
            clearSessionVerificationTimestamp();
            logout();
            return { status: /** @type {'expired'} */ ('expired') };
        }

        const payload = decodeJwtPayload(user.token);
        const now = Date.now();
        const isWithinRenewalWindow = Boolean(
            payload &&
            typeof payload.exp === 'number' &&
            ((payload.exp * 1000) - now <= TOKEN_RENEWAL_WINDOW_MS)
        );
        const isLegacyWithoutSid = Boolean(payload && !payload.sid);
        const lastVerifiedAt = getSessionVerifiedAt();

        if (
            !options.force &&
            !isWithinRenewalWindow &&
            !isLegacyWithoutSid &&
            lastVerifiedAt > 0 &&
            (now - lastVerifiedAt < SESSION_CHECK_INTERVAL_MS)
        ) {
            return { status: /** @type {'valid'} */ ('valid'), renewed: false };
        }

        if (typeof fetch !== 'function') {
            return { status: /** @type {'offline'} */ ('offline') };
        }

        try {
            const response = await fetch(`${getApiBaseUrl()}/api/auth/session/refresh`, {
                method: 'POST',
                cache: 'no-store',
                headers: getRequestHeaders(),
                body: JSON.stringify({ clientPlatform: detectOperatingSystem() })
            });

            if (response.status === 401 || response.status === 410) {
                clearSessionVerificationTimestamp();
                logout();
                return { status: /** @type {'expired'} */ ('expired') };
            }

            if (!response.ok) {
                return { status: /** @type {'offline'} */ ('offline') };
            }

            const data = await response.json();
            markSessionVerifiedNow();

            if (data?.renewed && data.token) {
                applyAuthSession(data, 'token-refresh');
                return { status: /** @type {'renewed'} */ ('renewed'), renewed: true };
            }

            return { status: /** @type {'valid'} */ ('valid'), renewed: false };
        } catch {
            return { status: /** @type {'offline'} */ ('offline') };
        }
    };

    activeSessionValidationPromise = run().finally(() => {
        activeSessionValidationPromise = null;
    });

    return activeSessionValidationPromise;
}

/**
 * Fetches the list of active device sessions for the authenticated user.
 *
 * @returns {Promise<Array<{ sessionId: string, platform: string, browser: string, createdAt: number, lastActiveAt: number, isCurrent: boolean }>>}
 */
export async function fetchSessions() {
    const url = `${getApiBaseUrl()}/api/auth/sessions`;
    const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: getRequestHeaders()
    });

    if (!response.ok) {
        await throwApiError(response);
    }

    const data = await response.json();
    return Array.isArray(data.sessions) ? data.sessions : [];
}

/**
 * Revokes a specific active session by ID.
 *
 * @param {string} sessionId
 * @returns {Promise<{ success: boolean, message: string, isCurrent: boolean }>}
 */
export async function revokeSession(sessionId) {
    const url = `${getApiBaseUrl()}/api/auth/sessions/${encodeURIComponent(sessionId)}`;
    const response = await fetch(url, {
        method: 'DELETE',
        headers: getRequestHeaders()
    });

    if (!response.ok) {
        await throwApiError(response);
    }

    return response.json();
}

/**
 * Revokes all other active sessions except the current one.
 *
 * @returns {Promise<{ success: boolean, message: string, remainingCount: number }>}
 */
export async function revokeOtherSessions() {
    const url = `${getApiBaseUrl()}/api/auth/sessions/revoke-others`;
    const response = await fetch(url, {
        method: 'POST',
        headers: getRequestHeaders()
    });

    if (!response.ok) {
        await throwApiError(response);
    }

    return response.json();
}

/**
 * Generates an ephemeral pairing token to display as a QR code for mobile pairing.
 *
 * @returns {Promise<{ pairingToken: string, expiresIn: number }>}
 */
export async function createPairingToken() {
    const url = `${getApiBaseUrl()}/api/auth/pairing/token`;
    const response = await fetch(url, {
        method: 'POST',
        headers: getRequestHeaders()
    });

    if (!response.ok) {
        await throwApiError(response);
    }

    return response.json();
}

/**
 * Claims an ephemeral pairing token to authenticate this device into the paired account.
 *
 * @param {string} pairingToken
 * @returns {Promise<{ token: string, username: string, userId: string, avatar: string, hasPassword: boolean, alreadyLinked?: boolean }>}
 */
export async function claimPairingToken(pairingToken) {
    const url = `${getApiBaseUrl()}/api/auth/pairing/claim`;
    const response = await fetch(url, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ pairingToken, clientPlatform: detectOperatingSystem() })
    });

    if (!response.ok) {
        await throwApiError(response);
    }

    const data = await response.json();
    applyAuthSession(data, data.alreadyLinked ? 'pairing-already-linked' : 'pairing-claim');
    return data;
}

/**
 * Checks the status of an ephemeral pairing challenge.
 *
 * @param {string} pairingToken - The pairing token to inspect.
 * @returns {Promise<{ status: 'pending'|'claimed'|'expired'|'notFound', deviceName?: string, sessionId?: string, alreadyLinked?: boolean }>}
 */
export async function fetchPairingStatus(pairingToken) {
    const url = `${getApiBaseUrl()}/api/auth/pairing/status?token=${encodeURIComponent(pairingToken)}`;
    const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: getRequestHeaders()
    });

    if (!response.ok) {
        await throwApiError(response);
    }

    return response.json();
}

/**
 * Cancels and invalidates an ephemeral pairing token immediately on the server.
 *
 * @param {string} pairingToken - The pairing token to cancel.
 * @returns {Promise<{ success: boolean, cancelled: boolean }>}
 */
export async function cancelPairingToken(pairingToken) {
    const url = `${getApiBaseUrl()}/api/auth/pairing/cancel`;
    const response = await fetch(url, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ pairingToken })
    });

    if (!response.ok) {
        await throwApiError(response);
    }

    return response.json();
}
