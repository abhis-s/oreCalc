import { getEquipmentMaxLevel } from '../../data/equipmentCommonData.js';
import { heroData } from '../../data/heroData.js';
import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';

import { toCamelCase } from '../../utils/stringUtils.js';

import { openLevelSelectModal } from './levelSelectModal.js';

/**
 * Renders the hero equipment selection chips grid inside the priority list modal.
 * @param {HTMLElement} gridContainer
 * @param {Array<any>} globalPriorityList
 */
export function renderHeroEquipmentGrid(gridContainer, globalPriorityList) {
    for (const heroKey in heroData) {
        const hero = heroData[heroKey];

        const row = document.createElement('div');
        row.classList.add('hero-row');

        const heroColumn = document.createElement('div');
        heroColumn.classList.add('hero-chip-column');
        const heroChip = document.createElement('div');
        heroChip.classList.add('hero-chip');
        const heroKeyStr = hero.key || heroKey;
        const heroDisplayName = translate(`entities.heroes.${heroKeyStr}`);
        heroChip.innerHTML = `
            <orecalc-assets-image src="${hero.image}" alt="${heroDisplayName}" class="hero-chip-icon" size="thumbnail"></orecalc-assets-image>
            <span>${heroDisplayName}</span>
        `;
        heroColumn.appendChild(heroChip);

        const equipmentColumn = document.createElement('div');
        equipmentColumn.classList.add('equipment-chips-column');

        hero.equipment.forEach(equip => {
            const eqKeyStr = equip.key || toCamelCase(equip.name || '');
            const eqDisplayName = translate(`entities.equipment.${eqKeyStr}`);
            const heroStateName = {
                barbarianKing: 'Barbarian King',
                archerQueen: 'Archer Queen',
                minionPrince: 'Minion Prince',
                grandWarden: 'Grand Warden',
                royalChampion: 'Royal Champion',
                dragonDuke: 'Dragon Duke'
            }[heroKeyStr] || heroKeyStr;

            const userHeroState = state.heroes[heroStateName] || state.heroes[heroKeyStr];
            const currentLevel = userHeroState?.equipment?.[eqKeyStr]?.level || userHeroState?.equipment?.[equip.name]?.level || 1;
            const maxLevel = getEquipmentMaxLevel(equip.type);

            if (currentLevel < maxLevel) {
                const chip = document.createElement('div');
                chip.classList.add('equipment-chip');
                chip.setAttribute('tabindex', '0');
                chip.setAttribute('role', 'button');
                chip.dataset.equipName = equip.name || eqKeyStr;
                chip.innerHTML = `
                    <orecalc-assets-image src="${equip.image}" alt="${eqDisplayName}" class="chip-icon" size="thumbnail"></orecalc-assets-image>
                    <span>${eqDisplayName}</span>
                `;
                chip.addEventListener('click', () => openLevelSelectModal(hero, equip));
                chip.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        chip.click();
                    }
                });

                const isMaxedInPlan = globalPriorityList.some(item =>
                    item.heroName === hero.name &&
                    item.name === equip.name &&
                    item.targetLevel === maxLevel
                );
                if (isMaxedInPlan) {
                    chip.classList.add('maxed-in-plan');
                }

                const customMaxLevel = state.planner.customMaxLevel?.[equip.type] || getEquipmentMaxLevel(equip.type);
                const isCustomMaxedInPlan = globalPriorityList.some(item =>
                    item.heroName === hero.name &&
                    item.name === equip.name &&
                    item.targetLevel >= customMaxLevel
                );
                const isAlreadyCustomMaxed = currentLevel >= customMaxLevel;
                if (isCustomMaxedInPlan || isAlreadyCustomMaxed) {
                    chip.classList.add('custom-maxed-in-plan');
                }

                equipmentColumn.appendChild(chip);
            }
        });

        if (equipmentColumn.hasChildNodes()) {
            row.appendChild(heroColumn);
            row.appendChild(equipmentColumn);
            gridContainer.appendChild(row);
        }
    }
}

/**
 * Creates the shell container markup for priority editor.
 * @param {HTMLElement} modalBody
 * @returns {{ gridContainer: HTMLElement|null, editor: HTMLElement|null }}
 */
export function initializePriorityEditorShell(modalBody) {
    modalBody.innerHTML = `
        <div class="priority-editor-container">
            <div id="priority-list-message-container" class="priority-list-message-box"></div>
            <div class="equipment-chip-container">
                <h3 data-i18n="views.planner.addPlan">${translate('views.planner.addPlan')}</h3>
                <div class="hero-equipment-grid"></div>
            </div>
            <div id="priority-list-editor" class="priority-list-editor">
                <!-- Draggable items will be rendered here -->
            </div>
        </div>
    `;

    const gridContainer = modalBody.querySelector('.hero-equipment-grid');
    const editor = modalBody.querySelector('#priority-list-editor');
    return {
        gridContainer: /** @type {HTMLElement|null} */ (gridContainer),
        editor: /** @type {HTMLElement|null} */ (editor)
    };
}
