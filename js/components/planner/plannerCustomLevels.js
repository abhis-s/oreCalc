import { EQUIPMENT_MAX_LEVELS, getEquipmentMaxLevel, getTownHallCaps } from '../../data/equipmentCommonData.js';
import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { registerInputPopover } from '../../utils/inputPopoverProvider.js';
import { addValidation } from '../../utils/inputValidator.js';

import { dom } from '../../dom/domElements.js';

function getTownHallMaxLevel(type, townHallLevel) {
    const th = Number(townHallLevel);
    if (isNaN(th) || th <= 0) {
        return getEquipmentMaxLevel(type);
    }
    const capInfo = getTownHallCaps(th);
    const r = type ? type.toLowerCase() : 'common';
    return capInfo[`${r}Max`] ?? getEquipmentMaxLevel(r);
}

/**
 * Initializes rarity custom max level input controls, validation bounds, and popover providers.
 */
export function initializePlannerCustomLevels() {
    const container = document.querySelector('.max-level-card-header');
    if (!container) return;

    container.innerHTML = `
        <h3 class="custom-max-level-title">
            <span data-i18n="views.planner.customMaxLevel">${translate('views.planner.customMaxLevel')}</span>
            <button class="info-btn" data-info="views.planner.customMaxLevelHelp" aria-label="Show Information" data-i18n-aria-label="actions.showInfo">
                <clashcalc-assets-svg name="info" class="info-icon" height="16" width="16"></clashcalc-assets-svg>
            </button>
        </h3>`;

    const settingsContainer = document.createElement('div');
    settingsContainer.className = 'level-settings-container';

    const levels = Object.keys(EQUIPMENT_MAX_LEVELS).map(key => ({
        id: `planner-${key}-max-level`,
        key,
        i18n: `views.equipment.${key}`,
        max: getEquipmentMaxLevel(key)
    }));

    levels.forEach(level => {
        const group = document.createElement('div');
        group.className = 'input-group-flex';

        const label = document.createElement('label');
        label.htmlFor = level.id;
        label.className = `${level.key}-equip`;
        const labelText = document.createElement('span');
        labelText.dataset.i18n = level.i18n;
        labelText.textContent = translate(level.i18n);
        label.append(labelText, ':');
        group.appendChild(label);

        const wrapper = document.createElement('div');
        wrapper.className = 'popover-wrapper';

        const input = document.createElement('input');
        input.type = 'number';
        input.id = level.id;
        input.name = level.id;
        input.className = 'updatable';
        input.value = state.planner.customMaxLevel?.[level.key] || level.max;
        input.min = '1';
        input.max = String(level.max);
        input.maxLength = 2;

        wrapper.appendChild(input);
        group.appendChild(wrapper);

        addValidation(input, { inputName: `${level.key}MaxLevel` });
        input.addEventListener('validated-input', (event) => {
            const customEv = /** @type {CustomEvent} */ (event);
            handleStateUpdate(() => {
                state.planner.customMaxLevel[level.key] = customEv.detail.value;
            });
        });

        // Register custom input popover
        registerInputPopover(input, {
            title: () => translate(level.i18n),
            min: 1,
            max: level.max,
            showRange: true,
            showRecommended: true,
            recommended: () => {
                const playerTH = state.playerProfile?.townHallLevel;
                return getTownHallMaxLevel(level.key, playerTH);
            },
            recommendedLabel: () => {
                return translate('validation.recommended');
            },
            clickToFill: {
                max: true,
                recommended: true
            }
        });

        settingsContainer.appendChild(group);

        dom.planner.customMaxLevel[level.key] = input;
    });

    container.appendChild(settingsContainer);
}

/**
 * Synchronizes custom max level input element values with the active planner state.
 * @param {import('../../core/types.js').PlannerState} plannerState - Planner state object.
 */
export function renderPlannerCustomLevels(plannerState) {
    if (!plannerState) {
        console.error('Planner state is not available. Cannot update DOM.');
        return;
    }
    for (const rarity of Object.keys(EQUIPMENT_MAX_LEVELS)) {
        const input = dom.planner?.customMaxLevel?.[rarity];
        if (input) {
            input.value = plannerState.customMaxLevel?.[rarity] || getEquipmentMaxLevel(rarity);
        }
    }
}
