/**
 * Test Suite: Damage Calculator Building Editor Modal
 * Feature Domain: Damage Calculator Building Level Editor & Town Hall Boundaries
 *
 * Verifies that the Edit Levels modal (Defenses tab) renders full-size sliders
 * with Town Hall level boundaries, striped locked track overlays, disabled ticks,
 * TH Max tags, and disabled stepper buttons at level boundaries.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { renderEditLevelsModal } from '../../js/components/damage/damageCalcModalsDisplay.js';
import { renderBuildingEditModal } from '../../js/components/damage/damageCalcBuildingEditorModalDisplay.js';
import {
    damageCalcState,
    setBuildingGroupSessionPreference,
    isBuildingGroupEnabled
} from '../../js/components/damage/damageCalcState.js';
import {
    isTargetImmuneToSpell
} from '../../js/domain/damage/damageFormulas.js';
import {
    partitionDefensesForModal,
    getDefenseCategoryTier
} from '../../js/domain/damage/defenseProgressionDomain.js';
import { solveAllDefensesZapQuake } from '../../js/domain/damage/zapQuakeBatchSolver.js';
import { loadTranslations } from '../../js/i18n/translator.js';
import enJson from '../../js/i18n/en.json' with { type: 'json' };
import deJson from '../../js/i18n/de.json' with { type: 'json' };
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const _testDir = path.dirname(fileURLToPath(import.meta.url));
const _targetsDir = path.resolve(_testDir, '../../js/data/targets');

import { preloadDefensesData, getDefensesData } from '../../js/data/defenseTargetsData.js';
globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/en.json')) return { ok: true, json: async () => enJson };
    if (urlStr.includes('/de.json')) return { ok: true, json: async () => deJson };
    if (urlStr.includes('/targets/')) {
        const file = urlStr.split('/').pop();
        const data = JSON.parse(readFileSync(path.resolve(_targetsDir, file), 'utf8'));
        return { ok: true, json: async () => data };
    }
    return { ok: false, status: 404 };
};

await Promise.all([preloadDefensesData(), loadTranslations('en')]);

/**
 * Creates a minimal mock DOM container element.
 * @returns {any}
 */
function createMockContainer() {
    return {
        _html: '',
        get innerHTML() {
            return this._html;
        },
        set innerHTML(val) {
            this._html = val;
        }
    };
}

test('Building Edit Modal - Renders TH boundaries, locked track overlay, and disables increment at TH cap', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        playerTownHall: 12,
        defenseLevelOverrides: {}
    };

    renderBuildingEditModal(state, container);
    const html = container.innerHTML;

    // Air Defense at TH12 has maxLevel 16, but TH12 level 10
    assert.ok(html.includes('data-building-key="air_defense"'), 'Must render Air Defense row');
    assert.ok(html.includes('data-max-allowed="10"'), 'Air Defense slider must declare data-max-allowed="10"');
    assert.ok(html.includes('calc-slider-locked-track'), 'Air Defense slider must render locked track overlay');
    assert.ok(html.includes('has-disabled-steps'), 'Air Defense slider container must receive has-disabled-steps class');

    // Extract Air Defense row
    const adRowHtml = html.split('<div class="calc-building-modal-row ').find(chunk => chunk.includes('data-building-key="air_defense"')) || '';

    // Air Defense at TH12 max level (10) must disable increment button
    assert.match(
        adRowHtml,
        /<button[^>]*data-action="increment"[^>]*data-building-key="air_defense"[^>]*disabled/,
        'Increment button must be disabled when Air Defense is at TH12 cap (level 10)'
    );

    // Decrement button must not be disabled at level 10
    assert.doesNotMatch(
        adRowHtml,
        /<button[^>]*data-action="decrement"[^>]*data-building-key="air_defense"[^>]*disabled/,
        'Decrement button must be enabled at level 10'
    );

    // Air Defense must render TH 12 Max status tag
    assert.ok(
        adRowHtml.includes('calc-building-status-tag is-th-max'),
        'Must render TH 12 Max status tag for capped defense'
    );
    assert.ok(
        adRowHtml.includes('TH 12 Max'),
        'Must display "TH 12 Max" in status tag'
    );
});

test('Building Edit Modal - Disables decrement button at minimum level (Lvl 1)', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        playerTownHall: 12,
        defenseLevelOverrides: {
            air_defense: 1
        }
    };

    renderBuildingEditModal(state, container);
    const html = container.innerHTML;

    const adRowHtml = html.split('<div class="calc-building-modal-row ').find(chunk => chunk.includes('data-building-key="air_defense"')) || '';

    // At level 1, decrement button must be disabled
    assert.match(
        adRowHtml,
        /<button[^>]*data-action="decrement"[^>]*data-building-key="air_defense"[^>]*disabled/,
        'Decrement button must be disabled when defense is at minimum level (Lvl 1)'
    );

    // At level 1, increment button must be enabled (since 1 < 10)
    assert.doesNotMatch(
        adRowHtml,
        /<button[^>]*data-action="increment"[^>]*data-building-key="air_defense"[^>]*disabled/,
        'Increment button must be enabled at level 1 when cap is 10'
    );

    // At level 1 (below TH12 cap of 10), no status tag is shown (only shown when capped as "TH{n} Max")
    assert.ok(
        !adRowHtml.includes('data-status-tag="th-cap"'),
        'Must not render TH cap status tag when below Town Hall cap'
    );
    assert.doesNotMatch(
        adRowHtml,
        /calc-building-status-tag\s+is-th\b/,
        'Must not render "is-th" status tag when below Town Hall cap'
    );
    assert.doesNotMatch(
        adRowHtml,
        /TH 12 Max/,
        'Must not display "TH 12 Max" when below Town Hall cap'
    );
});

test('Building Edit Modal - At max Town Hall (TH18), all levels up to absolute max are available without locked tracks', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        playerTownHall: 18,
        defenseLevelOverrides: {}
    };

    renderBuildingEditModal(state, container);
    const html = container.innerHTML;

    const adRowHtml = html.split('<div class="calc-building-modal-row ').find(chunk => chunk.includes('data-building-key="air_defense"')) || '';

    // At TH18, Air Defense cap is 16 (overall max level), so no locked track or is-th-max tag
    assert.doesNotMatch(adRowHtml, /is-th-max/, 'Must not render is-th-max tag at TH18');
    assert.match(
        adRowHtml,
        /<button[^>]*data-action="increment"[^>]*data-building-key="air_defense"[^>]*disabled/,
        'Increment button must be disabled at overall max (level 16)'
    );
});

test('Edit Levels Modal - Segmented tabs render "Offense" and "Defense" with data-modal-tab="defense"', () => {
    const modal = {
        _html: '',
        get innerHTML() { return this._html; },
        set innerHTML(val) { this._html = val; },
        querySelector(sel) {
            if (sel === '#calc-offense-modal-body') return this;
            if (sel === '#calc-modal-tab-content' || sel === '#calc-building-sticky-controls') {
                return {
                    _html: '',
                    get innerHTML() { return this._html; },
                    set innerHTML(val) { this._html = val; },
                    querySelector: () => null
                };
            }
            return null;
        }
    };

    const state = {
        ...damageCalcState,
        modalActiveTab: 'defense'
    };

    renderEditLevelsModal(state, modal);
    const html = modal.innerHTML;

    // Must render segmented control with Offense and Defense
    assert.ok(html.includes('data-modal-tab="offense"'), 'Must render offense tab');
    assert.ok(html.includes('data-modal-tab="defense"'), 'Must render defense tab (not buildings)');
    assert.doesNotMatch(html, /data-modal-tab="buildings"/, 'Must not render legacy data-modal-tab="buildings"');
    assert.ok(html.includes('data-i18n="views.damageCalc.clusterPlanner.defenseTabTitle"'), 'Must declare defenseTabTitle i18n attribute');
    assert.ok(html.includes('>Defense</span>'), 'Must display "Defense" label text');

    // Defense tab should be active when state.modalActiveTab is 'defense'
    assert.match(
        html,
        /class="segmented-btn active"[^>]*data-modal-tab="defense"/,
        'Defense tab must have active class when modalActiveTab is defense'
    );
});

test('Building Edit Modal - Search placeholder and empty notice use defense terminology', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        playerTownHall: 18,
        defenseLevelOverrides: {}
    };

    renderBuildingEditModal(state, container);
    const html = container.innerHTML;

    assert.ok(
        html.includes('placeholder="Search defenses..."'),
        'Search input must display "Search defenses..." placeholder'
    );
    assert.ok(
        html.includes('No matching defenses found'),
        'Empty search notice must display "No matching defenses found"'
    );
    assert.ok(
        html.includes('data-action="clear-defense-search"'),
        'Must render Clear Search button in empty notice'
    );
    assert.ok(
        /clear search/i.test(html),
        'Must display "Clear Search" button text'
    );
    assert.doesNotMatch(
        html,
        /Search buildings\.\.\./,
        'Must not contain legacy "Search buildings..." placeholder'
    );
    assert.doesNotMatch(
        html,
        /No matching buildings found/,
        'Must not contain legacy "No matching buildings found" notice'
    );
});

test('Building Edit Modal - Search input renders search icon and clear (x) button in wrapper', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        playerTownHall: 18,
        defenseLevelOverrides: {}
    };

    renderBuildingEditModal(state, container);
    const html = container.innerHTML;

    assert.ok(html.includes('class="calc-search-icon"'), 'Must render search icon in search wrap');
    assert.ok(html.includes('id="calc-building-search-clear-btn"'), 'Must render clear button in search wrap');
    assert.ok(html.includes('data-action="clear-defense-search-input"'), 'Must have clear-defense-search-input action');
    assert.ok(html.includes('calc-search-clear-btn is-hidden'), 'Clear button must be hidden initially');
});

test('Two-Tier Category Schema - Validates category and subCategory across all 38 entities', () => {
    const keys = Object.keys(getDefensesData());
    assert.strictEqual(keys.length, 38, 'Must have exactly 38 defense and structure entities');

    // 1. Buildings (29 entities)
    const buildings = Object.entries(getDefensesData()).filter(([_, d]) => d.category === 'building');
    assert.strictEqual(buildings.length, 29, 'Must have 29 building entities');

    // 2. Standard defenses (21 entities)
    const defenses = buildings.filter(([_, d]) => d.subCategory === 'defense');
    assert.strictEqual(defenses.length, 21, 'Must have 21 standard defenses');
    assert.ok(defenses.some(([k]) => k === 'air_defense'));
    assert.ok(defenses.some(([k]) => k === 'monolith'));

    // 3. Crafted defenses (3 entities)
    const crafted = buildings.filter(([_, d]) => d.subCategory === 'crafted');
    assert.strictEqual(crafted.length, 3, 'Must have 3 crafted defenses');
    assert.ok(crafted.some(([k]) => k === 'hot_candle'));
    assert.ok(crafted.some(([k]) => k === 'hero_hunter'));
    assert.ok(crafted.some(([k]) => k === 'cake_a_pult'));

    // 4. Town Hall and Clan Castle (1 each)
    assert.strictEqual(getDefensesData().town_hall.category, 'building');
    assert.strictEqual(getDefensesData().town_hall.subCategory, 'townhall');
    assert.strictEqual(getDefensesData().clan_castle.category, 'building');
    assert.strictEqual(getDefensesData().clan_castle.subCategory, 'cc');

    // 5. Resource Storages (3 entities)
    const resources = buildings.filter(([_, d]) => d.subCategory === 'resource');
    assert.strictEqual(resources.length, 3, 'Must have 3 resource storages');
    assert.ok(resources.some(([k]) => k === 'gold_storage'));
    assert.ok(resources.some(([k]) => k === 'elixir_storage'));
    assert.ok(resources.some(([k]) => k === 'dark_elixir_storage'));

    // 6. Heroes (6 entities)
    const heroes = Object.entries(getDefensesData()).filter(([_, d]) => d.category === 'hero');
    assert.strictEqual(heroes.length, 6, 'Must have 6 heroes');
    for (const [_, h] of heroes) {
        assert.strictEqual(h.subCategory, undefined, 'Heroes must not have subCategory');
    }

    // 7. Guardians (3 entities)
    const guardians = Object.entries(getDefensesData()).filter(([_, d]) => d.category === 'guardian');
    assert.strictEqual(guardians.length, 3, 'Must have 3 guardians');
    for (const [_, g] of guardians) {
        assert.strictEqual(g.subCategory, undefined, 'Guardians must not have subCategory');
    }
});

test('Building Category Tiers - Town Hall, Clan Castle, and Crafted defenses are classified as defenses (Tier 1)', () => {
    assert.strictEqual(getDefenseCategoryTier('town_hall'), 1, 'Town Hall must be Tier 1 (Defenses)');
    assert.strictEqual(getDefenseCategoryTier('clan_castle'), 1, 'Clan Castle must be Tier 1 (Defenses)');
    assert.strictEqual(getDefenseCategoryTier('air_defense'), 1, 'Air Defense must be Tier 1 (Defenses)');
    assert.strictEqual(getDefenseCategoryTier('hot_candle'), 1, 'Hot Candle must be Tier 1 (Defenses)');
    assert.strictEqual(getDefenseCategoryTier('hero_hunter'), 1, 'Hero Hunter must be Tier 1 (Defenses)');
    assert.strictEqual(getDefenseCategoryTier('cake_a_pult'), 1, 'Cake-A-Pult must be Tier 1 (Defenses)');
    assert.strictEqual(getDefenseCategoryTier('barbarian_king'), 2, 'Barbarian King must be Tier 2 (Heroes)');
    assert.strictEqual(getDefenseCategoryTier('dragon_duke'), 2, 'Dragon Duke must be Tier 2 (Heroes)');
    assert.strictEqual(getDefenseCategoryTier('smasher'), 3, 'Smasher must be Tier 3 (Guardians)');
    assert.strictEqual(getDefenseCategoryTier('logger'), 3, 'Logger must be Tier 3 (Guardians)');
    assert.strictEqual(getDefenseCategoryTier('gold_storage'), 4, 'Gold Storage must be Tier 4 (Other)');
    assert.strictEqual(getDefenseCategoryTier('dark_elixir_storage'), 4, 'Dark Elixir Storage must be Tier 4 (Other)');
});

test('Spell Immunities - Accurately resolves spell immunities via isTargetImmuneToSpell', () => {
    // 1. Resource storages: immune to both Lightning and Earthquake
    assert.strictEqual(isTargetImmuneToSpell('gold_storage', 'lightning'), true, 'Gold Storage immune to zap');
    assert.strictEqual(isTargetImmuneToSpell('gold_storage', 'earthquake'), true, 'Gold Storage immune to eq');
    assert.strictEqual(isTargetImmuneToSpell('elixir_storage', 'lightning'), true, 'Elixir Storage immune to zap');
    assert.strictEqual(isTargetImmuneToSpell('elixir_storage', 'earthquake'), true, 'Elixir Storage immune to eq');
    assert.strictEqual(isTargetImmuneToSpell('dark_elixir_storage', 'lightning'), true, 'Dark Elixir Storage immune to zap');
    assert.strictEqual(isTargetImmuneToSpell('dark_elixir_storage', 'earthquake'), true, 'Dark Elixir Storage immune to eq');

    // 2. Town Hall and Clan Castle: immune to Lightning, vulnerable to Earthquake
    assert.strictEqual(isTargetImmuneToSpell('town_hall', 'lightning'), true, 'Town Hall immune to zap');
    assert.strictEqual(isTargetImmuneToSpell('town_hall', 'earthquake'), false, 'Town Hall vulnerable to eq');
    assert.strictEqual(isTargetImmuneToSpell('clan_castle', 'lightning'), true, 'Clan Castle immune to zap');
    assert.strictEqual(isTargetImmuneToSpell('clan_castle', 'earthquake'), false, 'Clan Castle vulnerable to eq');

    // 3. Standard and crafted defenses: vulnerable to both
    assert.strictEqual(isTargetImmuneToSpell('air_defense', 'lightning'), false, 'Air Defense vulnerable to zap');
    assert.strictEqual(isTargetImmuneToSpell('air_defense', 'earthquake'), false, 'Air Defense vulnerable to eq');
    assert.strictEqual(isTargetImmuneToSpell('inferno_tower', 'lightning'), false, 'Inferno Tower vulnerable to zap');
    assert.strictEqual(isTargetImmuneToSpell('inferno_tower', 'earthquake'), false, 'Inferno Tower vulnerable to eq');
    assert.strictEqual(isTargetImmuneToSpell('hot_candle', 'lightning'), false, 'Hot Candle vulnerable to zap');
    assert.strictEqual(isTargetImmuneToSpell('hot_candle', 'earthquake'), false, 'Hot Candle vulnerable to eq');

    // 4. Heroes and guardians: ground vulnerable to both, air hero immune to eq
    assert.strictEqual(isTargetImmuneToSpell('barbarian_king', 'lightning'), false, 'Hero vulnerable to zap');
    assert.strictEqual(isTargetImmuneToSpell('barbarian_king', 'earthquake'), false, 'Hero vulnerable to eq');
    assert.strictEqual(isTargetImmuneToSpell('smasher', 'lightning'), false, 'Guardian vulnerable to zap');
    assert.strictEqual(isTargetImmuneToSpell('smasher', 'earthquake'), false, 'Guardian vulnerable to eq');
    assert.strictEqual(isTargetImmuneToSpell('minion_prince', 'lightning'), false, 'Minion Prince vulnerable to zap');
    assert.strictEqual(isTargetImmuneToSpell('minion_prince', 'earthquake'), true, 'Minion Prince (air hero) immune to eq');
    assert.strictEqual(isTargetImmuneToSpell('dragon_duke', 'lightning'), false, 'Dragon Duke vulnerable to zap');
    assert.strictEqual(isTargetImmuneToSpell('dragon_duke', 'earthquake'), true, 'Dragon Duke (air hero) immune to eq');
});

test('Partition Defenses - TH18 groups defenses, heroes, guardians, other, and sunset (Cannon before Eagle)', () => {
    const groups = partitionDefensesForModal(18);

    assert.strictEqual(groups.defenses.length, 23, 'TH18 must have 23 available defenses (including CC, excluding TH)');
    assert.ok(!groups.defenses.some(d => d.key === 'town_hall'), 'Town Hall must not appear in defenses group');
    assert.ok(groups.defenses.some(d => d.key === 'clan_castle'), 'Clan Castle must be in defenses group');

    assert.strictEqual(groups.heroes.length, 6, 'TH18 must have 6 available heroes');
    assert.strictEqual(groups.guardians.length, 3, 'TH18 must have 3 available guardians');
    assert.strictEqual(groups.other.length, 3, 'TH18 must have 3 available storages');

    // Unavailable at TH18: 2 sunset buildings (Cannon and Eagle Artillery)
    assert.strictEqual(groups.unavailable.length, 2, 'TH18 must have 2 unavailable (sunset) buildings');
    assert.strictEqual(groups.unavailable[0].key, 'cannon', 'Cannon (sunset at TH18) must appear before Eagle Artillery');
    assert.strictEqual(groups.unavailable[1].key, 'eagle_artillery', 'Eagle Artillery (sunset at TH17) must appear after Cannon');
});

test('Partition Defenses - TH17 groups locked buildings before sunset Eagle Artillery', () => {
    const groups = partitionDefensesForModal(17);

    assert.strictEqual(groups.defenses.length, 21, 'TH17 must have 21 available defenses');
    assert.strictEqual(groups.heroes.length, 6, 'TH17 must have 6 available heroes');
    assert.strictEqual(groups.guardians.length, 0, 'TH17 must have 0 available guardians');
    assert.strictEqual(groups.other.length, 3, 'TH17 must have 3 available storages');

    // Unavailable at TH17: 6 locked (TH18) before 1 sunset (Eagle Artillery)
    assert.strictEqual(groups.unavailable.length, 7, 'TH17 must have 7 unavailable buildings');
    const unavailableKeys = groups.unavailable.map(u => u.key);

    // Locked buildings (Super Wizard Tower, Multi Gear Tower, Revenge Tower, Smasher, Logger, Longshot)
    const lockedCount = groups.unavailable.filter(u => u.info.status === 'locked').length;
    const sunsetCount = groups.unavailable.filter(u => u.info.status === 'sunset').length;
    assert.strictEqual(lockedCount, 6, 'TH17 must have 6 locked buildings');
    assert.strictEqual(sunsetCount, 1, 'TH17 must have 1 sunset building');

    // All locked buildings must precede sunset buildings
    const firstSunsetIndex = unavailableKeys.indexOf('eagle_artillery');
    assert.strictEqual(firstSunsetIndex, 6, 'Sunset Eagle Artillery must appear after all 6 locked buildings');
});

test('Partition Defenses - TH14 orders locked buildings ascending by minTH (Monolith before Multi Archer Tower)', () => {
    const groups = partitionDefensesForModal(14);

    assert.strictEqual(groups.defenses.length, 17, 'TH14 must have 17 available defenses');
    assert.strictEqual(groups.heroes.length, 5, 'TH14 must have 5 available heroes');
    assert.strictEqual(groups.guardians.length, 0, 'TH14 must have 0 available guardians');
    assert.strictEqual(groups.other.length, 3, 'TH14 must have 3 available storages');

    // Locked buildings at TH14
    const lockedKeys = groups.unavailable.map(u => u.key);
    const monolithIdx = lockedKeys.indexOf('monolith');
    const multiArcherIdx = lockedKeys.indexOf('multi_archer_tower');
    const ricochetCannonIdx = lockedKeys.indexOf('ricochet_cannon');
    const superWizardIdx = lockedKeys.indexOf('super_wizard_tower');

    assert.ok(monolithIdx !== -1, 'Monolith must be in unavailable group at TH14');
    assert.ok(multiArcherIdx !== -1, 'Multi Archer Tower must be in unavailable group at TH14');
    assert.ok(monolithIdx < multiArcherIdx, 'Monolith (TH15) must appear before Multi Archer Tower (TH16)');
    assert.ok(ricochetCannonIdx < superWizardIdx, 'Ricochet Cannon (TH16) must appear before Super Wizard Tower (TH18)');
});

test('Building Edit Modal - Renders 5 collapsible groups with only Defenses open by default', () => {
    // Reset session preferences to default
    setBuildingGroupSessionPreference('defenses', true);
    setBuildingGroupSessionPreference('heroes', false);
    setBuildingGroupSessionPreference('guardians', false);
    setBuildingGroupSessionPreference('other', false);
    setBuildingGroupSessionPreference('unavailable', false);

    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        playerTownHall: 18,
        defenseLevelOverrides: {}
    };

    renderBuildingEditModal(state, container);
    const html = container.innerHTML;

    // Must render collapsible details for groups
    assert.ok(html.includes('<details class="calc-building-group" data-group-id="defenses" open>'), 'Defenses group must be open by default');
    assert.ok(html.includes('<details class="calc-building-group" data-group-id="heroes" >'), 'Heroes group must be collapsed by default');
    assert.ok(html.includes('<details class="calc-building-group" data-group-id="guardians" >'), 'Guardians group must be collapsed by default');
    assert.ok(html.includes('<details class="calc-building-group" data-group-id="other" >'), 'Other group must be collapsed by default');
    assert.ok(html.includes('<details class="calc-building-group" data-group-id="unavailable" >'), 'Unavailable group must be collapsed by default');

    // Must render localized titles and item counts
    assert.ok(html.includes('Defenses'), 'Must display Defenses section title');
    assert.ok(html.includes('(23)'), 'Must display Defenses count (23)');
    assert.ok(!html.includes('data-defense-key="town_hall"'), 'Town Hall must not appear in the Edit Levels modal');
    assert.ok(html.includes('Heroes'), 'Must display Heroes section title');
    assert.ok(html.includes('(6)'), 'Must display Heroes count (6)');
    assert.ok(html.includes('Guardians'), 'Must display Guardians section title');
    assert.ok(html.includes('(3)'), 'Must display Guardians count (3)');
    assert.ok(html.includes('Other'), 'Must display Other section title');
    assert.ok(html.includes('Unavailable'), 'Must display Unavailable umbrella section title');
    assert.ok(html.includes('(2)'), 'Must display Unavailable count (2) at TH18');

    // Dynamic preference: when user expands Heroes in session, it re-renders open
    setBuildingGroupSessionPreference('heroes', true);
    renderBuildingEditModal(state, container);
    const updatedHtml = container.innerHTML;
    assert.ok(updatedHtml.includes('<details class="calc-building-group" data-group-id="heroes" open>'), 'Heroes group must be open when session preference is true');

    // Reset back to default
    setBuildingGroupSessionPreference('heroes', false);
});

test('Building Group Visibility - Defenses invariant: defenses group has no switch and is always enabled', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        playerTownHall: 18,
        enabledBuildingGroups: {
            defenses: false, // Invariant test: should be ignored
            heroes: true,
            guardians: true,
            other: true,
            unavailable: false
        }
    };

    // Helper must return true for defenses invariant
    assert.strictEqual(isBuildingGroupEnabled(state, 'defenses'), true, 'Defenses group must always be enabled');
    assert.strictEqual(isBuildingGroupEnabled(state, 'heroes'), true, 'Heroes group must be enabled');
    assert.strictEqual(isBuildingGroupEnabled(state, 'unavailable'), false, 'Unavailable group must be disabled by default');

    renderBuildingEditModal(state, container);
    const html = container.innerHTML;

    // Defenses group must NEVER render a toggle switch
    assert.doesNotMatch(
        html,
        /data-group-switch="defenses"/,
        'Defenses group must NOT have a toggle switch'
    );

    // Other groups must render toggle switches
    assert.match(html, /data-group-switch="heroes"/, 'Heroes group must render a toggle switch');
    assert.match(html, /data-group-switch="guardians"/, 'Guardians group must render a toggle switch');
    assert.match(html, /data-group-switch="other"/, 'Other group must render a toggle switch');
    assert.match(html, /data-group-switch="unavailable"/, 'Unavailable group must render a toggle switch');

    // Check default switch states
    assert.match(
        html,
        /<button[^>]*class="[^"]*is-active[^"]*"[^>]*data-group-switch="heroes"/,
        'Heroes switch must be active by default'
    );
    assert.doesNotMatch(
        html,
        /<button[^>]*class="[^"]*is-active[^"]*"[^>]*data-group-switch="unavailable"/,
        'Unavailable switch must NOT be active by default'
    );

    // Header integration: switches must reside inside summary-actions, not in a separate toggle-bar
    assert.ok(
        !html.includes('calc-building-group__toggle-bar'),
        'Separate toggle-bar container must be completely removed'
    );
    assert.match(
        html,
        /<div class="calc-building-group__summary-actions">\s*<button[^>]*data-group-switch="heroes"/,
        'Switch must reside directly inside summary-actions in the group header'
    );

    // Label-first and divider: label must precede track, and divider must separate switch from chevron
    assert.match(
        html,
        /<button[^>]*data-group-switch="heroes"[^>]*>[\s\S]*?<span class="calc-building-group-switch__label">[\s\S]*?<\/span>[\s\S]*?<span class="calc-building-group-switch__track">/,
        'Switch label must precede switch track inside the button'
    );
    assert.match(
        html,
        /<span class="calc-building-group__divider"[^>]*><\/span>\s*<orecalc-assets-svg name="chevron-down"/,
        'Divider must separate the switch from the chevron in summary-actions'
    );
});

test('Building Group Visibility - Level setting is restricted when group is switched off', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        playerTownHall: 18,
        enabledBuildingGroups: {
            defenses: true,
            heroes: false, // Heroes switched OFF
            guardians: true,
            other: true,
            unavailable: false
        }
    };

    renderBuildingEditModal(state, container);
    const html = container.innerHTML;

    // Extract Barbarian King row (in Heroes group)
    const bkRow = html.split('<div class="calc-building-modal-row ').find(chunk => chunk.includes('data-building-key="barbarian_king"')) || '';
    assert.ok(bkRow.length > 0, 'Barbarian King row must still be rendered and visible in modal');
    assert.ok(bkRow.includes('is-restricted'), 'Barbarian King row must receive is-restricted class when Heroes is switched off');

    // Stepper controls and slider must be disabled
    assert.match(
        bkRow,
        /<button[^>]*data-action="decrement"[^>]*data-building-key="barbarian_king"[^>]*disabled/,
        'Barbarian King decrement button must be disabled when Heroes is switched off'
    );
    assert.match(
        bkRow,
        /<button[^>]*data-action="increment"[^>]*data-building-key="barbarian_king"[^>]*disabled/,
        'Barbarian King increment button must be disabled when Heroes is switched off'
    );
    assert.match(
        bkRow,
        /<input[^>]*disabled[^>]*data-building-key="barbarian_king"/,
        'Barbarian King stepped slider must be disabled when Heroes is switched off'
    );

    // Defenses row (Air Defense) must NOT be restricted
    const adRow = html.split('<div class="calc-building-modal-row ').find(chunk => chunk.includes('data-building-key="air_defense"')) || '';
    assert.doesNotMatch(adRow.split('__header')[0], /is-restricted/, 'Air Defense must NOT receive is-restricted class');
});

test('Building Group Visibility - Unavailable group: switchable to ON, but level setting remains restricted', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        playerTownHall: 18,
        enabledBuildingGroups: {
            defenses: true,
            heroes: true,
            guardians: true,
            other: true,
            unavailable: true // Switched ON
        }
    };

    renderBuildingEditModal(state, container);
    const html = container.innerHTML;

    // Switch for unavailable must be active
    assert.match(
        html,
        /<button[^>]*class="[^"]*is-active[^"]*"[^>]*data-group-switch="unavailable"/,
        'Unavailable switch must be active when switched on'
    );
    assert.match(
        html,
        /<button[^>]*data-group-switch="unavailable"[^>]*aria-checked="true"/,
        'Unavailable switch must declare aria-checked="true"'
    );

    // At TH18, standard cannon is sunset (merged into Ricochet Cannon)
    const cannonRow = html.split('<div class="calc-building-modal-row ').find(chunk => chunk.includes('data-building-key="cannon"')) || '';
    assert.ok(cannonRow.length > 0, 'Cannon row must be rendered in unavailable group');
    assert.ok(cannonRow.includes('is-restricted'), 'Cannon row must receive is-restricted class even when unavailable is switched on');

    // Level setting must be strictly restricted
    assert.match(
        cannonRow,
        /<button[^>]*data-action="decrement"[^>]*data-building-key="cannon"[^>]*disabled/,
        'Cannon decrement button must be disabled even when unavailable is switched on'
    );
    assert.match(
        cannonRow,
        /<button[^>]*data-action="increment"[^>]*data-building-key="cannon"[^>]*disabled/,
        'Cannon increment button must be disabled even when unavailable is switched on'
    );
    assert.match(
        cannonRow,
        /<input[^>]*disabled[^>]*data-building-key="cannon"/,
        'Cannon slider must be disabled even when unavailable is switched on'
    );
});

test('Building Group Visibility - Batch solver honors enabledBuildingGroups', () => {
    // 1. Only defenses enabled
    const onlyDefenses = solveAllDefensesZapQuake({
        townHallLevel: 18,
        enabledBuildingGroups: {
            defenses: true,
            heroes: false,
            guardians: false,
            other: false,
            unavailable: false
        }
    });

    const keys = onlyDefenses.map(d => d.defenseKey);
    assert.ok(keys.includes('air_defense'), 'Defenses must be included');
    assert.ok(keys.includes('town_hall'), 'Town Hall must be included in defenses');
    assert.ok(!keys.includes('barbarian_king'), 'Heroes must be excluded when heroes is false');
    assert.ok(!keys.includes('minion_pup'), 'Guardians must be excluded when guardians is false');
    assert.ok(!keys.includes('gold_storage'), 'Storages must be excluded when other is false');
    assert.ok(!keys.includes('cannon'), 'Sunset cannon must be excluded when unavailable is false');

    // 2. Unavailable enabled at TH14 (monolith is locked at TH14)
    const th14WithUnavailable = solveAllDefensesZapQuake({
        townHallLevel: 14,
        enabledBuildingGroups: {
            defenses: true,
            heroes: true,
            guardians: true,
            other: true,
            unavailable: true
        }
    });

    const th14Keys = th14WithUnavailable.map(d => d.defenseKey);
    assert.ok(th14Keys.includes('monolith'), 'Locked Monolith must be evaluated when unavailable is true');
    const monolithResult = th14WithUnavailable.find(d => d.defenseKey === 'monolith');
    assert.strictEqual(monolithResult?.level, 1, 'Locked Monolith must default to level 1');

    // 3. Defenses invariant: defenses always evaluated even if caller passes defenses: false
    const defInvariant = solveAllDefensesZapQuake({
        townHallLevel: 18,
        enabledBuildingGroups: {
            defenses: false,
            heroes: false,
            guardians: false,
            other: false,
            unavailable: false
        }
    });

    assert.ok(defInvariant.some(d => d.defenseKey === 'air_defense'), 'Defenses invariant: defenses are always evaluated');
});
