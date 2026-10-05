/**
 * Feature Domain Tests for Damage Calculator Sync Service.
 * Validates player data synchronization, spell/equipment level mapping, and state resets.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const _testDir = path.dirname(fileURLToPath(import.meta.url));
const _targetsDir = path.resolve(_testDir, '../../js/data/targets');
globalThis.fetch = (url) => {
    const file = String(url).split('/').pop();
    const data = JSON.parse(readFileSync(path.resolve(_targetsDir, file), 'utf8'));
    return Promise.resolve({ json: () => Promise.resolve(data) });
};

import { preloadDefensesData } from '../../js/data/defenseTargetsData.js';
import {
    damageCalcState,
    resetDamageCalcState
} from '../../js/components/damage/damageCalcState.js';
import { syncPlayerVillageData } from '../../js/components/damage/damageCalcSyncService.js';

await preloadDefensesData();

test('Damage Calculator Sync Service Suite', async (t) => {
    // Mock localStorage
    const mockStorage = new Map();
    globalThis.localStorage = {
        getItem: (k) => mockStorage.get(k) || null,
        setItem: (k, v) => mockStorage.set(k, String(v)),
        removeItem: (k) => mockStorage.delete(k),
        clear: () => mockStorage.clear()
    };

    t.beforeEach(() => {
        mockStorage.clear();
        resetDamageCalcState();
    });

    await t.test('syncPlayerVillageData updates tag and townHallLevel', () => {
        syncPlayerVillageData({
            tag: '#ABC123XYZ',
            townHallLevel: 17
        });

        assert.equal(damageCalcState.activeTag, '#ABC123XYZ');
        assert.equal(damageCalcState.playerTownHall, 17);
    });

    await t.test('syncPlayerVillageData handles null or non-object gracefully', () => {
        syncPlayerVillageData(null);
        syncPlayerVillageData(undefined);
        syncPlayerVillageData('invalid');
        assert.equal(damageCalcState.playerTownHall, 18);
    });

    await t.test('syncPlayerVillageData maps spell levels from array payload', () => {
        syncPlayerVillageData({
            townHallLevel: 16,
            spells: [
                { name: 'Lightning Spell', level: 11 },
                { name: 'Earthquake Spell', level: 6 }
            ]
        });

        assert.equal(damageCalcState.offense.spells.lightning, 11);
        assert.equal(damageCalcState.zapQuake.lightningLevel, 11);
        assert.equal(damageCalcState.offense.spells.earthquake, 6);
        assert.equal(damageCalcState.zapQuake.earthquakeLevel, 6);
    });

    await t.test('syncPlayerVillageData sets unowned equipment to disabled and level 1', () => {
        syncPlayerVillageData({
            townHallLevel: 18,
            heroEquipment: [
                { name: 'Spiky Ball', level: 24 }
            ]
        });

        assert.equal(damageCalcState.offense.equipment.spiky_ball, 24);
        assert.equal(damageCalcState.offense.enabledSources.spiky_ball, true);

        // Giant Arrow not owned -> level 1, disabled
        assert.equal(damageCalcState.offense.equipment.giant_arrow, 1);
        assert.equal(damageCalcState.offense.enabledSources.giant_arrow, false);
    });
});
