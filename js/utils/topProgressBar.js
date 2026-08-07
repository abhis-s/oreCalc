/**
 * Top Viewport Progress Bar Engine (YouTube / GitHub Style)
 * Displays a sleek glowing 3px progress accent bar at the top of the viewport during
 * tab navigation transitions, dynamic module loading, and API data sync operations.
 */

let containerEl = null;
let fillEl = null;
let currentProgress = 0;
let trickleTimer = null;

function ensureElements() {
    if (!containerEl) {
        containerEl = document.getElementById('top-progress-bar-container');
        if (!containerEl) {
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
        fillEl = document.getElementById('top-progress-bar-fill');
    }
}

export function startTopProgressBar() {
    ensureElements();
    if (trickleTimer) clearInterval(trickleTimer);

    currentProgress = 15;
    fillEl.style.transition = 'transform 0.2s cubic-bezier(0.1, 0.7, 0.1, 1)';
    fillEl.style.transform = `translate3d(-${100 - currentProgress}%, 0, 0)`;
    containerEl.classList.add('active');

    // Smooth trickle up to 90%
    trickleTimer = setInterval(() => {
        if (currentProgress < 90) {
            const increment = Math.max(1, (90 - currentProgress) * 0.08 + (Math.random() * 2));
            currentProgress = Math.min(90, currentProgress + increment);
            fillEl.style.transform = `translate3d(-${100 - currentProgress}%, 0, 0)`;
        }
    }, 200);
}

export function setTopProgressBar(percent) {
    ensureElements();
    currentProgress = Math.min(100, Math.max(0, percent));
    fillEl.style.transition = 'transform 0.2s cubic-bezier(0.1, 0.7, 0.1, 1)';
    fillEl.style.transform = `translate3d(-${100 - currentProgress}%, 0, 0)`;
    if (!containerEl.classList.contains('active')) {
        containerEl.classList.add('active');
    }
}

export function finishTopProgressBar() {
    ensureElements();
    if (trickleTimer) {
        clearInterval(trickleTimer);
        trickleTimer = null;
    }

    currentProgress = 100;
    fillEl.style.transition = 'transform 0.15s ease-out';
    fillEl.style.transform = 'translate3d(0%, 0, 0)';

    setTimeout(() => {
        containerEl.classList.remove('active');
        setTimeout(() => {
            fillEl.style.transition = 'none';
            fillEl.style.transform = 'translate3d(-100%, 0, 0)';
            currentProgress = 0;
        }, 250);
    }, 200);
}
