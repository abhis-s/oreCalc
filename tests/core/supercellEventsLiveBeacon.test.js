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

    test('isEventPlaceholder identifies full-month placeholders and missing dates', () => {
        // Defensive guards for null, undefined, non-objects
        assert.equal(isEventPlaceholder(null), true);
        assert.equal(isEventPlaceholder(undefined), true);
        assert.equal(isEventPlaceholder('invalid'), true);

        // Missing start or end date
        assert.equal(isEventPlaceholder({ name: 'World Finals' }), true);
        assert.equal(isEventPlaceholder({ name: 'World Finals', start: null, end: null }), true);
        assert.equal(isEventPlaceholder({ name: 'World Finals', start: 'invalid', end: 'invalid' }), true);

        // Explicit placeholder flags
        assert.equal(isEventPlaceholder({ name: 'Event', start: '2026-11-14T00:00:00Z', end: '2026-11-15T23:59:59Z', isPlaceholder: true }), true);
        assert.equal(isEventPlaceholder({ name: 'Event', start: '2026-11-14T00:00:00Z', end: '2026-11-15T23:59:59Z', hasSpecificDates: false }), true);

        // Full-month placeholder span without specific dates
        const fullMonthPlaceholder = {
            name: 'World Finals',
            start: '2026-11-01T00:00:00Z',
            end: '2026-11-30T23:59:59Z',
            label: 'November'
        };
        assert.equal(isEventPlaceholder(fullMonthPlaceholder), true);

        // Specific announced 2-day date range (not a placeholder)
        const announcedWorldFinals = {
            name: 'World Finals',
            start: '2026-11-14T00:00:00Z',
            end: '2026-11-15T23:59:59Z',
            label: 'Nov 14, 15'
        };
        assert.equal(isEventPlaceholder(announcedWorldFinals), false);

        // Specific Monthly Finals weekend (not a placeholder)
        const monthlyFinals = {
            name: 'Monthly Finals',
            start: '2026-06-27T16:00:00Z',
            end: '2026-06-28T23:00:00Z',
            label: 'Jun 27, 28'
        };
        assert.equal(isEventPlaceholder(monthlyFinals), false);
    });

    test('isSupercellEventLive suppresses beacon for placeholder and undecided events', () => {
        const fullMonthPlaceholder = {
            name: 'World Finals',
            start: '2026-11-01T00:00:00Z',
            end: '2026-11-30T23:59:59Z',
            label: 'November'
        };

        // Suppressed throughout all days of the placeholder month
        assert.equal(isSupercellEventLive(fullMonthPlaceholder, new Date('2026-11-01T12:00:00Z')), false);
        assert.equal(isSupercellEventLive(fullMonthPlaceholder, new Date('2026-11-15T12:00:00Z')), false);
        assert.equal(isSupercellEventLive(fullMonthPlaceholder, new Date('2026-11-30T23:00:00Z')), false);

        // Undecided / TBD events
        const tbdEvent = { name: 'World Finals', label: 'TBD' };
        assert.equal(isSupercellEventLive(tbdEvent, new Date('2026-11-15T12:00:00Z')), false);
    });

    test('isSupercellEventLive illuminates beacon for full 24 hours of announced dates with unreleased daily hours', () => {
        const wfAnnounced = {
            name: 'World Finals',
            start: '2026-11-14T00:00:00Z',
            end: '2026-11-15T23:59:59Z',
            label: 'Nov 14, 15'
        };

        // Before event start
        assert.equal(isSupercellEventLive(wfAnnounced, new Date('2026-11-13T23:59:59Z')), false);

        // Day 1 (Nov 14) active throughout 24 hours
        assert.equal(isSupercellEventLive(wfAnnounced, new Date('2026-11-14T00:00:00Z')), true);
        assert.equal(isSupercellEventLive(wfAnnounced, new Date('2026-11-14T08:30:00Z')), true);
        assert.equal(isSupercellEventLive(wfAnnounced, new Date('2026-11-14T18:00:00Z')), true);
        assert.equal(isSupercellEventLive(wfAnnounced, new Date('2026-11-14T23:59:00Z')), true);

        // Day 2 (Nov 15) active throughout 24 hours
        assert.equal(isSupercellEventLive(wfAnnounced, new Date('2026-11-15T00:00:00Z')), true);
        assert.equal(isSupercellEventLive(wfAnnounced, new Date('2026-11-15T12:00:00Z')), true);
        assert.equal(isSupercellEventLive(wfAnnounced, new Date('2026-11-15T23:59:59Z')), true);

        // After event conclusion
        assert.equal(isSupercellEventLive(wfAnnounced, new Date('2026-11-16T00:00:01Z')), false);
    });

    test('isSupercellEventLive respects daily broadcast windows and suppresses off-air overnight gaps', () => {
        const monthlyFinals = {
            name: 'Monthly Finals',
            start: '2026-06-27T16:00:00Z',
            end: '2026-06-28T23:00:00Z',
            label: 'Jun 27, 28'
        };

        // Saturday Day 1: Before broadcast
        assert.equal(isSupercellEventLive(monthlyFinals, new Date('2026-06-27T15:59:59Z')), false);

        // Saturday Day 1: During broadcast (16:00 - 23:00 UTC)
        assert.equal(isSupercellEventLive(monthlyFinals, new Date('2026-06-27T16:00:00Z')), true);
        assert.equal(isSupercellEventLive(monthlyFinals, new Date('2026-06-27T19:30:00Z')), true);
        assert.equal(isSupercellEventLive(monthlyFinals, new Date('2026-06-27T23:00:00Z')), true);

        // Off-air overnight gap between Saturday night and Sunday afternoon
        assert.equal(isSupercellEventLive(monthlyFinals, new Date('2026-06-27T23:01:00Z')), false);
        assert.equal(isSupercellEventLive(monthlyFinals, new Date('2026-06-28T04:00:00Z')), false);
        assert.equal(isSupercellEventLive(monthlyFinals, new Date('2026-06-28T10:00:00Z')), false);
        assert.equal(isSupercellEventLive(monthlyFinals, new Date('2026-06-28T15:59:59Z')), false);

        // Sunday Day 2: During broadcast (16:00 - 23:00 UTC)
        assert.equal(isSupercellEventLive(monthlyFinals, new Date('2026-06-28T16:00:00Z')), true);
        assert.equal(isSupercellEventLive(monthlyFinals, new Date('2026-06-28T21:00:00Z')), true);
        assert.equal(isSupercellEventLive(monthlyFinals, new Date('2026-06-28T23:00:00Z')), true);

        // Concluded after Sunday 23:00 UTC
        assert.equal(isSupercellEventLive(monthlyFinals, new Date('2026-06-28T23:01:00Z')), false);
    });

    test('isSupercellEventLive supports explicit broadcastWindows and custom daily broadcast hours', () => {
        const eventWithExplicitWindows = {
            name: 'Special Tournament',
            start: '2026-09-01T12:00:00Z',
            end: '2026-09-02T22:00:00Z',
            broadcastWindows: [
                { start: '2026-09-01T12:00:00Z', end: '2026-09-01T16:00:00Z' },
                { start: '2026-09-02T18:00:00Z', end: '2026-09-02T22:00:00Z' }
            ]
        };

        assert.equal(isSupercellEventLive(eventWithExplicitWindows, new Date('2026-09-01T14:00:00Z')), true);
        assert.equal(isSupercellEventLive(eventWithExplicitWindows, new Date('2026-09-01T17:00:00Z')), false);
        assert.equal(isSupercellEventLive(eventWithExplicitWindows, new Date('2026-09-02T14:00:00Z')), false);
        assert.equal(isSupercellEventLive(eventWithExplicitWindows, new Date('2026-09-02T19:00:00Z')), true);

        const eventWithDailyHours = {
            name: 'Custom Hours Event',
            start: '2026-09-05T00:00:00Z',
            end: '2026-09-06T23:59:59Z',
            dailyStartTime: '14:00',
            dailyEndTime: '18:30'
        };

        assert.equal(isSupercellEventLive(eventWithDailyHours, new Date('2026-09-05T13:59:00Z')), false);
        assert.equal(isSupercellEventLive(eventWithDailyHours, new Date('2026-09-05T15:00:00Z')), true);
        assert.equal(isSupercellEventLive(eventWithDailyHours, new Date('2026-09-05T19:00:00Z')), false);
        assert.equal(isSupercellEventLive(eventWithDailyHours, new Date('2026-09-06T17:00:00Z')), true);
    });

    test('renderSupercellEvents correctly outputs live beacon only for actively live events in DOM', async () => {
        await loadTranslations('en');

        // Prepare mock DOM container
        let container = { innerHTML: '' };
        globalThis.document = {
            getElementById: (id) => (id === 'supercell-events-container' ? container : null)
        };

        // Render table with non-live reference date
        renderSupercellEvents(new Date('2026-05-01T12:00:00Z'));

        // 1. Container receives table markup
        assert.ok(container.innerHTML.includes('supercell-events-table'));

        // 2. November 14-15 World Finals appears in table
        assert.ok(container.innerHTML.includes('14') && container.innerHTML.includes('15'));

        // 3. Since reference time is not during a live window, no watch live beacon is rendered
        assert.equal(container.innerHTML.includes('live-beacon-dot'), false);
        assert.equal(container.innerHTML.includes('watch-live-btn'), false);

        // 4. When rendered during an active broadcast window, live beacon and button are rendered
        renderSupercellEvents(new Date('2026-06-27T18:00:00Z'));
        assert.equal(container.innerHTML.includes('live-beacon-dot'), true);
        assert.equal(container.innerHTML.includes('watch-live-btn'), true);
    });

    test('views.income.supercellEvents.inDays does not have outer parentheses across locales', () => {
        const locales = ['en', 'de', 'tr', 'zh'];
        locales.forEach(loc => {
            const dict = JSON.parse(fs.readFileSync(path.join(projectRoot, `js/i18n/${loc}.json`), 'utf8'));
            const inDays = dict.views?.income?.supercellEvents?.inDays;
            assert.ok(inDays, `inDays key missing in ${loc}.json`);
            const hasEnclosingParens = (inDays.startsWith('(') && inDays.endsWith(')')) ||
                                       (inDays.startsWith('（') && inDays.endsWith('）'));
            assert.ok(!hasEnclosingParens, `${loc}.json inDays has outer parentheses: "${inDays}"`);
        });
    });
});
