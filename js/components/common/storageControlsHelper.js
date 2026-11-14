/**
 * Storage Inputs, Overflow Synchronization, and Capacity Progress UI Helper.
 * Tier 4: Common UI Helper (Cohesive component presentation & popover options).
 */

import { STORAGE_LIMITS, STORAGE_OVERFLOW_LIMITS } from '../../core/constants.js';
import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';
import { getActiveCustomComingSoon } from '../../domain/equipment/comingSoonEquipmentDomain.js';
import { translate } from '../../i18n/translator.js';

/**
 * Attaches click event listeners for storage goal preset pills and inline overflow buttons scoped to a container.
 *
 * @param {HTMLElement} container
 */
function ensureGoalContainerClickListener(container) {
    if (!container || container.dataset.goalBound === 'true') return;
    container.dataset.goalBound = 'true';

    container.addEventListener('click', (e) => {
        const target = /** @type {HTMLElement | null} */ (e.target);
        if (!target) return;

        const pill = /** @type {HTMLElement | null} */ (target.closest('[data-goal-preset]'));
        if (pill) {
            const preset = pill.dataset.goalPreset;
            if (preset) {
                handleStateUpdate(() => {
                    if (!state.planner.storageGoal) {
                        state.planner.storageGoal = { preset: 'auto' };
                    }
                    state.planner.storageGoal.preset = /** @type {any} */ (preset);
                });
            }
            return;
        }

        const enableBtn = /** @type {HTMLElement | null} */ (target.closest('[data-action="enable-overflow"]'));
        if (enableBtn) {
            handleStateUpdate(() => {
                state.storedOres.allowOverflow = true;
            });
            return;
        }
    });
}

/**
 * Synchronizes DOM input min/max/maxlength attributes with active storage overflow mode.
 *
 * @param {Record<'shiny'|'glowy'|'starry', HTMLInputElement | null | undefined>} inputsMap - Ore inputs by ore type.
 * @param {boolean} allowOverflow - Whether storage overflow is permitted.
 */
export function syncStoredOreInputBounds(inputsMap, allowOverflow) {
    if (!inputsMap || typeof inputsMap !== 'object') return;

    const ores = ['shiny', 'glowy', 'starry'];
    for (const ore of ores) {
        const input = inputsMap[ore];
        if (!input) continue;

        const maxVal = allowOverflow ? STORAGE_OVERFLOW_LIMITS[ore] : STORAGE_LIMITS[ore];
        input.max = String(maxVal);
        input.maxLength = String(maxVal).length;
    }
}

/**
 * Constructs standardized popover options for stored ore input fields.
 *
 * @param {'shiny' | 'glowy' | 'starry'} oreType - Ore type key.
 * @param {() => boolean} getAllowOverflow - Accessor returning whether overflow is currently enabled.
 * @returns {Record<string, any>} Popover configuration options for registerInputPopover.
 */
export function buildStorageInputPopoverOptions(oreType, getAllowOverflow) {
    const cap = STORAGE_LIMITS[oreType] || 1000;
    const overflowCap = STORAGE_OVERFLOW_LIMITS[oreType] || (cap * 2);

    return {
        min: 0,
        max: () => (getAllowOverflow() ? overflowCap : cap),
        showRange: () => getAllowOverflow(),
        clickToFill: { max: true }
    };
}

/**
 * Renders the Post-Max Goal preset selector bar markup.
 *
 * @param {import('../../core/types.js').ActiveStorageGoal | null | undefined} activeGoal - Active resolved goal.
 * @param {boolean} isEquipmentMaxed - Whether tracked equipment is maxed.
 * @param {boolean} allowOverflow - Whether storage overflow is enabled.
 * @param {string} [contextId='eq'] - Context prefix ('eq' or 'home').
 * @param {Record<string, import('../../core/types.js').HeroItem>} [heroesState=null] - Optional heroes state.
 * @returns {string} HTML markup string.
 */
function renderPostMaxGoalBannerHtml(activeGoal, isEquipmentMaxed, allowOverflow, contextId = 'eq', heroesState = null) {
    if (!isEquipmentMaxed) return '';

    const currentPreset = activeGoal?.preset === 'auto' ? 'maxStorage' : (activeGoal?.preset || 'maxStorage');
    const activeSoon = getActiveCustomComingSoon(heroesState || state.heroes);
    const presets = [
        { id: 'maxStorage', labelKey: 'views.equipment.goals.maxStorage' },
        { id: 'nextEpic', labelKey: activeSoon ? 'entities.equipment.comingSoon' : 'views.equipment.goals.nextEpic' },
        { id: 'none', labelKey: 'views.equipment.goals.none' }
    ];

    const pillsHtml = presets.map(p => {
        const isSelected = currentPreset === p.id;
        const activeClass = isSelected ? ' is-active' : '';
        return `
            <button type="button" class="segmented-btn post-max-goal-btn${activeClass}" data-goal-preset="${p.id}" data-context="${contextId}" aria-selected="${isSelected}">
                <span data-i18n="${p.labelKey}">${translate(p.labelKey)}</span>
            </button>
        `;
    }).join('');

    let overflowHintHtml = '';
    if (activeGoal?.requiresOverflow && !allowOverflow) {
        overflowHintHtml = `
            <div class="post-max-goal-overflow-warning">
                <clashcalc-assets-svg name="warning"></clashcalc-assets-svg>
                <span data-i18n="views.equipment.goals.requiresOverflowHint">${translate('views.equipment.goals.requiresOverflowHint')}</span>
                <button type="button" class="btn-enable-overflow-inline" data-action="enable-overflow" data-context="${contextId}" data-i18n="views.equipment.goals.enableOverflow">
                    ${translate('views.equipment.goals.enableOverflow')}
                </button>
            </div>
        `;
    }

    return `
        <div class="post-max-goal-bar" id="${contextId}-storage-goal-bar">
            <div class="segmented-control post-max-goal-group" role="group" aria-label="${translate('views.equipment.goals.goalBarLabel')}" data-i18n-aria-label="views.equipment.goals.goalBarLabel">
                ${pillsHtml}
            </div>
            ${overflowHintHtml}
        </div>
    `;
}

/**
 * Synchronizes the Post-Max Goal preset selector bar in-place within the container element.
 * By updating DOM classes and text nodes in-place rather than replacing container innerHTML,
 * the CSS sliding pill animation (.segmented-control::before) transitions smoothly between buttons.
 *
 * @param {HTMLElement} container - Target container element.
 * @param {import('../../core/types.js').ActiveStorageGoal | null | undefined} activeGoal - Active resolved goal.
 * @param {boolean} isEquipmentMaxed - Whether tracked equipment is maxed.
 * @param {boolean} allowOverflow - Whether storage overflow is enabled.
 * @param {string} [contextId='eq'] - Context prefix ('eq' or 'home').
 * @param {Record<string, import('../../core/types.js').HeroItem>} [heroesState=null] - Optional heroes state.
 */
export function syncPostMaxGoalBanner(container, activeGoal, isEquipmentMaxed, allowOverflow, contextId = 'eq', heroesState = null) {
    if (!container) return;

    if (!isEquipmentMaxed) {
        container.hidden = true;
        container.innerHTML = '';
        return;
    }

    container.hidden = false;
    ensureGoalContainerClickListener(container);

    const currentPreset = activeGoal?.preset === 'auto' ? 'maxStorage' : (activeGoal?.preset || 'maxStorage');
    const activeSoon = getActiveCustomComingSoon(heroesState || state.heroes);
    const targetSecondKey = activeSoon ? 'entities.equipment.comingSoon' : 'views.equipment.goals.nextEpic';

    const bar = container.querySelector('.post-max-goal-bar');
    const group = bar?.querySelector('.segmented-control.post-max-goal-group');

    if (!bar || !group) {
        container.innerHTML = renderPostMaxGoalBannerHtml(activeGoal, isEquipmentMaxed, allowOverflow, contextId, heroesState);
        return;
    }

    group.setAttribute('aria-label', translate('views.equipment.goals.goalBarLabel'));
    group.setAttribute('data-i18n-aria-label', 'views.equipment.goals.goalBarLabel');

    // Update active states and accessibility attributes on existing buttons in place
    const presetsMap = {
        maxStorage: 'views.equipment.goals.maxStorage',
        nextEpic: targetSecondKey,
        none: 'views.equipment.goals.none'
    };
    const buttons = group.querySelectorAll('.segmented-btn[data-goal-preset]');
    buttons.forEach(btn => {
        const presetId = btn.getAttribute('data-goal-preset');
        const isMatch = presetId === currentPreset;
        btn.classList.toggle('is-active', isMatch);
        btn.setAttribute('aria-selected', String(isMatch));

        const labelKey = presetsMap[presetId];
        if (labelKey) {
            const span = btn.querySelector('span');
            if (span) {
                span.setAttribute('data-i18n', labelKey);
                const label = translate(labelKey);
                if (span.textContent !== label) {
                    span.textContent = label;
                }
            }
        }
    });

    // Synchronize overflow warning in place
    const showOverflowWarning = Boolean(activeGoal?.requiresOverflow && !allowOverflow);
    const warningEl = bar.querySelector('.post-max-goal-overflow-warning');

    if (showOverflowWarning) {
        if (!warningEl) {
            const warningWrapper = document.createElement('div');
            warningWrapper.className = 'post-max-goal-overflow-warning';
            warningWrapper.innerHTML = `
                <clashcalc-assets-svg name="warning"></clashcalc-assets-svg>
                <span data-i18n="views.equipment.goals.requiresOverflowHint">${translate('views.equipment.goals.requiresOverflowHint')}</span>
                <button type="button" class="btn-enable-overflow-inline" data-action="enable-overflow" data-context="${contextId}" data-i18n="views.equipment.goals.enableOverflow">
                    ${translate('views.equipment.goals.enableOverflow')}
                </button>
            `;
            bar.appendChild(warningWrapper);
        } else {
            const warningSpan = warningEl.querySelector('span');
            if (warningSpan) {
                warningSpan.setAttribute('data-i18n', 'views.equipment.goals.requiresOverflowHint');
                warningSpan.textContent = translate('views.equipment.goals.requiresOverflowHint');
            }
            const warningBtn = warningEl.querySelector('.btn-enable-overflow-inline');
            if (warningBtn) {
                warningBtn.setAttribute('data-i18n', 'views.equipment.goals.enableOverflow');
                warningBtn.textContent = translate('views.equipment.goals.enableOverflow');
            }
        }
    } else if (warningEl) {
        warningEl.remove();
    }
}
