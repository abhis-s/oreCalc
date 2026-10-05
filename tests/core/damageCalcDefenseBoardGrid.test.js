/**
 * Test Suite: Damage Calculator Defense Board Visual Grid & Cluster Selection
 * Feature Domain: Damage Calculator UI Presentation & State Interaction
 *
 * Verifies that the visual building selection grid, search input, level controls,
 * TH lifecycle sunsetting, multi-defense cluster targeting, and Shared Lightning proximity engine render correctly.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const _testDir = path.dirname(fileURLToPath(import.meta.url));
const _targetsDir = path.resolve(_testDir, '../../js/data/targets');
const _i18nDir = path.resolve(_testDir, '../../js/i18n');
const enJson = JSON.parse(readFileSync(path.resolve(_i18nDir, 'en.json'), 'utf8'));
globalThis.fetch = (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/i18n/en.json') || urlStr.endsWith('en.json')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(enJson) });
    }
    const file = urlStr.split('/').pop();
    const data = JSON.parse(readFileSync(path.resolve(_targetsDir, file), 'utf8'));
    return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
};
import { loadTranslations } from '../../js/i18n/translator.js';
import { preloadDefensesData, getDefensesData } from '../../js/data/defenseTargetsData.js';
import { getClusterPresetsForTownHall } from '../../js/data/clusterPresetsData.js';
import { renderDefenseBoardPanel } from '../../js/components/damage/damageCalcDefenseBoardDisplay.js';
import { getClusterTargetPopoverContent } from '../../js/components/damage/damageCalcGridPopoversDisplay.js';
import { damageCalcState, loadPersistedState } from '../../js/components/damage/damageCalcState.js';
import { attachDamageCalcListeners } from '../../js/components/damage/damageCalcInputs.js';
import { renderTownHallDropdownHtml } from '../../js/components/damage/damageCalcSourcesDisplay.js';
import { renderTargetLevelToolbar } from '../../js/components/damage/damageCalcDisplay.js';
await Promise.all([preloadDefensesData(), loadTranslations('en')]);

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        querySelectorAll: () => [],
        querySelector: () => null,
        getElementById: () => null,
        addEventListener: () => {},
        removeEventListener: () => {},
        documentElement: { lang: '' },
        dispatchEvent: () => true
    };
}

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

test('Cluster Planner Panel - Renders visual building selection grid with search and clean placeholder for < 2 targets', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        activeTab: 'cluster_planner',
        playerTownHall: 16,
        zapQuake: {
            defenseKey: 'air_defense',
            defenseLevel: 16,
            superchargeTier: 0,
            lightningLevel: 13,
            earthquakeLevel: 8,
            selectedCluster: [{ defenseKey: 'air_defense', level: 16, superchargeTier: 0 }],
            searchQuery: '',
            multiSelectMode: true
        }
    };

    renderDefenseBoardPanel(state, container);
    const html = container.innerHTML;

    // Must NOT contain old <select id="zq-defense-select"> dropdown
    assert.ok(
        !html.includes('id="zq-defense-select"'),
        'Must eliminate old select dropdown for defense selection'
    );

    // Filter chips must be removed completely per user requirements
    assert.ok(
        !html.includes('class="calc-filter-chips"'),
        'Must NOT render category filter chips'
    );

    // Must render Town Hall dropdown in damage sources grid
    assert.ok(
        html.includes('class="calc-th-preset-group calc-th-preset-group--sources"'),
        'Must render Town Hall preset group in sources grid'
    );
    assert.ok(
        html.includes('id="calc-sources-th-dropdown"'),
        'Must render Town Hall dropdown inside sources grid'
    );
    const dividerCount = (html.match(/class="calc-sources-divider"/g) || []).length;
    assert.strictEqual(dividerCount, 2, 'Must render exactly two calc-sources-divider elements in sources card');
    assert.ok(
        !html.includes('class="calc-th-preset-group calc-th-preset-group--sources">\n            <div class="calc-sources-divider"'),
        'Must NOT nest calc-sources-divider inside calc-th-preset-group--sources'
    );

    // Must contain search input
    assert.ok(html.includes('id="zq-search-input"'), 'Must render #zq-search-input');

    // Must contain visual selector container
    assert.ok(html.includes('class="calc-selector-container"'), 'Must render calc-selector-container');

    // Must render building cards grid with all defenses (including crafted)
    assert.ok(html.includes('class="calc-building-grid"'), 'Must render calc-building-grid');
    assert.ok(html.includes('data-building-key="air_defense"'), 'Must render card for air_defense');
    assert.ok(html.includes('data-building-key="eagle_artillery"'), 'Must render card for eagle_artillery');
    assert.ok(html.includes('data-building-key="inferno_tower"'), 'Must render card for inferno_tower');
    assert.ok(html.includes('data-building-key="hot_candle"'), 'Must render card for crafted hot_candle');
    assert.ok(html.includes('data-building-key="hero_hunter"'), 'Must render card for crafted hero_hunter');
    assert.ok(html.includes('data-building-key="cake_a_pult"'), 'Must render card for crafted cake_a_pult');

    // Crafted defenses must render seasonal timer badge
    assert.ok(
        html.includes('class="calc-building-card__seasonal-badge"'),
        'Must render seasonal badge on crafted defense cards'
    );
    assert.ok(
        html.includes('name="timer"'),
        'Must render timer vector icon on crafted defense cards'
    );

    // Selected defense in cluster must have is-selected class
    assert.ok(
        html.includes('calc-building-card is-selected'),
        'Target in cluster must have is-selected class'
    );

    // Must render <orecalc-assets-image> with canonical building asset URL
    assert.ok(
        html.includes('src="/assets/buildings/air_defense/level_16.png"'),
        'Must reference canonical building asset path in orecalc-assets-image'
    );

    // Must NOT render old submode navigation tabs (Single Defense vs Cluster Planner)
    assert.ok(!html.includes('id="zq-submode-single"'), 'Must eliminate Single Defense submode tab');
    assert.ok(!html.includes('id="zq-submode-cluster"'), 'Must eliminate Cluster Planner submode tab');

    // When < 2 targets selected, renders clean placeholder hint card
    assert.ok(html.includes('calc-cluster-placeholder'), 'Must render clean placeholder when < 2 targets selected');
    assert.ok(
        html.includes('Add at least 1 neighboring target to calculate shared spells and equipment.'),
        'Single target placeholder must show refined prompt'
    );
});

test('Cluster Planner Panel - Town Hall lifecycle: TH17 sunsets eagle artillery but retains cannon and merged defenses', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        activeTab: 'cluster_planner',
        playerTownHall: 17,
        zapQuake: {
            defenseKey: 'air_defense',
            defenseLevel: 15,
            superchargeTier: 0,
            lightningLevel: 13,
            earthquakeLevel: 8,
            selectedCluster: [{ defenseKey: 'air_defense', level: 15, superchargeTier: 0 }],
            searchQuery: '',
            multiSelectMode: true
        }
    };

    renderDefenseBoardPanel(state, container);
    const html = container.innerHTML;

    // Eagle artillery is sunset at TH17
    assert.strictEqual(html.includes('data-building-key="eagle_artillery"'), false, 'Eagle artillery card must be excluded at TH17');

    // Cannon remains available till TH17
    assert.strictEqual(html.includes('data-building-key="cannon"'), true, 'Standard cannon card must be rendered at TH17');

    // Continuing & merged defenses must be rendered at TH17
    assert.strictEqual(html.includes('data-building-key="ricochet_cannon"'), true, 'Ricochet cannon card must be rendered at TH17');
    assert.strictEqual(html.includes('data-building-key="multi_archer_tower"'), true, 'Multi-archer tower card must be rendered at TH17');
    assert.strictEqual(html.includes('data-building-key="archer_tower"'), true, 'Standard archer tower card must remain rendered at TH17');
    assert.strictEqual(html.includes('data-building-key="air_defense"'), true, 'Air defense card must be rendered at TH17');

    // Verify TH18 excludes both cannon and eagle artillery
    const container18 = createMockContainer();
    renderDefenseBoardPanel({ ...state, playerTownHall: 18 }, container18);
    const html18 = container18.innerHTML;
    assert.strictEqual(html18.includes('data-building-key="cannon"'), false, 'Standard cannon card must be excluded at TH18');
    assert.strictEqual(html18.includes('data-building-key="eagle_artillery"'), false, 'Eagle artillery card must be excluded at TH18');
});

test('Cluster Planner Panel - Renders compound cluster solution for multi-defense targets', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        activeTab: 'cluster_planner',
        zapQuake: {
            defenseKey: 'air_defense',
            defenseLevel: 16,
            superchargeTier: 0,
            lightningLevel: 13,
            earthquakeLevel: 8,
            selectedCluster: [
                { defenseKey: 'air_defense', level: 16, superchargeTier: 0 },
                { defenseKey: 'inferno_tower', level: 12, superchargeTier: 0 }
            ],
            adjacentPairs: [],
            multiSelectMode: true
        }
    };

    renderDefenseBoardPanel(state, container);
    const html = container.innerHTML;

    // Must render cluster toolbar
    assert.ok(html.includes('class="calc-cluster-toolbar"'), 'Must render calc-cluster-toolbar');
    assert.ok(html.includes('class="calc-cluster-toolbar__separator"'), 'Must render middle dot separator between title and counter');
    assert.ok(html.includes('class="calc-cluster-counter"'), 'Must render plain text cluster counter');
    assert.ok(html.includes('id="zq-cluster-clear"'), 'Must render Clear Selection button');
    assert.ok(html.includes('calc-cluster-clear-btn'), 'Must render styled clear selection button');
    assert.ok(html.includes('data-cluster-remove="0"'), 'Must render remove button for target 1');
    assert.ok(html.includes('data-cluster-remove="1"'), 'Must render remove button for target 2');
    assert.ok(html.includes('calc-cluster-chip__thumb'), 'Must render defense thumb in cluster chip');
    assert.ok(!html.includes('calc-cluster-chip__name'), 'Must not render defense text name in cluster chip');

    // Must render cluster hero card
    assert.ok(
        html.includes('solution-hero-card--cluster'),
        'Must render solution-hero-card--cluster'
    );
    assert.ok(
        html.includes('class="cluster-targets-grid"'),
        'Must render cluster-targets-grid'
    );
    assert.ok(
        html.includes('cluster-target-card'),
        'Must render individual cluster-target-card items'
    );
    assert.ok(
        html.includes('cluster-target-card__eq-stage'),
        'Must render compact EQ stage in cluster target card'
    );
    assert.ok(
        html.includes('cluster-target-card__zap-stage'),
        'Must render visual Zap badge stage in cluster target card'
    );

    // Cluster target cards must have data-cluster-target-index
    assert.ok(
        html.includes('data-cluster-target-index="0"'),
        'Must render data-cluster-target-index on cluster target cards'
    );

    // Must render pairwise adjacency toggle
    assert.ok(
        html.includes('data-action="toggle-adjacent-pair"'),
        'Must render adjacency / Shared Lightning toggle'
    );
});

test('Cluster Planner Panel - Shared Lightning saves spell housing space and renders badge', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        activeTab: 'cluster_planner',
        zapQuake: {
            defenseKey: 'air_defense',
            defenseLevel: 14,
            superchargeTier: 0,
            lightningLevel: 10,
            earthquakeLevel: 5,
            selectedCluster: [
                { defenseKey: 'air_defense', level: 14, superchargeTier: 0 },
                { defenseKey: 'air_sweeper', level: 7, superchargeTier: 0 }
            ],
            adjacentPairs: ['0-1'],
            multiSelectMode: true
        }
    };

    renderDefenseBoardPanel(state, container);
    const html = container.innerHTML;

    // Must not render removed cluster-saved-badge
    assert.ok(
        !html.includes('cluster-saved-badge'),
        'Must not render cluster-saved-badge'
    );

    // Must not render removed cluster-shared-zap-pill inside damage flow
    assert.ok(
        !html.includes('cluster-shared-zap-pill'),
        'Must not render cluster-shared-zap-pill inside damage flow (clutter removed)'
    );

    // Adjacency toggle must have is-active and render Shared Lightning without Double-Zap suffix
    assert.ok(
        html.includes('calc-adjacent-toggle is-active'),
        'Adjacency toggle must be active when pair is linked'
    );
    assert.ok(
        html.includes('<span>views.damageCalc.zapQuake.sharedLightningToggle</span>') || html.includes('<span>Shared Lightning</span>'),
        'Adjacency toggle must render shared lightning toggle label'
    );
    assert.ok(
        !html.includes('(Double-Zap)'),
        'Adjacency toggle must NOT render "(Double-Zap)"'
    );
});

test('Cluster Planner Panel - Hybrid capacity handles overcapacity recipes cleanly', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        activeTab: 'cluster_planner',
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCluster: [
                { defenseKey: 'monolith', level: 5, superchargeTier: 0 },
                { defenseKey: 'air_sweeper', level: 7, superchargeTier: 0 },
                { defenseKey: 'inferno_tower', level: 12, superchargeTier: 0 },
                { defenseKey: 'scattershot', level: 7, superchargeTier: 0 }
            ],
            adjacentPairs: [],
            multiSelectMode: true
        }
    };

    renderDefenseBoardPanel(state, container);
    const html = container.innerHTML;

    assert.ok(html.includes('calc-capacity-warning'), 'Must render capacity warning when cluster exceeds capacity');
    assert.ok(html.includes('calc-tradeoff-pill__tag--optimal'), 'Must render thumbs up tag on optimal tradeoff pill');
    assert.ok(html.includes('name="thumbs-up"'), 'Must render thumbs-up SVG icon badge');
    assert.ok(!html.includes('calc-tradeoff-pill__housing'), 'Must not render redundant space badge in tradeoff pills');
    assert.ok(html.includes('calc-tradeoff-pill--overcapacity'), 'Must render overcapacity pills with overcapacity styling');
    assert.ok(html.includes('calc-tradeoff-pill__spell-icon'), 'Must render mini spell icons in tradeoff pills');
    assert.ok(html.includes('calc-adjacent-toggle__thumb'), 'Must render mini building thumbnail in pairwise adjacency chips');

    // When selecting a pure-zap recipe (index 4, 0 EQ), empty -0 HP stage must be omitted
    const zeroEqState = {
        ...state,
        zapQuake: {
            ...state.zapQuake,
            selectedClusterComboIndex: 4
        }
    };
    const zeroEqContainer = createMockContainer();
    renderDefenseBoardPanel(zeroEqState, zeroEqContainer);
    assert.ok(!zeroEqContainer.innerHTML.includes('cluster-target-card__eq-stage'), 'Must omit empty EQ stage when active combo uses 0 Earthquakes');
});

test('Cluster Planner Panel - Search input filters defense cards', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        activeTab: 'cluster_planner',
        zapQuake: {
            defenseKey: 'air_defense',
            defenseLevel: 16,
            superchargeTier: 0,
            lightningLevel: 13,
            earthquakeLevel: 8,
            selectedCluster: [],
            searchQuery: 'candle',
            multiSelectMode: true
        }
    };

    renderDefenseBoardPanel(state, container);
    const html = container.innerHTML;

    assert.ok(html.includes('data-building-key="hot_candle"'), 'Must render hot_candle matching "candle" search');
    assert.ok(!html.includes('data-building-key="air_defense"'), 'Must filter out non-matching air_defense');
    assert.ok(!html.includes('data-building-key="inferno_tower"'), 'Must filter out non-matching inferno_tower');
});

test('Global Damage Sources Card - Rendered identically at top of Cluster Planner Panel', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        activeTab: 'cluster_planner',
        playerTownHall: 18,
        zapQuake: {
            defenseKey: 'air_defense',
            defenseLevel: 14,
            superchargeTier: 1,
            multiSelectMode: true
        }
    };

    renderDefenseBoardPanel(state, container);
    const html = container.innerHTML;

    assert.ok(html.includes('class="calc-tab-layout"'), 'Cluster Planner must be wrapped in .calc-tab-layout');
    assert.ok(html.includes('class="calc-sources-section"'), 'Must render standalone .calc-sources-section at top');
    assert.ok(html.includes('id="calc-modifier-bar"'), 'Must render #calc-modifier-bar in top card');
    assert.ok(html.includes('class="calc-damage-sources-grid"'), 'Must render .calc-damage-sources-grid in top card');
    assert.ok(html.includes('id="calc-edit-offense-btn"'), 'Must render #calc-edit-offense-btn in top card');
    assert.ok(html.includes('data-calc-info="modifier"'), 'Must render modifier info button in top card');
    assert.ok(html.includes('data-calc-info="cc_spells"'), 'Must render CC hint pill in top card');
    assert.ok(html.includes('calc-supercharge-wrapper--sources'), 'Must render global supercharge selector in top card');
});

test('Cluster Planner Panel - In-place DOM update preserves layout and modifier bar without wiping container', () => {
    let containerInnerHTMLAssigned = 0;
    const mockSourcesGrid = { innerHTML: '' };
    const mockView = { className: '', innerHTML: '', querySelector: () => null };
    const mockLayout = {
        querySelector(selector) {
            if (selector === '.calc-damage-sources-grid') return mockSourcesGrid;
            if (selector === '.calc-view--zapquake, .calc-view--cluster') return mockView;
            return null;
        }
    };

    const container = {
        _html: '',
        get innerHTML() {
            return this._html;
        },
        set innerHTML(val) {
            containerInnerHTMLAssigned++;
            this._html = val;
        },
        querySelector(selector) {
            if (selector === '.calc-tab-layout') return mockLayout;
            return null;
        }
    };

    const state = {
        ...damageCalcState,
        activeTab: 'cluster_planner',
        playerTownHall: 18,
        zapQuake: {
            defenseKey: 'air_defense',
            defenseLevel: 14,
            superchargeTier: 1,
            selectedCluster: [
                { defenseKey: 'air_defense', level: 14, superchargeTier: 1 },
                { defenseKey: 'inferno_tower', level: 11, superchargeTier: 0 }
            ],
            multiSelectMode: true
        }
    };

    renderDefenseBoardPanel(state, container);

    assert.equal(containerInnerHTMLAssigned, 0, 'Must NOT re-assign container.innerHTML when layout already exists');
    assert.ok(mockView.innerHTML.length > 0, 'Must update existingView.innerHTML in-place');
    assert.ok(mockSourcesGrid.innerHTML.length > 0, 'Must update sourcesGrid.innerHTML in-place');
    assert.equal(mockView.className, 'calc-view calc-view--cluster');
});

test('Cluster Planner Panel - Equipment selector and target sharing rendering', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        activeTab: 'cluster_planner',
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCluster: [
                { defenseKey: 'monolith', level: 5, superchargeTier: 0 },
                { defenseKey: 'scattershot', level: 7, superchargeTier: 0 }
            ],
            clusterEquipment: ['spiky_ball'],
            clusterEquipmentSharing: { spiky_ball: [0] },
            multiSelectMode: true
        }
    };

    renderDefenseBoardPanel(state, container);
    const html = container.innerHTML;

    assert.ok(html.includes('calc-cluster-equipment-section'), 'Must render cluster equipment section');
    assert.ok(html.includes('calc-cluster-equip-btn is-active'), 'Selected equipment chip must have is-active class');
    assert.ok(html.includes('calc-cluster-equip-btn is-inactive'), 'Unselected equipment chips must have is-inactive class');
    assert.ok(!html.includes('calc-cluster-equip-btn__name'), 'Must not render text equipment name in equip chip');
    assert.ok(html.includes('calc-equip-badge'), 'Cluster solution hero card must render calc-equip-badge for equipment');
    assert.ok(!html.includes('calc-spell-badge--equipment'), 'Must not render old calc-spell-badge--equipment with 1x multiplier');
    assert.ok(html.includes('calc-combo-plus'), 'Must render calc-combo-plus separators between recipe items');
    assert.ok(html.includes('calc-cluster-equipment-sharing'), 'Must render equipment sharing controls when equipment is active');
    assert.ok(html.includes('calc-cluster-sharing-row'), 'Must render sharing row for active equipment');
    assert.ok(html.includes('calc-cluster-share-target'), 'Must render target sharing pills');
    assert.ok(!html.includes('calc-cluster-share-target__name'), 'Must not render text defense name in share target');
    assert.ok(html.includes('calc-cluster-share-all-btn'), 'Must render all-targets toggle button');
    assert.ok(html.includes('cluster-target-card__equip-stage'), 'Must render equipment stage in target card damage flow');
    assert.ok(!html.includes('cluster-hp-bar'), 'Must not render removed cluster-hp-bar');
});

test('Cluster Planner Panel - Sequential flow truncation omits unneeded equipment and spells when target is destroyed', () => {
    const container = createMockContainer();
    // Inferno Tower Lvl 12 (5300 HP) paired with another defense
    // With 3 equipment items that together exceed 5300 HP
    const state = {
        ...damageCalcState,
        activeTab: 'cluster_planner',
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCluster: [
                { defenseKey: 'inferno_tower', level: 12, superchargeTier: 0 },
                { defenseKey: 'scattershot', level: 7, superchargeTier: 0 }
            ],
            clusterEquipment: ['spiky_ball', 'fireball', 'giant_arrow'],
            clusterEquipmentSharing: {
                spiky_ball: [0, 1],
                fireball: [0, 1],
                giant_arrow: [0, 1]
            },
            multiSelectMode: true
        }
    };

    renderDefenseBoardPanel(state, container);
    const html = container.innerHTML;

    // Target 0 (Inferno Tower) is destroyed by equipment
    // Must render equipment stages
    assert.ok(html.includes('cluster-target-card__equip-stage'), 'Must render equipment stages');

    // Must NOT render cluster-damage-status (checkmark + 0 HP)
    assert.ok(!html.includes('cluster-damage-status'), 'Must not render checkmark or 0 HP on destroyed target');

    // Must NOT render 0x lightning or shared zap pill in flow
    assert.ok(!html.includes('0x'), 'Must not render 0x spell pills');
    assert.ok(!html.includes('cluster-shared-zap-pill'), 'Must not render cluster-shared-zap-pill');
});

test('Cluster Planner Panel - Spells render multiplier count to the left and damage to the right', () => {
    const container = createMockContainer();
    // Clean spell-only cluster
    const state = {
        ...damageCalcState,
        activeTab: 'cluster_planner',
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCluster: [
                { defenseKey: 'inferno_tower', level: 12, superchargeTier: 0 },
                { defenseKey: 'scattershot', level: 7, superchargeTier: 0 }
            ],
            clusterEquipment: [],
            adjacentPairs: ['0-1'],
            multiSelectMode: true
        }
    };

    renderDefenseBoardPanel(state, container);
    const html = container.innerHTML;

    // Must render spell count elements
    assert.ok(html.includes('cluster-target-card__spell-count'), 'Must render spell count on the left of spell icon');
    assert.ok(html.includes('cluster-target-card__zap-pill'), 'Must render zap pill with count and damage');

    // When destroyed by spells, must NOT render checkmark or 0 HP
    assert.ok(!html.includes('cluster-damage-status'), 'Must not render checkmark or 0 HP on destroyed target');
});

test('Cluster Planner Panel - Terminal damage step caps at remaining HP and displays HP unit', () => {
    const container = createMockContainer();
    // Inferno Tower Lvl 12 (5300 HP) with Spiky Ball (1875 damage)
    // 5300 - 1875 = 3425 HP remaining.
    // 4x EQ (2575 damage) leaves 850 HP remaining.
    // 2x Zap at 720/zap = 1440 theoretical damage.
    // Effective Zap damage must be capped at 850 HP, NOT 1440.
    const state = {
        ...damageCalcState,
        activeTab: 'cluster_planner',
        offense: {
            ...damageCalcState.offense,
            equipment: {
                ...damageCalcState.offense?.equipment,
                rocket_backpack: 21
            }
        },
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCluster: [
                { defenseKey: 'inferno_tower', level: 12, superchargeTier: 0 },
                { defenseKey: 'scattershot', level: 7, superchargeTier: 0 }
            ],
            clusterEquipment: ['rocket_backpack'],
            clusterEquipmentSharing: {
                rocket_backpack: [0, 1]
            },
            adjacentPairs: ['0-1'],
            multiSelectMode: true
        }
    };

    renderDefenseBoardPanel(state, container);
    const html = container.innerHTML;

    // Must display equipment damage with HP unit
    assert.ok(html.includes('-1,875 HP'), 'Must render equipment damage with HP unit');

    // Must display EQ damage with HP unit
    assert.ok(html.includes('-2,267 HP'), 'Must render EQ damage with HP unit');

    // Terminal 2x Zap must show -958 HP (effective remaining HP), NOT -1440
    assert.ok(html.includes('-958 HP'), 'Must cap terminal zap damage to remaining HP (-958 HP)');
    assert.ok(!html.includes('-1,440') && !html.includes('-1440'), 'Must not display unneeded theoretical overkill (-1440)');
});

test('Building Selection Grid - Defense cards omit visible names and provide compact accessible attributes', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        activeTab: 'cluster_planner',
        playerTownHall: 16,
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCluster: [{ defenseKey: 'air_defense', level: 14, superchargeTier: 0 }],
            multiSelectMode: true
        }
    };

    renderDefenseBoardPanel(state, container);
    const html = container.innerHTML;

    // Must NOT render visible name span inside cards
    assert.ok(
        !html.includes('calc-building-card__name'),
        'Must eliminate visible calc-building-card__name element from cards'
    );

    // Must render accessible aria-label and title tooltip on button element
    assert.ok(
        html.includes('aria-label="Air Defense (Lvl 14)"') || html.includes('aria-label="Luftabwehr (Lv. 14)"'),
        'Must include descriptive aria-label with defense name and level on card button'
    );
    assert.ok(
        html.includes('title="Air Defense"') || html.includes('title="Luftabwehr"'),
        'Must include title attribute on card button for desktop hover tooltip'
    );
});

test('Cluster Target Popover - Displays accurate sequential HP ledger with equipment, earthquake, and lightning', () => {
    // Inferno Tower Lvl 12 (5300 HP)
    // Rocket Backpack deals 1875 damage -> 3425 HP remaining.
    // 4x Shared EQ deals 2575 damage -> 850 HP remaining (After Earthquake).
    // 2x Zap deals 850 effective damage -> 0 HP remaining (Destroyed).
    const mockCard = {
        closest: () => mockCard,
        dataset: {
            buildingKey: 'inferno_tower',
            buildingLevel: '12',
            supercharge: '0',
            maxHp: '5300',
            equipDmg: '1875',
            hpAfterEquip: '3425',
            equipmentJson: JSON.stringify([{ id: 'rocket_backpack', name: 'Rocket Backpack', damage: 1875 }]),
            eqDmg: '2575',
            sharedEq: '4',
            hpAfterEq: '850',
            zapCount: '2',
            zapDmg: '850',
            remHp: '0'
        },
        getAttribute: (attr) => mockCard.dataset[attr.replace(/^data-/, '').replace(/-([a-z])/g, (_, l) => l.toUpperCase())]
    };

    const popover = getClusterTargetPopoverContent(mockCard);
    assert.ok(popover, 'Must generate popover content');
    assert.ok(popover.header.includes('Inferno Tower'), 'Header must contain defense name');
    assert.ok(popover.header.includes('5,300 HP'), 'Header must contain max HP badge');
    assert.ok(!popover.header.includes('Cluster Target'), 'Header must NOT contain cluster badge');

    // Body rows: Strikes only (no initial HP, no After Equipment, no After Earthquake)
    assert.ok(!popover.body.includes('After Equipment'), 'Must not list After Equipment');
    assert.ok(!popover.body.includes('After Earthquake'), 'Must not list After Earthquake');

    // 1. Equipment step
    assert.ok(popover.body.includes('Rocket Backpack'), 'Must list Rocket Backpack');
    assert.ok(popover.body.includes('-1,875 HP'), 'Must list Rocket Backpack damage (-1,875 HP)');

    // 2. Earthquake step
    assert.ok(popover.body.includes('4x Shared Earthquake'), 'Must list 4x Shared Earthquake');
    assert.ok(popover.body.includes('-2,575 HP'), 'Must list EQ damage (-2,575 HP)');

    // 3. Lightning step
    assert.ok(popover.body.includes('2x Lightning'), 'Must list 2x Lightning');
    assert.ok(popover.body.includes('-850 HP'), 'Must list zap damage (-850 HP)');

    // 4. Terminal Overkill row
    assert.ok(popover.body.includes('calc-breakdown-row--overkill'), 'Must render overkill row when destroyed');
    assert.ok(popover.body.includes('Overkill'), 'Must render Overkill label');
    assert.ok(popover.body.includes('+0 HP'), 'Must render +0 HP overkill');
    assert.ok(!popover.body.includes('Remaining'), 'Must not render Remaining row when target is destroyed');
});

test('Cluster Target Popover - Displays surviving HP when target stands', () => {
    // Inferno Tower Lvl 12 (5300 HP) survives with 1285 HP remaining
    const mockCard = {
        closest: () => mockCard,
        dataset: {
            buildingKey: 'inferno_tower',
            buildingLevel: '12',
            supercharge: '0',
            maxHp: '5300',
            eqDmg: '2575',
            sharedEq: '4',
            zapCount: '2',
            zapDmg: '1440',
            remHp: '1285'
        },
        getAttribute: (attr) => mockCard.dataset[attr.replace(/^data-/, '').replace(/-([a-z])/g, (_, l) => l.toUpperCase())]
    };

    const popover = getClusterTargetPopoverContent(mockCard);
    assert.ok(popover, 'Must generate popover content');
    assert.ok(popover.header.includes('5,300 HP'), 'Header must contain max HP badge');
    assert.ok(!popover.body.includes('After Earthquake'), 'Must not list After Earthquake');

    // Must show 4x Shared Earthquake: -2,575 HP
    assert.ok(popover.body.includes('4x Shared Earthquake'));
    assert.ok(popover.body.includes('-2,575 HP'));

    // Must show 2x Lightning: -1,440 HP
    assert.ok(popover.body.includes('2x Lightning'), 'Must list 2x Lightning');
    assert.ok(popover.body.includes('-1,440 HP'), 'Must list zap damage (-1,440 HP)');

    // Must show Remaining 1,285 HP without Destroyed
    assert.ok(popover.body.includes('calc-breakdown-row--remaining'), 'Must render remaining class');
    assert.ok(popover.body.includes('Remaining'), 'Must list Remaining label');
    assert.ok(popover.body.includes('1,285 HP'), 'Must list 1,285 HP remaining');
    assert.ok(!popover.body.includes('Overkill'), 'Must NOT indicate Overkill when target stands');
});

test('Cluster Planner Panel - Enforces at most 1 crafted defense in cluster selection rendering', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        activeTab: 'cluster_planner',
        playerTownHall: 17,
        zapQuake: {
            defenseKey: 'hot_candle',
            defenseLevel: 1,
            superchargeTier: 0,
            selectedCluster: [
                { defenseKey: 'hot_candle', level: 1, superchargeTier: 0 },
                { defenseKey: 'inferno_tower', level: 11, superchargeTier: 0 }
            ],
            multiSelectMode: true,
            adjacentPairs: []
        }
    };

    renderDefenseBoardPanel(state, container);
    const html = container.innerHTML;

    // Hot candle is in cluster
    const hotCandleCard = html.match(/<button[^>]*data-building-key="hot_candle"[^>]*>/)?.[0] || '';
    assert.ok(
        hotCandleCard.includes('is-in-cluster'),
        'hot_candle must have is-in-cluster class'
    );

    // Hero Hunter and Cake-A-Pult must NOT be in cluster
    const heroHunterCard = html.match(/<button[^>]*data-building-key="hero_hunter"[^>]*>/)?.[0] || '';
    assert.ok(
        !heroHunterCard.includes('is-in-cluster'),
        'hero_hunter must NOT have is-in-cluster class'
    );
    const cakeCard = html.match(/<button[^>]*data-building-key="cake_a_pult"[^>]*>/)?.[0] || '';
    assert.ok(
        !cakeCard.includes('is-in-cluster'),
        'cake_a_pult must NOT have is-in-cluster class'
    );
});

test('Cluster Planner Panel - Auto-swaps crafted defenses upon selection in multiSelectMode', () => {
    function createMockCard(key) {
        const cardListeners = [];
        const card = {
            getAttribute(name) {
                if (name === 'data-prefix') return 'zq';
                if (name === 'data-building-key') return key;
                return null;
            },
            addEventListener(event, fn) {
                if (event === 'click') cardListeners.push(fn);
            },
            click() {
                cardListeners.forEach(fn => fn({ currentTarget: card, target: card }));
            }
        };
        return card;
    }

    const cardsMap = {
        hot_candle: createMockCard('hot_candle'),
        hero_hunter: createMockCard('hero_hunter'),
        cake_a_pult: createMockCard('cake_a_pult'),
        inferno_tower: createMockCard('inferno_tower')
    };

    const mockRoot = {
        addEventListener: () => {},
        removeEventListener: () => {},
        querySelector: () => null,
        querySelectorAll: (sel) => {
            if (sel === '.calc-building-card') {
                return Object.values(cardsMap);
            }
            return [];
        }
    };

    const testState = {
        ...damageCalcState,
        playerTownHall: 17,
        zapQuake: {
            defenseKey: 'hot_candle',
            defenseLevel: 1,
            superchargeTier: 0,
            selectedCluster: [
                { defenseKey: 'hot_candle', level: 1, superchargeTier: 0 },
                { defenseKey: 'inferno_tower', level: 11, superchargeTier: 0 }
            ],
            multiSelectMode: true,
            adjacentPairs: []
        }
    };

    attachDamageCalcListeners(testState, mockRoot, () => {});

    // 1. Click Hero Hunter (different crafted defense) -> Auto-swap hot_candle with hero_hunter
    cardsMap.hero_hunter.click();
    assert.equal(testState.zapQuake.selectedCluster.length, 2, 'Cluster size remains 2 after swap');
    assert.equal(testState.zapQuake.selectedCluster[0].defenseKey, 'hero_hunter', 'hot_candle was swapped for hero_hunter');
    assert.equal(testState.zapQuake.selectedCluster[1].defenseKey, 'inferno_tower', 'inferno_tower was preserved');

    // 2. Click Cake-A-Pult (another crafted defense) -> Auto-swap hero_hunter with cake_a_pult
    cardsMap.cake_a_pult.click();
    assert.equal(testState.zapQuake.selectedCluster.length, 2, 'Cluster size remains 2 after second swap');
    assert.equal(testState.zapQuake.selectedCluster[0].defenseKey, 'cake_a_pult', 'hero_hunter was swapped for cake_a_pult');

    // 3. Click Cake-A-Pult again -> Unselect/remove cake_a_pult from cluster
    cardsMap.cake_a_pult.click();
    assert.equal(testState.zapQuake.selectedCluster.length, 1, 'Cluster size reduced to 1 after deselecting');
    assert.equal(testState.zapQuake.selectedCluster[0].defenseKey, 'inferno_tower', 'Only inferno_tower remains');

    // 4. Click Hot Candle -> Adds hot_candle to cluster
    cardsMap.hot_candle.click();
    assert.equal(testState.zapQuake.selectedCluster.length, 2, 'Cluster size is now 2');
    assert.equal(testState.zapQuake.selectedCluster[1].defenseKey, 'hot_candle', 'hot_candle added at end');
});

test('loadPersistedState - Normalizes cluster state to at most 1 crafted defense', () => {
    const mockStorage = new Map();
    const originalStorage = globalThis.localStorage;
    globalThis.localStorage = {
        getItem: (k) => mockStorage.get(k) || null,
        setItem: (k, v) => mockStorage.set(k, String(v)),
        removeItem: (k) => mockStorage.delete(k)
    };

    try {
        const payload = JSON.stringify({
            zapQuake: {
                selectedCluster: [
                    { defenseKey: 'hot_candle', level: 1, superchargeTier: 0 },
                    { defenseKey: 'inferno_tower', level: 11, superchargeTier: 0 },
                    { defenseKey: 'hero_hunter', level: 1, superchargeTier: 0 }
                ]
            }
        });
        globalThis.localStorage.setItem('clashCalc_damageCalcState', payload);

        loadPersistedState();

        const craftedInCluster = damageCalcState.zapQuake.selectedCluster.filter(
            t => getDefensesData()[t.defenseKey]?.subCategory === 'crafted'
        );
        assert.equal(craftedInCluster.length, 1, 'Must normalize cluster to at most 1 crafted defense');
        assert.equal(craftedInCluster[0].defenseKey, 'hot_candle', 'First crafted defense is retained');
        assert.equal(damageCalcState.zapQuake.selectedCluster.length, 2, 'Cluster retains hot_candle and inferno_tower');
    } finally {
        globalThis.localStorage = originalStorage;
    }
});

test('Multi-Select Mode - Only 1 guardian allowed; selecting another guardian swaps it in place', () => {
    function createMockCard(key) {
        const cardListeners = [];
        const card = {
            getAttribute(name) {
                if (name === 'data-prefix') return 'zq';
                if (name === 'data-building-key') return key;
                return null;
            },
            addEventListener(event, fn) {
                if (event === 'click') cardListeners.push(fn);
            },
            click() {
                cardListeners.forEach(fn => fn({ currentTarget: card, target: card }));
            }
        };
        return card;
    }

    const cardsMap = {
        air_defense: createMockCard('air_defense'),
        smasher: createMockCard('smasher'),
        logger: createMockCard('logger')
    };

    const mockRoot = {
        addEventListener: () => {},
        removeEventListener: () => {},
        querySelector: () => null,
        querySelectorAll: (sel) => {
            if (sel === '.calc-building-card') {
                return Object.values(cardsMap);
            }
            return [];
        }
    };

    const testState = {
        ...damageCalcState,
        playerTownHall: 18,
        zapQuake: {
            defenseKey: 'air_defense',
            defenseLevel: 14,
            superchargeTier: 0,
            selectedCluster: [
                { defenseKey: 'air_defense', level: 14, superchargeTier: 0 },
                { defenseKey: 'smasher', level: 5, superchargeTier: 0 }
            ],
            multiSelectMode: true,
            adjacentPairs: []
        }
    };

    attachDamageCalcListeners(testState, mockRoot, () => {});

    // 1. Click Logger (different guardian) -> Auto-swap smasher with logger in place at index 1
    cardsMap.logger.click();
    assert.equal(testState.zapQuake.selectedCluster.length, 2, 'Cluster size remains 2 after guardian swap');
    assert.equal(testState.zapQuake.selectedCluster[0].defenseKey, 'air_defense', 'air_defense preserved at index 0');
    assert.equal(testState.zapQuake.selectedCluster[1].defenseKey, 'logger', 'smasher swapped for logger at index 1');

    // 2. Click Logger again -> Deselect/remove logger from cluster
    cardsMap.logger.click();
    assert.equal(testState.zapQuake.selectedCluster.length, 1, 'Cluster size reduced to 1 after deselecting guardian');
    assert.equal(testState.zapQuake.selectedCluster[0].defenseKey, 'air_defense', 'Only air_defense remains');

    // 3. Click Smasher -> Adds smasher back to cluster
    cardsMap.smasher.click();
    assert.equal(testState.zapQuake.selectedCluster.length, 2, 'Cluster size is now 2');
    assert.equal(testState.zapQuake.selectedCluster[1].defenseKey, 'smasher', 'smasher added to cluster');
});

test('Multi-Select Mode - At most 4 heroes allowed; 5th hero swaps with last numbered hero', () => {
    function createMockCard(key) {
        const cardListeners = [];
        const card = {
            getAttribute(name) {
                if (name === 'data-prefix') return 'zq';
                if (name === 'data-building-key') return key;
                return null;
            },
            addEventListener(event, fn) {
                if (event === 'click') cardListeners.push(fn);
            },
            click() {
                cardListeners.forEach(fn => fn({ currentTarget: card, target: card }));
            }
        };
        return card;
    }

    const cardsMap = {
        barbarian_king: createMockCard('barbarian_king'),
        archer_queen: createMockCard('archer_queen'),
        grand_warden: createMockCard('grand_warden'),
        royal_champion: createMockCard('royal_champion'),
        minion_prince: createMockCard('minion_prince'),
        air_defense: createMockCard('air_defense')
    };

    const mockRoot = {
        addEventListener: () => {},
        removeEventListener: () => {},
        querySelector: () => null,
        querySelectorAll: (sel) => {
            if (sel === '.calc-building-card') {
                return Object.values(cardsMap);
            }
            return [];
        }
    };

    // Scenario A: 4 heroes at #1-#4, defense at #5. Selecting 5th hero swaps #4, preserving #5.
    const testStateA = {
        ...damageCalcState,
        playerTownHall: 18,
        zapQuake: {
            defenseKey: 'air_defense',
            defenseLevel: 14,
            superchargeTier: 0,
            selectedCluster: [
                { defenseKey: 'barbarian_king', level: 95, superchargeTier: 0 },
                { defenseKey: 'archer_queen', level: 95, superchargeTier: 0 },
                { defenseKey: 'grand_warden', level: 70, superchargeTier: 0 },
                { defenseKey: 'royal_champion', level: 45, superchargeTier: 0 },
                { defenseKey: 'air_defense', level: 14, superchargeTier: 0 }
            ],
            multiSelectMode: true,
            adjacentPairs: []
        }
    };

    attachDamageCalcListeners(testStateA, mockRoot, () => {});

    // Click 5th hero (minion_prince) -> swaps into last numbered hero (royal_champion at index 3)
    cardsMap.minion_prince.click();
    assert.equal(testStateA.zapQuake.selectedCluster.length, 5, 'Cluster size remains 5');
    assert.equal(testStateA.zapQuake.selectedCluster[0].defenseKey, 'barbarian_king', 'BK preserved at #1');
    assert.equal(testStateA.zapQuake.selectedCluster[1].defenseKey, 'archer_queen', 'AQ preserved at #2');
    assert.equal(testStateA.zapQuake.selectedCluster[2].defenseKey, 'grand_warden', 'GW preserved at #3');
    assert.equal(testStateA.zapQuake.selectedCluster[3].defenseKey, 'minion_prince', 'RC at #4 swapped for minion_prince');
    assert.equal(testStateA.zapQuake.selectedCluster[4].defenseKey, 'air_defense', 'air_defense at #5 preserved');

    // Scenario B: Defense at #1, 4 heroes at #2-#5. Selecting 5th hero swaps #5, preserving #1.
    const testStateB = {
        ...damageCalcState,
        playerTownHall: 18,
        zapQuake: {
            defenseKey: 'royal_champion',
            defenseLevel: 45,
            superchargeTier: 0,
            selectedCluster: [
                { defenseKey: 'air_defense', level: 14, superchargeTier: 0 },
                { defenseKey: 'barbarian_king', level: 95, superchargeTier: 0 },
                { defenseKey: 'archer_queen', level: 95, superchargeTier: 0 },
                { defenseKey: 'grand_warden', level: 70, superchargeTier: 0 },
                { defenseKey: 'royal_champion', level: 45, superchargeTier: 0 }
            ],
            multiSelectMode: true,
            adjacentPairs: []
        }
    };

    attachDamageCalcListeners(testStateB, mockRoot, () => {});

    // Click minion_prince -> swaps into last numbered hero (royal_champion at index 4)
    cardsMap.minion_prince.click();
    assert.equal(testStateB.zapQuake.selectedCluster.length, 5, 'Cluster size remains 5');
    assert.equal(testStateB.zapQuake.selectedCluster[0].defenseKey, 'air_defense', 'air_defense preserved at #1');
    assert.equal(testStateB.zapQuake.selectedCluster[1].defenseKey, 'barbarian_king', 'BK preserved at #2');
    assert.equal(testStateB.zapQuake.selectedCluster[2].defenseKey, 'archer_queen', 'AQ preserved at #3');
    assert.equal(testStateB.zapQuake.selectedCluster[3].defenseKey, 'grand_warden', 'GW preserved at #4');
    assert.equal(testStateB.zapQuake.selectedCluster[4].defenseKey, 'minion_prince', 'RC at #5 swapped for minion_prince');

    // Deselect minion_prince -> hero count drops to 3, cluster length becomes 4
    cardsMap.minion_prince.click();
    assert.equal(testStateB.zapQuake.selectedCluster.length, 4, 'Cluster size drops to 4 on deselect');
    assert.equal(testStateB.zapQuake.selectedCluster.every(t => t.defenseKey !== 'minion_prince'), true, 'minion_prince removed');
});

test('loadPersistedState - Normalizes cluster state to at most 1 guardian and at most 4 heroes', () => {
    const mockStorage = new Map();
    const originalStorage = globalThis.localStorage;
    globalThis.localStorage = {
        getItem: (k) => mockStorage.get(k) || null,
        setItem: (k, v) => mockStorage.set(k, String(v)),
        removeItem: (k) => mockStorage.delete(k)
    };

    try {
        const payload = JSON.stringify({
            zapQuake: {
                selectedCluster: [
                    { defenseKey: 'smasher', level: 5, superchargeTier: 0 },
                    { defenseKey: 'logger', level: 5, superchargeTier: 0 },
                    { defenseKey: 'barbarian_king', level: 95, superchargeTier: 0 },
                    { defenseKey: 'archer_queen', level: 95, superchargeTier: 0 },
                    { defenseKey: 'grand_warden', level: 70, superchargeTier: 0 },
                    { defenseKey: 'royal_champion', level: 45, superchargeTier: 0 },
                    { defenseKey: 'minion_prince', level: 20, superchargeTier: 0 }
                ]
            }
        });
        globalThis.localStorage.setItem('clashCalc_damageCalcState', payload);

        loadPersistedState();

        const guardiansInCluster = damageCalcState.zapQuake.selectedCluster.filter(
            t => getDefensesData()[t.defenseKey]?.category === 'guardian'
        );
        const heroesInCluster = damageCalcState.zapQuake.selectedCluster.filter(
            t => getDefensesData()[t.defenseKey]?.category === 'hero'
        );

        assert.equal(guardiansInCluster.length, 1, 'Must normalize cluster to at most 1 guardian');
        assert.equal(guardiansInCluster[0].defenseKey, 'smasher', 'First guardian is retained');
        assert.equal(heroesInCluster.length, 4, 'Must normalize cluster to at most 4 heroes');
        assert.equal(damageCalcState.zapQuake.selectedCluster.length, 5, 'Cluster capped at maximum 5 items');
    } finally {
        globalThis.localStorage = originalStorage;
    }
});

test('Cluster Planner Panel - Inputs card header structures search wrapper and filter tabs for single-row accommodation', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        activeTab: 'cluster_planner',
        playerTownHall: 17,
        zapQuake: {
            defenseKey: 'air_defense',
            defenseLevel: 14,
            superchargeTier: 0,
            selectedCluster: [{ defenseKey: 'air_defense', level: 14, superchargeTier: 0 }],
            multiSelectMode: true,
            adjacentPairs: []
        }
    };

    renderDefenseBoardPanel(state, container);
    const html = container.innerHTML;

    // Must render calc-card--inputs containing calc-view-header
    assert.ok(html.includes('calc-card calc-card--inputs'), 'Must render inputs card');
    assert.ok(html.includes('calc-view-header'), 'Must render view header inside inputs card');

    // Must render search wrapper and filter tabs as sibling elements within calc-view-header
    assert.ok(html.includes('calc-view-search-wrapper'), 'Must render search wrapper');
    assert.ok(html.includes('calc-filter-tabs'), 'Must render filter tabs');

    // Both zq-search-input and filter tabs are present in inputs card
    assert.ok(html.includes('id="zq-search-input"'), 'Must render search input');
    assert.ok(html.includes('data-zq-filter="all"'), 'Must render All filter tab');
    assert.ok(html.includes('data-zq-filter="defenses"'), 'Must render Defenses filter tab');
    assert.ok(html.includes('data-zq-filter="heroes"'), 'Must render Heroes filter tab');
    assert.ok(html.includes('data-zq-filter="guardians"'), 'Must render Guardians filter tab');
    assert.ok(html.includes('data-zq-filter="other"'), 'Must render Other filter tab');
});

test('Cluster Planner Panel - Solution hero card and inputs card render layout hierarchy for spacing normalization', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        activeTab: 'cluster_planner',
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCluster: [
                { defenseKey: 'inferno_tower', level: 12, superchargeTier: 0 },
                { defenseKey: 'scattershot', level: 7, superchargeTier: 0 }
            ],
            clusterEquipment: ['spiky_ball', 'giant_arrow'],
            adjacentPairs: ['0-1'],
            multiSelectMode: true
        }
    };

    renderDefenseBoardPanel(state, container);
    const html = container.innerHTML;

    // Must render solution hero card and its structural sections
    assert.ok(html.includes('solution-hero-card solution-hero-card--cluster'), 'Must render cluster solution hero card');
    assert.ok(html.includes('calc-cluster-equipment-section'), 'Must render equipment section in hero card');
    assert.ok(html.includes('calc-cluster-equipment-sharing'), 'Must render equipment sharing rows container');
    assert.ok(html.includes('calc-cluster-sharing-row'), 'Must render sharing rows');

    // Must render inputs card with view header and selector container
    assert.ok(html.includes('calc-card calc-card--inputs'), 'Must render inputs card');
    assert.ok(html.includes('calc-view-header'), 'Must render view header');
    assert.ok(html.includes('calc-selector-container'), 'Must render selector container');

    // Must render inputs card before results card in DOM order
    const inputsCardIdx = html.indexOf('calc-card calc-card--inputs');
    const resultsCardIdx = html.indexOf('calc-card calc-card--results');
    assert.ok(inputsCardIdx !== -1 && resultsCardIdx !== -1, 'Both inputs and results cards must exist');
    assert.ok(inputsCardIdx < resultsCardIdx, 'Inputs card must appear before results card in DOM order');
});

test('Town Hall Dropdown - Starts at Town Hall 9 and excludes Town Halls 1 through 8', () => {
    const html = renderTownHallDropdownHtml(16);

    for (let th = 9; th <= 18; th++) {
        assert.ok(html.includes(`data-th="${th}"`), `Dropdown must include TH ${th}`);
    }

    for (let th = 1; th <= 8; th++) {
        assert.equal(html.includes(`data-th="${th}"`), false, `Dropdown must not include TH ${th}`);
    }

    // Fallback: When passed TH < 9, normalizes to TH 9
    const htmlFallback = renderTownHallDropdownHtml(5);
    assert.ok(htmlFallback.includes('calc-th-dropdown-value">TH 9</span>'), 'Must normalize TH < 9 to TH 9 in toggle text');
    assert.ok(htmlFallback.includes('class="calc-th-dropdown-item is-selected" role="option" aria-selected="true" data-th="9"'), 'TH 9 item must be selected for TH < 9');
});

test('Builder\'s Hut Grid & Toolbar - Hidden at TH 13, visible at TH 14 with min level 2', () => {
    const container13 = createMockContainer();
    const state13 = {
        ...damageCalcState,
        activeTab: 'cluster_planner',
        playerTownHall: 13,
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCluster: [{ defenseKey: 'air_defense', level: 11, superchargeTier: 0 }]
        }
    };
    renderDefenseBoardPanel(state13, container13);
    assert.equal(container13.innerHTML.includes('data-building-key="builders_hut"'), false, 'Builder\'s Hut must not appear at TH 13');

    const container14 = createMockContainer();
    const state14 = {
        ...damageCalcState,
        activeTab: 'cluster_planner',
        playerTownHall: 14,
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCluster: [{ defenseKey: 'air_defense', level: 12, superchargeTier: 0 }]
        }
    };
    renderDefenseBoardPanel(state14, container14);
    assert.ok(container14.innerHTML.includes('data-building-key="builders_hut"'), 'Builder\'s Hut must appear at TH 14');

    // Toolbar controls: Min level is 2, slider min is 2, min and dec buttons disabled at level 2
    const toolbarHtml = renderTargetLevelToolbar({
        activeKey: 'builders_hut',
        activeLevel: 2,
        prefix: 'zq'
    });
    assert.ok(toolbarHtml.includes('min="2"'), 'Slider min must be 2 for Builder\'s Hut');
    assert.ok(toolbarHtml.includes('id="zq-level-min" data-prefix="zq" data-i18n="validation.min" disabled'), 'Min button must be disabled at level 2');
    assert.ok(toolbarHtml.includes('id="zq-level-dec" data-prefix="zq" disabled'), 'Dec button must be disabled at level 2');
});

test('Cluster Planner Panel - When playerTownHall is < 9, renders with active TH 9 and excludes locked defenses', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        activeTab: 'cluster_planner',
        playerTownHall: 6,
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCluster: [{ defenseKey: 'air_defense', level: 7, superchargeTier: 0 }]
        }
    };

    renderDefenseBoardPanel(state, container);
    const html = container.innerHTML;

    // Dropdown toggle must show TH 9
    assert.ok(html.includes('calc-th-dropdown-value">TH 9</span>'), 'Dropdown must show TH 9 for playerTownHall: 6');
    // Air Defense card should be present
    assert.ok(html.includes('data-building-key="air_defense"'), 'Air defense must be present');
    // Eagle Artillery (minTH: 11) must not be rendered as available defense at TH 9
    assert.equal(html.includes('data-building-key="eagle_artillery"'), false, 'Eagle Artillery must not appear at TH 9');
    // Builder's Hut (minTH: 14) must not appear at TH 9
    assert.equal(html.includes('data-building-key="builders_hut"'), false, 'Builder\'s Hut must not appear at TH 9');
});

test('Town Hall Adaptive Recommended Cluster Presets - Resolves accurate defenses per TH and gates to TH 16-18', () => {
    // TH 18 presets: Apex & Crafted with Super Wizard Tower and Revenge Tower
    const presets18 = getClusterPresetsForTownHall(18);
    assert.equal(presets18.length, 2, 'TH 18 must have 2 presets');
    assert.deepEqual(presets18[0].targets, ['cake_a_pult', 'inferno_tower', 'super_wizard_tower', 'multi_archer_tower', 'spell_tower']);
    assert.deepEqual(presets18[0].equipment, ['fireball']);
    assert.equal(presets18[0].titleKey, 'views.damageCalc.presets.fireballBlastPresetTitle');
    assert.deepEqual(presets18[1].targets, ['revenge_tower', 'clan_castle', 'monolith']);
    assert.deepEqual(presets18[1].equipment, ['giant_arrow', 'rocket_backpack']);
    assert.equal(presets18[1].titleKey, 'views.damageCalc.presets.arrowBackpackPresetTitle');

    // TH 17 presets: Super Wizard Tower replaced with Firespitter, Revenge Tower with Multi-Gear Tower
    const presets17 = getClusterPresetsForTownHall(17);
    assert.equal(presets17.length, 2, 'TH 17 must have 2 presets');
    assert.deepEqual(presets17[0].targets, ['cake_a_pult', 'inferno_tower', 'firespitter', 'multi_archer_tower', 'spell_tower']);
    assert.deepEqual(presets17[0].equipment, ['fireball']);
    assert.equal(presets17[0].titleKey, 'views.damageCalc.presets.fireballBlastPresetTitle');
    assert.deepEqual(presets17[1].targets, ['multi_gear_tower', 'clan_castle', 'monolith']);
    assert.deepEqual(presets17[1].equipment, ['giant_arrow', 'rocket_backpack']);
    assert.equal(presets17[1].titleKey, 'views.damageCalc.presets.arrowBackpackPresetTitle');
    assert.ok(!presets17[0].targets.includes('super_wizard_tower'), 'TH 17 must not contain super_wizard_tower');
    assert.ok(!presets17[1].targets.includes('revenge_tower'), 'TH 17 must not contain revenge_tower');

    // TH 16 presets: Super Wizard Tower replaced with Eagle Artillery, Revenge Tower with Ricochet Cannon
    const presets16 = getClusterPresetsForTownHall(16);
    assert.equal(presets16.length, 2, 'TH 16 must have 2 presets');
    assert.deepEqual(presets16[0].targets, ['cake_a_pult', 'inferno_tower', 'eagle_artillery', 'multi_archer_tower', 'spell_tower']);
    assert.deepEqual(presets16[0].equipment, ['fireball']);
    assert.equal(presets16[0].titleKey, 'views.damageCalc.presets.fireballBlastPresetTitle');
    assert.deepEqual(presets16[1].targets, ['ricochet_cannon', 'clan_castle', 'monolith']);
    assert.deepEqual(presets16[1].equipment, ['giant_arrow', 'rocket_backpack']);
    assert.equal(presets16[1].titleKey, 'views.damageCalc.presets.arrowBackpackPresetTitle');
    assert.ok(!presets16[0].targets.includes('super_wizard_tower'), 'TH 16 must not contain super_wizard_tower');
    assert.ok(!presets16[0].targets.includes('firespitter'), 'TH 16 must not contain firespitter');
    assert.ok(!presets16[1].targets.includes('revenge_tower'), 'TH 16 must not contain revenge_tower');
    assert.ok(!presets16[1].targets.includes('multi_gear_tower'), 'TH 16 must not contain multi_gear_tower');

    // All presets below TH 16 return empty array (gated to TH 16-18)
    for (let th = 9; th <= 15; th++) {
        const presetsLow = getClusterPresetsForTownHall(th);
        assert.deepEqual(presetsLow, [], `TH ${th} presets must be empty array`);
    }

    // Verify all targets in TH 16-18 presets meet minTH requirement
    for (const th of [16, 17, 18]) {
        const presets = getClusterPresetsForTownHall(th);
        for (const preset of presets) {
            for (const tgtKey of preset.targets) {
                const def = getDefensesData()[tgtKey];
                assert.ok(def, `Building ${tgtKey} must exist in defenses data`);
                const minTh = def.minTH || 1;
                assert.ok(minTh <= th, `Building ${tgtKey} minTH (${minTh}) must be <= Town Hall ${th}`);
            }
        }
    }
});

test('Cluster Planner Empty State - Displays presets for TH 16-18 and hides presets section for TH 9-15', () => {
    // TH 18 empty cluster renders presets grid with TH 18 titles
    const container18 = createMockContainer();
    const state18 = {
        ...damageCalcState,
        activeTab: 'cluster_planner',
        playerTownHall: 18,
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCluster: []
        }
    };
    renderDefenseBoardPanel(state18, container18);
    assert.ok(container18.innerHTML.includes('calc-cluster-presets'), 'TH 18 must display calc-cluster-presets');
    assert.ok(container18.innerHTML.includes('data-i18n="views.damageCalc.presets.fireballBlastPresetTitle"'), 'TH 18 must use canonical preset 1 title');
    assert.ok(container18.innerHTML.includes('data-i18n="views.damageCalc.presets.arrowBackpackPresetTitle"'), 'TH 18 must use canonical preset 2 title');
    assert.ok(container18.innerHTML.includes('calc-cluster-workflow'), 'TH 18 must display workflow guide');
    assert.equal(container18.innerHTML.includes('calc-cluster-pro-tip'), false, 'TH 18 must NOT display pro tip');

    // TH 17 empty cluster renders presets grid with TH 17 titles
    const container17 = createMockContainer();
    const state17 = {
        ...damageCalcState,
        activeTab: 'cluster_planner',
        playerTownHall: 17,
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCluster: []
        }
    };
    renderDefenseBoardPanel(state17, container17);
    assert.ok(container17.innerHTML.includes('calc-cluster-presets'), 'TH 17 must display calc-cluster-presets');
    assert.ok(container17.innerHTML.includes('data-i18n="views.damageCalc.presets.fireballBlastPresetTitle"'), 'TH 17 must use canonical preset 1 title');
    assert.ok(container17.innerHTML.includes('data-i18n="views.damageCalc.presets.arrowBackpackPresetTitle"'), 'TH 17 must use canonical preset 2 title');

    // TH 16 empty cluster renders presets grid with TH 16 titles
    const container16 = createMockContainer();
    const state16 = {
        ...damageCalcState,
        activeTab: 'cluster_planner',
        playerTownHall: 16,
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCluster: []
        }
    };
    renderDefenseBoardPanel(state16, container16);
    assert.ok(container16.innerHTML.includes('calc-cluster-presets'), 'TH 16 must display calc-cluster-presets');
    assert.ok(container16.innerHTML.includes('data-i18n="views.damageCalc.presets.fireballBlastPresetTitle"'), 'TH 16 must use canonical preset 1 title');
    assert.ok(container16.innerHTML.includes('data-i18n="views.damageCalc.presets.arrowBackpackPresetTitle"'), 'TH 16 must use canonical preset 2 title');

    // TH 15 (and below) empty cluster hides presets section entirely and displays workflow guide
    const container15 = createMockContainer();
    const state15 = {
        ...damageCalcState,
        activeTab: 'cluster_planner',
        playerTownHall: 15,
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCluster: []
        }
    };
    renderDefenseBoardPanel(state15, container15);
    assert.equal(container15.innerHTML.includes('calc-cluster-presets'), false, 'TH 15 must NOT display calc-cluster-presets');
    assert.ok(container15.innerHTML.includes('calc-cluster-workflow'), 'TH 15 must still display workflow guide');
    assert.equal(container15.innerHTML.includes('calc-cluster-pro-tip'), false, 'TH 15 must NOT display pro tip');

    const container11 = createMockContainer();
    const state11 = {
        ...damageCalcState,
        activeTab: 'cluster_planner',
        playerTownHall: 11,
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCluster: []
        }
    };
    renderDefenseBoardPanel(state11, container11);
    assert.equal(container11.innerHTML.includes('calc-cluster-presets'), false, 'TH 11 must NOT display calc-cluster-presets');
    assert.ok(container11.innerHTML.includes('calc-cluster-workflow'), 'TH 11 must display workflow guide');
});

test('Popular Cluster Presets - Clicking apply-cluster-preset populates selectedCluster with substituted defenses at TH 16 and 17', () => {
    function createPresetButton(presetId) {
        const listeners = {};
        return {
            dataset: { presetId },
            addEventListener: (evt, fn) => {
                listeners[evt] = fn;
            },
            click: () => {
                listeners['click']?.();
            }
        };
    }

    const preset1Btn = createPresetButton('preset_1');
    const preset2Btn = createPresetButton('preset_2');
    const mockRoot = {
        addEventListener: () => {},
        removeEventListener: () => {},
        querySelector: () => null,
        querySelectorAll: (sel) => {
            if (sel === '[data-action="apply-cluster-preset"]') {
                return [preset1Btn, preset2Btn];
            }
            return [];
        }
    };

    // Test TH 16
    const state16 = {
        ...damageCalcState,
        playerTownHall: 16,
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCluster: []
        }
    };
    attachDamageCalcListeners(state16, mockRoot, () => {});

    preset1Btn.click();
    assert.equal(state16.zapQuake.selectedCluster.length, 5);
    assert.deepEqual(
        state16.zapQuake.selectedCluster.map(t => t.defenseKey),
        ['cake_a_pult', 'inferno_tower', 'eagle_artillery', 'multi_archer_tower', 'spell_tower']
    );
    assert.deepEqual(state16.zapQuake.clusterEquipment, ['fireball']);

    preset2Btn.click();
    assert.equal(state16.zapQuake.selectedCluster.length, 3);
    assert.deepEqual(
        state16.zapQuake.selectedCluster.map(t => t.defenseKey),
        ['ricochet_cannon', 'clan_castle', 'monolith']
    );
    assert.deepEqual(state16.zapQuake.clusterEquipment, ['giant_arrow', 'rocket_backpack']);

    // Test TH 17
    const state17 = {
        ...damageCalcState,
        playerTownHall: 17,
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCluster: []
        }
    };
    attachDamageCalcListeners(state17, mockRoot, () => {});

    preset1Btn.click();
    assert.deepEqual(
        state17.zapQuake.selectedCluster.map(t => t.defenseKey),
        ['cake_a_pult', 'inferno_tower', 'firespitter', 'multi_archer_tower', 'spell_tower']
    );

    preset2Btn.click();
    assert.deepEqual(
        state17.zapQuake.selectedCluster.map(t => t.defenseKey),
        ['multi_gear_tower', 'clan_castle', 'monolith']
    );
});

test('Mobile Spell Dock - In-place DOM updates preserve drawer scroll position and guard persistent event listeners', () => {
    let backdropToggled = false;
    let dockToggled = false;

    const mockDrawer = {
        scrollTop: 320,
        style: { scrollBehavior: '' },
        classList: {
            toggle() {}
        },
        innerHTML: ''
    };
    const mockRecipe = {
        innerHTML: ''
    };
    const mockToggle = {
        attributes: {},
        setAttribute(attr, val) {
            this.attributes[attr] = val;
        }
    };
    const mockChevron = {
        classList: {
            toggle(cls, val) {}
        }
    };
    const mockDock = {
        classList: {
            toggle(cls, val) {
                if (cls === 'is-expanded') dockToggled = val;
            }
        },
        querySelector(selector) {
            if (selector === '#calc-mobile-dock-drawer') return mockDrawer;
            if (selector === '.calc-mobile-spell-dock__recipe') return mockRecipe;
            if (selector === '#calc-mobile-dock-toggle') return mockToggle;
            if (selector === '.calc-mobile-spell-dock__chevron') return mockChevron;
            return null;
        }
    };
    const mockBackdrop = {
        classList: {
            toggle(cls, val) {
                if (cls === 'is-active') backdropToggled = val;
            }
        }
    };
    const mockLayout = {
        querySelector(selector) {
            if (selector.includes('.calc-view--cluster') || selector.includes('.calc-view--zapquake')) {
                return { className: '', innerHTML: '' };
            }
            if (selector === '#calc-mobile-dock-backdrop') return mockBackdrop;
            if (selector === '#calc-mobile-spell-dock') return mockDock;
            if (selector === '.calc-damage-sources-grid') return { innerHTML: '' };
            return null;
        }
    };
    const container = {
        querySelector(selector) {
            if (selector === '.calc-tab-layout') return mockLayout;
            return null;
        },
        innerHTML: ''
    };

    const state = {
        ...damageCalcState,
        playerTownHall: 16,
        zapQuake: {
            ...damageCalcState.zapQuake,
            mobileDockExpanded: true,
            selectedCluster: [
                { defenseKey: 'monolith', level: 3, superchargeTier: 0 },
                { defenseKey: 'ricochet_cannon', level: 2, superchargeTier: 0 },
                { defenseKey: 'scattershot', level: 5, superchargeTier: 0 }
            ]
        }
    };

    renderDefenseBoardPanel(state, container);

    assert.equal(mockDrawer.scrollTop, 320, 'Preserves drawer scrollTop synchronously across in-place update');
    assert.equal(mockDrawer.style.scrollBehavior, '', 'Resets scrollBehavior override after scrollTop restoration');
    assert.ok(mockDrawer.innerHTML.includes('cluster-target-card'), 'Updates drawer target cards in-place');
    assert.ok(mockRecipe.innerHTML.length > 0, 'Updates dock recipe badges in-place');
    assert.equal(dockToggled, true, 'Maintains expanded dock class');
    assert.equal(backdropToggled, true, 'Maintains active backdrop class');
    assert.equal(mockToggle.attributes['aria-expanded'], 'true', 'Maintains expanded aria state on toggle');

    // Test idempotent listener guards in damageCalcInputs
    const dockBar = { dataset: {}, addEventListener: () => {} };
    const dockToggle = { dataset: {}, addEventListener: () => {} };
    const dockBackdrop = { dataset: {}, addEventListener: () => {} };
    const mockRoot = {
        querySelector(sel) {
            if (sel === '.calc-mobile-spell-dock__bar') return dockBar;
            if (sel === '#calc-mobile-dock-toggle') return dockToggle;
            if (sel === '#calc-mobile-dock-backdrop') return dockBackdrop;
            return null;
        },
        querySelectorAll: () => [],
        addEventListener: () => {}
    };

    attachDamageCalcListeners(state, mockRoot, () => {});
    assert.equal(dockBar.dataset.hasToggleListener, 'true', 'Flags dockBar with hasToggleListener');
    assert.equal(dockBackdrop.dataset.hasClickListener, 'true', 'Flags dockBackdrop with hasClickListener');
});

test('Cluster Planner - Individual building card selection clamps target level to active Town Hall max level', () => {
    function createMockCard(key) {
        const cardListeners = [];
        const card = {
            getAttribute(name) {
                if (name === 'data-prefix') return 'zq';
                if (name === 'data-building-key') return key;
                return null;
            },
            addEventListener(event, fn) {
                if (event === 'click') cardListeners.push(fn);
            },
            click() {
                cardListeners.forEach(fn => fn({ currentTarget: card, target: card }));
            }
        };
        return card;
    }

    const cardsMap = {
        town_hall: createMockCard('town_hall'),
        clan_castle: createMockCard('clan_castle'),
        monolith: createMockCard('monolith')
    };

    const mockRoot = {
        addEventListener: () => {},
        removeEventListener: () => {},
        querySelector: () => null,
        querySelectorAll: (sel) => {
            if (sel === '.calc-building-card') {
                return Object.values(cardsMap);
            }
            return [];
        }
    };

    const state = {
        ...damageCalcState,
        playerTownHall: 16,
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCluster: [],
            adjacentPairs: []
        }
    };

    attachDamageCalcListeners(state, mockRoot, () => {});

    // Click town_hall at TH16
    cardsMap.town_hall.click();
    assert.equal(state.zapQuake.selectedCluster.length, 1);
    assert.equal(state.zapQuake.selectedCluster[0].defenseKey, 'town_hall');
    assert.equal(state.zapQuake.selectedCluster[0].level, 16, 'Town Hall level must be 16 at TH16 (not TH18 max 18)');

    // Click clan_castle at TH16
    cardsMap.clan_castle.click();
    assert.equal(state.zapQuake.selectedCluster.length, 2);
    assert.equal(state.zapQuake.selectedCluster[1].defenseKey, 'clan_castle');
    assert.equal(state.zapQuake.selectedCluster[1].level, 12, 'Clan Castle level must be 12 at TH16 (not TH18 max 14)');

    // Click monolith at TH16
    cardsMap.monolith.click();
    assert.equal(state.zapQuake.selectedCluster.length, 3);
    assert.equal(state.zapQuake.selectedCluster[2].defenseKey, 'monolith');
    assert.equal(state.zapQuake.selectedCluster[2].level, 3, 'Monolith level must be 3 at TH16 (not TH18 max 5)');
});

test('Cluster Planner - Workflow guide renders Step 3 with verified check circle icon', () => {
    const container = createMockContainer();
    const state = {
        activeTab: 'cluster',
        playerTownHall: 18,
        damageSources: {
            earthquakeLevel: 5,
            lightningLevel: 11,
            heroEquipment: {
                fireball: { active: false, level: 27 },
                giant_arrow: { active: false, level: 21 },
                spiky_ball: { active: false, level: 27 },
                rocket_backpack: { active: false, level: 18 }
            }
        },
        zapQuake: {
            selectedCluster: [],
            proximityPairs: [],
            adjacentPairs: []
        }
    };

    renderDefenseBoardPanel(state, container);
    const html = container.innerHTML;

    assert.ok(html.includes('calc-cluster-steps-grid'), 'Must render cluster steps grid');
    assert.ok(html.includes('<orecalc-assets-svg name="swords-filled" width="18" height="18"></orecalc-assets-svg>'), 'Step 1 must render swords-filled');
    assert.ok(html.includes('<orecalc-assets-svg name="zap-filled" width="18" height="18"></orecalc-assets-svg>'), 'Step 2 must render zap-filled');
    assert.ok(html.includes('<orecalc-assets-svg name="check-circle-filled" width="18" height="18"></orecalc-assets-svg>'), 'Step 3 must render check-circle-filled');
});

test('Cluster Planner - Indestructible cluster nukes 0 Space and renders helpful guidance banner and immune indicators', () => {
    const container = createMockContainer();
    const state = {
        activeTab: 'cluster',
        playerTownHall: 18,
        damageSources: {
            earthquakeLevel: 5,
            lightningLevel: 11,
            heroEquipment: {
                fireball: { active: false, level: 27 },
                giant_arrow: { active: false, level: 21 },
                spiky_ball: { active: false, level: 27 },
                rocket_backpack: { active: false, level: 18 }
            }
        },
        zapQuake: {
            selectedCluster: [
                { defenseKey: 'town_hall', level: 18, superchargeTier: 0 },
                { defenseKey: 'clan_castle', level: 14, superchargeTier: 0 }
            ],
            proximityPairs: [],
            adjacentPairs: []
        }
    };

    renderDefenseBoardPanel(state, container);
    const html = container.innerHTML;

    // 1. Must never render 0 Space or calc-spell-badge--zero
    assert.equal(html.includes('0 Space'), false, 'Must not render 0 Space');
    assert.equal(html.includes('calc-spell-badge--zero'), false, 'Must not render calc-spell-badge--zero');

    // 2. Desktop hero card must render Cannot Destroy badge and helpful immune banner
    assert.ok(html.includes('Cannot Destroy'), 'Hero card must render Cannot Destroy badge');
    assert.ok(html.includes('calc-cluster-indestructible-banner'), 'Must render indestructible notice banner');
    assert.ok(html.includes('Immune to Lightning Spells'), 'Banner must display immune title');
    assert.ok(html.includes('Town Hall and Clan Castle are immune to Lightning spells'), 'Banner must explain why');

    // 3. Mobile dock must show Indestructible title and Cannot Destroy badge
    assert.ok(html.includes('calc-mobile-spell-dock__title--indestructible'), 'Mobile dock must style title with indestructible class');
    assert.ok(html.includes('Cannot Destroy'), 'Mobile dock must display Cannot Destroy badge');

    // 4. Target cards must NOT simulate fake Lightning strikes on immune Town Hall or Clan Castle
    assert.equal(html.includes('x Lightning'), false, 'Target cards must not simulate fake Lightning on immune defenses');
    assert.ok(html.includes('cluster-target-card__immune-badge'), 'Target cards must display Immune indicator badge');
});

test('Cluster Planner - Indestructible cluster with partial equipment renders equipment badge alongside Cannot Destroy', () => {
    const container = createMockContainer();
    const state = {
        activeTab: 'cluster',
        playerTownHall: 18,
        damageSources: {
            earthquakeLevel: 5,
            lightningLevel: 11,
            heroEquipment: {
                fireball: { active: true, level: 27 },
                giant_arrow: { active: false, level: 21 },
                spiky_ball: { active: false, level: 27 },
                rocket_backpack: { active: false, level: 18 }
            }
        },
        offense: {
            equipment: { fireball: 27 }
        },
        zapQuake: {
            clusterEquipment: ['fireball'],
            selectedCluster: [
                { defenseKey: 'town_hall', level: 18, superchargeTier: 0 },
                { defenseKey: 'monolith', level: 5, superchargeTier: 0 }
            ],
            proximityPairs: [],
            adjacentPairs: []
        }
    };

    renderDefenseBoardPanel(state, container);
    const html = container.innerHTML;

    // Zero 0 Space
    assert.equal(html.includes('0 Space'), false, 'Must not render 0 Space');

    // Must render equipment badge (Fireball)
    assert.ok(html.includes('data-equip-id="fireball"'), 'Must render active Fireball badge');

    // Must also render Cannot Destroy badge and banner because Town Hall survives Fireball and cannot be zapped
    assert.ok(html.includes('Cannot Destroy'), 'Must render Cannot Destroy status badge');
    assert.ok(html.includes('calc-cluster-indestructible-banner'), 'Must render indestructible guidance banner');
});
