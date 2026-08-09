import { renderHeroJourneyDisplay, autoScrollToCompletedNode, saveCurrentFilterScrollPosition, getActiveFilterKey, isAutoScrolling, updateCustomScrollbar } from './heroJourneyDisplay.js';
import { getCumulativeHeroLevel, getMaxCumulativeLevelsByTH } from '../../incomeCalculations/heroJourneyIncome.js';
import { heroJourneyNodes } from '../../data/heroJourneyData.js';
import { handleStateUpdate } from '../../core/stateManager.js';
import { triggerHaptic } from '../../services/hapticService.js';

let isBound = false;

/**
 * Initializes and binds all event listeners for the Hero's Journey component.
 */
export function setupHeroJourneyInputs(state) {
    if (isBound) return;
    isBound = true;

    // Accelerated Rewards Switch (Normal vs Accelerated)
    const acceleratedSwitch = document.getElementById('home-hj-accelerated-switch');
    if (acceleratedSwitch) {
        const isAccelerated = Boolean(state?.heroJourney?.acceleratedRewards ?? state?.heroJourney?.accelerated ?? (state?.heroJourney?.rewardMode === 'accelerated'));
        acceleratedSwitch.checked = isAccelerated;

        acceleratedSwitch.addEventListener('change', (e) => {
            handleStateUpdate(() => {
                if (!state.heroJourney) state.heroJourney = {};
                state.heroJourney.acceleratedRewards = e.target.checked;
            });
        });
    }

    // Claim Segmented Switch (All vs Unclaimed)
    const claimSwitch = document.getElementById('home-hj-claim-switch');
    if (claimSwitch) {
        claimSwitch.addEventListener('click', (e) => {
            const btn = e.target.closest('.hj-switch-btn');
            if (!btn) return;

            const claimFilter = btn.dataset.claimFilter;
            if (!claimFilter) return;

            if (!state.heroJourney) state.heroJourney = {};
            state.heroJourney.claimFilter = claimFilter;
            renderHeroJourneyDisplay(state);
        });
    }

    // Type Filter Buttons & Select Dropdown
    const typeFilterContainer = document.getElementById('home-hj-type-filters');
    if (typeFilterContainer) {
        typeFilterContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.hj-type-btn');
            if (!btn) return;

            if (!state.heroJourney) state.heroJourney = {};
            const clickedType = btn.dataset.typeFilter;
            if (state.heroJourney.typeFilter === clickedType) {
                state.heroJourney.typeFilter = null;
            } else {
                state.heroJourney.typeFilter = clickedType;
            }

            renderHeroJourneyDisplay(state);
        });
    }

    const typeSelect = document.getElementById('home-hj-type-select');
    if (typeSelect) {
        typeSelect.addEventListener('change', (e) => {
            if (!state.heroJourney) state.heroJourney = {};
            const val = e.target.value;
            state.heroJourney.typeFilter = val === 'all' ? null : val;
            renderHeroJourneyDisplay(state);
        });
    }

    // Horizontal Track Scroll Controls
    const scrollFirstBtn = document.getElementById('home-hj-scroll-first');
    const scrollLeftBtn = document.getElementById('home-hj-scroll-left');
    const scrollCurrentBtn = document.getElementById('home-hj-scroll-current');
    const scrollRightBtn = document.getElementById('home-hj-scroll-right');
    const scrollLastBtn = document.getElementById('home-hj-scroll-last');
    const trackWrapper = document.querySelector('.hero-journey-track-wrapper');
    const track = document.getElementById('home-hj-nodes-track');
    const customBar = document.getElementById('home-hj-custom-scrollbar');
    const thumb = document.getElementById('home-hj-scrollbar-thumb');

    let isDraggingBar = false;

    if (trackWrapper) {
        trackWrapper.addEventListener('scroll', () => {
            updateCustomScrollbar(isDraggingBar);
            if (isAutoScrolling()) return;
            const currentKey = getActiveFilterKey(state);
            saveCurrentFilterScrollPosition(currentKey);
        }, { passive: true });
    }

    // Custom Scrollbar Dragging & Track Click Handling
    if (customBar && thumb && trackWrapper) {
        let isActivated = false;
        let grabTimer = null;
        let startX = 0;
        let startY = 0;
        let startThumbLeft = 0;

        const activateGrab = () => {
            if (isActivated) return;
            isActivated = true;
            isDraggingBar = true;
            thumb.classList.add('is-dragging');
            trackWrapper.style.scrollBehavior = 'auto';
            document.body.style.userSelect = 'none';
            document.body.style.webkitUserSelect = 'none';

            // Haptic feedback on grab!
            triggerHaptic('select');
        };

        const onDragMove = (e) => {
            const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? e.changedTouches?.[0]?.clientX ?? 0;
            const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? e.changedTouches?.[0]?.clientY ?? 0;
            const deltaX = clientX - startX;
            const deltaY = clientY - startY;

            if (!isActivated) {
                // If moved more than 4px horizontally, activate grab immediately!
                if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
                    clearTimeout(grabTimer);
                    activateGrab();
                } else {
                    return;
                }
            }

            const customBarWidth = customBar.clientWidth;
            const thumbWidth = thumb.offsetWidth;
            const maxThumbLeft = customBarWidth - thumbWidth;
            const newThumbLeft = Math.min(maxThumbLeft, Math.max(0, startThumbLeft + deltaX));

            // Instant visual thumb position on drag frame
            thumb.style.left = `${newThumbLeft}px`;

            // Instant track scroll position (no smooth animation lag while dragging)
            const maxScrollLeft = trackWrapper.scrollWidth - trackWrapper.clientWidth;
            if (maxThumbLeft > 0) {
                trackWrapper.scrollLeft = (newThumbLeft / maxThumbLeft) * maxScrollLeft;
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
            if (e.target === thumb || thumb.contains(e.target)) return;
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

    // Event delegation for Node Claim and Reveal buttons
    if (track) {
        track.addEventListener('click', (e) => {
            const revealBtn = e.target.closest('#home-hj-reveal-btn');
            if (revealBtn) {
                if (!state.heroJourney) state.heroJourney = {};
                state.heroJourney.revealBeyondTH = !state.heroJourney.revealBeyondTH;
                renderHeroJourneyDisplay(state, { skipAutoScroll: true });
                return;
            }

            const claimBtn = e.target.closest('.node-claim-btn');
            if (!claimBtn) return;

            const level = parseInt(claimBtn.dataset.nodeLevel, 10);
            if (isNaN(level)) return;

            toggleNodeClaimStatus(state, level);
        });
    }

    setupMountainClusterTouchInteractions();
}

/**
 * Enables smooth touch and cursor drag popping across hero mountain emblems.
 */
function setupMountainClusterTouchInteractions() {
    const cluster = document.querySelector('.hero-mountain-cluster');
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
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
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

/**
 * Toggles explicit claim or unclaim override for a given milestone node level.
 */
function toggleNodeClaimStatus(state, level) {
    if (!state.heroJourney) state.heroJourney = {};
    if (!state.heroJourney.overrideUnclaimed) state.heroJourney.overrideUnclaimed = [];

    const cumulativeLevel = getCumulativeHeroLevel(state);
    const maxLevelsByTH = getMaxCumulativeLevelsByTH();
    const allMaxValues = Object.values(maxLevelsByTH);
    const overallTrueMaxLevel = allMaxValues.length > 0 ? Math.max(...allMaxValues) : 0;
    const isTrueMaxPlayer = cumulativeLevel >= overallTrueMaxLevel && overallTrueMaxLevel > 0;

    // Do not allow true max players to toggle claim status or unclaim anything
    if (isTrueMaxPlayer) {
        return;
    }

    const isReached = cumulativeLevel >= level;

    // Do not allow claiming unreached future nodes
    if (!isReached) {
        return;
    }

    const node = heroJourneyNodes.find(n => n.level === level);

    let overrideUnclaimedSet = new Set(state.heroJourney.overrideUnclaimed);
    const currentlyClaimed = !overrideUnclaimedSet.has(level);

    if (currentlyClaimed) {
        // Do not allow unclaiming nodes that are not ores, quests, or equipment
        const isAllowedTypeToUnclaim = node && ['quest', 'ore', 'equipment'].includes(node.type);
        if (!isAllowedTypeToUnclaim) {
            return;
        }

        // Do not allow undoing a claim that is more than 10 levels behind
        if (cumulativeLevel - level > 10) {
            return;
        }
        overrideUnclaimedSet.add(level);
    } else {
        overrideUnclaimedSet.delete(level);
    }

    handleStateUpdate(() => {
        state.heroJourney.overrideUnclaimed = Array.from(overrideUnclaimedSet);
    });
}
