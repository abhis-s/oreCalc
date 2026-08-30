import { hideCardHelpPopover } from '../../utils/cardHelpPopover.js';

/**
 * Updates roving tabindex across all milestone node chips.
 * Sets tabindex="0" on the active completed node (or first node), and tabindex="-1" on all others.
 *
 * @param {HTMLElement | null} container - Container holding node chips.
 * @param {number} [cumulativeLevel=0] - Player cumulative hero level.
 */
export function updateHeroJourneyRovingTabindex(container, cumulativeLevel = 0) {
    if (!container) return;
    const chips = /** @type {HTMLElement[]} */ (Array.from(container.querySelectorAll('.hero-journey-node-chip')));
    if (chips.length === 0) return;

    let activeChip = null;
    let highestCompletedLevel = -1;

    for (const chip of chips) {
        const nodeLevel = Number(chip.dataset.nodeLevel || chip.dataset.level) || 0;
        if (nodeLevel <= cumulativeLevel && nodeLevel > highestCompletedLevel) {
            highestCompletedLevel = nodeLevel;
            activeChip = chip;
        }
    }

    if (!activeChip) {
        activeChip = chips[0];
    }

    for (const chip of chips) {
        chip.setAttribute('tabindex', chip === activeChip ? '0' : '-1');
    }
}

/**
 * Initializes roving tabindex keyboard navigation across milestone nodes in a track wrapper.
 * @param {HTMLElement | null} trackWrapper - Track wrapper element.
 */
export function initHeroJourneyTrackKeyboardNav(trackWrapper) {
    if (!trackWrapper || trackWrapper.dataset.keyboardNavBound) return;
    trackWrapper.dataset.keyboardNavBound = 'true';

    trackWrapper.addEventListener('keydown', (e) => {
        const target = /** @type {HTMLElement} */ (e.target);
        const currentChip = /** @type {HTMLElement} */ (target?.closest?.('.hero-journey-node-chip'));
        if (!currentChip) return;

        const chips = /** @type {HTMLElement[]} */ (Array.from(trackWrapper.querySelectorAll('.hero-journey-node-chip')));
        if (chips.length === 0) return;

        const currentIndex = chips.indexOf(currentChip);
        if (currentIndex === -1) return;

        let nextIndex = -1;

        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            nextIndex = Math.min(chips.length - 1, currentIndex + 1);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            nextIndex = Math.max(0, currentIndex - 1);
        } else if (e.key === 'Home') {
            nextIndex = 0;
        } else if (e.key === 'End') {
            nextIndex = chips.length - 1;
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            currentChip.click();
            return;
        } else if (e.key === 'Escape') {
            hideCardHelpPopover();
            return;
        }

        if (nextIndex !== -1 && nextIndex !== currentIndex) {
            e.preventDefault();
            const nextChip = chips[nextIndex];

            currentChip.setAttribute('tabindex', '-1');
            nextChip.setAttribute('tabindex', '0');

            if (typeof nextChip.focus === 'function') {
                nextChip.focus();
            }
            if (typeof nextChip.scrollIntoView === 'function') {
                nextChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    });
}
