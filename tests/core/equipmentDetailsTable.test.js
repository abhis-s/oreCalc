import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderLevelTable } from '../../js/components/equipment/equipmentDetailsTableDisplay.js';
import { getMaxLabTroopLevelForTownHall } from '../../js/data/labTroopsData.js';
import { updateStatsProgressHover } from '../../js/components/equipment/equipmentDetailsStatsDisplay.js';
import { getCurrentUnitStatsStateMap, updateUnitStatsHover } from '../../js/components/equipment/equipmentDetailsUnitStatsDisplay.js';
import { state } from '../../js/core/state.js';

const barbarianPuppetData = JSON.parse(readFileSync(new URL('../../js/data/equipment/barbarian_puppet.json', import.meta.url), 'utf8'));
const healerPuppetData = JSON.parse(readFileSync(new URL('../../js/data/equipment/healer_puppet.json', import.meta.url), 'utf8'));

describe('Equipment Details Table Display & Data Contracts', () => {
    test('renderLevelTable sets data-level attribute on each level row matching level index', () => {
        const mockTableHead = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
        const mockTableBody = { innerHTML: '' };

        const mockData = {
            rarity: 'common',
            statsMeta: [
                { key: 'damagePerSecond', category: 'ability', valueUnit: 'number' },
                { key: 'hitpoints', category: 'heroBoost', valueUnit: 'number' }
            ]
        };

        const levelsArray = Array.from({ length: 18 }, (_, i) => ({
            stats: { damagePerSecond: (i + 1) * 10, hitpoints: (i + 1) * 50 }
        }));

        renderLevelTable(
            mockTableHead,
            mockTableBody,
            mockData,
            levelsArray,
            1, // currentLevel
            18, // calculatedMaxLevel
            'common',
            'barbarianKing',
            16, // userTH
            'standard',
            null
        );

        const html = mockTableBody.innerHTML;
        assert.ok(html.length > 0, 'Table body HTML should not be empty');

        for (let lvl = 1; lvl <= 18; lvl++) {
            const pattern = new RegExp(`<tr[^>]*data-level="${lvl}"[^>]*>`, 'i');
            assert.match(
                html,
                pattern,
                `Rendered HTML must contain <tr ... data-level="${lvl}"> for level ${lvl}`
            );
        }
    });

    test('renderLevelTable for epic equipment renders all 27 levels with data-level attributes', () => {
        const mockTableHead = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
        const mockTableBody = { innerHTML: '' };

        const mockData = {
            rarity: 'epic',
            statsMeta: [
                { key: 'damagePerSecond', category: 'ability', valueUnit: 'number' }
            ]
        };

        const levelsArray = Array.from({ length: 27 }, (_, i) => ({
            stats: { damagePerSecond: (i + 1) * 15 }
        }));

        renderLevelTable(
            mockTableHead,
            mockTableBody,
            mockData,
            levelsArray,
            10, // currentLevel
            27, // calculatedMaxLevel
            'epic',
            'archerQueen',
            17, // userTH
            'standard',
            null
        );

        const html = mockTableBody.innerHTML;
        assert.ok(html.length > 0, 'Epic table body HTML should not be empty');

        for (let lvl = 1; lvl <= 27; lvl++) {
            const pattern = new RegExp(`<tr[^>]*data-level="${lvl}"[^>]*>`, 'i');
            assert.match(
                html,
                pattern,
                `Epic rendered HTML must contain data-level="${lvl}" on row ${lvl}`
            );
        }

        // Total cost row should not have data-level attribute
        const totalCostMatch = html.match(/<tr class="total-cost-row"[^>]*>/);
        assert.ok(totalCostMatch, 'Total cost row should be present');
        assert.doesNotMatch(
            totalCostMatch[0],
            /data-level/,
            'Total cost row must not contain a data-level attribute'
        );
    });

    test('renderLevelTable calculates total remaining upgrade cost up to true max under esports mode', () => {
        const mockTableHead = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
        const mockTableBody = { innerHTML: '' };

        const mockLegendaryData = {
            rarity: 'legendary',
            costSchedule: 'modern',
            statsMeta: [
                { key: 'auraDps', category: 'ability', valueUnit: 'number' }
            ]
        };

        const legendaryLevels = Array.from({ length: 33 }, (_, i) => ({
            stats: { auraDps: (i + 1) * 10 }
        }));

        // Case A: Blizzard Axe at Level 15 in esports mode
        renderLevelTable(
            mockTableHead,
            mockTableBody,
            mockLegendaryData,
            legendaryLevels,
            15, // currentLevel
            33, // calculatedMaxLevel (true max)
            'legendary',
            'barbarianKing',
            18, // userTH
            'esports',
            null
        );

        let html = mockTableBody.innerHTML;
        assert.ok(html.includes('total-cost-row'), 'Total cost row must be rendered in esports mode');
        assert.ok(html.includes('60,300'), 'Total Shiny in esports mode must reflect remaining upgrades to true max 33 (60,300)');
        assert.ok(html.includes('4,230'), 'Total Glowy in esports mode must reflect remaining upgrades to true max 33 (4,230)');
        assert.ok(html.includes('650'), 'Total Starry in esports mode must reflect remaining upgrades to true max 33 (650)');

        // Case B: Current level is above esports effective max level (e.g. Level 27 > 24)
        renderLevelTable(
            mockTableHead,
            mockTableBody,
            mockLegendaryData,
            legendaryLevels,
            27, // currentLevel (> effective max 24)
            33, // calculatedMaxLevel
            'legendary',
            'barbarianKing',
            18,
            'esports',
            null
        );

        html = mockTableBody.innerHTML;
        assert.ok(html.includes('total-cost-row'), 'Total cost row must still render when current level exceeds effective max');
        assert.ok(html.includes('23,700'), 'Total Shiny for levels 28-33 must be 23,700');
        assert.ok(html.includes('1,550'), 'Total Glowy for levels 28-33 must be 1,550');
        assert.ok(html.includes('275'), 'Total Starry for levels 28-33 must be 275');
    });

    test('renderLevelTable gracefully handles null table elements without throwing', () => {
        assert.doesNotThrow(() => {
            renderLevelTable(null, null, {}, [], 1, 18, 'common', 'barbarianKing', 16, 'standard', null);
        });
    });

    test('getMaxLabTroopLevelForTownHall and getCurrentUnitStatsStateMap resolve TH18 and TH19 laboratory troop fallbacks', () => {
        assert.equal(getMaxLabTroopLevelForTownHall('barbarian', 10), 7);
        assert.equal(getMaxLabTroopLevelForTownHall('barbarian', 18), 13);
        assert.equal(getMaxLabTroopLevelForTownHall('barbarian', 19), 14);
        assert.equal(getMaxLabTroopLevelForTownHall('archer', 18), 14);
        assert.equal(getMaxLabTroopLevelForTownHall('archer', 19), 15);
        assert.equal(getMaxLabTroopLevelForTownHall('nonexistent_troop', 19), null);

        const prevProfile = state.playerProfile;
        try {
            // Unsynced / missing labTroops at TH18 falls back to Barbarian Lvl 13
            state.playerProfile = { townHallLevel: 18 };
            const th18Stats = getCurrentUnitStatsStateMap(barbarianPuppetData, barbarianPuppetData.levels, 18, 18, 'common', 'standard');
            assert.equal(th18Stats.damagePerSecond.numVal, 51);
            assert.equal(th18Stats.hitpoints.numVal, 310);
            assert.ok(th18Stats.hitpoints.pct < 100);

            // Missing labTroops at TH19 falls back to Barbarian Lvl 14
            state.playerProfile = { townHallLevel: 19 };
            const th19Stats = getCurrentUnitStatsStateMap(barbarianPuppetData, barbarianPuppetData.levels, 18, 18, 'common', 'standard');
            assert.equal(th19Stats.damagePerSecond.numVal, 54);
            assert.equal(th19Stats.hitpoints.numVal, 330);
            assert.equal(th19Stats.hitpoints.pct, 100);

            // Guest / null profile defaults to max TH (TH19 -> Barbarian Lvl 14)
            state.playerProfile = null;
            const guestStats = getCurrentUnitStatsStateMap(barbarianPuppetData, barbarianPuppetData.levels, 18, 18, 'common', 'standard');
            assert.equal(guestStats.hitpoints.numVal, 330);

            // Synced labTroops value overrides TH fallback
            state.playerProfile = { townHallLevel: 19, labTroops: { barbarian: 12 } };
            const syncedStats = getCurrentUnitStatsStateMap(barbarianPuppetData, barbarianPuppetData.levels, 18, 18, 'common', 'standard');
            assert.equal(syncedStats.damagePerSecond.numVal, 48);
            assert.equal(syncedStats.hitpoints.numVal, 290);
        } finally {
            state.playerProfile = prevProfile;
        }
    });

    test('renderLevelTable renders heroBoostHelp info button only when heroBoost has modifiable stats', () => {
        const mockTableHead = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
        const mockTableBody = { innerHTML: '' };
        const healerLevels = Object.keys(healerPuppetData.levels)
            .sort((a, b) => Number(a) - Number(b))
            .map(lvl => healerPuppetData.levels[lvl]);

        renderLevelTable(mockTableHead, mockTableBody, healerPuppetData, healerLevels, 9, 18, 'common', 'archerQueen', 17, 'standard', null);
        assert.ok(mockTableHead.innerHTML.includes('data-info="views.equipment.heroBoostHelp"'));
        assert.ok(mockTableHead.innerHTML.includes('category-info-btn'));

        const nonModifiableData = {
            rarity: 'common',
            statsMeta: [
                { key: 'speedIncrease', category: 'heroBoost', valueUnit: 'number', isModifiable: false }
            ]
        };
        const nonModLevels = Array.from({ length: 18 }, (_, i) => [i + 1]);
        renderLevelTable(mockTableHead, mockTableBody, nonModifiableData, nonModLevels, 1, 18, 'common', 'barbarianKing', 17, 'standard', null);
        assert.equal(mockTableHead.innerHTML.includes('views.equipment.heroBoostHelp'), false);
    });

    test('hover comparison skips unchanged equipment and spawned unit stats instead of rendering zero deltas', () => {
        const prevRaf = globalThis.requestAnimationFrame;
        globalThis.requestAnimationFrame = () => 0;

        try {
            const createStatRow = () => {
                const valEl = {
                    innerHTML: '',
                    querySelector: () => null
                };
                return {
                    isComparing: false,
                    valEl,
                    classList: {
                        toggle: (_cls, force) => {},
                        remove: () => {}
                    },
                    querySelector: (sel) => (sel === '.stat-val' ? valEl : null)
                };
            };

            const barbRows = barbarianPuppetData.statsMeta.map(() => createStatRow());
            const barbContainer = {
                querySelectorAll: (sel) => (sel === '.stat-progress-row' ? barbRows : [])
            };
            const barbLevels = Object.keys(barbarianPuppetData.levels)
                .sort((a, b) => Number(a) - Number(b))
                .map(lvl => barbarianPuppetData.levels[lvl]);

            // Hovering lvl 2 from lvl 1: summonedUnitsCount stays 8 -> 8, healthRecovery changes 110 -> 165
            updateStatsProgressHover(barbContainer, barbarianPuppetData, barbLevels, 1, 18, 'common', 'standard', 2);
            assert.equal(barbRows[0].valEl.innerHTML.includes('stat-val-compare'), false);
            assert.ok(barbRows[0].valEl.innerHTML.includes('stat-val-number'));
            assert.ok(barbRows[0].valEl.innerHTML.includes('>8<'));
            assert.ok(barbRows[3].valEl.innerHTML.includes('stat-val-compare'));
            assert.ok(barbRows[3].valEl.innerHTML.includes('+55'));

            const healerRows = healerPuppetData.spawnedUnits.statsMeta.map(() => createStatRow());
            const healerContainer = {
                querySelector: () => null,
                querySelectorAll: (sel) => (sel === '.stat-progress-row' ? healerRows : [])
            };
            const healerLevels = Object.keys(healerPuppetData.levels)
                .sort((a, b) => Number(a) - Number(b))
                .map(lvl => healerPuppetData.levels[lvl]);

            // Hovering lvl 12 (healer 7: [72, 62, 1700]) from lvl 9 (healer 6: [72, 56, 1600])
            updateUnitStatsHover(healerContainer, healerPuppetData, healerLevels, 9, 18, 'common', 'standard', 12);
            assert.equal(healerRows[0].valEl.innerHTML.includes('stat-val-compare'), false);
            assert.ok(healerRows[0].valEl.innerHTML.includes('unit-stat-val-number'));
            assert.ok(healerRows[0].valEl.innerHTML.includes('>72<'));
            assert.ok(healerRows[1].valEl.innerHTML.includes('stat-val-compare'));
            assert.ok(healerRows[1].valEl.innerHTML.includes('+6'));
        } finally {
            globalThis.requestAnimationFrame = prevRaf;
        }
    });
});
