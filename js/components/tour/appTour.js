import { tourSets, tourSteps } from '../../data/tourData.js';
import { translate } from '../../i18n/translator.js';

import { MOTION_DURATION_FAST_MS, MOTION_DURATION_MODERATE_MS } from '../../core/constants.js';
import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { closeAllModals } from '../../utils/modalHistoryManager.js';

import { showConfirm } from '../../ui/noticeModal.js';
import { closeStoredOresModal } from '../planner/priorityListModal.js';

let activeSteps = [];
let currentStepIndex = 0;
let lastStepIndex = -1;
let highlightBox = null;
let tooltipEl = null;
let snakeSVG = null;
let snakeRect = null;
let snakeAnim = null;

function parseOrderParts(order) {
    if (order === undefined || order === null) return [0];
    if (typeof order === 'number') return [order];
    return String(order).split('.').map(n => Number(n) || 0);
}

function compareOrders(aOrder, bOrder) {
    const aParts = parseOrderParts(aOrder);
    const bParts = parseOrderParts(bOrder);
    const maxLen = Math.max(aParts.length, bParts.length);

    for (let i = 0; i < maxLen; i++) {
        const valA = aParts[i] ?? 0;
        const valB = bParts[i] ?? 0;
        if (valA !== valB) return valA - valB;
    }
    return 0;
}

function resolveSteps(lastTourTimestamp) {
    const setRelease = Object.fromEntries(
        tourSets.map(s => [s.id, s.releasedAt])
    );

    return tourSteps
        .filter(step => {
            const setTime = setRelease[step.setId] ?? 0;
            // Show step if the user has never completed the tour (timestamp is undefined, null, or 0)
            if (lastTourTimestamp === undefined || lastTourTimestamp === null || lastTourTimestamp === 0) {
                return true;
            }
            // Otherwise, only show steps added after the user's last tour completion
            return setTime > lastTourTimestamp;
        })
        .sort((a, b) => compareOrders(a.order, b.order));
}

// Creates (or reuses) the SVG snake overlay inside the highlight box.
function updateSnakeSVG(w, h) {
    const r = 18;           // border-radius of the outer ring
    const offset = 6;       // gap between highlight box edge and snake ring
    const svgW = w + offset * 2;
    const svgH = h + offset * 2;

    if (!snakeSVG) {
        snakeSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        snakeSVG.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible;';

        snakeRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        snakeRect.setAttribute('fill', 'none');
        snakeRect.setAttribute('stroke-linecap', 'round');
        snakeRect.setAttribute('stroke-width', '2');

        snakeAnim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
        snakeAnim.setAttribute('attributeName', 'stroke-dashoffset');
        snakeAnim.setAttribute('repeatCount', 'indefinite');
        snakeAnim.setAttribute('calcMode', 'linear');

        snakeRect.appendChild(snakeAnim);
        snakeSVG.appendChild(snakeRect);
        highlightBox.appendChild(snakeSVG);
    }

    const perimeter = 2 * (svgW + svgH) - 8 * r + 2 * Math.PI * r;
    const SPEED_PX_PER_S = 260;
    const dur = (perimeter / SPEED_PX_PER_S).toFixed(3);
    const snakeLen = perimeter * 0.12;

    snakeRect.setAttribute('x', String(-offset));
    snakeRect.setAttribute('y', String(-offset));
    snakeRect.setAttribute('width', String(svgW));
    snakeRect.setAttribute('height', String(svgH));
    snakeRect.setAttribute('rx', String(r));
    snakeRect.setAttribute('ry', String(r));
    snakeRect.setAttribute('stroke', 'var(--accent-primary, #6c8aff)');
    snakeRect.setAttribute('stroke-dasharray', `${snakeLen} ${perimeter - snakeLen}`);

    snakeAnim.setAttribute('dur', `${dur}s`);
    snakeAnim.setAttribute('values', `0;${-perimeter}`);
}

function resolveTargetElement(targetProp) {
    const rawTarget = typeof targetProp === 'function' ? targetProp() : targetProp;
    if (typeof rawTarget === 'string') {
        return document.querySelector(rawTarget);
    }
    if (rawTarget instanceof Element || (rawTarget && rawTarget.nodeType === 1)) {
        return rawTarget;
    }
    return null;
}

function updatePositions() {
    if (currentStepIndex < 0 || currentStepIndex >= activeSteps.length) return;
    const step = activeSteps[currentStepIndex];
    const target = resolveTargetElement(step.target);
    if (!target || !highlightBox || !tooltipEl) return;

    let rect = target.getBoundingClientRect();

    // Special case: if target is the player dropdown container and list is expanded,
    // merge their bounding rects so the highlight box wraps the entire expanded dropdown.
    if (target.classList.contains('player-dropdown-container')) {
        const dropdownList = target.querySelector('.player-dropdown-list.show');
        if (dropdownList) {
            const listRect = dropdownList.getBoundingClientRect();
            rect = {
                top: Math.min(rect.top, listRect.top),
                left: Math.min(rect.left, listRect.left),
                right: Math.max(rect.right, listRect.right),
                bottom: Math.max(rect.bottom, listRect.bottom),
                width: Math.max(rect.right, listRect.right) - Math.min(rect.left, listRect.left),
                height: Math.max(rect.bottom, listRect.bottom) - Math.min(rect.top, listRect.top)
            };
        }
    }

    // Special case: if target is the fab container and the menu is visible,
    // merge their bounding rects so the highlight box wraps the expanded menu.
    if (target.classList.contains('fab-container')) {
        const fabMenu = target.querySelector('.fab-menu.show');
        if (fabMenu) {
            const menuRect = fabMenu.getBoundingClientRect();
            rect = {
                top: Math.min(rect.top, menuRect.top),
                left: Math.min(rect.left, menuRect.left),
                right: Math.max(rect.right, menuRect.right),
                bottom: Math.max(rect.bottom, menuRect.bottom),
                width: Math.max(rect.right, menuRect.right) - Math.min(rect.left, menuRect.left),
                height: Math.max(rect.bottom, menuRect.bottom) - Math.min(rect.top, menuRect.top)
            };
        }
    }

    const padding = 6;

    highlightBox.style.top = `${rect.top - padding}px`;
    highlightBox.style.left = `${rect.left - padding}px`;
    highlightBox.style.width = `${rect.width + padding * 2}px`;
    highlightBox.style.height = `${rect.height + padding * 2}px`;
    highlightBox.style.display = 'block';

    updateSnakeSVG(rect.width + padding * 2, rect.height + padding * 2);
    const placement = typeof step.placement === 'function' ? step.placement() : step.placement;
    positionTooltip(rect, tooltipEl, placement);
}

function positionTooltip(highlightRect, tooltip, placement) {
    const prevTransform = tooltip.style.transform;
    tooltip.style.transform = 'none';
    const tooltipWidth = tooltip.offsetWidth || tooltip.getBoundingClientRect().width;
    const tooltipHeight = tooltip.offsetHeight || tooltip.getBoundingClientRect().height;
    tooltip.style.transform = prevTransform;

    const margin = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Compute ideal top/left for each cardinal placement
    function compute(p) {
        switch (p) {
            case 'bottom':
                return {
                    top: highlightRect.bottom + margin,
                    left: highlightRect.left + (highlightRect.width - tooltipWidth) / 2
                };
            case 'top':
                return {
                    top: highlightRect.top - tooltipHeight - margin,
                    left: highlightRect.left + (highlightRect.width - tooltipWidth) / 2
                };
            case 'left':
                return {
                    top: highlightRect.top + (highlightRect.height - tooltipHeight) / 2,
                    left: highlightRect.left - tooltipWidth - margin
                };
            case 'right':
                return {
                    top: highlightRect.top + (highlightRect.height - tooltipHeight) / 2,
                    left: highlightRect.right + margin
                };
            default:
                return { top: 0, left: 0 };
        }
    }

    // Returns true if a position fits fully within the viewport
    function fits({ top, left }) {
        return (
            top >= margin &&
            left >= margin &&
            top + tooltipHeight <= vh - margin &&
            left + tooltipWidth <= vw - margin
        );
    }

    // Try preferred placement first, then its natural opposites, then remaining sides
    const fallbackOrder = {
        bottom: ['bottom', 'top', 'right', 'left'],
        top:    ['top', 'bottom', 'right', 'left'],
        left:   ['left', 'right', 'top', 'bottom'],
        right:  ['right', 'left', 'top', 'bottom'],
    };
    const order = fallbackOrder[placement] ?? ['bottom', 'top', 'right', 'left'];

    let finalPos = null;
    for (const p of order) {
        const pos = compute(p);
        if (fits(pos)) {
            finalPos = pos;
            break;
        }
    }

    // No placement fits cleanly — use the preferred one and hard-clamp to viewport
    if (!finalPos) {
        finalPos = compute(placement);
    }

    // Always clamp both axes so the tooltip is never partially off-screen
    const maxLeft = Math.max(margin, vw - tooltipWidth - margin);
    const maxTop = Math.max(margin, vh - tooltipHeight - margin);
    finalPos.left = Math.max(margin, Math.min(maxLeft, finalPos.left));
    finalPos.top  = Math.max(margin, Math.min(maxTop, finalPos.top));

    tooltip.style.left = `${finalPos.left}px`;
    tooltip.style.top  = `${finalPos.top}px`;
}

async function showStep() {
    if (currentStepIndex < 0 || currentStepIndex >= activeSteps.length) {
        finishTour();
        return;
    }

    const step = activeSteps[currentStepIndex];

    if (state.activeTab !== `${step.tab}-tab`) {
        const tabButton = document.querySelector(`[data-tab="${step.tab}"]`);
        if (tabButton) {
            tabButton.click();
            await new Promise(resolve => setTimeout(resolve, MOTION_DURATION_MODERATE_MS));
        }
    }

    if (lastStepIndex >= 0 && lastStepIndex < activeSteps.length) {
        const lastStep = activeSteps[lastStepIndex];
        if (typeof lastStep.onLeave === 'function') {
            await lastStep.onLeave();
        }
    }
    lastStepIndex = currentStepIndex;

    if (typeof step.onEnter === 'function') {
        await step.onEnter();
        await new Promise(resolve => setTimeout(resolve, MOTION_DURATION_FAST_MS));
    }

    const target = resolveTargetElement(step.target);
    if (!target) {
        console.warn(`Tour target element not found for step: ${step.id}`);
        currentStepIndex++;
        showStep();
        return;
    }

    if (window.lastTourTarget && window.lastTourTarget !== target) {
        window.lastTourTarget.classList.remove('tour-active-target');
    }
    target.classList.add('tour-active-target');
    window.lastTourTarget = target;

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(resolve => setTimeout(resolve, MOTION_DURATION_MODERATE_MS));

    const parentDialog = target.closest('dialog.modal, dialog, .modal');
    const mountTarget = (parentDialog && (parentDialog.open || parentDialog.classList.contains('show'))) ? parentDialog : document.body;

    if (!highlightBox) {
        highlightBox = document.createElement('div');
        highlightBox.className = 'tour-highlight-box';
        mountTarget.appendChild(highlightBox);
        snakeSVG = null;
    } else if (highlightBox.parentElement !== mountTarget) {
        mountTarget.appendChild(highlightBox);
    }

    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'tour-tooltip';
        mountTarget.appendChild(tooltipEl);
    } else if (tooltipEl.parentElement !== mountTarget) {
        mountTarget.appendChild(tooltipEl);
    }

    tooltipEl.style.opacity = '0';
    tooltipEl.style.transform = 'scale(0.95)';

    // Resolve title and description dynamically if they are functions
    const titleKey = typeof step.titleKey === 'function' ? step.titleKey() : step.titleKey;
    const descKey = typeof step.descKey === 'function' ? step.descKey() : step.descKey;

    // Update tooltip HTML content
    tooltipEl.innerHTML = `
        <div class="tour-tooltip-header">
            <h4 class="tour-tooltip-title">${translate(titleKey)}</h4>
            <button class="tour-close-btn" aria-label="Close">&times;</button>
        </div>
        <div class="tour-tooltip-body">
            ${translate(descKey)}
        </div>
        <div class="tour-tooltip-footer">
            <div class="tour-actions">
                <button class="tour-btn tour-btn-skip">${translate('views.tour.skip')}</button>
                ${currentStepIndex > 0 ? `<button class="tour-btn tour-btn-prev">${translate('views.tour.prev')}</button>` : ''}
                <button class="tour-btn tour-btn-next">${currentStepIndex === activeSteps.length - 1 ? translate('views.tour.finish') : translate('views.tour.next')}</button>
            </div>
            <div class="tour-progress">${translate('views.tour.step', { current: currentStepIndex + 1, total: activeSteps.length })}</div>
        </div>
    `;

    // Hook events inside the tooltip
    const handleCloseOrSkip = async () => {
        const confirmed = await showConfirm(translate('confirms.skipTour'));
        if (confirmed) {
            finishTour();
        }
    };

    tooltipEl.querySelector('.tour-close-btn')?.addEventListener('click', handleCloseOrSkip);
    tooltipEl.querySelector('.tour-btn-skip')?.addEventListener('click', handleCloseOrSkip);

    const prevBtn = tooltipEl.querySelector('.tour-btn-prev');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentStepIndex--;
            showStep();
        });
    }

    tooltipEl.querySelector('.tour-btn-next')?.addEventListener('click', () => {
        if (currentStepIndex === activeSteps.length - 1) {
            finishTour();
        } else {
            currentStepIndex++;
            showStep();
        }
    });

    updatePositions();

    requestAnimationFrame(() => {
        if (tooltipEl) {
            tooltipEl.style.opacity = '1';
            tooltipEl.style.transform = 'scale(1)';
        }
    });
}

/**
 * Initiates an interactive guided tour sequence for an optional set ID or dynamic timestamp.
 * @param {string} [setId] - Specific tour set identifier to run.
 * @returns {Promise<boolean>} True if tour started, false if no pending steps.
 */
export async function startTour(setId) {
    currentStepIndex = 0;
    lastStepIndex = -1;

    if (setId) {
        // Resolve steps only for the specified set ID
        activeSteps = tourSteps
            .filter(step => step.setId === setId)
            .sort((a, b) => compareOrders(a.order, b.order));
    } else {
        // Resolve steps dynamically based on user timestamp
        const lastTour = state.uiSettings?.uiTimestamps?.tour;
        activeSteps = resolveSteps(lastTour);
    }

    if (activeSteps.length === 0) {
        window.isTourRunning = false;
        window.isTourPending = false;
        return false; // Exit silently with no side effects
    }

    window.isTourRunning = true;
    window.isTourPending = false;

    // Land on home tab silently first (only if there are active steps to show)
    const tabButton = document.querySelector('[data-tab="home"]');
    if (tabButton && state.activeTab !== 'home-tab') {
        tabButton.click();
        // Wait for transitions/rendering
        await new Promise(resolve => setTimeout(resolve, MOTION_DURATION_MODERATE_MS));
    }

    // Dismiss all open modals and overlays to prevent collisions with the tour overlay
    closeAllModals();
    closeStoredOresModal();

    // Stamp storedOres.lastUpdated for every player so the stored ores reminder
    // modal doesn't trigger while the tour is running.
    handleStateUpdate(() => {
        const now = Date.now();
        for (const tag of state.savedPlayerTags) {
            const player = state.allPlayersData?.[tag];
            if (player) {
                if (!player.storedOres) player.storedOres = {};
                player.storedOres.lastUpdated = now;
            }
        }
    });

    // Trigger auto chip placement when the tour starts (for the entire planning range)
    try {
        Promise.all([
            import('../planner/calendar.js'),
            import('../../utils/dateUtils.js'),
            import('../../utils/autoPlaceChips.js')
        ]).then(([calendarModule, dateUtilsModule, autoPlaceModule]) => {
            calendarModule.setAnimateNextRender('auto-placed');
            const { month: MIN_MONTH, year: MIN_YEAR } = dateUtilsModule.getMinDate();
            const { month: MAX_MONTH, year: MAX_YEAR } = dateUtilsModule.getMaxDate();
            autoPlaceModule.autoPlaceIncomeChipsForRange(MIN_MONTH, MIN_YEAR, MAX_MONTH, MAX_YEAR);
        }).catch(err => console.error('Failed to import modules for tour auto-placement:', err));
    } catch (err) {
        console.error('Failed to auto-place chips on tour start:', err);
    }

    // Set up repositioning listeners
    window.addEventListener('resize', updatePositions, { passive: true });
    window.addEventListener('scroll', updatePositions, { capture: true, passive: true });

    document.body.classList.add('tour-active');

    showStep();
    return true;
}

function closeTour() {
    window.isTourRunning = false;
    window.isTourPending = false;
    document.body.classList.remove('tour-active');

    window.removeEventListener('resize', updatePositions);
    window.removeEventListener('scroll', updatePositions, { capture: true });

    // Call onLeave of the last active step if any
    if (lastStepIndex >= 0 && lastStepIndex < activeSteps.length) {
        const lastStep = activeSteps[lastStepIndex];
        if (typeof lastStep.onLeave === 'function') {
            lastStep.onLeave();
        }
    }
    lastStepIndex = -1;

    if (window.lastTourTarget) {
        window.lastTourTarget.classList.remove('tour-active-target');
        window.lastTourTarget = null;
    }

    if (highlightBox) {
        highlightBox.remove();
        highlightBox = null;
        snakeSVG = null;
        snakeRect = null;
        snakeAnim = null;
    }

    if (tooltipEl) {
        tooltipEl.remove();
        tooltipEl = null;
    }

    document.dispatchEvent(new CustomEvent('tour:close'));
}

function finishTour() {
    const maxReleaseTime = Math.max(0, ...tourSets.map(s => s.releasedAt || 0));
    handleStateUpdate(() => {
        if (!state.uiSettings.uiTimestamps) {
            state.uiSettings.uiTimestamps = {};
        }
        state.uiSettings.uiTimestamps.tour = Math.max(Date.now(), maxReleaseTime + 1);
    });
    closeTour();
}
