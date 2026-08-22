import { translate } from '../../i18n/translator.js';

import { animateValue, formatNumber } from '../../utils/numberFormatter.js';

import { getOverallGradient } from './homeProfileCalculations.js';

// ---------------------------------------------------------------------------
// Incremental render state
// Persists across calls so we can update bars without rebuilding the DOM.
// ---------------------------------------------------------------------------
export const renderState = {
    renderedTag: null, // player tag of the last full rebuild
    renderedLang: null, // language of the last full rebuild
    renderedTH: null, // Town Hall level of the last full rebuild
    renderedClan: null, // Clan name of the last full rebuild
    renderedLeague: null, // League tier ID of the last full rebuild
    lastProgress: null, // progress snapshot after the last completed animation
    isAnimating: false, // true while the fill-in transition is running
    pendingSnapshot: null // { progress, subData } queued to apply after animation
};

/**
 * Applies a delta update to already-rendered bars without rebuilding innerHTML.
 * Shows a green overlay for gains and a red overlay for losses.
 * Returns false if a full rebuild is needed (e.g. overall maxed state toggled).
 *
 * @param {HTMLElement} container - Card container element.
 * @param {any} prevProg - Previous progress snapshot.
 * @param {any} currProg - Current progress snapshot.
 * @param {Record<string, any>} subData - Sub-row metrics.
 * @param {import('../../core/types.js').AppState} state - Current global application state.
 * @param {number} [maxedCount] - Count of maxed equipment pieces.
 * @param {number} [totalCount] - Total equipment pieces count.
 * @param {any} [profile] - Player profile state.
 * @returns {boolean} True if successfully patched incrementally, false if full rebuild is required.
 */
export function applyProgressDelta(container, prevProg, currProg, subData, state, maxedCount, totalCount, profile) {
    if ((prevProg.overall >= 100) !== (currProg.overall >= 100)) return false;

    if (maxedCount !== undefined && totalCount !== undefined) {
        const maxedCountEl = container.querySelector('.maxed-count');
        if (maxedCountEl) {
            const newCountText = `${maxedCount}/${totalCount}`;
            if (maxedCountEl.textContent !== newCountText) {
                maxedCountEl.textContent = newCountText;
            }
        }
    }
    if (profile && profile.trophies !== undefined) {
        const trophiesEl = container.querySelector('.player-trophies-mini span');
        if (trophiesEl) {
            const newTrophiesText = formatNumber(profile.trophies);
            if (trophiesEl.textContent !== newTrophiesText) {
                trophiesEl.textContent = newTrophiesText;
            }
        }
    }

    const oreKeys = ['overall', 'shiny', 'glowy', 'starry'];

    for (const key of oreKeys) {
        const prev = prevProg[key] || 0;
        const curr = currProg[key] || 0;
        const delta = curr - prev;

        const barWrap = container.querySelector(`[data-ore="${key}"]`);
        if (!barWrap) continue;

        const fill = /** @type {HTMLElement | null} */ (barWrap.querySelector('.progress-bar-fill'));
        if (fill) {
            barWrap.querySelectorAll('.bar-delta-overlay').forEach(el => el.remove());

            const shouldBeMaxed = curr >= 100;
            if (fill.classList.contains('maxed-fill') !== shouldBeMaxed) {
                fill.classList.toggle('maxed-fill', shouldBeMaxed);
            }

            if (key === 'overall') {
                const targetBackground = curr >= 100 ? '' : getOverallGradient(currProg);
                if (fill.style.background !== targetBackground) {
                    fill.style.background = targetBackground;
                }
            }

            if (Math.abs(delta) >= 0.5) {
                const overlay = document.createElement('div');
                overlay.className = `bar-delta-overlay ${delta > 0 ? 'delta-positive' : 'delta-negative'}`;

                if (delta > 0) {
                    // Green strip animates from prev -> curr
                    overlay.style.cssText = `left:${Math.min(prev, 100)}%; width:0;`;
                    barWrap.appendChild(overlay);
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            overlay.style.width = `${Math.min(delta, 100 - prev)}%`;
                            fill.style.width = `${Math.min(curr, 100)}%`;
                        });
                    });
                } else {
                    // Red strip shows the lost portion then fades
                    overlay.style.cssText = `left:${Math.max(curr, 0)}%; width:${Math.abs(delta)}%;`;
                    barWrap.appendChild(overlay);
                    fill.style.width = `${Math.max(curr, 0)}%`;
                    setTimeout(() => {
                        overlay.style.transition = 'opacity 0.5s ease';
                        overlay.style.opacity = '0';
                        setTimeout(() => overlay.remove(), 500);
                    }, 2500);
                }
            } else {
                const newWidth = `${Math.min(curr, 100)}%`;
                if (fill.style.width !== newWidth) {
                    fill.style.width = newWidth;
                }
            }
        }

        const valEl = container.querySelector(`[data-ore-value="${key}"]`);
        if (valEl) {
            animateValue(valEl, prev, curr, key === 'overall' ? 2000 : 1800, val => `${Math.round(val)}%`);
        }

        if (key !== 'overall' && state) {
            const storageBar = /** @type {HTMLElement | null} */ (barWrap.querySelector('.progress-bar-storage'));
            if (storageBar) {
                const storedVal = state.storedOres?.[key] || 0;
                const totalVal = currProg[`${key}Total`] || 0;
                const storagePct = totalVal > 0 ? (storedVal / totalVal) * 100 : 0;
                const newStorageWidth = `${storagePct}%`;
                if (storageBar.style.width !== newStorageWidth) {
                    storageBar.style.width = newStorageWidth;
                }
            }
        }

        if (key !== 'overall' && subData && subData[key]) {
            const statBox = barWrap.closest('.profile-stat-box');
            if (statBox) {
                const existing = statBox.querySelector('.stat-box-sub, .stat-box-maxed');
                if (existing) {
                    const wasMaxed = existing.classList.contains('stat-box-maxed');
                    const isMaxed = curr >= 100;

                    if (isMaxed && !wasMaxed) {
                        const el = document.createElement('div');
                        el.className = 'stat-box-maxed';
                        el.setAttribute('data-i18n', 'views.home.profile.maxed');
                        el.textContent = `✓ ${translate('views.home.profile.maxed')}`;
                        existing.replaceWith(el);
                    } else if (!isMaxed && wasMaxed) {
                        const { spent, total, remaining, time, col } = subData[key];
                        const el = document.createElement('div');
                        el.className = 'stat-box-sub';
                        el.innerHTML = `<div>${formatNumber(spent)} / ${formatNumber(total)}</div>
                            <div><span data-i18n="views.home.profile.remainingColon">${col}</span> ${formatNumber(remaining)} | ${time}</div>`;
                        existing.replaceWith(el);
                    } else if (!isMaxed) {
                        const { spent, total, remaining, time, col } = subData[key];
                        const newHtml = `<div>${formatNumber(spent)} / ${formatNumber(total)}</div>\n                            <div><span data-i18n="views.home.profile.remainingColon">${col}</span> ${formatNumber(remaining)} | ${time}</div>`;
                        if (existing.innerHTML !== newHtml) {
                            existing.innerHTML = newHtml;
                        }
                    }
                }
            }
        }
    }

    const overallContainer = container.querySelector('.home-profile-overall-progress');
    if (overallContainer) {
        overallContainer.classList.toggle('fully-maxed', currProg.overall >= 100);
    }

    return true;
}

/**
 * Triggers the CSS width transition on all bar fills and calls onComplete when done.
 * @param {HTMLElement} container - Card container.
 * @param {any} progressObj - Target progress values.
 * @param {() => void} onComplete - Callback executed once animation completes.
 */
export function triggerFillAnimation(container, progressObj, onComplete) {
    let fired = false;
    const done = () => {
        if (!fired) {
            fired = true;
            onComplete();
        }
    };

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            container.querySelectorAll('.progress-bar-fill[data-bar-width]').forEach(bar => {
                const htmlBar = /** @type {HTMLElement} */ (bar);
                if (htmlBar.dataset.barWidth) {
                    htmlBar.style.width = htmlBar.dataset.barWidth;
                }
            });

            // Trigger count-up animation for labels from 0 to target
            const oreKeys = ['overall', 'shiny', 'glowy', 'starry'];
            for (const key of oreKeys) {
                const valEl = container.querySelector(`[data-ore-value="${key}"]`);
                if (valEl) {
                    const targetVal = progressObj[key] || 0;
                    animateValue(valEl, 0, targetVal, key === 'overall' ? 2000 : 1800, val => `${Math.round(val)}%`);
                }
            }

            const firstFill = container.querySelector('.progress-bar-fill[data-bar-width]');
            if (firstFill) {
                firstFill.addEventListener('transitionend', done, { once: true });
                setTimeout(done, 2400); // Safety fallback if transitionend never fires
            } else {
                done();
            }
        });
    });
}
