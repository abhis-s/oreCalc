import { translate } from '../../i18n/translator.js';

import { state as globalState } from '../../core/state.js';

import {
    getEffectiveQuestNodeTH,
    getQuestChestReward
} from '../../domain/income/heroJourneyIncome.js';
import { getResolvedEquipmentReward } from '../../domain/income/heroJourneyResolution.js';
import { getNodeTownHallLevel } from '../../domain/income/heroJourneyLevels.js';
import { formatNumber } from '../../utils/numberFormatter.js';
import { getSVG } from '../../utils/svgManager.js';

import { getResourceKey, getTranslatedEquipmentName } from './heroJourneyPopovers.js';

/**
 * Builds a single milestone node chip DOM element for the Hero Journey track.
 * @param {Object} node
 * @param {Object} ctx
 * @param {import('../../core/types.js').AppState} ctx.state
 * @param {number} ctx.cumulativeLevel
 * @param {number} ctx.playerMaxLevel
 * @param {boolean} ctx.isUserSynced
 * @param {boolean} ctx.isTrueMaxPlayer
 * @param {boolean} ctx.isGuest
 * @param {'accelerated' | 'normal'} ctx.mode
 * @param {Record<number, any>} [ctx.trackResolution]
 * @returns {HTMLDivElement}
 */
export function createNodeChipElement(node, ctx) {
    const {
        state,
        cumulativeLevel,
        playerMaxLevel,
        isUserSynced,
        isTrueMaxPlayer,
        isGuest,
        mode,
        trackResolution
    } = ctx;

    const isReached = isUserSynced && (cumulativeLevel >= node.level);
    const isClaimed = isUserSynced && (isTrueMaxPlayer || isReached);
    const isBeyondTHLimit = node.level > playerMaxLevel;

    const resolvedNode = node.type === 'equipment'
        ? getResolvedEquipmentReward(node, state, trackResolution)
        : node;
    let displayIcon = resolvedNode.resolvedIcon || node.icon;
    let badgeIcon = null;

    if (node.type === 'quest') {
        displayIcon = 'assets/heroJourney/chest_ore.png';
        badgeIcon = node.icon;
    } else if (node.type === 'equipment') {
        displayIcon = resolvedNode.resolvedIcon || node.icon;
    }

    const chip = document.createElement('div');
    chip.className = `hero-journey-node-chip ${isReached ? 'reached' : ''} ${isClaimed ? 'claimed' : ''} ${isBeyondTHLimit ? 'beyond-th-limit' : ''}`;
    chip.dataset.nodeLevel = String(node.level);
    chip.dataset.level = String(node.level);
    chip.dataset.isClaimed = isClaimed ? 'true' : 'false';
    chip.setAttribute('role', 'button');
    chip.setAttribute('tabindex', '-1');

    const levelPill = document.createElement('div');
    levelPill.className = 'node-level-pill';
    levelPill.dataset.i18n = 'views.home.heroJourney.nodeLevel';
    levelPill.dataset.i18nArgs = JSON.stringify({ level: node.level });
    levelPill.textContent = translate('views.home.heroJourney.nodeLevel', { level: node.level });

    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'node-icon-wrapper';

    let nodeAltText = '';
    if (node.type === 'quest') {
        const questTargetName = node.equipmentKey
            ? translate(`entities.equipment.${node.equipmentKey}`)
            : (node.hero ? translate(`entities.heroes.${node.hero}`) : translate('views.home.heroJourney.heroFallback'));
        nodeAltText = translate('views.home.heroJourney.questTitleFormat', { name: questTargetName });
    } else if (node.type === 'equipment') {
        nodeAltText = resolvedNode.isFallbackStarry
            ? `${resolvedNode.fallbackStarry || 50} ${translate('entities.ores.starry')}`
            : getTranslatedEquipmentName(resolvedNode.resolvedKey || resolvedNode.resolvedName);
    } else if (node.type === 'magicItem') {
        const itemKey = node.itemKey;
        nodeAltText = translate(`entities.magicItems.${itemKey}`);
    } else if (node.type === 'skin') {
        const skinKey = node.skinKey;
        nodeAltText = translate(`entities.skins.${skinKey}`);
    } else if (node.type === 'resource') {
        nodeAltText = translate(`entities.resources.${getResourceKey(node.resourceType)}`);
    } else if (node.type === 'ore') {
        nodeAltText = translate(`entities.ores.${node.resourceType}`);
    }

    const levelLabel = translate('views.home.heroJourney.nodeLevel', { level: node.level });
    const statusLabel = isClaimed ? ` (${translate('views.home.heroJourney.poolOwned')})` : '';
    chip.setAttribute('aria-label', `${levelLabel}: ${nodeAltText}${statusLabel}`);

    const isEquipment = node.type === 'equipment';
    const mainImg = document.createElement('orecalc-assets-image');
    mainImg.setAttribute('src', displayIcon);
    mainImg.setAttribute('alt', nodeAltText);
    mainImg.className = isEquipment ? 'node-icon node-icon-primary' : 'node-icon';
    iconWrapper.appendChild(mainImg);

    let companionStrip = null;
    if (isEquipment && resolvedNode.poolOptions && resolvedNode.poolOptions.length > 0) {
        companionStrip = document.createElement('div');
        companionStrip.className = 'node-companion-strip';

        // Companion preview items for other equipment in pool
        const companions = resolvedNode.poolOptions.filter(opt => opt.status !== 'awardedHere');
        for (const comp of companions) {
            const compItem = document.createElement('div');
            const statusCls = comp.status === 'owned'
                ? 'status-owned'
                : (comp.status === 'awardedEarlier'
                    ? 'status-awarded-earlier'
                    : (comp.status === 'missed'
                        ? 'status-missed'
                        : (comp.status === 'starryFallback' ? 'status-starry-fallback' : 'status-queued')));
            const compTitle = getTranslatedEquipmentName(comp.name);
            compItem.className = `node-companion-item ${statusCls}`;
            compItem.title = compTitle;

            const compImg = document.createElement('orecalc-assets-image');
            compImg.setAttribute('src', comp.icon);
            compImg.setAttribute('alt', compTitle);
            compImg.className = 'node-companion-icon';
            compItem.appendChild(compImg);
            companionStrip.appendChild(compItem);
        }
    }

    if (badgeIcon) {
        const questBadge = document.createElement('div');
        questBadge.className = 'node-quest-badge';

        const badgeImg = document.createElement('orecalc-assets-image');
        badgeImg.setAttribute('src', badgeIcon);
        badgeImg.setAttribute('alt', translate('views.home.heroJourney.questBadgeAlt'));
        badgeImg.dataset.i18nAlt = 'views.home.heroJourney.questBadgeAlt';
        badgeImg.className = 'quest-badge-img';

        questBadge.appendChild(badgeImg);
        iconWrapper.appendChild(questBadge);
    }

    if (node.type === 'equipment' && !resolvedNode.isFallbackStarry) {
        const isOwnedEq = isUserSynced && Boolean(resolvedNode.isOwned);
        const showOwnedPill = isOwnedEq && !isClaimed;

        if (showOwnedPill) {
            const eqPill = document.createElement('div');
            eqPill.className = 'equipment-level-pill owned-pill';
            eqPill.dataset.i18n = 'views.home.heroJourney.owned';
            eqPill.textContent = translate('views.home.heroJourney.owned');
            iconWrapper.appendChild(eqPill);
        } else if (resolvedNode.equipmentLevel) {
            const eqPill = document.createElement('div');
            eqPill.className = 'equipment-level-pill';
            eqPill.textContent = `${resolvedNode.equipmentLevel}`;
            iconWrapper.appendChild(eqPill);
        }
    }

    if (isClaimed) {
        const check = document.createElement('div');
        const isUnownedEquipment = node.type === 'equipment' && !resolvedNode.isOwned;
        check.className = `node-claimed-checkmark ${isUnownedEquipment ? 'unowned-cross' : ''}`;
        check.innerHTML = isUnownedEquipment ? getSVG('close', '', 12, 12) : getSVG('check-simple', '', 12, 12);
        iconWrapper.appendChild(check);
    }

    const titleElem = document.createElement('div');
    titleElem.className = 'node-title';

    const subElem = document.createElement('div');
    subElem.className = 'node-sub';

    const hasSub = updateNodeTitleAndSub(titleElem, subElem, node, resolvedNode, isClaimed, state, mode);

    chip.appendChild(levelPill);
    chip.appendChild(iconWrapper);
    chip.appendChild(titleElem);
    if (companionStrip) {
        chip.appendChild(companionStrip);
    }
    if (hasSub) {
        chip.classList.add('has-sub');
        chip.appendChild(subElem);
    }

    return chip;
}

/**
 * Updates title and subtitle DOM elements of a Hero Journey milestone chip with localized translations.
 *
 * @param {Element | null} titleElem
 * @param {Element | null} subElem
 * @param {Object} node
 * @param {Object} resolvedNode
 * @param {boolean} isClaimed
 * @param {import('../../core/types.js').AppState} state
 * @param {'accelerated' | 'normal'} mode
 * @returns {boolean} Whether subElem has content.
 */
export function updateNodeTitleAndSub(titleElem, subElem, node, resolvedNode, isClaimed, state, mode) {
    if (!titleElem) return false;
    let hasSub = false;

    if (node.type === 'quest') {
        const questTargetName = node.equipmentKey
            ? translate(`entities.equipment.${node.equipmentKey}`)
            : (node.hero ? translate(`entities.heroes.${node.hero}`) : translate('views.home.heroJourney.heroFallback'));
        const questTitleText = translate('views.home.heroJourney.questTitleFormat', { name: questTargetName });

        titleElem.innerHTML = `<strong>${questTitleText}</strong>`;
        if (subElem) {
            const hasOreItems = typeof subElem.classList?.contains === 'function'
                ? subElem.classList.contains('node-sub-ores') && (subElem.children?.length > 0 || subElem.innerHTML?.length > 0)
                : Boolean(subElem.innerHTML);

            if (!hasOreItems) {
                const nodeTH = getNodeTownHallLevel(node.level);
                const effectiveTH = getEffectiveQuestNodeTH(node, state || globalState);
                const chest = getQuestChestReward(effectiveTH, mode);

                let boostIcon = '';
                if (mode === 'accelerated') {
                    boostIcon = getSVG('chevron-double-up', 'ore-accel-arrow-icon', 13, 13);
                } else if (effectiveTH > nodeTH) {
                    boostIcon = getSVG('chevron-up', 'ore-th-boost-icon', 13, 13);
                }

                const shinyImg = `<orecalc-assets-image src="assets/shiny_ore.png" alt="${translate('entities.ores.shiny')}" class="sub-ore-icon"></orecalc-assets-image>`;
                const glowyImg = `<orecalc-assets-image src="assets/glowy_ore.png" alt="${translate('entities.ores.glowy')}" class="sub-ore-icon"></orecalc-assets-image>`;
                const starryImg = `<orecalc-assets-image src="assets/starry_ore.png" alt="${translate('entities.ores.starry')}" class="sub-ore-icon"></orecalc-assets-image>`;

                subElem.className = 'node-sub node-sub-ores';
                subElem.innerHTML =
                    `<span class="node-sub-ore-item" data-ore="shiny">` +
                        `<span class="ore-boost-icon-slot">${boostIcon}</span>` +
                        `<span class="node-sub-ore-val" data-ore="shiny">${formatNumber(chest.shiny)}</span>` +
                        `${shinyImg}` +
                    `</span>` +
                    `<span class="node-sub-ore-item" data-ore="glowy">` +
                        `<span class="ore-boost-icon-slot">${boostIcon}</span>` +
                        `<span class="node-sub-ore-val" data-ore="glowy">${formatNumber(chest.glowy)}</span>` +
                        `${glowyImg}` +
                    `</span>` +
                    `<span class="node-sub-ore-item" data-ore="starry">` +
                        `<span class="ore-boost-icon-slot">${boostIcon}</span>` +
                        `<span class="node-sub-ore-val" data-ore="starry">${formatNumber(chest.starry)}</span>` +
                        `${starryImg}` +
                    `</span>`;
            }
            hasSub = true;
        }
    } else if (node.type === 'equipment') {
        const fallbackAmount = resolvedNode.fallbackStarry || node.fallbackStarry || 50;
        const translatedEqTitle = resolvedNode.isFallbackStarry
            ? `${fallbackAmount} ${translate('entities.ores.starry') || 'Starry Ore'}`
            : getTranslatedEquipmentName(resolvedNode.resolvedKey || resolvedNode.resolvedName);
        titleElem.innerHTML = `<strong>${translatedEqTitle}</strong>`;
        if (subElem) {
            subElem.innerHTML = '';
        }
    } else if (node.type === 'resource' || node.type === 'ore' || node.type === 'gems') {
        let nameText = '';
        if (node.type === 'ore' && node.resourceType) {
            nameText = translate(`entities.ores.${node.resourceType}`);
        } else if (node.type === 'resource' && node.resourceType) {
            nameText = translate(`entities.resources.${getResourceKey(node.resourceType)}`);
        }
        titleElem.innerHTML = `<strong>${formatNumber(node.amount)} ${nameText}</strong>`;
        if (subElem) {
            subElem.innerHTML = '';
        }
    } else if (node.type === 'magicItem') {
        const itemKey = node.itemKey;
        const itemNameText = translate(`entities.magicItems.${itemKey}`);
        titleElem.innerHTML = `<strong>${node.amount}x ${itemNameText}</strong>`;
        if (subElem) {
            subElem.innerHTML = '';
        }
    } else if (node.type === 'skin') {
        const skinKey = node.skinKey;
        const skinNameText = translate(`entities.skins.${skinKey}`);
        const skinWords = skinNameText.split(' ');
        const formattedTitle = skinWords.length > 1
            ? `<span class="accent-text">${skinWords[0]}</span> ${skinWords.slice(1).join(' ')}`
            : skinNameText;
        titleElem.innerHTML = `<strong>${formattedTitle}</strong>`;
        if (subElem) {
            subElem.innerHTML = '';
        }
    }

    return hasSub;
}
