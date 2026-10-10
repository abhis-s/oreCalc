const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const {
    outageState,
    isIgnoredNoise,
    isBotTraffic,
    shouldSendAlertEmail,
    recordAlertSent,
    notify503RecoveryIfActive,
    resetThrottleState,
    resolveEmailDomain,
    parseDeviceSummary,
    normalizeErrorMessage,
    formatIncidentCard,
    queueClientErrorAlert,
    flushUserBatch,
    flushAllPendingBatches,
    pendingUserBatches
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
        assert.equal(isIgnoredNoise('Console Error: [ERROR] Failed to read clipboard: NotAllowedError: Read permission denied.'), true);
        assert.equal(isIgnoredNoise('DOMException: Clipboard read permission was denied.'), true);
        assert.equal(isIgnoredNoise('Unhandled Promise Rejection: NotAllowedError: Failed to execute \'readText\' on \'Clipboard\': Read permission denied.'), true);

        // Injected browser extensions, Web3 wallets, and document line 1 script errors must be discarded
        assert.equal(isIgnoredNoise("TypeError: undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined')", 'https://clashcalc.com/ore-calculator/?tag=2JUGPLUP', 1, 'global code@https://clashcalc.com/ore-calculator/:1:16'), true);
        assert.equal(isIgnoredNoise('Uncaught Error: extension failed', 'chrome-extension://abcdef/content.js', 10, 'Error: extension failed at chrome-extension://abcdef/content.js'), true);
        assert.equal(isIgnoredNoise('Uncaught TypeError: window.solana is undefined', 'https://clashcalc.com/ore-calculator/', 1, ''), true);
        assert.equal(isIgnoredNoise('Uncaught TypeError: Cannot read property of undefined', 'https://clashcalc.com/ore-calculator/?tag=2JUGPLUP', 1, ''), true);

        // Genuine runtime errors, network drops, chunk reloads, and 702 must NOT be ignored (they are stored in DB)
        assert.equal(isIgnoredNoise('Console Error: [ERROR] Uncaught error: Cannot read properties of undefined (reading \'getData\')', 'https://clashcalc.com/js/app.js', 120), false);
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

    test('shouldSendAlertEmail strictly suppresses email alerts for clipboard reading and permission denial errors', () => {
        const clipboardError = {
            userId: '12345678-1234-1234-1234-1234567890ab',
            environment: 'orecalc.tech',
            message: 'Console Error: [ERROR] Failed to read clipboard: NotAllowedError: Read permission denied.'
        };
        const decision = shouldSendAlertEmail(clipboardError);
        assert.equal(decision.shouldSend, false);
        assert.equal(decision.reason, 'ignored_noise');

        const unhandledClipboardError = {
            userId: '12345678-1234-1234-1234-1234567890ab',
            environment: 'orecalc.tech',
            message: 'Unhandled Promise Rejection: NotAllowedError: Failed to execute \'readText\' on \'Clipboard\': Must be handling a user gesture to show a permission request.'
        };
        const unhandledDecision = shouldSendAlertEmail(unhandledClipboardError);
        assert.equal(unhandledDecision.shouldSend, false);
    });

    test('shouldSendAlertEmail suppresses email alerts for browser and wallet injected scripts', () => {
        const braveEthereumError = {
            userId: 'c4f4a04a-8fc6-435c-b5d3-97bd30e2d202',
            environment: 'clashcalc.com',
            message: "TypeError: undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined')",
            source: 'https://clashcalc.com/ore-calculator/?tag=2JUGPLUP',
            line: 1,
            col: 16,
            stack: 'global code@https://clashcalc.com/ore-calculator/:1:16',
            url: 'https://clashcalc.com/ore-calculator/?tag=2JUGPLUP',
            userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0.1 Mobile/15E148 Safari/604.1 Brave'
        };
        const braveDecision = shouldSendAlertEmail(braveEthereumError);
        assert.equal(braveDecision.shouldSend, false);
        assert.equal(braveDecision.reason, 'ignored_noise');

        const extensionError = {
            userId: 'c4f4a04a-8fc6-435c-b5d3-97bd30e2d202',
            environment: 'clashcalc.com',
            message: 'Error: Extension context invalidated.',
            source: 'chrome-extension://abcdef/content.js',
            line: 42,
            stack: 'Error at chrome-extension://abcdef/content.js:42:10'
        };
        const extensionDecision = shouldSendAlertEmail(extensionError);
        assert.equal(extensionDecision.shouldSend, false);
        assert.equal(extensionDecision.reason, 'ignored_noise');
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
        await notify503RecoveryIfActive();
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

    test('resolveEmailDomain accurately classifies production, beta, legacy, and local environments', () => {
        assert.equal(resolveEmailDomain('clashcalc.com'), 'clashcalc.com');
        assert.equal(resolveEmailDomain('www.clashcalc.com'), 'clashcalc.com');
        assert.equal(resolveEmailDomain('beta.clashcalc.com'), 'beta.clashcalc.com');
        assert.equal(resolveEmailDomain('orecalc.tech'), 'orecalc.tech');
        assert.equal(resolveEmailDomain('www.orecalc.tech'), 'orecalc.tech');
        assert.equal(resolveEmailDomain('localhost'), 'localhost');
        assert.equal(resolveEmailDomain('127.0.0.1'), 'localhost');
        assert.equal(resolveEmailDomain('', 'api.clashcalc.com'), 'clashcalc.com');
        assert.equal(resolveEmailDomain('', '', 'https://clashcalc.com/ore-calculator/'), 'clashcalc.com');
        assert.equal(resolveEmailDomain('', '', 'https://beta.clashcalc.com/hero-journey/'), 'beta.clashcalc.com');
        assert.equal(resolveEmailDomain('', '', 'http://localhost:8080/'), 'localhost');
    });

    test('parseDeviceSummary and normalizeErrorMessage sanitize diagnostics', () => {
        const iosUa = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
        assert.equal(parseDeviceSummary(iosUa).includes('iOS'), true);

        const macChromeUa = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
        assert.equal(parseDeviceSummary(macChromeUa), 'Chrome on macOS');

        const winFirefoxUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0';
        assert.equal(parseDeviceSummary(winFirefoxUa), 'Firefox on Windows');

        assert.equal(parseDeviceSummary(''), 'Unknown Device');

        assert.equal(normalizeErrorMessage('Console Error: [ERROR] Failed to save data to cloud: apiErrors.413'), 'apiErrors.413');
        assert.equal(normalizeErrorMessage('Console Error: [ERROR] Error saving user data: apiErrors.413'), 'apiErrors.413');
        assert.equal(normalizeErrorMessage('Unhandled Promise Rejection: TypeError: Network request failed'), 'TypeError: Network request failed');
        assert.equal(normalizeErrorMessage('Uncaught error: Unexpected end of JSON input'), 'Unexpected end of JSON input');
    });

    test('queueClientErrorAlert batches multiple client errors within 15 seconds into a single incident collection', async () => {
        const userA = 'user-uuid-1111';
        const err1 = {
            userId: userA,
            environment: 'clashcalc.com',
            message: 'Failed to save data to cloud: apiErrors.413',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        };
        const err2 = {
            userId: userA,
            environment: 'clashcalc.com',
            message: 'Uncaught TypeError: Cannot read property of undefined',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        };
        const err3 = {
            userId: userA,
            environment: 'clashcalc.com',
            message: 'TypeError: Network request failed',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        };

        const res1 = queueClientErrorAlert(err1);
        assert.equal(res1.queued, true);
        assert.equal(res1.batchSize, 1);

        const res2 = queueClientErrorAlert(err2);
        assert.equal(res2.queued, true);
        assert.equal(res2.batchSize, 2);

        const res3 = queueClientErrorAlert(err3);
        assert.equal(res3.queued, true);
        assert.equal(res3.batchSize, 3);

        assert.equal(pendingUserBatches.has(userA), true);
        const batch = pendingUserBatches.get(userA);
        assert.equal(batch.errors.length, 3);

        // Flushes single user batch
        await flushUserBatch(userA);
        assert.equal(pendingUserBatches.has(userA), false);

        // Subsequent duplicate error within 10 minutes is throttled by signature cooldown
        const res4 = queueClientErrorAlert(err1);
        assert.equal(res4.queued, false);
        assert.equal(res4.reason, 'cooldown_active');

        // Subsequent brand new distinct error from the same user is throttled by user cooldown
        const distinctErr = {
            userId: userA,
            environment: 'clashcalc.com',
            message: 'Unique error message xyz 98765',
            userAgent: 'Mozilla/5.0'
        };
        const res5 = queueClientErrorAlert(distinctErr);
        assert.equal(res5.queued, false);
        assert.equal(res5.reason, 'user_cooldown_active');
    });

    test('formatIncidentCard generates clear ASCII cards with domain, device, and zero dingbats', () => {
        const singleBatch = {
            domain: 'clashcalc.com',
            environment: 'clashcalc.com',
            userId: 'user-uuid-1111',
            firstSeenAt: Date.now(),
            errors: [{
                message: 'Failed to save data to cloud: apiErrors.413',
                source: 'https://clashcalc.com/js/app.js',
                line: 120,
                col: 15,
                url: 'https://clashcalc.com/ore-calculator/',
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                stack: 'Error: apiErrors.413\n    at saveToCloud (app.js:120:15)'
            }]
        };

        const cardText = formatIncidentCard(singleBatch);
        assert.equal(cardText.includes('Environment : clashcalc.com'), true);
        assert.equal(cardText.includes('1 error(s) captured within 15-second window'), true);
        assert.equal(cardText.includes('[Issue 1 of 1]'), true);
        assert.equal(cardText.includes('Failed to save data to cloud: apiErrors.413'), true);

        // Multi-error batch formatting
        const multiBatch = {
            ...singleBatch,
            errors: [
                singleBatch.errors[0],
                {
                    message: 'Uncaught ReferenceError: foo is not defined',
                    source: 'https://clashcalc.com/js/calc.js',
                    line: 45,
                    col: 2,
                    url: 'https://clashcalc.com/ore-calculator/',
                    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
            ]
        };
        const multiCardText = formatIncidentCard(multiBatch);
        assert.equal(multiCardText.includes('2 error(s) captured within 15-second window'), true);
        assert.equal(multiCardText.includes('[Issue 1 of 2]'), true);
        assert.equal(multiCardText.includes('[Issue 2 of 2]'), true);
    });

    test('flushAllPendingBatches empties all pending user batches across users', async () => {
        queueClientErrorAlert({
            userId: 'user-batch-1',
            environment: 'clashcalc.com',
            message: 'Error one for batch test',
            userAgent: 'Mozilla/5.0'
        });
        queueClientErrorAlert({
            userId: 'user-batch-2',
            environment: 'clashcalc.com',
            message: 'Error two for batch test',
            userAgent: 'Mozilla/5.0'
        });
        assert.equal(pendingUserBatches.size, 2);
        await flushAllPendingBatches();
        assert.equal(pendingUserBatches.size, 0);
    });
});
