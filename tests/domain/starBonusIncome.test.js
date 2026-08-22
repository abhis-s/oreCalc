import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateStarBonusIncome } from '../../js/domain/income/starBonusIncome.js';

test('calculateStarBonusIncome returns valid daily, weekly, and monthly rates for Legends league', () => {
    const legendsLeagueId = 105000036;
    const result = calculateStarBonusIncome(legendsLeagueId, {
        "2x": { frequency: 2, duration: 4 }
    });

    assert.ok(result.daily.shiny > 0);
    assert.ok(result.weekly.shiny > result.daily.shiny);
    assert.ok(result.monthly.shiny > result.weekly.shiny);
    assert.ok(result.monthly.starry > 0);
});

test('calculateStarBonusIncome falls back safely for undefined or invalid league IDs', () => {
    const result = calculateStarBonusIncome(999999999);
    assert.ok(result.daily !== undefined);
    assert.ok(result.monthly !== undefined);
});
