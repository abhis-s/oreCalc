/**
 * Feature Domain Test Suite: Player Data Refresh Scenarios & 10-Minute Cooldown Window.
 * Asserts automated background refresh triggers (Boot, Visibility Change, Village Switch)
 * and manual on-demand triggers strictly honor the 10-minute staleness window without DOM dependencies.
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));

/** Mock DOM Event Target */
class MockEventTarget {
    constructor() {
        this.listeners = new Map();
    }
    addEventListener(event, fn) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(fn);
    }
    removeEventListener(event, fn) {
        const arr = this.listeners.get(event) || [];
        this.listeners.set(event, arr.filter(f => f !== fn));
    }
    dispatchEvent(event) {
        const type = typeof event === 'string' ? event : event?.type;
        const arr = this.listeners.get(type) || [];
        for (const fn of arr) {
            fn(event);
        }
    }
}

describe('Player Refresh Scenarios & 10-Minute Staleness Window Suite', async () => {
    /** @type {Map<string, string>} */
    const mockStorage = new Map();
    let originalDateNow;
    let originalFetch;
    let mockCurrentTime = 1700000000000;
    /** @type {string[]} */
    let fetchCalls = [];

    // Set up global mocks before importing modules
    globalThis.localStorage = {
        getItem: (k) => mockStorage.get(k) || null,
        setItem: (k, v) => mockStorage.set(k, String(v)),
        removeItem: (k) => mockStorage.delete(k),
        clear: () => mockStorage.clear(),
        key: (i) => Array.from(mockStorage.keys())[i] || null,
        get length() { return mockStorage.size; }
    };

    const mockDoc = new MockEventTarget();
    mockDoc.visibilityState = 'visible';
    const createMockEl = () => ({
        id: '',
        className: '',
        style: {},
        innerHTML: '',
        appendChild: () => {},
        setAttribute: () => {},
        getAttribute: () => null,
        contains: () => true,
        addEventListener: () => {},
        removeEventListener: () => {},
        classList: { add: () => {}, remove: () => {}, contains: () => false }
    });
    mockDoc.createElement = createMockEl;
    mockDoc.body = createMockEl();
    mockDoc.getElementById = (id) => createMockEl();
    mockDoc.querySelector = (sel) => createMockEl();
    mockDoc.querySelectorAll = (sel) => [];
    globalThis.document = mockDoc;

    const mockWin = new MockEventTarget();
    mockWin.location = { pathname: '/ore-calculator/', href: '', search: '' };
    globalThis.window = mockWin;
    globalThis.requestAnimationFrame = (cb) => { cb(); return 1; };
    globalThis.cancelAnimationFrame = () => {};

    originalDateNow = Date.now;
    Date.now = () => mockCurrentTime;

    originalFetch = globalThis.fetch;
    const mockFetch = async (url) => {
        const urlStr = String(url);
        if (urlStr.includes('/proxy/players/')) {
            const tagMatch = urlStr.match(/\/proxy\/players\/([A-Z0-9]+)/i);
            const tag = tagMatch ? tagMatch[1] : 'UNKNOWN';
            fetchCalls.push(tag);
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    tag: `#${tag}`,
                    name: `Player ${tag}`,
                    townHallLevel: 16,
                    heroes: [
                        { name: 'Barbarian King', level: 95 }
                    ],
                    heroEquipment: []
                })
            };
        }
        if (urlStr.includes('en.json')) {
            return { ok: true, status: 200, json: async () => enJson };
        }
        return { ok: true, status: 200, json: async () => ({}) };
    };
    globalThis.fetch = mockFetch;

    const { state } = await import('../../js/core/state.js');
    const { loadTranslations } = await import('../../js/i18n/translator.js');
    await loadTranslations('en');

    const {
        ACCOUNT_REFRESH_COOLDOWN_MS,
        getPlayerLastRefreshed,
        setPlayerLastRefreshed,
        isPlayerRefreshStale
    } = await import('../../js/core/playerRefreshThrottler.js');
    const {
        refreshActivePlayerData,
        initAutoRefreshTriggers
    } = await import('../../js/components/player/playerRefreshController.js');
    const { handlePlayerSelection } = await import('../../js/components/player/playerDropdownInputs.js');
    const { dom } = await import('../../js/dom/domElements.js');

    beforeEach(() => {
        mockStorage.clear();
        mockCurrentTime = 1700000000000;
        fetchCalls = [];
        Date.now = () => mockCurrentTime;
        globalThis.fetch = mockFetch;

        state.allPlayersData = {};
        state.savedPlayerTags = ['VILLAGE1'];
        state.uiSettings = { language: 'en', currency: { code: 'USD' } };
    });

    afterEach(() => {
        Date.now = originalDateNow;
        globalThis.fetch = originalFetch;
    });

    test('Scenario 1: App Boot / Startup Initial Refresh Logic', async () => {
        const activeTag = 'VILLAGE1';
        state.savedPlayerTags = [activeTag];

        // Case 1A: Never refreshed (lastRefreshedAt = 0) -> Stale -> Refresh triggered
        setPlayerLastRefreshed(activeTag, 0);
        assert.equal(isPlayerRefreshStale(activeTag), true, 'Uninitialized player must be stale');

        const result1 = await refreshActivePlayerData({ background: true });
        assert.equal(result1.success, true);
        assert.equal(fetchCalls.length, 1);
        assert.equal(fetchCalls[0], 'VILLAGE1');
        assert.equal(getPlayerLastRefreshed(activeTag), mockCurrentTime);

        // Case 1B: Within 10-minute cooldown window (4 minutes elapsed) -> Fresh -> Skipped
        fetchCalls = [];
        mockCurrentTime += 4 * 60 * 1000; // +4 mins
        assert.equal(isPlayerRefreshStale(activeTag), false, '4 minutes elapsed must be fresh');

        const result2 = await refreshActivePlayerData({ background: true });
        assert.equal(result2.skipped, true);
        assert.equal(fetchCalls.length, 0, 'No API call made when fresh');

        // Case 1C: Past 10-minute cooldown window (11 minutes elapsed) -> Stale -> Refreshed
        fetchCalls = [];
        mockCurrentTime += 7 * 60 * 1000; // now +11 mins from initial refresh
        assert.equal(isPlayerRefreshStale(activeTag), true, '11 minutes elapsed must be stale');

        const result3 = await refreshActivePlayerData({ background: true });
        assert.equal(result3.success, true);
        assert.equal(fetchCalls.length, 1);
        assert.equal(getPlayerLastRefreshed(activeTag), mockCurrentTime);

        // Case 1D: Guest profile (DEFAULT0) -> Never refreshed
        fetchCalls = [];
        state.savedPlayerTags = ['DEFAULT0'];
        const guestResult = await refreshActivePlayerData({ background: true });
        assert.equal(guestResult.success, false);
        assert.equal(fetchCalls.length, 0, 'Guest account must never trigger API fetch');
    });

    test('Scenario 2: Window / Tab Visibility Change Hydration', async () => {
        initAutoRefreshTriggers();
        const activeTag = 'VILLAGE1';
        state.savedPlayerTags = [activeTag];

        // Stale timestamp: 15 minutes ago
        setPlayerLastRefreshed(activeTag, mockCurrentTime - (15 * 60 * 1000));
        fetchCalls = [];

        // Tab hidden -> Should not refresh
        mockDoc.visibilityState = 'hidden';
        mockDoc.dispatchEvent('visibilitychange');
        await new Promise(r => setTimeout(r, 15));
        assert.equal(fetchCalls.length, 0, 'Hidden tab must not trigger refresh');

        // Tab visible -> Should trigger background refresh
        mockDoc.visibilityState = 'visible';
        mockDoc.dispatchEvent('visibilitychange');
        await new Promise(r => setTimeout(r, 15));
        assert.equal(fetchCalls.length, 1, 'Visible tab with stale data must trigger refresh');
        assert.equal(fetchCalls[0], activeTag);

        // Tab visible again 2 minutes later -> Fresh -> Should NOT trigger
        fetchCalls = [];
        mockCurrentTime += 2 * 60 * 1000;
        mockDoc.dispatchEvent('visibilitychange');
        await new Promise(r => setTimeout(r, 15));
        assert.equal(fetchCalls.length, 0, 'Visible tab within cooldown must not trigger refresh');

        // Rapid visibility toggling (5 times in 5 seconds)
        for (let i = 0; i < 5; i++) {
            mockDoc.dispatchEvent('visibilitychange');
        }
        await new Promise(r => setTimeout(r, 15));
        assert.equal(fetchCalls.length, 0, 'Rapid visibility events must be throttled');
    });

    test('Scenario 3: Multi-Village Switching Stale Evaluation', async () => {
        const villageA = 'VILLAGEA';
        const villageB = 'VILLAGEB';
        const villageC = 'VILLAGEC';

        // Set up in-memory player data so local switch is instant
        state.allPlayersData[villageA] = { heroes: { bk: { level: 90 } }, lastRefreshedAt: mockCurrentTime };
        state.allPlayersData[villageB] = { heroes: { bk: { level: 80 } }, lastRefreshedAt: mockCurrentTime - (20 * 60 * 1000) }; // Stale (20m ago)
        state.allPlayersData[villageC] = { heroes: { bk: { level: 70 } }, lastRefreshedAt: mockCurrentTime - (3 * 60 * 1000) };  // Fresh (3m ago)
        state.savedPlayerTags = [villageA, villageB, villageC];

        // Switch to Village B (stale)
        fetchCalls = [];
        await handlePlayerSelection(villageB);
        await new Promise(r => setTimeout(r, 20));

        assert.equal(state.savedPlayerTags[0], villageB, 'Active village must switch to Village B');
        assert.equal(fetchCalls.length, 1, 'Stale target village must trigger background refresh');
        assert.equal(fetchCalls[0], villageB);

        // Switch to Village C (fresh, 3m ago)
        fetchCalls = [];
        await handlePlayerSelection(villageC);
        await new Promise(r => setTimeout(r, 20));

        assert.equal(state.savedPlayerTags[0], villageC, 'Active village must switch to Village C');
        assert.equal(fetchCalls.length, 0, 'Fresh target village (< 10m) must NOT trigger background refresh');
    });

    test('Scenario 4: Explicit Manual Force Triggers Bypass Cooldown', async () => {
        const activeTag = 'VILLAGE1';
        state.savedPlayerTags = [activeTag];

        // Just refreshed 30 seconds ago
        setPlayerLastRefreshed(activeTag, mockCurrentTime - 30000);
        assert.equal(isPlayerRefreshStale(activeTag), false, '30 seconds ago is fresh');

        // Standard automated refresh would skip:
        const autoResult = await refreshActivePlayerData({ background: true });
        assert.equal(autoResult.skipped, true);
        assert.equal(fetchCalls.length, 0);

        // Manual user trigger (force: true from Pull-to-Refresh or Spotright or Dropdown)
        const manualResult = await refreshActivePlayerData({ force: true, background: false });
        assert.equal(manualResult.success, true);
        assert.equal(fetchCalls.length, 1, 'Manual force trigger must bypass cooldown');
        assert.equal(getPlayerLastRefreshed(activeTag), mockCurrentTime);

        // Immediately after, automatic triggers observe the new timestamp and respect cooldown:
        fetchCalls = [];
        mockCurrentTime += 60000; // 1 min later
        const followUpAuto = await refreshActivePlayerData({ background: true });
        assert.equal(followUpAuto.skipped, true);
        assert.equal(fetchCalls.length, 0, 'Subsequent checks must observe fresh 10m window');
    });

    test('Scenario 5: 10-Minute Boundary Threshold & Clock Skew Guard', () => {
        const tag = 'VILLAGE1';
        const cooldown = ACCOUNT_REFRESH_COOLDOWN_MS; // 600,000 ms

        // Exactly 599,000 ms (9m 59s) -> Fresh
        setPlayerLastRefreshed(tag, mockCurrentTime - 599000);
        assert.equal(isPlayerRefreshStale(tag, cooldown), false, '9m 59s must be fresh');

        // Exactly 600,000 ms (10m 00s) -> Stale
        setPlayerLastRefreshed(tag, mockCurrentTime - 600000);
        assert.equal(isPlayerRefreshStale(tag, cooldown), true, '10m 00s must be stale');

        // Exactly 601,000 ms (10m 01s) -> Stale
        setPlayerLastRefreshed(tag, mockCurrentTime - 601000);
        assert.equal(isPlayerRefreshStale(tag, cooldown), true, '10m 01s must be stale');

        // Clock skew guard: Timestamp in future (> 60s ahead) -> Treated as stale
        setPlayerLastRefreshed(tag, mockCurrentTime + 120000);
        assert.equal(isPlayerRefreshStale(tag, cooldown), true, 'Future timestamp > 60s must be treated as stale');
    });

    test('Scenario 6: Complete DOM Decoupling Invariant', () => {
        // Assert header template has zero refresh-button elements
        const headerHtml = fs.readFileSync(path.join(projectRoot, 'partials/header.html'), 'utf8');
        assert.equal(headerHtml.includes('id="refresh-button"'), false, 'partials/header.html must not contain #refresh-button');

        // Assert header stylesheet has zero #refresh-button rules
        const headerScss = fs.readFileSync(path.join(projectRoot, 'css/layout/_header.scss'), 'utf8');
        assert.equal(headerScss.includes('#refresh-button'), false, 'css/layout/_header.scss must not contain #refresh-button');

        // Assert DOM cache has zero refreshButton binding
        assert.equal(dom?.controls?.refreshButton, undefined, 'dom.controls must not hold refreshButton reference');
    });
});
