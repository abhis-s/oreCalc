/**
 * Feature Domain Tests for Damage Calculator State Management.
 * Tests default initialization, state loading, localStorage persistence, player village sync, and reset.
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
    loadPersistedState,
    persistState,
    resetDamageCalcState,
    getShownTownHall,
    setPlayerTownHall,
    applyTownHallPreset,
    resetDefenseOverrides
} from '../../js/components/damage/damageCalcState.js';
import { syncPlayerVillageData } from '../../js/components/damage/damageCalcSyncService.js';
import { getDefaultSuperchargeTier } from '../../js/domain/damage/defenseProgressionDomain.js';
await preloadDefensesData();

test('Damage Calculator State Management', async (t) => {
    // Mock localStorage
    const mockStorage = new Map();
    globalThis.localStorage = {
        getItem: (k) => mockStorage.get(k) || null,
        setItem: (k, v) => mockStorage.set(k, String(v)),
        removeItem: (k) => mockStorage.delete(k),
        clear: () => mockStorage.clear()
    };

    await t.test('Initializes with canonical default state', () => {
        resetDamageCalcState();
        assert.equal(damageCalcState.activeTab, 'zapquake');
        assert.equal(damageCalcState.playerTownHall, 18);
        assert.equal(damageCalcState.leagueId, 'standard');
        assert.equal(damageCalcState.globalSuperchargeTier, 2);
        assert.equal(damageCalcState.zapQuake.buildingFilter, 'all');
        assert.equal(damageCalcState.simulator.targetDefenseKey, 'scattershot');
        assert.equal(damageCalcState.simulator.targetDefenseLevel, 7);
        assert.equal(damageCalcState.simulator.superchargeTier, getDefaultSuperchargeTier('scattershot', 7, 18));
        assert.equal(damageCalcState.offense.enabledSources.lightning, true);
        assert.equal(damageCalcState.offense.enabledSources.giant_arrow, true);
        assert.equal(damageCalcState.simulator.steps.length, 3);
    });

    await t.test('Persists state and reloads from localStorage', () => {
        resetDamageCalcState();
        damageCalcState.activeTab = 'cluster_planner';
        damageCalcState.leagueId = 'esports';
        damageCalcState.globalSuperchargeTier = 1;
        damageCalcState.zapQuake.buildingFilter = 'all';

        damageCalcState.zapQuake.searchQuery = 'inferno';
        damageCalcState.zapQuake.combosExpanded = true;
        damageCalcState.zapQuake.isRemainingExpanded = true;
        damageCalcState.zapQuake.selectedComboIndex = 3;
        damageCalcState.zapQuake.selectedClusterComboIndex = 2;

        persistState();

        const persistedJson = JSON.parse(mockStorage.get('clashCalc_damageCalcState'));
        assert.equal(persistedJson.zapQuake.combosExpanded, true, 'combosExpanded must be preserved');
        assert.equal(persistedJson.zapQuake.isRemainingExpanded, true, 'isRemainingExpanded must be preserved');
        assert.equal(persistedJson.zapQuake.selectedComboIndex, 3, 'selectedComboIndex must be preserved');
        assert.equal(persistedJson.zapQuake.selectedClusterComboIndex, 2, 'selectedClusterComboIndex must be preserved');
        assert.equal(persistedJson.zapQuake.mobileDockExpanded, undefined, 'mobileDockExpanded does not exist on persisted state');
        assert.equal(persistedJson.zapQuake.searchQuery, 'inferno', 'searchQuery must be preserved');

        // Mutate in-memory
        damageCalcState.activeTab = 'simulator';
        damageCalcState.leagueId = 'legend1';
        damageCalcState.globalSuperchargeTier = 2;
        damageCalcState.zapQuake.buildingFilter = 'defenses';

        // Reload
        loadPersistedState();
        assert.equal(damageCalcState.activeTab, 'cluster_planner');
        assert.equal(damageCalcState.leagueId, 'esports');
        assert.equal(damageCalcState.globalSuperchargeTier, 1);
        assert.equal(damageCalcState.zapQuake.buildingFilter, 'all');

        // Verify loaded state
        assert.equal(damageCalcState.zapQuake.combosExpanded, true);
        assert.equal(damageCalcState.zapQuake.isRemainingExpanded, true);
        assert.equal(damageCalcState.zapQuake.selectedComboIndex, 3);
        assert.equal(damageCalcState.zapQuake.selectedClusterComboIndex, 2);
        assert.equal(damageCalcState.zapQuake.searchQuery, 'inferno');
        assert.equal(damageCalcState.zapQuake.mobileDockExpanded, false, 'mobileDockExpanded defaults to false in-memory');
    });

    await t.test('Synchronizes normalized spells object into offense and zapQuake levels', () => {
        resetDamageCalcState();
        const playerData = {
            tag: '#SPELLNORM1',
            townHallLevel: 17,
            spells: {
                lightning: 12,
                earthquake: 7
            }
        };
        syncPlayerVillageData(playerData);
        assert.equal(damageCalcState.offense.spells.lightning, 12);
        assert.equal(damageCalcState.offense.spells.earthquake, 7);
        assert.equal(damageCalcState.zapQuake.lightningLevel, 12);
        assert.equal(damageCalcState.zapQuake.earthquakeLevel, 7);
    });

    await t.test('Synchronizes player village data and clamps defense levels to player TH', () => {
        resetDamageCalcState();
        const playerData = {
            tag: '#8PJYGUJC',
            townHallLevel: 15,
            heroEquipment: [
                { name: 'Giant Arrow', level: 17 },
                { name: 'Earthquake Boots', level: 15 }
            ]
        };

        syncPlayerVillageData(playerData);
        assert.equal(damageCalcState.activeTag, '#8PJYGUJC');
        assert.equal(damageCalcState.playerTownHall, 15);
        assert.equal(damageCalcState.offense.equipment.giant_arrow, 17);
        assert.equal(damageCalcState.globalSuperchargeTier, 0);
    });

    await t.test('Preserves true playerTownHall < 9 without clamping to 9, while getShownTownHall returns 9', () => {
        resetDamageCalcState();
        const lowThData = {
            tag: '#LOWTH7',
            townHallLevel: 7
        };

        syncPlayerVillageData(lowThData);
        assert.equal(damageCalcState.activeTag, '#LOWTH7');
        assert.equal(damageCalcState.playerTownHall, 7, 'True playerTownHall must remain 7 without clamping to 9');
        assert.equal(getShownTownHall(damageCalcState), 9, 'Shown Town Hall for damage calculator must clamp to 9');

        // Test persistence round-trip for low TH
        persistState();
        damageCalcState.playerTownHall = 18;
        loadPersistedState();
        assert.equal(damageCalcState.playerTownHall, 7, 'Persisted state must preserve playerTownHall: 7');
        assert.equal(getShownTownHall(damageCalcState), 9, 'Shown Town Hall must remain 9 after reloading');
    });

    await t.test('Automatically selects battle modifier based on player leagueTier or league', () => {
        resetDamageCalcState();
        assert.equal(damageCalcState.leagueId, 'standard');

        // Legend League (ID 105000036 or name Legend League / Legend I) -> legend1
        syncPlayerVillageData({
            leagueTier: { id: 105000036, name: 'Legend League' }
        });
        assert.equal(damageCalcState.leagueId, 'legend1');

        // Legend League II (ID 105000035 or name Legend League II) -> legend2
        syncPlayerVillageData({
            leagueTier: { id: 105000035, name: 'Legend League II' }
        });
        assert.equal(damageCalcState.leagueId, 'legend2');

        // Legend League III (ID 105000034 or name Legend League III) -> legend3
        syncPlayerVillageData({
            leagueTier: { id: 105000034, name: 'Legend League III' }
        });
        assert.equal(damageCalcState.leagueId, 'legend3');

        // Non-legend league (e.g. Titan League I) -> standard
        syncPlayerVillageData({
            leagueTier: { id: 105000033, name: 'Titan League I' }
        });
        assert.equal(damageCalcState.leagueId, 'standard');

        // Fallback playerData.league object format
        syncPlayerVillageData({
            league: { id: 105000036, name: 'Legend League' }
        });
        assert.equal(damageCalcState.leagueId, 'legend1');

        // Fallback nested playerProfile.leagueTier object format
        syncPlayerVillageData({
            playerProfile: { leagueTier: { id: 105000035, name: 'Legend League II' } }
        });
        assert.equal(damageCalcState.leagueId, 'legend2');
        assert.equal(damageCalcState.modifier, 'legend2');
    });

    await t.test('Respects explicit user modifier override during syncPlayerVillageData', () => {
        resetDamageCalcState();
        assert.equal(damageCalcState.modifier, 'standard');
        assert.equal(damageCalcState.isModifierExplicit, false);

        // User explicitly switches to esports
        damageCalcState.modifier = 'esports';
        damageCalcState.isModifierExplicit = true;

        // Player village data arrives with Legend 1 league
        syncPlayerVillageData({
            leagueTier: { id: 105000036, name: 'Legend League' }
        });

        // Explicit choice must NOT be clobbered
        assert.equal(damageCalcState.modifier, 'esports');
        assert.equal(damageCalcState.leagueId, 'esports');
    });

    await t.test('leagueId acts as a two-way alias for modifier', () => {
        resetDamageCalcState();
        damageCalcState.modifier = 'legend3';
        assert.equal(damageCalcState.leagueId, 'legend3');

        damageCalcState.leagueId = 'legend1';
        assert.equal(damageCalcState.modifier, 'legend1');
    });

    await t.test('resetDamageCalcState restores all default values and enables all equipment for guest mode', () => {
        damageCalcState.activeTab = 'simulator';
        damageCalcState.playerTownHall = 12;
        damageCalcState.modifier = 'esports';
        damageCalcState.isModifierExplicit = true;
        resetDamageCalcState();

        assert.equal(damageCalcState.activeTab, 'zapquake');
        assert.equal(damageCalcState.playerTownHall, 18);
        assert.equal(damageCalcState.modifier, 'standard');
        assert.equal(damageCalcState.leagueId, 'standard');
        assert.equal(damageCalcState.isModifierExplicit, false);

        // Guest mode default: all equipment enabled and maxed
        assert.equal(damageCalcState.offense.enabledSources.spiky_ball, true);
        assert.equal(damageCalcState.offense.enabledSources.giant_arrow, true);
        assert.equal(damageCalcState.offense.enabledSources.fireball, true);
        assert.equal(damageCalcState.offense.enabledSources.seeking_shield, true);
        assert.equal(damageCalcState.offense.enabledSources.flame_blower, true);
        assert.equal(damageCalcState.offense.enabledSources.rocket_backpack, true);
        assert.equal(damageCalcState.offense.equipment.spiky_ball, 27);
        assert.equal(damageCalcState.offense.equipment.giant_arrow, 18);
    });

    await t.test('Profile switching with same Town Hall preserves defense overrides and cluster planner', () => {
        resetDamageCalcState();
        assert.equal(damageCalcState.playerTownHall, 18);

        // Set user overrides on player A
        damageCalcState.defenseLevelOverrides = { air_defense: 15 };
        damageCalcState.defenseSuperchargeOverrides = { scattershot: 1 };
        damageCalcState.zapQuake.selectedCluster = [{ defenseKey: 'air_defense', level: 15, superchargeTier: 0 }];

        // Switch to player B (same TH18)
        syncPlayerVillageData({
            tag: '#PLAYER_B',
            townHallLevel: 18,
            heroEquipment: [{ name: 'Giant Arrow', level: 18 }]
        }, { resetUI: false });

        assert.equal(damageCalcState.activeTag, '#PLAYER_B');
        assert.equal(damageCalcState.playerTownHall, 18);
        assert.equal(damageCalcState.defenseLevelOverrides.air_defense, 15, 'Defense level override must be preserved');
        assert.equal(damageCalcState.defenseSuperchargeOverrides.scattershot, 1, 'Supercharge override must be preserved');
        assert.equal(damageCalcState.zapQuake.selectedCluster.length, 1, 'Cluster selection must be preserved');
    });

    await t.test('Profile switching with different Town Hall resets defense overrides, clusters, and global supercharge', () => {
        resetDamageCalcState();
        assert.equal(damageCalcState.playerTownHall, 18);

        damageCalcState.defenseLevelOverrides = { air_defense: 15 };
        damageCalcState.defenseSuperchargeOverrides = { air_defense: 1 };
        damageCalcState.zapQuake.selectedCluster = [{ defenseKey: 'air_defense', level: 15, superchargeTier: 1 }];

        // Switch to player C (TH17, different Town Hall)
        syncPlayerVillageData({
            tag: '#PLAYER_C',
            townHallLevel: 17,
            heroEquipment: [{ name: 'Giant Arrow', level: 15 }]
        }); // resetUI defaults to (prevTh !== targetTh) === true

        assert.equal(damageCalcState.activeTag, '#PLAYER_C');
        assert.equal(damageCalcState.playerTownHall, 17);
        assert.deepEqual(damageCalcState.defenseLevelOverrides, {}, 'Defense level overrides must be wiped on TH change');
        assert.deepEqual(damageCalcState.defenseSuperchargeOverrides, {}, 'Supercharge overrides must be wiped on TH change');
        assert.deepEqual(damageCalcState.zapQuake.selectedCluster, [], 'Cluster must be cleared on TH change');
        assert.equal(damageCalcState.globalSuperchargeTier, 0, 'Global supercharge must reset to 0 for TH17');
    });

    await t.test('Disables unowned equipment by default on synced player profiles', () => {
        resetDamageCalcState();

        // Sync a player who only owns Giant Arrow and Fireball
        syncPlayerVillageData({
            tag: '#PARTIAL_EQUIP',
            townHallLevel: 16,
            heroEquipment: [
                { name: 'Giant Arrow', level: 16 },
                { name: 'Fireball', level: 21 }
            ]
        });

        // Owned equipment enabled and levels set from API payload
        assert.equal(damageCalcState.offense.enabledSources.giant_arrow, true);
        assert.equal(damageCalcState.offense.enabledSources.fireball, true);
        assert.equal(damageCalcState.offense.equipment.giant_arrow, 16);
        assert.equal(damageCalcState.offense.equipment.fireball, 21);

        // Unowned equipment disabled and defaulted to level 1
        assert.equal(damageCalcState.offense.enabledSources.spiky_ball, false);
        assert.equal(damageCalcState.offense.enabledSources.seeking_shield, false);
        assert.equal(damageCalcState.offense.enabledSources.flame_blower, false);
        assert.equal(damageCalcState.offense.enabledSources.rocket_backpack, false);
        assert.equal(damageCalcState.offense.equipment.spiky_ball, 1);
        assert.equal(damageCalcState.offense.equipment.seeking_shield, 1);
        assert.equal(damageCalcState.offense.equipment.flame_blower, 1);
        assert.equal(damageCalcState.offense.equipment.rocket_backpack, 1);

        // Spells remain enabled
        assert.equal(damageCalcState.offense.enabledSources.lightning, true);
        assert.equal(damageCalcState.offense.enabledSources.earthquake, true);
    });

    await t.test('First player onboarding only inhibits unowned equipment and preserves guest preferences', () => {
        resetDamageCalcState();

        // Guest mode baseline: all equipment enabled and maxed
        assert.equal(damageCalcState.offense.equipment.spiky_ball, 27);
        assert.equal(damageCalcState.offense.equipment.giant_arrow, 18);
        assert.equal(damageCalcState.offense.enabledSources.giant_arrow, true);
        assert.equal(damageCalcState.offense.enabledSources.fireball, true);

        // User customizes guest state: disables Giant Arrow, sets a defense level override
        damageCalcState.offense.enabledSources.giant_arrow = false;
        damageCalcState.defenseLevelOverrides.air_defense = 12;

        // First player added who owns Giant Arrow (lvl 15) and Fireball (lvl 20), but not Spiky Ball
        syncPlayerVillageData({
            tag: '#FIRST_PLAYER',
            townHallLevel: 18,
            heroEquipment: [
                { name: 'Giant Arrow', level: 15 },
                { name: 'Fireball', level: 20 }
            ]
        }, { resetUI: false, isFirstPlayer: true });

        // Unowned equipment is inhibited (disabled and level 1)
        assert.equal(damageCalcState.offense.enabledSources.spiky_ball, false);
        assert.equal(damageCalcState.offense.equipment.spiky_ball, 1);

        // Owned equipment levels come from API
        assert.equal(damageCalcState.offense.equipment.giant_arrow, 15);
        assert.equal(damageCalcState.offense.equipment.fireball, 20);

        // Owned equipment toggles are only inhibited: user's guest toggle is preserved
        assert.equal(damageCalcState.offense.enabledSources.giant_arrow, false);
        assert.equal(damageCalcState.offense.enabledSources.fireball, true);

        // Building overrides preserved because Town Hall did not change
        assert.equal(damageCalcState.defenseLevelOverrides.air_defense, 12);

        // Guest reset restores max levels and enables all equipment
        resetDamageCalcState();
        assert.equal(damageCalcState.offense.equipment.spiky_ball, 27);
        assert.equal(damageCalcState.offense.equipment.giant_arrow, 18);
        assert.equal(damageCalcState.offense.equipment.fireball, 27);
        assert.equal(damageCalcState.offense.equipment.seeking_shield, 18);
        assert.equal(damageCalcState.offense.enabledSources.spiky_ball, true);
        assert.equal(damageCalcState.offense.enabledSources.giant_arrow, true);
        assert.equal(damageCalcState.offense.enabledSources.fireball, true);
        assert.equal(damageCalcState.offense.enabledSources.seeking_shield, true);
    });

    await t.test('Town Hall switching and presets clamp cluster targets to active Town Hall maximums', () => {
        resetDamageCalcState();
        damageCalcState.playerTownHall = 18;
        damageCalcState.zapQuake.selectedCluster = [
            { defenseKey: 'town_hall', level: 18, superchargeTier: 2 },
            { defenseKey: 'clan_castle', level: 14, superchargeTier: 2 },
            { defenseKey: 'monolith', level: 5, superchargeTier: 2 }
        ];

        // Switch to TH16
        setPlayerTownHall(16);
        assert.equal(damageCalcState.zapQuake.selectedCluster.length, 3);
        assert.equal(damageCalcState.zapQuake.selectedCluster[0].level, 16, 'Town Hall level clamped to 16');
        assert.equal(damageCalcState.zapQuake.selectedCluster[0].superchargeTier, 0, 'Supercharge reset to 0 below TH18');
        assert.equal(damageCalcState.zapQuake.selectedCluster[1].level, 12, 'Clan Castle level clamped to 12');
        assert.equal(damageCalcState.zapQuake.selectedCluster[2].level, 3, 'Monolith level clamped to 3 at TH16');

        // Apply Town Hall 15 preset
        applyTownHallPreset(15);
        assert.equal(damageCalcState.zapQuake.selectedCluster[0].level, 15, 'Town Hall level set to 15 max');
        assert.equal(damageCalcState.zapQuake.selectedCluster[1].level, 11, 'Clan Castle level set to 15 max (11)');
        assert.equal(damageCalcState.zapQuake.selectedCluster[2].level, 2, 'Monolith level set to 15 max (2)');

        // Reset overrides resets back to active Town Hall max
        resetDefenseOverrides();
        assert.equal(damageCalcState.zapQuake.selectedCluster[0].level, 15);
        assert.equal(damageCalcState.zapQuake.selectedCluster[1].level, 11);
        assert.equal(damageCalcState.zapQuake.selectedCluster[2].level, 2);
    });
});
