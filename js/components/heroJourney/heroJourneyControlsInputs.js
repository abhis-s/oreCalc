import { translate } from '../../i18n/translator.js';
import { showCardHelpPopover } from '../../utils/cardHelpPopover.js';
import {
    saveCurrentFilterScrollPosition,
    getActiveFilterKey,
    autoScrollToCompletedNode,
    isAutoScrolling,
    updateCustomScrollbar
} from '../home/heroJourneyScrollManager.js';
import { initHeroJourneyTrackKeyboardNav } from '../home/heroJourneyKeyboardNav.js';
import { triggerHaptic } from '../../services/hapticService.js';
import { hjState, buildStateFromPlayerData, syncPlayerToStorage } from './heroJourneyState.js';
import { renderTrackView, syncClaimSwitchPill } from './heroJourneyTrackRenderer.js';
import { renderTableView } from './heroJourneyTableRenderer.js';
import { renderPlayerSummary } from './heroJourneyPlayerRenderer.js';

/**
 * Synchronizes type filter buttons and select dropdowns across all filter bars.
 * @param {any} [hjState=null] - Hero Journey application state.
 */
export function syncTypeFiltersUI(hjState = null) {
    const activeFilter = hjState?.typeFilter || 'all';
    const allTypeBtns = document.querySelectorAll('.hj-type-btn');
    allTypeBtns.forEach(btn => {
        const filter = btn.getAttribute('data-type-filter');
        btn.classList.toggle('active', filter === activeFilter);
    });
    const allTypeSelects = document.querySelectorAll('.hj-type-select');
    allTypeSelects.forEach(select => {
        /** @type {HTMLSelectElement} */ (select).value = activeFilter;
    });
}

/**
 * Resets active milestone filters and triggers UI re-render.
 * @param {any} hjState - Hero Journey state.
 * @param {() => void} renderUI - Render coordinator callback.
 */
export function resetFilters(hjState, renderUI) {
    hjState.unclaimedOnly = false;
    hjState.typeFilter = 'all';
    if (hjState.playerData) {
        syncPlayerToStorage(hjState.playerData, hjState);
    }
    const typeBtns = document.querySelectorAll('.hj-type-btn');
    typeBtns.forEach(b => b.classList.remove('active'));
    const typeSelects = document.querySelectorAll('.hj-type-select');
    typeSelects.forEach(s => { /** @type {HTMLSelectElement} */ (s).value = 'all'; });
    renderUI();
}

/**
 * Initializes interactive controls, filter buttons, table toggles, and track interactions.
 * @param {any} hjState - Hero Journey state.
 * @param {() => void} renderUI - Render coordinator callback.
 * @param {() => void} resetFiltersFn - Reset filters callback.
 */
export function initHeroJourneyControls(hjState, renderUI, resetFiltersFn) {
    const accelSwitch = document.getElementById('home-hj-accelerated-switch');
    if (accelSwitch) {
        accelSwitch.addEventListener('change', (e) => {
            const target = /** @type {HTMLInputElement} */ (e.target);
            hjState.isAccelerated = target.checked;

            if (hjState.playerData) {
                syncPlayerToStorage(hjState.playerData, hjState);
            }

            renderTrackView();
            renderTableView();
            renderPlayerSummary();
        });
    }

    const claimSwitches = document.querySelectorAll('.hj-segmented-switch');
    claimSwitches.forEach(claimSwitch => {
        const btns = claimSwitch.querySelectorAll('.hj-switch-btn');
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                const isUnclaimed = btn.getAttribute('data-unclaimed-only') === 'true';
                hjState.unclaimedOnly = isUnclaimed;
                if (hjState.playerData) {
                    syncPlayerToStorage(hjState.playerData, hjState);
                }
                syncClaimSwitchPill();
                renderTrackView();
                renderTableView();
            });
        });
    });

    const typeFilterContainers = document.querySelectorAll('.hj-type-filters');
    typeFilterContainers.forEach(container => {
        const typeBtns = container.querySelectorAll('.hj-type-btn');
        typeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.getAttribute('data-type-filter') || 'all';
                if (hjState.typeFilter === filter) {
                    hjState.typeFilter = 'all';
                } else {
                    hjState.typeFilter = filter;
                }
                syncTypeFiltersUI(hjState);
                if (hjState.playerData) {
                    syncPlayerToStorage(hjState.playerData, hjState);
                }
                renderTrackView();
                renderTableView();
            });
        });

        const typeSelect = container.querySelector('.hj-type-select');
        if (typeSelect) {
            typeSelect.addEventListener('change', (e) => {
                const target = /** @type {HTMLSelectElement} */ (e.target);
                hjState.typeFilter = target.value;
                syncTypeFiltersUI(hjState);
                if (hjState.playerData) {
                    syncPlayerToStorage(hjState.playerData, hjState);
                }
                renderTrackView();
                renderTableView();
            });
        }
    });

    const trackWrapper = document.getElementById('home-hj-track-wrapper');
    if (trackWrapper) {
        document.getElementById('home-hj-scroll-first')?.addEventListener('click', () => {
            trackWrapper.scrollTo({ left: 0, behavior: 'smooth' });
        });
        document.getElementById('home-hj-scroll-last')?.addEventListener('click', () => {
            trackWrapper.scrollTo({ left: trackWrapper.scrollWidth, behavior: 'smooth' });
        });
        document.getElementById('home-hj-scroll-left')?.addEventListener('click', () => {
            trackWrapper.scrollBy({ left: -450, behavior: 'smooth' });
        });
        document.getElementById('home-hj-scroll-right')?.addEventListener('click', () => {
            trackWrapper.scrollBy({ left: 450, behavior: 'smooth' });
        });
        document.getElementById('home-hj-scroll-current')?.addEventListener('click', () => {
            const state = buildStateFromPlayerData(hjState.playerData, hjState);
            const currentKey = getActiveFilterKey(state);
            autoScrollToCompletedNode(hjState.cumulativeLevel);
            setTimeout(() => {
                saveCurrentFilterScrollPosition(currentKey);
            }, 650);
        });
    }

    const toggleTableBtn = document.getElementById('hj-btn-toggle-table');
    if (toggleTableBtn) {
        toggleTableBtn.addEventListener('click', () => {
            if (hjState.tableMaximized) {
                hjState.tableMaximized = false;
                renderUI();
                const target = document.querySelector('.hero-journey-page__view-toggle-bar') || document.getElementById('hj-table-wrapper');
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                return;
            }

            hjState.showTable = !hjState.showTable;
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem('orecalc_hj_table_expanded', String(hjState.showTable));
            }
            if (hjState.playerData) {
                syncPlayerToStorage(hjState.playerData, hjState);
            }
            renderUI();
            if (hjState.showTable) {
                const target = document.querySelector('.hero-journey-page__view-toggle-bar') || document.getElementById('hj-table-wrapper');
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    }

    const expandTableBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('expand-hj-table-btn'));
    if (expandTableBtn) {
        expandTableBtn.addEventListener('click', () => {
            hjState.tableMaximized = !hjState.tableMaximized;
            renderUI();
            if (hjState.tableMaximized) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                const target = document.querySelector('.hero-journey-page__view-toggle-bar') || document.getElementById('hj-table-wrapper');
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    }

    const nodesTrack = document.getElementById('home-hj-nodes-track');
    if (nodesTrack) {
        nodesTrack.addEventListener('click', (e) => {
            const target = /** @type {HTMLElement} */ (e.target);
            const revealBtn = target.closest('#home-hj-reveal-btn');
            if (revealBtn) {
                hjState.revealBeyondTH = !hjState.revealBeyondTH;
                if (hjState.playerData) {
                    syncPlayerToStorage(hjState.playerData, hjState);
                }
                renderTrackView();
                return;
            }

            const showTableBtn = target.closest('#hj-show-table-btn');
            if (showTableBtn) {
                hjState.showTable = true;
                if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.setItem('orecalc_hj_table_expanded', 'true');
                }
                if (hjState.playerData) {
                    syncPlayerToStorage(hjState.playerData, hjState);
                }
                renderUI();
                const targetEl = document.querySelector('.hero-journey-page__view-toggle-bar') || document.getElementById('hj-table-wrapper');
                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                return;
            }

            const hideBtn = target.closest('#home-hj-hide-btn');
            if (hideBtn) {
                hjState.revealBeyondTH = false;
                if (hjState.playerData) {
                    syncPlayerToStorage(hjState.playerData, hjState);
                }
                renderTrackView();
                return;
            }
        });
    }

    document.addEventListener('click', (e) => {
        const target = /** @type {HTMLElement} */ (e.target);
        const btn = /** @type {HTMLElement | null} */ (target.closest('[data-info], .info-btn, .info-button'));
        if (btn) {
            e.stopPropagation();
            const key = btn.getAttribute('data-info');
            if (key) {
                const text = translate(key);
                showCardHelpPopover(btn, text, { isToggle: true });
            }
        }

        const clearFilterBtn = target.closest('#hj-table-clear-filters-btn, #hj-clear-filters-btn, #hj-reset-filters-btn');
        if (clearFilterBtn) {
            resetFiltersFn();
            return;
        }

        const collapseBtn = target.closest('#hj-profile-collapse-btn');
        if (collapseBtn) {
            const card = document.getElementById('hj-player-card');
            if (card) {
                const willBeCollapsed = !card.classList.contains('is-stats-collapsed');
                card.classList.toggle('is-stats-collapsed', willBeCollapsed);
                collapseBtn.setAttribute('aria-expanded', String(!willBeCollapsed));
                const label = willBeCollapsed ? translate('views.home.profile.expandStats') : translate('views.home.profile.collapseStats');
                collapseBtn.setAttribute('aria-label', label);
                collapseBtn.setAttribute('title', label);
                const icon = collapseBtn.querySelector('.collapse-chevron-icon, orecalc-assets-svg');
                if (icon) {
                    icon.setAttribute('name', willBeCollapsed ? 'chevron-down' : 'chevron-up');
                }
                if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.setItem('orecalc_hj_profile_stats_collapsed', String(willBeCollapsed));
                }
            }
        }
    });
}

/**
 * Initializes the draggable and scrubbable custom horizontal scrollbar.
 */
export function initCustomScrollbar() {
    const trackWrapper = /** @type {HTMLElement | null} */ (document.getElementById('home-hj-track-wrapper'));
    const customBar = /** @type {HTMLElement | null} */ (document.getElementById('home-hj-custom-scrollbar'));
    const thumb = /** @type {HTMLElement | null} */ (document.getElementById('home-hj-scrollbar-thumb'));
    const scrubTooltip = /** @type {HTMLElement | null} */ (document.getElementById('home-hj-scrub-tooltip'));

    if (!trackWrapper || !customBar || !thumb) return;

    initHeroJourneyTrackKeyboardNav(trackWrapper);

    let isDraggingBar = false;
    let isScrollTickPending = false;

    trackWrapper.addEventListener('scroll', () => {
        const state = buildStateFromPlayerData(hjState.playerData, hjState);
        const currentFilter = getActiveFilterKey(state);
        saveCurrentFilterScrollPosition(currentFilter);
        if (isAutoScrolling()) return;
        if (!isScrollTickPending) {
            isScrollTickPending = true;
            requestAnimationFrame(() => {
                isScrollTickPending = false;
                updateCustomScrollbar(isDraggingBar, state);
            });
        }
    }, { passive: true });

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

    window.addEventListener('resize', () => {
        const state = buildStateFromPlayerData(hjState.playerData, hjState);
        updateCustomScrollbar(isDraggingBar, state);
    }, { passive: true });
}
