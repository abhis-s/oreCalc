/**
 * Client Session and Cross-Device QR Pairing Service.
 * Manages active session revocation and mobile pairing lifecycle.
 * Tier 3: Core Domain Service.
 */

import { getApiBaseUrl } from './apiService.js';
import {
    AUTH_AVATAR_KEY,
    AUTH_HAS_PASSWORD_KEY,
    AUTH_TOKEN_KEY,
    AUTH_USERNAME_KEY,
    getRequestHeaders,
    throwApiError
} from './authClientService.js';

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
 * @returns {Promise<{ token: string, username: string, userId: string, avatar: string, hasPassword: boolean }>}
 */
export async function claimPairingToken(pairingToken) {
    const url = `${getApiBaseUrl()}/api/auth/pairing/claim`;
    const response = await fetch(url, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ pairingToken })
    });

    if (!response.ok) {
        await throwApiError(response);
    }

    const data = await response.json();
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        localStorage.setItem(AUTH_USERNAME_KEY, data.username);
        localStorage.setItem(AUTH_HAS_PASSWORD_KEY, data.hasPassword ? 'true' : 'false');
        if (data.avatar) {
            localStorage.setItem(AUTH_AVATAR_KEY, data.avatar);
        }
    }
    document.dispatchEvent(new CustomEvent('auth:state-change', { detail: { action: 'pairing-claim', user: data } }));
    return data;
}

/**
 * Checks the status of an ephemeral pairing challenge.
 *
 * @param {string} pairingToken - The pairing token to inspect.
 * @returns {Promise<{ status: 'pending'|'claimed'|'expired'|'notFound', deviceName?: string, sessionId?: string }>}
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
