/**
 * Test Suite: Damage Calculator Target Combos Modal
 * Feature Domain: Damage Calculator Modal Presentation & Interaction
 *
 * Verifies that the Target Combinations modal renders target defense stats,
 * level slider, non-dominated combo list, optimal/selected indicators, and selection controls.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTargetCombosModal } from '../../js/components/damage/damageCalcTargetCombosModalDisplay.js';
import { getSharedComboPopoverContent } from '../../js/components/damage/damageCalcGridPopoversDisplay.js';
import { renderSliderTicksHtml } from '../../js/components/common/steppedSlider.js';
import { getLvlShort } from '../../js/components/damage/damageCalcDisplay.js';
import {
    attachTargetCombosModalListeners,
    resetTargetCombosSuperchargeMemory
} from '../../js/components/damage/damageCalcTargetCombosModalInputs.js';
import { damageCalcState } from '../../js/components/damage/damageCalcState.js';
import { loadTranslations } from '../../js/i18n/translator.js';
import enJson from '../../js/i18n/en.json' with { type: 'json' };
import deJson from '../../js/i18n/de.json' with { type: 'json' };

import { preloadDefensesData } from '../../js/data/defenseTargetsData.js';
import { readFileSync as _rfs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const _targetsDir = path.resolve(__dirname, '../../js/data/targets');
globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/en.json')) return { ok: true, json: async () => enJson };
    if (urlStr.includes('/de.json')) return { ok: true, json: async () => deJson };
    if (urlStr.includes('/targets/')) {
        const file = urlStr.split('/').pop();
        const data = JSON.parse(_rfs(path.resolve(_targetsDir, file), 'utf8'));
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

test('Target Combos Modal - Renders overview, non-dominated combinations, and selection controls', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        playerTownHall: 18,
        offense: {
            spells: { lightning: 13, earthquake: 8 },
            equipment: { fireball: 27 },
            enabledSources: {
                lightning: true,
                earthquake: true,
                fireball: true
            }
        },
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCombos: {}
        }
    };

    renderTargetCombosModal(state, container, 'air_defense', 16, 0);
    const html = container.innerHTML;

    assert.ok(html.includes('calc-target-combos-sheet'), 'Must render target combos sheet');
    assert.ok(html.includes('Air Defense'), 'Must render target defense name');
    assert.ok(html.includes('calc-target-combos-overview__hp-row'), 'Must render hp-row');
    assert.ok(html.includes('calc-target-combos-overview__sep'), 'Must render middle dot separator');
    const hpRowHtml = html.slice(html.indexOf('calc-target-combos-overview__hp-row'), html.indexOf('calc-target-combos-overview__level-control'));
    assert.ok(hpRowHtml.includes('id="calc-target-modal-level-label"'), 'Must render level label inside hp-row');
    assert.ok(html.includes('calc-stepper-track'), 'Must render stepper track');
    assert.ok(html.includes('data-action="target-level-dec"'), 'Must render level decrement button');
    assert.ok(html.includes('data-action="target-level-inc"'), 'Must render level increment button');
    assert.ok(html.includes('calc-target-modal-slider-wrap'), 'Must render stepped slider wrapper');
    assert.ok(html.includes('calc-stepped-slider'), 'Must render stepped slider container');
    assert.ok(html.includes('calc-slider-ticks'), 'Must render stepped slider ticks container');
    assert.ok(html.includes('calc-slider-tick'), 'Must render stepped slider tick elements');
    assert.equal((html.match(/\bcalc-slider-tick\b/g) || []).length, 16, 'Must render 16 step tick marks for level 16 defense');
    assert.ok(html.includes('calc-target-modal-slider'), 'Must render defense level slider');
    assert.ok(html.includes('calc-supercharge-pills'), 'Must render supercharge pills for superchargeable defense');
    assert.ok(html.includes('calc-target-combos-list'), 'Must render combinations list');
    assert.ok(html.includes('calc-target-combo-row'), 'Must render at least one combo row');
    assert.ok(!html.includes('calc-target-combo-row__optimal-tag'), 'Must NOT render optimal tag per design requirement');
    assert.ok(!html.includes('calc-target-combo-badge__meta'), 'Must NOT render equipment level meta per design requirement');
    assert.ok(html.includes('calc-target-combo-row__info-btn'), 'Must render info button for damage breakdown popover');
    assert.ok(html.includes('calc-target-combo-row__selected-pill'), 'Must render Selected pill for active combo');
    assert.ok(html.includes('<span data-i18n="views.damageCalc.zapQuake.selectedCombo">'), 'data-i18n must be on inner text span of selected pill');
    assert.ok(!html.includes('class="calc-target-combo-row__selected-pill" data-i18n'), 'Outer selected pill must not have data-i18n');
    assert.ok(html.includes('<span data-i18n="views.damageCalc.zapQuake.possibleCombosTitle">'), 'data-i18n must be on inner span of possible combos title');
    assert.ok(!html.includes('class="calc-target-combos-list-title" data-i18n'), 'Outer title element must not have data-i18n');
    assert.ok(html.includes('data-action="select-target-combo"'), 'Must render select combo button for non-selected options');

    // Test with selected combo override
    const overrideContainer = createMockContainer();
    const overrideState = {
        ...state,
        zapQuake: {
            ...state.zapQuake,
            selectedCombos: {
                air_defense: '1eq_3zap__cc_0eq_0zap'
            }
        }
    };
    renderTargetCombosModal(overrideState, overrideContainer, 'air_defense', 16, 0);
    const overrideHtml = overrideContainer.innerHTML;
    assert.ok(overrideHtml.includes('data-action="reset-to-optimal"'), 'Must render Reset to Optimal button when override is active');
});

test('Target Combos Modal - Renders non-optimal collapsible section when combos require 6+ spells', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        playerTownHall: 18,
        offense: {
            spells: { lightning: 13, earthquake: 8 },
            equipment: {
                giant_gauntlet: 27,
                spiky_ball: 27,
                fireball: 27,
                rocket_spear: 27,
                shield: 18
            },
            enabledSources: {
                lightning: true,
                earthquake: true,
                giant_gauntlet: true,
                spiky_ball: true,
                fireball: true,
                rocket_spear: true,
                shield: true
            }
        },
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCombos: {}
        }
    };

    renderTargetCombosModal(state, container, 'scattershot', 7, 2);
    const html = container.innerHTML;

    assert.ok(html.includes('calc-target-combos-collapse'), 'Must render collapsible details container for non-optimal combos');
    assert.ok(html.includes('calc-target-combos-collapse__summary'), 'Must render summary header for non-optimal combos');
    assert.ok(html.includes('data-i18n="views.damageCalc.zapQuake.nonOptimalCombosTitle"'), 'Summary must declare i18n key for non-optimal title');
    // Header should show optimal count (52)
    assert.ok(html.includes('(52)'), 'Possible combinations counter must count strictly optimal combos (< 6 spells)');
    // Non-optimal section should show non-optimal count (9)
    assert.ok(html.includes('(9)</span>'), 'Non-optimal counter in summary must count combos with 6+ spells');
});

test('renderSliderTicksHtml - Generates stepped ticks accurately', () => {
    assert.equal(renderSliderTicksHtml(1, 1), '', 'Must return empty string when max <= min');
    assert.equal(renderSliderTicksHtml(1, 0), '', 'Must return empty string when max < min');

    const fiveTicksHtml = renderSliderTicksHtml(1, 5);
    const tickMatches = fiveTicksHtml.match(/class="calc-slider-tick/g) || [];

    assert.equal(tickMatches.length, 5, 'Must generate exactly 5 tick marks for range 1 to 5');
});

test('Target Combos Modal - Preserves supercharge tier in-memory across level scrubbing', () => {
    resetTargetCombosSuperchargeMemory();

    function createMockNode(tag = 'div', attributes = {}) {
        const attrs = new Map(Object.entries(attributes));
        const classSet = new Set((attributes.className || '').split(/\s+/).filter(Boolean));
        const eventListeners = new Map();

        const node = {
            tagName: tag.toUpperCase(),
            value: attributes.value || '',
            textContent: '',
            innerHTML: '',
            disabled: Boolean(attributes.disabled),
            classList: {
                add: (c) => classSet.add(c),
                remove: (c) => classSet.delete(c),
                toggle: (c, force) => {
                    const shouldAdd = force !== undefined ? Boolean(force) : !classSet.has(c);
                    if (shouldAdd) classSet.add(c);
                    else classSet.delete(c);
                    return shouldAdd;
                },
                contains: (c) => classSet.has(c)
            },
            getAttribute: (attr) => attrs.get(attr) ?? null,
            setAttribute: (attr, val) => attrs.set(attr, String(val)),
            removeAttribute: (attr) => attrs.delete(attr),
            addEventListener: (event, cb) => {
                if (!eventListeners.has(event)) eventListeners.set(event, []);
                eventListeners.get(event).push(cb);
            },
            dispatchEvent: (event) => {
                const type = typeof event === 'string' ? event : (event.type || '');
                const handlers = eventListeners.get(type) || [];
                handlers.forEach(h => h({ target: node, currentTarget: node }));
            },
            closest: () => null,
            querySelector: () => null,
            querySelectorAll: () => []
        };
        return node;
    }

    const defenseKey = 'super_wizard_tower';
    const sheetNode = createMockNode('div', {
        className: 'calc-target-combos-sheet',
        'data-defense-key': defenseKey,
        'data-active-supercharge': '2'
    });
    const sliderNode = createMockNode('input', {
        id: 'calc-target-modal-level-slider',
        value: '2'
    });
    const scWrapNode = createMockNode('div', {
        id: 'calc-target-modal-supercharge-wrap'
    });
    const levelLabelNode = createMockNode('span', { id: 'calc-target-modal-level-label' });
    const thumbNode = createMockNode('img', { id: 'calc-target-modal-thumb' });
    const listWrapNode = createMockNode('div', { id: 'calc-target-combos-list-wrapper' });
    const hpNode = createMockNode('span', { id: 'calc-target-modal-hp' });
    const resetWrapNode = createMockNode('div', { id: 'calc-target-modal-reset-wrap' });

    const pills = [0, 1, 2, 3].map(tier => createMockNode('button', {
        className: `calc-supercharge-pill ${tier === 2 ? 'active is-active' : ''}`,
        'data-tier': String(tier)
    }));
    scWrapNode.querySelectorAll = (sel) => {
        if (sel.includes('calc-supercharge-pill')) return pills;
        return [];
    };

    const mockModalBody = {
        querySelector: (sel) => {
            if (sel.includes('calc-target-combos-sheet')) return sheetNode;
            if (sel.includes('calc-target-modal-level-slider')) return sliderNode;
            if (sel.includes('calc-target-modal-supercharge-wrap')) return scWrapNode;
            if (sel.includes('calc-target-modal-level-label')) return levelLabelNode;
            if (sel.includes('calc-target-modal-thumb')) return thumbNode;
            if (sel.includes('calc-target-combos-list-wrapper')) return listWrapNode;
            if (sel.includes('calc-target-modal-hp')) return hpNode;
            if (sel.includes('calc-target-modal-reset-wrap')) return resetWrapNode;
            return null;
        },
        querySelectorAll: (sel) => {
            if (sel.includes('calc-supercharge-pill')) return pills;
            if (sel.includes('select-target-combo')) return [];
            return [];
        }
    };

    const testState = {
        ...damageCalcState,
        playerTownHall: 18,
        defenseLevelOverrides: { [defenseKey]: 2 },
        defenseSuperchargeOverrides: { [defenseKey]: 2 },
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCombos: {}
        }
    };

    attachTargetCombosModalListeners(testState, mockModalBody, () => {});

    // 1. Initial State: Super Wizard Tower Level 2 + Tier 2 Supercharge
    assert.equal(sheetNode.getAttribute('data-active-supercharge'), '2');
    assert.equal(testState.defenseSuperchargeOverrides[defenseKey], 2);

    // 2. Scrub down to Level 1 (supercharge is not supported at level 1)
    sliderNode.value = '1';
    sliderNode.dispatchEvent('input');

    assert.equal(sheetNode.getAttribute('data-active-supercharge'), '0', 'Active supercharge on sheet must be 0 while at Level 1');
    assert.equal(testState.defenseSuperchargeOverrides[defenseKey], undefined, 'Supercharge override must be unset while at Level 1');
    assert.ok(scWrapNode.classList.contains('is-disabled'), 'Supercharge container must be marked disabled at Level 1');
    assert.ok(pills[0].classList.contains('active'), 'Tier 0 must be active at Level 1');
    assert.ok(pills[2].disabled, 'Pills must be disabled at Level 1');

    // 3. Scrub back up to Level 2 (reinstates remembered Tier 2)
    sliderNode.value = '2';
    sliderNode.dispatchEvent('input');

    assert.equal(sheetNode.getAttribute('data-active-supercharge'), '2', 'Must reinstate Tier 2 supercharge upon scrubbing back to Level 2');
    assert.equal(testState.defenseSuperchargeOverrides[defenseKey], 2, 'Must reinstate Tier 2 in state overrides');
    assert.equal(scWrapNode.classList.contains('is-disabled'), false, 'Supercharge container must be enabled at Level 2');
    assert.ok(pills[2].classList.contains('active'), 'Tier 2 pill must be active when reinstated');
    assert.equal(pills[2].disabled, false, 'Pills must be enabled at Level 2');

    // 4. User explicitly interacts: selects Tier 1
    pills[1].dispatchEvent('click');
    assert.equal(sheetNode.getAttribute('data-active-supercharge'), '1', 'Must switch to explicitly selected Tier 1');
    assert.equal(testState.defenseSuperchargeOverrides[defenseKey], 1);

    // 5. Scrub to Level 1 and back to Level 2: must reinstate Tier 1 (the overwritten choice)
    sliderNode.value = '1';
    sliderNode.dispatchEvent('input');
    assert.equal(sheetNode.getAttribute('data-active-supercharge'), '0');

    sliderNode.value = '2';
    sliderNode.dispatchEvent('input');
    assert.equal(sheetNode.getAttribute('data-active-supercharge'), '1', 'Must reinstate Tier 1 from memory');
    assert.equal(testState.defenseSuperchargeOverrides[defenseKey], 1);

    // 6. User explicitly interacts: selects Tier 0 (None)
    pills[0].dispatchEvent('click');
    assert.equal(sheetNode.getAttribute('data-active-supercharge'), '0', 'Must switch to explicitly selected Tier 0');
    assert.equal(testState.defenseSuperchargeOverrides[defenseKey], 0);

    // 7. Scrub to Level 1 and back to Level 2: must reinstate Tier 0 (the overwritten choice)
    sliderNode.value = '1';
    sliderNode.dispatchEvent('input');
    assert.equal(sheetNode.getAttribute('data-active-supercharge'), '0');

    sliderNode.value = '2';
    sliderNode.dispatchEvent('input');
    assert.equal(sheetNode.getAttribute('data-active-supercharge'), '0', 'Must reinstate Tier 0 from memory');
    assert.equal(testState.defenseSuperchargeOverrides[defenseKey], 0, 'Must keep Tier 0 in state overrides');

    // 8. Modal close drops the in-memory cache
    resetTargetCombosSuperchargeMemory();

    // Now re-attaching at Level 1 should start clean
    sheetNode.setAttribute('data-active-supercharge', '0');
    delete testState.defenseSuperchargeOverrides[defenseKey];
    testState.defenseLevelOverrides[defenseKey] = 1;
    attachTargetCombosModalListeners(testState, mockModalBody, () => {});

    sliderNode.value = '2';
    sliderNode.dispatchEvent('input');
    assert.equal(sheetNode.getAttribute('data-active-supercharge'), '0', 'Memory was dropped on modal close, so level 2 does not revive old tier');
});

test('Target Combos Modal - Stepper buttons increment and decrement defense level', () => {
    resetTargetCombosSuperchargeMemory();

    function createMockNode(tag = 'div', attributes = {}) {
        const attrs = new Map(Object.entries(attributes));
        const classSet = new Set((attributes.className || '').split(/\s+/).filter(Boolean));
        const eventListeners = new Map();

        const node = {
            tagName: tag.toUpperCase(),
            value: attributes.value || '',
            textContent: '',
            innerHTML: '',
            disabled: Boolean(attributes.disabled),
            classList: {
                add: (c) => classSet.add(c),
                remove: (c) => classSet.delete(c),
                toggle: (c, force) => {
                    const shouldAdd = force !== undefined ? Boolean(force) : !classSet.has(c);
                    if (shouldAdd) classSet.add(c);
                    else classSet.delete(c);
                    return shouldAdd;
                },
                contains: (c) => classSet.has(c)
            },
            getAttribute: (attr) => attrs.get(attr) ?? null,
            setAttribute: (attr, val) => attrs.set(attr, String(val)),
            removeAttribute: (attr) => attrs.delete(attr),
            addEventListener: (event, cb) => {
                if (!eventListeners.has(event)) eventListeners.set(event, []);
                eventListeners.get(event).push(cb);
            },
            dispatchEvent: (event) => {
                const type = typeof event === 'string' ? event : (event.type || '');
                const handlers = eventListeners.get(type) || [];
                handlers.forEach(h => h({ target: node, currentTarget: node }));
            },
            closest: () => null,
            querySelector: () => null,
            querySelectorAll: () => []
        };
        return node;
    }

    const defenseKey = 'inferno_tower';
    const sheetNode = createMockNode('div', {
        className: 'calc-target-combos-sheet',
        'data-defense-key': defenseKey,
        'data-active-supercharge': '0'
    });
    const sliderNode = createMockNode('input', {
        id: 'calc-target-modal-level-slider',
        value: '2'
    });
    const decBtn = createMockNode('button', {
        'data-action': 'target-level-dec',
        disabled: false
    });
    const incBtn = createMockNode('button', {
        'data-action': 'target-level-inc',
        disabled: false
    });
    const scWrapNode = createMockNode('div', {
        id: 'calc-target-modal-supercharge-wrap'
    });
    const levelLabelNode = createMockNode('span', { id: 'calc-target-modal-level-label' });
    const thumbNode = createMockNode('img', { id: 'calc-target-modal-thumb' });
    const listWrapNode = createMockNode('div', { id: 'calc-target-combos-list-wrapper' });
    const hpNode = createMockNode('span', { id: 'calc-target-modal-hp' });
    const resetWrapNode = createMockNode('div', { id: 'calc-target-modal-reset-wrap' });

    const mockModalBody = {
        querySelector: (sel) => {
            if (sel.includes('calc-target-combos-sheet')) return sheetNode;
            if (sel.includes('calc-target-modal-level-slider')) return sliderNode;
            if (sel.includes('target-level-dec')) return decBtn;
            if (sel.includes('target-level-inc')) return incBtn;
            if (sel.includes('calc-target-modal-supercharge-wrap')) return scWrapNode;
            if (sel.includes('calc-target-modal-level-label')) return levelLabelNode;
            if (sel.includes('calc-target-modal-thumb')) return thumbNode;
            if (sel.includes('calc-target-combos-list-wrapper')) return listWrapNode;
            if (sel.includes('calc-target-modal-hp')) return hpNode;
            if (sel.includes('calc-target-modal-reset-wrap')) return resetWrapNode;
            return null;
        },
        querySelectorAll: (sel) => {
            if (sel.includes('calc-supercharge-pill')) return [];
            if (sel.includes('select-target-combo')) return [];
            return [];
        }
    };

    const testState = {
        ...damageCalcState,
        playerTownHall: 18,
        defenseLevelOverrides: { [defenseKey]: 2 },
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCombos: {}
        }
    };

    attachTargetCombosModalListeners(testState, mockModalBody, () => {});

    // Decrement from level 2 to level 1
    decBtn.dispatchEvent('click');
    assert.equal(sliderNode.value, '1', 'Slider value must be 1 after decrement');
    assert.equal(testState.defenseLevelOverrides[defenseKey], 1, 'State override must be 1 after decrement');
    assert.equal(decBtn.disabled, true, 'Decrement button must be disabled at min level 1');

    // Increment from level 1 to level 2
    incBtn.dispatchEvent('click');
    assert.equal(sliderNode.value, '2', 'Slider value must be 2 after increment');
    assert.equal(testState.defenseLevelOverrides[defenseKey], 2, 'State override must be 2 after increment');
    assert.equal(decBtn.disabled, false, 'Decrement button must be enabled at level 2');
});

test('Target Combos Modal - Renders TH Max badge and enforces TH level cap for non-max Town Hall', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        playerTownHall: 12,
        offense: {
            spells: { lightning: 9, earthquake: 5 },
            equipment: {},
            enabledSources: { lightning: true, earthquake: true }
        },
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCombos: {}
        }
    };

    // Air Defense has max level 10 at TH12 (overall max is 16)
    renderTargetCombosModal(state, container, 'air_defense', 16, 0);
    const html = container.innerHTML;

    assert.ok(html.includes('calc-target-combos-overview__th-max'), 'Must render TH Max container for non-max Town Hall');
    assert.ok(html.includes('TH 12 Max'), 'Must render exact TH 12 Max text');
    assert.ok(html.includes('max="16"'), 'Stepped slider must maintain full size max=16');
    assert.ok(html.includes('value="10"'), 'Slider value must be clamped to TH12 cap (10)');
    assert.ok(html.includes('data-max-allowed="10"'), 'Slider must declare data-max-allowed="10"');
    assert.ok(html.includes('calc-slider-locked-track'), 'Must render locked track segment for steps beyond TH12');
    assert.equal((html.match(/\bcalc-slider-tick\b/g) || []).length, 16, 'Must render all 16 ticks across full size range');
    assert.equal((html.match(/calc-slider-tick is-disabled/g) || []).length, 6, 'Must mark steps 11 through 16 as disabled ticks');
});

test('Target Combos Modal - Does not render TH tag when level is set below Town Hall max', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        playerTownHall: 12,
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCombos: {}
        }
    };

    // Air Defense at level 5 at TH12 (cap is 10)
    renderTargetCombosModal(state, container, 'air_defense', 5, 0);
    const html = container.innerHTML;

    assert.ok(!html.includes('calc-target-combos-overview__th-max'), 'Must not render TH tag container when below Town Hall max');
    assert.doesNotMatch(html, /TH 12 Max/, 'Must not render "TH 12 Max" when below Town Hall cap');
});

test('Target Combos Modal - Appends (HP Module) exclusively to crafted defenses', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        playerTownHall: 18,
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCombos: {}
        }
    };

    // 1. Crafted: Hot Candle
    renderTargetCombosModal(state, container, 'hot_candle', 10, 0);
    assert.ok(container.innerHTML.includes('Hot Candle (HP Module)'), 'Hot Candle must have (HP Module) hint');

    // 2. Crafted: Hero Hunter
    renderTargetCombosModal(state, container, 'hero_hunter', 10, 0);
    assert.ok(container.innerHTML.includes('Hero Hunter (HP Module)'), 'Hero Hunter must have (HP Module) hint');

    // 3. Crafted: Cake-A-Pult
    renderTargetCombosModal(state, container, 'cake_a_pult', 10, 0);
    assert.ok(container.innerHTML.includes('Cake-A-Pult (HP Module)'), 'Cake-A-Pult must have (HP Module) hint');

    // 4. Non-crafted: Inferno Tower
    renderTargetCombosModal(state, container, 'inferno_tower', 12, 0);
    assert.ok(!container.innerHTML.includes('Inferno Tower (HP Module)'), 'Inferno Tower must NOT have (HP Module) hint');
    assert.ok(container.innerHTML.includes('Inferno Tower'), 'Inferno Tower must render base name');
});

test('Target Combos Modal - Renders Default badge and Reset button', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        playerTownHall: 18,
        offense: {
            spells: { lightning: 13, earthquake: 8 },
            equipment: {},
            enabledSources: { lightning: true, earthquake: true }
        },
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCombos: {
                air_defense: '1eq_3zap__cc_0eq_0zap'
            }
        }
    };

    renderTargetCombosModal(state, container, 'air_defense', 16, 0);
    const html = container.innerHTML;

    assert.ok(html.includes('calc-target-combos-overview__reset-btn'), 'Must render reset button');
    assert.ok(html.includes('data-action="reset-to-optimal"'), 'Must have reset action attribute');
    assert.ok(html.includes('>Reset<'), 'Must display "Reset" label on button');
    assert.ok(!html.includes('>Reset to Optimal<'), 'Must NOT display legacy "Reset to Optimal"');

    assert.ok(html.includes('calc-target-combo-row__default-pill'), 'Must render Default pill on default combo');
    assert.ok(html.includes('<span data-i18n="views.damageCalc.zapQuake.defaultCombo">Default</span>'), 'Default pill must contain localized text');
});

test('Target Combos Modal - Renders Shared (n) badge with correct ordering', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        playerTownHall: 18,
        offense: {
            spells: { lightning: 13, earthquake: 8 },
            equipment: {},
            enabledSources: {
                lightning: true,
                earthquake: true,
                fireball: false,
                spiky_ball: false,
                giant_arrow: false,
                seeking_shield: false,
                flame_blower: false,
                rocket_backpack: false
            }
        },
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCombos: {
                inferno_tower: '1eq_2zap__cc_0eq_0zap',
                x_bow: '1eq_2zap__cc_0eq_0zap'
            }
        }
    };

    renderTargetCombosModal(state, container, 'air_defense', 16, 0);
    const html = container.innerHTML;

    assert.ok(html.includes('calc-target-combo-row__shared-pill'), 'Must render shared pill');
    assert.ok(html.includes('data-shared-combo-info="true"'), 'Shared pill must have data-shared-combo-info attribute');
    assert.ok(html.includes('data-shared-defenses="hidden_tesla,archer_tower"'), 'Must list naturally shared defense keys');
    assert.ok(html.includes('Shared (2)'), 'Must show count of 2 other shared defenses');

    const sharedIndex = html.indexOf('calc-target-combo-row__shared-pill');
    const defaultIndex = html.indexOf('calc-target-combo-row__default-pill');
    const infoIndex = html.indexOf('calc-target-combo-row__info-btn');
    const selectedIndex = html.indexOf('calc-target-combo-row__selected-pill');

    assert.ok(sharedIndex !== -1, 'Shared pill must exist in HTML');
    assert.ok(defaultIndex !== -1, 'Default pill must exist in HTML');
    assert.ok(infoIndex !== -1, 'Info button must exist in HTML');
    assert.ok(selectedIndex !== -1, 'Selected pill must exist in HTML');
    assert.ok(sharedIndex < defaultIndex, 'Shared pill (position 1) must precede Default pill (position 2)');
    assert.ok(defaultIndex < infoIndex, 'Default pill must precede Info button');
    assert.ok(infoIndex < selectedIndex, 'Info button must precede Selected pill');
});

test('Target Combos Modal - Renders all dashboard shared defenses (including default optimal assignments)', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        playerTownHall: 18,
        offense: {
            spells: { lightning: 13, earthquake: 8 },
            equipment: { spiky_ball: 27, fireball: 27 },
            enabledSources: {
                lightning: true,
                earthquake: true,
                fireball: true,
                spiky_ball: true
            }
        },
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCombos: {
                super_wizard_tower: 'fireball_27__spiky_ball_27__0eq_0zap__cc_0eq_0zap',
                hero_hunter: 'giant_arrow_18__3eq_3zap__cc_0eq_0zap'
            }
        }
    };

    renderTargetCombosModal(state, container, 'clan_castle', 14, 0);
    const html = container.innerHTML;

    assert.ok(html.includes('Shared (11)'), 'Clan Castle must share combo with 11 other in-season defenses');
    assert.ok(html.includes('data-shared-defenses="super_wizard_tower,revenge_tower,ricochet_cannon,monolith,hot_candle,scattershot,cake_a_pult,multi_archer_tower,firespitter,inferno_tower,x_bow"'), 'Must list all 11 shared defenses');
    assert.ok(html.includes('super_wizard_tower'), 'Must include override-assigned defense');
    assert.ok(html.includes('ricochet_cannon'), 'Must include default-assigned defense');
    assert.ok(html.includes('monolith'), 'Must include default-assigned defense');
    assert.ok(html.includes('scattershot'), 'Must include default-assigned defense');
});

test('Target Combos Modal - getSharedComboPopoverContent formats defense names and assets', () => {
    const state = {
        playerTownHall: 18,
        defenseLevelOverrides: {
            inferno_tower: 12
        }
    };

    const content = getSharedComboPopoverContent(['inferno_tower', 'monolith'], state);
    assert.ok(content, 'Must return popover content object');
    assert.ok(content.header.includes('Assigned Targets'), 'Header must include title');
    assert.ok(content.header.includes('<span class="popover-badge">2</span>'), 'Header badge must show count');
    assert.ok(content.body.includes('calc-shared-defenses-list'), 'Body must contain shared list container');
    assert.ok(content.body.includes('Inferno Tower'), 'Body must contain localized name for Inferno Tower');
    assert.ok(content.body.includes('Monolith'), 'Body must contain localized name for Monolith');
    assert.ok(content.body.includes('calc-shared-defense-item__img'), 'Body must contain defense thumbnail images');
});

test('Target Combos Modal - Hero level slider renders discrete ticks and snaps levels to multiples of 5', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        playerTownHall: 18,
        offense: {
            spells: { lightning: 13, earthquake: 8 },
            equipment: {},
            enabledSources: { lightning: true, earthquake: true }
        },
        zapQuake: {
            ...damageCalcState.zapQuake,
            selectedCombos: {}
        }
    };

    // Render Barbarian King at TH18 (maxLevel 110)
    renderTargetCombosModal(state, container, 'barbarian_king', 110, 0);
    const html = container.innerHTML;

    assert.ok(html.includes('Barbarian King'), 'Must render Barbarian King');
    assert.ok(html.includes('id="calc-target-modal-level-slider"'), 'Must render level slider');
    // Barbarian King discrete levels: 1, 5, 10, ..., 110 -> 23 ticks
    const tickMatches = html.match(/\bcalc-slider-tick\b/g) || [];
    assert.equal(tickMatches.length, 23, 'Must render exactly 23 discrete tick marks for Barbarian King');

    // Test snapping an invalid requested level (e.g. 7) to 5
    const containerSnap = createMockContainer();
    renderTargetCombosModal(state, containerSnap, 'barbarian_king', 7, 0);
    const snapHtml = containerSnap.innerHTML;
    assert.ok(snapHtml.includes('Lvl 5'), 'Level 7 must snap to Lvl 5');
    assert.ok(snapHtml.includes('value="5"'), 'Slider value must snap to 5');
});

test('Target Combos Modal - Renders HP Lvl for crafted defenses and Lvl for regular defenses', () => {
    assert.strictEqual(getLvlShort('hero_hunter'), 'HP Lvl');
    assert.strictEqual(getLvlShort('hot_candle'), 'HP Lvl');
    assert.strictEqual(getLvlShort('cake_a_pult'), 'HP Lvl');
    assert.strictEqual(getLvlShort('inferno_tower'), 'Lvl');
    assert.strictEqual(getLvlShort(), 'Lvl');

    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        playerTownHall: 18,
        zapQuake: { ...damageCalcState.zapQuake, selectedCombos: {} }
    };

    renderTargetCombosModal(state, container, 'hero_hunter', 3, 0);
    assert.ok(container.innerHTML.includes('HP Lvl 3'));

    renderTargetCombosModal(state, container, 'inferno_tower', 10, 0);
    assert.ok(container.innerHTML.includes('Lvl 10'));
});

test('Target Combos Modal - Renders supercharge bolts next to level label and not inside hp element', () => {
    const container = createMockContainer();
    const state = {
        ...damageCalcState,
        playerTownHall: 18,
        zapQuake: { ...damageCalcState.zapQuake, selectedCombos: {} }
    };

    renderTargetCombosModal(state, container, 'super_wizard_tower', 2, 2);
    const html = container.innerHTML;

    const levelLabelMatch = html.match(/id="calc-target-modal-level-label"[^>]*>([\s\S]*?)<\/span>/);
    assert.ok(levelLabelMatch, 'Must find level label');
    const levelLabelContent = levelLabelMatch[1];
    assert.ok(levelLabelContent.includes('Lvl 2'), 'Must include Lvl 2 in level label');
    assert.ok(levelLabelContent.includes('calc-supercharge-pips--compact'), 'Must include supercharge pips inside level label');

    const hpMatch = html.match(/id="calc-target-modal-hp"[^>]*>([\s\S]*?)<\/span>/);
    assert.ok(hpMatch, 'Must find hp element');
    const hpContent = hpMatch[1];
    assert.ok(hpContent.includes('6,450 HP'), 'Must display formatted HP in hp element');
    assert.strictEqual(hpContent.includes('calc-supercharge-pips'), false, 'HP element must not contain supercharge pips');
});
