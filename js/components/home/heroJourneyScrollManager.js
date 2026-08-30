import { state as globalState } from '../../core/state.js';

import { getCumulativeHeroLevel, getMaxCumulativeLevelsByTH, hasSyncedHeroInfo, isDefaultOrGuestPlayer } from '../../domain/income/heroJourneyLevels.js';

let filterScrollPositions = {};
let isAutoScrollingFlag = false;
let filterResizeObserver = null;
let filterResizeFrame = null;
let claimSwitchResizeObserver = null;
let claimSwitchFrame = null;

let cachedClaimWidth = 160;
let cachedButtonsWidth = 320;
let cachedScrollControlsWidth = 184;
let cachedSelectWidth = 135;
let cachedNoProfileWidth = 200;
let cachedSwitchWidth = 150;
let cachedCollapsedTextWidth = 200;
let cachedExploreBtnWidth = 100;

/**
 * Resets all stored in-memory filter scroll positions (e.g. on player profile switch).
 */
export function resetHeroJourneyScrollPositions() {
    filterScrollPositions = {};
}

/**
 * Returns a composite key representing the active claim and type filters.
 * @param {import('../../core/types.js').AppState} state - Application state.
 * @returns {string} Filter composite key.
 */
export function getActiveFilterKey(state) {
    const claimKey = state?.heroJourney?.unclaimedOnly ? 'unclaimed' : 'all';
    const typeFilter = state?.heroJourney?.typeFilter || 'all';
    return `${claimKey}:${typeFilter}`;
}

/**
 * Saves current track scroll position for a specific filter in memory.
 * @param {string} filterKey - Filter composite key.
 * @param {number} [explicitValue] - Explicit scroll position override.
 */
export function saveCurrentFilterScrollPosition(filterKey, explicitValue) {
    if (explicitValue !== undefined) {
        if (filterKey) {
            filterScrollPositions[filterKey] = explicitValue;
        }
        return;
    }
    const trackWrapper = document.querySelector('.hero-journey-track-wrapper');
    if (trackWrapper && filterKey && !isAutoScrollingFlag) {
        filterScrollPositions[filterKey] = trackWrapper.scrollLeft;
    }
}

/**
 * Retrieves the stored scroll position for a filter key.
 * @param {string} filterKey - Filter composite key.
 * @returns {number | undefined} Scroll position in pixels.
 */
export function getStoredFilterScrollPosition(filterKey) {
    return filterScrollPositions[filterKey];
}

/**
 * Sets the auto-scrolling active state flag.
 * @param {boolean} flag - True if auto-scrolling or rebuilding DOM.
 */
export function setIsAutoScrolling(flag) {
    isAutoScrollingFlag = flag;
}

/**
 * Indicates whether an auto-scroll animation is currently active.
 * @returns {boolean} True if auto-scrolling.
 */
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
            const chipLevel = Number(chip.dataset.nodeLevel || chip.dataset.level || 0);
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
 * Updates the active sliding pill indicator position in the segmented claim switch.
 */
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

/**
 * Adjusts layout classes for the filter row according to available container width.
 */
export function updateFilterRowLayout() {
    const filterContainer = document.querySelector('.hero-journey-filter-container');
    const claimSwitch = document.getElementById('home-hj-claim-switch');
    const typeFilters = document.getElementById('home-hj-type-filters');
    const typeButtons = typeFilters?.querySelector('.hj-type-buttons');
    const typeSelect = document.getElementById('home-hj-type-select');
    const scrollControls = document.querySelector('.hero-journey-scroll-controls');

    if (!filterContainer || !claimSwitch || !typeFilters || !typeButtons || !typeSelect || !scrollControls) return;

    const isClaimSwitchHidden = claimSwitch.offsetParent === null || window.getComputedStyle(claimSwitch).display === 'none';

    let claimWidth = 0;
    if (!isClaimSwitchHidden) {
        if (filterContainer.classList.contains('filter-stage-4') || claimSwitch.offsetWidth > 250) {
            claimWidth = cachedClaimWidth || 160;
        } else {
            claimWidth = (claimSwitch.offsetWidth > 0 ? claimSwitch.offsetWidth : cachedClaimWidth) || 160;
            if (claimSwitch.offsetWidth > 0 && claimSwitch.offsetWidth <= 250) {
                cachedClaimWidth = claimSwitch.offsetWidth;
            }
        }
    }

    let buttonsWidth = 0;
    const btns = typeButtons.querySelectorAll('.hj-type-btn');
    btns.forEach(btn => {
        if (btn.offsetWidth > 0 && btn.offsetWidth <= 150) {
            buttonsWidth += btn.offsetWidth + 6;
        }
    });
    if (buttonsWidth > 0 && buttonsWidth <= 500) {
        cachedButtonsWidth = buttonsWidth;
    } else {
        buttonsWidth = cachedButtonsWidth || 320;
    }

    let scrollControlsWidth = 0;
    if (filterContainer.classList.contains('filter-stage-3') || filterContainer.classList.contains('filter-stage-4') || scrollControls.offsetWidth > 240) {
        scrollControlsWidth = cachedScrollControlsWidth || 184;
    } else {
        scrollControlsWidth = (scrollControls.offsetWidth > 0 ? scrollControls.offsetWidth : cachedScrollControlsWidth) || 184;
        if (scrollControls.offsetWidth > 0 && scrollControls.offsetWidth <= 240) {
            cachedScrollControlsWidth = scrollControls.offsetWidth;
        }
    }

    let selectWidth = 0;
    const isSelectStretched = filterContainer.classList.contains('filter-stage-4')
        || (filterContainer.classList.contains('filter-stage-3') && isClaimSwitchHidden)
        || typeSelect.offsetWidth > 220;
    if (isSelectStretched || typeSelect.offsetWidth === 0) {
        selectWidth = cachedSelectWidth || 135;
    } else {
        selectWidth = (typeSelect.offsetWidth > 0 ? typeSelect.offsetWidth : cachedSelectWidth) || 135;
        if (typeSelect.offsetWidth > 0 && typeSelect.offsetWidth <= 220) {
            cachedSelectWidth = typeSelect.offsetWidth;
        }
    }

    const card = document.getElementById('home-hj-card') || filterContainer.closest?.('.hero-journey-card');
    let containerWidth = 0;
    if (card) {
        const cardStyle = window.getComputedStyle(card);
        const paddingHorizontal = (parseFloat(cardStyle.paddingLeft) || 0) + (parseFloat(cardStyle.paddingRight) || 0);
        containerWidth = card.clientWidth - paddingHorizontal;
    }
    if (!containerWidth || containerWidth <= 0) {
        containerWidth = filterContainer.clientWidth || filterContainer.parentElement?.clientWidth || window.innerWidth;
    }

    let targetStage = 'filter-stage-4';
    if (isClaimSwitchHidden) {
        const hiddenStage1Needed = buttonsWidth + scrollControlsWidth + 30;
        const hiddenStage2Needed = selectWidth + scrollControlsWidth + 20;
        if (containerWidth >= hiddenStage1Needed) {
            targetStage = 'filter-stage-1';
        } else if (containerWidth >= hiddenStage2Needed) {
            targetStage = 'filter-stage-2';
        } else {
            targetStage = 'filter-stage-4';
        }
    } else {
        const stage1WidthNeeded = claimWidth + buttonsWidth + scrollControlsWidth + 45;
        const stage2WidthNeeded = claimWidth + selectWidth + scrollControlsWidth + 30;
        const stage3WidthNeeded = claimWidth + selectWidth + 20;

        if (containerWidth >= stage1WidthNeeded) {
            targetStage = 'filter-stage-1';
        } else if (containerWidth >= stage2WidthNeeded) {
            targetStage = 'filter-stage-2';
        } else if (containerWidth >= stage3WidthNeeded) {
            targetStage = 'filter-stage-3';
        }
    }

    filterContainer.classList.toggle('no-claim-switch', isClaimSwitchHidden);
    filterContainer.classList.remove('filter-stage-1', 'filter-stage-2', 'filter-stage-3', 'filter-stage-4');
    filterContainer.classList.add(targetStage);

    updateClaimSwitchPillPosition();
}

/**
 * Toggles responsive stacked layout for progress info and switches when container width is constrained.
 */
export function updateProgressBarContainerLayout() {
    const card = document.getElementById('home-hj-card') || document.querySelector('.hero-journey-card');
    const container = document.querySelector('.hero-journey-progress-bar-container');
    const noProfileInfo = document.querySelector('.hero-journey-no-profile-info');
    const switchContainer = document.querySelector('.hero-journey-accelerated-switch-container');

    if (!card || !container || !noProfileInfo || !switchContainer) return;

    if (!card.classList.contains('no-synced-heroes')) {
        container.classList.remove('no-profile-stacked');
        return;
    }

    const containerWidth = container.clientWidth;
    const isStacked = container.classList.contains('no-profile-stacked');

    let noProfileWidth = 0;
    let switchWidth = 0;

    if (isStacked || noProfileInfo.offsetWidth > 300 || switchContainer.offsetWidth > 250) {
        noProfileWidth = cachedNoProfileWidth || 200;
        switchWidth = cachedSwitchWidth || 150;
    } else {
        noProfileWidth = noProfileInfo.offsetWidth || cachedNoProfileWidth || 200;
        switchWidth = switchContainer.offsetWidth || cachedSwitchWidth || 150;
        if (noProfileInfo.offsetWidth > 0 && noProfileInfo.offsetWidth <= 300) {
            cachedNoProfileWidth = noProfileInfo.offsetWidth;
        }
        if (switchContainer.offsetWidth > 0 && switchContainer.offsetWidth <= 250) {
            cachedSwitchWidth = switchContainer.offsetWidth;
        }
    }
    const gapBuffer = 20;

    const isOverflowing = containerWidth < (noProfileWidth + switchWidth + gapBuffer);
    container.classList.toggle('no-profile-stacked', isOverflowing);
}

/**
 * Toggles responsive stacked centered layout for collapsed note text and explore button.
 */
export function updateCollapsedNoteLayout() {
    const collapsedNote = /** @type {HTMLElement|null} */ (document.getElementById('home-hj-collapsed-note'));
    if (!collapsedNote || (collapsedNote.style.display === 'none' && typeof window.getComputedStyle === 'function' && window.getComputedStyle(collapsedNote).display === 'none')) {
        return;
    }

    const content = /** @type {HTMLElement|null} */ (collapsedNote.querySelector('.hero-journey-collapsed-content'));
    if (!content) return;

    const text = /** @type {HTMLElement|null} */ (content.querySelector('.hero-journey-collapsed-text'));
    const btn = /** @type {HTMLElement|null} */ (document.getElementById('home-hj-explore-btn') || content.querySelector('.th-limit-reveal-btn'));

    if (!text || !btn) return;

    if (text.scrollWidth > 0) cachedCollapsedTextWidth = text.scrollWidth;
    if (btn.offsetWidth > 0) cachedExploreBtnWidth = btn.offsetWidth;

    const availableWidth = content.clientWidth;
    const requiredWidth = cachedCollapsedTextWidth + cachedExploreBtnWidth + 18;

    const isOverflowing = availableWidth > 0 && availableWidth < requiredWidth;
    collapsedNote.classList.toggle('is-stacked', isOverflowing);
}

/**
 * Initializes ResizeObserver for the Hero's Journey summary card.
 */
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
            updateProgressBarContainerLayout();
            updateCollapsedNoteLayout();
        });
    });

    filterResizeObserver.observe(card);
}

/**
 * Initializes ResizeObserver for the segmented claim switch.
 */
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

let customStateProvider = null;

/**
 * Registers an external state provider callback for standalone page contexts.
 * @param {(() => import('../../core/types.js').AppState) | null} provider - State provider function.
 */
export function setHeroJourneyStateProvider(provider) {
    customStateProvider = provider;
}

/**
 * Updates custom horizontal scrollbar thumb geometry and progress fill.
 * @param {boolean} [isDraggingThumb=false] - True if scrollbar is currently dragged by pointer.
 * @param {import('../../core/types.js').AppState | null} [stateOverride=null] - Optional state override.
 */
export function updateCustomScrollbar(isDraggingThumb = false, stateOverride = null) {
    const trackWrapper = document.querySelector('.hero-journey-track-wrapper');
    const customBar = document.getElementById('home-hj-custom-scrollbar');
    const thumb = document.getElementById('home-hj-scrollbar-thumb');
    const progress = document.getElementById('home-hj-scrollbar-progress');

    if (!trackWrapper || !customBar || !thumb) return;

    const scrollWidth = trackWrapper.scrollWidth;
    const clientWidth = trackWrapper.clientWidth;
    const scrollLeft = trackWrapper.scrollLeft;

    const scrollControls = document.querySelector('.hero-journey-scroll-controls');
    const scrollFirstBtn = document.getElementById('home-hj-scroll-first');
    const scrollLeftBtn = document.getElementById('home-hj-scroll-left');
    const scrollCurrentBtn = document.getElementById('home-hj-scroll-current');
    const scrollRightBtn = document.getElementById('home-hj-scroll-right');
    const scrollLastBtn = document.getElementById('home-hj-scroll-last');

    if (scrollWidth <= clientWidth) {
        customBar.style.display = 'none';
        if (scrollControls) {
            scrollControls.style.opacity = '0.4';
            scrollControls.style.pointerEvents = 'none';
        }
        return;
    }

    if (scrollControls) {
        scrollControls.style.opacity = '';
        scrollControls.style.pointerEvents = '';
    }

    customBar.style.display = 'block';
    const customBarWidth = customBar.clientWidth;
    if (customBarWidth === 0) return;

    let progressRatio = 0;
    const appState = stateOverride || (customStateProvider ? customStateProvider() : globalState);
    const hasSyncedHeroes = hasSyncedHeroInfo(appState);
    const isGuest = isDefaultOrGuestPlayer(appState);
    const isUserSynced = hasSyncedHeroes && !isGuest;

    if (progress) {
        if (isUserSynced) {
            const cumulativeLevel = getCumulativeHeroLevel(appState);
            const maxLevelsByTH = getMaxCumulativeLevelsByTH();
            const allMaxValues = Object.values(maxLevelsByTH);
            const overallTrueMaxLevel = allMaxValues.length > 0 ? Math.max(...allMaxValues) : 0;
            const isTrueMaxPlayer = cumulativeLevel >= overallTrueMaxLevel && overallTrueMaxLevel > 0;

            if (isTrueMaxPlayer) {
                progressRatio = 1;
            } else {
                const chips = Array.from(trackWrapper.querySelectorAll('.hero-journey-node-chip'));
                let lastReachedChip = null;
                let nextChip = null;
                for (const chip of chips) {
                    const chipLevel = Number(chip.dataset.nodeLevel || chip.dataset.level || 0);
                    if (chipLevel <= cumulativeLevel) {
                        lastReachedChip = chip;
                    } else if (!nextChip) {
                        nextChip = chip;
                        break;
                    }
                }

                if (lastReachedChip) {
                    const lastPos = lastReachedChip.offsetLeft + lastReachedChip.offsetWidth;
                    if (nextChip) {
                        const nextPos = nextChip.offsetLeft;
                        const lastLvl = Number(lastReachedChip.dataset.nodeLevel || lastReachedChip.dataset.level || 0);
                        const nextLvl = Number(nextChip.dataset.nodeLevel || nextChip.dataset.level || 0);
                        const fraction = nextLvl > lastLvl ? Math.max(0, Math.min(1, (cumulativeLevel - lastLvl) / (nextLvl - lastLvl))) : 0;
                        const completionTrackPos = lastPos + (nextPos - lastPos) * fraction;
                        progressRatio = Math.min(1, Math.max(0, completionTrackPos / scrollWidth));
                    } else {
                        progressRatio = Math.min(1, Math.max(0, lastPos / scrollWidth));
                    }
                } else if (chips.length > 0 && cumulativeLevel > 0) {
                    const firstChip = chips[0];
                    const firstLvl = Number(firstChip.dataset.nodeLevel || firstChip.dataset.level || 0);
                    if (firstLvl > 0) {
                        const fraction = Math.max(0, Math.min(1, cumulativeLevel / firstLvl));
                        const completionTrackPos = firstChip.offsetLeft * fraction;
                        progressRatio = Math.min(1, Math.max(0, completionTrackPos / scrollWidth));
                    }
                }
            }
        }
    }

    const ratio = clientWidth / scrollWidth;
    const thumbWidth = Math.max(36, Math.round(customBarWidth * ratio));
    const maxScrollLeft = scrollWidth - clientWidth;
    const maxThumbLeft = customBarWidth - thumbWidth;
    let thumbLeft = 0;
    if (maxScrollLeft > 0) {
        const scrollRatio = scrollLeft / maxScrollLeft;
        thumbLeft = Math.min(maxThumbLeft, Math.max(0, scrollRatio * maxThumbLeft));
    }

    if (progress) {
        progress.style.width = `${(progressRatio * 100).toFixed(2)}%`;
    }
    thumb.style.width = `${thumbWidth}px`;
    if (!isDraggingThumb) {
        thumb.style.left = `${thumbLeft}px`;
    }

    const isAtStart = scrollLeft <= 1;
    const isAtEnd = maxScrollLeft <= 0 || scrollLeft >= maxScrollLeft - 2;

    if (scrollFirstBtn) {
        scrollFirstBtn.disabled = isAtStart;
        scrollFirstBtn.classList.toggle('disabled', isAtStart);
        scrollFirstBtn.setAttribute('aria-disabled', String(isAtStart));
    }
    if (scrollLeftBtn) {
        scrollLeftBtn.disabled = isAtStart;
        scrollLeftBtn.classList.toggle('disabled', isAtStart);
        scrollLeftBtn.setAttribute('aria-disabled', String(isAtStart));
    }
    if (scrollRightBtn) {
        scrollRightBtn.disabled = isAtEnd;
        scrollRightBtn.classList.toggle('disabled', isAtEnd);
        scrollRightBtn.setAttribute('aria-disabled', String(isAtEnd));
    }
    if (scrollLastBtn) {
        scrollLastBtn.disabled = isAtEnd;
        scrollLastBtn.classList.toggle('disabled', isAtEnd);
        scrollLastBtn.setAttribute('aria-disabled', String(isAtEnd));
    }
    if (scrollCurrentBtn) {
        const isCurrentDisabled = !isUserSynced;
        scrollCurrentBtn.disabled = isCurrentDisabled;
        scrollCurrentBtn.classList.toggle('disabled', isCurrentDisabled);
        scrollCurrentBtn.setAttribute('aria-disabled', String(isCurrentDisabled));
    }
}

if (typeof window !== 'undefined') {
    let heroJourneyResizeFrame = null;
    window.addEventListener('resize', () => {
        if (heroJourneyResizeFrame !== null) return;
        heroJourneyResizeFrame = window.requestAnimationFrame(() => {
            updateCustomScrollbar();
            updateFilterRowLayout();
            updateClaimSwitchPillPosition();
            heroJourneyResizeFrame = null;
        });
    }, { passive: true });
}
