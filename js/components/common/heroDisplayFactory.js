import { translate } from '../../i18n/translator.js';
import { toCamelCase } from '../../utils/stringUtils.js';
import { getSVG } from '../../utils/svgManager.js';

export function createHeroIcon(hero, { sizeClass = '', action = '' } = {}) {
    const img = document.createElement('orecalc-assets-image');
    const heroKey = toCamelCase(hero.name);
    img.setAttribute('src', hero.image);
    img.setAttribute('alt', translate('heroes.' + heroKey));
    img.dataset.i18nAlt = 'heroes.' + heroKey;
    img.setAttribute('class', sizeClass || 'hero-icon');
    img.setAttribute('size', 'thumbnail');
    if (action) img.dataset.action = action;
    return img;
}

export function createEquipmentItem({ equip, equipState, plannerState, idPrefix = 'planner', mode = 'planner', uiSettings = {} }) {
    const container = document.createElement('div');
    container.className = mode === 'planner' ? 'equipment-item-planner' : 'equipment-item';
    container.dataset.equipName = equip.name;
    container.dataset.equipType = equip.type;

    const isChecked = equipState?.checked ?? true;
    const currentLevel = equipState?.level ?? 1;
    const grayscaleClass = !isChecked ? 'grayscale' : '';
    const maxLevel = equip.type === 'common' ? 18 : 27;
    const isMaxLevel = currentLevel >= maxLevel;

    let isOverLeveled = false;
    if (plannerState) {
        const customCommonMax = plannerState.customMaxLevel?.common ?? 18;
        const customEpicMax = plannerState.customMaxLevel?.epic ?? 27;
        const customMaxLevel = equip.type === 'common' ? customCommonMax : customEpicMax;
        isOverLeveled = currentLevel >= customMaxLevel && currentLevel < maxLevel;
    }

    const goldGlowClass = isMaxLevel ? 'gold-glow' : '';
    const overLeveledGlowClass = isOverLeveled ? 'over-leveled-glow' : '';
    const equipTypeClass = equip.type === 'common' ? 'common-equip' : 'epic-equip';

    const img = document.createElement('orecalc-assets-image');
    const equipKey = toCamelCase(equip.name);
    img.setAttribute('src', equip.image);
    img.setAttribute('alt', translate('equipment.' + equipKey));
    img.dataset.i18nAlt = 'equipment.' + equipKey;
    img.setAttribute('class', `equipment-image ${goldGlowClass} ${overLeveledGlowClass} ${grayscaleClass}`);
    img.setAttribute('size', 'standard');
    if (mode === 'interactive') img.dataset.action = 'toggle-equip';

    const nameLabel = mode === 'planner' ? document.createElement('span') : document.createElement('label');
    nameLabel.className = `${goldGlowClass} ${overLeveledGlowClass} ${equipTypeClass}`;
    nameLabel.textContent = translate('equipment.' + equipKey);
    nameLabel.dataset.i18n = 'equipment.' + equipKey;
    
    const literalEquipName = equip.name.replace(/\s/g, '');
    const inputId = `${idPrefix}-${literalEquipName}-level`;
    
    if (mode === 'interactive') {
        nameLabel.setAttribute('for', inputId);
    }

    if (mode === 'planner') {
        const info = document.createElement('div');
        info.className = 'equipment-info';
        info.appendChild(img);
        info.appendChild(nameLabel);
        container.appendChild(info);

        const switchLabel = document.createElement('label');
        switchLabel.className = 'switch';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `${idPrefix}-${toCamelCase(equip.name)}-toggle`;
        checkbox.name = `${idPrefix}-${toCamelCase(equip.name)}-toggle`;
        checkbox.checked = isChecked;
        switchLabel.appendChild(checkbox);

        const slider = document.createElement('span');
        slider.className = 'slider round';
        switchLabel.appendChild(slider);

        container.appendChild(switchLabel);
    } else {
        // Interactive mode (Equipment Tab)
        container.appendChild(img);
        container.appendChild(nameLabel);

        const isLevelInputEnabled = uiSettings.enableLevelInput === true;
        const levelDisplayId = `${inputId}-display`;

        const displayContainer = document.createElement('div');
        displayContainer.className = 'level-display-container';
        displayContainer.dataset.mode = 'input-disabled';
        displayContainer.style.display = isLevelInputEnabled ? 'none' : 'flex';

        const levelSpan = document.createElement('span');
        levelSpan.className = 'level-display';
        levelSpan.id = levelDisplayId;
        levelSpan.textContent = currentLevel;
        displayContainer.appendChild(levelSpan);

        const upgradeBtn = document.createElement('button');
        upgradeBtn.className = 'upgrade-btn';
        upgradeBtn.dataset.action = 'increment-level';
        upgradeBtn.dataset.maxLevel = maxLevel;
        upgradeBtn.style.visibility = isMaxLevel ? 'hidden' : 'visible';
        upgradeBtn.innerHTML = getSVG('arrow-up');
        displayContainer.appendChild(upgradeBtn);
        container.appendChild(displayContainer);

        const inputContainer = document.createElement('div');
        inputContainer.className = 'level-input-container';
        inputContainer.dataset.mode = 'input-enabled';
        inputContainer.style.display = isLevelInputEnabled ? 'block' : 'none';

        const levelInput = document.createElement('input');
        levelInput.type = 'number';
        levelInput.id = inputId;
        levelInput.name = inputId;
        levelInput.className = 'updatable';
        levelInput.min = '1';
        levelInput.max = maxLevel;
        levelInput.value = currentLevel;
        inputContainer.appendChild(levelInput);
        container.appendChild(inputContainer);
    }

    return container;
}

export function createHeroCard({ hero, heroState, heroKey, mode = 'interactive', plannerState, uiSettings = {} }) {
    const card = document.createElement('div');
    const heroDisabledClass = (heroState.enabled === false) ? 'hero-disabled' : '';
    card.className = `hero-card card ${heroDisabledClass}`;
    card.dataset.heroName = hero.name;

    const titleDiv = document.createElement('div');
    titleDiv.className = 'hero-title';

    const icon = createHeroIcon(hero, { 
        action: mode === 'interactive' ? 'toggle-hero' : '',
        sizeClass: mode === 'planner' ? 'hero-icon-planner' : 'hero-icon'
    });
    titleDiv.appendChild(icon);

    const h3 = document.createElement('h3');
    const heroKeyInternal = toCamelCase(hero.name);
    h3.textContent = translate('heroes.' + heroKeyInternal);
    h3.dataset.i18n = 'heroes.' + heroKeyInternal;
    titleDiv.appendChild(h3);
    card.appendChild(titleDiv);

    let containerToAppendTo = card;
    if (mode === 'planner') {
        const equipmentList = document.createElement('div');
        equipmentList.className = 'equipment-list';
        card.appendChild(equipmentList);
        containerToAppendTo = equipmentList;
    }

    hero.equipment.forEach(equip => {
        const equipState = heroState.equipment[equip.name];
        const equipmentItem = createEquipmentItem({
            equip,
            equipState,
            plannerState,
            idPrefix: heroKey,
            mode: mode,
            uiSettings
        });
        containerToAppendTo.appendChild(equipmentItem);
    });

    return card;
}

