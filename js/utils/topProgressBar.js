/**
 * Top Viewport Progress Bar Engine (YouTube / GitHub Style)
 * Displays a sleek glowing 3px progress accent bar at the top of the viewport during
 * tab navigation transitions, dynamic module loading, and API data sync operations.
 */

let containerEl = null;
let fillEl = null;
let currentProgress = 0;
let trickleTimer = null;
let activeCount = 0;
let fadeTimeout = null;
let resetTimeout = null;

function ensureElements() {
    if (!containerEl) {
        containerEl = document.getElementById('top-progress-bar-container');
        if (!containerEl && typeof document !== 'undefined' && document.body) {
            containerEl = document.createElement('div');
            containerEl.id = 'top-progress-bar-container';
            containerEl.className = 'top-progress-bar-container';
            containerEl.innerHTML = `
                <div class="top-progress-bar-track">
                    <div class="top-progress-bar-fill" id="top-progress-bar-fill">
                        <div class="top-progress-bar-peg"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(containerEl);
        }
    }
    if (!fillEl && typeof document !== 'undefined') {
        fillEl = document.getElementById('top-progress-bar-fill');
    }
}

/**
 * Starts the YouTube/GitHub-style top progress bar with trickle animation during async requests.
 */
export function startTopProgressBar() {
    activeCount++;
    ensureElements();
    if (!containerEl || !fillEl) return;

    if (fadeTimeout) {
        clearTimeout(fadeTimeout);
        fadeTimeout = null;
    }
    if (resetTimeout) {
        clearTimeout(resetTimeout);
        resetTimeout = null;
    }

    if (activeCount > 1 && trickleTimer) {
        return;
    }

    if (trickleTimer) clearInterval(trickleTimer);

    currentProgress = Math.max(currentProgress, 15);
    fillEl.style.transition = 'transform 0.2s cubic-bezier(0.1, 0.7, 0.1, 1)';
    fillEl.style.transform = `translate3d(-${100 - currentProgress}%, 0, 0)`;
    containerEl.classList.add('is-active');

    // Smooth trickle up to 90%
    trickleTimer = setInterval(() => {
        if (currentProgress < 90) {
            const increment = Math.max(1, (90 - currentProgress) * 0.08 + (Math.random() * 2));
            currentProgress = Math.min(90, currentProgress + increment);
            fillEl.style.transform = `translate3d(-${100 - currentProgress}%, 0, 0)`;
        }
    }, 200);
}

/**
 * Completes the top progress bar to 100% and smoothly fades it out.
 */
export function finishTopProgressBar() {
    if (activeCount > 0) {
        activeCount--;
    }
    if (activeCount > 0) {
        return;
    }

    ensureElements();
    if (trickleTimer) {
        clearInterval(trickleTimer);
        trickleTimer = null;
    }
    if (!containerEl || !fillEl) return;

    currentProgress = 100;
    fillEl.style.transition = 'transform 0.15s ease-out';
    fillEl.style.transform = 'translate3d(0%, 0, 0)';

    if (fadeTimeout) clearTimeout(fadeTimeout);
    fadeTimeout = setTimeout(() => {
        fadeTimeout = null;
        containerEl.classList.remove('is-active');

        if (resetTimeout) clearTimeout(resetTimeout);
        resetTimeout = setTimeout(() => {
            resetTimeout = null;
            fillEl.style.transition = 'none';
            fillEl.style.transform = 'translate3d(-100%, 0, 0)';
            currentProgress = 0;
        }, 250);
    }, 200);
}
