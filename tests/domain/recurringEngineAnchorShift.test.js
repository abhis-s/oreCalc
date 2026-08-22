import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

if (typeof globalThis.HTMLElement === 'undefined') {
    globalThis.HTMLElement = class {};
}
if (typeof globalThis.customElements === 'undefined') {
    globalThis.customElements = { define: () => {}, get: () => {} };
}
if (typeof globalThis.localStorage === 'undefined') {
    globalThis.localStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {}
    };
}
if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        __ENV__: { APP_VERSION: '2.1.0' },
        localStorage: globalThis.localStorage,
        location: { hostname: 'localhost', href: 'http://localhost/' },
        matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
        addEventListener: () => {},
        removeEventListener: () => {},
        scrollTo: () => {},
        getComputedStyle: () => ({ display: 'block' }),
        requestAnimationFrame: (cb) => { cb(); return 1; },
        cancelAnimationFrame: () => {}
    };
} else {
    if (!globalThis.window.location) globalThis.window.location = { hostname: 'localhost', href: 'http://localhost/' };
    if (!globalThis.window.localStorage) globalThis.window.localStorage = globalThis.localStorage;
    if (!globalThis.window.addEventListener) globalThis.window.addEventListener = () => {};
    if (!globalThis.window.removeEventListener) globalThis.window.removeEventListener = () => {};
    if (!globalThis.window.matchMedia) globalThis.window.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
}

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        dispatchEvent: () => {},
        addEventListener: () => {},
        removeEventListener: () => {}
    };
}

const { state, getDefaultState } = await import('../../js/core/state.js');
const { checkAndGenerateRecurringChips, reindexCalendarChips, calculateCumulativeOres } = await import('../../js/utils/chipManager.js');

describe('Recurring Engine and Anchor Shift Domain Suite', () => {
    beforeEach(() => {
        Object.assign(state, getDefaultState());
    });

    test('checkAndGenerateRecurringChips generates recurring custom chips based on settings', () => {
        state.planner.calendar.customChipSettings = {
            starBonus: { monthly: true, count: 2, multiplier: '4x' },
            shopOffers: { monthly: true, shiny: 1000, glowy: 100, starry: 10 },
            gemTrader: { weekly: true, shiny: 500, glowy: 50, starry: 5 },
            eventTrader: { monthly: false, shiny: 0, glowy: 0, starry: 0 },
            raidMedalTrader: { weekly: true, shiny: 600, glowy: 60, starry: 6 },
            eventPass: { monthly: false, shiny: 0, glowy: 0, starry: 0 },
            clanWar: { monthly: true, count: 3, result: 'win', shiny: 200, glowy: 20, starry: 2 },
            cwl: { monthly: true, count: 1, result: 'win', shiny: 500, glowy: 50, starry: 5 },
            prospector: { monthly: false, count: 0, shiny: 0, glowy: 0, starry: 0 }
        };
        state.planner.calendar.lastRecurringProcessed = null;

        checkAndGenerateRecurringChips();

        const customChips = state.planner.calendar.customChips;
        assert.ok(customChips.length > 0);

        const sbChips = customChips.filter(c => c.type === 'starBonus4x');
        assert.equal(sbChips.length, 2);
        assert.equal(sbChips[0].isRecurring, true);
        assert.equal(sbChips[0].isCustom, true);

        const gemChips = customChips.filter(c => c.type === 'gemTrader');
        assert.equal(gemChips.length, 4);

        const raidChips = customChips.filter(c => c.type === 'raidMedalTrader');
        assert.equal(raidChips.length, 4);
    });

    test('reindexCalendarChips re-orders chips chronologically per month', () => {
        state.planner.calendar.dates['2026-08'] = {
            '20': ['clanWar-01-2026-08-cal'],
            '05': ['clanWar-02-2026-08-cal']
        };

        const changed = reindexCalendarChips('clanWar');
        assert.equal(changed, true);

        assert.deepEqual(state.planner.calendar.dates['2026-08']['05'], ['clanWar-01-2026-08-cal']);
        assert.deepEqual(state.planner.calendar.dates['2026-08']['20'], ['clanWar-02-2026-08-cal']);
    });

    test('calculateCumulativeOres aggregates baseline star bonus and custom chip data overrides', () => {
        const today = new Date();
        const nextMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 20));
        const nextMonthYearKey = `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, '0')}`;
        const initialOres = { shiny: 1000, glowy: 100, starry: 10 };

        state.planner.calendar.dates[nextMonthYearKey] = {
            '10': ['custom-extra-12345-cal']
        };
        state.planner.calendar.customChipData = {
            'custom-extra-12345-cal': {
                shiny: 5000,
                glowy: 500,
                starry: 50
            }
        };

        const cumulative = calculateCumulativeOres(nextMonth, initialOres);

        assert.equal(cumulative.shiny, 6000);
        assert.equal(cumulative.glowy, 600);
        assert.equal(cumulative.starry, 60);
    });

    test('checkAndGenerateRecurringChips saves lastRecurringProcessed in YYYY-MM format', () => {
        state.planner.calendar.customChipSettings = {
            starBonus: { monthly: false },
            shopOffers: { monthly: false },
            gemTrader: { weekly: false },
            eventTrader: { monthly: false },
            raidMedalTrader: { weekly: false },
            eventPass: { monthly: false },
            clanWar: { monthly: false },
            cwl: { monthly: false },
            prospector: { monthly: false }
        };
        state.planner.calendar.lastRecurringProcessed = null;

        checkAndGenerateRecurringChips();

        assert.match(
            state.planner.calendar.lastRecurringProcessed,
            /^\d{4}-\d{2}$/
        );
    });

    test('autoPlaceChipsByHistory finds past month chips using YYYY-MM lookup key', async () => {
        const { autoPlaceChipsByHistory } = await import('../../js/utils/autoPlaceHistoryPlacer.js');

        // Historical placement fixture (2026-07-12)
        state.planner.calendar.dates['2026-07'] = {
            '12': ['shopOffers-01-2026-07-cal']
        };

        const filteredUnplacedChips = [
            { type: 'shopOffers', instance: 1, schedule: { type: 'monthly', dateStart: 1 } }
        ];
        const newCalendarDates = { '2026-08': {} };
        const placedByHistory = new Set();

        autoPlaceChipsByHistory(
            filteredUnplacedChips,
            2026,
            7, // August (0-indexed)
            '2026-08',
            newCalendarDates,
            12,
            placedByHistory
        );

        assert.ok(placedByHistory.has('shopOffers-1'));
        assert.ok(newCalendarDates['2026-08']['12']);
        assert.ok(
            newCalendarDates['2026-08']['12'].some(id => id.startsWith('shopOffers-01-2026-08'))
        );
    });
});
