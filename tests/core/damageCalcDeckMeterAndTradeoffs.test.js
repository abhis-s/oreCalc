/**
 * Test Suite: Damage Calculator Trade-off Switcher & Mobile Dock
 * Feature Domain: Damage Calculator UI Presentation & Ergonomics
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const _testDir = path.dirname(fileURLToPath(import.meta.url));
const _targetsDir = path.resolve(_testDir, '../../js/data/targets');
const _enJson = JSON.parse(fs.readFileSync(path.resolve(_testDir, '../../js/i18n/en.json'), 'utf8'));
globalThis.fetch = (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/en.json')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(_enJson) });
    }
    const file = urlStr.split('/').pop();
    const data = JSON.parse(fs.readFileSync(path.resolve(_targetsDir, file), 'utf8'));
    return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
};
import { loadTranslations } from '../../js/i18n/translator.js';
import { preloadDefensesData } from '../../js/data/defenseTargetsData.js';
import {
    renderTradeoffsBarHtml,
    renderMobileSpellDockHtml
} from '../../js/components/damage/damageCalcClusterWidgetsDisplay.js';
import {
    renderDefenseBoardPanel
} from '../../js/components/damage/damageCalcDefenseBoardDisplay.js';
import { attachDamageCalcListeners } from '../../js/components/damage/damageCalcInputs.js';
import { damageCalcState, persistState } from '../../js/components/damage/damageCalcState.js';
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
        },
        querySelector() {
            return null;
        }
    };
}

test('Trade-offs Switcher - Renders interactive pill buttons for viable combinations', () => {
    const mockCombinations = [
        { eqCount: 3, zapCount: 5, totalHousingSpace: 8 },
        { eqCount: 2, zapCount: 6, totalHousingSpace: 8 },
        { eqCount: 1, zapCount: 7, totalHousingSpace: 8 },
        { eqCount: 0, zapCount: 9, totalHousingSpace: 9 }
    ];

    const html = renderTradeoffsBarHtml(mockCombinations, 1);

    assert.ok(html.includes('class="calc-tradeoffs-container"'), 'Renders tradeoffs container');
    assert.ok(html.includes('data-tradeoff-index="0"'), 'Includes pill 0');
    assert.ok(html.includes('data-tradeoff-index="1"'), 'Includes pill 1');
    assert.ok(html.includes('data-tradeoff-index="2"'), 'Includes pill 2');
    assert.ok(html.includes('data-tradeoff-index="3"'), 'Includes pill 3');

    // Active pill should have is-active on index 1
    assert.match(
        html,
        /class="calc-tradeoff-pill\s+is-active"[^>]*data-tradeoff-index="1"/s,
        'Index 1 has is-active class'
    );
    assert.ok(html.includes('Optimal'), 'First pill has Optimal tag');
});

test('Trade-offs Switcher - Returns empty string if only 1 combination exists', () => {
    const mockCombinations = [
        { eqCount: 1, zapCount: 3, totalHousingSpace: 4 }
    ];

    const html = renderTradeoffsBarHtml(mockCombinations, 0);
    assert.equal(html, '', 'Returns empty string when there are no trade-offs to pick from');
});

test('Mobile Spell Dock - Collapsed state renders bar with title, recipe badges, and toggle chevron', () => {
    const html = renderMobileSpellDockHtml({
        isCluster: false,
        targetName: 'Monolith',
        targetThumb: '/assets/buildings/monolith/monolith_1.png',
        targetLevel: 'Lvl 5',
        recipeBadgesHtml: '<div class="calc-spell-badge calc-spell-badge--eq">1x</div><span class="calc-combo-plus">+</span><div class="calc-spell-badge calc-spell-badge--zap">6x</div>',
        eqCount: 1,
        zapCount: 6,
        totalHousing: 7,
        isExpanded: false,
        drawerContentHtml: '<div class="test-drawer-content">Details Content</div>'
    });

    assert.ok(html.includes('id="calc-mobile-spell-dock"'), 'Renders mobile dock element');
    assert.ok(html.includes('id="calc-mobile-dock-backdrop"'), 'Renders mobile dock backdrop element');
    assert.equal(html.includes('calc-mobile-dock-backdrop is-active'), false, 'Backdrop is not active when collapsed');
    assert.ok(html.includes('calc-mobile-spell-dock__title'), 'Renders title element');
    assert.ok(html.includes('Cluster Solution'), 'Displays Cluster Solution title text');
    assert.ok(html.includes('id="calc-mobile-dock-toggle"'), 'Includes dock toggle button');
    assert.ok(html.includes('aria-expanded="false"'), 'Toggle reflects collapsed state');
    assert.ok(html.includes('test-drawer-content'), 'Drawer contains detailed content');
});

test('Mobile Spell Dock - Active state activates backdrop and expands drawer', () => {
    const html = renderMobileSpellDockHtml({
        isCluster: true,
        clusterTargets: [
            { defenseKey: 'monolith', level: 5 },
            { defenseKey: 'ricochet_cannon', level: 4 },
            { defenseKey: 'scattershot', level: 7 }
        ],
        recipeBadgesHtml: '<div class="calc-equip-badge" data-key="fireball">Fireball</div><span class="calc-combo-plus">+</span><div class="calc-spell-badge calc-spell-badge--zap">6x</div>',
        totalHousing: '13 / 11',
        isOverCapacity: true,
        maxArmyCapacity: 11,
        isExpanded: true,
        drawerContentHtml: '<div class="calc-cluster-equipment-section">Equip Section</div>'
    });

    assert.ok(html.includes('calc-mobile-dock-backdrop is-active'), 'Backdrop is active when expanded');
    assert.ok(html.includes('calc-mobile-spell-dock is-expanded'), 'Dock has expanded class');
    assert.ok(html.includes('calc-mobile-spell-dock__title'), 'Renders title element');
    assert.ok(html.includes('Cluster Solution'), 'Displays Cluster Solution title text');
    assert.ok(html.includes('data-key="fireball"'), 'Renders custom equipment recipe badge');
    assert.ok(html.includes('calc-cluster-equipment-section'), 'Drawer includes equipment section');
});

test('Defense Board Panel - Renders streamlined panel with tradeoffs, cluster equipment in drawer, and mobile dock', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        activeTab: 'cluster_planner',
        playerTownHall: 18,
        zapQuake: {
            defenseKey: 'monolith',
            defenseLevel: 5,
            superchargeTier: 0,
            lightningLevel: 13,
            earthquakeLevel: 8,
            selectedCluster: [
                { defenseKey: 'monolith', level: 5, superchargeTier: 0 },
                { defenseKey: 'inferno_tower', level: 12, superchargeTier: 0 }
            ],
            searchQuery: '',
            multiSelectMode: false,
            selectedComboIndex: 0,
            mobileDockExpanded: false
        }
    };

    renderDefenseBoardPanel(state, container);
    const html = container.innerHTML;

    assert.ok(html.includes('class="calc-tradeoffs-container"'), 'Renders tradeoffs switcher');
    assert.ok(html.includes('id="calc-mobile-spell-dock"'), 'Renders mobile spell dock at bottom of layout');
    assert.ok(html.includes('id="calc-mobile-dock-backdrop"'), 'Renders mobile dock backdrop');
    assert.ok(html.includes('class="calc-mobile-spell-dock__title"'), 'Renders title in dock');
    assert.ok(html.includes('Cluster Solution'), 'Displays Cluster Solution title in dock');
    assert.ok(html.includes('class="calc-cluster-equipment-section"'), 'Renders cluster equipment section');
});

test('Mobile Spell Dock - Clicking dock bar toggles mobileDockExpanded', () => {
    let barClickListener = null;
    const mockBar = {
        addEventListener: (event, handler) => {
            if (event === 'click') barClickListener = handler;
        }
    };
    const mockToggle = {
        addEventListener: () => {},
        setAttribute: () => {}
    };
    const mockDock = {
        classList: { toggle: () => {}, remove: () => {} }
    };
    const mockDrawer = {
        classList: { toggle: () => {}, remove: () => {} },
        scrollTop: 50
    };
    const mockBackdrop = {
        addEventListener: () => {},
        classList: { toggle: () => {}, remove: () => {} }
    };

    const mockRoot = {
        addEventListener: () => {},
        querySelectorAll: () => [],
        querySelector: (sel) => {
            if (sel === '.calc-mobile-spell-dock__bar') return mockBar;
            if (sel === '#calc-mobile-dock-toggle') return mockToggle;
            if (sel === '#calc-mobile-spell-dock') return mockDock;
            if (sel === '#calc-mobile-dock-drawer') return mockDrawer;
            if (sel === '#calc-mobile-dock-backdrop') return mockBackdrop;
            return null;
        }
    };

    const testState = {
        ...damageCalcState,
        zapQuake: {
            ...damageCalcState.zapQuake,
            mobileDockExpanded: false
        }
    };

    attachDamageCalcListeners(testState, mockRoot, () => {});

    assert.ok(barClickListener, 'Registers click listener on mobile dock bar');

    // Click bar -> expands dock
    barClickListener({ target: mockBar });
    assert.equal(testState.zapQuake.mobileDockExpanded, true, 'Clicking dock bar expands dock');
    assert.equal(mockDrawer.scrollTop, 0, 'Resets drawer scrollTop to 0 on expand');

    // Click bar again -> collapses dock
    barClickListener({ target: mockBar });
});

test('Mobile Spell Dock - Persistent listeners prevent duplicate toggle binding and clicking toggle expands dock', () => {
    let barClickListener = null;
    const mockBar = {
        dataset: {},
        addEventListener: (evt, cb) => {
            if (evt === 'click') barClickListener = cb;
        }
    };
    const mockToggle = {
        dataset: {},
        addEventListener: () => {},
        setAttribute: () => {}
    };
    const mockDock = {
        classList: { toggle: () => {} }
    };
    const mockDrawer = {
        classList: { toggle: () => {} },
        scrollTop: 0
    };
    const mockBackdrop = {
        dataset: {},
        classList: { toggle: () => {} },
        addEventListener: () => {}
    };
    const mockChevron = {
        classList: { toggle: () => {} }
    };

    const mockRoot = {
        addEventListener: () => {},
        querySelectorAll: () => [],
        querySelector: (sel) => {
            if (sel === '.calc-mobile-spell-dock__bar') return mockBar;
            if (sel === '#calc-mobile-dock-toggle') return mockToggle;
            if (sel === '#calc-mobile-spell-dock') return mockDock;
            if (sel === '#calc-mobile-dock-drawer') return mockDrawer;
            if (sel === '#calc-mobile-dock-backdrop') return mockBackdrop;
            if (sel === '.calc-mobile-spell-dock__chevron') return mockChevron;
            return null;
        }
    };

    const testState = {
        ...damageCalcState,
        zapQuake: {
            ...damageCalcState.zapQuake,
            mobileDockExpanded: false
        }
    };

    // Attach listeners on 1st render
    attachDamageCalcListeners(testState, mockRoot, () => {});
    assert.equal(mockBar.dataset.hasToggleListener, 'true', 'Flags mockBar with hasToggleListener');
    assert.equal(mockToggle.dataset.hasToggleListener, undefined, 'Does not flag mockToggle when bar is present');

    // Attach listeners on 2nd render (simulating re-render)
    attachDamageCalcListeners(testState, mockRoot, () => {});
    assert.equal(mockToggle.dataset.hasToggleListener, undefined, 'Does not fall through to flag mockToggle on subsequent renders');

    // Simulate clicking toggle which bubbles to bar
    barClickListener({ target: mockToggle });
    assert.equal(testState.zapQuake.mobileDockExpanded, true, 'Clicking toggle expands mobile dock');

    // Simulate clicking toggle again
    barClickListener({ target: mockToggle });
    assert.equal(testState.zapQuake.mobileDockExpanded, false, 'Clicking toggle again collapses mobile dock');
});

test('Mobile Spell Dock - persistState excludes mobileDockExpanded from local storage', () => {
    let savedPayload = null;
    const originalLocalStorage = globalThis.localStorage;
    globalThis.localStorage = {
        getItem: () => null,
        setItem: (_key, val) => { savedPayload = JSON.parse(val); },
        removeItem: () => {}
    };

    try {
        damageCalcState.zapQuake.mobileDockExpanded = true;
        persistState();
        assert.ok(savedPayload, 'Persists damage calculator state payload');
        assert.equal('mobileDockExpanded' in (savedPayload.zapQuake || {}), false, 'Excludes mobileDockExpanded from persisted storage');
    } finally {
        globalThis.localStorage = originalLocalStorage;
        damageCalcState.zapQuake.mobileDockExpanded = false;
    }
});
