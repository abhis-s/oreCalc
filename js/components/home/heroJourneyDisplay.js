import { heroJourneyNodes } from '../../data/heroJourneyData.js';
import { getCumulativeHeroLevel, getTownHallLevel, getQuestChestReward, calculateHeroJourneyUpcomingOres, getResolvedEquipmentReward, getMaxCumulativeLevelsByTH, cleanupHeroJourneyOverrides } from '../../incomeCalculations/heroJourneyIncome.js';
import { formatNumber } from '../../utils/numberFormatter.js';
import { getSVG } from '../../utils/svgManager.js';
import { showCardHelpPopover, hideCardHelpPopover } from '../../utils/cardHelpPopover.js';
import { state as globalState } from '../../core/state.js';
import { translate } from '../../i18n/translator.js';

function getResourceKey(type) {
    if (type === 'darkElixir') return 'darkElixir';
    if (type === 'elixir') return 'elixir';
    return type;
}

function getEquipmentKey(name) {
    if (!name) return '';
    const camel = name
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .split(/\s+/)
        .map((word, index) => index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
    return camel;
}

function getTranslatedEquipmentName(name) {
    if (!name) return '';
    const key = getEquipmentKey(name);
    const eqTranslation = translate(`equipment.${key}`);
    if (eqTranslation && eqTranslation !== `equipment.${key}`) return eqTranslation;
    const heroTranslation = translate(`heroes.${key}`);
    if (heroTranslation && heroTranslation !== `heroes.${key}`) return heroTranslation;
    return name;
}

/**
 * Renders the Hero's Journey summary card and milestone nodes.
 */
export function renderHeroJourneyDisplay(state, { skipAutoScroll = false } = {}) {
    const container = document.getElementById('home-hj-card');
    if (!container) return;

    if (!state.heroJourney) {
        state.heroJourney = {
            overrideUnclaimed: [],
            acceleratedRewards: false,
            claimFilter: 'all',
            typeFilter: null
        };
    }
    cleanupHeroJourneyOverrides(state);
    if (!state.heroJourney.claimFilter) state.heroJourney.claimFilter = 'all';
    if (state.heroJourney.typeFilter === undefined) state.heroJourney.typeFilter = null;

    const isAccelerated = Boolean(state?.heroJourney?.acceleratedRewards ?? state?.heroJourney?.accelerated ?? (state?.heroJourney?.rewardMode === 'accelerated'));

    const cumulativeLevel = getCumulativeHeroLevel(state);
    const thLevel = getTownHallLevel(state);
    const maxLevelsByTH = getMaxCumulativeLevelsByTH();
    const thMaxLevel = maxLevelsByTH[thLevel] || 0;
    const allMaxValues = Object.values(maxLevelsByTH);
    const overallTrueMaxLevel = allMaxValues.length > 0 ? Math.max(...allMaxValues) : 0;

    const isTrueMaxPlayer = cumulativeLevel >= overallTrueMaxLevel && overallTrueMaxLevel > 0;

    // Update cumulative level badge (n/overall true max level)
    const cumulativeBadge = document.getElementById('home-hj-cumulative-badge');
    if (cumulativeBadge) {
        cumulativeBadge.textContent = overallTrueMaxLevel > 0 ? `${cumulativeLevel}/${overallTrueMaxLevel}` : `${cumulativeLevel}`;
        cumulativeBadge.classList.toggle('badge-true-max', isTrueMaxPlayer);
    }

    // Update Split Title Elements (< 780px)
    const titleEl = document.getElementById('home-hj-title');
    const titleLeftEl = document.getElementById('home-hj-title-left');
    const titleRightEl = document.getElementById('home-hj-title-right');

    const translatedTitle = translate('heroJourney.title') || "Hero's Journey";
    if (titleEl) {
        titleEl.textContent = translatedTitle;
    }

    if (titleLeftEl && titleRightEl) {
        const { left, right } = formatSplitTitle(translatedTitle);
        const betaLabel = translate('settings.badges.beta') || 'BETA';
        titleLeftEl.textContent = left;
        const rightTextHtml = right ? `${right} ` : '';
        titleRightEl.innerHTML = `${rightTextHtml}<span class="beta-badge" data-i18n="settings.badges.beta">${betaLabel}</span>`;
        titleRightEl.style.display = 'inline-flex';
    }

    // Update Accelerated Rewards Switch UI
    const acceleratedSwitch = document.getElementById('home-hj-accelerated-switch');
    if (acceleratedSwitch) {
        acceleratedSwitch.checked = isAccelerated;
    }

    // Update Claim Filter Switch UI (All vs Unclaimed)
    const claimFilter = state.heroJourney.claimFilter || 'all';
    const claimSwitchPill = document.getElementById('home-hj-claim-pill');
    const claimSwitchBtns = document.querySelectorAll('#home-hj-claim-switch .hj-switch-btn');
    claimSwitchBtns.forEach(btn => {
        const isMatch = btn.dataset.claimFilter === claimFilter;
        btn.classList.toggle('active', isMatch);
        if (isMatch && claimSwitchPill) {
            requestAnimationFrame(() => {
                claimSwitchPill.style.width = `${btn.offsetWidth}px`;
                claimSwitchPill.style.transform = `translateX(${btn.offsetLeft - 3}px)`;
            });
        }
    });

    // Update Type Filter Buttons & Select UI
    const typeFilter = state.heroJourney.typeFilter || null;
    const typeFilterBtns = document.querySelectorAll('#home-hj-type-filters .hj-type-btn');
    typeFilterBtns.forEach(btn => {
        const isMatch = btn.dataset.typeFilter === typeFilter;
        btn.classList.toggle('active', isMatch);
    });

    const typeSelect = document.getElementById('home-hj-type-select');
    if (typeSelect) {
        typeSelect.value = typeFilter || 'all';
    }

    // Calculate progress to current Town Hall max cumulative hero level
    const progressText = document.getElementById('home-hj-progress-text');
    const progressPercent = document.getElementById('home-hj-progress-percent');
    const progressFill = document.getElementById('home-hj-progress-fill');

    if (thMaxLevel > 0) {
        const pct = Math.min(100, Math.max(0, Math.round((cumulativeLevel / thMaxLevel) * 100)));
        const isTHMaxed = cumulativeLevel >= thMaxLevel;

        if (progressText) {
            progressText.textContent = isTHMaxed
                ? translate('heroJourney.thMaxed', { th: thLevel, current: cumulativeLevel, target: thMaxLevel })
                : translate('heroJourney.thMaxProgress', { th: thLevel, current: cumulativeLevel, target: thMaxLevel });
        }
        if (progressPercent) progressPercent.textContent = `${pct}%`;
        if (progressFill) progressFill.style.width = `${pct}%`;
    } else {
        if (progressText) progressText.textContent = translate('heroJourney.levelProgress', { current: cumulativeLevel });
        if (progressPercent) progressPercent.textContent = `100%`;
        if (progressFill) progressFill.style.width = `100%`;
    }

    renderNodesTrack(state, cumulativeLevel, thLevel);

    const activeFilterKey = getActiveFilterKey(state);
    const trackWrapper = document.querySelector('.hero-journey-track-wrapper');

    if (trackWrapper) {
        if (filterScrollPositions[activeFilterKey] !== undefined && filterScrollPositions[activeFilterKey] !== null) {
            const savedPos = filterScrollPositions[activeFilterKey];
            requestAnimationFrame(() => {
                trackWrapper.scrollLeft = savedPos;
            });
        } else {
            const claimFilter = state?.heroJourney?.claimFilter || 'all';
            if (claimFilter === 'unclaimed') {
                requestAnimationFrame(() => {
                    trackWrapper.scrollLeft = 0;
                });
            } else if (!skipAutoScroll) {
                autoScrollToCompletedNode(cumulativeLevel);
            }
        }
    }

    updateHeroJourneyUpcomingBadges(state);
}

let filterScrollPositions = {};

/**
 * Resets all stored in-memory filter scroll positions (e.g. on player profile switch).
 */
export function resetHeroJourneyScrollPositions() {
    filterScrollPositions = {};
}

/**
 * Returns a composite key representing the active claim and type filters.
 */
export function getActiveFilterKey(state) {
    const claimFilter = state?.heroJourney?.claimFilter || 'all';
    const typeFilter = state?.heroJourney?.typeFilter || 'all';
    return `${claimFilter}:${typeFilter}`;
}

/**
 * Saves current track scroll position for a specific filter in memory.
 */
export function saveCurrentFilterScrollPosition(filterKey) {
    const trackWrapper = document.querySelector('.hero-journey-track-wrapper');
    if (trackWrapper && filterKey) {
        filterScrollPositions[filterKey] = trackWrapper.scrollLeft;
    }
}

let isAutoScrollingFlag = false;

export function isAutoScrolling() {
    return isAutoScrollingFlag;
}

/**
 * Automatically scrolls the Hero's Journey horizontal track to center the completed milestone node.
 * @param {number} cumulativeLevel - Player's cumulative hero level.
 */
export function autoScrollToCompletedNode(cumulativeLevel) {
    const trackWrapper = document.querySelector('.hero-journey-track-wrapper');
    if (!trackWrapper) return;

    isAutoScrollingFlag = true;

    const executeScroll = () => {
        const chips = Array.from(trackWrapper.querySelectorAll('.hero-journey-node-chip'));
        if (!chips.length) {
            isAutoScrollingFlag = false;
            return;
        }

        let targetChip = null;
        for (const chip of chips) {
            const chipLevel = parseInt(chip.dataset.nodeLevel || chip.dataset.level, 10);
            if (chipLevel <= cumulativeLevel) {
                targetChip = chip;
            } else {
                break;
            }
        }

        if (!targetChip) {
            targetChip = chips[0];
        }

        if (targetChip) {
            const chipLeft = targetChip.offsetLeft;
            const chipWidth = targetChip.offsetWidth;
            const wrapperWidth = trackWrapper.clientWidth;
            const scrollTarget = Math.max(0, chipLeft - (wrapperWidth / 2) + (chipWidth / 2));

            trackWrapper.scrollTo({
                left: scrollTarget,
                behavior: 'smooth'
            });

            setTimeout(() => {
                isAutoScrollingFlag = false;
            }, 600);
        } else {
            isAutoScrollingFlag = false;
        }
    };

    requestAnimationFrame(() => {
        setTimeout(executeScroll, 50);
    });
}

/**
 * Renders individual milestone node chips into the track container.
 */
function renderNodesTrack(state, cumulativeLevel, thLevel) {
    const track = document.getElementById('home-hj-nodes-track');
    if (!track) return;

    track.innerHTML = '';
    const claimFilter = state.heroJourney.claimFilter || 'all';
    const typeFilter = state.heroJourney.typeFilter || null;
    const overrideUnclaimedSet = new Set(state.heroJourney.overrideUnclaimed || []);
    const isAccelerated = Boolean(state?.heroJourney?.acceleratedRewards ?? state?.heroJourney?.accelerated ?? (state?.heroJourney?.rewardMode === 'accelerated'));
    const mode = isAccelerated ? 'accelerated' : 'normal';

    const filteredNodes = heroJourneyNodes.filter(node => {
        const isReached = cumulativeLevel >= node.level;
        const isClaimed = (isReached && !overrideUnclaimedSet.has(node.level));

        if (claimFilter === 'unclaimed' && isClaimed) return false;

        if (typeFilter) {
            if (typeFilter === 'ores' && !(node.type === 'quest' || node.type === 'ore')) return false;
            if (typeFilter === 'equipment' && node.type !== 'equipment') return false;
            if (typeFilter === 'skins' && node.type !== 'skin') return false;
            if (typeFilter === 'items' && !(node.type === 'magicItem' || node.type === 'resource')) return false;
        }

        return true;
    });

    const maxLevelsByTH = getMaxCumulativeLevelsByTH();
    const allMaxValues = Object.values(maxLevelsByTH);
    const overallTrueMaxLevel = allMaxValues.length > 0 ? Math.max(...allMaxValues) : 0;
    const isTrueMaxPlayer = cumulativeLevel >= overallTrueMaxLevel && overallTrueMaxLevel > 0;

    const nodeTHBoundaries = new Map();
    const thKeys = Object.keys(maxLevelsByTH).map(n => parseInt(n, 10)).sort((a, b) => a - b);

    const maxTHInKeys = thKeys.length > 0 ? thKeys[thKeys.length - 1] : 18;

    for (const th of thKeys) {
        if (th >= maxTHInKeys) continue; // No next Town Hall exists after max TH (prevents TH19)
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

    visibleNodes.forEach((node, index) => {
        // Prepend initial TH start divider at beginning of track matching first visible node's TH
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
            const startDivider = document.createElement('div');
            startDivider.className = `th-max-divider th-start-initial-divider ${isCurrentTHDivider ? 'current-th-divider' : ''}`;

            const line = document.createElement('div');
            line.className = 'th-max-line';
            startDivider.appendChild(line);

            const pill = document.createElement('div');
            pill.className = 'th-max-pill';
            pill.innerHTML = `
                <orecalc-assets-image src="assets/th/th${startTH}.png" alt="TH${startTH}" class="th-max-img"></orecalc-assets-image>
                <div class="th-max-pill-content">
                    <span class="th-max-tag">${translate('heroJourney.thStartTag', { th: startTH })}</span>
                    <span class="th-max-lvl">${translate('heroJourney.thStartLvl', { lvl: startLvl })}</span>
                </div>
            `;
            startDivider.appendChild(pill);
            track.appendChild(startDivider);
        }

        const isReached = cumulativeLevel >= node.level;
        const isClaimed = isTrueMaxPlayer || (isReached && !overrideUnclaimedSet.has(node.level));
        const isBeyondTHLimit = node.level > playerMaxLevel;

        // Resolve dynamic equipment piece (e.g. Giant Gauntlet Lvl 1 vs 50 Starry Ore fallback)
        const resolvedNode = node.type === 'equipment' ? getResolvedEquipmentReward(node, state) : node;
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
        chip.dataset.nodeLevel = node.level;
        chip.dataset.level = node.level;
        chip.dataset.isClaimed = isClaimed ? 'true' : 'false';

        // Top Level Pill
        const levelPill = document.createElement('div');
        levelPill.className = 'node-level-pill';
        levelPill.textContent = translate('heroJourney.nodeLevel', { level: node.level });

        // Icon Wrapper
        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'node-icon-wrapper';

        let nodeAltText = '';
        if (node.type === 'quest') {
            const questTargetName = node.equipmentKey
                ? translate(`equipment.${node.equipmentKey}`)
                : (node.hero ? translate(`heroes.${node.hero}`) : translate('heroJourney.heroFallback'));
            nodeAltText = translate('heroJourney.questTitleFormat', { name: questTargetName });
        } else if (node.type === 'equipment') {
            nodeAltText = getTranslatedEquipmentName(resolvedNode.resolvedName);
        } else if (node.type === 'magicItem') {
            const itemKey = node.itemKey;
            nodeAltText = translate(`heroJourney.magicItems.${itemKey}`);
        } else if (node.type === 'skin') {
            const skinKey = node.skinKey;
            nodeAltText = translate(`heroJourney.skins.${skinKey}`);
        } else if (node.type === 'resource') {
            nodeAltText = translate(`heroJourney.resources.${getResourceKey(node.resourceType)}`);
        } else if (node.type === 'ore') {
            nodeAltText = translate(`ores.${node.resourceType}`);
        }

        const mainImg = document.createElement('orecalc-assets-image');
        mainImg.setAttribute('src', displayIcon);
        mainImg.setAttribute('alt', nodeAltText);
        mainImg.className = 'node-icon';
        iconWrapper.appendChild(mainImg);

        if (badgeIcon) {
            const questBadge = document.createElement('div');
            questBadge.className = 'node-quest-badge';

            const badgeImg = document.createElement('orecalc-assets-image');
            badgeImg.setAttribute('src', badgeIcon);
            badgeImg.setAttribute('alt', translate('heroJourney.questBadgeAlt'));
            badgeImg.className = 'quest-badge-img';

            questBadge.appendChild(badgeImg);
            iconWrapper.appendChild(questBadge);
        }

        // Bottom-Left Equipment Level Pill
        if (node.type === 'equipment') {
            const isOwnedEq = resolvedNode.isOwned || resolvedNode.isFallbackStarry;
            const showOwnedPill = isOwnedEq && !isClaimed;

            if (showOwnedPill) {
                const eqPill = document.createElement('div');
                eqPill.className = 'equipment-level-pill owned-pill';
                eqPill.textContent = translate('heroJourney.owned');
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
            check.className = `node-claimed-checkmark ${isUnownedEquipment ? 'unowned-check' : ''}`;
            check.textContent = '✓';
            iconWrapper.appendChild(check);
        }

        // Node Title & Subtitle
        const titleElem = document.createElement('div');
        titleElem.className = 'node-title';

        const subElem = document.createElement('div');
        subElem.className = 'node-sub';
        let hasSub = false;

        if (node.type === 'quest') {
            const chest = getQuestChestReward(thLevel, mode);
            const shinyImg = `<orecalc-assets-image src="assets/shiny_ore.png" alt="${translate('ores.shiny')}" class="sub-ore-icon"></orecalc-assets-image>`;
            const glowyImg = `<orecalc-assets-image src="assets/glowy_ore.png" alt="${translate('ores.glowy')}" class="sub-ore-icon"></orecalc-assets-image>`;
            const starryImg = `<orecalc-assets-image src="assets/starry_ore.png" alt="${translate('ores.starry')}" class="sub-ore-icon"></orecalc-assets-image>`;
            const accelArrow = mode === 'accelerated' ? getSVG('arrow-up', 'ore-accel-arrow-icon', 13, 13, 'var(--accent-primary)') : '';

            const questTargetName = node.equipmentKey
                ? translate(`equipment.${node.equipmentKey}`)
                : (node.hero ? translate(`heroes.${node.hero}`) : translate('heroJourney.heroFallback'));
            const questTitleText = translate('heroJourney.questTitleFormat', { name: questTargetName });

            titleElem.innerHTML = `<strong>${questTitleText}</strong>`;
            subElem.className = 'node-sub node-sub-ores';
            subElem.innerHTML =
                `<span class="node-sub-ore-item">${accelArrow}${formatNumber(chest.shiny)}${shinyImg}</span>` +
                `<span class="node-sub-ore-item">${accelArrow}${formatNumber(chest.glowy)}${glowyImg}</span>` +
                `<span class="node-sub-ore-item">${accelArrow}${formatNumber(chest.starry)}${starryImg}</span>`;
            hasSub = true;
        } else if (node.type === 'equipment') {
            const translatedEqTitle = getTranslatedEquipmentName(resolvedNode.resolvedName);
            if (resolvedNode.isFallbackStarry) {
                const useStrikethrough = !isClaimed;
                titleElem.innerHTML = `<strong class="${useStrikethrough ? 'equipment-name-strikethrough' : ''}">${translatedEqTitle}</strong>`;
                subElem.innerHTML = `<span><span class="${useStrikethrough ? 'fallback-label-accent' : ''}">${translate('heroJourney.fallbackLabel')}</span> <span class="fallback-highlight">${node.fallbackStarry} <orecalc-assets-image src="assets/starry_ore.png" alt="${translate('ores.starry')}" class="sub-ore-icon"></orecalc-assets-image></span></span>`;
                hasSub = true;
            } else {
                titleElem.innerHTML = `<strong>${translatedEqTitle}</strong>`;
            }
        } else if (node.type === 'resource' || node.type === 'ore' || node.type === 'gems') {
            let nameText = '';
            if (node.type === 'ore' && node.resourceType) {
                nameText = translate(`ores.${node.resourceType}`);
            } else if (node.type === 'resource' && node.resourceType) {
                nameText = translate(`heroJourney.resources.${getResourceKey(node.resourceType)}`);
            }
            titleElem.innerHTML = `<strong>${formatNumber(node.amount)} ${nameText}</strong>`;
        } else if (node.type === 'magicItem') {
            const itemKey = node.itemKey;
            const itemNameText = translate(`heroJourney.magicItems.${itemKey}`);
            titleElem.innerHTML = `<strong>${node.amount}x ${itemNameText}</strong>`;
        } else if (node.type === 'skin') {
            const skinKey = node.skinKey;
            const skinNameText = translate(`heroJourney.skins.${skinKey}`);
            const skinWords = skinNameText.split(' ');
            const formattedTitle = skinWords.length > 1
                ? `<span class="accent-text">${skinWords[0]}</span> ${skinWords.slice(1).join(' ')}`
                : skinNameText;
            titleElem.innerHTML = `<strong>${formattedTitle}</strong>`;
        }

        // Claim Button (Hidden for true max players)
        const isAllowedTypeToUnclaim = ['quest', 'ore', 'equipment'].includes(node.type);
        const isMoreThan10Behind = cumulativeLevel - node.level > 10;
        const isLockedFromUnclaim = isClaimed && (!isAllowedTypeToUnclaim || isMoreThan10Behind);
        const actionBtn = document.createElement('button');
        actionBtn.className = `node-claim-btn ${isClaimed ? 'btn-claimed' : (isReached ? 'btn-unclaimed' : 'btn-upcoming')} ${isLockedFromUnclaim ? 'disabled-unclaim' : ''}`;
        actionBtn.dataset.nodeLevel = node.level;

        if (!isReached) {
            const levelsNeeded = node.level - cumulativeLevel;
            if (levelsNeeded <= 25 && !isBeyondTHLimit) {
                actionBtn.textContent = translate('heroJourney.upcomingWithLevels', { levels: levelsNeeded });
            } else {
                actionBtn.textContent = translate('heroJourney.upcoming');
            }
            actionBtn.disabled = true;
            actionBtn.title = levelsNeeded === 1
                ? translate('heroJourney.upcomingTooltipSingle', { level: node.level, levels: levelsNeeded })
                : translate('heroJourney.upcomingTooltipPlural', { level: node.level, levels: levelsNeeded });
        } else if (isClaimed) {
            if (isLockedFromUnclaim) {
                actionBtn.textContent = translate('heroJourney.claimed');
                actionBtn.title = !isAllowedTypeToUnclaim
                    ? translate('heroJourney.cannotUndoTypeTooltip')
                    : translate('heroJourney.cannotUndoBehindTooltip');
            } else {
                actionBtn.innerHTML = `<span class="btn-text-default">${translate('heroJourney.claimed')}</span><span class="btn-text-hover">${translate('heroJourney.undoClaim')}</span>`;
                actionBtn.title = translate('heroJourney.undoClaimTooltip');
            }
        } else {
            actionBtn.textContent = translate('heroJourney.claim');
            actionBtn.title = translate('heroJourney.claimTooltip');
        }

        chip.appendChild(levelPill);
        chip.appendChild(iconWrapper);
        chip.appendChild(titleElem);
        if (hasSub) {
            chip.classList.add('has-sub');
            chip.appendChild(subElem);
        }
        if (!isTrueMaxPlayer) {
            chip.appendChild(actionBtn);
        }

        track.appendChild(chip);

        // Append TH Threshold Divider (marks the start of the next Town Hall level)
        if (nodeTHBoundaries.has(node.level)) {
            const thList = nodeTHBoundaries.get(node.level);
            const isCurrentTHDivider = thList.some(item => item.prevTH === thLevel);
            const divider = document.createElement('div');
            divider.className = `th-max-divider ${isCurrentTHDivider ? 'current-th-divider' : ''}`;

            const line = document.createElement('div');
            line.className = 'th-max-line';
            divider.appendChild(line);

            const pill = document.createElement('div');
            pill.className = 'th-max-pill';

            const highestNextTHInGroup = thList[thList.length - 1].nextTH;
            const startLvlVal = thList[thList.length - 1].startLvl;

            pill.innerHTML = `
                <orecalc-assets-image src="assets/th/th${highestNextTHInGroup}.png" alt="TH${highestNextTHInGroup}" class="th-max-img"></orecalc-assets-image>
                <div class="th-max-pill-content">
                    <span class="th-max-tag">${translate('heroJourney.thStartTag', { th: highestNextTHInGroup })}</span>
                    <span class="th-max-lvl">${translate('heroJourney.thStartLvl', { lvl: startLvlVal })}</span>
                </div>
            `;
            divider.appendChild(pill);

            track.appendChild(divider);
        }
    });

    // Append TH limit or True Max block card at end of track
    if (isTrueMaxPlayer) {
        const blockCard = document.createElement('div');
        blockCard.className = 'th-limit-block-card true-max-card';
        blockCard.innerHTML = `
            <orecalc-assets-image src="assets/th/th18.png" alt="TH18" class="th-limit-img"></orecalc-assets-image>
            <div class="th-limit-text">${translate('heroJourney.trueMaxTitle')}<br>${translate('heroJourney.trueMaxDesc')}</div>
            <span class="th-limit-reveal-btn btn-active" style="cursor: default;">${translate('homeProfile.maxed')}</span>
        `;
        track.appendChild(blockCard);
    } else {
        const hasNodesBeyond = filteredNodes.some(node => node.level > playerMaxLevel);
        if (hasNodesBeyond) {
            const nextTH = Math.min(18, thLevel + 1);
            const nextTHStartLvl = playerMaxLevel + 1;
            const blockCard = document.createElement('div');
            blockCard.className = 'th-limit-block-card';

            if (!revealBeyondTH) {
                blockCard.innerHTML = `
                    <orecalc-assets-image src="assets/th/th${nextTH}.png" alt="TH${nextTH}" class="th-limit-img"></orecalc-assets-image>
                    <div class="th-limit-text">${translate('heroJourney.thLimitLockedText', { th: nextTH, lvl: nextTHStartLvl })}</div>
                    <button class="th-limit-reveal-btn" id="home-hj-reveal-btn">${translate('heroJourney.explore')}</button>
                `;
            } else {
                blockCard.innerHTML = `
                    <orecalc-assets-image src="assets/th/th${nextTH}.png" alt="TH${nextTH}" class="th-limit-img"></orecalc-assets-image>
                    <div class="th-limit-text">${translate('heroJourney.thLimitUnlockedText', { th: nextTH })}</div>
                    <button class="th-limit-reveal-btn btn-active" id="home-hj-reveal-btn">${translate('actions.hide')}</button>
                `;
            }
            track.appendChild(blockCard);
        }
    }

    initHeroJourneyTooltips();
    requestAnimationFrame(() => {
        updateCustomScrollbar();
        updateFilterRowLayout();
    });
    initFilterRowResizeObserver();
    initClaimSwitchResizeObserver();
}

let filterResizeObserver = null;
let filterResizeFrame = null;

export function updateFilterRowLayout() {
    const filterContainer = document.querySelector('.hero-journey-filter-container');
    const claimSwitch = document.getElementById('home-hj-claim-switch');
    const typeFilters = document.getElementById('home-hj-type-filters');
    const typeButtons = typeFilters?.querySelector('.hj-type-buttons');
    const typeSelect = document.getElementById('home-hj-type-select');
    const scrollControls = document.querySelector('.hero-journey-scroll-controls');

    if (!filterContainer || !claimSwitch || !typeFilters || !typeButtons || !typeSelect || !scrollControls) return;

    filterContainer.classList.remove('filter-stage-1', 'filter-stage-2', 'filter-stage-3', 'filter-stage-4');

    const prevButtonsDisp = typeButtons.style.display;
    const prevSelectDisp = typeSelect.style.display;

    typeButtons.style.display = 'flex';
    typeSelect.style.display = 'none';

    const claimWidth = claimSwitch.offsetWidth || 160;

    let buttonsWidth = 0;
    const btns = typeButtons.querySelectorAll('.hj-type-btn');
    btns.forEach(btn => {
        buttonsWidth += (btn.offsetWidth || 80) + 6;
    });

    const scrollControlsWidth = scrollControls.offsetWidth || 170;
    const containerWidth = filterContainer.clientWidth;

    const stage1GapBuffer = 45;
    const stage1WidthNeeded = claimWidth + buttonsWidth + scrollControlsWidth + stage1GapBuffer;

    typeButtons.style.display = prevButtonsDisp;
    typeSelect.style.display = prevSelectDisp;

    if (containerWidth >= stage1WidthNeeded) {
        filterContainer.classList.add('filter-stage-1');
        return;
    }

    filterContainer.classList.add('filter-stage-2');

    const containerRect = filterContainer.getBoundingClientRect();
    const scrollRect = scrollControls.getBoundingClientRect();
    const selectRect = typeSelect.getBoundingClientRect();

    const isCollidingOrOverflowingStage2 = 
        (scrollRect.right > containerRect.right + 2) ||
        (selectRect.right > scrollRect.left - 14) ||
        (filterContainer.scrollWidth > filterContainer.clientWidth + 2);

    if (isCollidingOrOverflowingStage2) {
        filterContainer.classList.remove('filter-stage-2');
        filterContainer.classList.add('filter-stage-3');

        const filtersRow = document.querySelector('.hero-journey-filters-row');
        if (filtersRow) {
            const claimRect = claimSwitch.getBoundingClientRect();
            const stage3SelectRect = typeSelect.getBoundingClientRect();
            const rowRect = filtersRow.getBoundingClientRect();

            const isCollidingStage3 = 
                (claimRect.right > stage3SelectRect.left - 10) ||
                (filtersRow.scrollWidth > filtersRow.clientWidth + 2) ||
                (stage3SelectRect.right > rowRect.right + 2);

            if (isCollidingStage3) {
                filterContainer.classList.remove('filter-stage-3');
                filterContainer.classList.add('filter-stage-4');
            }
        }
    }

    updateClaimSwitchPillPosition();
}

export function formatSplitTitle(titleText) {
    const rawText = (titleText || '').trim();
    if (!rawText) return { left: '', right: '' };

    const words = rawText.split(/\s+/);
    if (words.length <= 1) {
        return { left: rawText, right: '' };
    }

    const totalChars = words.reduce((sum, w) => sum + w.length, 0);
    if (totalChars === 0) return { left: rawText, right: '' };

    let bestSplitIndex = 1;
    let minDiff = Infinity;

    let currentLeftChars = 0;
    for (let i = 0; i < words.length - 1; i++) {
        currentLeftChars += words[i].length;
        const currentRightChars = totalChars - currentLeftChars;
        const diff = Math.abs(currentLeftChars - currentRightChars);

        if (diff < minDiff) {
            minDiff = diff;
            bestSplitIndex = i + 1;
        }
    }

    const leftWords = words.slice(0, bestSplitIndex);
    const rightWords = words.slice(bestSplitIndex);

    const leftChars = leftWords.reduce((sum, w) => sum + w.length, 0);
    const rightChars = rightWords.reduce((sum, w) => sum + w.length, 0);

    const leftRatio = leftChars / totalChars;
    const rightRatio = rightChars / totalChars;
    const diffRatio = Math.abs(leftRatio - rightRatio);

    if (diffRatio > 0.30) {
        return { left: rawText, right: '' };
    }

    return {
        left: leftWords.join(' '),
        right: rightWords.join(' ')
    };
}

export function updateClaimSwitchPillPosition() {
    const activeBtn = document.querySelector('#home-hj-claim-switch .hj-switch-btn.active');
    const claimSwitchPill = document.getElementById('home-hj-claim-pill');
    if (activeBtn && claimSwitchPill) {
        requestAnimationFrame(() => {
            claimSwitchPill.style.width = `${activeBtn.offsetWidth}px`;
            claimSwitchPill.style.transform = `translateX(${activeBtn.offsetLeft - 3}px)`;
        });
    }
}

export function initFilterRowResizeObserver() {
    const card = document.getElementById('home-hj-card');
    if (!card) return;

    if (filterResizeObserver) {
        filterResizeObserver.disconnect();
    }

    filterResizeObserver = new ResizeObserver(() => {
        if (filterResizeFrame) {
            cancelAnimationFrame(filterResizeFrame);
        }
        filterResizeFrame = requestAnimationFrame(() => {
            updateFilterRowLayout();
        });
    });

    filterResizeObserver.observe(card);
}

export function updateCustomScrollbar(isDraggingThumb = false) {
    const trackWrapper = document.querySelector('.hero-journey-track-wrapper');
    const customBar = document.getElementById('home-hj-custom-scrollbar');
    const thumb = document.getElementById('home-hj-scrollbar-thumb');

    if (!trackWrapper || !customBar || !thumb) return;

    const scrollWidth = trackWrapper.scrollWidth;
    const clientWidth = trackWrapper.clientWidth;

    if (scrollWidth <= clientWidth) {
        customBar.style.display = 'none';
        return;
    }

    customBar.style.display = 'block';

    const customBarWidth = customBar.clientWidth;
    if (customBarWidth === 0) return;

    const ratio = clientWidth / scrollWidth;
    const thumbWidth = Math.max(36, Math.round(customBarWidth * ratio));
    thumb.style.width = `${thumbWidth}px`;

    if (isDraggingThumb) return;

    const maxScrollLeft = scrollWidth - clientWidth;
    const maxThumbLeft = customBarWidth - thumbWidth;

    if (maxScrollLeft > 0) {
        const scrollRatio = trackWrapper.scrollLeft / maxScrollLeft;
        const thumbLeft = Math.min(maxThumbLeft, Math.max(0, scrollRatio * maxThumbLeft));
        thumb.style.left = `${thumbLeft}px`;
    } else {
        thumb.style.left = '0px';
    }
}

let claimSwitchResizeObserver = null;
let claimSwitchFrame = null;

export function initClaimSwitchResizeObserver() {
    const claimSwitch = document.getElementById('home-hj-claim-switch');
    if (!claimSwitch) return;

    if (claimSwitchResizeObserver) {
        claimSwitchResizeObserver.disconnect();
    }

    claimSwitchResizeObserver = new ResizeObserver(() => {
        if (claimSwitchFrame) {
            cancelAnimationFrame(claimSwitchFrame);
        }
        claimSwitchFrame = requestAnimationFrame(() => {
            updateClaimSwitchPillPosition();
        });
    });

    claimSwitchResizeObserver.observe(claimSwitch);
}

if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
        updateCustomScrollbar();
        updateFilterRowLayout();
        updateClaimSwitchPillPosition();
    }, { passive: true });
}

function showNodeTooltip(chip) {
    const nodeLevel = parseInt(chip.dataset.nodeLevel, 10);
    const node = heroJourneyNodes.find(n => n.level === nodeLevel);
    if (!node) return;

    if (node.type === 'magicItem') {
        const itemKey = node.itemKey;
        const itemNameText = translate(`heroJourney.magicItems.${itemKey}`);
        const descText = translate(`heroJourney.magicItemDescriptions.${itemKey}`) || '';

        showCardHelpPopover(chip, {
            header: `
                <orecalc-assets-image src="${node.icon}" alt="${itemNameText}" class="popover-img"></orecalc-assets-image>
                <div class="popover-title-group">
                    <span class="popover-title">${node.amount}x ${itemNameText}</span>
                    <span class="popover-badge">${translate('heroJourney.magicItemBadge')}</span>
                </div>
            `,
            body: `<p>${descText}</p>`
        });
    } else if (node.type === 'skin') {
        const skinKey = node.skinKey;
        const skinNameText = translate(`heroJourney.skins.${skinKey}`) || skinKey;
        const skinWords = skinNameText.split(' ');
        const popoverTitle = skinWords.length > 1
            ? `<span class="accent-text">${skinWords[0]}</span> ${skinWords.slice(1).join(' ')}`
            : skinNameText;

        showCardHelpPopover(chip, {
            header: `
                <orecalc-assets-image src="${node.icon}" alt="${skinNameText}" class="popover-img"></orecalc-assets-image>
                <div class="popover-title-group">
                    <span class="popover-title">${popoverTitle}</span>
                    <span class="popover-badge">${translate('heroJourney.legendaryHeroSkinBadge')}</span>
                </div>
            `,
            body: `<p>${translate('heroJourney.skinPopoverBody')}</p>`
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
            bodyText = translate('heroJourney.equipmentPopoverBodyFallback', { title, starry: starryAmount });
        } else {
            bodyText = translate('heroJourney.equipmentPopoverBodyNormal', { title, level: eqLvl, starry: starryAmount });
        }

        showCardHelpPopover(chip, {
            header: `
                <orecalc-assets-image src="${icon}" alt="${title}" class="popover-img"></orecalc-assets-image>
                <div class="popover-title-group">
                    <span class="popover-title">${title}</span>
                    <span class="popover-badge">${translate('heroJourney.epicEquipmentBadge')}</span>
                </div>
            `,
            body: `<p>${bodyText}</p>`
        });
    } else if (node.type === 'quest') {
        const targetName = node.equipmentKey
            ? translate(`equipment.${node.equipmentKey}`)
            : (node.hero ? translate(`heroes.${node.hero}`) : translate('heroJourney.heroFallback'));
        const questTitleText = translate('heroJourney.questTitleFormat', { name: targetName });
        const bodyText = translate('heroJourney.questPopoverBody', { target: targetName });

        showCardHelpPopover(chip, {
            header: `
                <orecalc-assets-image src="${node.icon}" alt="${questTitleText}" class="popover-img"></orecalc-assets-image>
                <div class="popover-title-group">
                    <span class="popover-title">${questTitleText}</span>
                    <span class="popover-badge">${translate('heroJourney.heroQuestBadge')}</span>
                </div>
            `,
            body: `<p>${bodyText}</p>`
        });
    }
}

function hideNodeTooltip() {
    hideCardHelpPopover();
}

export function initHeroJourneyTooltips() {
    const trackWrapper = document.querySelector('.hero-journey-track-wrapper');
    if (trackWrapper && !trackWrapper.dataset.tooltipBound) {
        trackWrapper.dataset.tooltipBound = 'true';

        let activeChip = null;

        trackWrapper.addEventListener('click', (e) => {
            const claimBtn = e.target.closest('.node-claim-btn');
            if (claimBtn) return;

            const chip = e.target.closest('.hero-journey-node-chip');
            if (chip) {
                if (activeChip === chip) {
                    activeChip = null;
                    hideNodeTooltip();
                } else {
                    activeChip = chip;
                    showNodeTooltip(chip);
                }
            }
        });

        trackWrapper.addEventListener('mouseover', (e) => {
            if (window.matchMedia('(pointer: coarse)').matches) return;

            const chip = e.target.closest('.hero-journey-node-chip');
            if (chip && chip !== activeChip) {
                activeChip = chip;
                showNodeTooltip(chip);
            }
        });

        trackWrapper.addEventListener('mouseout', (e) => {
            if (window.matchMedia('(pointer: coarse)').matches) return;

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
            activeChip = null;
            hideNodeTooltip();
        }, { passive: true });
    }
}

/**
 * Updates green badges (+n) on the Equipment tab's Stored Ores card.
 */
export function updateHeroJourneyUpcomingBadges(state) {
    const upcoming = calculateHeroJourneyUpcomingOres(state);

    const shinyBadge = document.getElementById('eq-shiny-hero-journey-badge');
    const glowyBadge = document.getElementById('eq-glowy-hero-journey-badge');
    const starryBadge = document.getElementById('eq-starry-hero-journey-badge');

    if (shinyBadge) {
        if (upcoming.shiny > 0) {
            shinyBadge.textContent = `+${formatNumber(upcoming.shiny)}`;
            shinyBadge.style.display = 'inline-flex';
        } else {
            shinyBadge.style.display = 'none';
        }
    }

    if (glowyBadge) {
        if (upcoming.glowy > 0) {
            glowyBadge.textContent = `+${formatNumber(upcoming.glowy)}`;
            glowyBadge.style.display = 'inline-flex';
        } else {
            glowyBadge.style.display = 'none';
        }
    }

    if (starryBadge) {
        if (upcoming.starry > 0) {
            starryBadge.textContent = `+${formatNumber(upcoming.starry)}`;
            starryBadge.style.display = 'inline-flex';
        } else {
            starryBadge.style.display = 'none';
        }
    }
}
