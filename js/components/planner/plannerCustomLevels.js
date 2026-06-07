import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../core/stateManager.js';
import { state } from '../../core/state.js';

import { addValidation } from '../../utils/inputValidator.js';
import { getMaxTownHall } from '../../utils/dateUtils.js';
import { registerInputPopover } from '../../utils/inputPopoverProvider.js';
import { translate } from '../../i18n/translator.js';

function getTownHallMaxLevel(type, townHallLevel) {
    const maxTH = getMaxTownHall();
    const th = parseInt(townHallLevel, 10);
    if (isNaN(th) || th <= 0) {
        return type === 'common' ? 18 : 27;
    }
    
    // Below 9: 9common / 12epic
    if (th <= 9) {
        return type === 'common' ? 9 : 12;
    }
    
    // Dynamic rules based on maxTH
    if (th >= maxTH) {
        return type === 'common' ? 18 : 27;
    }
    if (th === maxTH - 1) {
        return type === 'common' ? 18 : 24;
    }
    if (th === maxTH - 2) {
        return type === 'common' ? 15 : 21;
    }
    
    // Intermediate Town Halls
    if (type === 'common') {
        if (th <= 11) return 12;
        return 15;
    } else { // epic
        if (th <= 11) return 15;
        if (th <= 13) return 18;
        return 21;
    }
}

export function initializePlannerCustomLevels() {
    const container = document.querySelector('.max-level-card-header');
    if (!container) return;

    container.innerHTML = `<h3 data-i18n="planner.customMaxLevel">${translate('planner.customMaxLevel')}</h3>`;

    const settingsContainer = document.createElement('div');
    settingsContainer.className = 'level-settings-container';

    const levels = [
        { id: 'planner-common-max-level', key: 'common', i18n: 'planner.common', max: 18 },
        { id: 'planner-epic-max-level', key: 'epic', i18n: 'planner.epic', max: 27 }
    ];

    levels.forEach(level => {
        const group = document.createElement('div');
        group.className = 'input-group-flex indented';

        const label = document.createElement('label');
        label.htmlFor = level.id;
        label.dataset.i18n = level.i18n;
        label.textContent = `${translate(level.i18n)}:`;
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
        input.max = level.max;
        input.maxLength = 2;

        wrapper.appendChild(input);
        group.appendChild(wrapper);

        addValidation(input, { inputName: `${level.key}MaxLevel` });
        input.addEventListener('validated-input', (event) => {
            handleStateUpdate(() => {
                state.planner.customMaxLevel[level.key] = event.detail.value;
            });
        });

        // Register custom input popover
        registerInputPopover(input, {
            title: translate(level.i18n),
            min: 1,
            max: level.max,
            showRange: true,
            showRecommended: true,
            recommended: () => {
                const playerTH = state.playerProfile?.townHallLevel;
                return getTownHallMaxLevel(level.key, playerTH);
            },
            recommendedLabel: () => {
                return translate('planner.recommended') || 'Recommended';
            },
            clickToFill: {
                max: true,
                recommended: true
            }
        });

        settingsContainer.appendChild(group);
        
        // Update DOM reference
        dom.planner.customMaxLevel[level.key] = input;
    });

    container.appendChild(settingsContainer);
}

export function renderPlannerCustomLevels(plannerState) {
    if (!plannerState) {
        console.error('Planner state is not available. Cannot update DOM.');
        return;
    }
    const commonMaxLevelInput = dom.planner?.customMaxLevel?.common;
    const epicMaxLevelInput = dom.planner?.customMaxLevel?.epic;

    if (commonMaxLevelInput) {
        commonMaxLevelInput.value = plannerState.customMaxLevel?.common || 18;
    }
    if (epicMaxLevelInput) {
        epicMaxLevelInput.value = plannerState.customMaxLevel?.epic || 27;
    }
}