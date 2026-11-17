import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateEquipmentProgress, getOverallGradient } from '../../js/domain/equipment/equipmentProgressDomain.js';

describe('Equipment Progress & Ore Investment Domain Suite', () => {
    test('calculateEquipmentProgress returns zero progress for empty equipment state', () => {
        const progress = calculateEquipmentProgress({});
        assert.equal(progress.overall, 0);
        assert.equal(progress.shiny, 0);
        assert.equal(progress.glowy, 0);
        assert.equal(progress.starry, 0);
        assert.equal(progress.shinySpent, 0);
        assert.ok(progress.shinyTotal > 0);
    });

    test('calculateEquipmentProgress calculates partial progress accurately', () => {
        const owned = {
            barbarianPuppet: 10,
            rageVial: 15
        };

        const progress = calculateEquipmentProgress(owned);
        assert.ok(progress.overall > 0 && progress.overall < 100);
        assert.ok(progress.shinySpent > 0);
        assert.ok(progress.glowySpent > 0);
        assert.equal(progress.starrySpent, 0);
    });

    test('calculateEquipmentProgress filters to unlocked heroes when ownedHeroes is provided', () => {
        const fullProgress = calculateEquipmentProgress({}, null);
        const bkOnlyProgress = calculateEquipmentProgress({}, { barbarianKing: true });

        // Barbarian King only has a fraction of total game equipment
        assert.ok(bkOnlyProgress.shinyTotal < fullProgress.shinyTotal);
        assert.ok(bkOnlyProgress.glowyTotal < fullProgress.glowyTotal);
    });

    test('calculateEquipmentProgress supports player profile wrapper object', () => {
        const playerData = {
            ownedEquipment: {
                giantGauntlet: 27
            },
            ownedHeroes: {
                barbarianKing: true
            }
        };

        const progress = calculateEquipmentProgress(playerData);
        assert.ok(progress.epic.spent.starry > 0);
        assert.equal(progress.epic.spent.starry, 480);
    });

    test('getOverallGradient generates valid linear gradients across ore ratios', () => {
        assert.ok(getOverallGradient({ shiny: 0, glowy: 0, starry: 0 }).includes('linear-gradient'));
        assert.ok(getOverallGradient({ shiny: 10, glowy: 0, starry: 0 }).includes('#00b0ff'));
        assert.ok(getOverallGradient({ shiny: 0, glowy: 10, starry: 0 }).includes('#aa00ff'));
        assert.ok(getOverallGradient({ shiny: 0, glowy: 0, starry: 10 }).includes('#ffd700'));
        assert.ok(getOverallGradient({ shiny: 10, glowy: 10, starry: 10 }).includes('linear-gradient'));
    });
});
