import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';
import { translate } from '../../i18n/translator.js';
import { closeStoredOresModal } from '../planner/priorityListModal.js';
import { tourSets, tourSteps } from '../../data/tourData.js';
import { showConfirm } from '../../ui/noticeModal.js';

let activeSteps = [];
let currentStepIndex = 0;
let lastStepIndex = -1;
let highlightBox = null;
let tooltipEl = null;
let snakeSVG = null;
let snakeRect = null;
let snakeAnim = null;

export function resolveSteps(lastTourTimestamp) {
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
        .sort((a, b) => {
            const timeA = setRelease[a.setId] ?? 0;
            const timeB = setRelease[b.setId] ?? 0;
            return timeA !== timeB ? timeA - timeB : a.order - b.order;
        });
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

function updatePositions() {
    if (currentStepIndex < 0 || currentStepIndex >= activeSteps.length) return;
    const step = activeSteps[currentStepIndex];
    const targetSelector = typeof step.target === 'function' ? step.target() : step.target;
    const target = document.querySelector(targetSelector);
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
    const tooltipRect = tooltip.getBoundingClientRect();
    const margin = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Compute ideal top/left for each cardinal placement
    function compute(p) {
        switch (p) {
            case 'bottom':
                return {
                    top: highlightRect.bottom + margin,
                    left: highlightRect.left + (highlightRect.width - tooltipRect.width) / 2
                };
            case 'top':
                return {
                    top: highlightRect.top - tooltipRect.height - margin,
                    left: highlightRect.left + (highlightRect.width - tooltipRect.width) / 2
                };
            case 'left':
                return {
                    top: highlightRect.top + (highlightRect.height - tooltipRect.height) / 2,
                    left: highlightRect.left - tooltipRect.width - margin
                };
            case 'right':
                return {
                    top: highlightRect.top + (highlightRect.height - tooltipRect.height) / 2,
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
            top + tooltipRect.height <= vh - margin &&
            left + tooltipRect.width <= vw - margin
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
    finalPos.left = Math.max(margin, Math.min(vw - tooltipRect.width - margin, finalPos.left));
    finalPos.top  = Math.max(margin, Math.min(vh - tooltipRect.height - margin, finalPos.top));

    tooltip.style.left = `${finalPos.left}px`;
    tooltip.style.top  = `${finalPos.top}px`;
}


async function showStep() {
    if (currentStepIndex < 0 || currentStepIndex >= activeSteps.length) {
        finishTour();
        return;
    }

    const step = activeSteps[currentStepIndex];

    // 1. Programmatically navigate to the tab if needed
    if (state.activeTab !== `${step.tab}-tab`) {
        const tabButton = document.querySelector(`[data-tab="${step.tab}"]`);
        if (tabButton) {
            tabButton.click();
            // Wait for transitions/rendering
            await new Promise(resolve => setTimeout(resolve, 350));
        }
    }

    // Call onLeave of the previous step if any
    if (lastStepIndex >= 0 && lastStepIndex < activeSteps.length) {
        const lastStep = activeSteps[lastStepIndex];
        if (typeof lastStep.onLeave === 'function') {
            await lastStep.onLeave();
        }
    }
    // Update lastStepIndex
    lastStepIndex = currentStepIndex;

    // Call onEnter of the current step if any
    if (typeof step.onEnter === 'function') {
        await step.onEnter();
        // Wait a bit for transitions (like dropdown open) to complete
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 2. Find target element
    const targetSelector = typeof step.target === 'function' ? step.target() : step.target;
    const target = document.querySelector(targetSelector);
    if (!target) {
        console.warn(`Tour target element not found: ${targetSelector}`);
        currentStepIndex++;
        showStep();
        return;
    }

    // Manage active target class for glow and pop-out effects
    if (window.lastTourTarget && window.lastTourTarget !== target) {
        window.lastTourTarget.classList.remove('tour-active-target');
    }
    target.classList.add('tour-active-target');
    window.lastTourTarget = target;

    // 3. Scroll target element into view smoothly
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(resolve => setTimeout(resolve, 300));

    // 4. Lazy initialize elements if they don't exist
    if (!highlightBox) {
        highlightBox = document.createElement('div');
        highlightBox.className = 'tour-highlight-box';
        document.body.appendChild(highlightBox);
        snakeSVG = null;
    }

    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'tour-tooltip';
        document.body.appendChild(tooltipEl);
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
            <div class="tour-progress">${translate('tour.step', { current: currentStepIndex + 1, total: activeSteps.length })}</div>
            <div class="tour-actions">
                <button class="tour-btn tour-btn-skip">${translate('tour.skip')}</button>
                ${currentStepIndex > 0 ? `<button class="tour-btn tour-btn-prev">${translate('tour.prev')}</button>` : ''}
                <button class="tour-btn tour-btn-next">${currentStepIndex === activeSteps.length - 1 ? translate('tour.finish') : translate('tour.next')}</button>
            </div>
        </div>
    `;

    // Hook events inside the tooltip
    const handleCloseOrSkip = async () => {
        const confirmed = await showConfirm(translate('confirms.skipTour'));
        if (confirmed) {
            finishTour();
        }
    };

    tooltipEl.querySelector('.tour-close-btn').addEventListener('click', handleCloseOrSkip);
    tooltipEl.querySelector('.tour-btn-skip').addEventListener('click', handleCloseOrSkip);
    
    const prevBtn = tooltipEl.querySelector('.tour-btn-prev');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentStepIndex--;
            showStep();
        });
    }

    tooltipEl.querySelector('.tour-btn-next').addEventListener('click', () => {
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

export async function startTour(setId) {
    currentStepIndex = 0;
    lastStepIndex = -1;

    if (setId) {
        // Resolve steps only for the specified set ID
        activeSteps = tourSteps
            .filter(step => step.setId === setId)
            .sort((a, b) => a.order - b.order);
    } else {
        // Resolve steps dynamically based on user timestamp
        const lastTour = state.uiSettings?.timestamp?.tour;
        activeSteps = resolveSteps(lastTour);
    }

    if (activeSteps.length === 0) {
        return; // Exit silently with no side effects
    }

    // Land on home tab silently first (only if there are active steps to show)
    const tabButton = document.querySelector('[data-tab="home"]');
    if (tabButton && state.activeTab !== 'home-tab') {
        tabButton.click();
        // Wait for transitions/rendering
        await new Promise(resolve => setTimeout(resolve, 350));
    }

    // Dismiss stored ores modal if open — the tour overlay would obscure it
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
    window.addEventListener('resize', updatePositions);
    window.addEventListener('scroll', updatePositions, true);

    document.body.classList.add('tour-active');

    showStep();
}

export function closeTour() {
    document.body.classList.remove('tour-active');

    window.removeEventListener('resize', updatePositions);
    window.removeEventListener('scroll', updatePositions, true);

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
}

export function finishTour() {
    handleStateUpdate(() => {
        if (!state.uiSettings.timestamp) {
            state.uiSettings.timestamp = {};
        }
        state.uiSettings.timestamp.tour = Date.now();
    });
    closeTour();
}
