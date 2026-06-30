import { translate } from '../i18n/translator.js';

import { formatNumber } from './numberFormatter.js';

/**
 * Registers a customizable premium input popover feature provider on an input element.
 * 
 * @param {HTMLInputElement} inputElement - The input field to attach the popover to.
 * @param {Object} options - Configuration options for the popover features.
 */
export function registerInputPopover(inputElement, options = {}) {
    const parent = inputElement.parentNode;
    if (!parent) return;

    // 1. Core value extraction & defaults
    const getMin = () => {
        if (typeof options.min === 'function') {
            return options.min();
        }
        const minValRaw = options.min !== undefined ? options.min : parseFloat(inputElement.min);
        return isNaN(minValRaw) ? 0 : minValRaw;
    };

    const getMax = () => {
        if (typeof options.max === 'function') {
            return options.max();
        }
        const maxValRaw = options.max !== undefined ? options.max : parseFloat(inputElement.max);
        return isNaN(maxValRaw) ? Infinity : maxValRaw;
    };

    const showTitle = !!options.showTitle; // defaults to false!
    const showRange = !!options.showRange;
    
    const getShowMin = (currMin) => {
        if (showRange) return false;
        return options.showMin !== undefined ? !!options.showMin : (currMin !== 0);
    };

    const getShowMax = () => {
        if (showRange) return false;
        return options.showMax !== false;
    };

    const isRecommendedEnabled = () => {
        if (typeof options.showRecommended === 'function') {
            return options.showRecommended();
        }
        return !!options.showRecommended;
    };
    
    const getTitleText = () => {
        if (typeof options.title === 'function') {
            return options.title();
        }
        return options.title !== undefined ? options.title : '';
    };
    const enableValidationColoring = options.enableValidationColoring !== false;

    const clickToFill = {
        min: false,
        max: false,
        recommended: false,
        ...(options.clickToFill || {})
    };

    // 2. Create popover DOM element
    const popover = document.createElement('div');
    popover.className = 'input-feature-popover';
    popover.style.position = 'fixed';
    popover.style.margin = '0';
    popover.style.transform = 'none';
    popover.style.bottom = 'auto'; // Prevent CSS bottom constraint from collapsing height
    document.body.appendChild(popover);

    // 3. Helper to determine current dynamic values
    const getRecommendedValue = () => {
        if (typeof options.recommended === 'function') {
            return options.recommended();
        }
        return options.recommended !== undefined ? options.recommended : 0;
    };

    const getRecommendedLabel = () => {
        if (typeof options.recommendedLabel === 'function') {
            return options.recommendedLabel();
        }
        return options.recommendedLabel !== undefined ? options.recommendedLabel : 'Recommended';
    };

    const getCustomButtons = () => {
        if (typeof options.customButtons === 'function') {
            return options.customButtons();
        }
        return Array.isArray(options.customButtons) ? options.customButtons : [];
    };

    // 5. Shared layout calculation for fixed positioning
    const positionPopover = () => {
        if (!popover.classList.contains('show')) return;

        const popoverRect = popover.getBoundingClientRect();
        const inputRect = inputElement.getBoundingClientRect();

        const viewportHeight = window.innerHeight;
        const spaceAbove = inputRect.top;
        const spaceBelow = viewportHeight - inputRect.bottom;

        const placement = options.placement || 'auto';
        let placeBelow = false;

        if (placement === 'force-below') {
            placeBelow = true;
        } else if (placement === 'force-above') {
            placeBelow = false;
        } else if (placement === 'prefer-below') {
            placeBelow = (spaceBelow >= 100 || spaceBelow > spaceAbove);
        } else { // prefer-above or auto
            placeBelow = !(spaceAbove >= 100 || spaceAbove > spaceBelow);
        }

        // Calculate fixed positioning coordinates
        let top = 0;
        if (placeBelow) {
            top = inputRect.bottom + 6;
            popover.classList.add('position-below');
        } else {
            top = inputRect.top - popoverRect.height - 6;
            popover.classList.remove('position-below');
        }

        let left = inputRect.left + (inputRect.width / 2) - (popoverRect.width / 2);

        // Keep within viewport horizontal bounds
        const viewportWidth = window.innerWidth;
        if (left < 8) {
            left = 8;
        } else if (left + popoverRect.width > viewportWidth - 8) {
            left = viewportWidth - popoverRect.width - 8;
        }

        popover.style.top = `${top}px`;
        popover.style.left = `${left}px`;
    };

    const getButtonHotkey = (btn, btnLabel) => {
        if (btn.hotkey) return btn.hotkey;
        const lowerLabel = btnLabel.toLowerCase();
        if (lowerLabel.includes('disable') || lowerLabel.includes('enable')) {
            return 'd';
        }
        return null;
    };

    // 4. Update popover contents & visual states dynamically
    const updatePopover = () => {
        const val = parseFloat(inputElement.value) || 0;
        const recVal = getRecommendedValue();
        const currMin = getMin();
        const currMax = getMax();
        
        let showRecNow = isRecommendedEnabled() && (recVal !== undefined && recVal !== null);
        if (showRecNow) {
            if (val === recVal) {
                showRecNow = false;
            } else if (options.hideRecommendedIfHigher && val > recVal) {
                showRecNow = false;
            } else if (options.hideRecommendedIfLower && val < recVal) {
                showRecNow = false;
            }
        }

        const isMinViolated = enableValidationColoring && (val < currMin);
        const isMaxViolated = enableValidationColoring && (val > currMax);

        let html = '';

        // Render Title
        const titleText = getTitleText();
        if (showTitle && titleText) {
            html += `<div class="popover-title">${titleText}</div>`;
        }

        html += `<div class="popover-options">`;

        // Render Custom Buttons (at the top)
        const customButtons = getCustomButtons();
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

        // Render Range
        if (showRange) {
            html += `
                <div class="popover-opt-btn readonly" data-action="range" role="document">
                     <span>${translate('validation.range') || 'Range'}</span>
                    <strong>${formatNumber(currMin)} - ${formatNumber(currMax)}</strong>
                </div>
            `;
        }

        // Render Min
        if (getShowMin(currMin)) {
            const isClickable = clickToFill.min && (val !== currMin);
            const clickableClass = isClickable ? 'clickable' : 'readonly';
            let statusClass = '';
            if (enableValidationColoring) {
                if (val < currMin) statusClass = 'exceeded-color';
                else if (val === currMin) statusClass = 'match-color';
            }
            const hotkeyLabel = isClickable ? ' <kbd class="popover-key-badge">N</kbd>' : '';
            html += `
                <div class="popover-opt-btn ${clickableClass} ${statusClass}" data-action="min" role="${isClickable ? 'button' : 'document'}">
                     <span>Min${hotkeyLabel}</span>
                    <strong>${formatNumber(currMin)}</strong>
                </div>
            `;
        }

        // Render Recommended
        if (showRecNow) {
            const isOutOfBounds = recVal < currMin || recVal > currMax;
            const isClickable = clickToFill.recommended && (val !== recVal) && !isOutOfBounds;
            const clickableClass = isClickable ? 'clickable' : 'readonly';
            let statusClass = '';
            if (enableValidationColoring && isOutOfBounds) {
                statusClass = 'exceeded-color';
            }
            const hotkeyLabel = isClickable ? ' <kbd class="popover-key-badge">R</kbd>' : '';
            html += `
                <div class="popover-opt-btn ${clickableClass} ${statusClass}" data-action="recommended" role="${isClickable ? 'button' : 'document'}">
                     <span>${getRecommendedLabel()}${hotkeyLabel}</span>
                    <strong>${formatNumber(recVal)}</strong>
                </div>
            `;
        }

        // Render Max
        if (getShowMax()) {
            const isClickable = clickToFill.max && (val !== currMax);
            const clickableClass = isClickable ? 'clickable' : 'readonly';
            let statusClass = '';
            if (enableValidationColoring) {
                if (val > currMax) statusClass = 'exceeded-color';
                else if (val === currMax) statusClass = 'match-color';
            }
            const hotkeyLabel = isClickable ? ' <kbd class="popover-key-badge">X</kbd>' : '';
            html += `
                <div class="popover-opt-btn ${clickableClass} ${statusClass}" data-action="max" role="${isClickable ? 'button' : 'document'}">
                     <span>Max${hotkeyLabel}</span>
                    <strong>${formatNumber(currMax)}</strong>
                </div>
            `;
        }

        html += `</div>`;
        popover.innerHTML = html;

        if (popover.classList.contains('show')) {
            positionPopover();
        }
    };

    // 6. Keyboard Hotkeys Listener
    const handleKeyDown = (e) => {
        if (!popover.classList.contains('show')) return;
        
        // Ignore modifier keys like Ctrl, Cmd, Alt, Shift
        if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;

        const key = e.key.toLowerCase();
        let actionTriggered = false;
        const val = parseFloat(inputElement.value);

        if (key === 'n') {
            const currMin = getMin();
            if (getShowMin(currMin) && clickToFill.min) {
                if (val !== currMin) {
                    inputElement._previousPopoverValue = inputElement.value;
                    inputElement.value = currMin;
                } else if (inputElement._previousPopoverValue !== undefined) {
                    inputElement.value = inputElement._previousPopoverValue;
                }
                actionTriggered = true;
            }
        } else if (key === 'x') {
            const currMax = getMax();
            if (getShowMax() && clickToFill.max) {
                if (val !== currMax) {
                    inputElement._previousPopoverValue = inputElement.value;
                    inputElement.value = currMax;
                } else if (inputElement._previousPopoverValue !== undefined) {
                    inputElement.value = inputElement._previousPopoverValue;
                }
                actionTriggered = true;
            }
        } else if (key === 'r') {
            const recVal = getRecommendedValue();
            const showRecNow = isRecommendedEnabled() && (recVal !== undefined && recVal !== null);
            if (showRecNow && clickToFill.recommended) {
                if (val !== recVal) {
                    inputElement._previousPopoverValue = inputElement.value;
                    inputElement.value = recVal;
                } else if (inputElement._previousPopoverValue !== undefined) {
                    inputElement.value = inputElement._previousPopoverValue;
                }
                actionTriggered = true;
            }
        } else if (key === 'escape') {
            hidePopover();
            inputElement.blur();
            actionTriggered = true;
        } else {
            // Check custom buttons
            const customButtons = getCustomButtons();
            for (let i = 0; i < customButtons.length; i++) {
                const btn = customButtons[i];
                const btnLabel = typeof btn.label === 'function' ? btn.label() : btn.label;
                const hotkey = getButtonHotkey(btn, btnLabel);
                if (hotkey && key === hotkey) {
                    const btnVal = typeof btn.value === 'function' ? btn.value() : btn.value;
                    const isClickable = btn.clickToFill !== false ? (val !== btnVal) : true;
                    if (isClickable) {
                        if (btn.clickToFill !== false && btnVal !== undefined) {
                            if (val !== btnVal) {
                                inputElement._previousPopoverValue = inputElement.value;
                                inputElement.value = btnVal;
                            } else if (inputElement._previousPopoverValue !== undefined) {
                                inputElement.value = inputElement._previousPopoverValue;
                            }
                        }
                        if (typeof btn.action === 'function') {
                            btn.action(inputElement, btnVal);
                        }
                        actionTriggered = true;
                    }
                    break;
                }
            }
        }

        if (actionTriggered) {
            e.preventDefault();
            e.stopPropagation();
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
            updatePopover();
        }
    };

    // 7. Handle standard show/hide triggers
    const showPopover = () => {
        // Clear previous toggle value when popover is shown
        inputElement._previousPopoverValue = undefined;
        updatePopover();

        // Temporarily display to measure height/width
        popover.style.visibility = 'hidden';
        popover.style.display = 'flex';
        popover.style.opacity = '0';
        popover.style.transform = 'none';
        popover.classList.add('show');

        positionPopover();

        popover.style.visibility = '';
        popover.style.opacity = '1';
        popover.style.pointerEvents = 'auto';
    };

    const hidePopover = () => {
        popover.classList.remove('show');
        popover.style.opacity = '0';
        popover.style.pointerEvents = 'none';
    };

    inputElement.addEventListener('focus', showPopover);
    inputElement.addEventListener('input', updatePopover);
    inputElement.addEventListener('keydown', handleKeyDown);
    
    inputElement.addEventListener('blur', () => {
        setTimeout(hidePopover, 150);
    });

    // Auto-hide when scrolling or resizing anywhere
    const handleScrollResize = () => {
        hidePopover();
    };
    window.addEventListener('scroll', handleScrollResize, { capture: true, passive: true });
    window.addEventListener('resize', handleScrollResize, { passive: true });

    // 8. Actionable Event Listeners using Delegation
    popover.addEventListener('mousedown', (e) => {
        // Prevent loss of focus on the input field so popover stays open
        e.preventDefault();
    });

    popover.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = e.target.closest('.popover-opt-btn');
        if (!item || !item.classList.contains('clickable')) return;

        const action = item.dataset.action;
        let targetVal;

        if (action === 'min') {
            targetVal = getMin();
        } else if (action === 'max') {
            targetVal = getMax();
        } else if (action === 'recommended') {
            targetVal = getRecommendedValue();
            if (typeof options.onRecommendedFill === 'function') {
                options.onRecommendedFill(inputElement, targetVal);
            }
        } else if (action === 'custom') {
            const index = parseInt(item.dataset.index, 10);
            const customButtons = getCustomButtons();
            const btn = customButtons[index];
            if (btn) {
                const btnVal = typeof btn.value === 'function' ? btn.value() : btn.value;
                if (btn.clickToFill !== false) {
                    targetVal = btnVal;
                }
                if (typeof btn.action === 'function') {
                    btn.action(inputElement, btnVal);
                }
            }
        }

        if (targetVal !== undefined) {
            inputElement.value = targetVal;
            // Dispatch standard events so that app-wide input validation triggers
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
            hidePopover();
        } else {
            // Action button clicked - update popover contents in case state changed
            updatePopover();
        }
    });
}

