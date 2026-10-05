import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateEquipmentProgress, getOverallGradient } from '../../js/domain/equipment/equipmentProgressDomain.js';

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

        // All 3 ores active: balanced
        const equalThree = { overall: 50, shiny: 50, glowy: 50, starry: 50 };
        assert.strictEqual(
            getOverallGradient(equalThree),
            'linear-gradient(90deg, #00b0ff 0%, #aa00ff 50%, #ffd700 100%)'
        );

        // All 3 ores active: weighted towards Shiny
        const weightedThree = { overall: 50, shiny: 60, glowy: 40, starry: 20 };
        const gradientWeighted = getOverallGradient(weightedThree);
        assert.ok(gradientWeighted.startsWith('linear-gradient(90deg, #00b0ff 0%, #aa00ff 67%, #ffd700 100%)'));

        // 2 ores active: Shiny + Glowy (drops Starry gold)
        const shinyGlowy = { overall: 33, shiny: 50, glowy: 50, starry: 0 };
        const gradSG = getOverallGradient(shinyGlowy);
        assert.ok(gradSG.includes('#00b0ff') && gradSG.includes('#aa00ff'));
        assert.ok(!gradSG.includes('#ffd700'), 'Should omit Starry gold when Starry is 0');

        // 2 ores active: Shiny + Starry (drops Glowy purple)
        const shinyStarry = { overall: 33, shiny: 50, glowy: 0, starry: 50 };
        const gradSSt = getOverallGradient(shinyStarry);
        assert.ok(gradSSt.includes('#00b0ff') && gradSSt.includes('#ffd700'));
        assert.ok(!gradSSt.includes('#aa00ff'), 'Should omit Glowy purple when Glowy is 0');

        // 2 ores active: Glowy + Starry (drops Shiny blue)
        const glowyStarry = { overall: 33, shiny: 0, glowy: 50, starry: 50 };
        const gradGSt = getOverallGradient(glowyStarry);
        assert.ok(gradGSt.includes('#aa00ff') && gradGSt.includes('#ffd700'));
        assert.ok(!gradGSt.includes('#00b0ff'), 'Should omit Shiny blue when Shiny is 0');

        // 1 ore active: Shiny only (tonal blue)
        const shinyOnly = { overall: 17, shiny: 50, glowy: 0, starry: 0 };
        const gradS = getOverallGradient(shinyOnly);
        assert.ok(gradS.includes('#00b0ff') && gradS.includes('#0091ea'));
        assert.ok(!gradS.includes('#aa00ff') && !gradS.includes('#ffd700'));

        // 1 ore active: Glowy only (tonal purple)
        const glowyOnly = { overall: 17, shiny: 0, glowy: 50, starry: 0 };
        const gradG = getOverallGradient(glowyOnly);
        assert.ok(gradG.includes('#aa00ff') && gradG.includes('#e040fb'));
        assert.ok(!gradG.includes('#00b0ff') && !gradG.includes('#ffd700'));

        // 1 ore active: Starry only (tonal gold)
        const starryOnly = { overall: 17, shiny: 0, glowy: 0, starry: 50 };
        const gradSt = getOverallGradient(starryOnly);
        assert.ok(gradSt.includes('#ffab00') && gradSt.includes('#ffd700'));
        assert.ok(!gradSt.includes('#00b0ff') && !gradSt.includes('#aa00ff'));
    });
});
