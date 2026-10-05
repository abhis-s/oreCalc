import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    formatSupercellEventsDate,
    getSupercellEventsForYear,
    isEventPlaceholder,
    isSupercellEventLive
} from '../../js/domain/income/supercellEventsSchedule.js';
import { getDaysInMonth } from '../../js/utils/dateUtils.js';

import { supercellEventsData } from '../../js/data/incomeSources/supercellEvents.js';

describe('Supercell Events Schedule Domain Suite', () => {

    test('getSupercellEventsForYear generates valid ISO date strings without invalid calendar days', () => {
        const events = getSupercellEventsForYear(2026, supercellEventsData);
        assert.ok(Array.isArray(events));
        assert.ok(events.length > 0);

        for (const evt of events) {
            assert.ok(evt.start);
            assert.ok(evt.end);

            const startDate = new Date(evt.start);
            const endDate = new Date(evt.end);

            assert.ok(!isNaN(startDate.getTime()), `Invalid start date for event ${evt.name}: ${evt.start}`);
            assert.ok(!isNaN(endDate.getTime()), `Invalid end date for event ${evt.name}: ${evt.end}`);
            assert.ok(endDate >= startDate, `End date must be on or after start date for ${evt.name}`);

            const endDay = parseInt(evt.end.split('T')[0].split('-')[2], 10);
            const endMonth = parseInt(evt.end.split('T')[0].split('-')[1], 10);
            const endYear = parseInt(evt.end.split('T')[0].split('-')[0], 10);
            const maxDaysInEndMonth = getDaysInMonth(endYear, endMonth - 1);
            assert.ok(endDay <= maxDaysInEndMonth, `Day ${endDay} exceeds month ${endMonth} maximum ${maxDaysInEndMonth}`);
        }
    });

    test('getSupercellEventsForYear formats localized event labels according to passed locale', () => {
        const eventsEn = getSupercellEventsForYear(2026, supercellEventsData, 'en');
        const eventsDe = getSupercellEventsForYear(2026, supercellEventsData, 'de');
        const eventsZh = getSupercellEventsForYear(2026, supercellEventsData, 'zh');

        assert.ok(eventsEn[eventsEn.length - 1].label.includes('14') && eventsEn[eventsEn.length - 1].label.includes('15'));
        assert.ok(eventsDe[eventsDe.length - 1].label.includes('14') && eventsDe[eventsDe.length - 1].label.includes('15'));
        assert.ok(eventsZh[eventsZh.length - 1].label.includes('14') && eventsZh[eventsZh.length - 1].label.includes('15'));

        const eventsFallback2027 = getSupercellEventsForYear(2027, supercellEventsData, 'en');
        assert.equal(eventsFallback2027[eventsFallback2027.length - 1].label, 'November');
        assert.equal(eventsFallback2027[eventsFallback2027.length - 1].isPlaceholder, true);
    });

    test('formatSupercellEventsDate produces standard localized date ranges and full-month formats', () => {
        const startRange = new Date('2026-06-27T16:00:00Z');
        const endRange = new Date('2026-06-28T23:00:00Z');

        const enRange = formatSupercellEventsDate(startRange, endRange, 'en');
        assert.ok(enRange.includes('Jun') && enRange.includes('27') && enRange.includes('28'));

        const deRange = formatSupercellEventsDate(startRange, endRange, 'de');
        assert.ok(deRange.includes('27') && deRange.includes('28'));

        const zhRange = formatSupercellEventsDate(startRange, endRange, 'zh');
        assert.ok(zhRange.includes('6') && zhRange.includes('27') && zhRange.includes('28'));

        const startMonth = new Date('2026-11-01T00:00:00Z');
        const endMonth = new Date('2026-11-30T23:59:59Z');

        assert.equal(formatSupercellEventsDate(startMonth, endMonth, 'en'), 'November');
        assert.equal(formatSupercellEventsDate(startMonth, endMonth, 'de'), 'November');
        assert.equal(formatSupercellEventsDate(startMonth, endMonth, 'zh'), '十一月');
        assert.equal(formatSupercellEventsDate(startMonth, endMonth, 'tr'), 'Kasım');

        // Invalid inputs fallback to TBD
        assert.equal(formatSupercellEventsDate(null, null), 'TBD');
        assert.equal(formatSupercellEventsDate(new Date('invalid'), new Date()), 'TBD');
    });

    test('isEventPlaceholder identifies full-month placeholders and missing dates', () => {
        assert.equal(isEventPlaceholder(null), true);
        assert.equal(isEventPlaceholder(undefined), true);
        assert.equal(isEventPlaceholder('invalid'), true);
        assert.equal(isEventPlaceholder({ name: 'World Finals' }), true);
        assert.equal(isEventPlaceholder({ name: 'World Finals', start: null, end: null }), true);
        assert.equal(isEventPlaceholder({ name: 'World Finals', start: 'invalid', end: 'invalid' }), true);

        const fullMonthPlaceholder = {
            name: 'World Finals',
            start: '2026-11-01T00:00:00Z',
            end: '2026-11-30T23:59:59Z',
            isPlaceholder: true
        };
        assert.equal(isEventPlaceholder(fullMonthPlaceholder), true);

        const concreteEvent = {
            name: 'Monthly Finals',
            start: '2026-06-27T16:00:00Z',
            end: '2026-06-28T23:00:00Z'
        };
        assert.equal(isEventPlaceholder(concreteEvent), false);
    });

    test('isSupercellEventLive accurately checks live tournament state', () => {
        const monthlyFinals = {
            name: 'Monthly Finals',
            start: '2026-06-27T16:00:00Z',
            end: '2026-06-28T23:00:00Z',
            dailyStartTime: '16:00',
            dailyEndTime: '23:00'
        };

        // Before tournament
        assert.equal(isSupercellEventLive(monthlyFinals, new Date('2026-06-27T15:59:59Z')), false);

        // During live broadcast day 1
        assert.equal(isSupercellEventLive(monthlyFinals, new Date('2026-06-27T16:00:00Z')), true);
        assert.equal(isSupercellEventLive(monthlyFinals, new Date('2026-06-27T20:00:00Z')), true);

        // Off-air overnight gap between day 1 and day 2
        assert.equal(isSupercellEventLive(monthlyFinals, new Date('2026-06-28T04:00:00Z')), false);

        // During live broadcast day 2
        assert.equal(isSupercellEventLive(monthlyFinals, new Date('2026-06-28T16:30:00Z')), true);

        // After tournament ends
        assert.equal(isSupercellEventLive(monthlyFinals, new Date('2026-06-28T23:01:00Z')), false);
    });
});
