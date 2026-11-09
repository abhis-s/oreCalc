/**
 * Landing Tools Section Interactive Inputs Controller.
 * Handles touch-hold-drag popping across card icon clusters.
 * Tier 4: UI Controller.
 */

import { triggerHaptic } from '../../services/hapticService.js';

/** @type {Array<() => void>} */
let cleanupCallbacks = [];

/**
 * Initializes touch-hold-drag popping interactions on landing page card icon clusters.
 */
export function initLandingToolsInputs() {
    destroyLandingToolsInputs();

    const clusters = /** @type {NodeListOf<HTMLElement>} */ (
        document.querySelectorAll('.landing-tool-card__icon-cluster')
    );

    if (clusters.length === 0) return;

    clusters.forEach(cluster => {
        /** @type {HTMLElement | null} */
        let activeIcon = null;

        /**
         * Clears active pop styling from all icons within this cluster.
         */
        const clearClusterPop = () => {
            cluster.querySelectorAll(':scope > .landing-tool-icon').forEach(icon => {
                icon.classList.remove('active-pop');
                if (typeof /** @type {HTMLElement} */ (icon).blur === 'function') {
                    /** @type {HTMLElement} */ (icon).blur();
                }
            });
            activeIcon = null;
        };

        /**
         * Handles coordinate tracking for pointer/touch movement.
         * @param {PointerEvent | TouchEvent | MouseEvent} e
         */
        const handlePointerMove = (e) => {
            const clientX = 'clientX' in e && typeof e.clientX === 'number'
                ? e.clientX
                : ('touches' in e && e.touches?.[0]?.clientX) ?? ('changedTouches' in e && e.changedTouches?.[0]?.clientX);
            const clientY = 'clientY' in e && typeof e.clientY === 'number'
                ? e.clientY
                : ('touches' in e && e.touches?.[0]?.clientY) ?? ('changedTouches' in e && e.changedTouches?.[0]?.clientY);

            if (clientX === undefined || clientY === undefined) return;

            const targetElem = document.elementFromPoint(clientX, clientY);
            const matchedIcon = targetElem ? /** @type {HTMLElement | null} */ (targetElem.closest('.landing-tool-card__icon-cluster > .landing-tool-icon')) : null;
            const isInsideThisCluster = matchedIcon ? cluster.contains(matchedIcon) : false;
            const nextActive = isInsideThisCluster ? matchedIcon : null;

            if (nextActive !== activeIcon) {
                if (activeIcon) {
                    activeIcon.classList.remove('active-pop');
                }
                activeIcon = nextActive;
                if (activeIcon) {
                    activeIcon.classList.add('active-pop');
                    triggerHaptic('tap');
                }
            }

            if (e.cancelable && e.type && e.type.startsWith('touch')) {
                e.preventDefault();
            }
        };

        /**
         * Cleans up drag tracking and removes window listeners.
         */
        const handlePointerEnd = () => {
            clearClusterPop();

            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerEnd);
            window.removeEventListener('pointercancel', handlePointerEnd);
            window.removeEventListener('mousemove', handlePointerMove);
            window.removeEventListener('mouseup', handlePointerEnd);
            window.removeEventListener('touchmove', handlePointerMove);
            window.removeEventListener('touchend', handlePointerEnd);
        };

        /**
         * Starts drag tracking upon pointer or touch engagement.
         * @param {PointerEvent | TouchEvent} e
         */
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

        cleanupCallbacks.push(() => {
            cluster.removeEventListener('pointerdown', handlePointerStart);
            cluster.removeEventListener('touchstart', handlePointerStart);
            handlePointerEnd();
        });
    });
}

/**
 * Tears down active tool card interaction listeners.
 */
export function destroyLandingToolsInputs() {
    cleanupCallbacks.forEach(cb => cb());
    cleanupCallbacks = [];
}
