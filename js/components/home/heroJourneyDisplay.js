import { translate } from '../../i18n/translator.js';

import { calculateHeroJourneyUpcomingOres } from '../../domain/income/heroJourneyIncome.js';
import {
    getCumulativeHeroLevel,
    getMaxCumulativeLevelsByTH,
    getTownHallLevel,
    hasSyncedHeroInfo,
    isDefaultOrGuestPlayer
} from '../../domain/income/heroJourneyLevels.js';
import { normalizePlayerTag } from '../../core/localStorageManager.js';
import { animateValue, formatNumber } from '../../utils/numberFormatter.js';
import { escapeHTML } from '../../utils/stringUtils.js';

import { renderNodesTrack } from './heroJourneyNodesDisplay.js';
import { initHeroJourneyTooltips } from './heroJourneyPopovers.js';
import {
    autoScrollToCompletedNode,
    getActiveFilterKey,
    getStoredFilterScrollPosition,
    initClaimSwitchResizeObserver,
    initFilterRowResizeObserver,
    resetHeroJourneyScrollPositions,
    saveCurrentFilterScrollPosition,
    setIsAutoScrolling,
    updateClaimSwitchPillPosition,
    updateCollapsedNoteLayout,
    updateCustomScrollbar,
    updateFilterRowLayout,
    updateProgressBarContainerLayout
} from './heroJourneyScrollManager.js';

/**
 * Updates green badges (+n) on the Equipment tab's Stored Ores card.
 * @param {import('../../core/types.js').AppState} state - Current global state.
 */
export function updateHeroJourneyUpcomingBadges(state) {
    const shinyBadge = document.getElementById('eq-shiny-hero-journey-badge');
    const glowyBadge = document.getElementById('eq-glowy-hero-journey-badge');
    const starryBadge = document.getElementById('eq-starry-hero-journey-badge');

    if (!hasSyncedHeroInfo(state)) {
        if (shinyBadge) {
            shinyBadge._currentNumericValue = 0;
            shinyBadge.style.display = 'none';
        }
        if (glowyBadge) {
            glowyBadge._currentNumericValue = 0;
            glowyBadge.style.display = 'none';
        }
        if (starryBadge) {
            starryBadge._currentNumericValue = 0;
            starryBadge.style.display = 'none';
        }
        return;
    }

    const upcoming = calculateHeroJourneyUpcomingOres(state);

    const updateBadge = (badge, value) => {
        if (!badge) return;
        if (value > 0) {
            const prevVal = typeof badge._currentNumericValue === 'number'
                ? badge._currentNumericValue
                : (parseInt(badge.textContent.replace(/[^0-9-]/g, ''), 10) || 0);
            const endVal = Math.round(value || 0);
            badge._currentNumericValue = endVal;

            if (badge.textContent && badge.style.display !== 'none' && prevVal !== endVal) {
                animateValue(badge, prevVal, endVal, 500, (v) => `+${formatNumber(Math.round(v))}`);
            } else {
                badge.textContent = `+${formatNumber(endVal)}`;
            }
            badge.style.display = 'inline-flex';
        } else {
            badge._currentNumericValue = 0;
            badge.style.display = 'none';
        }
    };

    updateBadge(shinyBadge, upcoming.shiny);
    updateBadge(glowyBadge, upcoming.glowy);
    updateBadge(starryBadge, upcoming.starry);
}

let lastRenderedPlayerTag = null;

/**
 * Orchestrates rendering of the Hero's Journey summary card, filters, progress bar, and milestone nodes track.
 * @param {import('../../core/types.js').AppState} state - Global application state.
 * @param {{ skipAutoScroll?: boolean, targetScrollLeft?: number, scrollToTrackEnd?: boolean }} [options={}] - Rendering options.
 */
export function renderHeroJourneyDisplay(state, { skipAutoScroll = false, targetScrollLeft, scrollToTrackEnd = false } = {}) {
    const container = document.getElementById('home-hj-card');
    if (!container) return;

    const currentTag = state?.savedPlayerTags?.[0] || 'DEFAULT0';
    if (lastRenderedPlayerTag !== null && lastRenderedPlayerTag !== currentTag) {
        resetHeroJourneyScrollPositions();
    }
    lastRenderedPlayerTag = currentTag;

    const trackWrapper = document.querySelector('.hero-journey-track-wrapper');
    const preRenderScrollLeft = trackWrapper ? trackWrapper.scrollLeft : 0;

    const isAccelerated = Boolean(state?.heroJourney?.acceleratedRewards ?? state?.heroJourney?.accelerated ?? (state?.heroJourney?.rewardMode === 'accelerated'));

    const cumulativeLevel = getCumulativeHeroLevel(state);
    const thLevel = getTownHallLevel(state);
    const maxLevelsByTH = getMaxCumulativeLevelsByTH();
    const thMaxLevel = maxLevelsByTH[thLevel] || 0;
    const allMaxValues = Object.values(maxLevelsByTH);
    const overallTrueMaxLevel = allMaxValues.length > 0 ? Math.max(...allMaxValues) : 0;

    const isTrueMaxPlayer = cumulativeLevel >= overallTrueMaxLevel && overallTrueMaxLevel > 0;
    const isGuest = isDefaultOrGuestPlayer(state);
    const isEligibleToHide = isTrueMaxPlayer || isGuest;
    const hasSyncedHeroes = hasSyncedHeroInfo(state);

    const isHidden = Boolean(isEligibleToHide && state?.heroJourney?.hidden);
    const card = document.getElementById('home-hj-card') || document.querySelector('.hero-journey-card');
    const collapsedNote = document.getElementById('home-hj-collapsed-note');

    if (card) {
        card.classList.toggle('is-collapsed', isHidden);
        card.classList.toggle('no-synced-heroes', !hasSyncedHeroes);
        card.classList.toggle('is-true-max', isTrueMaxPlayer);
    }
    if (collapsedNote) {
        collapsedNote.style.display = isHidden ? 'flex' : 'none';
        if (isHidden) {
            updateCollapsedNoteLayout();
        }
    }

    const cumulativeBadge = document.getElementById('home-hj-cumulative-badge');
    if (cumulativeBadge) {
        if (!hasSyncedHeroes) {
            cumulativeBadge.style.display = 'none';
        } else {
            cumulativeBadge.style.display = '';
            cumulativeBadge.textContent = overallTrueMaxLevel > 0 ? `${cumulativeLevel}/${overallTrueMaxLevel}` : `${cumulativeLevel}`;
            cumulativeBadge.classList.toggle('badge-true-max', isTrueMaxPlayer);
        }
    }

    if (isHidden) {
        updateHeroJourneyUpcomingBadges(state);
        return;
    }

    const titleEl = document.getElementById('home-hj-title');
    const translatedTitle = translate('views.home.heroJourney.title');
    const openTooltip = translate('views.home.heroJourney.openInTracker');
    const rawTag = (!isGuest && state.playerProfile?.tag) ? state.playerProfile.tag : (state.savedPlayerTags?.[0] || '');
    const cleanTag = normalizePlayerTag(rawTag);
    const playerTag = (!isGuest && cleanTag && cleanTag !== 'DEFAULT0') ? cleanTag : '';
    const openUrl = playerTag ? `/hero-journey/?tag=${encodeURIComponent(playerTag)}` : '/hero-journey/';

    if (titleEl) {
        titleEl.innerHTML = `<span class="hero-journey-title-wrapper"><span class="hero-journey-title-text" data-i18n="views.home.heroJourney.title">${translatedTitle}</span><a id="home-hj-open-btn" href="${escapeHTML(openUrl)}" class="hj-open-btn" title="${escapeHTML(openTooltip)}" aria-label="${escapeHTML(openTooltip)}"><orecalc-assets-svg name="open-in-new" height="13" width="13"></orecalc-assets-svg></a></span>`;
    }

    const acceleratedSwitch = document.getElementById('home-hj-accelerated-switch');
    if (acceleratedSwitch) {
        acceleratedSwitch.checked = isAccelerated;
    }

    const claimSwitch = document.getElementById('home-hj-claim-switch');
    if (claimSwitch) {
        claimSwitch.style.display = (!hasSyncedHeroes || isTrueMaxPlayer) ? 'none' : '';
    }
    const unclaimedOnly = Boolean(state.heroJourney.unclaimedOnly);
    const claimSwitchPill = document.getElementById('home-hj-claim-pill');
    const claimSwitchBtns = document.querySelectorAll('#home-hj-claim-switch .hj-switch-btn');
    claimSwitchBtns.forEach(btn => {
        const btnValue = btn.dataset.unclaimedOnly === 'true';
        const isMatch = btnValue === unclaimedOnly;
        btn.classList.toggle('active', isMatch);
        if (isMatch && claimSwitchPill) {
            requestAnimationFrame(() => {
                claimSwitchPill.style.width = `${btn.offsetWidth}px`;
                claimSwitchPill.style.transform = `translateX(${btn.offsetLeft - 3}px)`;
            });
        }
    });

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

    const progressText = document.getElementById('home-hj-progress-text');
    const progressPercent = document.getElementById('home-hj-progress-percent');
    const progressFill = document.getElementById('home-hj-progress-fill');

    if (thMaxLevel > 0) {
        const pct = Math.min(100, Math.max(0, Math.round((cumulativeLevel / thMaxLevel) * 100)));
        const isTHMaxed = cumulativeLevel >= thMaxLevel;

        if (progressText) {
            progressText.textContent = isTHMaxed
                ? translate('views.home.heroJourney.thMaxed', { th: thLevel, current: cumulativeLevel, target: thMaxLevel })
                : translate('views.home.heroJourney.thMaxProgress', { th: thLevel, current: cumulativeLevel, target: thMaxLevel });
        }
        if (progressPercent) progressPercent.textContent = `${pct}%`;
        if (progressFill) progressFill.style.width = `${pct}%`;
    } else {
        if (progressText) progressText.textContent = translate('views.home.heroJourney.levelProgress', { current: cumulativeLevel });
        if (progressPercent) progressPercent.textContent = `100%`;
        if (progressFill) progressFill.style.width = `100%`;
    }

    setIsAutoScrolling(true);
    renderNodesTrack(state, cumulativeLevel, thLevel);
    initHeroJourneyTooltips();

    requestAnimationFrame(() => {
        updateCustomScrollbar();
        updateFilterRowLayout();
        updateProgressBarContainerLayout();
    });
    initFilterRowResizeObserver();
    initClaimSwitchResizeObserver();

    const activeFilterKey = getActiveFilterKey(state);

    if (trackWrapper) {
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
                updateCustomScrollbar();
                setTimeout(() => {
                    setIsAutoScrolling(false);
                }, 100);
            } else {
                const isUnclaimedFilter = Boolean(state?.heroJourney?.unclaimedOnly);
                if (isUnclaimedFilter) {
                    saveCurrentFilterScrollPosition(activeFilterKey, 0);
                    if (typeof trackWrapper.scrollTo === 'function') {
                        trackWrapper.scrollTo({ left: 0, behavior: 'instant' });
                    } else {
                        trackWrapper.scrollLeft = 0;
                    }
                    updateCustomScrollbar();
                    setTimeout(() => {
                        setIsAutoScrolling(false);
                    }, 100);
                } else if (!skipAutoScroll) {
                    autoScrollToCompletedNode(cumulativeLevel);
                } else {
                    setIsAutoScrolling(false);
                }
            }
        };

        requestAnimationFrame(() => {
            restoreScroll();
        });
    }

    updateHeroJourneyUpcomingBadges(state);
}
