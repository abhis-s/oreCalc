import { getEquipmentMaxLevel } from '../../data/equipmentCommonData.js';
import { translate } from '../../i18n/translator.js';

import { toCamelCase } from '../../utils/stringUtils.js';
import { getSVG } from '../../utils/svgManager.js';

/**
 * Creates and returns a localized `<orecalc-assets-image>` hero avatar icon element.
 * @param {any} hero - Hero data model object.
 * @param {{ sizeClass?: string, action?: string }} [options={}] - Render options.
 * @returns {HTMLElement} Created hero icon element.
 */
export function createHeroIcon(hero, { sizeClass = '', action = '' } = {}) {
    const img = document.createElement('orecalc-assets-image');
    const heroKey = toCamelCase(hero.name);
    img.setAttribute('src', hero.image);
    img.setAttribute('alt', translate('entities.heroes.' + heroKey));
    img.dataset.i18nAlt = 'entities.heroes.' + heroKey;
    img.setAttribute('class', sizeClass || 'hero-icon');
    img.setAttribute('size', 'thumbnail');
    if (action) img.dataset.action = action;
    return img;
}

/**
 * Creates and returns a single equipment row element with toggle switch or level increment controls.
 * @param {any} params - Equipment configuration parameters.
 * @returns {HTMLElement} Created equipment item element.
 */
export function createEquipmentItem({ equip, equipState, plannerState, idPrefix = 'planner', mode = 'planner', uiSettings = {} }) {
    const container = document.createElement('div');
    container.className = mode === 'planner' ? 'equipment-item-planner' : 'equipment-item';
    container.dataset.equipName = equip.name;
    container.dataset.equipType = equip.type;

    const isChecked = equipState?.checked ?? true;
    const currentLevel = equipState?.level ?? 1;
    const grayscaleClass = !isChecked ? 'grayscale' : '';
    const maxLevel = getEquipmentMaxLevel(equip.type);
    const isMaxLevel = currentLevel >= maxLevel;

    let isOverLeveled = false;
    if (plannerState) {
        const customCommonMax = plannerState.customMaxLevel?.common ?? getEquipmentMaxLevel('common');
        const customEpicMax = plannerState.customMaxLevel?.epic ?? getEquipmentMaxLevel('epic');
        const customMaxLevel = equip.type === 'common' ? customCommonMax : customEpicMax;
        isOverLeveled = currentLevel >= customMaxLevel && currentLevel < maxLevel;
    }

    const goldGlowClass = isMaxLevel ? 'gold-glow' : '';
    const overLeveledGlowClass = isOverLeveled ? 'over-leveled-glow' : '';
    const equipTypeClass = equip.type === 'common' ? 'common-equip' : 'epic-equip';

    const img = document.createElement('orecalc-assets-image');
    const equipKey = toCamelCase(equip.name);
    img.setAttribute('src', equip.image);
    img.setAttribute('alt', translate('entities.equipment.' + equipKey));
    img.dataset.i18nAlt = 'entities.equipment.' + equipKey;
    img.setAttribute('class', `equipment-image ${goldGlowClass} ${overLeveledGlowClass} ${grayscaleClass}`);
    img.setAttribute('size', 'standard');
    img.setAttribute('role', 'button');
    img.setAttribute('tabindex', '0');
    img.setAttribute('aria-label', translate('entities.equipment.' + equipKey));
    if (mode === 'interactive') img.dataset.action = 'toggle-equip';

    const nameLabel = mode === 'planner' ? document.createElement('span') : document.createElement('label');
    nameLabel.className = `${goldGlowClass} ${overLeveledGlowClass} ${equipTypeClass}`;
    nameLabel.textContent = translate('entities.equipment.' + equipKey);
    nameLabel.dataset.i18n = 'entities.equipment.' + equipKey;

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
        checkbox.setAttribute('aria-label', translate('views.planner.toggleEquipment', {
            name: translate('entities.equipment.' + equipKey) || equip.name
        }));
        switchLabel.appendChild(checkbox);

        const slider = document.createElement('span');
        slider.className = 'slider round';
        switchLabel.appendChild(slider);

        container.appendChild(switchLabel);
    } else {
        // Interactive mode (Equipment Tab)
        container.appendChild(img);
        container.appendChild(nameLabel);

        const isLevelInputEnabled = (/** @type {any} */ (uiSettings)).enableLevelInput === true;
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
        upgradeBtn.dataset.maxLevel = String(maxLevel);
        upgradeBtn.style.visibility = isMaxLevel ? 'hidden' : 'visible';
        upgradeBtn.setAttribute('aria-label', translate('actions.upgradeToLevel', {
            name: translate('entities.equipment.' + equipKey) || equip.name,
            level: currentLevel + 1
        }));
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
        levelInput.maxLength = 2;
        levelInput.setAttribute('maxlength', '2');
        levelInput.min = '1';
        levelInput.max = String(maxLevel);
        levelInput.value = currentLevel;
        inputContainer.appendChild(levelInput);
        container.appendChild(inputContainer);
    }

    return container;
}

/**
 * Creates and returns a hero card container with title header, equipment items, and action bindings.
 * @param {any} params - Hero card configuration parameters.
 * @returns {HTMLElement} Created hero card element.
 */
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
    h3.textContent = translate('entities.heroes.' + heroKeyInternal);
    h3.dataset.i18n = 'entities.heroes.' + heroKeyInternal;
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
