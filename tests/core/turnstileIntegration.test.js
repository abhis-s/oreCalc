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
        body: { classList: { contains: () => false } },
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
        },
        querySelector: () => null,
        getElementById: () => null,
        createElement: (tag) => {
            const el = {
                tagName: tag.toUpperCase(),
                src: '',
                async: false,
                defer: false,
                onload: null,
                onerror: null,
                addEventListener: () => {}
            };
            return el;
        },
        head: {
            appendChild: (el) => {
                if (typeof el.onload === 'function') {
                    Promise.resolve().then(() => el.onload());
                }
            }
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

import {
    fetchTurnstileConfig,
    renderTurnstileWidget,
    resetTurnstileWidget,
    removeTurnstileWidget
} from '../../js/services/turnstileClientService.js';
import {
    registerWithPassword,
    loginWithPassword
} from '../../js/services/authClientService.js';

describe('Turnstile Client Service & Auth Integration', () => {
    beforeEach(async () => {
        store.clear();
        globalThis.window.__ENV__ = {
            APP_VERSION: '2.2.0',
            PUBLIC_API_BASE_URL: 'http://localhost:3000',
            VITE_API_BASE_URL: 'http://localhost:3000'
        };
        delete globalThis.window.turnstile;
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async () => ({
            ok: true,
            json: async () => ({ enabled: false, siteKey: '' })
        });
        await fetchTurnstileConfig({ forceRefresh: true });
        globalThis.fetch = originalFetch;
    });

    test('fetchTurnstileConfig fetches active config from backend API', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async (url) => {
            if (String(url).includes('/api/auth/turnstile-config')) {
                return {
                    ok: true,
                    json: async () => ({ enabled: true, siteKey: '0x4AAAAAA_TEST_KEY' })
                };
            }
            return { ok: false, status: 404 };
        };

        try {
            const config = await fetchTurnstileConfig({ forceRefresh: true });
            assert.strictEqual(config.enabled, true);
            assert.strictEqual(config.siteKey, '0x4AAAAAA_TEST_KEY');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('fetchTurnstileConfig falls back to PUBLIC_TURNSTILE_SITE_KEY when API fails', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async () => {
            throw new Error('Network error');
        };

        globalThis.window.__ENV__.PUBLIC_TURNSTILE_SITE_KEY = '0x4AAAAAA_PUBLIC_KEY';
        try {
            const config = await fetchTurnstileConfig({ forceRefresh: true });
            assert.strictEqual(config.enabled, true);
            assert.strictEqual(config.siteKey, '0x4AAAAAA_PUBLIC_KEY');
        } finally {
            delete globalThis.window.__ENV__.PUBLIC_TURNSTILE_SITE_KEY;
            globalThis.fetch = originalFetch;
        }
    });

    test('fetchTurnstileConfig falls back to legacy VITE_TURNSTILE_SITE_KEY when PUBLIC is unset and API fails', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async () => {
            throw new Error('Network error');
        };

        globalThis.window.__ENV__.VITE_TURNSTILE_SITE_KEY = '0x4AAAAAA_LEGACY_KEY';
        try {
            const config = await fetchTurnstileConfig({ forceRefresh: true });
            assert.strictEqual(config.enabled, true);
            assert.strictEqual(config.siteKey, '0x4AAAAAA_LEGACY_KEY');
        } finally {
            delete globalThis.window.__ENV__.VITE_TURNSTILE_SITE_KEY;
            globalThis.fetch = originalFetch;
        }
    });

    test('renderTurnstileWidget returns null when Turnstile is disabled or missing siteKey', async () => {
        const dummyContainer = { innerHTML: 'existing' };
        const result = await renderTurnstileWidget(/** @type {any} */ (dummyContainer));
        assert.strictEqual(result, null);
        assert.strictEqual(dummyContainer.innerHTML, 'existing');
    });

    test('renderTurnstileWidget renders into target container when turnstile script is available', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async (url) => {
            if (String(url).includes('/api/auth/turnstile-config')) {
                return {
                    ok: true,
                    json: async () => ({ enabled: true, siteKey: '0x4AAAAAA_ENABLED_KEY' })
                };
            }
            return { ok: false, status: 404 };
        };
        await fetchTurnstileConfig({ forceRefresh: true });

        let renderedTarget = null;
        let renderedOptions = null;

        globalThis.window.turnstile = {
            render: (target, opts) => {
                renderedTarget = target;
                renderedOptions = opts;
                return 'widget_test_123';
            },
            reset: () => {},
            remove: () => {}
        };

        const dummyContainer = { innerHTML: 'placeholder' };
        let verifiedToken = '';

        try {
            const widgetId = await renderTurnstileWidget(/** @type {any} */ (dummyContainer), {
                onVerify: (tok) => { verifiedToken = tok; }
            });

            assert.strictEqual(widgetId, 'widget_test_123');
            assert.strictEqual(dummyContainer.innerHTML, '');
            assert.strictEqual(renderedTarget, dummyContainer);
            assert.ok(renderedOptions);

            renderedOptions.callback('mock_captcha_token');
            assert.strictEqual(verifiedToken, 'mock_captcha_token');
        } finally {
            delete globalThis.window.turnstile;
            globalThis.fetch = originalFetch;
        }
    });

    test('resetTurnstileWidget and removeTurnstileWidget safely invoke turnstile methods', () => {
        let resetCalledWith = null;
        let removeCalledWith = null;

        globalThis.window.turnstile = {
            render: () => 'w1',
            reset: (id) => { resetCalledWith = id; },
            remove: (id) => { removeCalledWith = id; }
        };

        try {
            resetTurnstileWidget('widget_abc');
            assert.strictEqual(resetCalledWith, 'widget_abc');

            removeTurnstileWidget('widget_abc');
            assert.strictEqual(removeCalledWith, 'widget_abc');

            // Null or missing widget ID calls do not throw
            assert.doesNotThrow(() => resetTurnstileWidget(null));
            assert.doesNotThrow(() => removeTurnstileWidget(null));
        } finally {
            delete globalThis.window.turnstile;
        }
    });

    test('registerWithPassword passes turnstileToken in request body', async () => {
        let capturedPayload = null;
        const originalFetch = globalThis.fetch;

        globalThis.fetch = async (url, opts) => {
            if (String(url).includes('/api/auth/register-password')) {
                capturedPayload = JSON.parse(opts.body);
                return {
                    ok: true,
                    json: async () => ({
                        token: 'jwt_mock_token',
                        username: capturedPayload.username,
                        userId: capturedPayload.currentUserId,
                        avatar: 'builder'
                    })
                };
            }
            return { ok: false, status: 404 };
        };

        try {
            const result = await registerWithPassword('testuser', 'Password123!', 'cf_token_sample');
            assert.strictEqual(result.username, 'testuser');
            assert.strictEqual(capturedPayload.turnstileToken, 'cf_token_sample');
            assert.strictEqual(capturedPayload.username, 'testuser');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('loginWithPassword passes turnstileToken in request body', async () => {
        let capturedPayload = null;
        const originalFetch = globalThis.fetch;

        globalThis.fetch = async (url, opts) => {
            if (String(url).includes('/api/auth/login-password')) {
                capturedPayload = JSON.parse(opts.body);
                return {
                    ok: true,
                    json: async () => ({
                        token: 'jwt_mock_login',
                        username: capturedPayload.username,
                        userId: 'user-uuid-1234',
                        avatar: 'goblin'
                    })
                };
            }
            return { ok: false, status: 404 };
        };

        try {
            const result = await loginWithPassword('testuser', 'Password123!', 'cf_token_sample_login');
            assert.strictEqual(result.username, 'testuser');
            assert.strictEqual(capturedPayload.turnstileToken, 'cf_token_sample_login');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});
