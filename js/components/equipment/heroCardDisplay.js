import { dom } from '../../dom/domElements.js';
import { heroData } from '../../data/heroData.js';

export function renderHeroCards(heroesState, uiSettings, plannerState) {
    const container = dom.equipment.heroesContainer;
    if (!container) return;

    const isLevelInputEnabled = uiSettings.enableLevelInput === true;

    for (const heroName in heroesState) {
        const heroState = heroesState[heroName];
        const heroCard = container.querySelector(`[data-hero-name="${heroName}"]`);
        if (!heroCard) continue;

        heroCard.classList.toggle('hero-disabled', !heroState.enabled);

        const heroKey = Object.keys(heroData).find(key => heroData[key].name === heroName);
        if (!heroKey) continue;
        const currentHeroData = heroData[heroKey];

        for (const equipName in heroState.equipment) {
            const equipState = heroState.equipment[equipName];
            const equipItem = heroCard.querySelector(`[data-equip-name="${equipName}"]`);
            if (!equipItem) continue;

            const upgradeBtnDisplay = equipItem.querySelector('[data-mode="input-disabled"]');
            const inputContainerDisplay = equipItem.querySelector('[data-mode="input-enabled"]');
            const levelDisplay = equipItem.querySelector('.level-display');
            const levelInput = equipItem.querySelector('input[type="number"]');
            const upgradeButton = equipItem.querySelector('.upgrade-btn');
            const label = equipItem.querySelector('label');
            const equipmentImage = equipItem.querySelector('.equipment-image');

            equipmentImage.classList.toggle('grayscale', !equipState.checked);

            if (levelDisplay) levelDisplay.textContent = equipState.level;
            if (levelInput) levelInput.value = equipState.level;

            const maxLevel = parseInt(levelInput?.max || upgradeButton?.dataset.maxLevel, 10);
            const isMaxLevel = equipState.level >= maxLevel;

            label.classList.toggle('gold-glow', isMaxLevel);
            equipmentImage.classList.toggle('gold-glow', isMaxLevel);

            if (upgradeButton) upgradeButton.style.visibility = isMaxLevel ? 'hidden' : 'visible';

            let isOverLeveled = false;
            const equipmentData = currentHeroData.equipment.find(e => e.name === equipName);
            if (equipmentData && plannerState) {
                const customMaxLevel = equipmentData.type === 'common'
                    ? plannerState.customMaxLevel.common
                    : plannerState.customMaxLevel.epic;
                isOverLeveled = equipState.level >= customMaxLevel && equipState.level < maxLevel;
            }

            label.classList.toggle('over-leveled-glow', isOverLeveled);
            equipmentImage.classList.toggle('over-leveled-glow', isOverLeveled);

            if (upgradeBtnDisplay) upgradeBtnDisplay.style.display = isLevelInputEnabled ? 'none' : 'flex';
            if (inputContainerDisplay) inputContainerDisplay.style.display = isLevelInputEnabled ? 'block' : 'none';
        }
    }
}