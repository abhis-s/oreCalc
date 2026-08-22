import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateRemainingTime } from '../../js/core/timeCalculator.js';

test('calculateRemainingTime returns status DONE when required ores <= 0', () => {
    const result = calculateRemainingTime({ shiny: 0, glowy: 0, starry: 0 }, { shiny: 100, glowy: 10, starry: 5 });
    assert.equal(result.shiny.status, 'DONE');
    assert.equal(result.glowy.status, 'DONE');
    assert.equal(result.starry.status, 'DONE');
});

test('calculateRemainingTime returns N/A when monthly income <= 0', () => {
    const result = calculateRemainingTime({ shiny: 5000, glowy: 500, starry: 100 }, { shiny: 0, glowy: 0, starry: 0 });
    assert.equal(result.shiny.date, 'N/A');
    assert.equal(result.glowy.date, 'N/A');
    assert.equal(result.starry.date, 'N/A');
});

test('calculateRemainingTime accurately estimates duration for valid requirements and income', () => {
    const result = calculateRemainingTime({ shiny: 60000 }, { shiny: 20000 });
    assert.equal(result.shiny.months, 3);
    assert.equal(result.shiny.years, 0);
    assert.ok(result.shiny.date instanceof Date);
});
