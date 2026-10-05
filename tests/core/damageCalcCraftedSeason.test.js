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

import { preloadDefensesData, getDefensesData } from '../../js/data/defenseTargetsData.js';
import { isDefenseInSeason } from '../../js/domain/damage/defenseProgressionDomain.js';
import { renderBuildingSelectionGrid } from '../../js/components/damage/damageCalcBuildingGridDisplay.js';
import { renderBuildingEditModal } from '../../js/components/damage/damageCalcBuildingEditorModalDisplay.js';
import { solveAllDefensesZapQuake } from '../../js/domain/damage/zapQuakeBatchSolver.js';
import { pruneDefenseOverrides } from '../../js/components/damage/damageCalcState.js';
await preloadDefensesData();

test('isDefenseInSeason - Permanent defenses are always in season across all dates', () => {
    const permanentDefenses = ['air_defense', 'inferno_tower', 'eagle_artillery', 'town_hall'];
    const testDates = [
        new Date('2020-01-01T00:00:00Z'),
        new Date('2026-09-18T10:00:00Z'),
        new Date('2030-01-01T00:00:00Z')
    ];

    for (const key of permanentDefenses) {
        for (const date of testDates) {
            assert.strictEqual(
                isDefenseInSeason(key, date),
                true,
                `${key} should be active at ${date.toISOString()}`
            );
            assert.strictEqual(
                isDefenseInSeason(getDefensesData()[key], date),
                true,
                `${key} object should be active at ${date.toISOString()}`
            );
        }
    }
});

test('isDefenseInSeason - Current crafted defenses respect start and end date boundaries', () => {
    const craftedKeys = ['hot_candle', 'hero_hunter', 'cake_a_pult'];

    for (const key of craftedKeys) {
        const def = getDefensesData()[key];
        assert.ok(def, `${key} should exist in getDefensesData()`);
        assert.strictEqual(def.subCategory, 'crafted');
        assert.strictEqual(def.seasonStarts, '2026-08-01T00:00:00Z');
        assert.strictEqual(def.seasonExpires, '2026-12-31T23:59:59Z');

        // Before start date
        assert.strictEqual(
            isDefenseInSeason(key, new Date('2026-07-31T23:59:59Z')),
            false,
            `${key} should be inactive before start date`
        );

        // At exact start date
        assert.strictEqual(
            isDefenseInSeason(key, new Date('2026-08-01T00:00:00Z')),
            true,
            `${key} should be active at exact start date`
        );

        // In season (active today)
        assert.strictEqual(
            isDefenseInSeason(key, new Date('2026-09-18T12:00:00Z')),
            true,
            `${key} should be active during active season`
        );

        // At exact end date
        assert.strictEqual(
            isDefenseInSeason(key, new Date('2026-12-31T23:59:59Z')),
            true,
            `${key} should be active at exact end timestamp`
        );

        // After end date
        assert.strictEqual(
            isDefenseInSeason(key, new Date('2027-01-01T00:00:00Z')),
            false,
            `${key} should be inactive after expiration`
        );
    }
});

test('isDefenseInSeason - Supports optional start dates (end-date only mode)', () => {
    const mockEndDateOnly = {
        id: 'mock_seasonal',
        subCategory: 'crafted',
        seasonExpires: '2026-12-31T23:59:59Z'
    };

    // Active in past and during season when start date is omitted
    assert.strictEqual(isDefenseInSeason(mockEndDateOnly, new Date('2024-01-01T00:00:00Z')), true);
    assert.strictEqual(isDefenseInSeason(mockEndDateOnly, new Date('2026-09-18T00:00:00Z')), true);
    assert.strictEqual(isDefenseInSeason(mockEndDateOnly, new Date('2026-12-31T23:59:59Z')), true);

    // Inactive after expiration
    assert.strictEqual(isDefenseInSeason(mockEndDateOnly, new Date('2027-01-01T00:00:00Z')), false);
});

test('isDefenseInSeason - Future incoming crafted defense becomes visible only on start date', () => {
    const mockFutureDefense = {
        id: 'future_crafted',
        subCategory: 'crafted',
        seasonStarts: '2027-01-01T00:00:00Z',
        seasonExpires: '2027-06-30T23:59:59Z'
    };

    // Inactive in 2026
    assert.strictEqual(isDefenseInSeason(mockFutureDefense, new Date('2026-09-18T00:00:00Z')), false);
    assert.strictEqual(isDefenseInSeason(mockFutureDefense, new Date('2026-12-31T23:59:59Z')), false);

    // Active in first half of 2027
    assert.strictEqual(isDefenseInSeason(mockFutureDefense, new Date('2027-01-01T00:00:00Z')), true);
    assert.strictEqual(isDefenseInSeason(mockFutureDefense, new Date('2027-03-15T00:00:00Z')), true);

    // Inactive after expiration in July 2027
    assert.strictEqual(isDefenseInSeason(mockFutureDefense, new Date('2027-07-01T00:00:00Z')), false);
});

test('isDefenseInSeason - Gracefully handles null, undefined, and non-existent keys', () => {
    assert.strictEqual(isDefenseInSeason(null), false);
    assert.strictEqual(isDefenseInSeason(undefined), false);
    assert.strictEqual(isDefenseInSeason('non_existent_defense'), false);
    assert.strictEqual(isDefenseInSeason(''), false);
});

test('renderBuildingSelectionGrid - Filters crafted defense cards based on reference date', () => {
    // 1. Render cards for in-season date
    const inSeasonHtml = renderBuildingSelectionGrid({
        townHallLevel: 18,
        referenceDate: new Date('2026-09-18T10:00:00Z')
    });

    assert.ok(inSeasonHtml.includes('data-building-key="air_defense"'), 'Standard defense must be rendered');
    assert.ok(inSeasonHtml.includes('data-building-key="hot_candle"'), 'Crafted hot_candle must render in season');
    assert.ok(inSeasonHtml.includes('data-building-key="hero_hunter"'), 'Crafted hero_hunter must render in season');
    assert.ok(inSeasonHtml.includes('data-building-key="cake_a_pult"'), 'Crafted cake_a_pult must render in season');
    assert.ok(inSeasonHtml.includes('Lvl 10'), 'Crafted defenses must display simple level format (e.g. Lvl 10)');
    assert.ok(!inSeasonHtml.includes('Lvl 30 (HP'), 'Crafted defenses must not render legacy Lvl 30 (HP X) format');

    // 2. Render cards for post-season date (2027)
    const postSeasonHtml = renderBuildingSelectionGrid({
        townHallLevel: 18,
        referenceDate: new Date('2027-01-02T00:00:00Z')
    });

    assert.ok(postSeasonHtml.includes('data-building-key="air_defense"'), 'Standard defense must remain rendered');
    assert.ok(!postSeasonHtml.includes('data-building-key="hot_candle"'), 'Expired hot_candle must not render');
    assert.ok(!postSeasonHtml.includes('data-building-key="hero_hunter"'), 'Expired hero_hunter must not render');
    assert.ok(!postSeasonHtml.includes('data-building-key="cake_a_pult"'), 'Expired cake_a_pult must not render');
});

test('renderBuildingEditModal - Filters building rows based on reference date', () => {
    const mockContainer = { innerHTML: '' };
    const mockControls = { innerHTML: '' };
    const mockState = {
        playerTownHall: 18,
        defenseLevelOverrides: {},
        defenseSuperchargeOverrides: {}
    };

    // 1. In season
    renderBuildingEditModal(mockState, mockContainer, mockControls, new Date('2026-09-18T10:00:00Z'));
    assert.ok(mockContainer.innerHTML.includes('data-building-key="air_defense"'));
    assert.ok(mockContainer.innerHTML.includes('data-building-key="hot_candle"'));
    assert.ok(mockContainer.innerHTML.includes('data-building-key="hero_hunter"'));
    assert.ok(mockContainer.innerHTML.includes('data-building-key="cake_a_pult"'));

    // 2. Expired season (2027)
    renderBuildingEditModal(mockState, mockContainer, mockControls, new Date('2027-01-02T00:00:00Z'));
    assert.ok(mockContainer.innerHTML.includes('data-building-key="air_defense"'));
    assert.ok(!mockContainer.innerHTML.includes('data-building-key="hot_candle"'));
    assert.ok(!mockContainer.innerHTML.includes('data-building-key="hero_hunter"'));
    assert.ok(!mockContainer.innerHTML.includes('data-building-key="cake_a_pult"'));
});

test('solveAllDefensesZapQuake - Batch solver filters out out-of-season defenses', () => {
    // In season
    const inSeasonResults = solveAllDefensesZapQuake({
        townHallLevel: 18,
        referenceDate: new Date('2026-09-18T10:00:00Z')
    });
    const inSeasonKeys = inSeasonResults.map(r => r.defenseKey);
    assert.ok(inSeasonKeys.includes('air_defense'));
    assert.ok(inSeasonKeys.includes('hot_candle'));
    assert.ok(inSeasonKeys.includes('hero_hunter'));
    assert.ok(inSeasonKeys.includes('cake_a_pult'));

    // Expired
    const expiredResults = solveAllDefensesZapQuake({
        townHallLevel: 18,
        referenceDate: new Date('2027-01-02T00:00:00Z')
    });
    const expiredKeys = expiredResults.map(r => r.defenseKey);
    assert.ok(expiredKeys.includes('air_defense'));
    assert.ok(!expiredKeys.includes('hot_candle'));
    assert.ok(!expiredKeys.includes('hero_hunter'));
    assert.ok(!expiredKeys.includes('cake_a_pult'));
});

test('pruneDefenseOverrides - Cleans up overrides for out-of-season defenses', () => {
    const mockState = {
        playerTownHall: 18,
        defenseLevelOverrides: {
            air_defense: 15,
            hot_candle: 8
        },
        defenseSuperchargeOverrides: {
            air_defense: 1
        }
    };

    // Prune on current date: in-season hot_candle override preserved
    pruneDefenseOverrides(mockState);
    assert.strictEqual(mockState.defenseLevelOverrides.air_defense, 15);
    assert.strictEqual(mockState.defenseLevelOverrides.hot_candle, 8);
});
