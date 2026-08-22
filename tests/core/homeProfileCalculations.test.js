import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateEquipmentProgress, getOverallGradient } from '../../js/components/home/homeProfileCalculations.js';

describe('Home Profile Equipment Progress Calculations Suite', () => {
    test('calculateEquipmentProgress returns zeros when no heroes or equipment owned', () => {
        const progress = calculateEquipmentProgress({}, {});
        assert.strictEqual(progress.overall, 0);
        assert.strictEqual(progress.shiny, 0);
        assert.strictEqual(progress.glowy, 0);
        assert.strictEqual(progress.starry, 0);
        assert.strictEqual(progress.shinySpent, 0);
        assert.strictEqual(progress.glowySpent, 0);
        assert.strictEqual(progress.starrySpent, 0);
    });

    test('calculateEquipmentProgress computes arithmetic average of all three ore percentages for overall', () => {
        const ownedHeroes = {
            'Barbarian King': { name: 'Barbarian King', level: 95 }
        };
        const ownedEquipment = {
            'Barbarian Puppet': 18, // Common max level
            'Rage Vial': 18,        // Common max level
            'Giant Gauntlet': 1     // Epic level 1 (0 spent on Gauntlet)
        };

        const progress = calculateEquipmentProgress(ownedEquipment, ownedHeroes);
        // Common equipment maxed means high shiny & glowy progress, but epic at lvl 1 means starry is 0%
        assert.ok(progress.shiny > 0);
        assert.ok(progress.glowy > 0);
        assert.strictEqual(progress.starry, 0);

        const expectedOverall = Math.round((progress.shiny + progress.glowy + progress.starry) / 3);
        assert.strictEqual(progress.overall, expectedOverall);
        assert.notStrictEqual(progress.overall, progress.shiny);
    });

    test('calculateEquipmentProgress returns 100% across all metrics when all equipment is maxed', () => {
        const ownedHeroes = {
            'Barbarian King': { name: 'Barbarian King', level: 95 }
        };
        const ownedEquipment = {
            'Barbarian Puppet': 18,
            'Rage Vial': 18,
            'Earthquake Boots': 18,
            'Vampstache': 18,
            'Giant Gauntlet': 27,
            'Spiky Ball': 27,
            'Snake Bracelet': 27,
            'Stick Horse': 27
        };

        const progress = calculateEquipmentProgress(ownedEquipment, ownedHeroes);
        assert.strictEqual(progress.shiny, 100);
        assert.strictEqual(progress.glowy, 100);
        assert.strictEqual(progress.starry, 100);
        assert.strictEqual(progress.overall, 100);
    });

    test('getOverallGradient generates expected CSS gradient based on progress', () => {
        const maxedProgress = { overall: 100, shiny: 100, glowy: 100, starry: 100 };
        assert.strictEqual(getOverallGradient(maxedProgress), '');

        const zeroProgress = { overall: 0, shiny: 0, glowy: 0, starry: 0 };
        assert.strictEqual(
            getOverallGradient(zeroProgress),
            'linear-gradient(90deg, #00b0ff 0%, #aa00ff 50%, #ffd700 100%)'
        );

        const partialProgress = { overall: 50, shiny: 60, glowy: 40, starry: 20 };
        const gradient = getOverallGradient(partialProgress);
        assert.ok(gradient.startsWith('linear-gradient(90deg, #00b0ff 0%, #aa00ff'));
    });
});
