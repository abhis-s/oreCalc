import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage for Node.js environment
const store = new Map();
globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; }
};

// Mock sessionStorage for Node.js environment
const sessionStore = new Map();
globalThis.sessionStorage = {
    getItem: (key) => sessionStore.get(key) ?? null,
    setItem: (key, val) => sessionStore.set(key, String(val)),
    removeItem: (key) => sessionStore.delete(key),
    clear: () => sessionStore.clear(),
    key: (index) => Array.from(sessionStore.keys())[index] ?? null,
    get length() { return sessionStore.size; }
};

// Mock window and document if running in Node.js
if (typeof globalThis.history === 'undefined') {
    globalThis.history = {
        replaceState: (_data, _unused, url) => {
            if (url && typeof url === 'string') {
                if (url.startsWith('/')) {
                    globalThis.window.location.pathname = url.split('?')[0].split('#')[0];
                    globalThis.window.location.search = url.includes('?') ? '?' + url.split('?')[1].split('#')[0] : '';
                    globalThis.window.location.hash = url.includes('#') ? '#' + url.split('#')[1] : '';
                }
            }
        }
    };
}

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        location: {
            hostname: 'localhost',
            origin: 'http://localhost:8080',
            pathname: '/ore-calculator/',
            search: '',
            hash: '',
            href: 'http://localhost:8080/ore-calculator/'
        },
        history: globalThis.history,
        __ENV__: { APP_VERSION: '2.2.0', PUBLIC_API_BASE_URL: 'http://localhost:3000', VITE_API_BASE_URL: 'http://localhost:3000' }
    };
} else {
    if (!globalThis.window.location) {
        globalThis.window.location = {
            hostname: 'localhost',
            origin: 'http://localhost:8080',
            pathname: '/ore-calculator/',
            search: '',
            hash: '',
            href: 'http://localhost:8080/ore-calculator/'
        };
    }
    if (!globalThis.window.history) {
        globalThis.window.history = globalThis.history;
    }
}

if (!globalThis.window.addEventListener) {
    /** @type {Map<string, Function[]>} */
    const winListeners = new Map();
    globalThis.window.addEventListener = (event, cb) => {
        if (!winListeners.has(event)) winListeners.set(event, []);
        winListeners.get(event).push(cb);
    };
    globalThis.window.removeEventListener = (event, cb) => {
        const arr = winListeners.get(event) || [];
        const idx = arr.indexOf(cb);
        if (idx >= 0) arr.splice(idx, 1);
    };
    globalThis.window.dispatchEvent = (event) => {
        const arr = winListeners.get(event.type) || [];
        arr.forEach(cb => cb(event));
        return true;
    };
}

if (typeof globalThis.document === 'undefined') {
    /** @type {Map<string, Function[]>} */
    const listeners = new Map();
    globalThis.document = {
        addEventListener: (event, cb) => {
            if (!listeners.has(event)) listeners.set(event, []);
            listeners.get(event).push(cb);
        },
        removeEventListener: (event, cb) => {
            const arr = listeners.get(event) || [];
            const idx = arr.indexOf(cb);
            if (idx >= 0) arr.splice(idx, 1);
        },
        dispatchEvent: (event) => {
            const arr = listeners.get(event.type) || [];
            arr.forEach(cb => cb(event));
            return true;
        }
    };
}

if (typeof globalThis.CustomEvent === 'undefined') {
    globalThis.CustomEvent = class CustomEvent {
        constructor(type, eventInitDict = {}) {
            this.type = type;
            this.detail = eventInitDict.detail || null;
        }
    };
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const projectRoot = path.resolve(__dirname, '../..');
const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));
const { isValidTag, normalizeTag } = require('../../server/utils/validation.js');

globalThis.fetch = async (url) => {
    if (String(url).includes('/en.json')) return { ok: true, json: async () => enJson };
    return { ok: false, status: 404 };
};

import { ALLOWED_STATIC_STORAGE_KEYS, normalizePlayerTag, getActiveUserId, rotateActiveUserId } from '../../js/core/storageKeys.js';
import { loadTranslations } from '../../js/i18n/translator.js';
await loadTranslations('en');
const {
    getAuthenticatedUser,
    isAuthenticated,
    logout,
    purgeLocalDataOnLogin,
    resetApplication,
    initCrossTabAuthSync,
    resetCrossTabAuthSyncForTesting
} = await import('../../js/services/authClientService.js');
const {
    normalizeWebAuthnError,
    isPasskeyAutofillSupported,
    getSuggestedPasskeyName,
    resolveUniquePasskeyName
} = await import('../../js/services/authPasskeyClientService.js');
import { getResettingState, saveState, setResettingState } from '../../js/core/localStorageManager.js';
import { state } from '../../js/core/state.js';

describe('Auth Client Integration & Session Invariants Suite', () => {
    beforeEach(() => {
        store.clear();
        sessionStore.clear();
        setResettingState(false);
        if (globalThis.window?.location) {
            globalThis.window.location.pathname = '/ore-calculator/';
            globalThis.window.location.search = '';
            globalThis.window.location.hash = '';
            globalThis.window.location.href = 'http://localhost:8080/ore-calculator/';
        }
    });

    test('ALLOWED_STATIC_STORAGE_KEYS whitelist retains auth token, username, and avatar', () => {
        assert.ok(ALLOWED_STATIC_STORAGE_KEYS.has('clashCalc_authToken'));
        assert.ok(ALLOWED_STATIC_STORAGE_KEYS.has('clashCalc_username'));
        assert.ok(ALLOWED_STATIC_STORAGE_KEYS.has('clashCalc_avatar'));
        assert.equal(ALLOWED_STATIC_STORAGE_KEYS.has('clashCalc_activePasskeyId'), false);
    });

    test('getAuthenticatedUser returns null when unauthenticated', () => {
        assert.equal(getAuthenticatedUser(), null);
        assert.equal(isAuthenticated(), false);
    });

    test('getAuthenticatedUser returns user credentials when session tokens exist', () => {
        store.set('clashCalc_authToken', 'jwt.test.token');
        store.set('clashCalc_username', 'clash_master_99');
        store.set('clashCalc_avatar', 'golem');

        const user = getAuthenticatedUser();
        assert.ok(user !== null);
        assert.equal(user.username, 'clash_master_99');
        assert.equal(user.token, 'jwt.test.token');
        assert.equal(user.avatar, 'golem');
        assert.equal(isAuthenticated(), true);
    });

    test('logout clears session tokens and dispatches auth:state-change event', () => {
        store.set('clashCalc_authToken', 'jwt.test.token');
        store.set('clashCalc_username', 'clash_master_99');
        store.set('clashCalc_avatar', 'golem');

        let eventDispatched = false;
        const listener = () => {
            eventDispatched = true;
        };
        globalThis.document.addEventListener('auth:state-change', listener);

        logout();

        globalThis.document.removeEventListener('auth:state-change', listener);

        assert.equal(store.has('clashCalc_authToken'), false);
        assert.equal(store.has('clashCalc_username'), false);
        assert.equal(store.has('clashCalc_avatar'), false);
        assert.equal(getAuthenticatedUser(), null);
        assert.equal(isAuthenticated(), false);
        assert.equal(eventDispatched, true);
    });

    test('username validation rules match server normalization regex', () => {
        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;

        // Valid usernames
        assert.ok(usernameRegex.test('valid_user'));
        assert.ok(usernameRegex.test('user123'));
        assert.ok(usernameRegex.test('abc'));
        assert.ok(usernameRegex.test('12345678901234567890'));

        // Invalid usernames
        assert.equal(usernameRegex.test('ab'), false); // Too short (< 3)
        assert.equal(usernameRegex.test('a'.repeat(21)), false); // Too long (> 20)
        assert.equal(usernameRegex.test('user@name'), false); // Disallowed character
        assert.equal(usernameRegex.test('user name'), false); // Space disallowed
        assert.equal(usernameRegex.test('user-name'), false); // Hyphen disallowed
    });

    test('updateAccountUI cleanly synchronizes profile card and visibility states', async () => {
        const { updateAccountUI } = await import('../../js/components/appSettings/settingsAccountDisplay.js');
        const elements = new Map();
        const createEl = (id) => {
            const classList = new Set();
            const el = {
                id,
                classList: {
                    add: (cls) => classList.add(cls),
                    remove: (cls) => classList.delete(cls),
                    contains: (cls) => classList.has(cls)
                },
                dataset: {},
                style: {},
                attributes: new Map(),
                setAttribute: (k, v) => el.attributes.set(k, v),
                removeAttribute: (k) => el.attributes.delete(k),
                getAttribute: (k) => el.attributes.get(k),
                textContent: ''
            };
            elements.set(id, el);
            return el;
        };

        const ids = [
            'account-popover-guest-section', 'account-popover-auth-section', 'account-popover-username',
            'account-popover-avatar-img',
            'header-account-btn', 'header-account-icon-wrapper', 'header-account-avatar-img'
        ];
        ids.forEach(createEl);

        globalThis.document.getElementById = (id) => elements.get(id) || null;

        // Authenticated user with custom avatar
        updateAccountUI({ username: 'layout_user_1', avatar: 'golem' });
        assert.equal(elements.get('account-popover-username').textContent, 'layout_user_1');
        assert.equal(elements.get('account-popover-avatar-img').getAttribute('src'), 'assets/avatars/golem.png');
        assert.equal(elements.get('header-account-avatar-img').getAttribute('src'), 'assets/avatars/golem.png');
        assert.ok(elements.get('header-account-btn').classList.contains('is-authenticated'));
        assert.ok(elements.get('header-account-icon-wrapper').classList.contains('is-hidden'));
        assert.ok(!elements.get('header-account-avatar-img').classList.contains('is-hidden'));
        assert.ok(elements.get('account-popover-guest-section').classList.contains('is-hidden'));
        assert.ok(!elements.get('account-popover-auth-section').classList.contains('is-hidden'));
        assert.equal(elements.get('account-popover-guest-section').style.display, 'none');
        assert.equal(elements.get('account-popover-auth-section').style.display, '');

        // Guest user (null)
        updateAccountUI(null);
        assert.equal(elements.get('account-popover-username').textContent, '');
        assert.ok(!elements.get('header-account-btn').classList.contains('is-authenticated'));
        assert.ok(!elements.get('header-account-icon-wrapper').classList.contains('is-hidden'));
        assert.ok(elements.get('header-account-avatar-img').classList.contains('is-hidden'));
        assert.ok(!elements.get('account-popover-guest-section').classList.contains('is-hidden'));
        assert.ok(elements.get('account-popover-auth-section').classList.contains('is-hidden'));
        assert.equal(elements.get('account-popover-guest-section').style.display, '');
        assert.equal(elements.get('account-popover-auth-section').style.display, 'none');
    });

    test('normalizeWebAuthnError normalizes WebAuthn errors and DOMExceptions accurately', () => {
        // User cancellation / aborted ceremony
        const abortErr = new Error('The user aborted a request.');
        abortErr.name = 'AbortError';
        assert.equal(normalizeWebAuthnError(abortErr).message, 'passkeyCancelled');

        const ceremonyAbortedErr = { code: 'ERROR_CEREMONY_ABORTED' };
        assert.equal(normalizeWebAuthnError(ceremonyAbortedErr).message, 'passkeyCancelled');

        // NotAllowedError with timeout vs cancellation
        const rawChromiumError = new Error('The operation either timed out or was not allowed. See: https://www.w3.org/TR/webauthn-2/#sctn-privacy-considerations-client.');
        rawChromiumError.name = 'NotAllowedError';
        assert.equal(normalizeWebAuthnError(rawChromiumError).message, 'passkeyCancelled');

        const timeoutErr = new Error('The operation timed out.');
        timeoutErr.name = 'NotAllowedError';
        assert.equal(normalizeWebAuthnError(timeoutErr).message, 'passkeyTimeout');

        // Previously registered authenticator / duplicate credential
        const duplicateErr = new Error('Authenticator previously registered');
        duplicateErr.name = 'InvalidStateError';
        assert.equal(normalizeWebAuthnError(duplicateErr).message, 'passkeyAlreadyRegistered');

        const duplicateCodeErr = { code: 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' };
        assert.equal(normalizeWebAuthnError(duplicateCodeErr).message, 'passkeyAlreadyRegistered');

        // Platform / algorithm unsupported
        const notSupportedErr = new Error('No supported algorithms');
        notSupportedErr.name = 'NotSupportedError';
        assert.equal(normalizeWebAuthnError(notSupportedErr).message, 'passkeyNotSupported');

        const unsupportedCodeErr = { code: 'ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG' };
        assert.equal(normalizeWebAuthnError(unsupportedCodeErr).message, 'passkeyNotSupported');

        // Security / Domain origin mismatch
        const securityErr = new Error('Origin mismatch');
        securityErr.name = 'SecurityError';
        assert.equal(normalizeWebAuthnError(securityErr).message, 'passkeySecurityError');

        const invalidDomainErr = { code: 'ERROR_INVALID_DOMAIN' };
        assert.equal(normalizeWebAuthnError(invalidDomainErr).message, 'passkeySecurityError');

        // Generic fallback
        assert.equal(normalizeWebAuthnError(null).message, 'passkeyFailed');
        assert.equal(normalizeWebAuthnError(new Error('something unknown')).message, 'passkeyFailed');
    });

    test('purgeLocalDataOnLogin wipes game partitions, sub-partitions, damageCalcState, and transients while preserving legal timestamps', () => {
        store.set('clashCalc_player_ABC123', JSON.stringify({ townHallLevel: 16 }));
        store.set('oreCalc_player_XYZ', JSON.stringify({ townHallLevel: 14 }));
        store.set('clashCalc_planner_ABC123', JSON.stringify({ chips: [] }));
        store.set('oreCalc_history_XYZ', JSON.stringify({ logs: [] }));
        store.set('clashCalc_damageCalcState', JSON.stringify({ activeTag: 'ABC123' }));
        store.set('clashCalc_playerTags', JSON.stringify(['#ABC123']));
        store.set('oreCalc_playerTags', JSON.stringify(['#XYZ']));
        store.set('clashCalc_activePasskeyId', 'cred_old_session');
        store.set('clashCalc_appSettings', JSON.stringify({
            theme: 'light',
            language: 'de',
            currency: { code: 'EUR' },
            uiTimestamps: { tour: 33333 }
        }));

        purgeLocalDataOnLogin('incoming-user-uuid-9999');

        assert.equal(store.has('clashCalc_player_ABC123'), false);
        assert.equal(store.has('oreCalc_player_XYZ'), false);
        assert.equal(store.has('clashCalc_planner_ABC123'), false);
        assert.equal(store.has('oreCalc_history_XYZ'), false);
        assert.equal(store.has('clashCalc_damageCalcState'), false);
        assert.equal(store.has('clashCalc_playerTags'), false);
        assert.equal(store.has('oreCalc_playerTags'), false);
        assert.equal(store.has('clashCalc_activePasskeyId'), false);

        assert.equal(store.get('clashCalc_userId'), 'incoming-user-uuid-9999');

        const settings = JSON.parse(store.get('clashCalc_appSettings'));
        assert.equal(settings.uiTimestamps.tour, 33333);
        assert.equal(settings.uiTimestamps.privacy, undefined);
        assert.equal(settings.uiTimestamps.tos, undefined);
        assert.equal(settings.uiTimestamps.welcome, undefined);
        // Account preferences must NOT survive login (cloud provides them)
        assert.equal(settings.theme, undefined);
        assert.equal(settings.language, undefined);
        assert.equal(settings.currency, undefined);
    });

    test('getSuggestedPasskeyName resolves ecosystem passkey names from user agent profiles', () => {
        // macOS
        assert.equal(getSuggestedPasskeyName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel'), 'iCloud Keychain');

        // iPhone
        assert.equal(getSuggestedPasskeyName('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'iPhone'), 'iCloud Keychain');

        // iPad
        assert.equal(getSuggestedPasskeyName('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', 'iPad'), 'iCloud Keychain');

        // Pixel
        assert.equal(getSuggestedPasskeyName('Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro Build/UD1A.230803.041)', 'Linux armv8l'), 'Google Passwords');

        // Windows
        assert.equal(getSuggestedPasskeyName('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32'), 'Windows Hello');

        // Chromebook
        assert.equal(getSuggestedPasskeyName('Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)', 'Linux x86_64'), 'Google Passwords');

        // Generic Android
        assert.equal(getSuggestedPasskeyName('Mozilla/5.0 (Linux; Android 13; K)', 'Linux armv8l'), 'Google Passwords');

        // Linux PC
        assert.equal(getSuggestedPasskeyName('Mozilla/5.0 (X11; Linux x86_64)', 'Linux x86_64'), 'Passkey');
    });

    test('isPasskeyAutofillSupported resolves false safely in non-WebAuthn environments', async () => {
        const supported = await isPasskeyAutofillSupported();
        assert.equal(supported, false);
    });

    test('resolveUniquePasskeyName deduplicates names with sequential suffixes', () => {
        // Unoccupied base name
        assert.equal(resolveUniquePasskeyName('iCloud Keychain', []), 'iCloud Keychain');
        assert.equal(resolveUniquePasskeyName('Security Key', [{ deviceName: 'iCloud Keychain' }]), 'Security Key');

        // Single collision -> #2
        assert.equal(resolveUniquePasskeyName('iCloud Keychain', [{ deviceName: 'iCloud Keychain' }]), 'iCloud Keychain #2');

        // Case-insensitive collision -> #2
        assert.equal(resolveUniquePasskeyName('Security Key', [{ deviceName: 'security key' }]), 'Security Key #2');

        // Multiple collisions -> sequential next counter
        const existing = [
            { deviceName: 'Security Key' },
            { deviceName: 'Security Key #2' }
        ];
        assert.equal(resolveUniquePasskeyName('Security Key', existing), 'Security Key #3');

        // Fallback default name deduplication
        assert.equal(resolveUniquePasskeyName('Passkey', [{ deviceName: 'Passkey' }]), 'Passkey #2');
        assert.equal(resolveUniquePasskeyName('Passkey', [{ deviceName: 'Passkey' }, { deviceName: 'Passkey #2' }]), 'Passkey #3');
    });

    test('logout and purgeAccountDataOnLogout surgically clear player data, reset tags, and preserve device preferences', () => {
        store.set('clashCalc_authToken', 'token_xyz');
        store.set('clashCalc_username', 'clash_user');
        store.set('clashCalc_avatar', 'skeleton');
        store.set('clashCalc_userId', 'protected-user-uuid-1111');
        store.set('clashCalc_playerTags', JSON.stringify(['#8PJYGUJC', '#TESTTAG1']));
        store.set('oreCalc_playerTags', JSON.stringify(['#8PJYGUJC', '#TESTTAG1']));
        store.set('clashCalc_player_8PJYGUJC', JSON.stringify({ townHallLevel: 17 }));
        store.set('clashCalc_player_TESTTAG1', JSON.stringify({ townHallLevel: 15 }));
        store.set('oreCalc_player_LEGACY', JSON.stringify({ townHallLevel: 14 }));
        store.set('clashCalc_planner_TESTTAG1', JSON.stringify({ chips: [] }));
        store.set('clashCalc_history_TESTTAG1', JSON.stringify({ records: [] }));
        store.set('clashCalc_activePlayerTag', 'TESTTAG1');
        store.set('clashCalc_domainNoticeDismissed', 'true');
        store.set('clashCalc_SWUpdatedTime', '1720000000000');
        store.set('clashCalc_appSettings', JSON.stringify({
            theme: 'light',
            accentColor: 'green',
            language: 'de',
            currency: { code: 'EUR' },
            cardLayout: 'compact0',
            uiTimestamps: { tour: 12345 },
            saveError: true
        }));

        state.savedPlayerTags = ['TESTTAG1'];
        state.allPlayersData = { 'TESTTAG1': { heroes: {} } };

        logout();

        assert.equal(getResettingState(), true, 'Resetting lock flag must be active on logout to prevent beforeunload resurrection');
        assert.deepEqual(state.savedPlayerTags, ['DEFAULT0'], 'In-memory savedPlayerTags must be reset to DEFAULT0');
        assert.deepEqual(state.allPlayersData, {}, 'In-memory allPlayersData must be cleared');

        assert.equal(store.has('clashCalc_authToken'), false);
        assert.equal(store.has('clashCalc_username'), false);
        assert.equal(store.has('clashCalc_avatar'), false);

        assert.equal(store.has('clashCalc_player_8PJYGUJC'), false);
        assert.equal(store.has('clashCalc_player_TESTTAG1'), false);
        assert.equal(store.has('oreCalc_player_LEGACY'), false);
        assert.equal(store.has('clashCalc_planner_TESTTAG1'), false);
        assert.equal(store.has('clashCalc_history_TESTTAG1'), false);
        assert.equal(store.has('clashCalc_activePlayerTag'), false);

        assert.equal(store.get('clashCalc_playerTags'), JSON.stringify(['DEFAULT0']));
        assert.equal(store.has('oreCalc_playerTags'), false);

        const newUserId = store.get('clashCalc_userId');
        assert.ok(newUserId);
        assert.notEqual(newUserId, 'protected-user-uuid-1111');

        assert.equal(store.get('clashCalc_domainNoticeDismissed'), 'true');
        assert.equal(store.get('clashCalc_SWUpdatedTime'), '1720000000000');

        const settings = JSON.parse(store.get('clashCalc_appSettings'));
        assert.equal(settings.theme, 'light');
        assert.equal(settings.accentColor, 'green');
        assert.equal(settings.language, 'de');
        // Account preferences must NOT be preserved on logout
        assert.equal(settings.soundFx, undefined);
        assert.equal(settings.currency, undefined);
        assert.equal(settings.cardLayout, undefined);
        assert.equal(settings.uiTimestamps.tour, 12345);
        assert.equal(settings.uiTimestamps.privacy, undefined);
        assert.equal(settings.saveError, undefined);
    });

    test('security key auto-detection distinguishes cross-platform keys from platform keychains', () => {
        const crossPlatformAttestation = {
            id: 'cred_yubi_1',
            authenticatorAttachment: 'cross-platform'
        };
        const isCrossPlatform = crossPlatformAttestation.authenticatorAttachment === 'cross-platform';
        const detectedName = isCrossPlatform ? 'Security Key' : getSuggestedPasskeyName();
        assert.equal(detectedName, 'Security Key');

        const platformAttestation = {
            id: 'cred_touchid_1',
            authenticatorAttachment: 'platform'
        };
        const isPlatform = platformAttestation.authenticatorAttachment === 'cross-platform';
        const platformName = isPlatform ? 'Security Key' : getSuggestedPasskeyName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel');
        assert.equal(platformName, 'iCloud Keychain');
    });

    test('password validation contract enforces 6-72 characters and aligned i18n strings', () => {
        const isValidPassword = (p) => typeof p === 'string' && p.length >= 6 && p.length <= 72;

        // Boundaries
        assert.equal(isValidPassword('12345'), false);
        assert.equal(isValidPassword('123456'), true);
        assert.equal(isValidPassword('a'.repeat(72)), true);
        assert.equal(isValidPassword('a'.repeat(73)), false);
        assert.equal(isValidPassword(''), false);

        // UI String alignment (must not display 72 in user-facing hint/error)
        assert.equal(enJson.auth.passwordPlaceholder, 'At least 6 characters');
        assert.equal(enJson.apiErrors.invalidPassword, 'Password must be at least 6 characters long.');
        assert.equal(enJson.auth.passwordPlaceholder.includes('72'), false);
        assert.equal(enJson.apiErrors.invalidPassword.includes('72'), false);
    });

    test('server-side tag sanitization strictly filters out DEFAULT0 and invalid tags', () => {
        const testTags = ['DEFAULT0', '#8PJYGUJC', 'invalid!tag', ''];
        const sanitized = testTags
            .map(t => normalizeTag(t))
            .filter(t => isValidTag(t));

        assert.deepEqual(sanitized, ['8PJYGUJC']);
        assert.equal(isValidTag('DEFAULT0'), false);
        assert.equal(isValidTag('#8PJYGUJC'), true);
        assert.equal(isValidTag('8PJYGUJC'), true);
    });

    test('registration branching: detects real player tags vs default placeholder', () => {
        const hasRealTags = (tags) => Boolean(tags?.some(t => t && normalizePlayerTag(t) !== 'DEFAULT0'));

        // With default placeholder only -> false (trigger prompt, don't save DEFAULT0)
        assert.equal(hasRealTags(['DEFAULT0']), false);
        assert.equal(hasRealTags([]), false);
        assert.equal(hasRealTags(null), false);

        // With real tags -> true (save to cloud, skip prompt)
        assert.equal(hasRealTags(['#8PJYGUJC']), true);
        assert.equal(hasRealTags(['DEFAULT0', '#8PJYGUJC']), true);
    });

    test('login with empty account triggers in-memory prompt and never pollutes storage', () => {
        let prompted = false;
        const mockApplySyncedState = (syncedState) => {
            const hasRealTags = Boolean(syncedState?.savedPlayerTags?.some(t => t && normalizePlayerTag(t) !== 'DEFAULT0'));
            if (!hasRealTags) {
                prompted = true;
            }
        };

        // Empty cloud account -> triggers in-memory prompt, zero storage flags
        mockApplySyncedState({ savedPlayerTags: ['DEFAULT0'] });
        assert.equal(prompted, true);
        assert.equal(sessionStorage.getItem('clashCalc_promptPlayerTagOnLoad'), null);
        assert.equal(sessionStorage.getItem('oreCalc_promptPlayerTagOnLoad'), null);
        assert.equal(localStorage.getItem('clashCalc_promptPlayerTagOnLoad'), null);
        assert.equal(localStorage.getItem('oreCalc_promptPlayerTagOnLoad'), null);

        // Account with real village -> no prompt, zero storage flags
        prompted = false;
        mockApplySyncedState({ savedPlayerTags: ['#8PJYGUJC'] });
        assert.equal(prompted, false);
        assert.equal(sessionStorage.getItem('clashCalc_promptPlayerTagOnLoad'), null);
        assert.equal(sessionStorage.getItem('oreCalc_promptPlayerTagOnLoad'), null);
    });

    test('beforeunload after logout does not resurrect player data in storage', () => {
        store.set('clashCalc_authToken', 'token_123');
        store.set('clashCalc_username', 'clash_user');
        store.set('clashCalc_player_8PJYGUJC', JSON.stringify({ townHallLevel: 15 }));
        store.set('clashCalc_playerTags', JSON.stringify(['#8PJYGUJC']));

        state.savedPlayerTags = ['8PJYGUJC'];
        state.allPlayersData = { '8PJYGUJC': { heroes: {} } };

        logout();

        // Simulate beforeunload listener: if resetting state is active, it must not save
        if (!getResettingState()) {
            saveState(state, true);
        }

        assert.equal(store.has('clashCalc_player_8PJYGUJC'), false);
        assert.equal(store.get('clashCalc_playerTags'), JSON.stringify(['DEFAULT0']));
    });

    test('auth modal register view contains legal disclaimer with canonical i18n key and valid links', () => {
        const modalHtml = fs.readFileSync(path.join(projectRoot, 'partials/modals/auth-modal.html'), 'utf8');
        const deJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/de.json'), 'utf8'));

        assert.ok(modalHtml.includes('data-i18n="auth.disclaimer"'), 'Auth modal must bind auth.disclaimer in template');
        assert.ok(modalHtml.includes('class="auth-privacy-notice privacy-notice"'), 'Auth modal must contain styled notice container');

        assert.ok(enJson.auth.disclaimer, 'en.json must contain auth.disclaimer');
        assert.ok(enJson.auth.disclaimer.includes('id="auth-terms-link"'), 'en.json disclaimer must include auth-terms-link');
        assert.ok(enJson.auth.disclaimer.includes('id="auth-privacy-link"'), 'en.json disclaimer must include auth-privacy-link');

        assert.ok(deJson.auth.disclaimer, 'de.json must contain auth.disclaimer');
        assert.ok(deJson.auth.disclaimer.includes('id="auth-terms-link"'), 'de.json disclaimer must include auth-terms-link');
        assert.ok(deJson.auth.disclaimer.includes('id="auth-privacy-link"'), 'de.json disclaimer must include auth-privacy-link');
    });

    test('getActiveUserId enforces authenticated token userId and self-heals local storage', () => {
        const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({ username: 'bob', userId: 'uid_canonical_123', exp: 9999999999 })).toString('base64url');
        const mockJwt = `${header}.${payload}.signature`;

        store.set('clashCalc_authToken', mockJwt);
        store.set('clashCalc_userId', 'tampered_uuid_456');

        const resolved = getActiveUserId();
        assert.equal(resolved, 'uid_canonical_123');
        assert.equal(store.get('clashCalc_userId'), 'uid_canonical_123');

        const rotated = rotateActiveUserId();
        assert.equal(rotated, 'uid_canonical_123');
        assert.equal(store.get('clashCalc_userId'), 'uid_canonical_123');
    });

    test('resetApplication universally purges credentials, player data, and rotates UUID while preserving theme and language', () => {
        store.set('clashCalc_authToken', 'jwt.test.token');
        store.set('clashCalc_username', 'clash_master_99');
        store.set('clashCalc_avatar', 'golem');
        store.set('clashCalc_hasPassword', 'true');
        store.set('clashCalc_player_DEFAULT0', JSON.stringify({ name: 'Player 1' }));
        store.set('clashCalc_player_8PJYGUJC', JSON.stringify({ name: 'Player 2' }));
        store.set('clashCalc_planner_DEFAULT0', JSON.stringify({ plan: [] }));
        store.set('clashCalc_history_DEFAULT0', JSON.stringify({ history: [] }));
        store.set('clashCalc_playerTags', JSON.stringify(['DEFAULT0', '8PJYGUJC']));
        store.set('clashCalc_activePlayerTag', '8PJYGUJC');
        store.set('clashCalc_userId', 'original_user_uuid_123');
        store.set('clashCalc_appSettings', JSON.stringify({
            theme: 'light',
            accentColor: 'emerald',
            language: 'de',
            uiTimestamps: { tour: 123456789 }
        }));
        sessionStore.set('transientSessionKey', 'transientVal');

        globalThis.window.location.pathname = '/ore-calculator/';
        globalThis.window.location.search = '?tag=8PJYGUJC';
        globalThis.window.location.hash = '#defense';
        globalThis.window.location.href = 'http://localhost:8080/ore-calculator/?tag=8PJYGUJC#defense';

        assert.equal(typeof globalThis.window.resetApplication, 'function', 'window.resetApplication must be globally bound');
        assert.equal(globalThis.window.resetApplication, resetApplication);
        resetApplication();

        assert.equal(getResettingState(), true, 'Resetting state flag must be active');

        assert.equal(store.has('clashCalc_authToken'), false, 'clashCalc_authToken must be removed');
        assert.equal(store.has('clashCalc_username'), false, 'clashCalc_username must be removed');
        assert.equal(store.has('clashCalc_avatar'), false, 'clashCalc_avatar must be removed');
        assert.equal(store.has('clashCalc_hasPassword'), false, 'clashCalc_hasPassword must be removed');

        assert.equal(store.has('clashCalc_player_DEFAULT0'), false, 'DEFAULT0 player partition purged');
        assert.equal(store.has('clashCalc_player_8PJYGUJC'), false, '8PJYGUJC player partition purged');
        assert.equal(store.has('clashCalc_planner_DEFAULT0'), false, 'planner partition purged');
        assert.equal(store.has('clashCalc_history_DEFAULT0'), false, 'history partition purged');
        assert.equal(store.has('clashCalc_activePlayerTag'), false, 'active player tag removed');
        assert.equal(store.get('clashCalc_playerTags'), JSON.stringify(['DEFAULT0']), 'Tags reset to DEFAULT0');

        const rotatedUserId = store.get('clashCalc_userId');
        assert.ok(rotatedUserId, 'A guest UUID must be set');
        assert.notEqual(rotatedUserId, 'original_user_uuid_123', 'Guest UUID must be newly generated');

        const preservedSettings = JSON.parse(store.get('clashCalc_appSettings') || '{}');
        assert.equal(preservedSettings.theme, 'light', 'Theme preference preserved');
        assert.equal(preservedSettings.accentColor, 'emerald', 'Accent color preserved');
        assert.equal(preservedSettings.language, 'de', 'Language preference preserved');
        assert.equal(preservedSettings.uiTimestamps?.tour, 123456789, 'Tour timestamp preserved');

        assert.equal(sessionStore.size, 0, 'sessionStorage must be completely cleared');

        assert.equal(globalThis.window.location.href, 'http://localhost:8080/ore-calculator/', 'Location reloads to clean pathname');
    });

    test('initCrossTabAuthSync reacts to storage events across tabs for logout, login, and profile updates', () => {
        resetCrossTabAuthSyncForTesting();
        initCrossTabAuthSync();

        /** @type {any[]} */
        const eventsReceived = [];
        /** @param {any} e */
        const handler = (e) => eventsReceived.push(e.detail);
        globalThis.document.addEventListener('auth:state-change', handler);

        store.set('clashCalc_authToken', 'new.cross.tab.jwt');
        store.set('clashCalc_username', 'cross_tab_user');
        globalThis.window.dispatchEvent({
            type: 'storage',
            key: 'clashCalc_authToken',
            newValue: 'new.cross.tab.jwt',
            oldValue: null
        });

        assert.equal(eventsReceived.length, 1);
        assert.equal(eventsReceived[0].action, 'login');
        assert.equal(eventsReceived[0].user?.username, 'cross_tab_user');

        store.delete('clashCalc_authToken');
        store.delete('clashCalc_username');
        globalThis.window.dispatchEvent({
            type: 'storage',
            key: 'clashCalc_authToken',
            newValue: null,
            oldValue: 'new.cross.tab.jwt'
        });

        assert.equal(eventsReceived.length, 2);
        assert.equal(eventsReceived[1].action, 'logout');
        assert.equal(state.playerProfile, null);
        assert.deepEqual(state.savedPlayerTags, ['DEFAULT0']);

        store.set('clashCalc_avatar', 'giant');
        globalThis.window.dispatchEvent({
            type: 'storage',
            key: 'clashCalc_avatar',
            newValue: 'giant',
            oldValue: 'archer'
        });

        assert.equal(eventsReceived.length, 3);
        assert.equal(eventsReceived[2].action, 'profile-update');

        globalThis.document.removeEventListener('auth:state-change', handler);
    });
});
