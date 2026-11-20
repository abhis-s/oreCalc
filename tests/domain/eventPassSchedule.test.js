import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { craftPassScheduleData } from '../../js/data/incomeSources/craftPass.js';
import { eventPassBaseScheduleData } from '../../js/data/incomeSources/eventPass.js';
import { resolveEventPassAvailableMonths } from '../../js/domain/income/eventPassSchedule.js';
import { incomeData } from '../../js/data/incomeSourceRegistry.js';
import { getBimonthlyOccurrences, getScheduleDates } from '../../js/utils/dateUtils.js';

describe('Event Pass & Craft Pass Schedule Architecture', () => {
    test('craftPass schedule is configured with matching dates and active in December 2026', () => {
        assert.equal(craftPassScheduleData.type, 'bimonthly');
        assert.equal(craftPassScheduleData.dateStart, 8);
        assert.equal(craftPassScheduleData.dateEnd, 28);
        assert.deepEqual(craftPassScheduleData.availableMonths[2026], [12]);
        assert.deepEqual(craftPassScheduleData.availableMonths[2027], []);
    });

    test('resolveEventPassAvailableMonths filters out any month containing Craft Pass', () => {
        assert.equal(eventPassBaseScheduleData.dateStart, 8);
        assert.equal(eventPassBaseScheduleData.dateEnd, 28);
        const resolved = resolveEventPassAvailableMonths(eventPassBaseScheduleData.availableMonths, craftPassScheduleData.availableMonths);

        // December 2026 (month 12) is skipped because Craft Pass occurs in December 2026
        assert.deepEqual(resolved[2026], [4, 6, 8, 10]);
        // 2027 remains every 2nd month
        assert.deepEqual(resolved[2027], [2, 4, 6, 8, 10, 12]);
    });

    test('resolveEventPassAvailableMonths dynamically skips future craft pass occurrences', () => {
        const base = {
            2027: [2, 4, 6, 8, 10, 12]
        };
        const craft = {
            2027: [6]
        };

        const resolved = resolveEventPassAvailableMonths(base, craft);
        assert.deepEqual(resolved[2027], [2, 4, 8, 10, 12]);
    });

    test('incomeSourceRegistry registers mutual exclusion for eventPass and eventTrader', () => {
        const eventPassSchedule = incomeData.eventPass.schedule;
        const eventTraderSchedule = incomeData.eventTrader.schedule;
        const craftPassSchedule = incomeData.craftPass.schedule;

        assert.equal(craftPassSchedule.availableMonths[2026].includes(12), true);
        assert.equal(eventPassSchedule.availableMonths[2026].includes(12), false);
        assert.equal(eventTraderSchedule.availableMonths[2026].includes(12), false);

        // Event pass occurs in October 2026 and February 2027
        assert.equal(eventPassSchedule.availableMonths[2026].includes(10), true);
        assert.equal(eventPassSchedule.availableMonths[2027].includes(2), true);
    });

    test('getBimonthlyOccurrences respects mutual exclusion between Craft Pass and Event Pass', () => {
        const craftMonths = incomeData.craftPass.schedule.availableMonths;
        const eventMonths = incomeData.eventPass.schedule.availableMonths;

        // Month 11 is 0-indexed December
        assert.equal(getBimonthlyOccurrences(2026, 11, craftMonths), 1, 'Craft Pass active in Dec 2026');
        assert.equal(getBimonthlyOccurrences(2026, 11, eventMonths), 0, 'Event Pass skipped in Dec 2026');

        // Month 9 is 0-indexed October
        assert.equal(getBimonthlyOccurrences(2026, 9, craftMonths), 0, 'Craft Pass inactive in Oct 2026');
        assert.equal(getBimonthlyOccurrences(2026, 9, eventMonths), 1, 'Event Pass active in Oct 2026');

        // Month 1 is 0-indexed February 2027
        assert.equal(getBimonthlyOccurrences(2027, 1, craftMonths), 0, 'Craft Pass inactive in Feb 2027');
        assert.equal(getBimonthlyOccurrences(2027, 1, eventMonths), 1, 'Event Pass active in Feb 2027');
    });

    test('getScheduleDates returns valid date range for Craft Pass in December 2026', () => {
        const dates = getScheduleDates(2026, 11, incomeData.craftPass.schedule);
        assert.ok(dates.length > 0);
        // Start date is December 8, 2026
        assert.equal(dates[0].getUTCDate(), 8);
        assert.equal(dates[0].getUTCMonth(), 11);
        assert.equal(dates[0].getUTCFullYear(), 2026);
    });
});
