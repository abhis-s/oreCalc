import { dom } from '../../dom/domElements.js';

import { heroData } from '../../data/appData.js';
import { toCamelCase } from '../../utils/stringUtils.js';
import { translate } from '../../i18n/translator.js';

import { updatePageDots, getCurrentHeroIndex } from './heroPlannerCarouselDisplay.js'; 

import { createHeroIcon, createEquipmentItem } from '../common/heroDisplayFactory.js';

/**
 * Updates the existing hero switches without destroying the DOM elements.
 */
function updateExistingHeroSwitches(heroesState) {
    const carouselContent = dom.planner?.heroCarouselContent;
    if (!carouselContent) return;

    const heroPages = carouselContent.querySelectorAll('.hero-page');
    heroPages.forEach(heroPage => {
        const heroName = heroPage.dataset.heroName;
        const heroState = heroesState[heroName] || { equipment: {} };
        const heroKey = toCamelCase(heroName);

        // Update Hero Toggle
        const heroToggle = heroPage.querySelector(`#planner-${heroKey}-toggle`);
        if (heroToggle) {
            heroToggle.checked = heroState.enabled !== false;
        }

        // Update Hero Name (for language changes)
        const nameText = heroPage.querySelector('.hero-name-text');
        if (nameText) {
            nameText.textContent = translate(`heroes.${heroKey}`);
        }

        // Update Equipment Toggles
        const equipmentItems = heroPage.querySelectorAll('.equipment-item-planner');
        equipmentItems.forEach(item => {
            const equipName = item.dataset.equipName;
            const equipState = heroState.equipment?.[equipName] || {};
            const equipToggle = item.querySelector('input[type="checkbox"]');
            if (equipToggle) {
                equipToggle.checked = equipState.checked !== false;
            }
            
            // Update Equipment Name
            const equipLabel = item.querySelector('span');
            if (equipLabel) {
                equipLabel.textContent = translate(`equipment.${toCamelCase(equipName)}`);
            }
        });
    });
}

export function initializeHeroPlannerCarousel(heroesState, plannerState) {
    const carouselContent = dom.planner?.heroCarouselContent;
    const plannerPageDots = dom.planner?.plannerPageDots;
    if (!carouselContent || !plannerPageDots) return;

    // If carousel is already populated, just update the switch states
    // to preserve animations and prevent re-rendering "snap"
    if (carouselContent.children.length > 0) {
        updateExistingHeroSwitches(heroesState);
        return;
    }

    carouselContent.innerHTML = '';
    const heroKeys = Object.keys(heroData);

    heroKeys.forEach(heroKey => {
        const hero = heroData[heroKey];
        const heroState = heroesState[hero.name] || { equipment: {} };

        const heroPage = document.createElement('div');
        heroPage.className = 'hero-page';
        heroPage.dataset.heroName = hero.name;

        const headerSection = document.createElement('div');
        headerSection.className = 'hero-header-section';

        const infoAndName = document.createElement('div');
        infoAndName.className = 'hero-info-and-name';
        infoAndName.appendChild(createHeroIcon(hero, { sizeClass: 'hero-icon-planner' }));

        const heroNameSpan = document.createElement('span');
        heroNameSpan.className = 'hero-name-text';
        heroNameSpan.textContent = translate(`heroes.${heroKey}`);
        heroNameSpan.dataset.i18n = `heroes.${heroKey}`;
        infoAndName.appendChild(heroNameSpan);

        headerSection.appendChild(infoAndName);

        const toggleSwitch = document.createElement('div');
        toggleSwitch.className = 'hero-toggle-switch';
        
        const switchLabel = document.createElement('label');
        switchLabel.className = 'switch large-switch';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `planner-${heroKey}-toggle`;
        checkbox.name = `planner-${heroKey}-toggle`;
        checkbox.checked = heroState.enabled !== false;
        switchLabel.appendChild(checkbox);

        const slider = document.createElement('span');
        slider.className = 'slider round';
        switchLabel.appendChild(slider);
        
        toggleSwitch.appendChild(switchLabel);
        headerSection.appendChild(toggleSwitch);
        heroPage.appendChild(headerSection);

        const equipmentList = document.createElement('div');
        equipmentList.className = 'equipment-list';

        hero.equipment.forEach(equip => {
            const equipState = heroState.equipment?.[equip.name] || {};
            const equipmentItem = createEquipmentItem({
                equip,
                equipState,
                plannerState,
                idPrefix: `planner-${heroKey}`
            });
            equipmentList.appendChild(equipmentItem);
        });

        heroPage.appendChild(equipmentList);
        carouselContent.appendChild(heroPage);
    });

    let dotsHtml = '';
    heroKeys.forEach((_, index) => {
        dotsHtml += `<span class="dot" data-index="${index}"></span>`;
    });
    plannerPageDots.innerHTML = dotsHtml;

    updatePageDots(getCurrentHeroIndex());
}
