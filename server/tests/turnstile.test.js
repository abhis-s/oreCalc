const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
    isTurnstileEnabled,
    getTurnstileSiteKey,
    isIpAllowlisted,
    verifyTurnstileToken
} = require('../services/turnstileService.js');

describe('Turnstile Service Suite', () => {
    const origEnv = { ...process.env };
    const origFetch = globalThis.fetch;

    beforeEach(() => {
        delete process.env.TURNSTILE_SECRET_KEY;
        delete process.env.TURNSTILE_SITE_KEY;
        delete process.env.TURNSTILE_ENABLED;
        delete process.env.TURNSTILE_ALLOWLIST_IPS;
    });

    afterEach(() => {
        process.env = { ...origEnv };
        globalThis.fetch = origFetch;
    });

    test('isTurnstileEnabled returns false when TURNSTILE_SECRET_KEY is omitted', () => {
        assert.strictEqual(isTurnstileEnabled(), false);
    });

    test('isTurnstileEnabled returns false when TURNSTILE_ENABLED is explicitly false', () => {
        process.env.TURNSTILE_SECRET_KEY = 'dummy-secret';
        process.env.TURNSTILE_ENABLED = 'false';
        assert.strictEqual(isTurnstileEnabled(), false);
    });

    test('isTurnstileEnabled returns true when TURNSTILE_SECRET_KEY is present and enabled is not false', () => {
        process.env.TURNSTILE_SECRET_KEY = 'dummy-secret';
        assert.strictEqual(isTurnstileEnabled(), true);
    });

    test('getTurnstileSiteKey returns configured site key or empty string', () => {
        assert.strictEqual(getTurnstileSiteKey(), '');
        process.env.TURNSTILE_SITE_KEY = 'test-site-key';
        assert.strictEqual(getTurnstileSiteKey(), 'test-site-key');
    });

    test('isIpAllowlisted handles IPv4, IPv6 localhost, and IPv4-mapped IPv6', () => {
        process.env.TURNSTILE_ALLOWLIST_IPS = '127.0.0.1, 192.168.1.100';
        assert.strictEqual(isIpAllowlisted('127.0.0.1'), true);
        assert.strictEqual(isIpAllowlisted('::ffff:127.0.0.1'), true);
        assert.strictEqual(isIpAllowlisted('::1'), true);
        assert.strictEqual(isIpAllowlisted('192.168.1.100'), true);
        assert.strictEqual(isIpAllowlisted('203.0.113.1'), false);
    });

    test('verifyTurnstileToken bypasses verification when Turnstile is disabled', async () => {
        const result = await verifyTurnstileToken('', '203.0.113.1');
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.bypassed, true);
    });

    test('verifyTurnstileToken bypasses verification when IP is allowlisted even if enabled', async () => {
        process.env.TURNSTILE_SECRET_KEY = 'secret-key';
        process.env.TURNSTILE_ALLOWLIST_IPS = '127.0.0.1';
        const result = await verifyTurnstileToken('', '127.0.0.1');
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.bypassed, true);
    });

    test('verifyTurnstileToken returns captchaRequired when enabled and token is missing or empty', async () => {
        process.env.TURNSTILE_SECRET_KEY = 'secret-key';
        const result = await verifyTurnstileToken('', '203.0.113.1');
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.reason, 'captchaRequired');
    });

    test('verifyTurnstileToken succeeds when Cloudflare siteverify responds with success: true', async () => {
        process.env.TURNSTILE_SECRET_KEY = 'secret-key';
        globalThis.fetch = /** @type {any} */ (async (url, options) => {
            assert.strictEqual(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
            assert.strictEqual(options.method, 'POST');
            return {
                ok: true,
                json: async () => ({ success: true })
            };
        });

        const result = await verifyTurnstileToken('valid-token', '203.0.113.1');
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.bypassed, undefined);
    });

    test('verifyTurnstileToken fails when Cloudflare siteverify responds with success: false', async () => {
        process.env.TURNSTILE_SECRET_KEY = 'secret-key';
        globalThis.fetch = /** @type {any} */ (async () => ({
            ok: true,
            json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] })
        }));

        const result = await verifyTurnstileToken('invalid-token', '203.0.113.1');
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.reason, 'captchaFailed');
    });

    test('verifyTurnstileToken handles HTTP 500 error gracefully', async () => {
        process.env.TURNSTILE_SECRET_KEY = 'secret-key';
        globalThis.fetch = /** @type {any} */ (async () => ({
            ok: false,
            status: 500
        }));

        const result = await verifyTurnstileToken('token', '203.0.113.1');
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.reason, 'captchaFailed');
    });
});
