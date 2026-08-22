import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';

import { dom } from '../../dom/domElements.js';
import { triggerHaptic } from '../../services/hapticService.js';
import { showToast } from '../../ui/toast.js';

let isRefreshing = false;

/**
 * Initializes mobile pull-to-refresh swipe gesture listeners with multi-stage reload triggers.
 */
export function initializePullToRefresh() {
    if (document.getElementById('pull-to-refresh-container')) return;

    const ptrContainer = document.createElement('div');
    ptrContainer.id = 'pull-to-refresh-container';
    ptrContainer.className = 'pull-to-refresh-container';
    ptrContainer.innerHTML = `
        <div class="ptr-content">
            <div class="ptr-icon-wrapper">
                <orecalc-assets-svg name="refresh" class="ptr-icon"></orecalc-assets-svg>
            </div>
            <span class="ptr-label">${translate('actions.pullToRefresh')}</span>
        </div>
    `;
    document.body.appendChild(ptrContainer);

    const ptrIconWrapper = ptrContainer.querySelector('.ptr-icon-wrapper svg');
    const ptrLabel = ptrContainer.querySelector('.ptr-label');
    const mainContainer = document.querySelector('.container');

    let startY = 0;
    let startX = 0;
    let isPulling = false;
    let currentStage = 0; // 0: initial, 1: sync data, 2: hard reload app
    const STAGE1_THRESHOLD = 110;
    const STAGE2_THRESHOLD = 165;

    const isTargetExcluded = (target) => {
        if (!target) return false;
        if (state.isChipDragging || document.querySelector('.card-drag-preview-pill') || document.querySelector('.dragging') || document.querySelector('.dragging-clone')) {
            return true;
        }
        return Boolean(target.closest(
            '.modal, .player-dropdown-list, .hero-carousel, .updatable, input, textarea, select, button, .eq-details-modal, .priority-list-modal, .welcome-modal, .card-drag-handle, .drag-handle, .income-chip, .dragging, .dragging-clone, .card-drag-preview-pill'
        ));
    };

    const handleTouchStart = (e) => {
        if (isRefreshing) return;
        if (window.scrollY > 2) return;
        if (isTargetExcluded(e.target)) return;

        const activeOverlay = document.querySelector('.modal-overlay.active, .modal.open, .welcome-modal.active');
        if (activeOverlay) return;

        startY = e.touches[0].clientY;
        startX = e.touches[0].clientX;
        isPulling = false;
        currentStage = 0;
    };

    const resetPTRVisuals = () => {
        ptrContainer.classList.remove('ptr-threshold', 'ptr-stage2', 'ptr-releasing', 'ptr-success');
        ptrContainer.style.transform = '';
        ptrContainer.style.opacity = '0';

        if (mainContainer) {
            mainContainer.style.transition = 'transform 0.2s ease-out';
            mainContainer.style.transform = '';
        }

        if (ptrLabel) ptrLabel.textContent = translate('actions.pullToRefresh');
        if (ptrIconWrapper) ptrIconWrapper.style.transform = '';

        isPulling = false;
        currentStage = 0;
    };

    const handleTouchMove = (e) => {
        if (startY === 0 || isRefreshing) return;
        if (isTargetExcluded(e.target)) {
            if (isPulling) {
                resetPTRVisuals();
            }
            startY = 0;
            return;
        }

        const currentY = e.touches[0].clientY;
        const currentX = e.touches[0].clientX;

        const diffY = currentY - startY;
        const diffX = currentX - startX;

        // If page has scrolled down or panning horizontally, cancel PTR session
        if (window.scrollY > 2 || Math.abs(diffX) > Math.max(15, diffY * 0.8)) {
            if (isPulling) {
                resetPTR();
            }
            startY = 0;
            return;
        }

        // If finger moved back up to top (diffY < 10), retract visuals without clearing startY session
        if (diffY < 10) {
            if (isPulling) {
                resetPTRVisuals();
            }
            return;
        }

        if (!isPulling) {
            isPulling = true;
            ptrContainer.classList.remove('ptr-releasing', 'ptr-resetting', 'ptr-success');
        }

        const pullDistance = Math.min(185, Math.pow(diffY - 10, 0.85) * 2.3);
        const contentPullDistance = Math.min(75, Math.pow(diffY - 10, 0.75) * 1.35);
        const opacity = Math.min(1, pullDistance / 20);
        const rotation = (pullDistance / STAGE1_THRESHOLD) * 180;

        ptrContainer.style.transform = `translate3d(-50%, ${pullDistance}px, 0)`;
        ptrContainer.style.opacity = String(opacity);

        if (mainContainer) {
            mainContainer.style.transition = 'none';
            mainContainer.style.transform = `translate3d(0, ${contentPullDistance}px, 0)`;
        }

        if (ptrIconWrapper) {
            ptrIconWrapper.style.transform = `rotate(${rotation}deg)`;
        }

        // Two-Stage Threshold Logic
        if (pullDistance >= STAGE2_THRESHOLD) {
            if (currentStage !== 2) {
                currentStage = 2;
                ptrContainer.classList.remove('ptr-threshold');
                ptrContainer.classList.add('ptr-stage2');
                if (ptrLabel) ptrLabel.textContent = translate('actions.releaseToReloadApp');
                triggerHaptic('toggle');
            }
        } else if (pullDistance >= STAGE1_THRESHOLD) {
            if (currentStage !== 1) {
                currentStage = 1;
                ptrContainer.classList.remove('ptr-stage2');
                ptrContainer.classList.add('ptr-threshold');
                if (ptrLabel) ptrLabel.textContent = translate('actions.releaseToSync');
                triggerHaptic('light');
            }
        } else {
            if (currentStage !== 0) {
                currentStage = 0;
                ptrContainer.classList.remove('ptr-threshold', 'ptr-stage2');
                if (ptrLabel) ptrLabel.textContent = translate('actions.pullToRefresh');
            }
        }
    };

    const handleTouchEnd = async () => {
        if (!isPulling || isRefreshing) {
            startY = 0;
            return;
        }

        startY = 0;

        if (currentStage === 2) {
            triggerHardReload();
        } else if (currentStage === 1) {
            triggerRefresh();
        } else {
            resetPTR();
        }
    };

    const triggerRefresh = async () => {
        isRefreshing = true;
        ptrContainer.classList.add('ptr-releasing');

        if (mainContainer) {
            mainContainer.style.transition = 'transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            mainContainer.style.transform = 'translate3d(0, 50px, 0)';
        }

        const activeTag = state.savedPlayerTags?.[0];
        const hasValidTag = activeTag && activeTag !== 'DEFAULT0';

        if (!hasValidTag) {
            ptrContainer.style.transform = 'translate3d(-50%, 90px, 0)';
            ptrContainer.style.opacity = '1';
            if (ptrLabel) ptrLabel.textContent = translate('alerts.noPlayerToRefresh');
            showToast(translate('alerts.noPlayerToRefresh'), 'warning');
            triggerHaptic('warning');

            setTimeout(() => {
                resetPTR();
            }, 1000);
            return;
        }

        ptrContainer.classList.add('ptr-refreshing');
        ptrContainer.style.transform = 'translate3d(-50%, 90px, 0)';
        ptrContainer.style.opacity = '1';
        if (ptrLabel) ptrLabel.textContent = translate('actions.refreshingState');

        try {
            const refreshBtn = dom.controls?.refreshButton;
            if (refreshBtn) {
                refreshBtn.click();
            }
            await new Promise(resolve => setTimeout(resolve, 1200));

            ptrContainer.classList.remove('ptr-refreshing');
            ptrContainer.classList.add('ptr-success');
            if (ptrLabel) ptrLabel.textContent = translate('actions.synced');
            triggerHaptic('success');

            setTimeout(() => {
                resetPTR();
            }, 600);
        } catch (err) {
            resetPTR();
        }
    };

    const triggerHardReload = async () => {
        isRefreshing = true;
        ptrContainer.classList.add('ptr-releasing', 'ptr-refreshing', 'ptr-stage2');

        if (mainContainer) {
            mainContainer.style.transition = 'transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            mainContainer.style.transform = 'translate3d(0, 55px, 0)';
        }

        ptrContainer.style.transform = 'translate3d(-50%, 90px, 0)';
        ptrContainer.style.opacity = '1';
        if (ptrLabel) ptrLabel.textContent = translate('actions.reloadingApp');
        triggerHaptic('success');

        setTimeout(() => {
            window.location.reload();
        }, 450);
    };

    const resetPTR = () => {
        ptrContainer.classList.add('ptr-resetting');
        ptrContainer.classList.remove('ptr-threshold', 'ptr-stage2', 'ptr-refreshing', 'ptr-success');
        ptrContainer.style.transform = '';
        ptrContainer.style.opacity = '0';

        if (mainContainer) {
            mainContainer.style.transition = 'transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            mainContainer.style.transform = '';
        }

        setTimeout(() => {
            ptrContainer.classList.remove('ptr-resetting', 'ptr-releasing');
            if (ptrLabel) ptrLabel.textContent = translate('actions.pullToRefresh');
            if (ptrIconWrapper) ptrIconWrapper.style.transform = '';
            if (mainContainer) mainContainer.style.transition = '';
            isRefreshing = false;
            isPulling = false;
            currentStage = 0;
        }, 350);
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });
}
