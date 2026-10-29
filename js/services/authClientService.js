/**
 * Client authentication and user identity service.
 * Manages dual-pathway authentication, session storage, and profile state.
 * Tier 3: Core Domain Service.
 */

import { getApiBaseUrl } from './apiService.js';
import {
    getActiveAppSettingsKey,
    getActivePlayerTagsKey,
    getActiveUserIdKey,
    getStorageItem,
    isClashCalcHost,
    CANONICAL_HAS_PASSWORD_KEY
} from '../core/storageKeys.js';
import { setResettingState } from '../core/localStorageManager.js';
import { syncPlayerTagToUrl } from '../core/playerUrlRouter.js';
import { state } from '../core/state.js';
import { generateUUID } from '../utils/uuidGenerator.js';
import { safeJsonParse } from '../utils/jsonUtils.js';

export const AUTH_TOKEN_KEY = 'clashCalc_authToken';
export const AUTH_USERNAME_KEY = 'clashCalc_username';
export const AUTH_AVATAR_KEY = 'clashCalc_avatar';
export const AUTH_HAS_PASSWORD_KEY = CANONICAL_HAS_PASSWORD_KEY;
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
 * Returns current authenticated session details if token and username exist.
 *
 * @returns {{ username: string, token: string, avatar: string, hasPassword?: boolean }|null}
 */
export function getAuthenticatedUser() {
    if (typeof localStorage === 'undefined') return null;
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const username = localStorage.getItem(AUTH_USERNAME_KEY);
    const avatar = localStorage.getItem(AUTH_AVATAR_KEY) || getRandomAvatar();
    const rawHasPass = localStorage.getItem(AUTH_HAS_PASSWORD_KEY);
    const hasPassword = rawHasPass === null ? undefined : rawHasPass === 'true';
    if (token && username) {
        return { username, token, avatar, hasPassword };
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
export function resolveCurrentUserId() {
    if (isAuthenticated()) {
        const freshId = generateUUID();
        return freshId;
    }
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
export function getRequestHeaders(extraHeaders = {}) {
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
export async function throwApiError(response) {
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
    localStorage.setItem(AUTH_HAS_PASSWORD_KEY, 'true');
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
    localStorage.setItem(AUTH_HAS_PASSWORD_KEY, 'true');
    localStorage.setItem(getActiveUserIdKey(), data.userId);
    if (data.avatar) {
        localStorage.setItem(AUTH_AVATAR_KEY, data.avatar);
    }
    document.dispatchEvent(new CustomEvent('auth:state-change', { detail: { action: 'login', user: data } }));
    return data;
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
    localStorage.removeItem('clashCalc_userId');
    localStorage.removeItem('oreCalc_userId');
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
    localStorage.removeItem(AUTH_HAS_PASSWORD_KEY);

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
 * Canonical Application Reset & Logout.
 * Purges active user credentials, player partitions, and caches while preserving device
 * accessibility preferences (theme, accent color, language). Rotates to a clean guest UUID
 * and reloads the application to a clean state.
 */
export function resetApplication() {
    setResettingState(true);
    syncPlayerTagToUrl(null);
    logout();
    if (typeof window !== 'undefined' && window.location) {
        if (window.location.hash || window.location.search) {
            try {
                history.replaceState(null, '', window.location.pathname);
            } catch (_) {}
        }
        window.location.href = window.location.origin + window.location.pathname;
    }
}

if (typeof window !== 'undefined') {
    window.resetApplication = resetApplication;
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

/**
 * Retrieves the authenticated user's account details and security metadata.
 *
 * @returns {Promise<{ username: string, userId: string, avatar: string, hasPassword: boolean, passkeysCount: number, createdAt: number }>}
 */
export async function fetchAccountDetails() {
    const url = `${getApiBaseUrl()}/api/auth/account`;
    const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: getRequestHeaders()
    });

    if (!response.ok) {
        await throwApiError(response);
    }

    const data = await response.json();
    if (typeof localStorage !== 'undefined' && typeof data.hasPassword === 'boolean') {
        localStorage.setItem(AUTH_HAS_PASSWORD_KEY, String(data.hasPassword));
    }
    return data;
}

/**
 * Configures an initial password for a passkey-only account.
 *
 * @param {string} newPassword
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function setPassword(newPassword) {
    const url = `${getApiBaseUrl()}/api/auth/password/set`;
    const response = await fetch(url, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ newPassword })
    });

    if (!response.ok) {
        await throwApiError(response);
    }

    const data = await response.json();
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(AUTH_HAS_PASSWORD_KEY, 'true');
    }
    const user = getAuthenticatedUser();
    document.dispatchEvent(new CustomEvent('auth:state-change', { detail: { action: 'password-set', user } }));
    return data;
}

/**
 * Changes an existing account password after verifying the current password.
 *
 * @param {string} currentPassword
 * @param {string} newPassword
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function changePassword(currentPassword, newPassword) {
    const url = `${getApiBaseUrl()}/api/auth/password/change`;
    const response = await fetch(url, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ currentPassword, newPassword })
    });

    if (!response.ok) {
        await throwApiError(response);
    }

    const data = await response.json();
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(AUTH_HAS_PASSWORD_KEY, 'true');
    }
    const user = getAuthenticatedUser();
    document.dispatchEvent(new CustomEvent('auth:state-change', { detail: { action: 'password-change', user } }));
    return data;
}

/**
 * Removes the configured password transitioning account to passkey-only mode.
 *
 * @param {string} [currentPassword] - Optional current password for confirmation.
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function removePassword(currentPassword = '') {
    const url = `${getApiBaseUrl()}/api/auth/password/remove`;
    const response = await fetch(url, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ currentPassword })
    });

    if (!response.ok) {
        await throwApiError(response);
    }

    const data = await response.json();
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(AUTH_HAS_PASSWORD_KEY, 'false');
    }
    const user = getAuthenticatedUser();
    document.dispatchEvent(new CustomEvent('auth:state-change', { detail: { action: 'password-remove', user } }));
    return data;
}

let isCrossTabAuthSyncInitialized = false;
/** @type {((event: any) => void) | null} */
let storageHandler = null;

/**
 * Initializes cross-tab authentication synchronization listener.
 * Reactively detects login, logout, and profile updates across browser tabs on the same origin.
 */
export function initCrossTabAuthSync() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function' || isCrossTabAuthSyncInitialized) return;
    isCrossTabAuthSyncInitialized = true;

    if (!storageHandler) {
        storageHandler = (event) => {
            if (!event || !event.key) return;

            if (event.key === AUTH_TOKEN_KEY) {
                const hasNewToken = Boolean(event.newValue);
                if (!hasNewToken) {
                    // Another tab logged out
                    if (state) {
                        state.savedPlayerTags = ['DEFAULT0'];
                        state.allPlayersData = {};
                        state.playerProfile = null;
                        state.heroes = null;
                        state.storedOres = null;
                        state.income = null;
                        state.planner = null;
                    }
                    if (typeof document?.dispatchEvent === 'function') {
                        document.dispatchEvent(new CustomEvent('auth:state-change', { detail: { action: 'logout' } }));
                    }
                } else {
                    // Another tab logged in
                    const user = getAuthenticatedUser();
                    if (typeof document?.dispatchEvent === 'function') {
                        document.dispatchEvent(new CustomEvent('auth:state-change', { detail: { action: 'login', user } }));
                    }
                }
            } else if (event.key === AUTH_AVATAR_KEY || event.key === AUTH_USERNAME_KEY) {
                const user = getAuthenticatedUser();
                if (typeof document?.dispatchEvent === 'function') {
                    document.dispatchEvent(new CustomEvent('auth:state-change', { detail: { action: 'profile-update', user } }));
                }
            }
        };
        window.addEventListener('storage', storageHandler);
    }
}

/**
 * Resets cross-tab authentication sync initialization guard for testing.
 */
export function resetCrossTabAuthSyncForTesting() {
    if (storageHandler && typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('storage', storageHandler);
        storageHandler = null;
    }
    isCrossTabAuthSyncInitialized = false;
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    initCrossTabAuthSync();
}
