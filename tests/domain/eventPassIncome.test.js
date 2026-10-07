import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateEventPassIncome } from '../../js/domain/income/eventPassIncome.js';
import { currencyData } from '../../js/data/pricingData.js';

test('calculateEventPassIncome returns free pass baseline rewards and zero costs by default', () => {
    const result = calculateEventPassIncome({});

    assert.equal(result.type, 'free');
    assert.equal(result.eventPass, false);
    assert.equal(result.availableMedals, 3200);

    assert.equal(result.bimonthly.shiny, 5000);
    assert.equal(result.bimonthly.glowy, 400);
    assert.equal(result.bimonthly.starry, 0);

    assert.equal(result.monthly.shiny, 2500);
    assert.equal(result.monthly.glowy, 200);
    assert.equal(result.monthly.starry, 0);

    for (const currencyCode in currencyData) {
        assert.equal(result.monthly[currencyCode], 0);
    }
});

test('calculateEventPassIncome computes paid event pass rewards and currency pricing', () => {
    const result = calculateEventPassIncome({ eventPass: true, includeEquipment: false });

    assert.equal(result.type, 'event');
    assert.equal(result.eventPass, true);
    assert.equal(result.availableMedals, 8700);

    assert.equal(result.bimonthly.shiny, 5000);
    assert.equal(result.bimonthly.glowy, 1280);
    assert.equal(result.bimonthly.starry, 85);

    assert.equal(result.monthly.shiny, 2500);
    assert.equal(result.monthly.glowy, 640);
    assert.equal(result.monthly.starry, 42.5);

    assert.ok(result.monthly.USD > 0);
    assert.ok(result.monthly.EUR > 0);
});

test('calculateEventPassIncome subtracts equipment cost when includeEquipment is true', () => {
    const freeWithEquip = calculateEventPassIncome({ eventPass: false, includeEquipment: true });
    assert.equal(freeWithEquip.availableMedals, 100);

    const paidWithEquip = calculateEventPassIncome({ eventPass: true, includeEquipment: true });
    assert.equal(paidWithEquip.availableMedals, 5600);
});

test('calculateEventPassIncome adds bonusTrackMedals and purchasedMedals', () => {
    const result = calculateEventPassIncome({
        eventPass: true,
        bonusTrackMedals: 1560,
        purchasedMedals: 2000,
        includeEquipment: false
    });

    assert.equal(result.availableMedals, 12260);
});
