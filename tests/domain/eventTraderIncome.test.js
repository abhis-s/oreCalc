import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateEventTraderIncome } from '../../js/domain/income/eventTraderIncome.js';

test('calculateEventTraderIncome returns zero ores and costs when no packs are selected', () => {
    const result = calculateEventTraderIncome({}, 0);
    assert.equal(result.bimonthly.shiny, 0);
    assert.equal(result.bimonthly.glowy, 0);
    assert.equal(result.bimonthly.starry, 0);
    assert.equal(result.monthly.shiny, 0);
    assert.equal(result.monthly.glowy, 0);
    assert.equal(result.monthly.starry, 0);
    assert.equal(result.cost, 0);
    assert.equal(result.remaining, 0);
    assert.equal(result.totalMedalsEarned, 0);
});

test('calculateEventTraderIncome computes correct ores and medal costs for multiple pack purchases', () => {
    const eventTraderState = {
        packs: {
            shiny: 2,
            glowy: 3,
            starry: 1
        }
    };
    const availableMedals = 5000;
    const result = calculateEventTraderIncome(eventTraderState, availableMedals);

    assert.equal(result.bimonthly.shiny, 700);
    assert.equal(result.bimonthly.glowy, 180);
    assert.equal(result.bimonthly.starry, 10);

    assert.equal(result.monthly.shiny, 350);
    assert.equal(result.monthly.glowy, 90);
    assert.equal(result.monthly.starry, 5);

    assert.equal(result.cost, 1810);
    assert.equal(result.remaining, 3190);
    assert.equal(result.totalMedalsEarned, 5000);
});

test('calculateEventTraderIncome handles medal deficit gracefully with negative remaining', () => {
    const eventTraderState = {
        packs: {
            starry: 8
        }
    };
    const availableMedals = 1000;
    const result = calculateEventTraderIncome(eventTraderState, availableMedals);

    assert.equal(result.cost, 2560);
    assert.equal(result.remaining, -1560);
});

test('calculateEventTraderIncome handles single ore type pack purchases', () => {
    const glowyOnly = calculateEventTraderIncome({ packs: { glowy: 5 } }, 2000);
    assert.equal(glowyOnly.bimonthly.shiny, 0);
    assert.equal(glowyOnly.bimonthly.glowy, 300);
    assert.equal(glowyOnly.bimonthly.starry, 0);
    assert.equal(glowyOnly.cost, 1400);
    assert.equal(glowyOnly.remaining, 600);
});
