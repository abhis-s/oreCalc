import { triggerHaptic } from '../../services/hapticService.js';

/**
 * iOS Liquid Glass Nav Glide Controller
 * Enables press-and-glide tab selection across top header tab-bar and mobile bottom nav.
 * Highlights tab under finger in real-time with liquid glass feedback, committing the tab change ONLY on pointer release.
 */

let isGliding = false;
let currentGlideTarget = null;
let activeNavContainer = null;

function clearGlideHighlights() {
    document.querySelectorAll('.tab-bar-container .tab-button').forEach(btn => {
        btn.classList.remove('nav-glide-active');
    });
}

function handlePointerDown(e) {
    const container = e.currentTarget;
    const initialBtn = e.target.closest('.tab-button');
    if (!initialBtn) return;

    isGliding = true;
    activeNavContainer = container;
    currentGlideTarget = initialBtn;

    clearGlideHighlights();
    initialBtn.classList.add('nav-glide-active');
    triggerHaptic('light');

    if (container.setPointerCapture && e.pointerId !== undefined) {
        try {
            container.setPointerCapture(e.pointerId);
        } catch (_) {}
    }
}

function handlePointerMove(e) {
    if (!isGliding || !activeNavContainer) return;

    const pointerElem = document.elementFromPoint(e.clientX, e.clientY);
    if (!pointerElem) return;

    const hoveredBtn = pointerElem.closest('.tab-button');

    if (hoveredBtn && activeNavContainer.contains(hoveredBtn)) {
        if (hoveredBtn !== currentGlideTarget) {
            clearGlideHighlights();
            hoveredBtn.classList.add('nav-glide-active');
            currentGlideTarget = hoveredBtn;
            triggerHaptic('selection');
        }
    }
}

function handlePointerUp(e) {
    if (!isGliding) return;

    const container = activeNavContainer;
    const targetToCommit = currentGlideTarget;

    isGliding = false;
    activeNavContainer = null;
    currentGlideTarget = null;

    if (container && container.releasePointerCapture && e.pointerId !== undefined) {
        try {
            container.releasePointerCapture(e.pointerId);
        } catch (_) {}
    }

    clearGlideHighlights();

    if (targetToCommit) {
        triggerHaptic('medium');
        targetToCommit.click();
    }
}

function handlePointerCancel(e) {
    if (!isGliding) return;

    const container = activeNavContainer;
    isGliding = false;
    activeNavContainer = null;
    currentGlideTarget = null;

    if (container && container.releasePointerCapture && e.pointerId !== undefined) {
        try {
            container.releasePointerCapture(e.pointerId);
        } catch (_) {}
    }

    clearGlideHighlights();
}

export function initializeNavGlideController() {
    const navContainers = document.querySelectorAll('.tab-bar-container');

    navContainers.forEach(container => {
        container.style.touchAction = 'none';

        container.addEventListener('pointerdown', handlePointerDown);
        container.addEventListener('pointermove', handlePointerMove);
        container.addEventListener('pointerup', handlePointerUp);
        container.addEventListener('pointercancel', handlePointerCancel);
    });
}
