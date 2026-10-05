/**
 * Client authentication and WebAuthn protocol service.
 * Manages dual-pathway authentication, session storage, and passkey registration.
 */

import {
    startAuthentication,
    startRegistration,
    browserSupportsWebAuthn,
    browserSupportsWebAuthnAutofill,
    WebAuthnAbortService
} from '@simplewebauthn/browser';
import { getApiBaseUrl } from './apiService.js';
import {
    getActiveAppSettingsKey,
    getActivePlayerTagsKey,
    getActiveUserIdKey,
    getStorageItem,
    isClashCalcHost
} from '../core/storageKeys.js';
import { setResettingState } from '../core/localStorageManager.js';
import { state } from '../core/state.js';
import { generateUUID } from '../utils/uuidGenerator.js';
import { safeJsonParse } from '../utils/jsonUtils.js';
import { logger } from '../utils/logger.js';
import { translate } from '../i18n/translator.js';

const AUTH_TOKEN_KEY = 'clashCalc_authToken';
const AUTH_USERNAME_KEY = 'clashCalc_username';
const AUTH_AVATAR_KEY = 'clashCalc_avatar';
const USER_ID_KEY = 'clashCalc_userId';

const AVATAR_KEYS = Object.freeze([
    'archer',
    'builder',
    'giant',
    'goblin',
    'golem',
    'hogRider',
    'hog',
    'skeleton'
]);

/**
 * Returns a random avatar identifier from the canonical avatar keys.
 *
 * @returns {string}
 */
function getRandomAvatar() {
    return AVATAR_KEYS[Math.floor(Math.random() * AVATAR_KEYS.length)];
}

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

    // Android / ChromeOS -> Google Password Manager
    if (/Android/i.test(ua) || /CrOS/i.test(ua) || platform === 'Android') {
        return translate('auth.providerGoogle') || 'Google Password Manager';
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
 * Returns current authenticated session details if token and username exist.
 *
 * @returns {{ username: string, token: string, avatar: string }|null}
 */
export function getAuthenticatedUser() {
    if (typeof localStorage === 'undefined') return null;
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const username = localStorage.getItem(AUTH_USERNAME_KEY);
    const avatar = localStorage.getItem(AUTH_AVATAR_KEY) || getRandomAvatar();
    if (token && username) {
        return { username, token, avatar };
    }
    return null;
}

/**
 * Checks whether user is currently authenticated.
 *
 * @returns {boolean}
 */
export function isAuthenticated() {
    return getAuthenticatedUser() !== null;
}

/**
 * Resolves or generates the active user ID for the current client.
 *
 * @returns {string}
 */
function resolveCurrentUserId() {
    let uid = getStorageItem(USER_ID_KEY, 'oreCalc_userId');
    if (!uid) {
        uid = generateUUID();
        localStorage.setItem(getActiveUserIdKey(), uid);
    }
    return uid;
}

/**
 * Constructs standard headers including bearer authorization token when available.
 *
 * @param {Record<string, string>} [extraHeaders]
 * @returns {Record<string, string>}
 */
function getRequestHeaders(extraHeaders = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...extraHeaders
    };
    const user = getAuthenticatedUser();
    if (user?.token) {
        headers['Authorization'] = `Bearer ${user.token}`;
    }
    return headers;
}

/**
 * Parses and throws standard API error from failed response.
 *
 * @param {Response} response
 * @returns {Promise<never>}
 */
async function throwApiError(response) {
    try {
        const errorData = await response.json();
        const reason = errorData.reason || `http_${response.status}`;
        const err = new Error(reason);
        /** @type {any} */ (err).serverMessage = errorData.message;
        throw err;
    } catch (e) {
        if (/** @type {any} */ (e).serverMessage) throw e;
        throw new Error(`http_${response.status}`);
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
 * Registers an account using standard username and password.
 *
 * @param {string} username - Desired username.
 * @param {string} password - Password (min 8 chars).
 * @param {string} [turnstileToken=''] - Optional Turnstile CAPTCHA response token.
 * @returns {Promise<{ token: string, username: string, userId: string }>}
 */
export async function registerWithPassword(username, password, turnstileToken = '') {
    const currentUserId = resolveCurrentUserId();
    const url = `${getApiBaseUrl()}/api/auth/register-password`;

    const response = await fetch(url, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ username, password, currentUserId, turnstileToken })
    });

    if (!response.ok) {
        await throwApiError(response);
    }

    const data = await response.json();
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    localStorage.setItem(AUTH_USERNAME_KEY, data.username);
    if (data.avatar) {
        localStorage.setItem(AUTH_AVATAR_KEY, data.avatar);
    }
    document.dispatchEvent(new CustomEvent('auth:state-change', { detail: { action: 'register', user: data } }));
    return data;
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

    // Request registration options from backend
    const optionsRes = await fetch(`${baseUrl}/api/auth/register-passkey-options`, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ username, currentUserId, turnstileToken })
    });

    if (!optionsRes.ok) {
        await throwApiError(optionsRes);
    }

    const optionsJSON = await optionsRes.json();

    // Prompt user authenticator (Touch ID, Face ID, Windows Hello, security key)
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

    // Verify attestation response on server
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
    if (data.avatar) {
        localStorage.setItem(AUTH_AVATAR_KEY, data.avatar);
    }
    document.dispatchEvent(new CustomEvent('auth:state-change', { detail: { action: 'register', user: data } }));
    return data;
}

/**
 * Logs in with a username and password.
 *
 * @param {string} username
 * @param {string} password
 * @param {string} [turnstileToken=''] - Optional Turnstile CAPTCHA response token.
 * @returns {Promise<{ token: string, username: string, userId: string }>}
 */
export async function loginWithPassword(username, password, turnstileToken = '') {
    const url = `${getApiBaseUrl()}/api/auth/login-password`;
    const response = await fetch(url, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ username, password, turnstileToken })
    });

    if (!response.ok) {
        await throwApiError(response);
    }

    const data = await response.json();
    purgeLocalDataOnLogin(data.userId);
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    localStorage.setItem(AUTH_USERNAME_KEY, data.username);
    localStorage.setItem(getActiveUserIdKey(), data.userId);
    if (data.avatar) {
        localStorage.setItem(AUTH_AVATAR_KEY, data.avatar);
    }
    document.dispatchEvent(new CustomEvent('auth:state-change', { detail: { action: 'login', user: data } }));
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

    // Fetch authentication options from backend
    const optionsRes = await fetch(`${baseUrl}/api/auth/login-passkey-options`, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ username })
    });

    if (!optionsRes.ok) {
        await throwApiError(optionsRes);
    }

    const { options, challengeId } = await optionsRes.json();

    // Prompt user authenticator
    let assertionResponse;
    try {
        assertionResponse = await startAuthentication({ optionsJSON: options });
    } catch (err) {
        logger.warn('[Auth] Passkey login prompt cancelled or failed:', err);
        throw normalizeWebAuthnError(err);
    }

    // Verify assertion on server
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

/**
 * Purges all local game data, transient session artifacts, and account-linked storage
 * prior to adopting cloud state for an incoming authenticated user.
 * Preserves only legal consent timestamps for compliance continuity.
 *
 * @param {string} incomingUserId - The userId from the server login response.
 */
export function purgeLocalDataOnLogin(incomingUserId) {
    if (typeof localStorage === 'undefined') return;

    // Wipe all player partitions and sub-partitions
    const partitionKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
            key.startsWith('clashCalc_player_') ||
            key.startsWith('oreCalc_player_') ||
            key.startsWith('clashCalc_planner_') ||
            key.startsWith('oreCalc_planner_') ||
            key.startsWith('clashCalc_history_') ||
            key.startsWith('oreCalc_history_')
        )) {
            partitionKeys.push(key);
        }
    }
    partitionKeys.forEach(k => localStorage.removeItem(k));

    // Wipe player tag lists and active tag references
    localStorage.removeItem('clashCalc_playerTags');
    localStorage.removeItem('oreCalc_playerTags');
    localStorage.removeItem('clashCalc_activePlayerTag');
    localStorage.removeItem('oreCalc_activePlayerTag');

    // Wipe transient sync artifacts and tool states
    const transientKeys = [
        'clashCalc_stateResetEpoch',
        'clashCalc_activePasskeyId',
        'clashCalc_damageCalcState',
        'oreCalc_damageCalcState',
        'clashCalc_custom_chip_draft',
        'oreCalc_custom_chip_draft'
    ];
    transientKeys.forEach(k => localStorage.removeItem(k));

    // Preserve only tour timestamp from current appSettings
    const settingsKey = getActiveAppSettingsKey();
    const rawSettings = safeJsonParse(localStorage.getItem(settingsKey)) || {};
    const preserved = {
        uiTimestamps: {
            tour: rawSettings.uiTimestamps?.tour ?? null
        }
    };
    localStorage.setItem(settingsKey, JSON.stringify(preserved));

    // Stamp the incoming user as the active user
    localStorage.setItem(getActiveUserIdKey(), incomingUserId);

    if (typeof sessionStorage !== 'undefined') {
        try {
            sessionStorage.clear();
        } catch (_) {}
    }
}

/**
 * Surgically purges all account-linked data on logout. Preserves only true
 * device/browser preferences and legal consent timestamps.
 */
export function purgeAccountDataOnLogout() {
    setResettingState(true);

    if (state) {
        state.savedPlayerTags = ['DEFAULT0'];
        state.allPlayersData = {};
        state.playerProfile = null;
        state.heroes = null;
        state.storedOres = null;
        state.income = null;
        state.planner = null;
    }

    if (typeof localStorage === 'undefined') return;

    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USERNAME_KEY);
    localStorage.removeItem(AUTH_AVATAR_KEY);

    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
            key.startsWith('clashCalc_player_') ||
            key.startsWith('oreCalc_player_') ||
            key.startsWith('clashCalc_planner_') ||
            key.startsWith('oreCalc_planner_') ||
            key.startsWith('clashCalc_history_') ||
            key.startsWith('oreCalc_history_')
        )) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    localStorage.removeItem('clashCalc_playerTags');
    localStorage.removeItem('oreCalc_playerTags');
    localStorage.setItem(getActivePlayerTagsKey(), JSON.stringify(['DEFAULT0']));

    localStorage.removeItem('clashCalc_activePlayerTag');
    localStorage.removeItem('oreCalc_activePlayerTag');

    const newGuestUserId = generateUUID();
    localStorage.setItem(getActiveUserIdKey(), newGuestUserId);
    const altUserIdKey = isClashCalcHost() ? 'oreCalc_userId' : 'clashCalc_userId';
    localStorage.removeItem(altUserIdKey);

    const syncKeys = [
        'clashCalc_stateResetEpoch',
        'clashCalc_activePasskeyId',
        'clashCalc_damageCalcState',
        'oreCalculatorState',
        'OreCalculatorState'
    ];
    syncKeys.forEach(k => localStorage.removeItem(k));

    const settingsKey = getActiveAppSettingsKey();
    const rawSettings = safeJsonParse(localStorage.getItem(settingsKey)) || {};
    const sanitizedSettings = {
        theme: rawSettings.theme || 'dark',
        accentColor: rawSettings.accentColor || 'random',
        language: rawSettings.language || 'en',
        uiTimestamps: {
            tour: rawSettings.uiTimestamps?.tour ?? null
        },
        appVersion: rawSettings.appVersion || '3.0.0',
        timestamp: new Date().toISOString()
    };
    localStorage.setItem(settingsKey, JSON.stringify(sanitizedSettings));

    if (typeof sessionStorage !== 'undefined') {
        try {
            sessionStorage.clear();
        } catch (_) {}
    }
}

/**
 * Logs out the active user, clears authentication tokens, and dispatches logout event.
 */
export function logout() {
    purgeAccountDataOnLogout();
    if (typeof document !== 'undefined') {
        document.dispatchEvent(new CustomEvent('auth:state-change', { detail: { action: 'logout' } }));
    }
}

/**
 * Updates the user's avatar on the backend and updates local session storage.
 *
 * @param {string} avatar - Desired avatar identifier ('archer', 'builder', etc.).
 * @returns {Promise<{ message: string, avatar: string }>}
 */
export async function updateAvatar(avatar) {
    const url = `${getApiBaseUrl()}/api/auth/profile`;
    const response = await fetch(url, {
        method: 'PATCH',
        headers: getRequestHeaders(),
        body: JSON.stringify({ avatar })
    });

    if (!response.ok) {
        await throwApiError(response);
    }

    const data = await response.json();
    const resolvedAvatar = data.avatar || avatar;
    localStorage.setItem(AUTH_AVATAR_KEY, resolvedAvatar);
    const user = getAuthenticatedUser();
    document.dispatchEvent(new CustomEvent('auth:state-change', { detail: { action: 'profile-update', user } }));
    return data;
}

/**
 * Permanently deletes the authenticated user's account and associated cloud data.
 *
 * @returns {Promise<boolean>}
 */
export async function deleteAccount() {
    const url = `${getApiBaseUrl()}/api/auth/account`;
    const response = await fetch(url, {
        method: 'DELETE',
        headers: getRequestHeaders()
    });

    if (!response.ok) {
        await throwApiError(response);
    }

    logout();
    return true;
}
