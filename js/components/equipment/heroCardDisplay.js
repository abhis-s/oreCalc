import { getEquipmentMaxLevel } from '../../data/equipmentCommonData.js';
import { heroData } from '../../data/heroData.js';
import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { getDefaultEquipmentUnlockLevel, shouldApplyHeroJourneyAutoLevel } from '../../domain/income/heroJourneyIncome.js';
import { toCamelCase } from '../../utils/stringUtils.js';

import { dom } from '../../dom/domElements.js';

const temporarilyVisibleMaxed = new Set();
const activeTimeouts = new Map();

/**
 * Marks an equipment item as manually maxed to preserve visibility for a 5-second grace period.
 *
 * @param {string} heroName
 * @param {string} equipName
 */
export function markEquipmentManuallyMaxed(heroName, equipName) {
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
 * Renders Hero Cards display updates, hide maxed / locked filters, level badges, and glow classes.
 *
 * @param {Record<string, any>} heroesState
 * @param {Object} uiSettings
 * @param {Object} [plannerState]
 */
export function renderHeroCards(heroesState, uiSettings, plannerState) {
    const container = dom.equipment.heroesContainer;
    if (!container) return;

    const isLevelInputEnabled = uiSettings.enableLevelInput === true;

    let isHideMaxedEnabled = uiSettings.hideMaxedEquipment === true;
    let isHideLockedEnabled = uiSettings.hideLockedEquipment === true;

    let hasMaxedEquipment = false;
    for (const heroKey in heroData) {
        const currentHeroData = heroData[heroKey];
        const heroName = currentHeroData.name;
        const heroState = heroesState[heroName] || { equipment: {} };
        for (const equip of currentHeroData.equipment) {
            const equipState = heroState.equipment?.[equip.name] || {};
            const currentLevel = equipState.level || 1;
            const maxLevel = getEquipmentMaxLevel(equip.type);
            if (currentLevel >= maxLevel) {
                hasMaxedEquipment = true;
                break;
            }
        }
        if (hasMaxedEquipment) break;
    }

    const hideMaxedToggle = dom.equipment?.hideMaxedToggle;
    if (hideMaxedToggle) {
        const containerCardOption = /** @type {HTMLElement | null} */ (hideMaxedToggle.closest('.input-group-flex'));
        if (containerCardOption) {
            if (hasMaxedEquipment) {
                containerCardOption.style.display = '';
            } else {
                containerCardOption.style.display = 'none';
                isHideMaxedEnabled = false;
            }
        }
    }

    const hideLockedToggle = dom.equipment?.hideLockedToggle;
    if (hideLockedToggle) {
        let hasLockedEquipment = false;
        if (state.playerProfile && state.playerProfile.ownedEquipment) {
            const owned = state.playerProfile.ownedEquipment;
            for (const heroKey in heroData) {
                for (const equip of heroData[heroKey].equipment) {
                    const isOwned = Array.isArray(owned) ? owned.includes(equip.name) : (equip.name in owned);
                    if (!isOwned) {
                        hasLockedEquipment = true;
                        break;
                    }
                }
                if (hasLockedEquipment) break;
            }
        }

        const containerCardOption = /** @type {HTMLElement | null} */ (hideLockedToggle.closest('.input-group-flex'));
        if (containerCardOption) {
            if (state.playerProfile && hasLockedEquipment) {
                containerCardOption.style.display = '';
            } else {
                containerCardOption.style.display = 'none';
                isHideLockedEnabled = false;
            }
        }
    }

    let hiddenCount = 0;
    let lockedHiddenCount = 0;

    for (const heroKey in heroData) {
        const currentHeroData = heroData[heroKey];
        const heroName = currentHeroData.name;
        const heroState = heroesState[heroName] || { equipment: {} };
        const heroCard = container.querySelector(`[data-hero-name="${heroName}"]`);
        if (!heroCard) continue;

        heroCard.classList.toggle('hero-disabled', heroState.enabled === false);

        const heroTitle = heroCard.querySelector('.hero-title h3');
        if (heroTitle) {
            heroTitle.textContent = translate(`entities.heroes.${heroKey}`);
        }
        let heroAllHidden = true;

        for (const equip of currentHeroData.equipment) {
            const equipName = equip.name;
            const equipState = heroState.equipment?.[equipName] || {};
            const equipItem = /** @type {HTMLElement | null} */ (heroCard.querySelector(`[data-equip-name="${equipName}"]`));
            if (!equipItem) continue;

            const equipLabel = equipItem.querySelector('label');
            if (equipLabel) {
                equipLabel.textContent = translate(`entities.equipment.${toCamelCase(equipName)}`);
            }

            const upgradeBtnDisplay = /** @type {HTMLElement | null} */ (equipItem.querySelector('[data-mode="input-disabled"]'));
            const inputContainerDisplay = /** @type {HTMLElement | null} */ (equipItem.querySelector('[data-mode="input-enabled"]'));
            const levelDisplay = equipItem.querySelector('.level-display');
            const levelInput = /** @type {HTMLInputElement | null} */ (equipItem.querySelector('input[type="number"]'));
            const upgradeButton = /** @type {HTMLElement | null} */ (equipItem.querySelector('.upgrade-btn'));
            const label = equipItem.querySelector('label');
            const equipmentImage = equipItem.querySelector('.equipment-image');

            if (equipmentImage) {
                equipmentImage.classList.toggle('grayscale', equipState.checked === false);
            }

            let currentLevel = equipState.level;
            if (shouldApplyHeroJourneyAutoLevel(heroName, equipName, state)) {
                currentLevel = getDefaultEquipmentUnlockLevel(heroName, equipName);
            } else if (!currentLevel) {
                currentLevel = 1;
            }

            if (levelDisplay && levelDisplay.textContent !== String(currentLevel)) {
                levelDisplay.textContent = String(currentLevel);
            }
            if (levelInput && levelInput.value !== String(currentLevel)) {
                levelInput.value = String(currentLevel);
            }

            const maxLevel = parseInt(levelInput?.max || upgradeButton?.dataset.maxLevel || '18', 10);
            const isMaxLevel = currentLevel >= maxLevel;

            const key = `${heroName}|${equipName}`;
            // Clean up temporary visibility if no longer max level
            if (!isMaxLevel && temporarilyVisibleMaxed.has(key)) {
                temporarilyVisibleMaxed.delete(key);
                if (activeTimeouts.has(key)) {
                    clearTimeout(activeTimeouts.get(key));
                    activeTimeouts.delete(key);
                }
            }

            if (label) label.classList.toggle('gold-glow', isMaxLevel);
            if (equipmentImage) equipmentImage.classList.toggle('gold-glow', isMaxLevel);

            if (upgradeButton) {
                upgradeButton.style.visibility = isMaxLevel ? 'hidden' : 'visible';
                const equipKey = toCamelCase(equipName);
                upgradeButton.setAttribute('aria-label', translate('actions.upgradeToLevel', {
                    name: translate('entities.equipment.' + equipKey) || equipName,
                    level: currentLevel + 1
                }));
            }

            let isOverLeveled = false;
            const equipmentData = currentHeroData.equipment.find(e => e.name === equipName);
            if (equipmentData && plannerState) {
                const customCommonMax = plannerState.customMaxLevel?.common ?? getEquipmentMaxLevel('common');
                const customEpicMax = plannerState.customMaxLevel?.epic ?? getEquipmentMaxLevel('epic');
                const customMaxLevel = equipmentData.type === 'common' ? customCommonMax : customEpicMax;
                isOverLeveled = currentLevel >= customMaxLevel && currentLevel < maxLevel;
            }

            if (label) label.classList.toggle('over-leveled-glow', isOverLeveled);
            if (equipmentImage) equipmentImage.classList.toggle('over-leveled-glow', isOverLeveled);

            if (upgradeBtnDisplay) upgradeBtnDisplay.style.display = isLevelInputEnabled ? 'none' : 'flex';
            if (inputContainerDisplay) inputContainerDisplay.style.display = isLevelInputEnabled ? 'block' : 'none';

            let isLocked = false;
            if (state.playerProfile && state.playerProfile.ownedEquipment) {
                const owned = state.playerProfile.ownedEquipment;
                isLocked = Array.isArray(owned) ? !owned.includes(equipName) : !(equipName in owned);
            }

            let shouldHide = false;
            if (isHideMaxedEnabled && isMaxLevel) {
                // Do not hide if it was manually maxed and is still within the 5-second grace period
                if (!temporarilyVisibleMaxed.has(key)) {
                    shouldHide = true;
                    hiddenCount++;
                }
            }
            if (isHideLockedEnabled && isLocked) {
                shouldHide = true;
                lockedHiddenCount++;
            }

            equipItem.classList.toggle('eq-hidden', shouldHide);
            if (!shouldHide) {
                heroAllHidden = false;
            }
        }

        heroCard.classList.toggle('hero-hidden', heroAllHidden && (isHideMaxedEnabled || isHideLockedEnabled));
    }

    const hiddenCountLabel = dom.equipment?.hiddenCountLabel;
    if (hiddenCountLabel) {
        if (isHideMaxedEnabled) {
            hiddenCountLabel.textContent = translate('views.planner.equipmentHiddenCount', { count: hiddenCount });
            hiddenCountLabel.style.display = 'block';
        } else {
            hiddenCountLabel.style.display = 'none';
        }
    }

    const lockedHiddenCountLabel = dom.equipment?.lockedHiddenCountLabel;
    if (lockedHiddenCountLabel) {
        if (isHideLockedEnabled) {
            lockedHiddenCountLabel.textContent = translate('views.planner.lockedEquipmentHiddenCount', { count: lockedHiddenCount });
            lockedHiddenCountLabel.style.display = 'block';
        } else {
            lockedHiddenCountLabel.style.display = 'none';
        }
    }
}
