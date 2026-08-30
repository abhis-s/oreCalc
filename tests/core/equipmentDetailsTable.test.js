import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { renderLevelTable } from '../../js/components/equipment/equipmentDetailsTableDisplay.js';

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
});
