import { translate } from '../i18n/translator.js';
import { formatNumber } from './numberFormatter.js';

/**
 * Resolves hotkey character for a button if available.
 *
 * @param {Object} btn
 * @param {string} [btnLabel]
 * @returns {string|null}
 */
export function getButtonHotkey(btn, btnLabel) {
    if (btn?.hotkey) return btn.hotkey;
    const lowerLabel = (btnLabel || '').toLowerCase();
    const actionsDisable = translate('actions.disable').toLowerCase();
    const actionsEnable = translate('actions.enable').toLowerCase();
    const equipDisable = translate('views.equipment.disable').toLowerCase();
    const equipEnable = translate('views.equipment.enable').toLowerCase();

    if (lowerLabel.includes('disable') || lowerLabel.includes('enable') ||
        lowerLabel.includes('deaktivieren') || lowerLabel.includes('aktivieren') ||
        lowerLabel.includes(actionsDisable) || lowerLabel.includes(actionsEnable) ||
        lowerLabel.includes(equipDisable) || lowerLabel.includes(equipEnable)) {
        return 'd';
    }
    return null;
}

/**
 * Builds inner HTML content for the input feature popover.
 *
 * @param {Object} cfg
 * @returns {string}
 */
export function renderPopoverContent(cfg) {
    const {
        val,
        recVal,
        currMin,
        currMax,
        showTitle,
        titleText,
        showRange,
        showMin,
        showMax,
        showRecNow,
        enableValidationColoring,
        clickToFill,
        allowHotkeys,
        customButtons,
        minLabel,
        maxLabel,
        recommendedLabel
    } = cfg;

    let html = '';

    if (showTitle && titleText) {
        html += `<div class="popover-title">${titleText}</div>`;
    }

    html += `<div class="popover-options">`;

    customButtons.forEach((btn, index) => {
        const btnVal = typeof btn.value === 'function' ? btn.value() : btn.value;
        const btnLabel = typeof btn.label === 'function' ? btn.label() : btn.label;
        const isClickable = btn.clickToFill !== false ? (val !== btnVal) : true;
        const clickableClass = isClickable ? 'clickable' : 'readonly';
        const extraClass = typeof btn.className === 'function' ? btn.className() : (btn.className || '');
        const hotkey = getButtonHotkey(btn, btnLabel);
        const hotkeyLabel = (isClickable && hotkey) ? ` <kbd class="popover-key-badge">${hotkey.toUpperCase()}</kbd>` : '';

        html += `
            <div class="popover-opt-btn ${clickableClass} ${extraClass}" data-action="custom" data-index="${index}" role="${isClickable ? 'button' : 'document'}">
                 <span>${btnLabel}${hotkeyLabel}</span>
                ${btnVal !== undefined ? `<strong>${formatNumber(btnVal)}</strong>` : ''}
            </div>
        `;
    });

    if (showRange) {
        html += `
            <div class="popover-opt-btn readonly" data-action="range" role="document">
                 <span>${translate('validation.range')}</span>
                <strong>${formatNumber(currMin)} - ${formatNumber(currMax)}</strong>
            </div>
        `;
    }

    if (showMin) {
        const isClickable = clickToFill.min && (val !== currMin);
        const clickableClass = isClickable ? 'clickable' : 'readonly';
        let statusClass = '';
        if (enableValidationColoring) {
            if (val < currMin) statusClass = 'exceeded-color';
            else if (val === currMin) statusClass = 'match-color';
        }
        const effectiveMinLabel = minLabel || translate('validation.min');
        const minHotkey = getButtonHotkey({ hotkey: cfg.minHotkey }, effectiveMinLabel) || 'n';
        const hotkeyLabel = (isClickable && allowHotkeys) ? ` <kbd class="popover-key-badge">${minHotkey.toUpperCase()}</kbd>` : '';
        html += `
            <div class="popover-opt-btn ${clickableClass} ${statusClass}" data-action="min" role="${isClickable ? 'button' : 'document'}">
                 <span>${effectiveMinLabel}${hotkeyLabel}</span>
                <strong>${formatNumber(currMin)}</strong>
            </div>
        `;
    }

    if (showRecNow) {
        const isOutOfBounds = recVal < currMin || recVal > currMax;
        const isClickable = clickToFill.recommended && (val !== recVal) && !isOutOfBounds;
        const clickableClass = isClickable ? 'clickable' : 'readonly';
        let statusClass = '';
        if (enableValidationColoring && isOutOfBounds) {
            statusClass = 'exceeded-color';
        }
        const hotkeyLabel = (isClickable && allowHotkeys) ? ' <kbd class="popover-key-badge">R</kbd>' : '';
        html += `
            <div class="popover-opt-btn ${clickableClass} ${statusClass}" data-action="recommended" role="${isClickable ? 'button' : 'document'}">
                 <span>${recommendedLabel}${hotkeyLabel}</span>
                <strong>${formatNumber(recVal)}</strong>
            </div>
        `;
    }

    if (showMax) {
        const isClickable = clickToFill.max && (val !== currMax);
        const clickableClass = isClickable ? 'clickable' : 'readonly';
        let statusClass = '';
        if (enableValidationColoring) {
            if (val > currMax) statusClass = 'exceeded-color';
            else if (val === currMax) statusClass = 'match-color';
        }
        const effectiveMaxLabel = maxLabel || translate('validation.max');
        const maxHotkey = getButtonHotkey({ hotkey: cfg.maxHotkey }, effectiveMaxLabel) || 'x';
        const hotkeyLabel = (isClickable && allowHotkeys) ? ` <kbd class="popover-key-badge">${maxHotkey.toUpperCase()}</kbd>` : '';
        html += `
            <div class="popover-opt-btn ${clickableClass} ${statusClass}" data-action="max" role="${isClickable ? 'button' : 'document'}">
                 <span>${effectiveMaxLabel}${hotkeyLabel}</span>
                <strong>${formatNumber(currMax)}</strong>
            </div>
        `;
    }

    html += `</div>`;
    return html;
}
