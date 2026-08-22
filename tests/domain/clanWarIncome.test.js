import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateClanWarIncome } from '../../js/domain/income/clanWarIncome.js';

test('calculateClanWarIncome returns zero ores when state is empty or undefined', () => {
    const defaultResult = calculateClanWarIncome();
    assert.deepEqual(defaultResult.daily, { shiny: 0, glowy: 0, starry: 0 });
    assert.deepEqual(defaultResult.weekly, { shiny: 0, glowy: 0, starry: 0 });
    assert.deepEqual(defaultResult.monthly, { shiny: 0, glowy: 0, starry: 0 });
    assert.deepEqual(defaultResult.bimonthly, { shiny: 0, glowy: 0, starry: 0 });
    assert.deepEqual(defaultResult.perEvent, { shiny: 0, glowy: 0, starry: 0 });

    const emptyObjResult = calculateClanWarIncome({});
    assert.deepEqual(emptyObjResult.monthly, { shiny: 0, glowy: 0, starry: 0 });
});

test('calculateClanWarIncome computes correct ore rates for standard war performance', () => {
    const clanWarState = {
        winRate: 60,
        drawRate: 10,
        oresPerAttack: { shiny: 1000, glowy: 50, starry: 5 },
        warsPerMonth: 10
    };

    const result = calculateClanWarIncome(clanWarState);

    assert.ok(Math.abs(result.perEvent.shiny - 1650) < 1e-9);
    assert.ok(Math.abs(result.perEvent.glowy - 82.5) < 1e-9);
    assert.ok(Math.abs(result.perEvent.starry - 8.25) < 1e-9);

    assert.ok(Math.abs(result.monthly.shiny - 16500) < 1e-9);
    assert.ok(Math.abs(result.monthly.glowy - 825) < 1e-9);
    assert.ok(Math.abs(result.monthly.starry - 82.5) < 1e-9);

    assert.ok(result.daily.shiny > 0);
    assert.ok(result.weekly.shiny > result.daily.shiny);
    assert.ok(Math.abs(result.bimonthly.shiny - result.monthly.shiny * 2) < 1e-9);
});

test('calculateClanWarIncome handles boundary win and draw rates correctly', () => {
    const perfectWin = calculateClanWarIncome({
        winRate: 100,
        drawRate: 0,
        oresPerAttack: { shiny: 1000, glowy: 50, starry: 5 },
        warsPerMonth: 1
    });
    assert.equal(perfectWin.perEvent.shiny, 2000);

    const allLoss = calculateClanWarIncome({
        winRate: 0,
        drawRate: 0,
        oresPerAttack: { shiny: 1000, glowy: 50, starry: 5 },
        warsPerMonth: 1
    });
    assert.equal(allLoss.perEvent.shiny, 1000);

    const allDraw = calculateClanWarIncome({
        winRate: 0,
        drawRate: 100,
        oresPerAttack: { shiny: 1000, glowy: 50, starry: 5 },
        warsPerMonth: 1
    });
    assert.equal(allDraw.perEvent.shiny, 1500);
});

test('calculateClanWarIncome handles partial ore definitions safely without NaN', () => {
    const partialOres = calculateClanWarIncome({
        winRate: 50,
        oresPerAttack: { shiny: 800 },
        warsPerMonth: 5
    });

    assert.ok(partialOres.monthly.shiny > 0);
    assert.equal(partialOres.monthly.glowy, 0);
    assert.equal(partialOres.monthly.starry, 0);
});
