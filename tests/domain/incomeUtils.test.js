import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    getPriceForTier,
    getCurrencySymbol,
    toMajorUnits,
    toMinorUnits,
    calculateWarIncome,
    calculateWeeklyIncome,
    calculateBimonthlyIncome,
    adjustWarRates
} from '../../js/utils/incomeUtils.js';

describe('Income Utility Engine Domain Suite', () => {
    test('getPriceForTier resolves correct pricing in integer minor units and currency fallback', () => {
        // Known tier
        const usdPrice = getPriceForTier('tier5', 'USD');
        assert.ok(typeof usdPrice === 'number' && usdPrice > 0);
        assert.equal(usdPrice, 499);
        assert.ok(Number.isInteger(usdPrice));

        // Fallback to USD when currency not explicitly found
        const fallbackPrice = getPriceForTier('tier5', 'UNKNOWN_CURRENCY');
        assert.equal(fallbackPrice, usdPrice);

        // Custom pricing override takes precedence in minor units
        const customPrice = getPriceForTier('tier5', 'USD', { tier5: 799 });
        assert.equal(customPrice, 799);

        // Legacy float pricing auto-normalizes to minor units
        const legacyCustomPrice = getPriceForTier('tier5', 'USD', { tier5: 7.99 });
        assert.equal(legacyCustomPrice, 799);

        // Empty or null tier returns 0
        assert.equal(getPriceForTier(null), 0);
        assert.equal(getPriceForTier(''), 0);
    });

    test('toMajorUnits and toMinorUnits convert according to ISO decimal factors', () => {
        // 2-decimal currencies (USD, INR)
        assert.equal(toMajorUnits(499, 'USD'), 4.99);
        assert.equal(toMajorUnits(8900, 'INR'), 89);
        assert.equal(toMinorUnits(4.99, 'USD'), 499);
        assert.equal(toMinorUnits(89, 'INR'), 8900);

        // 0-decimal currency (JPY)
        assert.equal(toMajorUnits(160, 'JPY'), 160);
        assert.equal(toMinorUnits(160, 'JPY'), 160);
        assert.equal(toMajorUnits(15800, 'JPY'), 15800);
        assert.equal(toMinorUnits(15800, 'JPY'), 15800);
    });

    test('getCurrencySymbol returns canonical symbols', () => {
        assert.equal(getCurrencySymbol('USD'), '$');
        assert.equal(getCurrencySymbol('EUR'), '€');
        assert.equal(getCurrencySymbol('GBP'), '£');
        assert.equal(getCurrencySymbol('UNKNOWN'), '$');
    });

    test('calculateWarIncome weights win (1.0), draw (0.75), and loss (0.50) accurately', () => {
        // 100% win rate: factor is 1.0
        const winIncome = calculateWarIncome(100, 0, { shiny: 1000, glowy: 50, starry: 10 }, 2, 10);
        // 2 attacks * 10 events * 1000 shiny * 1.0 factor = 20000
        assert.equal(winIncome.monthly.shiny, 20000);
        assert.equal(winIncome.monthly.glowy, 1000);
        assert.equal(winIncome.monthly.starry, 200);

        // 0% win rate, 0% draw rate (100% loss): factor is 0.5
        const lossIncome = calculateWarIncome(0, 0, { shiny: 1000, glowy: 50, starry: 10 }, 2, 10);
        // 2 attacks * 10 events * 1000 shiny * 0.5 factor = 10000
        assert.equal(lossIncome.monthly.shiny, 10000);
    });

    test('calculateWeeklyIncome converts weekly rates to monthly, daily, and bimonthly breakdowns', () => {
        const weekly = { shiny: 700, glowy: 70, starry: 7 };
        const result = calculateWeeklyIncome(weekly);

        // WEEKS_IN_MONTH = 30 / 7, so 700 * (30 / 7) = 3000
        assert.equal(result.monthly.shiny, 3000);
        assert.equal(result.monthly.glowy, 300);
        assert.equal(result.monthly.starry, 30);
        assert.ok(result.daily.shiny > 0);
        assert.equal(result.bimonthly.shiny, 3000 * 2);
    });

    test('calculateBimonthlyIncome converts bimonthly rates to monthly, daily, and weekly breakdowns', () => {
        const bimonthly = { shiny: 6000, glowy: 600, starry: 60 };
        const result = calculateBimonthlyIncome(bimonthly);

        // MONTHS_IN_BIMONTH = 2
        assert.equal(result.monthly.shiny, 3000);
        assert.equal(result.monthly.glowy, 300);
        assert.equal(result.monthly.starry, 30);
    });

    test('adjustWarRates adjusts win and draw rates to not exceed 100%', () => {
        // Increasing win rate to 90 when draw was 30: draw should drop to 10
        const adj1 = adjustWarRates(90, 30, 'win');
        assert.equal(adj1.winRate, 90);
        assert.equal(adj1.drawRate, 10);

        // Increasing draw rate to 70 when win was 50: win should drop to 30
        const adj2 = adjustWarRates(50, 70, 'draw');
        assert.equal(adj2.winRate, 30);
        assert.equal(adj2.drawRate, 70);
    });
});
