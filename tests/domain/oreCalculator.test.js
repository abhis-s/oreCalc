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
