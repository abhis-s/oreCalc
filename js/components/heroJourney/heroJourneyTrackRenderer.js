import { translate } from '../../i18n/translator.js';
import { heroJourneyNodes } from '../../data/heroJourneyData.js';
import { getMaxCumulativeLevelsByTH, getNodeTownHallLevel, getTownHallStartLevel } from '../../domain/income/heroJourneyLevels.js';
import { resolveHeroJourneyTrack } from '../../domain/income/heroJourneyResolution.js';
import { createNodeChipElement } from '../home/heroJourneyNodeBuilder.js';
import { createTHStartDivider, createTHBoundaryDivider, createTHLimitBlockCard } from '../home/heroJourneyDividersRenderer.js';
import {
    getActiveFilterKey,
    getStoredFilterScrollPosition,
    saveCurrentFilterScrollPosition,
    setIsAutoScrolling,
    isAutoScrolling,
    autoScrollToCompletedNode,
    updateCustomScrollbar,
    updateFilterRowLayout
} from '../home/heroJourneyScrollManager.js';
import {
    updateHeroJourneyRovingTabindex
} from '../home/heroJourneyKeyboardNav.js';
import { hjState, buildStateFromPlayerData } from './heroJourneyState.js';

/**
 * Filters the list of milestone nodes based on active filters.
 * @returns {Array<Object>} Filtered nodes.
 */
export function getFilteredNodes() {
    return heroJourneyNodes.filter(node => {
        if (hjState.unclaimedOnly && hjState.playerData) {
            const isClaimed = hjState.cumulativeLevel >= node.level;
            if (isClaimed) return false;
        }

        if (hjState.typeFilter && hjState.typeFilter !== 'all') {
            if (hjState.typeFilter === 'ores' && !(node.type === 'quest' || node.type === 'ore')) return false;
            if (hjState.typeFilter === 'equipment' && node.type !== 'equipment') return false;
            if (hjState.typeFilter === 'skins' && node.type !== 'skin') return false;
            if (hjState.typeFilter === 'items' && !(node.type === 'magicItem' || node.type === 'resource')) return false;
        }

        return true;
    });
}

/**
 * Renders the Visual Mountain Track view using canonical node builder and divider renderer.
 * @param {{ targetScrollLeft?: number, scrollToTrackEnd?: boolean, skipAutoScroll?: boolean }} [options={}] - Scroll restoration options.
 */
export function renderTrackView(options = {}) {
    const {
        targetScrollLeft,
        scrollToTrackEnd = false,
        skipAutoScroll = false
    } = options;

    const trackEl = document.getElementById('home-hj-nodes-track');
    const trackWrapper = document.getElementById('home-hj-track-wrapper') || document.querySelector('.hero-journey-track-wrapper');
    if (!trackEl) return;

    const preRenderScrollLeft = trackWrapper ? trackWrapper.scrollLeft : 0;

    const filtered = getFilteredNodes();
    if (filtered.length === 0) {
        trackEl.innerHTML = '';
        const emptyCard = document.createElement('div');
        emptyCard.className = 'hero-journey-empty-filter-card';
        emptyCard.innerHTML = `
            <orecalc-assets-svg name="sliders" class="empty-filter-icon"></orecalc-assets-svg>
            <div class="empty-filter-title">${translate('views.home.heroJourney.emptyFilterTitle')}</div>
            <div class="empty-filter-desc">${translate('views.home.heroJourney.emptyFilterDesc')}</div>
            <button type="button" class="th-limit-reveal-btn hero-journey-empty-filter-btn" id="hj-reset-filters-btn">${translate('views.home.heroJourney.clearFilter')}</button>
        `;
        trackEl.appendChild(emptyCard);
        const state = buildStateFromPlayerData(hjState.playerData, hjState);
        updateCustomScrollbar(false, state);
        return;
    }

    trackEl.innerHTML = '';

    const maxLevelsByTH = getMaxCumulativeLevelsByTH();
    const state = buildStateFromPlayerData(hjState.playerData, hjState);
    const allMaxValues = Object.values(maxLevelsByTH);
    const overallTrueMaxLevel = allMaxValues.length > 0 ? Math.max(...allMaxValues) : 0;
    const isUserSynced = Boolean(hjState.playerData);
    const isTrueMaxPlayer = isUserSynced && hjState.cumulativeLevel >= overallTrueMaxLevel && overallTrueMaxLevel > 0;
    const playerMaxLevel = maxLevelsByTH[hjState.thLevel] || Infinity;
    const trackResolution = resolveHeroJourneyTrack(state);

    /** @type {'accelerated' | 'normal'} */
    const mode = hjState.isAccelerated ? 'accelerated' : 'normal';
    const revealBeyondTH = Boolean(hjState.revealBeyondTH);

    const ctx = {
        state: /** @type {import('../../core/types.js').AppState} */ (state),
        cumulativeLevel: hjState.cumulativeLevel,
        playerMaxLevel,
        isUserSynced,
        isTrueMaxPlayer,
        isGuest: !isUserSynced,
        mode,
        trackResolution
    };

    const visibleNodes = revealBeyondTH
        ? filtered
        : filtered.filter(node => node.level <= playerMaxLevel);

    visibleNodes.forEach((node, index) => {
        const nodeTH = getNodeTownHallLevel(node.level);
        if (index === 0) {
            const startLvl = getTownHallStartLevel(nodeTH);
            trackEl.appendChild(createTHStartDivider(nodeTH, startLvl, nodeTH === hjState.thLevel));
        } else {
            const prevNodeTH = getNodeTownHallLevel(visibleNodes[index - 1].level);
            if (nodeTH > prevNodeTH) {
                const startLvl = getTownHallStartLevel(nodeTH);
                trackEl.appendChild(createTHBoundaryDivider(nodeTH, startLvl, nodeTH === hjState.thLevel));
            }
        }

        const chip = createNodeChipElement(node, ctx);
        trackEl.appendChild(chip);
    });

    updateHeroJourneyRovingTabindex(trackEl, hjState.cumulativeLevel);

    const isTrueMax = isTrueMaxPlayer || (!isUserSynced && hjState.thLevel >= 18);
    const hasNodesBeyond = filtered.some(node => node.level > playerMaxLevel);

    if (isTrueMax || hasNodesBeyond) {
        const nextTH = Math.min(18, hjState.thLevel + 1);
        const nextTHStartLvl = playerMaxLevel + 1;

        const blockCard = createTHLimitBlockCard({
            isTrueMax,
            isGuest: !isUserSynced,
            thLevel: hjState.thLevel,
            revealBeyondTH,
            nextTH,
            nextTHStartLvl,
            isDedicatedPage: true
        });
        trackEl.appendChild(blockCard);
    }

    const activeFilterKey = getActiveFilterKey(state);

    if (trackWrapper) {
        setIsAutoScrolling(true);
        const restoreScroll = () => {
            const maxScroll = Math.max(0, trackWrapper.scrollWidth - trackWrapper.clientWidth);
            let finalPos;

            if (scrollToTrackEnd) {
                finalPos = maxScroll;
            } else if (targetScrollLeft !== undefined) {
                finalPos = Math.min(targetScrollLeft, maxScroll);
            } else {
                const storedPos = getStoredFilterScrollPosition(activeFilterKey);
                if (storedPos !== undefined && storedPos !== null) {
                    finalPos = Math.min(storedPos, maxScroll);
                } else if (skipAutoScroll && preRenderScrollLeft > 0) {
                    finalPos = Math.min(preRenderScrollLeft, maxScroll);
                }
            }

            if (finalPos !== undefined) {
                saveCurrentFilterScrollPosition(activeFilterKey, finalPos);
                if (typeof trackWrapper.scrollTo === 'function') {
                    trackWrapper.scrollTo({ left: finalPos, behavior: 'instant' });
                } else {
                    trackWrapper.scrollLeft = finalPos;
                }
                updateCustomScrollbar(false, state);
                setTimeout(() => {
                    setIsAutoScrolling(false);
                }, 100);
            } else {
                const isUnclaimedFilter = Boolean(hjState?.unclaimedOnly);
                if (isUnclaimedFilter) {
                    saveCurrentFilterScrollPosition(activeFilterKey, 0);
                    if (typeof trackWrapper.scrollTo === 'function') {
                        trackWrapper.scrollTo({ left: 0, behavior: 'instant' });
                    } else {
                        trackWrapper.scrollLeft = 0;
                    }
                    updateCustomScrollbar(false, state);
                    setTimeout(() => {
                        setIsAutoScrolling(false);
                    }, 100);
                } else if (!skipAutoScroll) {
                    autoScrollToCompletedNode(hjState.cumulativeLevel);
                } else {
                    setIsAutoScrolling(false);
                }
            }
        };

        requestAnimationFrame(() => {
            restoreScroll();
            updateFilterRowLayout();
        });
    } else {
        updateCustomScrollbar(false, state);
        updateFilterRowLayout();
    }
}

/**
 * Updates top progress bar and cumulative level badge.
 */
export function updateProgressBar() {
    const maxLevelsByTH = getMaxCumulativeLevelsByTH();
    const thLevel = hjState.thLevel || 17;
    const thMaxLevel = maxLevelsByTH[thLevel] || 0;
    const allMax = Object.values(maxLevelsByTH);
    const overallMax = allMax.length > 0 ? Math.max(...allMax) : 485;

    const cumulativeBadge = document.getElementById('home-hj-cumulative-badge');
    const progressFill = document.getElementById('home-hj-progress-fill');
    const progressPercent = document.getElementById('home-hj-progress-percent');
    const progressText = document.getElementById('home-hj-progress-text');

    if (!progressFill || !progressPercent || !progressText) return;

    const hasPlayer = Boolean(hjState.playerData);
    if (!hasPlayer) {
        progressText.textContent = translate('views.heroJourneyPage.heroJourneyTitle');
        progressPercent.textContent = 'Preview';
        progressFill.style.width = '0%';
        progressFill.classList.remove('is-true-max');
        if (cumulativeBadge) {
            cumulativeBadge.textContent = `0 / ${overallMax}`;
            cumulativeBadge.classList.remove('badge-true-max');
        }
        return;
    }

    const isTrueMaxPlayer = hjState.cumulativeLevel >= overallMax && overallMax > 0;
    progressFill.classList.toggle('is-true-max', isTrueMaxPlayer);
    const card = document.getElementById('home-hj-card');
    if (card) {
        card.classList.toggle('is-true-max', isTrueMaxPlayer);
    }
    if (cumulativeBadge) {
        cumulativeBadge.textContent = overallMax > 0 ? `${hjState.cumulativeLevel}/${overallMax}` : `${hjState.cumulativeLevel}`;
        cumulativeBadge.classList.toggle('badge-true-max', isTrueMaxPlayer);
    }

    if (isTrueMaxPlayer) {
        progressText.textContent = translate('views.home.heroJourney.thMaxed', { th: thLevel, current: hjState.cumulativeLevel, target: overallMax });
        progressPercent.textContent = '100%';
        progressFill.style.width = '100%';
    } else if (thMaxLevel > 0) {
        const pct = Math.min(100, Math.max(0, Math.round((hjState.cumulativeLevel / thMaxLevel) * 100)));
        const isTHMaxed = hjState.cumulativeLevel >= thMaxLevel;

        progressText.textContent = isTHMaxed
            ? translate('views.home.heroJourney.thMaxed', { th: thLevel, current: hjState.cumulativeLevel, target: thMaxLevel })
            : translate('views.home.heroJourney.thMaxProgress', { th: thLevel, current: hjState.cumulativeLevel, target: thMaxLevel });
        progressPercent.textContent = `${pct}%`;
        progressFill.style.width = `${pct}%`;
    } else {
        progressText.textContent = translate('views.home.heroJourney.title');
        progressPercent.textContent = '0%';
        progressFill.style.width = '0%';
    }
}

/**
 * Syncs the sliding active pill inside all claim segmented switches.
 */
export function syncClaimSwitchPill() {
    const claimSwitches = document.querySelectorAll('.hj-segmented-switch');
    if (claimSwitches.length === 0) return;

    const hasPlayer = Boolean(hjState.playerData);
    const maxLevelsByTH = getMaxCumulativeLevelsByTH();
    const allMaxValues = Object.values(maxLevelsByTH);
    const overallTrueMaxLevel = allMaxValues.length > 0 ? Math.max(...allMaxValues) : 0;
    const isTrueMaxPlayer = hasPlayer && hjState.cumulativeLevel >= overallTrueMaxLevel && overallTrueMaxLevel > 0;

    const shouldHide = !hasPlayer || isTrueMaxPlayer;
    if (shouldHide && hjState.unclaimedOnly) {
        hjState.unclaimedOnly = false;
    }

    claimSwitches.forEach(claimSwitch => {
        /** @type {HTMLElement} */ (claimSwitch).style.display = shouldHide ? 'none' : 'flex';
        if (shouldHide) return;

        const claimPill = claimSwitch.querySelector('.hj-switch-pill');
        const btns = claimSwitch.querySelectorAll('.hj-switch-btn');
        btns.forEach(btn => {
            const isUnclaimed = btn.getAttribute('data-unclaimed-only') === 'true';
            const isMatch = isUnclaimed === hjState.unclaimedOnly;
            btn.classList.toggle('active', isMatch);
            if (isMatch && claimPill) {
                const btnEl = /** @type {HTMLElement} */ (btn);
                const pillEl = /** @type {HTMLElement} */ (claimPill);
                const applyPillPosition = () => {
                    const btnWidth = btnEl.offsetWidth;
                    const btnOffset = btnEl.offsetLeft;
                    if (btnWidth > 0) {
                        pillEl.style.width = `${btnWidth}px`;
                        pillEl.style.transform = `translateX(${btnOffset - 3}px)`;
                    }
                };
                applyPillPosition();
                requestAnimationFrame(applyPillPosition);
            }
        });
    });
}
