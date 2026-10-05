/**
 * @file elementHighlighter.js
 * @description Sleek perimeter snake tracer highlight utility for drawing visual attention
 * to specific target elements without disruptive modals, tooltips, or screen-darkening backdrops.
 */

/**
 * @typedef {Object} SnakeHighlightOptions
 * @property {number} [durationMs=4500] - Duration in milliseconds before auto-dismissing (0 to disable).
 * @property {number} [offset=4] - Perimeter offset gap in pixels around the target element.
 * @property {number} [borderRadius] - Explicit corner radius for snake SVG rect (defaults to element borderRadius + offset).
 * @property {number} [strokeWidth=2.5] - Width of the animated snake stroke in pixels.
 * @property {string} [strokeColor='var(--accent-primary, #6c8aff)'] - Stroke color of the animated snake.
 * @property {number} [speed=260] - Linear velocity of the snake in pixels per second.
 * @property {number} [snakeRatio=0.15] - Length of snake segment proportional to total perimeter.
 * @property {boolean} [scrollIntoView=true] - Whether to smoothly scroll target into view if partially off-screen.
 * @property {ScrollLogicalPosition} [scrollBlock='nearest'] - Vertical scroll alignment block mode.
 * @property {boolean} [dismissOnClick=true] - Whether any user click dismisses the highlight early.
 * @property {() => void} [onDismiss] - Optional completion callback invoked upon dismissal.
 */

const activeHighlights = new WeakMap();

/**
 * Highlights a target element by circulating a glowing snake animation along its perimeter.
 *
 * @param {HTMLElement | Element | string | null} targetOrSelector - Target element or selector string to highlight.
 * @param {SnakeHighlightOptions} [options={}] - Custom configuration options.
 * @returns {() => void} Teardown function to dismiss and remove the highlight early.
 */
export function highlightElementWithSnake(targetOrSelector, options = {}) {
    if (typeof document === 'undefined') {
        return () => {};
    }

    const target = typeof targetOrSelector === 'string'
        ? /** @type {HTMLElement | null} */ (document.querySelector(targetOrSelector))
        : targetOrSelector;

    const isElement = (typeof HTMLElement !== 'undefined' && target instanceof HTMLElement)
        || (target && typeof target === 'object' && (target.nodeType === 1 || typeof target.tagName === 'string'));

    if (!target || !isElement) {
        return () => {};
    }

    // Dismiss existing highlight on this target element if currently active
    const existingDismiss = activeHighlights.get(target);
    if (typeof existingDismiss === 'function') {
        existingDismiss();
    }

    if (options.scrollIntoView !== false && typeof target.scrollIntoView === 'function') {
        try {
            target.scrollIntoView({
                behavior: 'smooth',
                block: options.scrollBlock ?? 'nearest'
            });
        } catch {
            // Fallback for jsdom or browsers lacking smooth scroll parameters
            target.scrollIntoView();
        }
    }

    target.classList.add('has-snake-highlight');

    const overlay = document.createElement('div');
    overlay.className = 'snake-highlight-overlay';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke-linecap', 'round');
    rect.setAttribute('stroke-width', String(options.strokeWidth ?? 2.5));
    rect.setAttribute('stroke', options.strokeColor ?? 'var(--accent-primary, #6c8aff)');

    const anim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    anim.setAttribute('attributeName', 'stroke-dashoffset');
    anim.setAttribute('repeatCount', 'indefinite');
    anim.setAttribute('calcMode', 'linear');

    rect.appendChild(anim);
    svg.appendChild(rect);
    overlay.appendChild(svg);
    target.appendChild(overlay);

    const offset = options.offset ?? 4;
    const speed = options.speed ?? 260;
    const snakeRatio = options.snakeRatio ?? 0.15;

    let r = options.borderRadius;
    if (r === undefined) {
        let computedRadius = 12;
        if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
            const cs = window.getComputedStyle(target);
            computedRadius = parseFloat(cs.borderRadius) || 12;
        }
        r = computedRadius + offset;
    }

    const updateDimensions = () => {
        const w = target.offsetWidth;
        const h = target.offsetHeight;
        if (w === 0 || h === 0) return;

        const svgW = w + offset * 2;
        const svgH = h + offset * 2;
        const perimeter = 2 * (svgW + svgH) - 8 * r + 2 * Math.PI * r;
        const dur = (perimeter / speed).toFixed(3);
        const snakeLen = perimeter * snakeRatio;

        rect.setAttribute('x', String(-offset));
        rect.setAttribute('y', String(-offset));
        rect.setAttribute('width', String(svgW));
        rect.setAttribute('height', String(svgH));
        rect.setAttribute('rx', String(r));
        rect.setAttribute('ry', String(r));
        rect.setAttribute('stroke-dasharray', `${snakeLen} ${perimeter - snakeLen}`);

        anim.setAttribute('dur', `${dur}s`);
        anim.setAttribute('values', `0;${-perimeter}`);
    };

    updateDimensions();

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => updateDimensions());
        resizeObserver.observe(target);
    }

    let isDismissed = false;

    const dismiss = () => {
        if (isDismissed) return;
        isDismissed = true;
        activeHighlights.delete(target);

        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }

        if (autoDismissTimeout) {
            clearTimeout(autoDismissTimeout);
            autoDismissTimeout = null;
        }

        if (parentModal) {
            parentModal.removeEventListener('close', dismiss);
        }

        if (options.dismissOnClick !== false) {
            document.removeEventListener('click', handleClick, true);
        }

        overlay.classList.add('fade-out');

        setTimeout(() => {
            overlay.remove();
            target.classList.remove('has-snake-highlight');
            if (typeof options.onDismiss === 'function') {
                options.onDismiss();
            }
        }, 400);
    };

    activeHighlights.set(target, dismiss);

    const duration = options.durationMs ?? 4500;
    let autoDismissTimeout = duration > 0 ? setTimeout(dismiss, duration) : null;

    const handleClick = () => {
        dismiss();
    };

    if (options.dismissOnClick !== false) {
        setTimeout(() => {
            if (!isDismissed) {
                document.addEventListener('click', handleClick, { capture: true, once: true });
            }
        }, 60);
    }

    const parentModal = target.closest('dialog, .modal');
    if (parentModal) {
        parentModal.addEventListener('close', dismiss, { once: true });
    }

    return dismiss;
}
