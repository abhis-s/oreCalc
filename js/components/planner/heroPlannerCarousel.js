import { dom } from '../../dom/domElements.js';
import { heroData } from '../../data/appData.js';
import { updatePageDots } from './heroPlannerCarouselDisplay.js'; 
import { translate } from '../../i18n/translator.js';

let currentHeroIndex = 0; 

export function initializeHeroPlannerCarousel(heroesState, plannerState) {
    const carouselContent = dom.planner?.heroCarouselContent;
    const plannerPageDots = dom.planner?.plannerPageDots;
    if (!carouselContent || !plannerPageDots) return;

    let heroPagesHtml = '';
    const heroKeys = Object.keys(heroData);

    heroKeys.forEach(heroKey => {
        const hero = heroData[heroKey];
        const heroState = heroesState[hero.name];

        if (!heroState) {
            return;
        }

        const isHeroEnabled = heroState.enabled;

        const equipmentListHtml = hero.equipment.map(equip => {
            const equipState = heroState.equipment[equip.name];
            const isEquipChecked = equipState?.checked;
            const grayscaleClass = !isEquipChecked ? 'grayscale' : '';
            const equipId = `planner-${heroKey}-${equip.name.replace(/\s/g, '')}-toggle`;

            const maxLevel = equip.type === 'common' ? 18 : 27;
            const isMaxLevel = equipState?.level >= maxLevel;

            let isOverLeveled = false;
            if (plannerState) {
                const customMaxLevel = equip.type === 'common'
                    ? plannerState.customMaxLevel.common
                    : plannerState.customMaxLevel.epic;
                isOverLeveled = equipState?.level >= customMaxLevel && equipState?.level < maxLevel;
            }

            const goldGlowClass = isMaxLevel ? 'gold-glow' : '';
            const overLeveledGlowClass = isOverLeveled ? 'over-leveled-glow' : '';
            const equipTypeClass = equip.type === 'common' ? 'common-equip' : 'epic-equip';

            return `
                <div class="equipment-item-planner" data-equip-name="${equip.name}">
                    <div class="equipment-info">
                        <img src="${equip.image}" alt="${translate(equip.name.toLowerCase().replace(/\s/g, '_'))}" class="equipment-image ${goldGlowClass} ${overLeveledGlowClass} ${grayscaleClass}">
                        <span class="${goldGlowClass} ${overLeveledGlowClass} ${equipTypeClass}">${translate(equip.name.toLowerCase().replace(/\s/g, '_'))}</span>
                    </div>
                    <label class="switch">
                        <input type="checkbox" id="${equipId}" ${isEquipChecked ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                </div>
            `;
        }).join('');

        const heroToggleId = `planner-${heroKey}-toggle`;

        heroPagesHtml += `
            <div class="hero-page" data-hero-name="${hero.name}">
                <div class="hero-header-section">
                    <div class="hero-info-and-name">
                                                <img src="${hero.image}" alt="${translate(hero.name.toLowerCase().replace(/\s/g, '_'))}" class="hero-icon-planner">
                    </div>
                    <div class="hero-toggle-switch">
                        <label class="switch large-switch">
                            <input type="checkbox" id="${heroToggleId}" ${isHeroEnabled ? 'checked' : ''}>
                            <span class="slider round"></span>
                        </label>
                    </div>
                </div>
                <div class="equipment-list">
                    ${equipmentListHtml}
                </div>
            </div>
        `;
    });

    carouselContent.innerHTML = heroPagesHtml;

    let dotsHtml = '';
    heroKeys.forEach((_, index) => {
        dotsHtml += `<span class="dot" data-index="${index}"></span>`;
    });
    plannerPageDots.innerHTML = dotsHtml;

    updatePageDots(currentHeroIndex);
}
