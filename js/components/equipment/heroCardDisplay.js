import { dom } from '../../dom/domElements.js';
import { heroData } from '../../data/heroData.js';

export function renderHeroCards(heroesState, uiSettings, plannerState) {
    const container = dom.equipment.heroesContainer;
    if (!container) return;

    const isTweakMode = uiSettings.mode === 'tweak';

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

            const easeElement = equipItem.querySelector('[data-mode="ease"]');
            const tweakElement = equipItem.querySelector('[data-mode="tweak"]');
            const levelDisplay = equipItem.querySelector('.level-display');
            const tweakInput = equipItem.querySelector('input[type="number"]');
            const upgradeButton = equipItem.querySelector('.upgrade-btn');
            const label = equipItem.querySelector('label');
            const equipmentImage = equipItem.querySelector('.equipment-image');

            equipmentImage.classList.toggle('grayscale', !equipState.checked);

            if (levelDisplay) levelDisplay.textContent = equipState.level;
            if (tweakInput) tweakInput.value = equipState.level;

            const maxLevel = parseInt(tweakInput?.max || upgradeButton?.dataset.maxLevel, 10);
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

            if (easeElement) easeElement.style.display = isTweakMode ? 'none' : 'flex';
            if (tweakElement) tweakElement.style.display = isTweakMode ? 'block' : 'none';
        }
    }
}