import { translate } from '../i18n/translator.js';

import { hideNativePopover, positionPopover, showNativePopover } from './inputPopoverPositioner.js';
import { getButtonHotkey, renderPopoverContent } from './inputPopoverRenderer.js';

let activePopoverInstance = null;
let isGlobalScrollResizeBound = false;

function ensureGlobalScrollResizeListeners() {
    if (isGlobalScrollResizeBound || typeof window === 'undefined') return;
    isGlobalScrollResizeBound = true;

    const handleGlobalScrollResize = () => {
        if (!activePopoverInstance) return;
        if (document.activeElement === activePopoverInstance.inputElement) {
            activePopoverInstance.positionThrottled();
        } else {
            activePopoverInstance.hide();
        }
    };

    window.addEventListener('scroll', handleGlobalScrollResize, { capture: true, passive: true });
    window.addEventListener('resize', handleGlobalScrollResize, { passive: true });
}

/**
 * Registers a customizable premium input popover feature provider on an input element.
 *
 * @param {HTMLInputElement|HTMLElement|Element|any} inputElement - The input field to attach the popover to.
 * @param {Object} options - Configuration options for the popover features.
 */
export function registerInputPopover(inputElement, options = {}) {
    if (!inputElement) return;
    const parent = inputElement.parentNode;
    if (!parent) return;

    ensureGlobalScrollResizeListeners();

    if (inputElement.type === 'number' || inputElement.classList.contains('updatable') || inputElement.classList.contains('level-input')) {
        if (!inputElement.hasAttribute('inputmode')) inputElement.setAttribute('inputmode', 'numeric');
        inputElement.setAttribute('autocomplete', 'off');
        inputElement.setAttribute('autocorrect', 'off');
        inputElement.setAttribute('spellcheck', 'false');
    }

    const getMin = () => {
        if (typeof options.min === 'function') return options.min();
        const minValRaw = options.min !== undefined ? options.min : parseFloat(inputElement.min);
        return isNaN(minValRaw) ? 0 : minValRaw;
    };

    const getMax = () => {
        if (typeof options.max === 'function') return options.max();
        const maxValRaw = options.max !== undefined ? options.max : parseFloat(inputElement.max);
        return isNaN(maxValRaw) ? Infinity : maxValRaw;
    };

    const showTitle = !!options.showTitle;
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
        if (typeof options.showRecommended === 'function') return options.showRecommended();
        return !!options.showRecommended;
    };

    const getTitleText = () => {
        if (typeof options.title === 'function') return options.title();
        return options.title !== undefined ? options.title : '';
    };
    const enableValidationColoring = options.enableValidationColoring !== false;

    const clickToFill = {
        min: false,
        max: false,
        recommended: false,
        ...(options.clickToFill || {})
    };

    const getTargetContainer = () => inputElement.closest('dialog.modal, .modal, [role="dialog"]') || document.body;

    if (inputElement._popoverElement && inputElement._popoverElement.parentElement) {
        inputElement._popoverElement.parentElement.removeChild(inputElement._popoverElement);
    }

    const popover = document.createElement('div');
    popover.className = 'input-feature-popover';
    popover.setAttribute('popover', 'manual');
    popover.style.position = 'fixed';
    popover.style.margin = '0';
    popover.style.transform = 'none';
    popover.style.bottom = 'auto';
    getTargetContainer().appendChild(popover);
    inputElement._popoverElement = popover;

    const getRecommendedValue = () => {
        if (typeof options.recommended === 'function') return options.recommended();
        return options.recommended !== undefined ? options.recommended : 0;
    };

    const getRecommendedLabel = () => {
        if (typeof options.recommendedLabel === 'function') return options.recommendedLabel();
        return options.recommendedLabel !== undefined ? options.recommendedLabel : translate('validation.recommended');
    };

    const getCustomButtons = () => {
        if (typeof options.customButtons === 'function') return options.customButtons();
        return Array.isArray(options.customButtons) ? options.customButtons : [];
    };

    let positioningFrame = null;
    const positionPopoverThrottled = () => {
        if (positioningFrame) return;
        positioningFrame = requestAnimationFrame(() => {
            positionPopover(popover, inputElement, options);
            positioningFrame = null;
        });
    };

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

        popover.innerHTML = renderPopoverContent({
            val,
            recVal,
            currMin,
            currMax,
            showTitle,
            titleText: getTitleText(),
            showRange,
            showMin: getShowMin(currMin),
            showMax: getShowMax(),
            showRecNow,
            enableValidationColoring,
            clickToFill,
            allowHotkeys: options.showHotkeys !== undefined ? options.showHotkeys : true,
            customButtons: getCustomButtons(),
            recommendedLabel: getRecommendedLabel()
        });

        if (popover.classList.contains('show')) {
            positionPopoverThrottled();
        }
    };

    const handleKeyDown = (e) => {
        if (!popover.classList.contains('show')) return;
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
            if (typeof inputElement.blur === 'function') {
                inputElement.blur();
            }
            actionTriggered = true;
        } else {
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

    let animationFrameId = null;

    const stopTrackingPosition = () => {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    };

    const trackPositionLoop = () => {
        if (!popover.classList.contains('show') || document.activeElement !== inputElement) {
            stopTrackingPosition();
            return;
        }
        positionPopover(popover, inputElement, options);
        animationFrameId = requestAnimationFrame(trackPositionLoop);
    };

    const showPopover = () => {
        inputElement._previousPopoverValue = undefined;
        updatePopover();

        const parentModal = inputElement.closest('.modal, .modal-content, [role="dialog"]');
        if (parentModal) {
            if (!parentModal._popoverAnimListenerAttached) {
                parentModal._popoverAnimListenerAttached = true;
                const handleModalAnimationEvent = () => {
                    if (activePopoverInstance) {
                        activePopoverInstance.positionThrottled();
                    }
                };
                parentModal.addEventListener('animationend', handleModalAnimationEvent);
                parentModal.addEventListener('transitionend', handleModalAnimationEvent);
            }
        }

        const container = getTargetContainer();
        if (popover.parentNode !== container) {
            container.appendChild(popover);
        }

        popover.style.position = 'fixed';
        popover.style.bottom = 'auto';
        popover.style.right = 'auto';
        popover.style.visibility = 'hidden';
        popover.style.display = 'flex';
        popover.style.opacity = '0';
        popover.style.transform = 'none';
        popover.style.transition = 'opacity 0.15s ease';
        popover.classList.add('show');

        showNativePopover(popover);
        positionPopover(popover, inputElement, options);

        popover.style.visibility = '';
        popover.style.opacity = '1';
        popover.style.pointerEvents = 'auto';

        activePopoverInstance = {
            inputElement,
            positionThrottled: positionPopoverThrottled,
            hide: hidePopover
        };

        stopTrackingPosition();
        trackPositionLoop();
    };

    const hidePopover = () => {
        if (activePopoverInstance?.inputElement === inputElement) {
            activePopoverInstance = null;
        }

        stopTrackingPosition();
        popover.classList.remove('show');
        popover.style.opacity = '0';
        popover.style.pointerEvents = 'none';
        popover.style.zIndex = '';

        hideNativePopover(popover);
    };

    popover.addEventListener('toggle', (event) => {
        if (event.newState === 'closed') {
            if (activePopoverInstance?.inputElement === inputElement) {
                activePopoverInstance = null;
            }
            stopTrackingPosition();
            popover.classList.remove('show');
            popover.style.opacity = '0';
            popover.style.pointerEvents = 'none';
            popover.style.zIndex = '';
        }
    });

    let isInteractingWithPopover = false;

    const handleBlur = () => {
        setTimeout(() => {
            if (isInteractingWithPopover) {
                isInteractingWithPopover = false;
                return;
            }
            const active = document.activeElement;
            if (!active || (active !== inputElement && !popover.contains(active))) {
                hidePopover();
            }
        }, 150);
    };

    inputElement.addEventListener('focus', showPopover);
    inputElement.addEventListener('input', updatePopover);
    inputElement.addEventListener('keydown', handleKeyDown);
    inputElement.addEventListener('blur', handleBlur);
    inputElement.addEventListener('focusout', handleBlur);

    const preventInputBlur = (e) => {
        isInteractingWithPopover = true;
        e.stopPropagation();
        if (e.target && typeof e.target.closest === 'function' && e.target.closest('.popover-opt-btn')) {
            return;
        }
        e.preventDefault();
    };
    popover.addEventListener('mousedown', preventInputBlur);
    popover.addEventListener('pointerdown', preventInputBlur);

    const handleOptionSelect = (e) => {
        e.stopPropagation();
        const item = e.target && typeof e.target.closest === 'function' ? e.target.closest('.popover-opt-btn') : null;
        if (!item || !item.classList.contains('clickable')) return;

        e.preventDefault();

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
            const index = Number(item.dataset.index) || 0;
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
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
            queueMicrotask(() => {
                hidePopover();
            });
        } else {
            updatePopover();
        }
    };

    popover.addEventListener('click', handleOptionSelect);
}
