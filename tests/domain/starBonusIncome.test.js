import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateStarBonusIncome, getEffectiveTownHallForDate } from '../../js/domain/income/starBonusIncome.js';
import { getStarBonusForTownHall, townHallStarBonusData } from '../../js/data/incomeSources/starBonus.js';

test('getStarBonusForTownHall returns zero ores for TH1 through TH7', () => {
    for (let th = 1; th <= 7; th++) {
        const ores = getStarBonusForTownHall(th);
        assert.deepEqual(ores, { shiny: 0, glowy: 0, starry: 0 }, `TH${th} must provide zero ores`);
    }
});

test('getStarBonusForTownHall returns canonical Supercell rewards for TH8 through TH18', () => {
    assert.deepEqual(getStarBonusForTownHall(8), { shiny: 480, glowy: 33, starry: 1 });
    assert.deepEqual(getStarBonusForTownHall(9), { shiny: 630, glowy: 42, starry: 1 });
    assert.deepEqual(getStarBonusForTownHall(10), { shiny: 760, glowy: 43, starry: 1 });
    assert.deepEqual(getStarBonusForTownHall(11), { shiny: 860, glowy: 47, starry: 1 });
    assert.deepEqual(getStarBonusForTownHall(12), { shiny: 950, glowy: 51, starry: 1 });
    assert.deepEqual(getStarBonusForTownHall(13), { shiny: 1100, glowy: 56, starry: 1 });
    assert.deepEqual(getStarBonusForTownHall(14), { shiny: 1100, glowy: 60, starry: 1 });
    assert.deepEqual(getStarBonusForTownHall(15), { shiny: 1200, glowy: 66, starry: 2 });
    assert.deepEqual(getStarBonusForTownHall(16), { shiny: 1300, glowy: 69, starry: 2 });
    assert.deepEqual(getStarBonusForTownHall(17), { shiny: 1400, glowy: 78, starry: 2 });
    assert.deepEqual(getStarBonusForTownHall(18), { shiny: 1500, glowy: 81, starry: 2 });
});

test('getStarBonusForTownHall clamps future unreleased Town Halls to TH18 rewards', () => {
    const th18Rewards = townHallStarBonusData[18];
    assert.deepEqual(getStarBonusForTownHall(19), th18Rewards);
    assert.deepEqual(getStarBonusForTownHall(20), th18Rewards);
    assert.deepEqual(getStarBonusForTownHall(99), th18Rewards);
});

test('calculateStarBonusIncome returns valid daily, weekly, and monthly rates for TH16 with 2x multiplier', () => {
    const result = calculateStarBonusIncome(16, {
        "2x": { frequency: 2, duration: 4 }
    });

    assert.equal(result.baseDaily.shiny, 1300);
    assert.equal(result.baseDaily.glowy, 69);
    assert.equal(result.baseDaily.starry, 2);

    // Daily remains clean base daily rate without snack/event fractioning
    assert.equal(result.daily.shiny, 1300);
    assert.equal(result.daily.glowy, 69);
    assert.equal(result.daily.starry, 2);

    // Weekly is 7 daily instances
    assert.equal(result.weekly.shiny, 1300 * 7);

    // Monthly includes 30 days + 2 snacks + 2 event instances = 34 instances
    assert.equal(result.monthly.shiny, 1300 * 34);
    assert.equal(result.monthly.glowy, 69 * 34);
    assert.equal(result.monthly.starry, 2 * 34);
    assert.equal(result.iconUrl, 'assets/th/th16.png');
});

test('calculateStarBonusIncome safely falls back for missing or invalid Town Hall levels', () => {
    const result = calculateStarBonusIncome(undefined);
    assert.equal(result.baseDaily.shiny, 1500);
    assert.equal(result.iconUrl, 'assets/th/th18.png');
    assert.ok(result.daily !== undefined);
    assert.ok(result.monthly !== undefined);
});

test('getEffectiveTownHallForDate steps up Town Hall based on planned upgrades in state', () => {
    const mockState = {
        playerProfile: { townHallLevel: 15 },
        income: {
            starBonus: {
                thUpgrades: {
                    "16": "2026-12",
                    "17": "2027-10"
                }
            }
        }
    };

    const before16 = new Date(Date.UTC(2026, 10, 15)); // Nov 2026
    const at16 = new Date(Date.UTC(2026, 11, 1)); // Dec 2026
    const before17 = new Date(Date.UTC(2027, 8, 30)); // Sep 2027
    const at17 = new Date(Date.UTC(2027, 9, 1)); // Oct 2027
    const future = new Date(Date.UTC(2028, 5, 1)); // Jun 2028

    assert.equal(getEffectiveTownHallForDate(before16, mockState), 15);
    assert.equal(getEffectiveTownHallForDate(at16, mockState), 16);
    assert.equal(getEffectiveTownHallForDate(before17, mockState), 16);
    assert.equal(getEffectiveTownHallForDate(at17, mockState), 17);
    assert.equal(getEffectiveTownHallForDate(future, mockState), 17);
});
