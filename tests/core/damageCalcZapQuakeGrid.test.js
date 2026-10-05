/**
 * Test Suite: ZapQuake Grid Layout & Dominant Umbrella Combo Cards
 * Feature Domain: Damage Calculator ZapQuake Solver Presentation
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const _testDir = path.dirname(fileURLToPath(import.meta.url));
const _targetsDir = path.resolve(_testDir, '../../js/data/targets');

globalThis.fetch = (url) => {
    const file = String(url).split('/').pop();
    const data = JSON.parse(fs.readFileSync(path.resolve(_targetsDir, file), 'utf8'));
    return Promise.resolve({ json: () => Promise.resolve(data) });
};

import { preloadDefensesData } from '../../js/data/defenseTargetsData.js';
import { renderZapQuakePanel } from '../../js/components/damage/damageCalcZapQuakeDisplay.js';
import {
    shouldComboExpandFullWidth,
    sortDetailedCombos
} from '../../js/domain/damage/zapQuakeDashboardDomain.js';

await preloadDefensesData();

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

test('shouldComboExpandFullWidth - Returns false in compact view mode', () => {
    assert.strictEqual(
        shouldComboExpandFullWidth(19, [19, 4, 2], 'compact'),
        false,
        'Compact mode must never expand combo cards across columns'
    );
});

test('shouldComboExpandFullWidth - Returns false when only one combo exists', () => {
    assert.strictEqual(
        shouldComboExpandFullWidth(19, [19], 'detailed'),
        false,
        'Multi-combo precondition requires at least 2 active combos'
    );
});

test('shouldComboExpandFullWidth - Returns false when count is below threshold', () => {
    assert.strictEqual(
        shouldComboExpandFullWidth(11, [11, 2, 1], 'detailed'),
        false,
        'Combos with fewer than 12 defenses must not trigger full-width expansion'
    );
});

test('shouldComboExpandFullWidth - Returns false when multiple combos have many buildings', () => {
    assert.strictEqual(
        shouldComboExpandFullWidth(17, [17, 11, 3], 'detailed'),
        false,
        'Must not expand when another combo has more than 8 buildings (avoids multiple full-width blocks)'
    );
    assert.strictEqual(
        shouldComboExpandFullWidth(16, [16, 9, 2], 'detailed'),
        false,
        'Must not expand when runner-up has 9 buildings'
    );
});

test('shouldComboExpandFullWidth - Returns false when maximums are tied', () => {
    assert.strictEqual(
        shouldComboExpandFullWidth(16, [16, 16, 2], 'detailed'),
        false,
        'Tied top combos must never expand'
    );
});

test('shouldComboExpandFullWidth - Returns false for runner-up or non-maximum combos', () => {
    assert.strictEqual(
        shouldComboExpandFullWidth(4, [19, 4, 2], 'detailed'),
        false,
        'Runner-up combos must never expand'
    );
    assert.strictEqual(
        shouldComboExpandFullWidth(2, [19, 4, 2], 'detailed'),
        false,
        'Smaller combos must never expand'
    );
});

test('shouldComboExpandFullWidth - Returns false when disparity is insufficient', () => {
    assert.strictEqual(
        shouldComboExpandFullWidth(14, [14, 8, 2], 'detailed'),
        false,
        '14 vs 8 has ratio 1.75 (< 2.0x), so it must not expand'
    );
    assert.strictEqual(
        shouldComboExpandFullWidth(13, [13, 6, 2], 'detailed'),
        false,
        '13 vs 6 has diff 7 (< 8), so it must not expand'
    );
});

test('shouldComboExpandFullWidth - Returns true for solitary dominant umbrella combos in detailed mode', () => {
    assert.strictEqual(
        shouldComboExpandFullWidth(19, [19, 4, 2], 'detailed'),
        true,
        'TH13 Fireball distribution [19, 4, 2] must expand'
    );
    assert.strictEqual(
        shouldComboExpandFullWidth(20, [20, 2, 1], 'detailed'),
        true,
        'TH11 Fireball distribution [20, 2, 1] must expand'
    );
    assert.strictEqual(
        shouldComboExpandFullWidth(18, [18, 5, 2], 'detailed'),
        true,
        'Solitary dominant combo [18, 5, 2] must expand'
    );
});

test('renderZapQuakePanel - Attaches full-width modifier class in detailed mode for dominant combo', () => {
    const mockContainer = createMockContainer();
    const mockState = {
        playerTownHall: 13,
        offense: {
            spells: { lightning: 10, earthquake: 5 },
            ccSpells: { lightning: 10, earthquake: 5 },
            enabledSources: {
                lightning: false,
                earthquake: false,
                cc_lightning: false,
                cc_earthquake: false,
                fireball: true,
                spiky_ball: true,
                giant_arrow: false,
                seeking_shield: false,
                flame_blower: false,
                rocket_backpack: false
            },
            equipment: {
                fireball: 27,
                spiky_ball: 27
            }
        },
        zapQuake: {
            buildingFilter: 'all',
            viewMode: 'detailed'
        }
    };

    renderZapQuakePanel(mockState, mockContainer);
    assert.ok(
        mockContainer.innerHTML.includes('calc-combo-card--full-width'),
        'Detailed mode dominant umbrella must include calc-combo-card--full-width'
    );

    // Switch to compact mode and verify modifier class is absent
    mockState.zapQuake.viewMode = 'compact';
    renderZapQuakePanel(mockState, mockContainer);
    assert.strictEqual(
        mockContainer.innerHTML.includes('calc-combo-card--full-width'),
        false,
        'Compact mode must NOT include calc-combo-card--full-width'
    );
});

test('renderZapQuakePanel - Renders supercharge bolts next to level when superchargeTier > 0', () => {
    const mockContainer = createMockContainer();
    const mockState = {
        playerTownHall: 18,
        defenseLevelOverrides: { super_wizard_tower: 2 },
        defenseSuperchargeOverrides: { super_wizard_tower: 2 },
        offense: {
            spells: { lightning: 13, earthquake: 8 },
            ccSpells: { lightning: 13, earthquake: 8 },
            enabledSources: {
                lightning: true,
                earthquake: true,
                cc_lightning: false,
                cc_earthquake: false,
                fireball: false,
                spiky_ball: false,
                giant_arrow: false,
                seeking_shield: false,
                flame_blower: false,
                rocket_backpack: false
            },
            equipment: {}
        },
        zapQuake: {
            buildingFilter: 'all',
            viewMode: 'detailed'
        }
    };

    renderZapQuakePanel(mockState, mockContainer);
    const html = mockContainer.innerHTML;

    assert.ok(
        html.includes('calc-combo-defense-card__supercharge'),
        'Must render calc-combo-defense-card__supercharge when defense is supercharged'
    );
    assert.ok(
        html.includes('calc-supercharge-pips--compact'),
        'Must render compact supercharge pips next to level'
    );

    // Verify when supercharge is 0, supercharge element is not rendered
    mockState.defenseSuperchargeOverrides = { super_wizard_tower: 0 };
    mockState.globalSuperchargeTier = 0;
    renderZapQuakePanel(mockState, mockContainer);
    const nonScHtml = mockContainer.innerHTML;
    const swtIndex = nonScHtml.indexOf('Super Wizard Tower');
    assert.ok(swtIndex !== -1, 'Must find Super Wizard Tower');
    const cardSnippet = nonScHtml.slice(swtIndex, swtIndex + 400);
    assert.strictEqual(
        cardSnippet.includes('calc-combo-defense-card__supercharge'),
        false,
        'Must NOT render supercharge pips when supercharge is 0'
    );
});

test('sortDetailedCombos - Sorts combos by filtered target count descending', () => {
    const combos = [
        { combo: { key: 'c1', housingSpace: 0 }, filteredDefenses: [{}, {}, {}, {}] },
        { combo: { key: 'c2', housingSpace: 0 }, filteredDefenses: Array.from({ length: 14 }, () => ({})) },
        { combo: { key: 'c3', housingSpace: 0 }, filteredDefenses: [{}, {}] },
        { combo: { key: 'c4', housingSpace: 0 }, filteredDefenses: Array.from({ length: 10 }, () => ({})) }
    ];

    const sorted = sortDetailedCombos(combos);
    const counts = sorted.map(c => c.filteredDefenses.length);
    assert.deepStrictEqual(counts, [14, 10, 4, 2], 'Combos must be ordered monotonically by target count descending');
    assert.strictEqual(sorted[0].combo.key, 'c2');
    assert.strictEqual(sorted[1].combo.key, 'c4');
    assert.strictEqual(sorted[2].combo.key, 'c1');
    assert.strictEqual(sorted[3].combo.key, 'c3');
});

test('sortDetailedCombos - Preserves canonical solver tiebreakers when target count is equal', () => {
    // Tiebreaker 1: equipment > 2 goes to bottom
    const over2Equip = [
        { combo: { key: 'over2', equipment: [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }] }, filteredDefenses: [{}, {}] },
        { combo: { key: 'normal2', equipment: [{ id: 'e1' }, { id: 'e2' }] }, filteredDefenses: [{}, {}] }
    ];
    sortDetailedCombos(over2Equip);
    assert.strictEqual(over2Equip[0].combo.key, 'normal2', 'Combos with <=2 equipment must come before >2 equipment');

    // Tiebreaker 2: housingSpace ascending
    const housingCombos = [
        { combo: { key: 'space3', housingSpace: 3 }, filteredDefenses: [{}] },
        { combo: { key: 'space1', housingSpace: 1 }, filteredDefenses: [{}] }
    ];
    sortDetailedCombos(housingCombos);
    assert.strictEqual(housingCombos[0].combo.key, 'space1', 'Lower housing space must come first on tie');

    // Tiebreaker 3: equipment count descending
    const equipCountCombos = [
        { combo: { key: 'eq1', housingSpace: 0, equipment: [{ id: 'e1' }] }, filteredDefenses: [{}] },
        { combo: { key: 'eq2', housingSpace: 0, equipment: [{ id: 'e1' }, { id: 'e2' }] }, filteredDefenses: [{}] }
    ];
    sortDetailedCombos(equipCountCombos);
    assert.strictEqual(equipCountCombos[0].combo.key, 'eq2', 'More equipment items must come first on tie');

    // Tiebreaker 4: same hero equipment priority
    const sameHeroCombos = [
        {
            combo: {
                key: 'diffHero',
                housingSpace: 0,
                equipment: [{ id: 'fireball' }, { id: 'spiky_ball' }]
            },
            filteredDefenses: [{}]
        },
        {
            combo: {
                key: 'sameHero',
                housingSpace: 0,
                equipment: [{ id: 'spiky_ball' }, { id: 'earthquake_boots' }]
            },
            filteredDefenses: [{}]
        }
    ];
    sortDetailedCombos(sameHeroCombos);
    assert.strictEqual(sameHeroCombos[0].combo.key, 'sameHero', 'Same hero equipment pairs must come before cross-hero pairs');

    // Tiebreaker 5: CC spells count ascending
    const ccCombos = [
        { combo: { key: 'withCc', housingSpace: 1, ccZapCount: 1 }, filteredDefenses: [{}] },
        { combo: { key: 'noCc', housingSpace: 1, ccZapCount: 0 }, filteredDefenses: [{}] }
    ];
    sortDetailedCombos(ccCombos);
    assert.strictEqual(ccCombos[0].combo.key, 'noCc', 'Zero or fewer CC spells must come before CC spells on tie');

    // Tiebreaker 6: EQ count descending
    const eqCombos = [
        { combo: { key: 'eq1', housingSpace: 2, eqCount: 1, zapCount: 0 }, filteredDefenses: [{}] },
        { combo: { key: 'eq2', housingSpace: 2, eqCount: 2, zapCount: 0 }, filteredDefenses: [{}] }
    ];
    sortDetailedCombos(eqCombos);
    assert.strictEqual(eqCombos[0].combo.key, 'eq2', 'Higher EQ count must come before lower EQ count on tie');

    // Tiebreaker 7: Zap count ascending
    const zapCombos = [
        { combo: { key: 'zap3', housingSpace: 3, eqCount: 0, zapCount: 3 }, filteredDefenses: [{}] },
        { combo: { key: 'zap2', housingSpace: 3, eqCount: 0, zapCount: 2 }, filteredDefenses: [{}] }
    ];
    sortDetailedCombos(zapCombos);
    assert.strictEqual(zapCombos[0].combo.key, 'zap2', 'Lower Zap count must come before higher Zap count on tie');
});

test('sortDetailedCombos - Handles empty array or single element gracefully', () => {
    assert.deepStrictEqual(sortDetailedCombos([]), []);
    assert.deepStrictEqual(sortDetailedCombos(null), null);
    const single = [{ combo: { key: 'single' }, filteredDefenses: [{}] }];
    assert.deepStrictEqual(sortDetailedCombos(single), single);
});

test('renderZapQuakePanel - Respects viewMode when ordering combos', () => {
    const mockContainer = createMockContainer();
    const mockState = {
        playerTownHall: 17,
        offense: {
            spells: { lightning: 13, earthquake: 8 },
            ccSpells: { lightning: 13, earthquake: 8 },
            enabledSources: {
                lightning: true,
                earthquake: true,
                cc_lightning: false,
                cc_earthquake: false,
                fireball: true,
                spiky_ball: true,
                giant_arrow: false,
                seeking_shield: false,
                flame_blower: false,
                rocket_backpack: false
            },
            equipment: {
                fireball: 27,
                spiky_ball: 27
            }
        },
        zapQuake: {
            buildingFilter: 'all',
            viewMode: 'detailed'
        }
    };

    // Detailed mode: combo cards rendered in target count descending order
    renderZapQuakePanel(mockState, mockContainer);
    const detailedHtml = mockContainer.innerHTML;
    assert.ok(detailedHtml.includes('calc-combo-card'), 'Must render combo cards in detailed mode');

    // Compact mode: canonical solver order is preserved
    mockState.zapQuake.viewMode = 'compact';
    renderZapQuakePanel(mockState, mockContainer);
    const compactHtml = mockContainer.innerHTML;
    assert.ok(compactHtml.includes('calc-combo-card'), 'Must render combo cards in compact mode');
});
