import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { calculateCraftPassIncome, calculateCraftPassTraderIncome } from '../../js/domain/income/craftPassIncome.js';
import { currencyData } from '../../js/data/pricingData.js';

describe('Craft Pass Income Domain Suite', () => {
    test('calculateCraftPassIncome returns zero ores and zero costs when craft pass is inactive', () => {
        const result = calculateCraftPassIncome({ craftPass: false });

        assert.equal(result.type, 'free');
        assert.equal(result.craftPass, false);
        assert.equal(result.monthly.shiny, 0);
        assert.equal(result.monthly.glowy, 0);
        assert.equal(result.monthly.starry, 0);

        for (const code in currencyData) {
            assert.equal(result.monthly[code], 0);
            assert.equal(result.bimonthly[code], 0);
        }
    });

    test('calculateCraftPassIncome calculates tier10 costs and zero ores when craft pass is bought', () => {
        const result = calculateCraftPassIncome({ craftPass: true });

        assert.equal(result.type, 'paid');
        assert.equal(result.craftPass, true);
        assert.equal(result.monthly.shiny, 0);
        assert.equal(result.monthly.glowy, 0);
        assert.equal(result.monthly.starry, 0);

        // USD cost for tier10 is 999 cents ($9.99) bimonthly
        assert.equal(result.bimonthly.USD, 999);
        assert.equal(result.monthly.USD, Math.round(999 / 2));
        assert.ok(result.daily.USD > 0);
        assert.ok(result.weekly.USD > 0);
    });

    test('calculateCraftPassIncome safely handles undefined or null state input', () => {
        const result = calculateCraftPassIncome(null);

        assert.equal(result.type, 'free');
        assert.equal(result.craftPass, false);
        assert.equal(result.monthly.shiny, 0);
    });

    test('calculateCraftPassTraderIncome returns zeroed timeframe rates and remaining currency safely', () => {
        const result = calculateCraftPassTraderIncome(null, 250);

        assert.equal(result.daily.shiny, 0);
        assert.equal(result.weekly.glowy, 0);
        assert.equal(result.monthly.starry, 0);
        assert.equal(result.bimonthly.starry, 0);
        assert.equal(result.cost, 0);
        assert.equal(result.remaining, 250);
        assert.equal(result.totalMedalsEarned, 250);
    });
});
