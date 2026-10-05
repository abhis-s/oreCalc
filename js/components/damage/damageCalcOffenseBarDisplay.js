/**
 * DOM Rendering Engine for Damage Calculator Offense / Battle Modifier Bar.
 * Tier 4: UI Presentation (Dedicated exclusively to Battle Modifier bar rendering and layout observation).
 */

import { escapeHTML } from '../../utils/stringUtils.js';
import { translate } from '../../i18n/translator.js';
import { getActiveModifier } from './damageCalcState.js';
import {
    renderBattleModifierSwitcher,
    getBattleModifierSwitcherMarkup
} from '../common/battleModifierSwitcher.js';

/**
 * Measures available width vs required width in place and stacks label above switch only on space constraint.
 *
 * @param {HTMLElement} container - Modifier bar section element.
 */
export function updateModifierBarLayout(container) {
    if (!container) return;
    const inner = container.querySelector('.calc-modifier-bar__inner');
    const label = container.querySelector('.calc-modifier-bar__label');
    const tabs = container.querySelector('.calc-modifier-tabs');
    if (!inner || !label || !tabs) return;

    const labelGroup = container.querySelector('.calc-modifier-bar__label-group') || label;

    // Read phase: measure available and required widths
    const availableWidth = inner.clientWidth;
    const labelWidth = labelGroup.offsetWidth;
    const tabsScrollWidth = tabs.scrollWidth;
    const gap = 16;
    const minPaddingBuffer = 12;

    const shouldStack = (availableWidth - labelWidth - gap) < (tabsScrollWidth + minPaddingBuffer);

    // Write phase: mutate DOM class
    inner.classList.toggle('is-stacked', shouldStack);
}

/** @type {WeakSet<HTMLElement>} */
const observedModifierBars = new WeakSet();

/**
 * Renders the Battle Modifiers bar using the global switcher component.
 *
 * @param {Object} state - Damage calculator state.
 * @param {HTMLElement} container - Target DOM container.
 */
export function renderOffenseBar(state, container) {
    if (!container) return;

    const currentLeague = getActiveModifier(state);

    if (container.dataset?.activeKey === currentLeague && container.querySelector?.('.calc-modifier-tabs')) {
        return;
    }

    if (container.dataset) {
        container.dataset.activeKey = currentLeague;
    }

    let innerContainer = typeof container.querySelector === 'function'
        ? container.querySelector('.calc-modifier-bar__inner')
        : null;

    if (!innerContainer) {
        container.innerHTML = `
            <div class="calc-modifier-bar__inner">
                <div class="calc-modifier-bar__label-group">
                    <span class="calc-modifier-bar__label" data-i18n="views.damageCalc.offense.battleModifier">${escapeHTML(translate('views.damageCalc.offense.battleModifier') || 'Modifier:')}</span>
                </div>
                <div class="calc-modifier-bar__tabs-container"></div>
            </div>
        `;
        innerContainer = typeof container.querySelector === 'function'
            ? container.querySelector('.calc-modifier-bar__inner')
            : null;
    }

    const tabsContainer = innerContainer && typeof innerContainer.querySelector === 'function'
        ? innerContainer.querySelector('.calc-modifier-bar__tabs-container')
        : null;

    if (tabsContainer) {
        renderBattleModifierSwitcher(/** @type {HTMLElement} */ (tabsContainer), currentLeague, {
            includePercentages: true,
            customClass: 'calc-modifier-tabs'
        });
    } else {
        const tabsMarkup = getBattleModifierSwitcherMarkup(currentLeague, {
            includePercentages: true,
            customClass: 'calc-modifier-tabs'
        });
        container.innerHTML = `
            <div class="calc-modifier-bar__inner">
                <div class="calc-modifier-bar__label-group">
                    <span class="calc-modifier-bar__label" data-i18n="views.damageCalc.offense.battleModifier">${escapeHTML(translate('views.damageCalc.offense.battleModifier') || 'Modifier:')}</span>
                </div>
                <div class="calc-modifier-bar__tabs-container">
                    ${tabsMarkup}
                </div>
            </div>
        `;
    }

    if (!observedModifierBars.has(container)) {
        observedModifierBars.add(container);
        if (typeof window !== 'undefined' && typeof window.ResizeObserver === 'function') {
            const ro = new window.ResizeObserver(() => {
                if (typeof requestAnimationFrame === 'function') {
                    requestAnimationFrame(() => updateModifierBarLayout(container));
                } else {
                    updateModifierBarLayout(container);
                }
            });
            ro.observe(container);
        }
    }

    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => updateModifierBarLayout(container));
    }
}
