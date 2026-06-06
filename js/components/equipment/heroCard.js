import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';

import { addValidation } from '../../utils/inputValidator.js';
import { cleanupUpgradePlan, reindexGlobalPriority } from '../../utils/plannerUtils.js';
import { heroData } from '../../data/appData.js';
import { registerInputPopover } from '../../utils/inputPopoverProvider.js';
import { translate } from '../../i18n/translator.js';

import { markEquipmentManuallyMaxed } from './heroCardDisplay.js';

import { createHeroCard } from '../common/heroDisplayFactory.js';

export function initializeHeroCards(heroesState, uiSettings, plannerMaxLevels) {
    const container = dom.equipment.heroesContainer;
    if (!container) return;

    container.innerHTML = '';
    for (const heroKey in heroData) {
        const hero = heroData[heroKey];
        const heroState = heroesState[hero.name] || { equipment: {} };

        const card = createHeroCard({
            hero,
            heroState,
            heroKey,
            mode: 'interactive',
            plannerState: plannerMaxLevels,
            uiSettings
        });
        container.appendChild(card);
    }

    container.querySelectorAll('input[type="number"]').forEach(input => {
        addValidation(input, { inputName: translate('validation.level') });
        
        const customButtons = [
            {
                label: () => {
                    const heroCard = input.closest('.hero-card');
                    const heroName = heroCard?.dataset.heroName;
                    const equipItem = input.closest('.equipment-item');
                    const equipName = equipItem?.dataset.equipName;
                    const isChecked = state.heroes[heroName]?.equipment?.[equipName]?.checked !== false;
                    return isChecked ? translate('equipment.disable') || 'Disable' : translate('equipment.enable') || 'Enable';
                },
                clickToFill: false,
                className: () => {
                    const heroCard = input.closest('.hero-card');
                    const heroName = heroCard?.dataset.heroName;
                    const equipItem = input.closest('.equipment-item');
                    const equipName = equipItem?.dataset.equipName;
                    const isChecked = state.heroes[heroName]?.equipment?.[equipName]?.checked !== false;
                    return isChecked ? 'popover-btn-disable' : 'popover-btn-enable';
                },
                action: (inputElement) => {
                    const heroCard = inputElement.closest('.hero-card');
                    const heroName = heroCard?.dataset.heroName;
                    const equipItem = inputElement.closest('.equipment-item');
                    const equipName = equipItem?.dataset.equipName;
                    
                    handleStateUpdate(() => {
                        if (!state.heroes[heroName]) state.heroes[heroName] = { equipment: {} };
                        if (!state.heroes[heroName].equipment[equipName]) state.heroes[heroName].equipment[equipName] = {};
                        
                        const currentlyChecked = state.heroes[heroName].equipment[equipName].checked !== false;
                        state.heroes[heroName].equipment[equipName].checked = !currentlyChecked;
                    });
                }
            }
        ];

        registerInputPopover(input, {
            title: translate('validation.level'),
            showRange: true,
            showRecommended: () => {
                const equipItem = input.closest('.equipment-item');
                const equipName = equipItem?.dataset.equipName;
                return state.playerProfile?.ownedEquipment?.[equipName] !== undefined;
            },
            recommendedLabel: translate('actions.reset') || 'Reset',
            recommended: () => {
                const equipItem = input.closest('.equipment-item');
                const equipName = equipItem?.dataset.equipName;
                return state.playerProfile?.ownedEquipment?.[equipName];
            },
            customButtons: customButtons,
            clickToFill: {
                min: false,
                max: false,
                recommended: true
            }
        });
    });

    container.addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.action;
        const heroCard = actionElement.closest('.hero-card');
        if (!heroCard) return;
        const heroName = heroCard.dataset.heroName;

        switch(action) {
            case 'increment-level': {
                const equipItem = actionElement.closest('.equipment-item');
                const equipName = equipItem ? equipItem.dataset.equipName : null;
                if (!equipName) break;
                if (!state.heroes[heroName]) state.heroes[heroName] = { equipment: {} };
                if (!state.heroes[heroName].equipment[equipName]) state.heroes[heroName].equipment[equipName] = {};

                const currentLevel = state.heroes[heroName].equipment[equipName].level || 1;
                const maxLevel = parseInt(actionElement.dataset.maxLevel, 10);
                if (currentLevel < maxLevel) {
                    const nextLevel = currentLevel + 1;
                    handleStateUpdate(() => { 
                        state.heroes[heroName].equipment[equipName].level = nextLevel; 
                        cleanupUpgradePlan(state.heroes[heroName].equipment[equipName]);
                        reindexGlobalPriority();
                    });
                    if (nextLevel >= maxLevel) {
                        markEquipmentManuallyMaxed(heroName, equipName);
                    }
                }
                break;
            }
        }
    });

    container.addEventListener('change', (event) => {
        const input = event.target;
        if (input.type !== 'number') return;
        
        const heroCard = input.closest('.hero-card');
        if (!heroCard) return;
        const heroName = heroCard.dataset.heroName;
        
        const equipItem = input.closest('.equipment-item');
        const equipName = equipItem ? equipItem.dataset.equipName : null;
        if (!equipName) return;

        const maxLevel = parseInt(input.max, 10);
        let value = parseInt(input.value, 10);
        if (isNaN(value)) value = 1;
        value = Math.max(1, Math.min(value, maxLevel));

        handleStateUpdate(() => {
            if (!state.heroes[heroName]) state.heroes[heroName] = { equipment: {} };
            if (!state.heroes[heroName].equipment[equipName]) state.heroes[heroName].equipment[equipName] = {};

            state.heroes[heroName].equipment[equipName].level = value;
            cleanupUpgradePlan(state.heroes[heroName].equipment[equipName]);
            reindexGlobalPriority();
        });

        if (value >= maxLevel) {
            markEquipmentManuallyMaxed(heroName, equipName);
        }
    });
}