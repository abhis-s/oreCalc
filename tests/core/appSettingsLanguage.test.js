import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
    applyAppLanguage,
    initAppSettings,
    resetAppSettingsListenersForTesting
} from '../../js/components/common/appSettings.js';
import { state } from '../../js/core/state.js';
import { STORAGE_KEY_MAP } from '../../js/core/constants.js';

function mockGlobal(prop, value) {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, prop);
    Object.defineProperty(globalThis, prop, {
        value,
        configurable: true,
        writable: true
    });
    return () => {
        if (originalDescriptor) {
            Object.defineProperty(globalThis, prop, originalDescriptor);
        } else {
            // @ts-ignore
            delete globalThis[prop];
        }
    };
}

describe('App Settings Language Synchronization Suite', () => {
    let cleanups = [];
    let storageMap = new Map();
    let pushedUrls = [];
    let replacedUrls = [];
    let dispatchedEvents = [];
    let hrefAssigned = false;

    beforeEach(() => {
        cleanups = [];
        storageMap = new Map();
        pushedUrls = [];
        replacedUrls = [];
        dispatchedEvents = [];
        hrefAssigned = false;
        resetAppSettingsListenersForTesting();
        state.uiSettings = {};

        cleanups.push(mockGlobal('fetch', async () => ({
            ok: true,
            json: async () => ({})
        })));

        cleanups.push(mockGlobal('localStorage', {
            getItem: (key) => storageMap.get(key) ?? null,
            setItem: (key, val) => storageMap.set(key, String(val)),
            removeItem: (key) => storageMap.delete(key),
            clear: () => storageMap.clear()
        }));

        let locationHref = 'https://orecalc.tech/damage-calculator/';
        const mockLocation = {
            origin: 'https://orecalc.tech',
            pathname: '/damage-calculator/',
            search: '',
            hash: '',
            get href() { return locationHref; },
            set href(val) {
                hrefAssigned = true;
                locationHref = val;
            }
        };

        cleanups.push(mockGlobal('history', {
            pushState: (_st, _ti, url) => pushedUrls.push(url),
            replaceState: (_st, _ti, url) => replacedUrls.push(url)
        }));

        cleanups.push(mockGlobal('window', {
            location: mockLocation,
            addEventListener: (type, handler) => {
                windowListeners[type] = handler;
            },
            removeEventListener: () => {}
        }));

        const windowListeners = {};
        cleanups.push(() => {
            for (const k of Object.keys(windowListeners)) {
                delete windowListeners[k];
            }
        });

        const selectAppLang = { id: 'app-language-select', value: 'en', appendChild: () => {} };
        const selectSettingsLang = { id: 'settings-language-select', value: 'en' };
        const selectWelcomeLang = { id: 'welcome-language-select', value: 'en' };

        const mockDoc = {
            documentElement: {
                lang: 'en',
                setAttribute: () => {},
                classList: { add: () => {}, remove: () => {}, toggle: () => {} },
                style: { setProperty: () => {}, getPropertyValue: () => '' }
            },
            body: {
                classList: { add: () => {}, remove: () => {}, toggle: () => {} },
                style: { setProperty: () => {}, getPropertyValue: () => '' }
            },
            head: { appendChild: () => {} },
            createElement: () => ({
                id: '',
                textContent: '',
                sheet: { insertRule: () => {} },
                setAttribute: () => {},
                getAttribute: () => null
            }),
            getElementById: (id) => {
                if (id === 'app-language-select') return selectAppLang;
                if (id === 'settings-language-select') return selectSettingsLang;
                if (id === 'welcome-language-select') return selectWelcomeLang;
                return null;
            },
            querySelector: () => null,
            querySelectorAll: () => [],
            dispatchEvent: (evt) => {
                dispatchedEvents.push(evt.type);
                return true;
            }
        };

        cleanups.push(mockGlobal('document', mockDoc));
        cleanups.push(mockGlobal('CustomEvent', class CustomEvent {
            constructor(type, detail) {
                this.type = type;
                this.detail = detail;
            }
        }));
        cleanups.push(mockGlobal('Event', class Event {
            constructor(type) {
                this.type = type;
            }
        }));
    });

    afterEach(() => {
        cleanups.forEach(fn => fn());
        cleanups = [];
        resetAppSettingsListenersForTesting();
        state.uiSettings = {};
    });

    test('applyAppLanguage updates language in-place without page reload (no location.href mutation)', async () => {
        state.uiSettings = { language: 'en' };

        await applyAppLanguage('de', false);

        assert.equal(hrefAssigned, false, 'window.location.href must NOT be mutated');
        assert.equal(state.uiSettings.language, 'de', 'state.uiSettings.language must be updated to de');
        assert.equal(pushedUrls.length, 1, 'syncLanguageUrl must push localized URL');
        assert.equal(pushedUrls[0], '/de/damage-calculator/');

        const rawSettings = storageMap.get(STORAGE_KEY_MAP.appSettings.legacy);
        assert.ok(rawSettings, 'appSettings must be persisted to storage');
        assert.ok(rawSettings.includes('"language":"de"'), 'Persisted language must be de');

        const appSelect = globalThis.document.getElementById('app-language-select');
        assert.equal(appSelect.value, 'de', '#app-language-select value must sync to de');

        const settingsSelect = globalThis.document.getElementById('settings-language-select');
        assert.equal(settingsSelect.value, 'de', '#settings-language-select value must sync to de');

        assert.ok(dispatchedEvents.includes('app:translate'), 'app:translate event must be dispatched');
        assert.ok(dispatchedEvents.includes('languageChanged'), 'languageChanged event must be dispatched');
    });

    test('applyAppLanguage supports history replacement without reload when replaceUrl is true', async () => {
        state.uiSettings = { language: 'en' };

        await applyAppLanguage('tr', true);

        assert.equal(hrefAssigned, false, 'location.href must not be mutated');
        assert.equal(state.uiSettings.language, 'tr');
        assert.equal(replacedUrls.length, 1, 'syncLanguageUrl must replace URL when replaceUrl is true');
        assert.equal(replacedUrls[0], '/tr/damage-calculator/');
    });

    test('applyAppLanguage ignores unsupported language codes safely', async () => {
        state.uiSettings = { language: 'en' };

        await applyAppLanguage('unsupported');

        assert.equal(state.uiSettings.language, 'en', 'Unsupported language code must be ignored');
        assert.equal(pushedUrls.length, 0, 'No URL change for unsupported language');
    });

    test('cross-tab storage event updates language in-place without page reload', async () => {
        const windowListeners = {};
        globalThis.window.addEventListener = (type, handler) => {
            windowListeners[type] = handler;
        };

        state.uiSettings = { language: 'en' };
        initAppSettings();

        assert.ok(typeof windowListeners['storage'] === 'function', 'storage listener must be registered');

        await windowListeners['storage']({
            key: STORAGE_KEY_MAP.appSettings.legacy,
            newValue: JSON.stringify({ language: 'zh', theme: 'dark', accentColor: 'blue' })
        });

        assert.equal(hrefAssigned, false, 'Cross-tab language update must NOT reload via location.href');
        assert.equal(state.uiSettings.language, 'zh', 'state.uiSettings.language must update to zh in-place');
        assert.equal(pushedUrls.length, 1);
        assert.equal(pushedUrls[0], '/zh/damage-calculator/');
    });

    test('browser popstate event triggers in-place language update when path language changes', async () => {
        const windowListeners = {};
        globalThis.window.addEventListener = (type, handler) => {
            windowListeners[type] = handler;
        };

        state.uiSettings = { language: 'de' };
        initAppSettings();

        assert.ok(typeof windowListeners['popstate'] === 'function', 'popstate listener must be registered');

        // User pressed Back, browser location pathname reverted from /de/damage-calculator/ to /damage-calculator/
        globalThis.window.location.pathname = '/damage-calculator/';

        await windowListeners['popstate']();

        assert.equal(hrefAssigned, false, 'Popstate must NOT reload via location.href');
        assert.equal(state.uiSettings.language, 'en', 'state.uiSettings.language must transition back to en');
        assert.equal(globalThis.document.documentElement.lang, 'en', 'document.documentElement.lang must update to en');
        assert.ok(dispatchedEvents.includes('languageChanged'), 'languageChanged must be dispatched');
    });
});
