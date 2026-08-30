import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateRequiredOres } from '../../js/core/oreCalculator.js';

test('calculateRequiredOres returns zero when no heroes or equipment are checked', () => {
    const heroesState = {
        barbarianKing: {
            level: 50,
            enabled: false,
            equipment: {
                barbarianPuppet: { level: 1, checked: false }
            }
        }
    };
    const storedOres = { shiny: 0, glowy: 0, starry: 0 };
    const plannerMaxLevels = {};

    const result = calculateRequiredOres(heroesState, storedOres, plannerMaxLevels);
    assert.deepEqual(result, { shiny: 0, glowy: 0, starry: 0 });
});

test('calculateRequiredOres accurately calculates ores for common equipment upgrade', () => {
    const heroesState = {
        barbarianKing: {
            level: 95,
            enabled: true,
            equipment: {
                barbarianPuppet: { level: 1, checked: true }
            }
        }
    };
    const storedOres = { shiny: 1000, glowy: 100, starry: 0 };
    const plannerMaxLevels = { barbarianPuppet: 5 };

    const result = calculateRequiredOres(heroesState, storedOres, plannerMaxLevels);
    assert.ok(result.shiny > 0);
    assert.ok(result.glowy > 0);
    assert.equal(result.starry, 0);
});

test('calculateRequiredOres accurately calculates starry ore for epic equipment upgrade', () => {
    const heroesState = {
        barbarianKing: {
            level: 95,
            enabled: true,
            equipment: {
                giantGauntlet: { level: 1, checked: true }
            }
        }
    };
    const storedOres = { shiny: 0, glowy: 0, starry: 0 };
    const plannerMaxLevels = { giantGauntlet: 27 };

    const result = calculateRequiredOres(heroesState, storedOres, plannerMaxLevels);
    assert.ok(result.shiny > 0, 'Epic upgrade must require shiny ore');
    assert.ok(result.glowy > 0, 'Epic upgrade must require glowy ore');
    assert.ok(result.starry > 0, 'Epic upgrade must require starry ore');
    assert.equal(result.starry, 480, 'Full level 1 to 27 Epic upgrade requires 480 starry ore');
});

test('calculateRequiredOres clamps required ores to zero when stored ores exceed requirements', () => {
    const heroesState = {
        barbarianKing: {
            level: 50,
            enabled: true,
            equipment: {
                barbarianPuppet: { level: 1, checked: true }
            }
        }
    };
    const storedOres = { shiny: 999999, glowy: 999999, starry: 999999 };
    const plannerMaxLevels = { barbarianPuppet: 5 };

    const result = calculateRequiredOres(heroesState, storedOres, plannerMaxLevels);
    assert.equal(result.shiny, 0, 'Shiny ore must clamp to 0');
    assert.equal(result.glowy, 0, 'Glowy ore must clamp to 0');
    assert.equal(result.starry, 0, 'Starry ore must clamp to 0');
});

test('calculateRequiredOres properly deducts upcoming Hero Journey rewards', () => {
    const heroesState = {
        barbarianKing: {
            level: 95,
            enabled: true,
            equipment: {
                giantGauntlet: { level: 1, checked: true }
            }
        }
    };
    const storedOres = { shiny: 0, glowy: 0, starry: 0 };
    const plannerMaxLevels = { giantGauntlet: 27 };
    const upcomingHJ = { shiny: 5000, glowy: 500, starry: 50 };

    const withoutHJ = calculateRequiredOres(heroesState, storedOres, plannerMaxLevels, {});
    const withHJ = calculateRequiredOres(heroesState, storedOres, plannerMaxLevels, upcomingHJ);

    assert.equal(withHJ.shiny, withoutHJ.shiny - 5000);
    assert.equal(withHJ.glowy, withoutHJ.glowy - 500);
    assert.equal(withHJ.starry, withoutHJ.starry - 50);
});
