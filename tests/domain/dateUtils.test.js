import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    formatDate,
    formatDateRange,
    getDefaultDateLocale,
    getDaysInMonth,
    getISOWeekNumber,
    getDateOfWeek,
    getShortDayNames,
    setDefaultDateLocale,
    extractScheduleStartDate,
    formatRegionalDate
} from '../../js/utils/dateUtils.js';

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

test('formatDateRange renders localized date range strings cleanly', () => {
    const startRange = new Date(Date.UTC(2026, 5, 27));
    const endRange = new Date(Date.UTC(2026, 5, 28));

    const enRange = formatDateRange(startRange, endRange, { month: 'short', day: 'numeric', timeZone: 'UTC' }, 'en');
    assert.ok(enRange.includes('Jun') && enRange.includes('27') && enRange.includes('28'));

    const deRange = formatDateRange(startRange, endRange, { month: 'short', day: 'numeric', timeZone: 'UTC' }, 'de');
    assert.ok(deRange.includes('27') && deRange.includes('28'));

    const zhRange = formatDateRange(startRange, endRange, { month: 'short', day: 'numeric', timeZone: 'UTC' }, 'zh');
    assert.ok(zhRange.includes('6') && zhRange.includes('27') && zhRange.includes('28'));
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

test('setDefaultDateLocale and getDefaultDateLocale manage application-wide date locale fallback', () => {
    const original = getDefaultDateLocale();
    try {
        assert.equal(typeof original, 'string');
        setDefaultDateLocale('de');
        assert.equal(getDefaultDateLocale(), 'de');

        setDefaultDateLocale('tr');
        assert.equal(getDefaultDateLocale(), 'tr');

        setDefaultDateLocale('zh');
        assert.equal(getDefaultDateLocale(), 'zh');

        // Ignored invalid inputs
        setDefaultDateLocale('');
        assert.equal(getDefaultDateLocale(), 'zh');
        setDefaultDateLocale(null);
        assert.equal(getDefaultDateLocale(), 'zh');
    } finally {
        setDefaultDateLocale(original);
    }
});

test('formatDate defaults to defaultDateLocale and formats localized month names correctly', () => {
    const original = getDefaultDateLocale();
    try {
        const marchDate = new Date(Date.UTC(2026, 2, 1));
        const octDate = new Date(Date.UTC(2026, 9, 1));

        setDefaultDateLocale('en');
        assert.equal(formatDate(marchDate, { month: 'short' }), 'Mar');
        assert.equal(formatDate(octDate, { month: 'short' }), 'Oct');

        setDefaultDateLocale('de');
        assert.equal(formatDate(marchDate, { month: 'short' }), 'Mär');
        assert.equal(formatDate(octDate, { month: 'short' }), 'Okt');

        setDefaultDateLocale('tr');
        assert.equal(formatDate(octDate, { month: 'short' }), 'Eki');

        setDefaultDateLocale('zh');
        assert.equal(formatDate(marchDate, { month: 'short' }), '3月');
        assert.equal(formatDate(octDate, { month: 'short' }), '10月');

        // Explicit locale parameter overrides defaultDateLocale
        assert.equal(formatDate(octDate, { month: 'short' }, 'de'), 'Okt');
        assert.equal(formatDate(octDate, { month: 'short' }, 'en'), 'Oct');
    } finally {
        setDefaultDateLocale(original);
    }
});

test('getShortDayNames defaults to defaultDateLocale and respects explicit locale', () => {
    const original = getDefaultDateLocale();
    try {
        setDefaultDateLocale('de');
        const deDays = getShortDayNames('monday');
        assert.ok(deDays.includes('Mo'));
        assert.ok(deDays.includes('Di'));

        setDefaultDateLocale('en');
        const enDays = getShortDayNames('monday');
        assert.ok(enDays.includes('Mon'));
        assert.ok(enDays.includes('Tue'));

        // Explicit locale parameter overrides defaultDateLocale
        const explicitDeDays = getShortDayNames('monday', 'de');
        assert.ok(explicitDeDays.includes('Mo'));
    } finally {
        setDefaultDateLocale(original);
    }
});

test('formatDate enforces textual month format and prevents ambiguous numeric MM-DD / DD-MM output', () => {
    const testDate = new Date(Date.UTC(2026, 8, 25)); // Sep 25, 2026
    const ambiguousNumericPattern = /^\d{1,2}[-/.]\d{1,2}([-/.]\d{2,4})?$/;

    // 1. Default options (when options argument is omitted)
    const enDefault = formatDate(testDate, undefined, 'en');
    const deDefault = formatDate(testDate, undefined, 'de');
    const trDefault = formatDate(testDate, undefined, 'tr');
    const zhDefault = formatDate(testDate, undefined, 'zh');

    assert.ok(enDefault.includes('Sep'), 'English default must include Sep');
    assert.ok(deDefault.includes('Sept.'), 'German default must include Sept.');
    assert.ok(trDefault.includes('Eyl'), 'Turkish default must include Eyl');
    assert.ok(zhDefault.includes('9月'), 'Chinese default must include 9月');

    assert.ok(!ambiguousNumericPattern.test(enDefault.trim()), 'English default must not be numeric MM-DD / DD-MM');
    assert.ok(!ambiguousNumericPattern.test(deDefault.trim()), 'German default must not be numeric MM-DD / DD-MM');
    assert.ok(!ambiguousNumericPattern.test(trDefault.trim()), 'Turkish default must not be numeric MM-DD / DD-MM');
    assert.ok(!ambiguousNumericPattern.test(zhDefault.trim()), 'Chinese default must not be numeric MM-DD / DD-MM');

    // 2. dateStyle: 'medium' normalization (prevents German de-DE 25.09.2026)
    const deMedium = formatDate(testDate, { dateStyle: 'medium' }, 'de');
    assert.ok(deMedium.includes('Sept.'), 'German dateStyle medium must be normalized to Sept.');
    assert.ok(!deMedium.includes('25.09.2026'), 'German dateStyle medium must never produce 25.09.2026');

    // 3. month: 'numeric' / '2-digit' normalization when day is present
    const enNumericMonth = formatDate(testDate, { day: 'numeric', month: 'numeric' }, 'en');
    assert.ok(enNumericMonth.includes('Sep'), 'Numeric month with day must be upgraded to short text month');
    assert.ok(!enNumericMonth.includes('9/25') && !enNumericMonth.includes('09/25'), 'Must never emit 9/25 or 09/25');
});

test('formatRegionalDate formats ISO dates with regional locale or falls back gracefully', () => {
    assert.equal(formatRegionalDate(''), '');
    assert.ok(formatRegionalDate('2026-06-05', 'en').includes('2026'));
    assert.ok(formatRegionalDate('2026-06-05', 'en').includes('Jun'));
    assert.equal(formatRegionalDate('invalid-date'), 'invalid-date');
});
