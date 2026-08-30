import { translate } from '../../i18n/translator.js';

import { handleStateUpdate } from '../../core/stateManager.js';

import { getCumulativeHeroLevel } from '../../domain/income/heroJourneyLevels.js';

import { renderHeroJourneyDisplay } from './heroJourneyDisplay.js';
import { autoScrollToCompletedNode, getActiveFilterKey, isAutoScrolling, saveCurrentFilterScrollPosition, updateCustomScrollbar } from './heroJourneyScrollManager.js';
import { initHeroJourneyTrackKeyboardNav } from './heroJourneyKeyboardNav.js';
import { triggerHaptic } from '../../services/hapticService.js';

let isBound = false;

/**
 * Initializes and binds all event listeners for the Hero's Journey component.
 * @param {import('../../core/types.js').AppState} state - Current global application state.
 */
export function setupHeroJourneyInputs(state) {
    if (isBound) return;
    isBound = true;

    const acceleratedSwitch = /** @type {HTMLInputElement | null} */ (document.getElementById('home-hj-accelerated-switch'));
    if (acceleratedSwitch) {
        const isAccelerated = Boolean(state?.heroJourney?.acceleratedRewards ?? state?.heroJourney?.accelerated ?? (state?.heroJourney?.rewardMode === 'accelerated'));
        acceleratedSwitch.checked = isAccelerated;

        acceleratedSwitch.addEventListener('change', (e) => {
            const target = /** @type {HTMLInputElement} */ (e.target);
            handleStateUpdate(() => {
                if (!state.heroJourney) state.heroJourney = {};
                state.heroJourney.acceleratedRewards = target.checked;
            });
        });
    }

    const claimSwitch = document.getElementById('home-hj-claim-switch');
    if (claimSwitch) {
        claimSwitch.addEventListener('click', (e) => {
            const target = /** @type {HTMLElement} */ (e.target);
            const btn = target.closest('.hj-switch-btn');
            if (!btn || /** @type {HTMLElement} */ (btn).dataset.unclaimedOnly === undefined) return;

            const isUnclaimed = /** @type {HTMLElement} */ (btn).dataset.unclaimedOnly === 'true';
            handleStateUpdate(() => {
                if (!state.heroJourney) state.heroJourney = {};
                state.heroJourney.unclaimedOnly = isUnclaimed;
            }, true);
            renderHeroJourneyDisplay(state);
        });
    }

    const typeFilterContainer = document.getElementById('home-hj-type-filters');
    if (typeFilterContainer) {
        typeFilterContainer.addEventListener('click', (e) => {
            const target = /** @type {HTMLElement} */ (e.target);
            const btn = target.closest('.hj-type-btn');
            if (!btn) return;

            const filter = btn.getAttribute('data-type-filter') || 'all';
            const currentFilter = state?.heroJourney?.typeFilter || 'all';
            const nextFilter = currentFilter === filter ? null : (filter === 'all' ? null : filter);

            handleStateUpdate(() => {
                if (!state.heroJourney) state.heroJourney = {};
                state.heroJourney.typeFilter = nextFilter;
            }, true);
            renderHeroJourneyDisplay(state);
        });

        const typeSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('home-hj-type-select'));
        if (typeSelect) {
            typeSelect.value = state?.heroJourney?.typeFilter || 'all';
            typeSelect.addEventListener('change', (e) => {
                const val = /** @type {HTMLSelectElement} */ (e.target).value;
                handleStateUpdate(() => {
                    if (!state.heroJourney) state.heroJourney = {};
                    state.heroJourney.typeFilter = val === 'all' ? null : val;
                }, true);
                renderHeroJourneyDisplay(state);
            });
        }
    }

    const scrollFirstBtn = document.getElementById('home-hj-scroll-first');
    const scrollLeftBtn = document.getElementById('home-hj-scroll-left');
    const scrollCurrentBtn = document.getElementById('home-hj-scroll-current');
    const scrollRightBtn = document.getElementById('home-hj-scroll-right');
    const scrollLastBtn = document.getElementById('home-hj-scroll-last');
    const trackWrapper = /** @type {HTMLElement | null} */ (document.querySelector('.hero-journey-track-wrapper'));
    const track = document.getElementById('home-hj-nodes-track');
    const customBar = /** @type {HTMLElement | null} */ (document.getElementById('home-hj-custom-scrollbar'));
    const thumb = /** @type {HTMLElement | null} */ (document.getElementById('home-hj-scrollbar-thumb'));

    let isDraggingBar = false;
    let isScrollTickPending = false;

    if (trackWrapper) {
        initHeroJourneyTrackKeyboardNav(trackWrapper);

        trackWrapper.addEventListener('scroll', () => {
            if (!isScrollTickPending) {
                isScrollTickPending = true;
                requestAnimationFrame(() => {
                    isScrollTickPending = false;
                    updateCustomScrollbar(isDraggingBar);
                    if (!isAutoScrolling()) {
                        const currentKey = getActiveFilterKey(state);
                        saveCurrentFilterScrollPosition(currentKey);
                    }
                });
            }
        }, { passive: true });
    }

    if (customBar && thumb && trackWrapper) {
        const scrubTooltip = /** @type {HTMLElement | null} */ (document.getElementById('home-hj-scrub-tooltip'));
        let lastScrubLevel = null;
        let isActivated = false;
        let isScrubFramePending = false;
        let grabTimer = null;
        let startX = 0;
        let startY = 0;
        let startThumbLeft = 0;
        let cachedBarWidth = 0;
        let cachedThumbWidth = 0;
        let cachedViewportWidth = 0;
        let cachedMaxScrollLeft = 0;
        let cachedChipCenters = [];

        const updateScrubTooltip = (currentScrollLeft) => {
            if (!scrubTooltip || cachedChipCenters.length === 0) return;

            const viewportCenter = currentScrollLeft + (cachedViewportWidth / 2);
            let closestLevel = '';
            let minDistance = Infinity;

            for (let i = 0; i < cachedChipCenters.length; i++) {
                const item = cachedChipCenters[i];
                const dist = Math.abs(item.center - viewportCenter);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestLevel = item.level;
                } else if (dist > minDistance) {
                    break;
                }
            }

            if (closestLevel) {
                const levelLabel = translate('validation.level');
                scrubTooltip.textContent = `${levelLabel} ${closestLevel}`;
                if (lastScrubLevel !== null && lastScrubLevel !== closestLevel) {
                    triggerHaptic('light');
                }
                lastScrubLevel = closestLevel;
            }
        };

        const activateGrab = () => {
            if (isActivated) return;
            isActivated = true;
            isDraggingBar = true;
            thumb.classList.add('is-dragging');
            trackWrapper.style.scrollBehavior = 'auto';
            document.body.style.userSelect = 'none';
            document.body.style.webkitUserSelect = 'none';

            // Cache dimensions and chip center geometries on grab start
            cachedBarWidth = customBar.clientWidth;
            cachedThumbWidth = thumb.offsetWidth;
            cachedViewportWidth = trackWrapper.clientWidth;
            cachedMaxScrollLeft = trackWrapper.scrollWidth - cachedViewportWidth;

            const chips = Array.from(trackWrapper.querySelectorAll('.hero-journey-node-chip'));
            cachedChipCenters = chips.map(chip => {
                const el = /** @type {HTMLElement} */ (chip);
                return {
                    level: el.dataset.nodeLevel || el.dataset.level || '',
                    center: el.offsetLeft + (el.offsetWidth / 2)
                };
            });

            lastScrubLevel = null;
            updateScrubTooltip(trackWrapper.scrollLeft);

            triggerHaptic('select');
        };

        const onDragMove = (e) => {
            const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? e.changedTouches?.[0]?.clientX ?? 0;
            const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? e.changedTouches?.[0]?.clientY ?? 0;
            const deltaX = clientX - startX;
            const deltaY = clientY - startY;

            if (!isActivated) {
                // If moved more than 4px horizontally, activate grab immediately
                if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
                    clearTimeout(grabTimer);
                    activateGrab();
                } else {
                    return;
                }
            }

            const maxThumbLeft = cachedBarWidth - cachedThumbWidth;
            const newThumbLeft = Math.min(maxThumbLeft, Math.max(0, startThumbLeft + deltaX));
            const scrollRatio = maxThumbLeft > 0 ? (newThumbLeft / maxThumbLeft) : 0;
            const targetScrollLeft = scrollRatio * cachedMaxScrollLeft;

            if (!isScrubFramePending) {
                isScrubFramePending = true;
                requestAnimationFrame(() => {
                    isScrubFramePending = false;
                    thumb.style.left = `${newThumbLeft}px`;
                    trackWrapper.scrollLeft = targetScrollLeft;
                    updateScrubTooltip(targetScrollLeft);
                });
            }

            if (e.cancelable) e.preventDefault();
        };

        const onDragEnd = () => {
            clearTimeout(grabTimer);
            if (isActivated) {
                isActivated = false;
                isDraggingBar = false;
                thumb.classList.remove('is-dragging');
                trackWrapper.style.scrollBehavior = '';
                document.body.style.userSelect = '';
                document.body.style.webkitUserSelect = '';
            }

            lastScrubLevel = null;
            cachedChipCenters = [];
            isScrubFramePending = false;

            window.removeEventListener('pointermove', onDragMove);
            window.removeEventListener('pointerup', onDragEnd);
            window.removeEventListener('pointercancel', onDragEnd);
            window.removeEventListener('mousemove', onDragMove);
            window.removeEventListener('mouseup', onDragEnd);
            window.removeEventListener('touchmove', onDragMove);
            window.removeEventListener('touchend', onDragEnd);
        };

        const onDragStart = (e) => {
            isActivated = false;
            startX = e.clientX ?? e.touches?.[0]?.clientX ?? e.changedTouches?.[0]?.clientX ?? 0;
            startY = e.clientY ?? e.touches?.[0]?.clientY ?? e.changedTouches?.[0]?.clientY ?? 0;
            startThumbLeft = parseFloat(thumb.style.left) || 0;

            // Short hold delay (~90ms threshold) before grab activates
            grabTimer = setTimeout(() => {
                activateGrab();
            }, 90);

            window.addEventListener('pointermove', onDragMove, { passive: false });
            window.addEventListener('pointerup', onDragEnd);
            window.addEventListener('pointercancel', onDragEnd);
            window.addEventListener('mousemove', onDragMove, { passive: false });
            window.addEventListener('mouseup', onDragEnd);
            window.addEventListener('touchmove', onDragMove, { passive: false });
            window.addEventListener('touchend', onDragEnd);

            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
        };

        thumb.addEventListener('pointerdown', onDragStart);
        thumb.addEventListener('mousedown', onDragStart);
        thumb.addEventListener('touchstart', onDragStart, { passive: false });

        customBar.addEventListener('click', (e) => {
            if (e.target === thumb || (e.target instanceof Node && thumb.contains(e.target))) return;
            const rect = customBar.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const thumbWidth = thumb.offsetWidth;
            const customBarWidth = customBar.clientWidth;
            const targetThumbLeft = Math.min(customBarWidth - thumbWidth, Math.max(0, clickX - thumbWidth / 2));
            const maxScrollLeft = trackWrapper.scrollWidth - trackWrapper.clientWidth;
            const maxThumbLeft = customBarWidth - thumbWidth;

            if (maxThumbLeft > 0) {
                const targetScrollLeft = (targetThumbLeft / maxThumbLeft) * maxScrollLeft;
                trackWrapper.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
            }
        });
    }

    if (scrollFirstBtn && trackWrapper) {
        scrollFirstBtn.addEventListener('click', () => {
            trackWrapper.scrollTo({ left: 0, behavior: 'smooth' });
        });
    }

    if (scrollLeftBtn && trackWrapper) {
        scrollLeftBtn.addEventListener('click', () => {
            trackWrapper.scrollBy({ left: -320, behavior: 'smooth' });
        });
    }

    if (scrollCurrentBtn) {
        scrollCurrentBtn.addEventListener('click', () => {
            const cumulativeLevel = getCumulativeHeroLevel(state);
            const currentKey = getActiveFilterKey(state);
            autoScrollToCompletedNode(cumulativeLevel);
            setTimeout(() => {
                saveCurrentFilterScrollPosition(currentKey);
            }, 650);
        });
    }

    if (scrollRightBtn && trackWrapper) {
        scrollRightBtn.addEventListener('click', () => {
            trackWrapper.scrollBy({ left: 320, behavior: 'smooth' });
        });
    }

    if (scrollLastBtn && trackWrapper) {
        scrollLastBtn.addEventListener('click', () => {
            trackWrapper.scrollTo({ left: trackWrapper.scrollWidth, behavior: 'smooth' });
        });
    }

    if (track) {
        track.addEventListener('click', (e) => {
            const target = /** @type {HTMLElement} */ (e.target);
            const resetBtn = target.closest('#home-hj-reset-filters-btn, .hero-journey-empty-filter-btn');
            if (resetBtn) {
                handleStateUpdate(() => {
                    if (!state.heroJourney) state.heroJourney = {};
                    state.heroJourney.unclaimedOnly = false;
                    state.heroJourney.typeFilter = null;
                }, true);
                renderHeroJourneyDisplay(state);
                return;
            }

            const hideBtn = target.closest('#home-hj-hide-btn');
            if (hideBtn) {
                handleStateUpdate(() => {
                    if (!state.heroJourney) state.heroJourney = {};
                    state.heroJourney.hidden = true;
                }, true);
                renderHeroJourneyDisplay(state, { skipAutoScroll: true });
                return;
            }

            const revealBtn = target.closest('#home-hj-reveal-btn');
            if (revealBtn) {
                const liveTrackWrapper = document.querySelector('.hero-journey-track-wrapper');
                const wasRevealed = Boolean(state.heroJourney?.revealBeyondTH);
                const currentScrollLeft = liveTrackWrapper ? liveTrackWrapper.scrollLeft : (trackWrapper ? trackWrapper.scrollLeft : 0);

                handleStateUpdate(() => {
                    if (!state.heroJourney) state.heroJourney = {};
                    state.heroJourney.revealBeyondTH = !wasRevealed;
                }, true);

                const currentKey = getActiveFilterKey(state);

                if (wasRevealed) {
                    renderHeroJourneyDisplay(state, { skipAutoScroll: true, scrollToTrackEnd: true });
                } else {
                    saveCurrentFilterScrollPosition(currentKey, currentScrollLeft);
                    renderHeroJourneyDisplay(state, { skipAutoScroll: true, targetScrollLeft: currentScrollLeft });
                }
                return;
            }
        });
    }

    const card = document.getElementById('home-hj-card') || document.querySelector('.hero-journey-card');
    if (card) {
        card.addEventListener('click', (e) => {
            const target = /** @type {HTMLElement} */ (e.target);
            const exploreBtn = target.closest('#home-hj-explore-btn');
            if (exploreBtn) {
                handleStateUpdate(() => {
                    if (!state.heroJourney) state.heroJourney = {};
                    state.heroJourney.hidden = false;
                }, true);
                renderHeroJourneyDisplay(state);
            }
        });
    }

    document.addEventListener('languageChanged', () => {
        renderHeroJourneyDisplay(state, { skipAutoScroll: true });
    });

    setupMountainClusterTouchInteractions();
}

/**
 * Enables smooth touch and cursor drag popping across hero mountain emblems.
 */
export function setupMountainClusterTouchInteractions() {
    const cluster = /** @type {HTMLElement | null} */ (document.querySelector('.hero-mountain-cluster'));
    if (!cluster || cluster.dataset.touchBound) return;
    cluster.dataset.touchBound = 'true';

    let activeSlot = null;

    const handlePointerMove = (e) => {
        const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? e.changedTouches?.[0]?.clientX;
        const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? e.changedTouches?.[0]?.clientY;

        if (clientX === undefined || clientY === undefined) return;

        const targetElem = document.elementFromPoint(clientX, clientY);
        const slot = targetElem ? targetElem.closest('.mountain-badge-slot') : null;

        if (slot !== activeSlot) {
            if (activeSlot) {
                activeSlot.classList.remove('active-pop');
            }
            activeSlot = slot;
            if (activeSlot) {
                activeSlot.classList.add('active-pop');
                triggerHaptic('tap');
            }
        }

        if (e.cancelable && e.type && e.type.startsWith('touch')) {
            e.preventDefault();
        }
    };

    const handlePointerEnd = () => {
        if (cluster) {
            cluster.querySelectorAll('.mountain-badge-slot').forEach(slot => {
                slot.classList.remove('active-pop');
                if (typeof slot.blur === 'function') slot.blur();
            });
        }
        if (document.activeElement && typeof /** @type {HTMLElement} */ (document.activeElement).blur === 'function') {
            /** @type {HTMLElement} */ (document.activeElement).blur();
        }
        activeSlot = null;

        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerEnd);
        window.removeEventListener('pointercancel', handlePointerEnd);
        window.removeEventListener('mousemove', handlePointerMove);
        window.removeEventListener('mouseup', handlePointerEnd);
        window.removeEventListener('touchmove', handlePointerMove);
        window.removeEventListener('touchend', handlePointerEnd);
    };

    const handlePointerStart = (e) => {
        handlePointerMove(e);

        window.addEventListener('pointermove', handlePointerMove, { passive: false });
        window.addEventListener('pointerup', handlePointerEnd);
        window.addEventListener('pointercancel', handlePointerEnd);
        window.addEventListener('mousemove', handlePointerMove, { passive: false });
        window.addEventListener('mouseup', handlePointerEnd);
        window.addEventListener('touchmove', handlePointerMove, { passive: false });
        window.addEventListener('touchend', handlePointerEnd);
    };

    cluster.addEventListener('pointerdown', handlePointerStart);
    cluster.addEventListener('touchstart', handlePointerStart, { passive: false });
}
