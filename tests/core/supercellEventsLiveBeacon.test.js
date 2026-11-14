import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
    isEventPlaceholder,
    isSupercellEventLive
} from '../../js/domain/income/supercellEventsSchedule.js';
import { renderSupercellEvents } from '../../js/components/income/supercellEventsDisplay.js';
import { state } from '../../js/core/state.js';
import { loadTranslations } from '../../js/i18n/translator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));

describe('Supercell Events Live Beacon and Placeholder Architecture', () => {
    beforeEach(() => {
        state.uiSettings = { language: 'en' };
        globalThis.fetch = async (url) => {
            if (typeof url === 'string' && url.includes('/en.json')) {
                return { ok: true, json: async () => enJson };
            }
            return { ok: false, status: 404 };
        };
    });

    test('isSupercellEventLive accurately enforces tournament broadcast windows and suppresses off-air/placeholder periods', () => {
        const worldFinals = {
            name: 'World Finals',
            start: '2026-11-14T14:00:00Z',
            end: '2026-11-15T23:59:59Z',
            label: 'Nov 14, 15'
        };

        // Day 1 (Nov 14): Before 2pm UTC
        assert.equal(isSupercellEventLive(worldFinals, new Date('2026-11-14T13:59:59Z')), false);

        // Day 1: During broadcast (2pm - 11:59pm UTC)
        assert.equal(isSupercellEventLive(worldFinals, new Date('2026-11-14T14:00:00Z')), true);
        assert.equal(isSupercellEventLive(worldFinals, new Date('2026-11-14T18:30:00Z')), true);
        assert.equal(isSupercellEventLive(worldFinals, new Date('2026-11-14T23:59:00Z')), true);

        // Overnight gap between Day 1 and Day 2 (off-air, suppressed)
        assert.equal(isSupercellEventLive(worldFinals, new Date('2026-11-15T00:01:00Z')), false);
        assert.equal(isSupercellEventLive(worldFinals, new Date('2026-11-15T08:00:00Z')), false);
        assert.equal(isSupercellEventLive(worldFinals, new Date('2026-11-15T13:59:59Z')), false);

        // Day 2 (Nov 15): During broadcast (2pm - 11:59pm UTC)
        assert.equal(isSupercellEventLive(worldFinals, new Date('2026-11-15T14:00:00Z')), true);
        assert.equal(isSupercellEventLive(worldFinals, new Date('2026-11-15T20:00:00Z')), true);
        assert.equal(isSupercellEventLive(worldFinals, new Date('2026-11-15T23:59:59Z')), true);

        // After tournament ends
        assert.equal(isSupercellEventLive(worldFinals, new Date('2026-11-16T00:00:01Z')), false);

        // Suppressed for full-month placeholders and missing dates
        const placeholder = { name: 'World Finals', start: '2026-11-01T00:00:00Z', end: '2026-11-30T23:59:59Z', label: 'November' };
        assert.equal(isEventPlaceholder(placeholder), true);
        assert.equal(isSupercellEventLive(placeholder, new Date('2026-11-14T15:00:00Z')), false);
        assert.equal(isSupercellEventLive({ name: 'TBD Event', label: 'TBD' }, new Date('2026-11-14T15:00:00Z')), false);
    });

    test('renderSupercellEvents renders table markup with live beacon during broadcast and sub-day countdown before broadcast', async () => {
        await loadTranslations('en');

        let container = { innerHTML: '' };
        globalThis.document = {
            getElementById: (id) => (id === 'supercell-events-container' ? container : null)
        };

        // 1. Render table with non-live reference date (May 1, 2026)
        renderSupercellEvents(new Date('2026-05-01T12:00:00Z'));
        assert.ok(container.innerHTML.includes('supercell-events-table'));
        assert.ok(container.innerHTML.includes('14') && container.innerHTML.includes('15'));
        assert.equal(container.innerHTML.includes('live-beacon-dot'), false);
        assert.equal(container.innerHTML.includes('watch-live-btn'), false);

        // 2. Render during active broadcast window (e.g. Jun 27, 2026 at 18:00 UTC)
        renderSupercellEvents(new Date('2026-06-27T18:00:00Z'));
        assert.equal(container.innerHTML.includes('live-beacon-dot'), true);
        assert.equal(container.innerHTML.includes('watch-live-btn'), true);

        // 3. Clean day count for events >= 1 day away (4 days before Jun 27)
        renderSupercellEvents(new Date('2026-06-23T16:00:00Z'));
        assert.ok(container.innerHTML.includes('<span class="countdown-text">In 4 days</span>'));
        assert.equal(container.innerHTML.includes('day(s)'), false);

        // 4. Sub-day HH:MM:SS for events < 24 hours away (5h 30m 10s before Jun 27 event)
        renderSupercellEvents(new Date('2026-06-27T10:29:50Z'));
        assert.ok(container.innerHTML.includes('<span class="countdown-text" data-countdown-target="1782576000000">05:30:10</span>'));
    });

    test('renderSupercellEvents live countdown timer ticks down when income-tab has is-active class and pauses when inactive', async () => {
        await loadTranslations('en');

        let intervalCallback = null;
        let cleared = false;
        const originalSetInterval = globalThis.setInterval;
        const originalClearInterval = globalThis.clearInterval;
        const originalDocument = globalThis.document;
        const originalWindow = globalThis.window;

        try {
            globalThis.window = globalThis;
            globalThis.setInterval = (fn) => {
                intervalCallback = fn;
                return 12345;
            };
            globalThis.clearInterval = () => {
                cleared = true;
            };

            const mockSpan = {
                textContent: '01:30:00',
                getAttribute: (attr) => (attr === 'data-countdown-target' ? String(Date.now() + 5400000) : null)
            };
            const mockContainer = {
                innerHTML: '',
                querySelectorAll: (sel) => (sel === '[data-countdown-target]' ? [mockSpan] : [])
            };
            const mockIncomeTab = {
                classList: {
                    contains: (cls) => cls === 'is-active'
                }
            };
            globalThis.document = {
                body: {
                    contains: () => true
                },
                getElementById: (id) => {
                    if (id === 'supercell-events-container') return mockContainer;
                    if (id === 'income-tab') return mockIncomeTab;
                    return null;
                }
            };

            // Calling without referenceDate triggers real-time countdown setup
            renderSupercellEvents();
            assert.ok(typeof intervalCallback === 'function', 'Expected countdown interval callback to be registered');

            // 1. Ticking with income-tab having is-active updates textContent and does NOT clear interval
            intervalCallback();
            assert.equal(cleared, false, 'Timer must not be cleared while income-tab has is-active');
            assert.ok(mockSpan.textContent.startsWith('01:29:') || mockSpan.textContent.startsWith('01:30:'));

            // 2. Switching away from income-tab (removing is-active) stops countdown timer
            mockIncomeTab.classList.contains = () => false;
            intervalCallback();
            assert.equal(cleared, true, 'Timer must be cleared when income-tab loses is-active');
        } finally {
            globalThis.setInterval = originalSetInterval;
            globalThis.clearInterval = originalClearInterval;
            globalThis.document = originalDocument;
            globalThis.window = originalWindow;
        }
    });
});
