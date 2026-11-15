import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderLevelTable } from '../../js/components/equipment/equipmentDetailsTableDisplay.js';
import { getMaxLabTroopLevelForTownHall } from '../../js/data/labTroopsData.js';
import { getCurrentUnitStatsStateMap } from '../../js/components/equipment/equipmentDetailsUnitStatsDisplay.js';
import { state } from '../../js/core/state.js';

const barbarianPuppetData = JSON.parse(readFileSync(new URL('../../js/data/equipment/barbarian_puppet.json', import.meta.url), 'utf8'));

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
});
