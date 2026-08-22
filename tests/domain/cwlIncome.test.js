import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateCwlIncome } from '../../js/domain/income/cwlIncome.js';
import { calculateClanWarIncome } from '../../js/domain/income/clanWarIncome.js';

test('calculateCwlIncome returns zero ores when state is empty or undefined', () => {
    const defaultResult = calculateCwlIncome();
    assert.deepEqual(defaultResult.daily, { shiny: 0, glowy: 0, starry: 0 });
    assert.deepEqual(defaultResult.weekly, { shiny: 0, glowy: 0, starry: 0 });
    assert.deepEqual(defaultResult.monthly, { shiny: 0, glowy: 0, starry: 0 });
    assert.deepEqual(defaultResult.bimonthly, { shiny: 0, glowy: 0, starry: 0 });
    assert.deepEqual(defaultResult.perEvent, { shiny: 0, glowy: 0, starry: 0 });

    const emptyObjResult = calculateCwlIncome({});
    assert.deepEqual(emptyObjResult.monthly, { shiny: 0, glowy: 0, starry: 0 });
});

test('calculateCwlIncome computes correct ore rates for standard CWL season', () => {
    const cwlState = {
        winRate: 80,
        drawRate: 0,
        oresPerAttack: { shiny: 1200, glowy: 60, starry: 6 },
        hitsPerSeason: 7
    };

    const result = calculateCwlIncome(cwlState);

    assert.ok(Math.abs(result.perEvent.shiny - 1080) < 1e-9);
    assert.ok(Math.abs(result.perEvent.glowy - 54) < 1e-9);
    assert.ok(Math.abs(result.perEvent.starry - 5.4) < 1e-9);

    assert.ok(Math.abs(result.monthly.shiny - 7560) < 1e-9);
    assert.ok(Math.abs(result.monthly.glowy - 378) < 1e-9);
    assert.ok(Math.abs(result.monthly.starry - 37.8) < 1e-9);

    assert.ok(result.daily.shiny > 0);
    assert.ok(result.weekly.shiny > result.daily.shiny);
    assert.ok(Math.abs(result.bimonthly.shiny - result.monthly.shiny * 2) < 1e-9);
});

test('calculateCwlIncome uses exactly 1 attack per event compared to clan wars 2 attacks per event', () => {
    const testOres = { shiny: 1000, glowy: 50, starry: 5 };
    const winRate = 100;

    const cwlResult = calculateCwlIncome({
        winRate,
        oresPerAttack: testOres,
        hitsPerSeason: 1
    });

    const clanWarResult = calculateClanWarIncome({
        winRate,
        oresPerAttack: testOres,
        warsPerMonth: 1
    });

    assert.equal(cwlResult.perEvent.shiny * 2, clanWarResult.perEvent.shiny);
    assert.equal(cwlResult.perEvent.glowy * 2, clanWarResult.perEvent.glowy);
    assert.equal(cwlResult.perEvent.starry * 2, clanWarResult.perEvent.starry);
});

test('calculateCwlIncome handles boundary conditions safely', () => {
    const zeroHits = calculateCwlIncome({
        winRate: 100,
        oresPerAttack: { shiny: 1000, glowy: 50, starry: 5 },
        hitsPerSeason: 0
    });
    assert.equal(zeroHits.monthly.shiny, 0);

    const allLoss = calculateCwlIncome({
        winRate: 0,
        drawRate: 0,
        oresPerAttack: { shiny: 1000, glowy: 50, starry: 5 },
        hitsPerSeason: 7
    });
    assert.equal(allLoss.perEvent.shiny, 500);
    assert.equal(allLoss.monthly.shiny, 3500);

    const missingOres = calculateCwlIncome({
        winRate: 50,
        hitsPerSeason: 7
    });
    assert.equal(missingOres.monthly.shiny, 0);
});
