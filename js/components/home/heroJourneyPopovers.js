import { heroJourneyNodes } from '../../data/heroJourneyData.js';
import { translate } from '../../i18n/translator.js';

import { state as globalState } from '../../core/state.js';

import { getEffectiveQuestNodeTH, getQuestChestReward, getResolvedEquipmentReward } from '../../domain/income/heroJourneyIncome.js';
import { getNodeTownHallLevel } from '../../domain/income/heroJourneyLevels.js';
import { hideCardHelpPopover, showCardHelpPopover } from '../../utils/cardHelpPopover.js';
import { formatNumber } from '../../utils/numberFormatter.js';

/**
 * Maps raw resource type to localized dictionary lookup key.
 *
 * @param {string} type - Resource type string.
 * @returns {string} Mapped resource key.
 */
export function getResourceKey(type) {
    if (type === 'darkElixir') return 'darkElixir';
    if (type === 'elixir') return 'elixir';
    return type;
}

/**
 * Converts a display equipment name to camelCase key for translation lookups.
 *
 * @param {string} name - Equipment name.
 * @returns {string} CamelCase translation key.
 */
function getEquipmentKey(name) {

    if (!name) return '';
    return name
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .split(/\s+/)
        .map((word, index) => (index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
        .join('');
}

/**
 * Resolves localized equipment display name from translation dictionary.
 *
 * @param {string} name - Raw equipment name.
 * @returns {string} Localized equipment name.
 */
export function getTranslatedEquipmentName(name) {
    if (!name) return '';
    const key = getEquipmentKey(name);
    const eqTranslation = translate(`entities.equipment.${key}`);
    if (eqTranslation && eqTranslation !== `entities.equipment.${key}`) return eqTranslation;
    const heroTranslation = translate(`entities.heroes.${key}`);
    if (heroTranslation && heroTranslation !== `entities.heroes.${key}`) return heroTranslation;
    return name;
}

/**
 * Displays rich contextual popover detailing reward amounts, scalings, and equipment fallbacks.
 * @param {HTMLElement} chip - Milestone node chip element.
 */
export function showNodeTooltip(chip) {
    if (typeof document !== 'undefined' && document.querySelector('.modal.show')) return;
    const nodeLevel = parseInt(chip.dataset.nodeLevel || chip.dataset.level || '', 10);
    const node = heroJourneyNodes.find(n => n.level === nodeLevel);
    if (!node) return;

    if (node.type === 'magicItem') {
        const itemKey = node.itemKey;
        const itemNameText = translate(`entities.magicItems.${itemKey}`);
        const descText = translate(`entities.magicItemDescriptions.${itemKey}`);

        showCardHelpPopover(chip, {
            header: `
                <orecalc-assets-image src="${node.icon}" alt="${itemNameText}" class="popover-img"></orecalc-assets-image>
                <div class="popover-title-group">
                    <span class="popover-title">${node.amount}x ${itemNameText}</span>
                    <span class="popover-badge">${translate('views.home.heroJourney.magicItemBadge')}</span>
                </div>
            `,
            body: `<p>${descText}</p>`
        });
    } else if (node.type === 'skin') {
        const skinKey = node.skinKey;
        const skinNameText = translate(`entities.skins.${skinKey}`);
        const skinWords = skinNameText.split(' ');
        const popoverTitle = skinWords.length > 1
            ? `<span class="accent-text">${skinWords[0]}</span> ${skinWords.slice(1).join(' ')}`
            : skinNameText;

        showCardHelpPopover(chip, {
            header: `
                <orecalc-assets-image src="${node.icon}" alt="${skinNameText}" class="popover-img"></orecalc-assets-image>
                <div class="popover-title-group">
                    <span class="popover-title">${popoverTitle}</span>
                    <span class="popover-badge">${translate('views.home.heroJourney.legendaryHeroSkinBadge')}</span>
                </div>
            `,
            body: `<p>${translate('views.home.heroJourney.skinPopoverBody')}</p>`
        });
    } else if (node.type === 'equipment') {
        const resolvedNode = getResolvedEquipmentReward(node, globalState);
        const icon = resolvedNode.resolvedIcon || node.icon;
        const rawTitle = resolvedNode.resolvedName || '';
        const title = getTranslatedEquipmentName(rawTitle);
        const eqLvl = resolvedNode.equipmentLevel || '1';
        const isClaimedNode = chip.dataset.isClaimed === 'true' || chip.classList.contains('claimed');
        const starryAmount = node.fallbackStarry || 50;

        let bodyText = '';
        if (!isClaimedNode && resolvedNode.isFallbackStarry) {
            bodyText = translate('views.home.heroJourney.equipmentPopoverBodyFallback', { title, starry: starryAmount });
        } else {
            bodyText = translate('views.home.heroJourney.equipmentPopoverBodyNormal', { title, level: eqLvl, starry: starryAmount });
        }

        showCardHelpPopover(chip, {
            header: `
                <orecalc-assets-image src="${icon}" alt="${title}" class="popover-img"></orecalc-assets-image>
                <div class="popover-title-group">
                    <span class="popover-title">${title}</span>
                    <span class="popover-badge">${translate('views.home.heroJourney.epicEquipmentBadge')}</span>
                </div>
            `,
            body: `<p>${bodyText}</p>`
        });
    } else if (node.type === 'quest') {
        const targetName = node.equipmentKey
            ? translate(`entities.equipment.${node.equipmentKey}`)
            : (node.hero ? translate(`entities.heroes.${node.hero}`) : translate('views.home.heroJourney.heroFallback'));
        const questTitleText = translate('views.home.heroJourney.questTitleFormat', { name: targetName });
        const bodyIntroText = translate('views.home.heroJourney.questPopoverBody', { target: targetName });

        const nodeTH = getNodeTownHallLevel(node.level);
        const effectiveTH = getEffectiveQuestNodeTH(node, globalState);
        const rewardMode = globalState?.heroJourney?.acceleratedRewards ? 'accelerated' : 'normal';
        const chestRewards = getQuestChestReward(effectiveTH, rewardMode);

        let rangeLabelKey = 'views.home.heroJourney.chestRewardRangeLabel';
        if (rewardMode === 'accelerated') {
            rangeLabelKey = 'views.home.heroJourney.chestRewardRangeLabelAccelerated';
        } else if (effectiveTH > nodeTH) {
            rangeLabelKey = 'views.home.heroJourney.chestRewardRangeLabelThScaled';
        }

        const shinyRangeStr = `${formatNumber(chestRewards.minShiny)} - ${formatNumber(chestRewards.maxShiny)}`;
        const glowyRangeStr = `${formatNumber(chestRewards.minGlowy)} - ${formatNumber(chestRewards.maxGlowy)}`;
        const starryRangeStr = `${formatNumber(chestRewards.minStarry)} - ${formatNumber(chestRewards.maxStarry)}`;

        const breakdownHtml = `
            <p>${bodyIntroText}</p>
            <div class="popover-chest-breakdown">
                <div class="popover-range-label">${translate(rangeLabelKey)}</div>
                <div class="popover-chest-ranges-row">
                    <div class="chest-ore-inline-chip">
                        <span><strong>${shinyRangeStr}</strong></span>
                        <orecalc-assets-image src="assets/shiny_ore.png" alt="${translate('entities.ores.shiny')}" class="ore-mini-icon"></orecalc-assets-image>
                    </div>
                    <div class="chest-ore-inline-chip">
                        <span><strong>${glowyRangeStr}</strong></span>
                        <orecalc-assets-image src="assets/glowy_ore.png" alt="${translate('entities.ores.glowy')}" class="ore-mini-icon"></orecalc-assets-image>
                    </div>
                    <div class="chest-ore-inline-chip">
                        <span><strong>${starryRangeStr}</strong></span>
                        <orecalc-assets-image src="assets/starry_ore.png" alt="${translate('entities.ores.starry')}" class="ore-mini-icon"></orecalc-assets-image>
                    </div>
                </div>
            </div>
        `;

        showCardHelpPopover(chip, {
            header: `
                <orecalc-assets-image src="${node.icon}" alt="${questTitleText}" class="popover-img"></orecalc-assets-image>
                <div class="popover-title-group">
                    <span class="popover-title">${questTitleText}</span>
                    <span class="popover-badge">${translate('views.home.heroJourney.heroQuestBadge')}</span>
                </div>
            `,
            body: breakdownHtml
        });
    } else if (node.type === 'ore') {
        const oreKey = node.resourceType;
        const oreNameText = translate(`entities.ores.${oreKey}`);
        const formattedAmount = formatNumber(node.amount);

        showCardHelpPopover(chip, {
            header: `
                <orecalc-assets-image src="${node.icon}" alt="${oreNameText}" class="popover-img"></orecalc-assets-image>
                <div class="popover-title-group">
                    <span class="popover-title">${formattedAmount} ${oreNameText}</span>
                    <span class="popover-badge">${translate('views.home.heroJourney.oreRewardBadge')}</span>
                </div>
            `,
            body: `<p>${translate('views.home.heroJourney.orePopoverBody', { amount: formattedAmount, ore: oreNameText })}</p>`
        });
    } else if (node.type === 'resource') {
        const resKey = getResourceKey(node.resourceType);
        const resNameText = translate(`entities.resources.${resKey}`);
        const formattedAmount = formatNumber(node.amount);

        showCardHelpPopover(chip, {
            header: `
                <orecalc-assets-image src="${node.icon}" alt="${resNameText}" class="popover-img"></orecalc-assets-image>
                <div class="popover-title-group">
                    <span class="popover-title">${formattedAmount} ${resNameText}</span>
                    <span class="popover-badge">${translate('views.home.heroJourney.resourceRewardBadge')}</span>
                </div>
            `,
            body: `<p>${translate('views.home.heroJourney.resourcePopoverBody', { amount: formattedAmount, resource: resNameText })}</p>`
        });
    }
}

/**
 * Closes the active milestone node contextual popover.
 */
export function hideNodeTooltip() {
    hideCardHelpPopover();
}

/**
 * Initializes delegated click, hover, and scroll threshold handlers on the milestone track container.
 */
export function initHeroJourneyTooltips() {
    const trackWrapper = document.querySelector('.hero-journey-track-wrapper');
    if (!trackWrapper || trackWrapper.dataset.tooltipBound) return;
    trackWrapper.dataset.tooltipBound = 'true';

    let activeChip = null;
    let lastScrollLeft = trackWrapper.scrollLeft;

    trackWrapper.addEventListener('click', (e) => {
        if (typeof document !== 'undefined' && document.querySelector('.modal.show')) return;
        const claimBtn = e.target.closest('.node-claim-btn');
        if (claimBtn) return;

        const chip = e.target.closest('.hero-journey-node-chip');
        if (chip) {
            e.stopPropagation();
            const popover = document.getElementById('card-help-popover');
            const isShowingCurrent = popover && popover.classList.contains('show') && (activeChip === chip || activeChip?.dataset?.nodeLevel === chip.dataset.nodeLevel);

            if (isShowingCurrent) {
                activeChip = null;
                hideNodeTooltip();
            } else {
                activeChip = chip;
                showNodeTooltip(chip);
            }
        }
    });

    trackWrapper.addEventListener('mouseover', (e) => {
        if (e.pointerType === 'touch' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        if (typeof document !== 'undefined' && document.querySelector('.modal.show')) return;

        const chip = e.target.closest('.hero-journey-node-chip');
        if (chip && chip !== activeChip) {
            activeChip = chip;
            showNodeTooltip(chip);
        }
    });

    trackWrapper.addEventListener('mouseout', (e) => {
        if (e.pointerType === 'touch' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

        const chip = e.target.closest('.hero-journey-node-chip');
        if (chip) {
            const related = e.relatedTarget;
            if (!related || !chip.contains(related)) {
                if (activeChip === chip) {
                    activeChip = null;
                    hideNodeTooltip();
                }
            }
        }
    });

    trackWrapper.addEventListener('scroll', () => {
        const currentScrollLeft = trackWrapper.scrollLeft;
        if (Math.abs(currentScrollLeft - lastScrollLeft) > 10) {
            lastScrollLeft = currentScrollLeft;
            activeChip = null;
            hideNodeTooltip();
        }
    }, { passive: true });
}
