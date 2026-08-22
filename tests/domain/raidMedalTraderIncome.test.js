import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateRaidMedalTraderIncome } from '../../js/domain/income/raidMedalTraderIncome.js';

test('calculateRaidMedalTraderIncome returns zero ores and costs when state is empty', () => {
    const result = calculateRaidMedalTraderIncome({});

    assert.equal(result.weekly.shiny, 0);
    assert.equal(result.weekly.glowy, 0);
    assert.equal(result.weekly.starry, 0);
    assert.equal(result.cost, 0);
    assert.equal(result.remaining, 0);
});

test('calculateRaidMedalTraderIncome preserves earned medals as remaining when no packs purchased', () => {
    const result = calculateRaidMedalTraderIncome({ earned: 1500, packs: {} });

    assert.equal(result.weekly.shiny, 0);
    assert.equal(result.weekly.glowy, 0);
    assert.equal(result.weekly.starry, 0);
    assert.equal(result.cost, 0);
    assert.equal(result.remaining, 1500);
});

test('calculateRaidMedalTraderIncome calculates correct ores and costs for full pack purchases', () => {
    const raidMedalState = {
        earned: 2000,
        packs: {
            shiny: 2,
            glowy: 2,
            starry: 2
        }
    };
    const result = calculateRaidMedalTraderIncome(raidMedalState);

    assert.equal(result.weekly.shiny, 1000);
    assert.equal(result.weekly.glowy, 100);
    assert.equal(result.weekly.starry, 10);
    assert.equal(result.cost, 2000);
    assert.equal(result.remaining, 0);

    assert.ok(result.monthly.shiny > 1000);
    assert.ok(result.monthly.glowy > 100);
    assert.ok(result.monthly.starry > 10);
});

test('calculateRaidMedalTraderIncome handles medal deficit when cost exceeds earned medals', () => {
    const raidMedalState = {
        earned: 500,
        packs: {
            starry: 2
        }
    };
    const result = calculateRaidMedalTraderIncome(raidMedalState);

    assert.equal(result.cost, 700);
    assert.equal(result.remaining, -200);
});
