/**
 * Feature Domain Tests for Damage Calculator Supercharge Defaults.
 * Validates dynamic derivation of maximum supercharge tiers without hardcoded tier numbers.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const _testDir = path.dirname(fileURLToPath(import.meta.url));
const _targetsDir = path.resolve(_testDir, '../../js/data/targets');
const _enJson = JSON.parse(readFileSync(path.resolve(_testDir, '../../js/i18n/en.json'), 'utf8'));
globalThis.fetch = (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/en.json')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(_enJson) });
    }
    const file = urlStr.split('/').pop();
    const data = JSON.parse(readFileSync(path.resolve(_targetsDir, file), 'utf8'));
    return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
};

import { MAX_TOWN_HALL } from '../../js/core/constants.js';
import { loadTranslations } from '../../js/i18n/translator.js';
import { preloadDefensesData, getDefensesData } from '../../js/data/defenseTargetsData.js';
import {
    getMaxSuperchargeTier,
    getMaxSuperchargeTierForTownHall,
    isSuperchargeAvailableForTownHall,
    getDefaultSuperchargeTier,
    getDefenseMaxHp
} from '../../js/domain/damage/defenseProgressionDomain.js';
import { solveAllDefensesZapQuake } from '../../js/domain/damage/zapQuakeBatchSolver.js';
import {
    damageCalcState,
    resetDamageCalcState,
    setPlayerTownHall,
    setGlobalSuperchargeTier,
    getGlobalSuperchargeTier
} from '../../js/components/damage/damageCalcState.js';
import { syncPlayerVillageData } from '../../js/components/damage/damageCalcSyncService.js';
import { getDashboardComboBuckets } from '../../js/domain/damage/zapQuakeDashboardDomain.js';
import { getComboBreakdownPopoverContent } from '../../js/components/damage/damageCalcGridPopoversDisplay.js';
await Promise.all([preloadDefensesData(), loadTranslations('en')]);

test('Dynamic Supercharge Derivation & Defaults', async (t) => {
    await t.test('getMaxSuperchargeTier dynamically extracts max tier from getDefensesData()', () => {
        // Inferno tower level 12 has supercharges in data
        const infMaxLvl = getDefensesData().inferno_tower.maxLevel;
        const infMaxTier = getMaxSuperchargeTier('inferno_tower', infMaxLvl);
        assert.ok(infMaxTier > 0, 'Inferno tower max level must have supercharge tiers > 0');

        // Verify it matches dynamically calculated keys from raw data
        const rawSupercharges = getDefensesData().inferno_tower.levels[infMaxLvl]?.supercharges || {};
        const expectedTier = Object.keys(rawSupercharges).reduce((max, key) => {
            const m = key.match(/tier(\d+)/i);
            return m ? Math.max(max, Number(m[1]) || 0) : max;
        }, 0);
        assert.equal(infMaxTier, expectedTier, 'Derived tier must match raw data max tier');

        // Below max level must return 0
        assert.equal(getMaxSuperchargeTier('inferno_tower', infMaxLvl - 1), 0);

        // Non-superchargeable structures (Air Sweeper) must return 0
        const asMaxLvl = getDefensesData().air_sweeper.maxLevel;
        assert.equal(getMaxSuperchargeTier('air_sweeper', asMaxLvl), 0);

        // Non-existent building or level must return 0 safely
        assert.equal(getMaxSuperchargeTier('non_existent_defense', 1), 0);
        assert.equal(getMaxSuperchargeTier('inferno_tower', 999), 0);
    });

    await t.test('getMaxSuperchargeTierForTownHall derives max tier across all structures for a given Town Hall', () => {
        const thMaxTier = getMaxSuperchargeTierForTownHall(MAX_TOWN_HALL);
        assert.ok(thMaxTier > 0, `TH${MAX_TOWN_HALL} must have supercharge tiers > 0`);
        assert.equal(isSuperchargeAvailableForTownHall(MAX_TOWN_HALL), true);
        assert.equal(isSuperchargeAvailableForTownHall(MAX_TOWN_HALL - 1), false);

        // Town Hall 18 and below have 0 supercharges
        assert.equal(getMaxSuperchargeTierForTownHall(18), 0);
        assert.equal(getMaxSuperchargeTierForTownHall(17), 0);
        assert.equal(getMaxSuperchargeTierForTownHall(16), 0);
        assert.equal(getMaxSuperchargeTierForTownHall(15), 0);
    });

    await t.test('getDefaultSuperchargeTier returns max tier at active max TH and 0 at lower Town Halls', () => {
        const infMaxLvl = getDefensesData().inferno_tower.maxLevel;
        const expectedMaxTier = getMaxSuperchargeTier('inferno_tower', infMaxLvl);

        // Max TH: superchargeable structure defaults to its max tier
        assert.equal(getDefaultSuperchargeTier('inferno_tower', infMaxLvl, MAX_TOWN_HALL), expectedMaxTier);

        // Max TH: non-superchargeable structure defaults to 0
        const asMaxLvl = getDefensesData().air_sweeper.maxLevel;
        assert.equal(getDefaultSuperchargeTier('air_sweeper', asMaxLvl, MAX_TOWN_HALL), 0);

        // Lower TH: defaults to 0 even for Inferno Tower
        assert.equal(getDefaultSuperchargeTier('inferno_tower', infMaxLvl, MAX_TOWN_HALL - 1), 0);
        assert.equal(getDefaultSuperchargeTier('inferno_tower', infMaxLvl, 16), 0);
    });

    await t.test('solveAllDefensesZapQuake defaults to max supercharge tier at active max TH when superchargeTier is undefined', () => {
        const results = solveAllDefensesZapQuake({
            lightningLevel: 14,
            earthquakeLevel: 8,
            townHall: MAX_TOWN_HALL,
            leagueId: 'standard'
        });

        const infResult = results.find(r => r.defenseKey === 'inferno_tower');
        assert.ok(infResult, `Inferno Tower must be present in TH${MAX_TOWN_HALL} results`);

        const infMaxLvl = getDefensesData().inferno_tower.maxLevel;
        const expectedTier = getDefaultSuperchargeTier('inferno_tower', infMaxLvl, MAX_TOWN_HALL);
        const expectedHp = getDefenseMaxHp('inferno_tower', infMaxLvl, { superchargeTier: expectedTier });

        assert.equal(infResult.superchargeTier, expectedTier, 'Supercharge tier must default to max tier');
        assert.equal(infResult.maxHp, expectedHp, 'Max HP must reflect supercharged hitpoints');
    });

    await t.test('damageCalcState initializes with active max TH and max supercharge tier defaults', () => {
        resetDamageCalcState();
        assert.equal(damageCalcState.playerTownHall, MAX_TOWN_HALL);
        assert.equal(damageCalcState.globalSuperchargeTier, getMaxSuperchargeTierForTownHall(MAX_TOWN_HALL));

        const simKey = damageCalcState.simulator.targetDefenseKey;
        const simLvl = damageCalcState.simulator.targetDefenseLevel;
        const expectedSimTier = getDefaultSuperchargeTier(simKey, simLvl, MAX_TOWN_HALL);
        assert.equal(damageCalcState.simulator.superchargeTier, expectedSimTier);
    });

    await t.test('syncPlayerVillageData updates superchargeTier dynamically for TH19 and non-max profiles', () => {
        resetDamageCalcState();

        // Sync a TH19 player (active max TH -> Tier 2 supercharge)
        syncPlayerVillageData({
            tag: '#TH19PLAYER',
            townHallLevel: MAX_TOWN_HALL,
            heroEquipment: []
        });
        assert.equal(damageCalcState.playerTownHall, MAX_TOWN_HALL);
        assert.equal(damageCalcState.globalSuperchargeTier, 2);

        // Sync a TH18 player (non-max TH -> 0 supercharge)
        syncPlayerVillageData({
            tag: '#TH18PLAYER',
            townHallLevel: 18,
            heroEquipment: []
        });
        assert.equal(damageCalcState.playerTownHall, 18);
        assert.equal(damageCalcState.globalSuperchargeTier, 0);
        assert.equal(damageCalcState.simulator.superchargeTier, 0);

        // Sync a TH17 player
        syncPlayerVillageData({
            tag: '#TH17PLAYER',
            townHallLevel: 17,
            heroEquipment: []
        });
        assert.equal(damageCalcState.playerTownHall, 17);
        assert.equal(damageCalcState.globalSuperchargeTier, 0);
        assert.equal(damageCalcState.simulator.superchargeTier, 0);
    });

    await t.test('getComboBreakdownPopoverContent renders overkill row and omits total damage row', () => {
        resetDamageCalcState();
        // Mock element for single equipment combo (e.g. Giant Arrow on Air Defense)
        const mockSingleEquipCard = {
            closest: () => mockSingleEquipCard,
            getAttribute: (attr) => {
                const attrs = {
                    'data-combo-defense-info': 'true',
                    'data-building-key': 'air_defense',
                    'data-building-level': '16',
                    'data-supercharge': '2',
                    'data-eq-count': '0',
                    'data-zap-count': '0',
                    'data-equip': JSON.stringify([{ id: 'giant_arrow', level: 18 }]),
                    'data-max-hp': '2000'
                };
                return attrs[attr] || null;
            }
        };

        const popoverSingle = getComboBreakdownPopoverContent(mockSingleEquipCard, damageCalcState);
        assert.ok(popoverSingle, 'Popover content must be returned');
        assert.ok(!popoverSingle.body.includes('Total Damage'), 'Must NOT include Total Damage');
        assert.ok(!popoverSingle.body.includes('calc-breakdown-row--total'), 'Must NOT include total row class');
        assert.ok(popoverSingle.body.includes('calc-breakdown-row--overkill'), 'Must include overkill class for single equipment');
        assert.ok(popoverSingle.body.includes('Overkill'), 'Must include Overkill text for single equipment');

        // Mock element for multi-source combo (e.g. Rocket Backpack + 1 EQ on Mortar)
        const mockMultiSourceCard = {
            closest: () => mockMultiSourceCard,
            getAttribute: (attr) => {
                const attrs = {
                    'data-combo-defense-info': 'true',
                    'data-building-key': 'mortar',
                    'data-building-level': '18',
                    'data-supercharge': '2',
                    'data-eq-count': '1',
                    'data-zap-count': '0',
                    'data-equip': JSON.stringify([{ id: 'rocket_backpack', level: 27 }]),
                    'data-max-hp': '2625'
                };
                return attrs[attr] || null;
            }
        };

        const popoverMulti = getComboBreakdownPopoverContent(mockMultiSourceCard, damageCalcState);
        assert.ok(popoverMulti, 'Popover content must be returned');
        assert.ok(!popoverMulti.body.includes('Total Damage'), 'Must NOT include Total Damage');
        assert.ok(!popoverMulti.body.includes('calc-breakdown-row--total'), 'Must NOT include total row class');
        assert.ok(popoverMulti.body.includes('calc-breakdown-row--overkill'), 'Must include overkill class for multi-source combo');
        assert.ok(popoverMulti.body.includes('Overkill'), 'Must include Overkill text for multi-source combo');
    });

    await t.test('Town Hall switching preserves supercharges at max TH and synchronizes solver combo buckets', () => {
        resetDamageCalcState();
        setPlayerTownHall(MAX_TOWN_HALL);
        setGlobalSuperchargeTier(2);

        assert.equal(damageCalcState.playerTownHall, MAX_TOWN_HALL);
        assert.equal(getGlobalSuperchargeTier(damageCalcState), 2);

        // Switch to TH17: global supercharge tier evaluates to 0
        setPlayerTownHall(17);
        assert.equal(damageCalcState.playerTownHall, 17);
        assert.equal(getGlobalSuperchargeTier(damageCalcState), 0);

        // Switch back to max TH: global supercharge tier returns to 2
        setPlayerTownHall(MAX_TOWN_HALL);
        assert.equal(damageCalcState.playerTownHall, MAX_TOWN_HALL);
        assert.equal(getGlobalSuperchargeTier(damageCalcState), 2);

        // Verify combo buckets calculated by getDashboardComboBuckets
        const buckets = getDashboardComboBuckets(damageCalcState);
        const allBuildings = buckets.flatMap(b => b.defenses);
        const firespitter = allBuildings.find(d => d.defenseKey === 'firespitter');

        assert.ok(firespitter, `Firespitter must be present in TH${MAX_TOWN_HALL} combo buckets`);
        assert.equal(firespitter.level, 3, `Firespitter max level at TH${MAX_TOWN_HALL} is 3`);
        assert.equal(firespitter.superchargeTier, 2, 'Firespitter must inherit Supercharge Tier 2');
        assert.equal(firespitter.maxHp, 5550, 'Firespitter HP must reflect Supercharge Tier 2 (5550 HP, not 5300)');

        // Toggling global supercharge tier to 0 at max TH updates solver outputs
        setGlobalSuperchargeTier(0);
        assert.equal(getGlobalSuperchargeTier(damageCalcState), 0);
        const bucketsSc0 = getDashboardComboBuckets(damageCalcState);
        const firespitterSc0 = bucketsSc0.flatMap(b => b.defenses).find(d => d.defenseKey === 'firespitter');
        assert.equal(firespitterSc0.superchargeTier, 0);
        assert.equal(firespitterSc0.maxHp, 5300);

        // Toggling global supercharge tier to 1 at max TH updates solver outputs
        setGlobalSuperchargeTier(1);
        assert.equal(getGlobalSuperchargeTier(damageCalcState), 1);
        const bucketsSc1 = getDashboardComboBuckets(damageCalcState);
        const firespitterSc1 = bucketsSc1.flatMap(b => b.defenses).find(d => d.defenseKey === 'firespitter');
        assert.equal(firespitterSc1.superchargeTier, 1);
        assert.equal(firespitterSc1.maxHp, 5300);
    });
});
