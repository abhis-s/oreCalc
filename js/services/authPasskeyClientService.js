/**
 * Client WebAuthn Passkey Service.
 * Manages native biometric/security key authentication ceremonies, autofill mediation, and credential registration.
 * Tier 3: Core Domain Service.
 */

import {
    browserSupportsWebAuthn,
    browserSupportsWebAuthnAutofill,
    startAuthentication,
    startRegistration,
    WebAuthnAbortService
} from '@simplewebauthn/browser';
import { translate } from '../i18n/translator.js';
import { logger } from '../utils/logger.js';
import { getApiBaseUrl } from './apiService.js';
import { getActiveUserIdKey } from '../core/storageKeys.js';
import {
    AUTH_AVATAR_KEY,
    AUTH_HAS_PASSWORD_KEY,
    AUTH_TOKEN_KEY,
    AUTH_USERNAME_KEY,
    getRequestHeaders,
    purgeLocalDataOnLogin,
    resolveCurrentUserId,
    throwApiError
} from './authClientService.js';

/**
 * Detects operating system and platform to suggest a helpful passkey name.
 *
 * @param {string} [userAgentOverride]
 * @param {string} [platformOverride]
 * @returns {string}
 */
export function getSuggestedPasskeyName(userAgentOverride = null, platformOverride = null) {
    const ua = userAgentOverride !== null ? userAgentOverride : (typeof navigator !== 'undefined' ? navigator.userAgent || '' : '');
    const platform = platformOverride !== null ? platformOverride : (typeof navigator !== 'undefined' ? (/** @type {any} */ (navigator).userAgentData?.platform || navigator.platform || '') : '');
    const maxTouchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0;
    const isTouchMac = /Macintosh/i.test(ua) && maxTouchPoints > 1;

    // Apple Ecosystem (macOS, iOS, iPadOS) -> iCloud Keychain
    if (/iPad|iPhone|iPod/i.test(ua) || /Macintosh|Mac OS X/i.test(ua) || platform === 'macOS' || platform === 'iOS' || isTouchMac) {
        return translate('auth.providerApple') || 'iCloud Keychain';
    }

    // Android / ChromeOS -> Google Passwords
    if (/Android/i.test(ua) || /CrOS/i.test(ua) || platform === 'Android') {
        return translate('auth.providerGoogle') || 'Google Passwords';
    }

    // Windows -> Windows Hello
    if (/Windows/i.test(ua) || platform === 'Windows') {
        return translate('auth.providerWindows') || 'Windows Hello';
    }

    // Linux or Generic Fallback -> Passkey
    return translate('auth.defaultPasskeyName') || 'Passkey';
}

/**
 * Resolves a unique passkey name by appending #2, #3, etc. if existing passkeys collide.
 *
 * @param {string} baseName
 * @param {Array<{ deviceName?: string }>} [existingPasskeys]
 * @returns {string}
 */
export function resolveUniquePasskeyName(baseName, existingPasskeys = []) {
    const trimmed = (baseName || '').trim();
    if (!trimmed) return trimmed;

    const existingNames = new Set(
        existingPasskeys
            .map(pk => (pk.deviceName || '').trim().toLowerCase())
            .filter(Boolean)
    );

    if (!existingNames.has(trimmed.toLowerCase())) {
        return trimmed;
    }

    let counter = 2;
    while (existingNames.has(`${trimmed} #${counter}`.toLowerCase())) {
        counter++;
    }

    return `${trimmed} #${counter}`;
}

/**
 * Checks whether the browser supports WebAuthn conditional mediation / autofill UI.
 *
 * @returns {Promise<boolean>}
 */
export async function isPasskeyAutofillSupported() {
    if (!browserSupportsWebAuthn()) return false;
    try {
        return await browserSupportsWebAuthnAutofill();
    } catch {
        return false;
    }
}

/**
 * Cancels any currently pending WebAuthn ceremony (e.g. conditional mediation autofill).
 */
export function cancelWebAuthnCeremony() {
    try {
        WebAuthnAbortService.cancelCeremony();
    } catch {
        // No-op if no ceremony active
    }
}

/**
 * Normalizes errors thrown during WebAuthn ceremonies into canonical application error keys.
 *
 * @param {any} err - Caught error object or DOMException.
 * @returns {Error} Normalized error with canonical error code.
 */
export function normalizeWebAuthnError(err) {
    if (!err) {
        return new Error('passkeyFailed');
    }

    const name = err.name || '';
    const message = (err.message || '').toLowerCase();
    const code = err.code || '';

    if (code === 'ERROR_CEREMONY_ABORTED' || name === 'AbortError') {
        return new Error('passkeyCancelled');
    }

    if (code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' || name === 'InvalidStateError') {
        return new Error('passkeyAlreadyRegistered');
    }

    if (name === 'NotAllowedError' || message.includes('timed out') || message.includes('not allowed') || message.includes('privacy-considerations')) {
        if (message.includes('timed out') && !message.includes('not allowed')) {
            return new Error('passkeyTimeout');
        }
        return new Error('passkeyCancelled');
    }

    if (name === 'NotSupportedError' || code === 'ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG') {
        return new Error('passkeyNotSupported');
    }

    if (name === 'SecurityError' || code === 'ERROR_INVALID_DOMAIN' || code === 'ERROR_INVALID_RP_ID') {
        return new Error('passkeySecurityError');
    }

    return new Error('passkeyFailed');
}

/**
 * Registers an account passwordlessly using a native WebAuthn Passkey.
 *
 * @param {string} username - Desired username.
 * @param {string} [deviceName] - Optional label for the passkey authenticator.
 * @param {string} [turnstileToken=''] - Optional Turnstile CAPTCHA response token.
 * @returns {Promise<{ token: string, username: string, userId: string, avatarColor?: string }>}
 */
export async function registerWithPasskey(username, deviceName = '', turnstileToken = '') {
    if (!browserSupportsWebAuthn()) {
        throw new Error('passkeyNotSupported');
    }

    const currentUserId = resolveCurrentUserId();
    const baseUrl = getApiBaseUrl();

    const optionsRes = await fetch(`${baseUrl}/api/auth/register-passkey-options`, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ username, currentUserId, turnstileToken })
    });

    if (!optionsRes.ok) {
        await throwApiError(optionsRes);
    }

    const optionsJSON = await optionsRes.json();

    let attestationResponse;
    try {
        attestationResponse = await startRegistration({ optionsJSON });
    } catch (err) {
        logger.warn('[Auth] Passkey registration prompt cancelled or failed:', err);
        throw normalizeWebAuthnError(err);
    }

    let finalPasskeyName = (deviceName || '').trim();
    if (!finalPasskeyName) {
        const isCrossPlatform = attestationResponse?.authenticatorAttachment === 'cross-platform';
        finalPasskeyName = isCrossPlatform
            ? (translate('auth.securityKey') || 'Security Key')
            : getSuggestedPasskeyName();
    }

    const verifyRes = await fetch(`${baseUrl}/api/auth/register-passkey-verify`, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            username,
            currentUserId,
            attestationResponse,
            passkeyName: finalPasskeyName,
            deviceName: finalPasskeyName
        })
    });

    if (!verifyRes.ok) {
        await throwApiError(verifyRes);
    }

    const data = await verifyRes.json();
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    localStorage.setItem(AUTH_USERNAME_KEY, data.username);
    localStorage.setItem(AUTH_HAS_PASSWORD_KEY, 'false');
    if (data.avatar) {
        localStorage.setItem(AUTH_AVATAR_KEY, data.avatar);
    }
    document.dispatchEvent(new CustomEvent('auth:state-change', { detail: { action: 'register', user: data } }));
    return data;
}

/**
 * Logs in using a WebAuthn Passkey.
 *
 * @param {string} [username] - Optional username.
 * @returns {Promise<{ token: string, username: string, userId: string, avatarColor?: string }>}
 */
export async function loginWithPasskey(username = '') {
    if (!browserSupportsWebAuthn()) {
        throw new Error('passkeyNotSupported');
    }

    const baseUrl = getApiBaseUrl();

    const optionsRes = await fetch(`${baseUrl}/api/auth/login-passkey-options`, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ username })
    });

    if (!optionsRes.ok) {
        await throwApiError(optionsRes);
    }

    const { options, challengeId } = await optionsRes.json();

    let assertionResponse;
    try {
        assertionResponse = await startAuthentication({ optionsJSON: options });
    } catch (err) {
        logger.warn('[Auth] Passkey login prompt cancelled or failed:', err);
        throw normalizeWebAuthnError(err);
    }

    const verifyRes = await fetch(`${baseUrl}/api/auth/login-passkey-verify`, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            challengeId,
            assertionResponse,
            username
        })
    });

    if (!verifyRes.ok) {
        await throwApiError(verifyRes);
    }

    const data = await verifyRes.json();
    purgeLocalDataOnLogin(data.userId);
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    localStorage.setItem(AUTH_USERNAME_KEY, data.username);
    if (typeof data.hasPassword === 'boolean') {
        localStorage.setItem(AUTH_HAS_PASSWORD_KEY, String(data.hasPassword));
    }
    localStorage.setItem(getActiveUserIdKey(), data.userId);
    if (data.avatar) {
        localStorage.setItem(AUTH_AVATAR_KEY, data.avatar);
    }
    document.dispatchEvent(new CustomEvent('auth:state-change', { detail: { action: 'login', user: data } }));
    return data;
}

/**
 * Fetches list of registered passkey devices for the currently logged-in account.
 *
 * @returns {Promise<Array<{ credentialID: string, deviceName: string, createdAt: number }>>}
 */
export async function fetchPasskeys() {
    const url = `${getApiBaseUrl()}/api/auth/passkeys`;
    const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: getRequestHeaders()
    });

    if (!response.ok) {
        await throwApiError(response);
    }

    const data = await response.json();
    return data.passkeys || [];
}

/**
 * Registers an additional passkey authenticator for the active account.
 *
 * @param {string} [passkeyName] - Optional passkey name.
 * @param {Array<{ deviceName?: string }>} [existingPasskeys] - Existing passkeys for collision resolution.
 * @returns {Promise<void>}
 */
export async function addPasskey(passkeyName = '', existingPasskeys = []) {
    if (!browserSupportsWebAuthn()) {
        throw new Error('passkeyNotSupported');
    }

    const baseUrl = getApiBaseUrl();
    const optionsRes = await fetch(`${baseUrl}/api/auth/passkey/add-options`, {
        method: 'POST',
        headers: getRequestHeaders()
    });

    if (!optionsRes.ok) {
        await throwApiError(optionsRes);
    }

    const optionsJSON = await optionsRes.json();
    let attestationResponse;
    try {
        attestationResponse = await startRegistration({ optionsJSON });
    } catch (err) {
        logger.warn('[Auth] Add passkey registration prompt cancelled or failed:', err);
        throw normalizeWebAuthnError(err);
    }

    let finalPasskeyName = (passkeyName || '').trim();
    if (!finalPasskeyName) {
        const isCrossPlatform = attestationResponse?.authenticatorAttachment === 'cross-platform';
        const baseName = isCrossPlatform
            ? (translate('auth.securityKey') || 'Security Key')
            : getSuggestedPasskeyName();
        finalPasskeyName = resolveUniquePasskeyName(baseName, existingPasskeys);
    }

    const verifyRes = await fetch(`${baseUrl}/api/auth/passkey/add-verify`, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            attestationResponse,
            passkeyName: finalPasskeyName,
            deviceName: finalPasskeyName
        })
    });

    if (!verifyRes.ok) {
        await throwApiError(verifyRes);
    }
}

/**
 * Initiates WebAuthn conditional mediation (passkey autofill) on supported inputs.
 *
 * @returns {Promise<{ token: string, username: string, userId: string, avatarColor?: string }|null>}
 */
export async function authenticateWithPasskeyAutofill() {
    if (!browserSupportsWebAuthn()) return null;
    const canAutofill = await isPasskeyAutofillSupported();
    if (!canAutofill) return null;

    const baseUrl = getApiBaseUrl();

    let optionsRes;
    try {
        optionsRes = await fetch(`${baseUrl}/api/auth/login-passkey-options`, {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ username: '' })
        });
    } catch {
        return null;
    }

    if (!optionsRes?.ok) return null;
    const { options, challengeId } = await optionsRes.json();

    let assertionResponse;
    try {
        assertionResponse = await startAuthentication({
            optionsJSON: options,
            useBrowserAutofill: true
        });
    } catch {
        return null;
    }

    if (!assertionResponse) return null;

    let verifyRes;
    try {
        verifyRes = await fetch(`${baseUrl}/api/auth/login-passkey-verify`, {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                challengeId,
                assertionResponse,
                username: ''
            })
        });
    } catch {
        return null;
    }

    if (!verifyRes?.ok) return null;

    const data = await verifyRes.json();
    purgeLocalDataOnLogin(data.userId);
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    localStorage.setItem(AUTH_USERNAME_KEY, data.username);
    if (typeof data.hasPassword === 'boolean') {
        localStorage.setItem(AUTH_HAS_PASSWORD_KEY, String(data.hasPassword));
    }
    localStorage.setItem(getActiveUserIdKey(), data.userId);
    if (data.avatar) {
        localStorage.setItem(AUTH_AVATAR_KEY, data.avatar);
    }
    document.dispatchEvent(new CustomEvent('auth:state-change', { detail: { action: 'login', user: data } }));
    return data;
}

/**
 * Deletes a registered passkey.
 *
 * @param {string} credentialId
 * @returns {Promise<void>}
 */
export async function deletePasskey(credentialId) {
    const url = `${getApiBaseUrl()}/api/auth/passkeys/${encodeURIComponent(credentialId)}`;
    const response = await fetch(url, {
        method: 'DELETE',
        headers: getRequestHeaders()
    });

    if (!response.ok) {
        await throwApiError(response);
    }
}
