import { dom } from '../../dom/domElements.js';
import { heroData } from '../../data/appData.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { translate } from '../../i18n/translator.js';

export function initializeHeroCards(heroesState, uiSettings, plannerMaxLevels) {
    const { customMaxLevel } = plannerMaxLevels;
    const container = dom.equipment.heroesContainer;
    if (!container) return;

    let cardsHtml = '';
    for (const heroKey in heroData) {
        const hero = heroData[heroKey];
        const heroState = heroesState[hero.name];

        if (!heroState) {
            continue; // Skip if heroState is not defined
        }

        const equipmentHtml = hero.equipment.map(equip => {
            const maxLevel = equip.type === 'common' ? 18 : 27;
            const equipState = heroState.equipment[equip.name];
            const inputId = `${heroKey}-${equip.name.replace(/\s/g, '')}-level`;
            const levelDisplayId = `${inputId}-display`;

            const isLevelInputEnabled = uiSettings.enableLevelInput === true;
            const upgradeBtnDisplay = isLevelInputEnabled ? 'none' : 'flex';
            const inputContainerDisplay = isLevelInputEnabled ? 'block' : 'none';

            const isChecked = equipState.checked !== undefined ? equipState.checked : true;
            const currentLevel = equipState.level !== undefined ? equipState.level : 1;
            
            const grayscaleClass = isChecked ? '' : 'grayscale';

            return `
                <div class="equipment-item" data-equip-name="${equip.name}" data-equip-type="${equip.type}">
                    <img src="${equip.image}" alt="${translate(equip.name.toLowerCase().replace(/\s/g, '_'))}" class="equipment-image ${grayscaleClass}" data-action="toggle-equip">
                    <label for="${inputId}" class="${equip.type === 'common' ? 'common-equip' : 'epic-equip'}">${translate(equip.name.toLowerCase().replace(/\s/g, '_'))}</label>
                    <div class="level-display-container" data-mode="input-disabled" style="display: ${upgradeBtnDisplay};">
                        <span class="level-display" id="${levelDisplayId}">${currentLevel}</span>
                        <button class="upgrade-btn" data-action="increment-level" data-max-level="${maxLevel}">
                           <svg viewBox="0 -960 960 960"><path d="M440-160v-480L200-390l-56-50 336-336 336 336-56 56-240-240v480h-80Z"/></svg>
                        </button>
                    </div>
                    <div class="level-input-container" data-mode="input-enabled" style="display: ${inputContainerDisplay};">
                        <input type="number" class="updatable" id="${inputId}" min="1" max="${maxLevel}" value="${currentLevel}">
                    </div>
                </div>
            `;
        }).join('');

        const heroDisabledClass = heroState.enabled ? '' : 'hero-disabled';

        cardsHtml += `
            <div class="hero-card card ${heroDisabledClass}" data-hero-name="${hero.name}">
                <div class="hero-title">
                    <img src="${hero.image}" alt="${translate(hero.name.toLowerCase().replace(/\s/g, '_'))}" class="hero-icon" data-action="toggle-hero">
                    <h3>${translate(hero.name.toLowerCase().replace(/\s/g, '_'))}</h3>
                </div>
                ${equipmentHtml}
            </div>
        `;
    }
    container.innerHTML = cardsHtml;

    container.addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.action;
        const heroCard = actionElement.closest('.hero-card');
        const heroName = heroCard.dataset.heroName;

        switch(action) {
            case 'increment-level': {
                const equipItem = actionElement.closest('.equipment-item');
                const equipName = equipItem.dataset.equipName;
                const currentLevel = state.heroes[heroName].equipment[equipName].level;
                const maxLevel = parseInt(actionElement.dataset.maxLevel, 10);
                if (currentLevel < maxLevel) {
                    handleStateUpdate(() => { state.heroes[heroName].equipment[equipName].level = currentLevel + 1; });
                }
                break;
            }
        }
    });

    container.addEventListener('change', (event) => {
        const input = event.target;
        if (input.type !== 'number') return;
        
        const heroName = input.closest('.hero-card').dataset.heroName;
        const equipName = input.closest('.equipment-item').dataset.equipName;

        let value = parseInt(input.value, 10);
        if (isNaN(value)) value = 1;
        value = Math.max(1, Math.min(value, parseInt(input.max, 10)));

        handleStateUpdate(() => {
            state.heroes[heroName].equipment[equipName].level = value;
        });
    });
}
