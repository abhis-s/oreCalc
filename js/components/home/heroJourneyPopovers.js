import { heroJourneyNodes } from '../../data/heroJourneyData.js';
import { translate } from '../../i18n/translator.js';

import { state as globalState } from '../../core/state.js';

import { getEffectiveQuestNodeTH, getQuestChestReward } from '../../domain/income/heroJourneyIncome.js';
import { getResolvedEquipmentReward } from '../../domain/income/heroJourneyResolution.js';
import { getCumulativeHeroLevel, getNodeTownHallLevel } from '../../domain/income/heroJourneyLevels.js';
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
 * Resolves localized equipment display name from translation dictionary using key or display name.
 *
 * @param {string} keyOrName - CamelCase equipment key or raw display name.
 * @returns {string} Localized equipment name.
 */
export function getTranslatedEquipmentName(keyOrName) {
    if (!keyOrName) return '';

    if (keyOrName === 'starryOre' || keyOrName === '50 Starry Ore' || (typeof keyOrName === 'string' && keyOrName.toLowerCase().includes('starry ore'))) {
        return translate('entities.ores.starry') || 'Starry Ore';
    }

    // Direct translation check for camelCase key
    const directTranslation = translate(`entities.equipment.${keyOrName}`);
    if (directTranslation && directTranslation !== `entities.equipment.${keyOrName}`) return directTranslation;

    const directHeroTranslation = translate(`entities.heroes.${keyOrName}`);
    if (directHeroTranslation && directHeroTranslation !== `entities.heroes.${keyOrName}`) return directHeroTranslation;

    // Convert raw display name to camelCase key
    const key = getEquipmentKey(keyOrName);
    const eqTranslation = translate(`entities.equipment.${key}`);
    if (eqTranslation && eqTranslation !== `entities.equipment.${key}`) return eqTranslation;
    const heroTranslation = translate(`entities.heroes.${key}`);
    if (heroTranslation && heroTranslation !== `entities.heroes.${key}`) return heroTranslation;

    return keyOrName;
}

/**
 * Displays rich contextual popover detailing reward amounts, scalings, and equipment fallbacks.
 * @param {HTMLElement} chip - Milestone node chip element.
 * @param {import('../../core/types.js').AppState | null} [stateOverride=null] - Optional state override for standalone views.
 */
export function showNodeTooltip(chip, stateOverride = null) {
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
        const appState = stateOverride || globalState;
        const resolvedNode = getResolvedEquipmentReward(node, appState);
        const icon = resolvedNode.resolvedIcon || node.icon;
        const rawKeyOrTitle = resolvedNode.resolvedKey || resolvedNode.resolvedName || '';
        const title = resolvedNode.isFallbackStarry
            ? `${resolvedNode.fallbackStarry || 50} ${translate('entities.ores.starry')}`
            : getTranslatedEquipmentName(rawKeyOrTitle);
        const translatedHeroName = node.hero ? translate(`entities.heroes.${node.hero}`) : 'Hero';
        const poolTitle = translate('views.home.heroJourney.poolHeaderTitle', { hero: translatedHeroName });
        const poolIntro = translate('views.home.heroJourney.poolIntroText');

        const playerCumLevel = Number(appState?.playerProfile?.cumulativeLevel) || (appState?.playerProfile?.ownedHeroes ? getCumulativeHeroLevel(appState.playerProfile.ownedHeroes) : 0);
        const isClaimedByLevel = Boolean(appState?.playerProfile?.tag) && playerCumLevel >= node.level;
        const isClaimed = chip.classList?.contains('claimed') || chip.dataset?.isClaimed === 'true' || Boolean(chip.closest?.('.claimed')) || Boolean(chip.closest?.('tr')?.classList?.contains('claimed')) || isClaimedByLevel;
        const isUnownedClaimed = isClaimed && !resolvedNode.isOwned && !resolvedNode.isFallbackStarry;

        let poolListHtml = '';
        if (resolvedNode.poolOptions && resolvedNode.poolOptions.length > 0) {
            let itemsHtml = '';
            for (const opt of resolvedNode.poolOptions) {
                let badgeText = '';
                let badgeClass = '';
                if (opt.status === 'owned') {
                    badgeText = translate('views.home.heroJourney.poolOwned');
                    badgeClass = 'badge--owned';
                } else if (opt.status === 'awardedHere') {
                    badgeText = translate('views.home.heroJourney.poolAwardedHere');
                    badgeClass = 'badge--awarded';
                } else if (opt.status === 'nowAwardedAt') {
                    badgeText = translate('views.home.heroJourney.poolNowAwardedAtLevel', { level: opt.awardedAtLevel || '' });
                    badgeClass = 'badge--now-awarded';
                } else if (opt.status === 'missed') {
                    badgeText = translate('views.home.heroJourney.poolMissed');
                    badgeClass = 'badge--missed';
                } else if (opt.status === 'awardedEarlier') {
                    badgeText = translate('views.home.heroJourney.poolAwardedAtLevel', { level: opt.awardedAtLevel || '' });
                    badgeClass = 'badge--awarded-earlier';
                } else if (opt.status === 'queued') {
                    if (opt.awardedAtLevel) {
                        badgeText = translate('views.home.heroJourney.poolAtLevel', { level: opt.awardedAtLevel });
                    } else {
                        badgeText = translate('views.home.heroJourney.poolInQueue');
                    }
                    badgeClass = 'badge--queued';
                } else if (opt.status === 'starryFallback') {
                    badgeText = translate('views.home.heroJourney.fallbackLabel');
                    badgeClass = 'badge--starry';
                }

                const isHighlighted = opt.status === 'awardedHere' || opt.status === 'nowAwardedAt';
                const isOwned = opt.status === 'owned';
                const isEarlier = opt.status === 'awardedEarlier';
                const isMissed = opt.status === 'missed';
                const optName = opt.key === 'starryOre' || opt.status === 'starryFallback' || (typeof opt.name === 'string' && opt.name.includes('Starry Ore'))
                    ? `${opt.fallbackStarry || 50} ${translate('entities.ores.starry')}`
                    : getTranslatedEquipmentName(opt.name);

                itemsHtml += `
                    <div class="pool-item-row ${isHighlighted ? 'is-awarded' : ''} ${isOwned ? 'is-owned' : ''} ${isEarlier ? 'is-earlier' : ''} ${isMissed ? 'is-missed' : ''}">
                        <orecalc-assets-image src="${opt.icon}" alt="${optName}" class="pool-item-icon"></orecalc-assets-image>
                        <div class="pool-item-info">
                            <span class="pool-item-name">${optName}</span>
                        </div>
                        <span class="pool-status-badge ${badgeClass}">${badgeText}</span>
                    </div>
                `;
            }

            poolListHtml = `
                <div class="popover-equipment-pool">
                    <div class="popover-pool-header">${poolTitle}</div>
                    <div class="popover-pool-list">${itemsHtml}</div>
                </div>
            `;
        }

        let unownedAlertHtml = '';
        if (isUnownedClaimed) {
            const currentItemOpt = resolvedNode.poolOptions?.find(opt => opt.key === resolvedNode.resolvedKey || opt.name === resolvedNode.resolvedName);
            const awardedAtLevel = currentItemOpt?.status === 'nowAwardedAt' ? currentItemOpt.awardedAtLevel : null;
            const desc = awardedAtLevel
                ? translate('views.home.heroJourney.unownedClaimedDescWithLevel', { level: awardedAtLevel })
                : translate('views.home.heroJourney.unownedClaimedDesc');

            unownedAlertHtml = `
                <div class="popover-unowned-alert">
                    <div class="unowned-alert-title">
                        <orecalc-assets-svg name="close" class="unowned-alert-icon" width="14" height="14"></orecalc-assets-svg>
                        <span>${translate('views.home.heroJourney.unownedClaimedTitle')}</span>
                    </div>
                    <p class="unowned-alert-desc">${desc}</p>
                </div>
            `;
        }

        showCardHelpPopover(chip, {
            header: `
                <orecalc-assets-image src="${icon}" alt="${title}" class="popover-img"></orecalc-assets-image>
                <div class="popover-title-group">
                    <span class="popover-title">${title}</span>
                    <span class="popover-badge">${translate('views.home.heroJourney.epicEquipmentBadge')}</span>
                </div>
            `,
            body: `${unownedAlertHtml}<p>${poolIntro}</p>${poolListHtml || ''}`
        });
    } else if (node.type === 'quest') {
        const appState = stateOverride || globalState;
        const targetName = node.equipmentKey
            ? translate(`entities.equipment.${node.equipmentKey}`)
            : (node.hero ? translate(`entities.heroes.${node.hero}`) : translate('views.home.heroJourney.heroFallback'));
        const questTitleText = translate('views.home.heroJourney.questTitleFormat', { name: targetName });
        const bodyIntroText = translate('views.home.heroJourney.questPopoverBody', { target: targetName });

        const nodeTH = getNodeTownHallLevel(node.level);
        const effectiveTH = getEffectiveQuestNodeTH(node, appState);
        const rewardMode = appState?.heroJourney?.acceleratedRewards ? 'accelerated' : 'normal';
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
 * @param {(() => any) | null} [getStateFn] - Optional state getter for standalone views.
 */
export function initHeroJourneyTooltips(getStateFn = null) {
    const trackWrapper = document.querySelector('.hero-journey-track-wrapper');
    if (!trackWrapper || trackWrapper.dataset.tooltipBound) return;
    trackWrapper.dataset.tooltipBound = 'true';

    let activeChip = null;
    let lastScrollLeft = trackWrapper.scrollLeft;

    const resolveCurrentState = () => (typeof getStateFn === 'function' ? getStateFn() : globalState);

    trackWrapper.addEventListener('click', (e) => {
        if (typeof document !== 'undefined' && document.querySelector('.modal.show')) return;

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
                showNodeTooltip(chip, resolveCurrentState());
            }
        }
    });

    trackWrapper.addEventListener('mouseover', (e) => {
        if (e.pointerType === 'touch' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        if (typeof document !== 'undefined' && document.querySelector('.modal.show')) return;

        const chip = e.target.closest('.hero-journey-node-chip');
        if (chip && chip !== activeChip) {
            activeChip = chip;
            showNodeTooltip(chip, resolveCurrentState());
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

/**
 * Initializes delegated click, hover, and scroll threshold handlers on the table container.
 * @param {(() => any) | null} [getStateFn] - Optional state getter for standalone views.
 */
export function initHeroJourneyTableTooltips(getStateFn = null) {
    const tableContainer = document.querySelector('.hero-journey-page__table-container');
    if (!tableContainer || tableContainer.dataset.tooltipBound) return;
    tableContainer.dataset.tooltipBound = 'true';

    let activeBtn = null;
    let lastScrollTop = tableContainer.scrollTop;

    const resolveCurrentState = () => (typeof getStateFn === 'function' ? getStateFn() : globalState);

    tableContainer.addEventListener('click', (e) => {
        if (typeof document !== 'undefined' && document.querySelector('.modal.show')) return;

        const btn = e.target.closest('.hj-table-info-btn');
        if (btn) {
            e.stopPropagation();
            const popover = document.getElementById('card-help-popover');
            const isShowingCurrent = popover && popover.classList.contains('show') && (activeBtn === btn || activeBtn?.dataset?.level === btn.dataset.level);

            if (isShowingCurrent) {
                activeBtn = null;
                hideNodeTooltip();
            } else {
                activeBtn = btn;
                showNodeTooltip(btn, resolveCurrentState());
            }
        }
    });

    tableContainer.addEventListener('mouseover', (e) => {
        if (e.pointerType === 'touch' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        if (typeof document !== 'undefined' && document.querySelector('.modal.show')) return;

        const btn = e.target.closest('.hj-table-info-btn');
        if (btn && btn !== activeBtn) {
            activeBtn = btn;
            showNodeTooltip(btn, resolveCurrentState());
        }
    });

    tableContainer.addEventListener('mouseout', (e) => {
        if (e.pointerType === 'touch' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

        const btn = e.target.closest('.hj-table-info-btn');
        if (btn) {
            const related = e.relatedTarget;
            if (!related || !btn.contains(related)) {
                if (activeBtn === btn) {
                    activeBtn = null;
                    hideNodeTooltip();
                }
            }
        }
    });

    tableContainer.addEventListener('scroll', () => {
        const currentScrollTop = tableContainer.scrollTop;
        if (Math.abs(currentScrollTop - lastScrollTop) > 10) {
            lastScrollTop = currentScrollTop;
            activeBtn = null;
            hideNodeTooltip();
        }
    }, { passive: true });
}
