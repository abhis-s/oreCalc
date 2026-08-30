import { heroJourneyNodes } from '../../data/heroJourneyData.js';
import { translate } from '../../i18n/translator.js';

import { state as globalState } from '../../core/state.js';

import {
    getEffectiveQuestNodeTH,
    getQuestChestReward
} from '../../domain/income/heroJourneyIncome.js';
import {
    getResolvedEquipmentReward,
    resolveHeroJourneyTrack
} from '../../domain/income/heroJourneyResolution.js';
import {
    getMaxCumulativeLevelsByTH,
    getNodeTownHallLevel,
    getTownHallStartLevel,
    hasSyncedHeroInfo,
    isDefaultOrGuestPlayer
} from '../../domain/income/heroJourneyLevels.js';
import { updateCalculatedValue } from '../../utils/numberFormatter.js';
import { getSVG } from '../../utils/svgManager.js';

import {
    createTHBoundaryDivider,
    createTHLimitBlockCard,
    createTHStartDivider
} from './heroJourneyDividersRenderer.js';
import { createNodeChipElement, updateNodeTitleAndSub } from './heroJourneyNodeBuilder.js';
import { getTranslatedEquipmentName } from './heroJourneyPopovers.js';
import { updateHeroJourneyRovingTabindex } from './heroJourneyKeyboardNav.js';

/**
 * Renders individual milestone node chips, Town Hall dividers, and limit cards into the track container.
 * @param {import('../../core/types.js').AppState} state - Current global application state.
 * @param {number} cumulativeLevel - Player's cumulative hero level.
 * @param {number} thLevel - Active Town Hall level.
 */
export function renderNodesTrack(state, cumulativeLevel, thLevel) {
    const track = document.getElementById('home-hj-nodes-track');
    if (!track) return;

    const unclaimedOnly = Boolean(state.heroJourney.unclaimedOnly);
    const typeFilter = state.heroJourney.typeFilter || null;
    const isAccelerated = Boolean(state?.heroJourney?.acceleratedRewards ?? state?.heroJourney?.accelerated ?? (state?.heroJourney?.rewardMode === 'accelerated'));
    /** @type {'accelerated' | 'normal'} */
    const mode = isAccelerated ? 'accelerated' : 'normal';
    const maxLevelsByTH = getMaxCumulativeLevelsByTH();
    const allMaxValues = Object.values(maxLevelsByTH);
    const overallTrueMaxLevel = allMaxValues.length > 0 ? Math.max(...allMaxValues) : 0;
    const isGuest = isDefaultOrGuestPlayer(state);
    const hasSyncedHeroes = hasSyncedHeroInfo(state);
    const isUserSynced = hasSyncedHeroes && !isGuest;
    const isTrueMaxPlayer = isUserSynced && cumulativeLevel >= overallTrueMaxLevel && overallTrueMaxLevel > 0;
    const trackResolution = resolveHeroJourneyTrack(state);

    const filteredNodes = heroJourneyNodes.filter(node => {
        const isReached = isUserSynced && (cumulativeLevel >= node.level);
        const isClaimed = isUserSynced && (isTrueMaxPlayer || isReached);

        if (unclaimedOnly && isClaimed) return false;

        if (typeFilter) {
            if (typeFilter === 'ores' && !(node.type === 'quest' || node.type === 'ore')) return false;
            if (typeFilter === 'equipment' && node.type !== 'equipment') return false;
            if (typeFilter === 'skins' && node.type !== 'skin') return false;
            if (typeFilter === 'items' && !(node.type === 'magicItem' || node.type === 'resource')) return false;
        }

        return true;
    });

    const playerMaxLevel = maxLevelsByTH[thLevel] || Infinity;
    const revealBeyondTH = state?.heroJourney?.revealBeyondTH || false;

    const visibleNodes = revealBeyondTH
        ? filteredNodes
        : filteredNodes.filter(node => node.level <= playerMaxLevel);

    const existingChips = Array.from(track.querySelectorAll('.hero-journey-node-chip'));
    const canUpdateInPlace = existingChips.length > 0 &&
        existingChips.length === visibleNodes.length &&
        existingChips.every((chip, i) => Number(chip.dataset.nodeLevel || chip.dataset.level || 0) === visibleNodes[i].level);

    if (canUpdateInPlace) {
        visibleNodes.forEach((node, index) => {
            const chip = existingChips[index];
            const isReached = isUserSynced && (cumulativeLevel >= node.level);
            const isClaimed = isUserSynced && (isTrueMaxPlayer || isReached);
            const isBeyondTHLimit = node.level > playerMaxLevel;
            const resolvedNode = node.type === 'equipment' ? getResolvedEquipmentReward(node, state, trackResolution) : node;

            chip.classList.toggle('reached', isReached);
            chip.classList.toggle('claimed', isClaimed);
            chip.classList.toggle('beyond-th-limit', isBeyondTHLimit);
            chip.dataset.isClaimed = isClaimed ? 'true' : 'false';

            const levelPill = chip.querySelector('.node-level-pill');
            if (levelPill) {
                levelPill.dataset.i18n = 'views.home.heroJourney.nodeLevel';
                levelPill.dataset.i18nArgs = JSON.stringify({ level: node.level });
                levelPill.textContent = translate('views.home.heroJourney.nodeLevel', { level: node.level });
            }

            const iconWrapper = chip.querySelector('.node-icon-wrapper');

            if (iconWrapper) {
                let check = iconWrapper.querySelector('.node-claimed-checkmark');
                const isUnownedEquipment = node.type === 'equipment' && !resolvedNode.isOwned;

                if (isClaimed) {
                    if (!check) {
                        check = document.createElement('div');
                        iconWrapper.appendChild(check);
                    }
                    check.className = `node-claimed-checkmark ${isUnownedEquipment ? 'unowned-cross' : ''}`;
                    check.innerHTML = isUnownedEquipment ? getSVG('close', '', 12, 12) : getSVG('check-simple', '', 12, 12);
                } else if (check) {
                    check.remove();
                }
            }

            if (node.type === 'quest') {
                const nodeTH = getNodeTownHallLevel(node.level);
                const effectiveTH = getEffectiveQuestNodeTH(node, state || globalState);
                const chest = getQuestChestReward(effectiveTH, mode);

                let boostIcon = '';
                if (mode === 'accelerated') {
                    boostIcon = getSVG('chevron-double-up', 'ore-accel-arrow-icon', 13, 13);
                } else if (effectiveTH > nodeTH) {
                    boostIcon = getSVG('chevron-up', 'ore-th-boost-icon', 13, 13);
                }

                const boostSlots = chip.querySelectorAll('.ore-boost-icon-slot');
                boostSlots.forEach(slot => {
                    if (slot.innerHTML !== boostIcon) {
                        slot.innerHTML = boostIcon;
                    }
                });

                const shinyValEl = chip.querySelector('.node-sub-ore-val[data-ore="shiny"]');
                const glowyValEl = chip.querySelector('.node-sub-ore-val[data-ore="glowy"]');
                const starryValEl = chip.querySelector('.node-sub-ore-val[data-ore="starry"]');

                if (shinyValEl) updateCalculatedValue(shinyValEl, chest.shiny);
                if (glowyValEl) updateCalculatedValue(glowyValEl, chest.glowy);
                if (starryValEl) updateCalculatedValue(starryValEl, chest.starry);
            } else if (node.type === 'equipment') {
                const isFallbackStarry = Boolean(resolvedNode.isFallbackStarry);
                const isOwnedEq = isUserSynced && Boolean(resolvedNode.isOwned);
                const showOwnedPill = !isFallbackStarry && isOwnedEq && !isClaimed;
                const displayIcon = resolvedNode.resolvedIcon || resolvedNode.bestGuess?.icon || '';
                const eqName = resolvedNode.resolvedName || resolvedNode.bestGuess?.name || '';
                const primaryImg = iconWrapper.querySelector('.node-icon');
                if (primaryImg) {
                    primaryImg.setAttribute('src', displayIcon);
                    primaryImg.setAttribute('alt', eqName);
                    primaryImg.className = 'node-icon node-icon-primary';
                }

                let companionStrip = chip.querySelector('.node-companion-strip');
                const shouldShowCompanionStrip = Boolean(resolvedNode.poolOptions && resolvedNode.poolOptions.length > 0);
                if (shouldShowCompanionStrip) {
                    if (!companionStrip) {
                        companionStrip = document.createElement('div');
                        companionStrip.className = 'node-companion-strip';
                        const subElem = chip.querySelector('.node-sub');
                        if (subElem && typeof chip.insertBefore === 'function') {
                            chip.insertBefore(companionStrip, subElem);
                        } else {
                            chip.appendChild(companionStrip);
                        }
                    }
                    companionStrip.innerHTML = '';
                    const companions = resolvedNode.poolOptions.filter(opt => opt.status !== 'awardedHere');
                    for (const comp of companions) {
                        const compItem = document.createElement('div');
                        const statusCls = comp.status === 'owned'
                            ? 'status-owned'
                            : (comp.status === 'awardedEarlier'
                                ? 'status-awarded-earlier'
                                : (comp.status === 'starryFallback' ? 'status-starry-fallback' : 'status-queued'));
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
                } else if (companionStrip) {
                    companionStrip.remove();
                }

                let eqPill = iconWrapper.querySelector('.equipment-level-pill');
                if (isFallbackStarry) {
                    if (eqPill) {
                        eqPill.remove();
                    }
                } else if (showOwnedPill) {
                    if (!eqPill) {
                        eqPill = document.createElement('div');
                        iconWrapper.appendChild(eqPill);
                    }
                    eqPill.className = 'equipment-level-pill owned-pill';
                    eqPill.dataset.i18n = 'views.home.heroJourney.owned';
                    eqPill.textContent = translate('views.home.heroJourney.owned');
                } else if (resolvedNode.equipmentLevel) {
                    if (!eqPill) {
                        eqPill = document.createElement('div');
                        iconWrapper.appendChild(eqPill);
                    }
                    eqPill.className = 'equipment-level-pill';
                    delete eqPill.dataset.i18n;
                    eqPill.textContent = `${resolvedNode.equipmentLevel}`;
                } else if (eqPill) {
                    eqPill.remove();
                }
            }

            const titleElem = chip.querySelector('.node-title');
            const subElem = chip.querySelector('.node-sub');
            const hasSub = updateNodeTitleAndSub(titleElem, subElem, node, resolvedNode, isClaimed, state, mode);
            chip.classList.toggle('has-sub', hasSub);
        });

        const startDivider = track.querySelector('.th-start-initial-divider');
        if (startDivider && visibleNodes.length > 0) {
            const firstNode = visibleNodes[0];
            const startTH = getNodeTownHallLevel(firstNode.level);
            const startLvl = getTownHallStartLevel(startTH);

            startDivider.classList.toggle('current-th-divider', startTH === thLevel);
            startDivider.dataset.th = String(startTH);
            startDivider.dataset.startLvl = String(startLvl);
            const tagEl = startDivider.querySelector('.th-max-tag');
            const lvlEl = startDivider.querySelector('.th-max-lvl');
            if (tagEl) {
                tagEl.dataset.i18n = 'views.home.heroJourney.thStartTag';
                tagEl.dataset.i18nArgs = JSON.stringify({ th: startTH });
                tagEl.textContent = translate('views.home.heroJourney.thStartTag', { th: startTH });
            }
            if (lvlEl) {
                lvlEl.dataset.i18n = 'views.home.heroJourney.thStartLvl';
                lvlEl.dataset.i18nArgs = JSON.stringify({ lvl: startLvl });
                lvlEl.textContent = translate('views.home.heroJourney.thStartLvl', { lvl: startLvl });
            }
        }

        const boundaryDividers = Array.from(track.querySelectorAll('.th-max-divider:not(.th-start-initial-divider)'));
        boundaryDividers.forEach(div => {
            const tagEl = div.querySelector('.th-max-tag');
            const lvlEl = div.querySelector('.th-max-lvl');
            const th = div.dataset.th ? Number(div.dataset.th) : null;
            const startLvl = div.dataset.startLvl ? Number(div.dataset.startLvl) : null;
            if (tagEl && th) {
                tagEl.dataset.i18n = 'views.home.heroJourney.thStartTag';
                tagEl.dataset.i18nArgs = JSON.stringify({ th });
                tagEl.textContent = translate('views.home.heroJourney.thStartTag', { th });
            }
            if (lvlEl && startLvl) {
                lvlEl.dataset.i18n = 'views.home.heroJourney.thStartLvl';
                lvlEl.dataset.i18nArgs = JSON.stringify({ lvl: startLvl });
                lvlEl.textContent = translate('views.home.heroJourney.thStartLvl', { lvl: startLvl });
            }
        });

        const isTrueMax = isTrueMaxPlayer || (isGuest && thLevel >= 18);
        const hasNodesBeyond = filteredNodes.some(node => node.level > playerMaxLevel);
        const shouldHaveBlockCard = isTrueMax || hasNodesBeyond;
        const existingBlockCard = track.querySelector('.th-limit-block-card');

        if (!shouldHaveBlockCard) {
            if (existingBlockCard) {
                if (typeof existingBlockCard.remove === 'function') {
                    existingBlockCard.remove();
                } else if (existingBlockCard.parentNode && typeof existingBlockCard.parentNode.removeChild === 'function') {
                    existingBlockCard.parentNode.removeChild(existingBlockCard);
                }
            }
        } else {
            const nextTH = Math.min(18, thLevel + 1);
            const nextTHStartLvl = playerMaxLevel + 1;
            const newBlockCard = createTHLimitBlockCard({
                isTrueMax,
                isGuest,
                thLevel,
                revealBeyondTH,
                nextTH,
                nextTHStartLvl
            });

            if (existingBlockCard) {
                if (typeof existingBlockCard.replaceWith === 'function') {
                    existingBlockCard.replaceWith(newBlockCard);
                } else if (existingBlockCard.parentNode && typeof existingBlockCard.parentNode.replaceChild === 'function') {
                    existingBlockCard.parentNode.replaceChild(newBlockCard, existingBlockCard);
                } else {
                    if (typeof existingBlockCard.remove === 'function') existingBlockCard.remove();
                    track.appendChild(newBlockCard);
                }
            } else {
                track.appendChild(newBlockCard);
            }
        }

        updateHeroJourneyRovingTabindex(track, cumulativeLevel);
        return;
    }

    track.innerHTML = '';

    if (visibleNodes.length === 0) {
        const emptyCard = document.createElement('div');
        emptyCard.className = 'hero-journey-empty-filter-card';
        emptyCard.innerHTML = `
            <orecalc-assets-svg name="sliders" class="empty-filter-icon"></orecalc-assets-svg>
            <div class="empty-filter-title">${translate('views.home.heroJourney.emptyFilterTitle')}</div>
            <div class="empty-filter-desc">${translate('views.home.heroJourney.emptyFilterDesc')}</div>
            <button class="th-limit-reveal-btn hero-journey-empty-filter-btn" id="home-hj-reset-filters-btn">${translate('views.home.heroJourney.clearFilter')}</button>
        `;
        track.appendChild(emptyCard);
        return;
    }

    const nodeContext = {
        state,
        cumulativeLevel,
        playerMaxLevel,
        isUserSynced,
        isTrueMaxPlayer,
        isGuest,
        mode,
        trackResolution
    };

    visibleNodes.forEach((node, index) => {
        const nodeTH = getNodeTownHallLevel(node.level);
        if (index === 0) {
            const startLvl = getTownHallStartLevel(nodeTH);
            const isCurrentTHDivider = (nodeTH === thLevel);
            const startDivider = createTHStartDivider(nodeTH, startLvl, isCurrentTHDivider);
            track.appendChild(startDivider);
        } else {
            const prevNodeTH = getNodeTownHallLevel(visibleNodes[index - 1].level);
            if (nodeTH > prevNodeTH) {
                const startLvl = getTownHallStartLevel(nodeTH);
                const isCurrentTHDivider = (nodeTH === thLevel);
                const divider = createTHBoundaryDivider(nodeTH, startLvl, isCurrentTHDivider);
                track.appendChild(divider);
            }
        }

        const chip = createNodeChipElement(node, nodeContext);
        track.appendChild(chip);
    });

    const isTrueMax = isTrueMaxPlayer || (isGuest && thLevel >= 18);
    const hasNodesBeyond = filteredNodes.some(node => node.level > playerMaxLevel);

    if (isTrueMax || hasNodesBeyond) {
        const nextTH = Math.min(18, thLevel + 1);
        const nextTHStartLvl = playerMaxLevel + 1;

        const blockCard = createTHLimitBlockCard({
            isTrueMax,
            isGuest,
            thLevel,
            revealBeyondTH,
            nextTH,
            nextTHStartLvl
        });
        track.appendChild(blockCard);
    }

    updateHeroJourneyRovingTabindex(track, cumulativeLevel);
}
