import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateShopOfferIncome } from '../../js/domain/income/shopOffersIncome.js';
import { currencyData } from '../../js/data/pricingData.js';

test('calculateShopOfferIncome returns zero ores and costs for default set 0', () => {
    const result = calculateShopOfferIncome();

    assert.equal(result.monthly.shiny, 0);
    assert.equal(result.monthly.glowy, 0);
    assert.equal(result.monthly.starry, 0);
    assert.equal(result.daily.shiny, 0);
    assert.equal(result.weekly.shiny, 0);
    assert.equal(result.bimonthly.shiny, 0);

    const explicitZero = calculateShopOfferIncome({ selectedSet: 0, '0': {} });
    assert.equal(explicitZero.monthly.shiny, 0);
});

test('calculateShopOfferIncome calculates correct ores and multi-currency costs for TH16 set', () => {
    const shopOfferState = {
        selectedSet: 16,
        '16': {
            shiny_large: 2,
            glowy: 1,
            starry: 1,
            shiny_small: 1
        }
    };
    const result = calculateShopOfferIncome(shopOfferState);

    assert.equal(result.monthly.shiny, 30000);
    assert.equal(result.monthly.glowy, 750);
    assert.equal(result.monthly.starry, 75);

    assert.equal(result.daily.shiny, 30000 / 30);
    assert.equal(result.weekly.shiny, (30000 / 30) * 7);
    assert.equal(result.bimonthly.shiny, 30000 * 2);

    assert.ok(result.monthly.USD > 0);
    assert.ok(result.monthly.EUR > 0);
    assert.equal(result.bimonthly.USD, result.monthly.USD * 2);
});

test('calculateShopOfferIncome calculates correct ores for TH14, TH11, and TH8 sets', () => {
    const th14Result = calculateShopOfferIncome({
        selectedSet: 14,
        '14': {
            glowy: 2,
            starry: 1,
            shiny_small: 1
        }
    });
    assert.equal(th14Result.monthly.glowy, 2 * 630);
    assert.equal(th14Result.monthly.starry, 65);
    assert.equal(th14Result.monthly.shiny, 5000);

    const th8Result = calculateShopOfferIncome({
        selectedSet: 8,
        '8': {
            glowy: 1,
            starry: 2,
            shiny_small: 1
        }
    });
    assert.equal(th8Result.monthly.glowy, 400);
    assert.equal(th8Result.monthly.starry, 2 * 40);
    assert.equal(th8Result.monthly.shiny, 3000);
});

test('calculateShopOfferIncome infers first numeric key when selectedSet is omitted', () => {
    const result = calculateShopOfferIncome({
        '11': {
            shiny_large: 1
        }
    });

    assert.equal(result.monthly.shiny, 12000);
});
