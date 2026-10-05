import { escapeHTML } from '../../utils/stringUtils.js';

/**
 * @typedef {Object} SteppedSliderOptions
 * @property {number} [min=1] - Minimum level value.
 * @property {number} [max=1] - Maximum level value.
 * @property {number} [value=1] - Current selected level value.
 * @property {number} [maxAllowed] - Optional maximum level permitted by progression limits.
 * @property {string} [id] - Optional ID for the range input.
 * @property {string} [className] - Optional CSS class name(s) for the input.
 * @property {string} [wrapClassName] - Optional CSS class name(s) for the outer wrapper.
 * @property {Record<string, string|number>} [dataAttributes] - Optional data-* attributes.
 * @property {string} [ariaLabel] - Optional accessible label for screen readers.
 * @property {boolean} [disabled=false] - Whether the slider is disabled.
 * @property {boolean} [withTicks=true] - Whether to render below-track step notch indicators.
 * @property {Array<number>} [tickValues] - Optional discrete level values for step ticks.
 */

/**
 * Renders discrete tick mark spans positioned directly below the slider track.
 *
 * @param {number} min - Minimum value.
 * @param {number} max - Maximum value.
 * @param {number} [maxAllowed] - Optional maximum allowed value; steps beyond this are marked disabled.
 * @param {Array<number>} [tickValues] - Optional discrete values array for ticks.
 * @returns {string} HTML string containing tick mark spans.
 */
export function renderSliderTicksHtml(min, max, maxAllowed, tickValues = null) {
    const minVal = Number(min) || 1;
    const maxVal = Number(max) || 1;
    if (maxVal <= minVal) return '';

    const limit = (maxAllowed !== undefined && maxAllowed !== null) ? Number(maxAllowed) : maxVal;

    if (Array.isArray(tickValues) && tickValues.length > 0) {
        if (tickValues.length > 35) return '';
        let ticksHtml = '';
        for (const val of tickValues) {
            const isDisabled = val > limit;
            ticksHtml += `<span class="calc-slider-tick${isDisabled ? ' is-disabled' : ''}" aria-hidden="true"></span>`;
        }
        return ticksHtml;
    }

    const count = maxVal - minVal + 1;
    // Guard against rendering excessive DOM nodes on wide-range non-level sliders
    if (count > 35) return '';

    let ticksHtml = '';
    for (let i = 0; i < count; i++) {
        const stepVal = minVal + i;
        const isDisabled = stepVal > limit;
        ticksHtml += `<span class="calc-slider-tick${isDisabled ? ' is-disabled' : ''}" aria-hidden="true"></span>`;
    }
    return ticksHtml;
}

/**
 * Renders a standardized stepped range slider with restored track fill and below-track step indicators.
 *
 * @param {SteppedSliderOptions} [options={}]
 * @returns {string} HTML string of the stepped slider component.
 */
export function renderSteppedSliderHtml({
    min = 1,
    max = 1,
    value = 1,
    maxAllowed = undefined,
    id = '',
    className = '',
    wrapClassName = '',
    dataAttributes = {},
    ariaLabel = '',
    disabled = false,
    withTicks = true,
    tickValues = null
} = {}) {
    const minNum = Number(min) || 1;
    const maxNum = Math.max(minNum, Number(max) || 1);
    const limitNum = (maxAllowed !== undefined && maxAllowed !== null)
        ? Math.min(maxNum, Math.max(minNum, Number(maxAllowed)))
        : maxNum;
    const curVal = Math.min(Math.max(Number(value) || minNum, minNum), limitNum);

    let dataAttrsStr = '';
    if (dataAttributes && typeof dataAttributes === 'object') {
        for (const [k, v] of Object.entries(dataAttributes)) {
            if (v !== undefined && v !== null) {
                const attrName = k.startsWith('data-') ? k : `data-${k.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
                dataAttrsStr += ` ${attrName}="${escapeHTML(String(v))}"`;
            }
        }
    }
    if (limitNum < maxNum) {
        dataAttrsStr += ` data-max-allowed="${limitNum}"`;
    }

    const idAttr = id ? ` id="${escapeHTML(id)}"` : '';
    const classAttr = className ? ` ${className}` : '';
    const hasDisabledSteps = limitNum < maxNum;
    const disabledStepsClass = hasDisabledSteps ? ' has-disabled-steps' : '';
    const wrapClassAttr = (wrapClassName ? ` ${wrapClassName}` : '') + disabledStepsClass;
    const ariaAttr = ariaLabel ? ` aria-label="${escapeHTML(ariaLabel)}"` : '';
    const disabledAttr = disabled ? ' disabled' : '';

    const ticksHtml = withTicks ? renderSliderTicksHtml(minNum, maxNum, limitNum, tickValues) : '';

    let lockedTrackHtml = '';
    if (hasDisabledSteps) {
        const allowedRatio = (limitNum - minNum) / (maxNum - minNum);
        const allowedPct = allowedRatio * 100;
        lockedTrackHtml = `<div class="calc-slider-locked-track" style="--slider-locked-ratio: ${allowedRatio.toFixed(4)}; --slider-locked-start: ${allowedPct.toFixed(2)}%;" aria-hidden="true"></div>`;
    }

    return `
        <div class="calc-stepped-slider${wrapClassAttr}">
            ${lockedTrackHtml}
            <input type="range"
                class="calc-slider${classAttr}"${idAttr}
                min="${minNum}"
                max="${maxNum}"
                value="${curVal}"${ariaAttr}${disabledAttr}${dataAttrsStr}>
            ${ticksHtml ? `<div class="calc-slider-ticks" aria-hidden="true">${ticksHtml}</div>` : ''}
        </div>
    `.trim();
}
