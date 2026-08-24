import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    formatDate,
    formatSupercellEventsDate,
    getDaysInMonth,
    getSupercellEventsForYear,
    getISOWeekNumber,
    getDateOfWeek,
    extractScheduleStartDate
} from '../../js/utils/dateUtils.js';

import { supercellEventsData } from '../../js/data/incomeSources/supercellEvents.js';

test('getDaysInMonth accurately calculates February and month day counts for leap and non-leap years', () => {
    assert.equal(getDaysInMonth(2024, 1), 29);
    assert.equal(getDaysInMonth(2026, 1), 28);
    assert.equal(getDaysInMonth(2026, 0), 31);
    assert.equal(getDaysInMonth(2026, 3), 30);
});

test('formatDate renders valid localized date string with cached formatter', () => {
    const d = new Date(Date.UTC(2026, 7, 14));
    const strEn = formatDate(d, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }, 'en');
    assert.ok(strEn.includes('2026'));
    assert.ok(strEn.includes('Aug') || strEn.includes('14'));
});

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

test('getISOWeekNumber and getDateOfWeek calculate ISO 8601 weeks correctly across years', () => {
    const d1 = new Date(Date.UTC(2026, 0, 1));
    assert.deepEqual(getISOWeekNumber(d1), [2026, 1]);

    for (const year of [2024, 2025, 2026, 2027, 2028]) {
        for (let week = 1; week <= 52; week++) {
            const monday = getDateOfWeek(week, year);
            assert.equal(monday.getUTCDay(), 1, `Week ${week} of ${year} must start on Monday`);
            const [resYear, resWeek] = getISOWeekNumber(monday);
            assert.equal(resWeek, week, `Week number must invert correctly for week ${week} in ${year}`);
            assert.equal(resYear, year, `ISO year must invert correctly for week ${week} in ${year}`);
        }
    }
});

test('extractScheduleStartDate normalizes Date objects and range objects cleanly', () => {
    const plainDate = new Date(Date.UTC(2026, 7, 15));
    const rangeObj = {
        startDate: new Date(Date.UTC(2026, 7, 20)),
        endDate: new Date(Date.UTC(2026, 7, 23))
    };

    assert.equal(extractScheduleStartDate(plainDate), plainDate);
    assert.equal(extractScheduleStartDate(rangeObj), rangeObj.startDate);
    assert.equal(extractScheduleStartDate(null), null);
    assert.equal(extractScheduleStartDate(undefined), undefined);
    assert.equal(extractScheduleStartDate('invalid'), 'invalid');
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
});

test('getSupercellEventsForYear formats localized event labels according to passed locale', () => {
    const eventsEn = getSupercellEventsForYear(2026, supercellEventsData, 'en');
    const eventsDe = getSupercellEventsForYear(2026, supercellEventsData, 'de');
    const eventsZh = getSupercellEventsForYear(2026, supercellEventsData, 'zh');

    assert.equal(eventsEn[eventsEn.length - 1].label, 'November');
    assert.equal(eventsDe[eventsDe.length - 1].label, 'November');
    assert.equal(eventsZh[eventsZh.length - 1].label, '十一月');
});
