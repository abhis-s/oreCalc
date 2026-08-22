import { heroJourneyNodes } from '../../data/heroJourneyData.js';
import { translate } from '../../i18n/translator.js';

import { state as globalState } from '../../core/state.js';

import {
    getEffectiveQuestNodeTH,
    getQuestChestReward,
    getResolvedEquipmentReward
} from '../../domain/income/heroJourneyIncome.js';
import {
    getMaxCumulativeLevelsByTH,
    getNodeTownHallLevel,
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
    const overrideUnclaimedSet = new Set(state.heroJourney.overrideUnclaimed || []);
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

    const filteredNodes = heroJourneyNodes.filter(node => {
        const isReached = isUserSynced && (cumulativeLevel >= node.level);
        const isClaimed = isUserSynced && (isTrueMaxPlayer || (isReached && !overrideUnclaimedSet.has(node.level)));

        if (unclaimedOnly && isClaimed) return false;

        if (typeFilter) {
            if (typeFilter === 'ores' && !(node.type === 'quest' || node.type === 'ore')) return false;
            if (typeFilter === 'equipment' && node.type !== 'equipment') return false;
            if (typeFilter === 'skins' && node.type !== 'skin') return false;
            if (typeFilter === 'items' && !(node.type === 'magicItem' || node.type === 'resource')) return false;
        }

        return true;
    });

    const nodeTHBoundaries = new Map();
    const thKeys = Object.keys(maxLevelsByTH).map(Number).sort((a, b) => a - b);
    const maxTHInKeys = thKeys.length > 0 ? (thKeys.at(-1) ?? 18) : 18;

    for (const th of thKeys) {
        if (th >= maxTHInKeys) continue;
        const maxLvl = maxLevelsByTH[th];
        if (maxLvl <= 0) continue;

        let lastEligibleNode = null;
        for (const node of filteredNodes) {
            if (node.level <= maxLvl) {
                lastEligibleNode = node;
            } else {
                break;
            }
        }
        if (lastEligibleNode) {
            const nextTH = th + 1;
            const startLvl = maxLvl + 1;
            if (!nodeTHBoundaries.has(lastEligibleNode.level)) {
                nodeTHBoundaries.set(lastEligibleNode.level, []);
            }
            nodeTHBoundaries.get(lastEligibleNode.level).push({ prevTH: th, nextTH, maxLvl, startLvl });
        }
    }

    const playerMaxLevel = maxLevelsByTH[thLevel] || Infinity;
    const revealBeyondTH = state?.heroJourney?.revealBeyondTH || false;

    const visibleNodes = revealBeyondTH
        ? filteredNodes
        : filteredNodes.filter(node => node.level <= playerMaxLevel);

    const existingChips = Array.from(track.querySelectorAll('.hero-journey-node-chip'));
    const canUpdateInPlace = existingChips.length > 0 &&
        existingChips.length === visibleNodes.length &&
        existingChips.every((chip, i) => parseInt(chip.dataset.nodeLevel || chip.dataset.level || '', 10) === visibleNodes[i].level);

    if (canUpdateInPlace) {
        visibleNodes.forEach((node, index) => {
            const chip = existingChips[index];
            const isReached = isUserSynced && (cumulativeLevel >= node.level);
            const isClaimed = isUserSynced && (isTrueMaxPlayer || (isReached && !overrideUnclaimedSet.has(node.level)));
            const isBeyondTHLimit = node.level > playerMaxLevel;

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
            const resolvedNode = node.type === 'equipment' ? getResolvedEquipmentReward(node, state) : node;

            if (iconWrapper) {
                let check = iconWrapper.querySelector('.node-claimed-checkmark');
                const isUnownedEquipment = node.type === 'equipment' && !resolvedNode.isOwned;

                if (isClaimed) {
                    if (!check) {
                        check = document.createElement('div');
                        check.textContent = '✓';
                        iconWrapper.appendChild(check);
                    }
                    check.className = `node-claimed-checkmark ${isUnownedEquipment ? 'unowned-check' : ''}`;
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
                const isOwnedEq = isUserSynced && Boolean(resolvedNode.isOwned || resolvedNode.isFallbackStarry);
                const showOwnedPill = isOwnedEq && !isClaimed;
                if (iconWrapper) {
                    let eqPill = iconWrapper.querySelector('.equipment-level-pill');
                    if (showOwnedPill) {
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
            }

            const titleElem = chip.querySelector('.node-title');
            const subElem = chip.querySelector('.node-sub');
            const hasSub = updateNodeTitleAndSub(titleElem, subElem, node, resolvedNode, isClaimed, state, mode);
            chip.classList.toggle('has-sub', hasSub);

            const isAllowedTypeToUnclaim = ['quest', 'ore', 'equipment'].includes(node.type);
            const isMoreThan10Behind = cumulativeLevel - node.level > 10;
            const isLockedFromUnclaim = isClaimed && (!isAllowedTypeToUnclaim || isMoreThan10Behind);
            let actionBtn = chip.querySelector('.node-claim-btn');

            if (isTrueMaxPlayer || isGuest) {
                if (actionBtn) {
                    actionBtn.remove();
                }
            } else {
                if (!actionBtn) {
                    actionBtn = document.createElement('button');
                    actionBtn.dataset.nodeLevel = String(node.level);
                    chip.appendChild(actionBtn);
                }
                actionBtn.className = `node-claim-btn ${isClaimed ? 'btn-claimed' : (isReached ? 'btn-unclaimed' : 'btn-upcoming')} ${isLockedFromUnclaim ? 'disabled-unclaim' : ''}`;

                if (!isReached) {
                    const levelsNeeded = node.level - cumulativeLevel;
                    if (levelsNeeded <= 25 && !isBeyondTHLimit) {
                        actionBtn.textContent = translate('views.home.heroJourney.upcomingWithLevels', { levels: levelsNeeded });
                    } else {
                        actionBtn.textContent = translate('views.home.heroJourney.upcoming');
                    }
                    actionBtn.disabled = true;
                    actionBtn.title = levelsNeeded === 1
                        ? translate('views.home.heroJourney.upcomingTooltipSingle', { level: node.level, levels: levelsNeeded })
                        : translate('views.home.heroJourney.upcomingTooltipPlural', { level: node.level, levels: levelsNeeded });
                } else if (isClaimed) {
                    actionBtn.disabled = false;
                    if (isLockedFromUnclaim) {
                        actionBtn.textContent = translate('views.home.heroJourney.claimed');
                        actionBtn.title = !isAllowedTypeToUnclaim
                            ? translate('views.home.heroJourney.cannotUndoTypeTooltip')
                            : translate('views.home.heroJourney.cannotUndoBehindTooltip');
                    } else {
                        actionBtn.innerHTML = `<span class="btn-text-default">${translate('views.home.heroJourney.claimed')}</span><span class="btn-text-hover">${translate('views.home.heroJourney.undoClaim')}</span>`;
                        actionBtn.title = translate('views.home.heroJourney.undoClaimTooltip');
                    }
                } else {
                    actionBtn.disabled = false;
                    actionBtn.textContent = translate('views.home.heroJourney.claim');
                    actionBtn.title = translate('views.home.heroJourney.claimTooltip');
                }
            }
        });

        const startDivider = track.querySelector('.th-start-initial-divider');
        if (startDivider && thKeys.length > 0 && visibleNodes.length > 0) {
            let startTH = thKeys[0] || 7;
            let startLvl = 1;
            const firstNode = visibleNodes[0];
            for (let i = 0; i < thKeys.length; i++) {
                const th = thKeys[i];
                const maxLvl = maxLevelsByTH[th];
                const prevMaxLvl = i > 0 ? maxLevelsByTH[thKeys[i - 1]] : 0;

                if (firstNode.level > prevMaxLvl && firstNode.level <= maxLvl) {
                    startTH = th;
                    startLvl = prevMaxLvl + 1;
                    break;
                } else if (firstNode.level > maxLvl && i === thKeys.length - 1) {
                    startTH = th;
                    startLvl = prevMaxLvl + 1;
                }
            }
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
            const th = div.dataset.th ? parseInt(div.dataset.th, 10) : null;
            const startLvl = div.dataset.startLvl ? parseInt(div.dataset.startLvl, 10) : null;
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
        overrideUnclaimedSet,
        mode
    };

    visibleNodes.forEach((node, index) => {
        if (index === 0 && thKeys.length > 0) {
            let startTH = thKeys[0] || 7;
            let startLvl = 1;

            for (let i = 0; i < thKeys.length; i++) {
                const th = thKeys[i];
                const maxLvl = maxLevelsByTH[th];
                const prevMaxLvl = i > 0 ? maxLevelsByTH[thKeys[i - 1]] : 0;

                if (node.level > prevMaxLvl && node.level <= maxLvl) {
                    startTH = th;
                    startLvl = prevMaxLvl + 1;
                    break;
                } else if (node.level > maxLvl && i === thKeys.length - 1) {
                    startTH = th;
                    startLvl = prevMaxLvl + 1;
                }
            }

            const isCurrentTHDivider = (startTH === thLevel);
            const startDivider = createTHStartDivider(startTH, startLvl, isCurrentTHDivider);
            track.appendChild(startDivider);
        }

        const chip = createNodeChipElement(node, nodeContext);
        track.appendChild(chip);

        if (nodeTHBoundaries.has(node.level)) {
            const thList = nodeTHBoundaries.get(node.level);
            const isCurrentTHDivider = thList.some(item => item.prevTH === thLevel);
            const highestNextTHInGroup = thList.at(-1)?.nextTH ?? 16;
            const startLvlVal = thList.at(-1)?.startLvl ?? 1;

            const divider = createTHBoundaryDivider(highestNextTHInGroup, startLvlVal, isCurrentTHDivider);
            track.appendChild(divider);
        }
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
}
