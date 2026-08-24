const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const {
    ALERT_COOLDOWN_MS,
    outageState,
    isIgnoredNoise,
    isBotTraffic,
    shouldSendAlertEmail,
    recordAlertSent,
    notify503RecoveryIfActive,
    resetThrottleState
} = require('../services/alertThrottle.js');

describe('Server Alert Throttling and Diagnostic Rules Suite', () => {
    beforeEach(() => {
        resetThrottleState();
    });

    test('isBotTraffic accurately identifies search crawlers, preview bots, and headless renderers', () => {
        assert.equal(isBotTraffic('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'), true);
        assert.equal(isBotTraffic('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'), true);
        assert.equal(isBotTraffic('Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome-Lighthouse'), true);
        assert.equal(isBotTraffic('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 HeadlessChrome/120.0.0.0'), true);
        assert.equal(isBotTraffic('Mozilla/5.0 (compatible; DuckDuckBot-Https/1.1; https://duckduckgo.com/duckduckbot)'), true);
        assert.equal(isBotTraffic('Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)'), true);
        assert.equal(isBotTraffic('Applebot/0.1 (+http://www.apple.com/go/applebot)'), true);
        assert.equal(isBotTraffic('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'), true);

        // Genuine human user agents must NOT be classified as bots
        assert.equal(isBotTraffic('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'), false);
        assert.equal(isBotTraffic('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'), false);
    });

    test('isIgnoredNoise correctly identifies and discards opaque extension errors and routine states', () => {
        assert.equal(isIgnoredNoise('Script error.'), true);
        assert.equal(isIgnoredNoise('Console Error: Script error.'), true);
        assert.equal(isIgnoredNoise('Console Error: [ERROR] Error fetching player data: apiErrors.notFound'), true);
        assert.equal(isIgnoredNoise('Failed to load player preview data: apiErrors.notFound'), true);
        assert.equal(isIgnoredNoise('Console Error: [ERROR] Error fetching player data: Invalid Clash of Clans tag format.'), true);
        assert.equal(isIgnoredNoise('Console Error: [ERROR] Error fetching CWL league group: apiErrors.notFound'), true);
        assert.equal(isIgnoredNoise('Console Error: [ERROR] Error fetching clan war log: Clan war log is private'), true);
        assert.equal(isIgnoredNoise('Console Error: [ERROR] SW registration failed: Rejected'), true);
        assert.equal(isIgnoredNoise('ResizeObserver loop completed with undelivered notifications.'), true);

        // Genuine runtime errors, network drops, chunk reloads, and 702 must NOT be ignored (they are stored in DB)
        assert.equal(isIgnoredNoise('Console Error: [ERROR] Uncaught error: Cannot read properties of undefined (reading \'getData\')'), false);
        assert.equal(isIgnoredNoise('Console Error: [ERROR] Failed to save data to cloud: apiErrors.413'), false);
        assert.equal(isIgnoredNoise('Console Error: [ERROR] Failed to save data to cloud: Failed to fetch'), false);
        assert.equal(isIgnoredNoise('Unhandled Promise Rejection: Failed to fetch dynamically imported module: https://orecalc.tech/js/app.js'), false);
        assert.equal(isIgnoredNoise('Console Error: [ERROR] Error fetching current app version: apiErrors.702'), false);
        assert.equal(isIgnoredNoise('Unhandled Promise Rejection: TypeError: Network request failed'), false);
    });

    test('shouldSendAlertEmail suppresses email alerts for anonymous and bot traffic', () => {
        const anonymousError = {
            userId: 'unknown',
            environment: 'orecalc.tech',
            message: 'Console Error: [ERROR] Uncaught error: Cannot read properties of undefined'
        };
        const decision = shouldSendAlertEmail(anonymousError);
        assert.equal(decision.shouldSend, false);
        assert.equal(decision.reason, 'anonymous_user_db_only');
    });

    test('shouldSendAlertEmail strictly suppresses emails for bot and crawler traffic even with active userId', () => {
        const googlebotError = {
            userId: '12345678-1234-1234-1234-1234567890ab',
            environment: 'orecalc.tech',
            userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            message: 'Console Error: [ERROR] Failed to save data to cloud: apiErrors.413'
        };
        const googleDecision = shouldSendAlertEmail(googlebotError);
        assert.equal(googleDecision.shouldSend, false);
        assert.equal(googleDecision.reason, 'bot_crawler_traffic');

        const bingbotError = {
            userId: '98765432-4321-4321-4321-ba0987654321',
            environment: 'orecalc.tech',
            userAgent: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
            message: 'Unhandled Promise Rejection: TypeError: Cannot read property of null'
        };
        const bingDecision = shouldSendAlertEmail(bingbotError);
        assert.equal(bingDecision.shouldSend, false);
        assert.equal(bingDecision.reason, 'bot_crawler_traffic');

        const lighthouseError = {
            userId: 'guest-th16-active-id',
            environment: 'orecalc.tech',
            userAgent: 'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 Chrome/119.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse',
            message: 'Console Error: [ERROR] Uncaught TypeError: Failed to execute'
        };
        const lighthouseDecision = shouldSendAlertEmail(lighthouseError);
        assert.equal(lighthouseDecision.shouldSend, false);
        assert.equal(lighthouseDecision.reason, 'bot_crawler_traffic');
    });

    test('shouldSendAlertEmail permits valid critical errors and enforces 10-minute cooldown', () => {
        const validError = {
            userId: '12345678-1234-1234-1234-1234567890ab',
            environment: 'orecalc.tech',
            message: 'Console Error: [ERROR] Failed to save data to cloud: apiErrors.413'
        };

        // First occurrence: should send
        const firstDecision = shouldSendAlertEmail(validError);
        assert.equal(firstDecision.shouldSend, true);
        assert.equal(firstDecision.reason, 'critical_alert_allowed');

        // Record that alert was dispatched
        recordAlertSent(firstDecision.signature);

        // Immediate duplicate: should be throttled
        const duplicateDecision = shouldSendAlertEmail(validError);
        assert.equal(duplicateDecision.shouldSend, false);
        assert.equal(duplicateDecision.reason, 'cooldown_active');
    });

    test('503 Supercell outage cycle triggers alert and recovery notification', async () => {
        const outageError = {
            userId: '12345678-1234-1234-1234-1234567890ab',
            environment: 'orecalc.tech',
            message: 'Failed to load player preview data: apiErrors.503'
        };

        // First 503: triggers 503 outage alert
        const decision = shouldSendAlertEmail(outageError);
        assert.equal(decision.shouldSend, true);
        assert.equal(decision.reason, 'supercell_503_alert');

        recordAlertSent(decision.signature);
        assert.equal(outageState.is503Active, true);

        // Second 503 within cooldown: throttled
        const duplicateDecision = shouldSendAlertEmail(outageError);
        assert.equal(duplicateDecision.shouldSend, false);
        assert.equal(duplicateDecision.reason, 'cooldown_active_503');

        // Recovery: notify503RecoveryIfActive marks outage resolved
        const recoverySent = await notify503RecoveryIfActive();
        assert.equal(outageState.is503Active, false);
    });

    test('network drops, dynamic chunk reloads, and 702 errors enforce 10-minute cooldown', () => {
        const networkError = {
            userId: '12345678-1234-1234-1234-1234567890ab',
            environment: 'orecalc.tech',
            message: 'Console Error: [ERROR] Failed to save data to cloud: Failed to fetch'
        };
        const chunkError = {
            userId: '12345678-1234-1234-1234-1234567890ab',
            environment: 'orecalc.tech',
            message: 'Unhandled Promise Rejection: Failed to fetch dynamically imported module: https://orecalc.tech/js/app.js'
        };
        const api702Error = {
            userId: '12345678-1234-1234-1234-1234567890ab',
            environment: 'orecalc.tech',
            message: 'Console Error: [ERROR] Error fetching current app version: apiErrors.702'
        };

        // First instance of network drop allowed
        const netDecision = shouldSendAlertEmail(networkError);
        assert.equal(netDecision.shouldSend, true);
        assert.equal(netDecision.signature, 'transient_network_drop');
        recordAlertSent(netDecision.signature);

        // Immediate duplicate network drop throttled
        const netDup = shouldSendAlertEmail(networkError);
        assert.equal(netDup.shouldSend, false);
        assert.equal(netDup.reason, 'cooldown_active');

        // First instance of chunk reload allowed
        const chunkDecision = shouldSendAlertEmail(chunkError);
        assert.equal(chunkDecision.shouldSend, true);
        assert.equal(chunkDecision.signature, 'chunk_deployment_mismatch');
        recordAlertSent(chunkDecision.signature);

        // Immediate duplicate chunk reload throttled
        const chunkDup = shouldSendAlertEmail(chunkError);
        assert.equal(chunkDup.shouldSend, false);
        assert.equal(chunkDup.reason, 'cooldown_active');

        // First instance of 702 allowed
        const api702Decision = shouldSendAlertEmail(api702Error);
        assert.equal(api702Decision.shouldSend, true);
        assert.equal(api702Decision.signature, 'api_error_702');
        recordAlertSent(api702Decision.signature);

        // Immediate duplicate 702 throttled
        const api702Dup = shouldSendAlertEmail(api702Error);
        assert.equal(api702Dup.shouldSend, false);
        assert.equal(api702Dup.reason, 'cooldown_active');
    });
});
