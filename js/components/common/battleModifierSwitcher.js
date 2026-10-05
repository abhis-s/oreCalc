/**
 * Battle Modifier Switcher Component.
 * Tier 4: Common UI Component.
 *
 * Provides a standardized modifier tabs bar across Equipment Details and Damage Calculator.
 */

import { translate } from '../../i18n/translator.js';
import { escapeHTML } from '../../utils/stringUtils.js';

const MODIFIER_KEYS = Object.freeze(['standard', 'legend3', 'legend2', 'legend1', 'esports']);

export const MODIFIER_PERCENTAGE_SUFFIXES = Object.freeze({
    standard: '',
    legend3: ' (+10%)',
    legend2: ' (+15%)',
    legend1: ' (+20%)',
    esports: ''
});

/** @type {ResizeObserver | null} */
let sharedResizeObserver = null;
/** @type {WeakSet<Element>} */
const observedTabs = new WeakSet();
let fallbackResizeBound = false;

/**
 * Registers a modifier tabs container for universal resize tracking.
 * Automatically recalculates sliding pill indicator position on container resize or viewport change.
 *
 * @param {HTMLElement | null} tabsEl - Modifier tabs container element.
 */
export function observeModifierTabsResize(tabsEl) {
    if (!tabsEl || typeof window === 'undefined') return;
    if (observedTabs.has(tabsEl)) return;
    observedTabs.add(tabsEl);

    if (typeof window.ResizeObserver === 'function') {
        if (!sharedResizeObserver) {
            sharedResizeObserver = new window.ResizeObserver((entries) => {
                for (const entry of entries) {
                    const target = /** @type {HTMLElement} */ (entry.target);
                    if (typeof requestAnimationFrame === 'function') {
                        requestAnimationFrame(() => {
                            updateTabIndicator(target, null, false);
                            const activeBtn = target.querySelector?.('.mod-tab-btn.active');
                            if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
                                activeBtn.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
                            }
                        });
                    } else {
                        updateTabIndicator(target, null, false);
                    }
                }
            });
        }
        sharedResizeObserver.observe(tabsEl);
    } else if (!fallbackResizeBound) {
        fallbackResizeBound = true;
        window.addEventListener('resize', () => {
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() => {
                    const activeContainers = document.querySelectorAll('.eq-details-modifier-tabs');
                    activeContainers.forEach(el => {
                        updateTabIndicator(/** @type {HTMLElement} */ (el), null, false);
                        const activeBtn = el.querySelector?.('.mod-tab-btn.active');
                        if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
                            activeBtn.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
                        }
                    });
                });
            }
        }, { passive: true });
    }
}

/**
 * Updates sliding modifier tab pill indicator position with spring motion.
 *
 * @param {HTMLElement | null} modifierTabsContainer - Container element holding tabs and indicator.
 * @param {string | null} [activeModifierTab=null] - Target active modifier key.
 * @param {boolean} [isInstant=false] - Whether to position instantly without transition.
 */
export function updateTabIndicator(modifierTabsContainer, activeModifierTab = null, isInstant = false) {
    if (!modifierTabsContainer || typeof modifierTabsContainer.querySelector !== 'function') return;
    const indicator = modifierTabsContainer.querySelector('.mod-tab-indicator');
    if (!indicator) return;

    if (activeModifierTab && modifierTabsContainer.dataset) {
        modifierTabsContainer.dataset.activeKey = activeModifierTab;
    }

    const keyToFind = activeModifierTab || modifierTabsContainer.dataset?.activeKey;
    const activeBtn = keyToFind
        ? /** @type {HTMLElement | null} */ (modifierTabsContainer.querySelector(`.mod-tab-btn[data-mod-key="${keyToFind}"]`))
        : /** @type {HTMLElement | null} */ (modifierTabsContainer.querySelector('.mod-tab-btn.active'));

    if (activeBtn) {
        const left = activeBtn.offsetLeft;
        const width = activeBtn.offsetWidth;

        if (width === 0) {
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() => {
                    updateTabIndicator(modifierTabsContainer, keyToFind, isInstant);
                });
            }
            return;
        }

        if (isInstant) {
            /** @type {HTMLElement} */ (indicator).style.transition = 'none';
            /** @type {HTMLElement} */ (indicator).style.transform = `translateX(${left}px)`;
            /** @type {HTMLElement} */ (indicator).style.width = `${width}px`;
            void indicator.offsetHeight;
            /** @type {HTMLElement} */ (indicator).style.transition = '';
        } else {
            /** @type {HTMLElement} */ (indicator).style.transform = `translateX(${left}px)`;
            /** @type {HTMLElement} */ (indicator).style.width = `${width}px`;
        }
    }
}

const MODIFIER_DEFAULT_NAMES = Object.freeze({
    standard: 'Standard',
    legend3: 'Legend III',
    legend2: 'Legend II',
    legend1: 'Legend I',
    esports: 'Esports'
});

/**
 * Resolves localized modifier base name with canonical English fallback.
 *
 * @param {string} mKey - Modifier key (standard, legend3, etc.).
 * @returns {string} Localized name string.
 */
function resolveModifierBaseName(mKey) {
    const translated = translate(`views.equipment.modifiers.${mKey}`);
    if (translated && translated !== `views.equipment.modifiers.${mKey}` && !translated.startsWith('[EN] views.equipment.modifiers.')) {
        return translated;
    }
    return MODIFIER_DEFAULT_NAMES[mKey] || mKey;
}

/**
 * Formats user-facing label for a battle modifier key.
 *
 * @param {string} mKey - Modifier key (standard, legend3, etc.).
 * @param {boolean} [includePercentages=false] - Whether to append (+10%), (+15%), etc.
 * @returns {string} Formatted label string.
 */
export function getModifierLabel(mKey, includePercentages = false) {
    const baseName = resolveModifierBaseName(mKey);
    if (includePercentages) {
        const suffix = MODIFIER_PERCENTAGE_SUFFIXES[mKey] || '';
        return `${baseName}${suffix}`;
    }
    return baseName;
}

/**
 * Generates the inner tab HTML for battle modifier buttons.
 * @param {string} activeKey - Active modifier key.
 * @param {boolean} includePercentages - Whether to append modifier bonus percentages.
 * @returns {string} HTML markup string of inner tabs.
 */
function buildModifierTabsInnerHtml(activeKey, includePercentages) {
    let html = '<div class="mod-tab-indicator"></div>';
    for (const mKey of MODIFIER_KEYS) {
        const baseName = resolveModifierBaseName(mKey);
        const suffix = includePercentages ? (MODIFIER_PERCENTAGE_SUFFIXES[mKey] || '') : '';
        const suffixHtml = suffix ? `<span class="mod-tab-percent">${suffix}</span>` : '';
        const activeClass = mKey === activeKey ? 'active' : '';
        html += `<button type="button" class="mod-tab-btn ${activeClass}" data-mod-key="${mKey}" role="tab" aria-selected="${mKey === activeKey}" data-i18n="views.equipment.modifiers.${mKey}">${baseName}${suffixHtml}</button>`;
    }
    return html;
}

/**
 * Generates the HTML markup for battle modifier switcher tabs.
 *
 * @param {string} activeKey - Active modifier key.
 * @param {Object} [options={}] - Options.
 * @param {boolean} [options.includePercentages=false] - Whether to append modifier bonus percentages.
 * @param {string} [options.customClass=''] - Additional CSS classes.
 * @returns {string} HTML markup string.
 */
export function getBattleModifierSwitcherMarkup(activeKey, options = {}) {
    const includePercentages = Boolean(options.includePercentages);
    const customClass = options.customClass ? ` ${options.customClass}` : '';
    const innerHtml = buildModifierTabsInnerHtml(activeKey, includePercentages);
    const ariaLabel = escapeHTML(translate('views.damageCalc.offense.battleModifier'));
    return `<div class="eq-details-modifier-tabs${customClass}" role="tablist" aria-label="${ariaLabel}" data-active-key="${activeKey}">${innerHtml}</div>`;
}

/**
 * Renders the battle modifier switcher into target container.
 * If tabs already exist, updates active states in-place to preserve CSS slide animation.
 *
 * @param {HTMLElement | null} container - Target container.
 * @param {string} activeKey - Active modifier key.
 * @param {Object} [options={}] - Render options.
 * @param {boolean} [options.includePercentages=false] - Whether to append modifier bonus percentages.
 * @param {string} [options.customClass=''] - Additional CSS classes for tabs element.
 */
export function renderBattleModifierSwitcher(container, activeKey, options = {}) {
    if (!container) return;

    const includePercentages = Boolean(options.includePercentages);
    const customClass = options.customClass ? ` ${options.customClass}` : '';
    const hasQuerySelector = typeof container.querySelector === 'function';
    const existingTabs = hasQuerySelector ? container.querySelector('.mod-tab-btn') : null;

    if (existingTabs) {
        const tabsEl = /** @type {HTMLElement} */ (container.classList?.contains?.('eq-details-modifier-tabs')
            ? container
            : (container.querySelector('.eq-details-modifier-tabs') || container));
        observeModifierTabsResize(tabsEl);
        const prevActiveKey = tabsEl.dataset?.activeKey;
        if (tabsEl.dataset) {
            tabsEl.dataset.activeKey = activeKey;
        }
        if (container.dataset) {
            container.dataset.activeKey = activeKey;
        }
        const buttons = tabsEl.querySelectorAll('.mod-tab-btn');
        buttons.forEach(btn => {
            const btnKey = btn.getAttribute('data-mod-key');
            if (!btnKey) return;
            const isActive = btnKey === activeKey;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', String(isActive));

            const baseName = resolveModifierBaseName(btnKey);
            let textUpdated = false;
            if (btn.childNodes && btn.childNodes.length > 0) {
                for (const child of btn.childNodes) {
                    const isTextNode = typeof Node !== 'undefined' ? child.nodeType === Node.TEXT_NODE : child.nodeType === 3;
                    if (isTextNode) {
                        child.textContent = baseName;
                        textUpdated = true;
                        break;
                    }
                }
            }
            if (!textUpdated && !includePercentages && typeof btn.textContent === 'string') {
                btn.textContent = baseName;
            }
        });

        if (prevActiveKey !== activeKey) {
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() => {
                    updateTabIndicator(tabsEl, activeKey, false);
                    const activeBtn = tabsEl.querySelector('.mod-tab-btn.active');
                    if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
                        activeBtn.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
                    }
                });
            }
        }
        return;
    }

    if (container.classList?.contains?.('eq-details-modifier-tabs')) {
        if (container.dataset) {
            container.dataset.activeKey = activeKey;
        }
        container.innerHTML = buildModifierTabsInnerHtml(activeKey, includePercentages);
        if (customClass) {
            container.className += customClass;
        }
    } else {
        container.innerHTML = getBattleModifierSwitcherMarkup(activeKey, options);
    }

    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
            const tabsEl = /** @type {HTMLElement | null} */ (container.classList?.contains?.('eq-details-modifier-tabs')
                ? container
                : (hasQuerySelector ? container.querySelector('.eq-details-modifier-tabs') : null));
            if (tabsEl) {
                observeModifierTabsResize(tabsEl);
                updateTabIndicator(tabsEl, activeKey, true);
                const activeBtn = tabsEl.querySelector?.('.mod-tab-btn.active');
                if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
                    activeBtn.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
                }
            }
        });
    } else {
        const tabsEl = /** @type {HTMLElement | null} */ (container.classList?.contains?.('eq-details-modifier-tabs')
            ? container
            : (hasQuerySelector ? container.querySelector('.eq-details-modifier-tabs') : null));
        if (tabsEl) {
            observeModifierTabsResize(tabsEl);
        }
    }
}
