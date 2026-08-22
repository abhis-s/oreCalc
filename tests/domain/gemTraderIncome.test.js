import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateGemTraderIncome } from '../../js/domain/income/gemTraderIncome.js';
import { FREE_WEEKLY_GLOWY } from '../../js/core/constants.js';

test('calculateGemTraderIncome returns free weekly glowy ore baseline when no packs purchased', () => {
    const result = calculateGemTraderIncome({});

    assert.equal(result.weekly.shiny, 0);
    assert.equal(result.weekly.glowy, FREE_WEEKLY_GLOWY);
    assert.equal(result.weekly.starry, 0);
    assert.equal(result.cost, 0);

    assert.ok(result.monthly.glowy > FREE_WEEKLY_GLOWY);
    assert.equal(result.monthly.shiny, 0);
    assert.equal(result.monthly.starry, 0);
});

test('calculateGemTraderIncome computes correct ores and gem costs for pack purchases', () => {
    const gemTraderState = {
        packs: {
            shiny: 2,
            glowy: 1,
            starry: 2
        }
    };
    const result = calculateGemTraderIncome(gemTraderState);

    assert.equal(result.weekly.shiny, 600);
    assert.equal(result.weekly.glowy, 70);
    assert.equal(result.weekly.starry, 30);
    assert.equal(result.cost, 470);

    assert.ok(result.monthly.shiny > 600);
    assert.ok(result.monthly.glowy > 70);
    assert.ok(result.monthly.starry > 30);
});

test('calculateGemTraderIncome handles zero and undefined pack counts safely', () => {
    const result = calculateGemTraderIncome({
        packs: {
            shiny: 0,
            glowy: 0,
            starry: 0
        }
    });

    assert.equal(result.weekly.shiny, 0);
    assert.equal(result.weekly.glowy, FREE_WEEKLY_GLOWY);
    assert.equal(result.weekly.starry, 0);
    assert.equal(result.cost, 0);
});
