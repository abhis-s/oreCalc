import { heroData } from '../../data/heroData.js';
import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { registerInputPopover } from '../../utils/inputPopoverProvider.js';
import { addValidation } from '../../utils/inputValidator.js';
import { cleanupUpgradePlan, reindexGlobalPriority } from '../../utils/plannerUtils.js';

import { createHeroCard } from '../common/heroDisplayFactory.js';
import { dom } from '../../dom/domElements.js';
import { initializeEquipmentDetailsModal, openEquipmentDetailsModal } from './equipmentDetailsModalInputs.js';
import { refreshLayout } from '../../ui/cardLayoutManager.js';

const temporarilyVisibleMaxed = new Set();
const activeTimeouts = new Map();

/**
 * Marks an equipment item as manually maxed to preserve visibility for a 5-second grace period.
 *
 * @param {string} heroName
 * @param {string} equipName
 */
function markEquipmentManuallyMaxed(heroName, equipName) {
    const key = `${heroName}|${equipName}`;
    temporarilyVisibleMaxed.add(key);

    if (activeTimeouts.has(key)) {
        clearTimeout(activeTimeouts.get(key));
    }

    const timeoutId = setTimeout(() => {
        temporarilyVisibleMaxed.delete(key);
        activeTimeouts.delete(key);
        handleStateUpdate(() => {});
    }, 5000);

    activeTimeouts.set(key, timeoutId);
}

/**
 * Checks whether an equipment item is temporarily visible within the maxed grace period.
 *
 * @param {string} heroName
 * @param {string} equipName
 * @returns {boolean}
 */
export function isEquipmentTemporarilyVisible(heroName, equipName) {
    return temporarilyVisibleMaxed.has(`${heroName}|${equipName}`);
}

/**
 * Clears the temporary visibility state for an equipment item.
 *
 * @param {string} heroName
 * @param {string} equipName
 */
export function clearEquipmentTemporarilyVisible(heroName, equipName) {
    const key = `${heroName}|${equipName}`;
    temporarilyVisibleMaxed.delete(key);
    if (activeTimeouts.has(key)) {
        clearTimeout(activeTimeouts.get(key));
        activeTimeouts.delete(key);
    }
}

/**
 * Initializes Hero Cards into DOM and attaches input popovers, validation, and action events.
 *
 * @param {Record<string, any>} heroesState
 * @param {Object} [uiSettings]
 * @param {Object} [plannerMaxLevels]
 */
export function initializeHeroCards(heroesState, uiSettings, plannerMaxLevels) {
    initializeEquipmentDetailsModal();

    const container = dom.equipment.heroesContainer;
    if (!container) return;

    container.innerHTML = '';
    let heroKeys = Object.keys(heroData);
    if (uiSettings?.heroOrder) {
        const savedOrder = uiSettings.heroOrder;
        heroKeys.sort((a, b) => {
            const nameA = heroData[a]?.name || a;
            const nameB = heroData[b]?.name || b;
            const idxA = savedOrder.indexOf(nameA);
            const idxB = savedOrder.indexOf(nameB);
            if (idxA === -1 && idxB === -1) return 0;
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
        });
    }

    for (const heroKey of heroKeys) {
        const hero = heroData[heroKey];
        const heroDisplayName = hero?.name || heroData[heroKey]?.name || heroKey;
        const heroState = heroesState[heroDisplayName] || heroesState[heroKey] || { equipment: {} };

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

    // Refresh dynamic layout ordering & drag handles
    refreshLayout('equipment-left');

    container.querySelectorAll('input[type="number"]').forEach(input => {
        addValidation(input, { inputName: translate('validation.level') });

        const customButtons = [
            {
                hotkey: 'd',
                label: () => {
                    const heroCard = /** @type {HTMLElement | null} */ (input.closest('.hero-card'));
                    const heroName = heroCard?.dataset.heroName;
                    const equipItem = /** @type {HTMLElement | null} */ (input.closest('.equipment-item'));
                    const equipName = equipItem?.dataset.equipName;
                    const isChecked = (heroName && equipName) ? state.heroes[heroName]?.equipment?.[equipName]?.checked !== false : true;
                    return isChecked ? translate('views.equipment.disable') : translate('views.equipment.enable');
                },
                clickToFill: false,
                className: () => {
                    const heroCard = /** @type {HTMLElement | null} */ (input.closest('.hero-card'));
                    const heroName = heroCard?.dataset.heroName;
                    const equipItem = /** @type {HTMLElement | null} */ (input.closest('.equipment-item'));
                    const equipName = equipItem?.dataset.equipName;
                    const isChecked = (heroName && equipName) ? state.heroes[heroName]?.equipment?.[equipName]?.checked !== false : true;
                    return isChecked ? 'popover-btn-disable' : 'popover-btn-enable';
                },
                action: (inputElement) => {
                    const heroCard = /** @type {HTMLElement | null} */ (inputElement.closest('.hero-card'));
                    const heroName = heroCard?.dataset.heroName;
                    const equipItem = /** @type {HTMLElement | null} */ (inputElement.closest('.equipment-item'));
                    const equipName = equipItem?.dataset.equipName;
                    if (!heroName || !equipName) return;

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
            title: () => translate('validation.level'),
            showRange: true,
            showRecommended: () => {
                const equipItem = /** @type {HTMLElement | null} */ (input.closest('.equipment-item'));
                const equipName = equipItem?.dataset.equipName;
                return Boolean(equipName && state.playerProfile?.ownedEquipment?.[equipName] !== undefined);
            },
            recommendedLabel: () => translate('actions.reset'),
            recommended: () => {
                const equipItem = /** @type {HTMLElement | null} */ (input.closest('.equipment-item'));
                const equipName = equipItem?.dataset.equipName;
                return equipName ? state.playerProfile?.ownedEquipment?.[equipName] : undefined;
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
        const target = /** @type {HTMLElement | null} */ (event.target);
        if (!target) return;

        const equipClickable = target.closest('.equipment-image, .equipment-name label');
        if (equipClickable) {
            const equipItem = /** @type {HTMLElement | null} */ (equipClickable.closest('.equipment-item'));
            const heroCard = /** @type {HTMLElement | null} */ (equipClickable.closest('.hero-card'));
            const equipName = equipItem ? equipItem.dataset.equipName : null;
            const heroName = heroCard ? heroCard.dataset.heroName : null;

            if (equipName) {
                const currentLevel = (heroName && state.heroes[heroName]?.equipment?.[equipName]?.level) || 1;
                openEquipmentDetailsModal(equipName, currentLevel);
            }
            return;
        }

        const actionElement = /** @type {HTMLElement | null} */ (target.closest('[data-action]'));
        if (!actionElement) return;

        const action = actionElement.dataset.action;
        const heroCard = /** @type {HTMLElement | null} */ (actionElement.closest('.hero-card'));
        if (!heroCard) return;
        const heroName = heroCard.dataset.heroName;
        if (!heroName) return;

        switch(action) {
            case 'increment-level': {
                const equipItem = /** @type {HTMLElement | null} */ (actionElement.closest('.equipment-item'));
                const equipName = equipItem ? equipItem.dataset.equipName : null;
                if (!equipName) break;
                if (!state.heroes[heroName]) state.heroes[heroName] = { equipment: {} };
                if (!state.heroes[heroName].equipment[equipName]) state.heroes[heroName].equipment[equipName] = {};

                const currentLevel = state.heroes[heroName].equipment[equipName].level || 1;
                const maxLevel = parseInt(actionElement.dataset.maxLevel || '18', 10);
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

    container.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            const target = /** @type {HTMLElement | null} */ (event.target);
            if (!target) return;

            const equipClickable = target.closest('.equipment-image, .equipment-name label');
            if (equipClickable) {
                event.preventDefault();
                const equipItem = /** @type {HTMLElement | null} */ (equipClickable.closest('.equipment-item'));
                const heroCard = /** @type {HTMLElement | null} */ (equipClickable.closest('.hero-card'));
                const equipName = equipItem ? equipItem.dataset.equipName : null;
                const heroName = heroCard ? heroCard.dataset.heroName : null;

                if (equipName) {
                    const currentLevel = (heroName && state.heroes[heroName]?.equipment?.[equipName]?.level) || 1;
                    openEquipmentDetailsModal(equipName, currentLevel);
                }
            }
        }
    });

    container.addEventListener('change', (event) => {
        const input = /** @type {HTMLInputElement | null} */ (event.target);
        if (!input || input.type !== 'number') return;

        const heroCard = /** @type {HTMLElement | null} */ (input.closest('.hero-card'));
        if (!heroCard) return;
        const heroName = heroCard.dataset.heroName;

        const equipItem = /** @type {HTMLElement | null} */ (input.closest('.equipment-item'));
        const equipName = equipItem ? equipItem.dataset.equipName : null;
        if (!heroName || !equipName) return;

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
