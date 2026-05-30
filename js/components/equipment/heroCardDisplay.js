import { dom } from '../../dom/domElements.js';
import { heroData } from '../../data/heroData.js';
import { translate } from '../../i18n/translator.js';
import { toCamelCase } from '../../utils/stringUtils.js';
import { state } from '../../core/state.js';

const temporarilyVisibleMaxed = new Set();
const activeTimeouts = new Map();

export function markEquipmentManuallyMaxed(heroName, equipName) {
    const key = `${heroName}|${equipName}`;
    temporarilyVisibleMaxed.add(key);

    if (activeTimeouts.has(key)) {
        clearTimeout(activeTimeouts.get(key));
    }

    const timeoutId = setTimeout(() => {
        temporarilyVisibleMaxed.delete(key);
        activeTimeouts.delete(key);
        
        // Asynchronously re-render the app using state
        import('../../core/renderer.js').then(module => {
            import('../../core/state.js').then(stateModule => {
                module.renderApp(stateModule.state);
            });
        });
    }, 5000);

    activeTimeouts.set(key, timeoutId);
}

export function renderHeroCards(heroesState, uiSettings, plannerState) {
    const container = dom.equipment.heroesContainer;
    if (!container) return;

    const isLevelInputEnabled = uiSettings.enableLevelInput === true;
    
    let isHideMaxedEnabled = uiSettings.hideMaxedEquipment === true;
    let isHideLockedEnabled = uiSettings.hideLockedEquipment === true;

    // Check if there is any maxed equipment
    let hasMaxedEquipment = false;
    for (const heroKey in heroData) {
        const currentHeroData = heroData[heroKey];
        const heroName = currentHeroData.name;
        const heroState = heroesState[heroName] || { equipment: {} };
        for (const equip of currentHeroData.equipment) {
            const equipState = heroState.equipment?.[equip.name] || {};
            const currentLevel = equipState.level || 1;
            const maxLevel = equip.type === 'common' ? 18 : 27;
            if (currentLevel >= maxLevel) {
                hasMaxedEquipment = true;
                break;
            }
        }
        if (hasMaxedEquipment) break;
    }

    const hideMaxedToggle = dom.equipment?.hideMaxedToggle;
    if (hideMaxedToggle) {
        const containerCardOption = hideMaxedToggle.closest('.input-group-flex');
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
        const activeTag = state.savedPlayerTags?.[0] || 'DEFAULT0';
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

        const containerCardOption = hideLockedToggle.closest('.input-group-flex');
        if (containerCardOption) {
            if (activeTag !== 'DEFAULT0' && hasLockedEquipment) {
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

        // Update Hero Title (for language changes)
        const heroTitle = heroCard.querySelector('.hero-title h3');
        if (heroTitle) {
            heroTitle.textContent = translate(`heroes.${heroKey}`);
        }
        let heroAllHidden = true;

        for (const equip of currentHeroData.equipment) {
            const equipName = equip.name;
            const equipState = heroState.equipment?.[equipName] || {};
            const equipItem = heroCard.querySelector(`[data-equip-name="${equipName}"]`);
            if (!equipItem) continue;

            // Update Equipment Name (for language changes)
            const equipLabel = equipItem.querySelector('label');
            if (equipLabel) {
                equipLabel.textContent = translate(`equipment.${toCamelCase(equipName)}`);
            }

            const upgradeBtnDisplay = equipItem.querySelector('[data-mode="input-disabled"]');
            const inputContainerDisplay = equipItem.querySelector('[data-mode="input-enabled"]');
            const levelDisplay = equipItem.querySelector('.level-display');
            const levelInput = equipItem.querySelector('input[type="number"]');
            const upgradeButton = equipItem.querySelector('.upgrade-btn');
            const label = equipItem.querySelector('label');
            const equipmentImage = equipItem.querySelector('.equipment-image');

            equipmentImage.classList.toggle('grayscale', equipState.checked === false);

            const currentLevel = equipState.level || 1;
            if (levelDisplay) levelDisplay.textContent = currentLevel;
            if (levelInput) levelInput.value = currentLevel;

            const maxLevel = parseInt(levelInput?.max || upgradeButton?.dataset.maxLevel, 10);
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

            label.classList.toggle('gold-glow', isMaxLevel);
            equipmentImage.classList.toggle('gold-glow', isMaxLevel);

            if (upgradeButton) upgradeButton.style.visibility = isMaxLevel ? 'hidden' : 'visible';

            let isOverLeveled = false;
            const equipmentData = currentHeroData.equipment.find(e => e.name === equipName);
            if (equipmentData && plannerState) {
                const customCommonMax = plannerState.customMaxLevel?.common ?? 18;
                const customEpicMax = plannerState.customMaxLevel?.epic ?? 27;
                const customMaxLevel = equipmentData.type === 'common' ? customCommonMax : customEpicMax;
                isOverLeveled = currentLevel >= customMaxLevel && currentLevel < maxLevel;
            }

            label.classList.toggle('over-leveled-glow', isOverLeveled);
            equipmentImage.classList.toggle('over-leveled-glow', isOverLeveled);

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

            if (shouldHide) {
                equipItem.style.display = 'none';
            } else {
                equipItem.style.display = '';
                heroAllHidden = false;
            }
        }

        if (heroAllHidden && (isHideMaxedEnabled || isHideLockedEnabled)) {
            heroCard.style.display = 'none';
        } else {
            heroCard.style.display = '';
        }
    }

    const hiddenCountLabel = dom.equipment?.hiddenCountLabel;
    if (hiddenCountLabel) {
        if (isHideMaxedEnabled) {
            hiddenCountLabel.textContent = translate('planner.equipmentHiddenCount', { count: hiddenCount });
            hiddenCountLabel.style.display = 'block';
        } else {
            hiddenCountLabel.style.display = 'none';
        }
    }

    const lockedHiddenCountLabel = dom.equipment?.lockedHiddenCountLabel;
    if (lockedHiddenCountLabel) {
        if (isHideLockedEnabled) {
            lockedHiddenCountLabel.textContent = translate('planner.lockedEquipmentHiddenCount', { count: lockedHiddenCount });
            lockedHiddenCountLabel.style.display = 'block';
        } else {
            lockedHiddenCountLabel.style.display = 'none';
        }
    }
}