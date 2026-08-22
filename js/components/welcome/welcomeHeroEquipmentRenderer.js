import { getEquipmentMaxLevel } from '../../data/equipmentCommonData.js';
import { heroData } from '../../data/heroData.js';
import { translate } from '../../i18n/translator.js';

/**
 * Renders the hero and equipment horizontal scrolling list for the profile preview card.
 * @param {Object} playerData
 * @param {HTMLElement} equipmentListContainer
 */
export function renderHeroEquipmentList(playerData, equipmentListContainer) {
    if (!equipmentListContainer) return;
    equipmentListContainer.innerHTML = '';

    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'welcome-hero-scroll-container';
    scrollContainer.setAttribute('tabindex', '0');
    scrollContainer.setAttribute('role', 'region');
    scrollContainer.setAttribute('aria-label', translate('views.welcome.equipmentTab'));

    scrollContainer.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            e.stopPropagation();
            scrollContainer.scrollBy({ left: -140, behavior: 'smooth' });
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            e.stopPropagation();
            scrollContainer.scrollBy({ left: 140, behavior: 'smooth' });
        }
    });

    const ownedEquip = playerData.ownedEquipment || {};
    const ownedHeroes = playerData.ownedHeroes || {};

    for (const heroKey in heroData) {
        const heroInfo = heroData[heroKey];
        if (!heroInfo.equipment || heroInfo.equipment.length === 0) continue;

        let heroLevel = 0;
        let heroMaxLevel = 0;

        if (ownedHeroes && typeof ownedHeroes === 'object' && !Array.isArray(ownedHeroes)) {
            const heroObj = ownedHeroes[heroInfo.name];
            if (heroObj) {
                heroLevel = heroObj.level || 0;
                heroMaxLevel = heroObj.maxLevel || 0;
            }
        } else if (Array.isArray(ownedHeroes)) {
            const found = ownedHeroes.find(h => h && (h === heroInfo.name || h.name === heroInfo.name));
            if (found) {
                heroLevel = typeof found === 'object' ? (found.level || 0) : 1;
                heroMaxLevel = typeof found === 'object' ? (found.maxLevel || 0) : 0;
            }
        }

        const isHeroMax = heroLevel > 0 && heroLevel >= heroMaxLevel;

        const heroGroup = document.createElement('div');
        heroGroup.className = 'welcome-hero-group';
        if (isHeroMax) {
            heroGroup.classList.add('max-level');
        }

        const heroBadge = document.createElement('div');
        heroBadge.className = 'welcome-hero-badge';
        if (isHeroMax) {
            heroBadge.classList.add('max-level');
        }

        const heroImg = document.createElement('orecalc-assets-image');
        heroImg.setAttribute('class', 'welcome-hero-img');
        heroImg.setAttribute('src', heroInfo.image);
        heroImg.setAttribute('alt', heroInfo.name);
        heroImg.setAttribute('size', 'thumbnail');
        heroBadge.appendChild(heroImg);

        const heroName = document.createElement('span');
        heroName.className = 'welcome-hero-name';
        heroName.textContent = heroInfo.name;
        heroBadge.appendChild(heroName);

        const heroLevelEl = document.createElement('span');
        heroLevelEl.className = 'welcome-hero-level';
        heroLevelEl.textContent = heroLevel > 0 ? `Lvl ${heroLevel}` : translate('views.home.profile.locked');
        if (isHeroMax) {
            heroLevelEl.classList.add('max-level-text');
        }
        heroBadge.appendChild(heroLevelEl);

        heroGroup.appendChild(heroBadge);

        const equipList = document.createElement('div');
        equipList.className = 'welcome-hero-equip-list';

        const ownedEquipItems = [];
        const lockedEquipItems = [];

        heroInfo.equipment.forEach(equip => {
            const hasEquip = ownedEquip[equip.name] !== undefined;
            const currentLevel = hasEquip ? ownedEquip[equip.name] : 1;
            const maxLevel = getEquipmentMaxLevel(equip.type);
            const isMax = hasEquip && currentLevel >= maxLevel;

            const equipItem = document.createElement('div');
            equipItem.className = 'welcome-equip-item';
            if (!hasEquip) {
                equipItem.classList.add('locked');
            } else if (isMax) {
                equipItem.classList.add('max-level');
            }

            const imgContainer = document.createElement('div');
            imgContainer.className = 'equipment-image-container';

            const equipImg = document.createElement('orecalc-assets-image');
            equipImg.setAttribute('src', equip.image);
            equipImg.setAttribute('alt', equip.name);
            equipImg.setAttribute('class', 'equipment-image');
            equipImg.setAttribute('size', 'thumbnail');
            imgContainer.appendChild(equipImg);

            if (hasEquip) {
                const levelBox = document.createElement('div');
                levelBox.className = 'equipment-level-box';
                if (isMax) {
                    levelBox.classList.add('max-level');
                }
                levelBox.textContent = currentLevel;
                imgContainer.appendChild(levelBox);
            }

            equipItem.appendChild(imgContainer);

            const equipName = document.createElement('span');
            equipName.className = 'welcome-equip-name';
            equipName.textContent = equip.name;
            equipName.title = equip.name;
            equipItem.appendChild(equipName);

            if (hasEquip) {
                ownedEquipItems.push(equipItem);
            } else {
                lockedEquipItems.push(equipItem);
            }
        });

        ownedEquipItems.forEach(item => equipList.appendChild(item));
        lockedEquipItems.forEach(item => equipList.appendChild(item));

        heroGroup.appendChild(equipList);
        scrollContainer.appendChild(heroGroup);
    }

    scrollContainer.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    scrollContainer.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });
    scrollContainer.addEventListener('touchend', (e) => e.stopPropagation(), { passive: true });
    scrollContainer.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });

    equipmentListContainer.appendChild(scrollContainer);
}
