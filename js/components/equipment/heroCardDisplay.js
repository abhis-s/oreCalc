import { dom } from '../../dom/domElements.js';

export function renderHeroCards(heroesState, uiSettings) {
    const container = dom.equipment.heroesContainer;
    if (!container) return;

    const isTweakMode = uiSettings.mode === 'tweak';

    for (const heroName in heroesState) {
        const heroState = heroesState[heroName];
        const heroCard = container.querySelector(`[data-hero-name="${heroName}"]`);
        if (!heroCard) continue;

        heroCard.classList.toggle('hero-disabled', !heroState.enabled);

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

            equipItem.querySelector('.equipment-image').classList.toggle('grayscale', !equipState.checked);

            if (levelDisplay) levelDisplay.textContent = equipState.level;
            if (tweakInput) tweakInput.value = equipState.level;

            const maxLevel = parseInt(tweakInput?.max || upgradeButton?.dataset.maxLevel, 10);
            const isMaxLevel = equipState.level >= maxLevel;
            if (label) label.classList.toggle('gold-glow', isMaxLevel);
            if (equipItem.querySelector('.equipment-image')) equipItem.querySelector('.equipment-image').classList.toggle('gold-glow', isMaxLevel);
            if (upgradeButton) upgradeButton.style.visibility = isMaxLevel ? 'hidden' : 'visible';

            if (easeElement) easeElement.style.display = isTweakMode ? 'none' : 'flex';
            if (tweakElement) tweakElement.style.display = isTweakMode ? 'block' : 'none';
        }
    }
}