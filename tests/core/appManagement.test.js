import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    STARTUP_ROUTE_OPTIONS,
    formatStorageSize,
    getStartupRoutePreference,
    setStartupRoutePreference,
    detectBrowserEngine,
    detectOperatingSystem,
    getEnvironmentDiagnostics,
    isWakeLockSupported,
    getWakeLockPreference,
    toggleWakeLock,
    initScreenWakeLock
} from '../../js/services/appManagementService.js';
import {
    getStartupOptionLabel,
    formatStartupSubViewLabel,
    renderStorageUsage,
    formatDiagnosticsReport
} from '../../js/components/appManagement/appManagementDisplay.js';
import {
    getHapticsPreference,
    setHapticsPreference,
    isHapticsSupported
} from '../../js/services/hapticService.js';
import { loadTranslations } from '../../js/i18n/translator.js';
import { state } from '../../js/core/state.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
const projectRoot = path.resolve(__dirname, '../..');
const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));

before(async () => {
    globalThis.fetch = async (url) => {
        const urlStr = String(url);
        if (urlStr.includes('/en.json')) {
            return { ok: true, json: async () => enJson };
        }
        return { ok: false };
    };
    state.uiSettings = { language: 'en' };
    await loadTranslations('en');
});

describe('App Management Service & Storage Architecture', () => {
    beforeEach(async () => {
        state.uiSettings = { language: 'en' };
        await loadTranslations('en');
    });

    test('STARTUP_ROUTE_OPTIONS contains exactly 8 canonical destinations', () => {
        assert.equal(STARTUP_ROUTE_OPTIONS.length, 8);
        const expectedIds = [
            'hub',
            'ore-calc',
            'ore-calc-equipment',
            'ore-calc-income',
            'ore-calc-planner',
            'hero-journey',
            'damage-calc-zapquake',
            'damage-calc-cluster'
        ];
        assert.deepEqual(STARTUP_ROUTE_OPTIONS.map(o => o.id), expectedIds);
    });

    test('formatStorageSize formats byte quantities accurately without device capacity', () => {
        assert.equal(formatStorageSize(0), null);
        assert.equal(formatStorageSize(-50), null);
        assert.equal(formatStorageSize(NaN), null);
        assert.equal(formatStorageSize(51200), '50.0 KB');
        assert.equal(formatStorageSize(26004684), '24.8 MB');
    });

    test('renderStorageUsage displays formatted size or fallback when unavailable', () => {
        const targetEl = { textContent: '' };
        renderStorageUsage(targetEl, '7.3 MB');
        assert.equal(targetEl.textContent, '7.3 MB used by ClashCalc');

        renderStorageUsage(targetEl, null);
        assert.equal(targetEl.textContent, 'Unable to calculate storage footprint');
    });

    test('detectOperatingSystem normalizes platform strings across browsers', () => {
        // 1. Client Hints
        const restoreNavCH = mockGlobal('navigator', {
            userAgentData: { platform: 'macOS' }
        });
        try {
            assert.equal(detectOperatingSystem(), 'macOS');
        } finally {
            restoreNavCH();
        }

        // 2. Safari macOS (MacIntel without touch points)
        const restoreNavSafari = mockGlobal('navigator', {
            platform: 'MacIntel',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
            maxTouchPoints: 0
        });
        try {
            assert.equal(detectOperatingSystem(), 'macOS');
        } finally {
            restoreNavSafari();
        }

        // 3. iPadOS desktop UA (MacIntel with touch points)
        const restoreNaviPad = mockGlobal('navigator', {
            platform: 'MacIntel',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)',
            maxTouchPoints: 5
        });
        try {
            assert.equal(detectOperatingSystem(), 'iOS');
        } finally {
            restoreNaviPad();
        }

        // 4. Windows Firefox (Win32)
        const restoreNavWin = mockGlobal('navigator', {
            platform: 'Win32',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
        });
        try {
            assert.equal(detectOperatingSystem(), 'Windows');
        } finally {
            restoreNavWin();
        }

        // 5. Android
        const restoreNavAndroid = mockGlobal('navigator', {
            platform: 'Linux aarch64',
            userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
        });
        try {
            assert.equal(detectOperatingSystem(), 'Android');
        } finally {
            restoreNavAndroid();
        }
    });

    test('startup route preferences validate and persist valid destinations only', () => {
        const mockStorage = new Map();
        globalThis.localStorage = {
            getItem: (key) => mockStorage.get(key) || null,
            setItem: (key, val) => mockStorage.set(key, String(val)),
            removeItem: (key) => mockStorage.delete(key)
        };

        assert.equal(getStartupRoutePreference(), '/');

        const validResult = setStartupRoutePreference('/ore-calculator/#planner');
        assert.equal(validResult, true);
        assert.equal(getStartupRoutePreference(), '/ore-calculator/#planner');
        assert.equal(state.uiSettings.startupRoute, '/ore-calculator/#planner');
        assert.ok(state.timestamp);
        assert.equal(mockStorage.has('clashcalc_startup_route'), false);

        const invalidResult = setStartupRoutePreference('/malicious-route');
        assert.equal(invalidResult, false);
        assert.equal(getStartupRoutePreference(), '/ore-calculator/#planner');
        assert.equal(mockStorage.has('clashcalc_startup_route'), false);
    });

    test('detectBrowserEngine classifies common browser user agent strings accurately', () => {
        const chromeUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        assert.equal(detectBrowserEngine(chromeUa), 'Chromium');

        const safariUa = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15';
        assert.equal(detectBrowserEngine(safariUa), 'WebKit');

        const firefoxUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';
        assert.equal(detectBrowserEngine(firefoxUa), 'Gecko');

        assert.equal(detectBrowserEngine(''), 'Unknown');
    });

    test('getEnvironmentDiagnostics returns complete environment metadata contract in server and client environments', () => {
        // 1. Server fallback contract
        const serverDiag = getEnvironmentDiagnostics();
        assert.equal(serverDiag.platform, 'Server');
        assert.equal(serverDiag.engine, 'Unknown');
        assert.equal(serverDiag.displayMode, 'browser');
        assert.equal(serverDiag.isOnline, true);
        assert.equal(serverDiag.viewport, 'Unknown');

        // 2. Client environment with mock window and navigator
        const restoreWindow = mockGlobal('window', {
            innerWidth: 1280,
            innerHeight: 800,
            matchMedia: (q) => ({ matches: q === '(display-mode: window-controls-overlay)' })
        });
        const restoreNav = mockGlobal('navigator', {
            userAgentData: { platform: 'macOS' },
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            onLine: true
        });
        try {
            const clientDiag = getEnvironmentDiagnostics();
            assert.equal(clientDiag.platform, 'macOS');
            assert.equal(clientDiag.engine, 'Chromium');
            assert.equal(clientDiag.displayMode, 'window-controls-overlay');
            assert.equal(clientDiag.isOnline, true);
            assert.equal(clientDiag.viewport, '1280 x 800');
        } finally {
            restoreNav();
            restoreWindow();
        }
    });

    test('screen wake lock service manages preferences and handles unsupported environments', async () => {
        const mockStorage = new Map();
        const restoreStorage = mockGlobal('localStorage', {
            getItem: (key) => mockStorage.get(key) || null,
            setItem: (key, val) => mockStorage.set(key, String(val)),
            removeItem: (key) => mockStorage.delete(key)
        });

        // In Node without navigator.wakeLock
        assert.equal(isWakeLockSupported(), false);
        assert.equal(getWakeLockPreference(), false);

        // When supported with mock navigator.wakeLock
        let released = false;
        let requestedType = '';
        const mockSentinel = {
            release: async () => { released = true; },
            addEventListener: () => {}
        };
        const restoreNav = mockGlobal('navigator', {
            wakeLock: {
                request: async (type) => {
                    requestedType = type;
                    return mockSentinel;
                }
            }
        });

        try {
            assert.equal(isWakeLockSupported(), true);

            // Enabling persists and requests screen lock
            const enabledResult = await toggleWakeLock(true);
            assert.equal(enabledResult, true);
            assert.equal(requestedType, 'screen');
            assert.equal(getWakeLockPreference(), true);
            assert.equal(state.uiSettings.screenWakeLock, true);
            assert.equal(mockStorage.has('clashcalc_screen_wake_lock'), false);

            // Global init respects preference
            const initResult = await initScreenWakeLock();
            assert.equal(initResult, true);

            // Disabling releases sentinel and persists false
            const disabledResult = await toggleWakeLock(false);
            assert.equal(disabledResult, false);
            assert.equal(released, true);
            assert.equal(getWakeLockPreference(), false);
            assert.equal(state.uiSettings.screenWakeLock, false);
            assert.equal(mockStorage.has('clashcalc_screen_wake_lock'), false);
        } finally {
            restoreNav();
            restoreStorage();
        }
    });
});

describe('App Management Display & Label Concatenation', () => {
    beforeEach(async () => {
        state.uiSettings = { language: 'en' };
        await loadTranslations('en');
    });

    test('startup view labels resolve canonical tool and composite sub-view titles', () => {
        const eqLabel = formatStartupSubViewLabel('nav.equipment');
        assert.ok(eqLabel.includes('OreCalc') && eqLabel.includes('Equipment'));

        const incomeLabel = formatStartupSubViewLabel('nav.income');
        assert.ok(incomeLabel.includes('OreCalc') && incomeLabel.includes('Income'));

        const plannerLabel = formatStartupSubViewLabel('nav.planner');
        assert.ok(plannerLabel.includes('OreCalc') && plannerLabel.includes('Planner'));

        for (const opt of STARTUP_ROUTE_OPTIONS) {
            const label = getStartupOptionLabel(opt.id);
            assert.ok(label && typeof label === 'string' && label.length > 0, `Expected valid label for ${opt.id}`);
        }
    });

    test('formatDiagnosticsReport creates markdown summary and strictly omits storage data', () => {
        const mockDiagnostics = {
            platform: 'macOS',
            engine: 'Chromium',
            displayMode: 'standalone',
            viewport: '1200 x 900',
            isOnline: true
        };
        const report = formatDiagnosticsReport(mockDiagnostics, 'v3.0.0');

        assert.ok(report.includes('### ClashCalc Diagnostics Report'));
        assert.ok(report.includes('- **App Version**: v3.0.0'));
        assert.ok(report.includes('- **Operating System**: macOS'));
        assert.ok(report.includes('- **Browser Engine**: Chromium'));
        assert.ok(report.includes('- **Display Mode**: standalone'));
        assert.ok(report.includes('- **Window Viewport**: 1200 x 900'));
        assert.ok(report.includes('- **Network Status**: Online'));

        // Strictly verify zero storage info is included
        assert.ok(!report.toLowerCase().includes('storage'));
        assert.ok(!report.toLowerCase().includes('mb'));
        assert.ok(!report.toLowerCase().includes('kb'));
        assert.ok(!report.toLowerCase().includes('bytes'));
        assert.ok(!report.toLowerCase().includes('footprint'));
    });

    test('tactile haptics service manages preference persistence and capability check', () => {
        // Desktop environments lack physical vibration actuators and must return false
        const macChromeUa = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        const winChromeUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        const linuxDesktopUa = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        const androidUa = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

        const mockNavWithVibrate = {
            vibrate: () => true
        };
        const mockNavWithoutVibrate = {};

        assert.equal(isHapticsSupported(macChromeUa, mockNavWithVibrate), false, 'macOS desktop Chrome must be unsupported for tactile haptics');
        assert.equal(isHapticsSupported(winChromeUa, mockNavWithVibrate), false, 'Windows desktop Chrome must be unsupported for tactile haptics');
        assert.equal(isHapticsSupported(linuxDesktopUa, mockNavWithVibrate), false, 'Linux desktop Chrome must be unsupported for tactile haptics');
        assert.equal(isHapticsSupported(androidUa, mockNavWithVibrate), true, 'Android mobile Chrome with vibrate must be supported for tactile haptics');
        assert.equal(isHapticsSupported(androidUa, mockNavWithoutVibrate), false, 'Android without vibrate method must be unsupported');

        const mockStorage = new Map();
        globalThis.localStorage = {
            getItem: (key) => mockStorage.get(key) || null,
            setItem: (key, val) => mockStorage.set(key, String(val)),
            removeItem: (key) => mockStorage.delete(key)
        };

        // Defaults to true
        assert.equal(getHapticsPreference(), true);

        // Disabling persists false
        setHapticsPreference(false);
        assert.equal(getHapticsPreference(), false);
        assert.equal(state.uiSettings.hapticsEnabled, false);
        assert.equal(mockStorage.has('clashcalc_tactile_haptics'), false);

        // Enabling persists true
        setHapticsPreference(true);
        assert.equal(getHapticsPreference(), true);
        assert.equal(state.uiSettings.hapticsEnabled, true);
        assert.equal(mockStorage.has('clashcalc_tactile_haptics'), false);
    });
});
