import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage for Node.js environment
const store = new Map();
if (typeof globalThis.localStorage === 'undefined') {
    globalThis.localStorage = {
        getItem: (key) => store.get(key) ?? null,
        setItem: (key, val) => store.set(key, String(val)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
        key: (index) => Array.from(store.keys())[index] ?? null,
        get length() { return store.size; }
    };
}

// Mock sessionStorage for Node.js environment
const sessionStore = new Map();
if (typeof globalThis.sessionStorage === 'undefined') {
    globalThis.sessionStorage = {
        getItem: (key) => sessionStore.get(key) ?? null,
        setItem: (key, val) => sessionStore.set(key, String(val)),
        removeItem: (key) => sessionStore.delete(key),
        clear: () => sessionStore.clear(),
        key: (index) => Array.from(sessionStore.keys())[index] ?? null,
        get length() { return sessionStore.size; }
    };
}

// Mock window and document if running in Node.js
if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        location: { hostname: 'localhost', origin: 'http://localhost:8080' },
        __ENV__: { APP_VERSION: '2.2.0', PUBLIC_API_BASE_URL: 'http://localhost:3000', VITE_API_BASE_URL: 'http://localhost:3000' }
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

import { ALLOWED_STATIC_STORAGE_KEYS, normalizePlayerTag } from '../../js/core/storageKeys.js';
import { loadTranslations } from '../../js/i18n/translator.js';
await loadTranslations('en');
import {
    getAuthenticatedUser,
    isAuthenticated,
    logout,
    purgeLocalDataOnLogin,
    normalizeWebAuthnError,
    isPasskeyAutofillSupported,
    getSuggestedPasskeyName,
    resolveUniquePasskeyName
} from '../../js/services/authClientService.js';
import { getResettingState, saveState, setResettingState } from '../../js/core/localStorageManager.js';
import { state } from '../../js/core/state.js';
import { handleDeletePasskey } from '../../js/components/auth/passkeysModalInputs.js';

describe('Auth Client Integration & Session Invariants Suite', () => {
    beforeEach(() => {
        store.clear();
        sessionStore.clear();
        setResettingState(false);
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
            'account-guest-section', 'account-auth-section', 'account-profile-username',
            'account-profile-avatar-img',
            'header-account-btn', 'header-account-icon-wrapper', 'header-account-avatar-img'
        ];
        ids.forEach(createEl);

        globalThis.document.getElementById = (id) => elements.get(id) || null;

        // Authenticated user with custom avatar
        updateAccountUI({ username: 'layout_user_1', avatar: 'golem' });
        assert.equal(elements.get('account-profile-username').textContent, 'layout_user_1');
        assert.equal(elements.get('account-profile-avatar-img').getAttribute('src'), 'assets/avatars/golem.png');
        assert.equal(elements.get('header-account-avatar-img').getAttribute('src'), 'assets/avatars/golem.png');
        assert.ok(elements.get('header-account-btn').classList.contains('is-authenticated'));
        assert.ok(elements.get('header-account-icon-wrapper').classList.contains('is-hidden'));
        assert.ok(!elements.get('header-account-avatar-img').classList.contains('is-hidden'));
        assert.ok(elements.get('account-guest-section').classList.contains('is-hidden'));
        assert.ok(!elements.get('account-auth-section').classList.contains('is-hidden'));
        assert.equal(elements.get('account-guest-section').style.display, 'none');
        assert.equal(elements.get('account-auth-section').style.display, '');

        // Guest user (null)
        updateAccountUI(null);
        assert.equal(elements.get('account-profile-username').textContent, '');
        assert.ok(!elements.get('header-account-btn').classList.contains('is-authenticated'));
        assert.ok(!elements.get('header-account-icon-wrapper').classList.contains('is-hidden'));
        assert.ok(elements.get('header-account-avatar-img').classList.contains('is-hidden'));
        assert.ok(!elements.get('account-guest-section').classList.contains('is-hidden'));
        assert.ok(elements.get('account-auth-section').classList.contains('is-hidden'));
        assert.equal(elements.get('account-guest-section').style.display, '');
        assert.equal(elements.get('account-auth-section').style.display, 'none');
    });

    test('renderPasskeysList cleanly switches between empty state and device items', async () => {
        const { renderPasskeysList } = await import('../../js/components/auth/passkeysModalDisplay.js');
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
                style: {},
                innerHTML: '',
                textContent: ''
            };
            elements.set(id, el);
            return el;
        };

        createEl('passkeys-items-list');
        createEl('passkeys-empty-state');

        globalThis.document.getElementById = (id) => elements.get(id) || null;

        // Empty state
        renderPasskeysList([]);
        assert.ok(elements.get('passkeys-items-list').classList.contains('is-hidden'));
        assert.equal(elements.get('passkeys-items-list').style.display, 'none');
        assert.ok(!elements.get('passkeys-empty-state').classList.contains('is-hidden'));
        assert.equal(elements.get('passkeys-empty-state').style.display, '');

        // Populated state — no Active Session badge should ever appear
        renderPasskeysList([
            { credentialID: 'cred_1', deviceName: 'iCloud Keychain', createdAt: Date.now() },
            { credentialID: 'cred_2', deviceName: 'Security Key', createdAt: Date.now() }
        ]);
        assert.ok(!elements.get('passkeys-items-list').classList.contains('is-hidden'));
        assert.equal(elements.get('passkeys-items-list').style.display, '');
        assert.ok(elements.get('passkeys-empty-state').classList.contains('is-hidden'));
        assert.equal(elements.get('passkeys-empty-state').style.display, 'none');
        assert.ok(elements.get('passkeys-items-list').innerHTML.includes('iCloud Keychain'));
        assert.ok(elements.get('passkeys-items-list').innerHTML.includes('Security Key'));
        assert.equal(elements.get('passkeys-items-list').innerHTML.includes('Active Session'), false);
        assert.equal(elements.get('passkeys-items-list').innerHTML.includes('passkey-badge-current'), false);
    });

    test('openAvatarModal and highlightActiveAvatar select and highlight avatar options accurately', async () => {
        const { openAvatarModal } = await import('../../js/components/appSettings/settingsAccountInputs.js');
        const { highlightActiveAvatar } = await import('../../js/components/appSettings/settingsAccountDisplay.js');

        const options = ['archer', 'builder', 'giant', 'goblin', 'golem', 'hogRider', 'hog', 'skeleton'].map(avatar => {
            const classList = new Set();
            return {
                getAttribute: (attr) => attr === 'data-avatar' ? avatar : null,
                setAttribute: () => {},
                removeAttribute: () => {},
                focus: () => {},
                classList: {
                    add: (cls) => classList.add(cls),
                    remove: (cls) => classList.delete(cls),
                    toggle: (cls, force) => force ? classList.add(cls) : classList.delete(cls),
                    contains: (cls) => classList.has(cls)
                }
            };
        });

        globalThis.document.querySelectorAll = (selector) => {
            if (selector === '.avatar-option-btn') return options;
            return [];
        };

        globalThis.document.querySelector = (selector) => {
            const match = typeof selector === 'string' ? selector.match(/\[data-avatar="([^"]+)"\]/) : null;
            if (match) {
                return options.find(s => s.getAttribute('data-avatar') === match[1]) || null;
            }
            return null;
        };

        highlightActiveAvatar('golem');
        assert.equal(options.find(s => s.getAttribute('data-avatar') === 'golem')?.classList.contains('is-selected'), true);
        assert.equal(options.find(s => s.getAttribute('data-avatar') === 'archer')?.classList.contains('is-selected'), false);

        // Test openAvatarModal integration
        store.set('clashCalc_authToken', 'jwt.test.token');
        store.set('clashCalc_username', 'clash_master');
        store.set('clashCalc_avatar', 'skeleton');

        const modalEl = {
            id: 'avatar-modal',
            classList: { add: () => {}, remove: () => {} },
            showModal: () => {},
            querySelectorAll: () => []
        };
        globalThis.document.getElementById = (id) => id === 'avatar-modal' ? modalEl : null;

        openAvatarModal();
        assert.equal(options.find(s => s.getAttribute('data-avatar') === 'skeleton')?.classList.contains('is-selected'), true);
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
        assert.equal(getSuggestedPasskeyName('Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro Build/UD1A.230803.041)', 'Linux armv8l'), 'Google Password Manager');

        // Windows
        assert.equal(getSuggestedPasskeyName('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32'), 'Windows Hello');

        // Chromebook
        assert.equal(getSuggestedPasskeyName('Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)', 'Linux x86_64'), 'Google Password Manager');

        // Generic Android
        assert.equal(getSuggestedPasskeyName('Mozilla/5.0 (Linux; Android 13; K)', 'Linux armv8l'), 'Google Password Manager');

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

    test('handleDeletePasskey gracefully self-heals on passkeyNotFound without error banner', async () => {
        const statusEl = {
            textContent: '',
            classList: {
                classes: new Set(),
                toggle(cls, force) {
                    if (force) this.classes.add(cls);
                    else this.classes.delete(cls);
                },
                contains(cls) { return this.classes.has(cls); }
            }
        };
        const listEl = {
            innerHTML: '',
            style: {},
            classList: { add: () => {}, remove: () => {} }
        };
        const emptyEl = {
            style: {},
            classList: { add: () => {}, remove: () => {} }
        };

        const prevGetElementById = globalThis.document.getElementById;
        globalThis.document.getElementById = (id) => {
            if (id === 'passkeys-status') return statusEl;
            if (id === 'passkeys-items-list') return listEl;
            if (id === 'passkeys-empty-state') return emptyEl;
            return prevGetElementById ? prevGetElementById(id) : null;
        };

        const originalFetch = globalThis.fetch;
        let deleteCalled = false;
        let fetchPasskeysCalled = false;

        globalThis.fetch = async (url, options = {}) => {
            const method = options?.method || 'GET';
            if (method === 'DELETE' && String(url).includes('/api/auth/passkeys/ghost-cred-id')) {
                deleteCalled = true;
                return {
                    ok: false,
                    status: 404,
                    json: async () => ({ reason: 'passkeyNotFound', message: 'Passkey not found.' })
                };
            }
            if (method === 'GET' && String(url).includes('/api/auth/passkeys')) {
                fetchPasskeysCalled = true;
                return {
                    ok: true,
                    json: async () => ({ passkeys: [] })
                };
            }
            return originalFetch(url, options);
        };

        try {
            await handleDeletePasskey('ghost-cred-id');

            assert.equal(deleteCalled, true, 'DELETE request should be sent');
            assert.equal(fetchPasskeysCalled, true, 'loadPasskeysList should be invoked on passkeyNotFound');
            assert.equal(statusEl.textContent, '', 'Status banner should be clear of error text');
            assert.equal(statusEl.classList.contains('error'), false, 'Error class should not be active');
        } finally {
            globalThis.fetch = originalFetch;
            globalThis.document.getElementById = prevGetElementById;
        }
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
});
