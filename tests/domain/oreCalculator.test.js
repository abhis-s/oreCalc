import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateRequiredOres } from '../../js/core/oreCalculator.js';
import { usesStarryOre } from '../../js/data/equipmentCommonData.js';

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
    const storedOres = { shiny: 1000, glowy: 10, starry: 0 };
    const plannerMaxLevels = { customMaxLevel: { common: 5 } };

    const result = calculateRequiredOres(heroesState, storedOres, plannerMaxLevels);
    assert.equal(result.shiny, 360);
    assert.equal(result.glowy, 10);
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
    const plannerMaxLevels = { customMaxLevel: { epic: 27 } };

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
    const plannerMaxLevels = { customMaxLevel: { common: 5 } };

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
    const plannerMaxLevels = { customMaxLevel: { epic: 27 } };
    const upcomingHJ = { shiny: 5000, glowy: 500, starry: 50 };

    const withoutHJ = calculateRequiredOres(heroesState, storedOres, plannerMaxLevels, {});
    const withHJ = calculateRequiredOres(heroesState, storedOres, plannerMaxLevels, upcomingHJ);

    assert.equal(withHJ.shiny, withoutHJ.shiny - 5000);
    assert.equal(withHJ.glowy, withoutHJ.glowy - 500);
    assert.equal(withHJ.starry, withoutHJ.starry - 50);
});

test('calculateRequiredOres accurately calculates ores for legendary equipment (Blizzard Axe Lv 1 to 33)', () => {
    const heroesState = {
        barbarianKing: {
            level: 95,
            enabled: true,
            equipment: {
                blizzardAxe: { level: 1, checked: true }
            }
        }
    };
    const storedOres = { shiny: 0, glowy: 0, starry: 0 };
    const plannerMaxLevels = { customMaxLevel: { legendary: 33 } };

    const result = calculateRequiredOres(heroesState, storedOres, plannerMaxLevels);
    assert.deepEqual(result, {
        shiny: 79760,
        glowy: 5100,
        starry: 705
    });
});

test('calculateRequiredOres accurately calculates remaining ores with Craft Pass pre-leveling (Lv 15 to 33)', () => {
    const heroesState = {
        barbarianKing: {
            level: 95,
            enabled: true,
            equipment: {
                blizzardAxe: { level: 15, checked: true }
            }
        }
    };
    const storedOres = { shiny: 0, glowy: 0, starry: 0 };
    const plannerMaxLevels = { customMaxLevel: { legendary: 33 } };

    const result = calculateRequiredOres(heroesState, storedOres, plannerMaxLevels);
    assert.deepEqual(result, {
        shiny: 60300,
        glowy: 4230,
        starry: 650
    });
});

test('usesStarryOre identifies Epic and Legendary rarities as requiring Starry Ore', () => {
    assert.equal(usesStarryOre('common'), false);
    assert.equal(usesStarryOre('Common'), false);
    assert.equal(usesStarryOre('epic'), true);
    assert.equal(usesStarryOre('legendary'), true);
    assert.equal(usesStarryOre('Legendary'), true);
    assert.equal(usesStarryOre(''), false);
});

test('calculateRequiredOres applies modern cost schedule per item while keeping classic items unchanged', () => {
    const heroesState = {
        barbarianKing: {
            level: 95,
            enabled: true,
            equipment: {
                giantGauntlet: { level: 1, checked: true },
                blizzardAxe: { level: 1, checked: true }
            }
        }
    };
    const storedOres = { shiny: 0, glowy: 0, starry: 0 };
    const plannerMaxLevels = { customMaxLevel: { epic: 27, legendary: 33 } };

    // Giant Gauntlet (classic epic: 56060/3720/480) + Blizzard Axe (modern legendary: 79760/5100/705)
    const combinedResult = calculateRequiredOres(heroesState, storedOres, plannerMaxLevels);
    assert.deepEqual(combinedResult, {
        shiny: 56060 + 79760,
        glowy: 3720 + 5100,
        starry: 480 + 705
    });
});
