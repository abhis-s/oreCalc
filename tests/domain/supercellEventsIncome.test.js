import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateSupercellEventsIncome } from '../../js/domain/income/supercellEventsIncome.js';

test('calculateSupercellEventsIncome returns zero when world championships is disabled and no custom override', () => {
    const income = calculateSupercellEventsIncome(false);
    assert.equal(income.monthly.shiny, 0);
    assert.equal(income.monthly.glowy, 0);
    assert.equal(income.monthly.starry, 0);
});

test('calculateSupercellEventsIncome returns positive ore income when enabled', () => {
    const income = calculateSupercellEventsIncome(true);
    assert.ok(income.monthly.shiny > 0);
    assert.ok(income.monthly.glowy > 0);
    assert.ok(income.monthly.starry > 0);
    assert.ok(income.daily.shiny > 0);
    assert.ok(income.weekly.shiny > income.daily.shiny);
});

test('calculateSupercellEventsIncome respects global custom chip override', () => {
    const customOverride = {
        globalOverride: true,
        shiny: 12000,
        glowy: 600,
        starry: 120
    };
    const income = calculateSupercellEventsIncome(false, customOverride);
    assert.equal(income.monthly.shiny, 12000);
    assert.equal(income.monthly.glowy, 600);
    assert.equal(income.monthly.starry, 120);
});

test('calculateSupercellEventsIncome returns consistent positive ore income across 2026 and post-2026 fallback years', (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-18T10:00:00Z') });
    const income2026 = calculateSupercellEventsIncome(true);

    t.mock.timers.setTime(new Date('2027-01-02T00:00:00Z').getTime());
    const income2027 = calculateSupercellEventsIncome(true);

    assert.deepEqual(income2027, income2026);
    assert.ok(income2027.monthly.shiny > 0);
});
