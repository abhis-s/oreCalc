/**
 * Centralized Declarative Clipboard Input Controller.
 * Provides manual paste buttons with shake/error feedback and optional pattern-guarded auto-paste.
 * Tier 4: Common UI Component Controller.
 */

import { showToast } from '../../ui/toast.js';
import { translate } from '../../i18n/translator.js';
import { extractPlayerTag } from '../../utils/playerTagValidator.js';

/** Global maximum clipboard ingestion length to prevent multi-megabyte payloads */
export const GLOBAL_MAX_CLIPBOARD_LENGTH = 256;

/**
 * Normalizes and extracts a raw UUID string or URL containing a userId query parameter.
 *
 * @param {string} raw
 * @returns {string} Sanitized candidate UUID string.
 */
export function cleanUuid(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let val = raw.trim();
    if (val.includes('userId=')) {
        try {
            const url = new URL(val);
            const extracted = url.searchParams.get('userId');
            if (extracted) {
                val = extracted;
            }
        } catch {
            const match = val.match(/[?&]userId=([0-9a-fA-F-]+)/);
            if (match && match[1]) {
                val = match[1];
            }
        }
    }
    return val;
}

/** UUID v4 / standard 36-character hexadecimal identifier pattern */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Predefined clipboard pattern validators and sanitizers */
export const CLIPBOARD_PATTERNS = {
    'player-tag': {
        validate: (raw) => {
            if (!raw || typeof raw !== 'string') return false;
            if (raw.length > GLOBAL_MAX_CLIPBOARD_LENGTH) return false;
            return Boolean(extractPlayerTag(raw));
        },
        clean: (raw) => extractPlayerTag(raw) || ''
    },
    'uuid': {
        validate: (raw) => {
            if (!raw || typeof raw !== 'string') return false;
            if (raw.length > GLOBAL_MAX_CLIPBOARD_LENGTH) return false;
            const cleaned = cleanUuid(raw);
            return UUID_REGEX.test(cleaned);
        },
        clean: (raw) => cleanUuid(raw)
    }
};

/**
 * Resolves the pattern definition for a given input element.
 * Supports predefined keys ('player-tag', 'uuid') or custom regex patterns.
 *
 * @param {HTMLInputElement} input
 * @returns {{ validate: (raw: string) => boolean, clean: (raw: string) => string } | null}
 */
export function resolveInputPattern(input) {
    const patternKey = input.dataset.clipboardPaste || '';
    if (patternKey && CLIPBOARD_PATTERNS[patternKey]) {
        return CLIPBOARD_PATTERNS[patternKey];
    }

    const customRegexStr = input.dataset.clipboardPattern;
    if (customRegexStr) {
        try {
            const regex = new RegExp(customRegexStr);
            return {
                validate: (raw) => {
                    if (!raw || typeof raw !== 'string') return false;
                    if (raw.length > GLOBAL_MAX_CLIPBOARD_LENGTH) return false;
                    return regex.test(raw);
                },
                clean: (raw) => raw.trim()
            };
        } catch {
            return null;
        }
    }

    return null;
}

/**
 * Checks whether the browser has pre-granted clipboard-read permission.
 * Strictly zero-prompt: never calls readText if permission is 'prompt' or 'denied'.
 *
 * @returns {Promise<boolean>} True if and only if permission is currently granted.
 */
export async function isClipboardReadPreGranted() {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
        return false;
    }
    if (!navigator.permissions?.query) {
        return false;
    }
    try {
        const permission = await navigator.permissions.query({ name: /** @type {any} */ ('clipboard-read') });
        return permission?.state === 'granted';
    } catch {
        return false;
    }
}

/**
 * Triggers visual shake animation and turns the paste icon red for 1.5 seconds.
 *
 * @param {HTMLButtonElement} button
 */
export function triggerButtonErrorFeedback(button) {
    button.classList.add('is-error');
    const existingTimer = button.dataset.errorTimeout;
    if (existingTimer) {
        clearTimeout(Number(existingTimer));
    }
    const timer = setTimeout(() => {
        button.classList.remove('is-error');
        delete button.dataset.errorTimeout;
    }, 1500);
    button.dataset.errorTimeout = String(timer);
}

/**
 * Applies a sanitized value to an input field and dispatches synthetic input and change events.
 *
 * @param {HTMLInputElement} input
 * @param {string} value
 */
export function applyValueToInput(input, value) {
    const max = input.maxLength > 0 ? input.maxLength : GLOBAL_MAX_CLIPBOARD_LENGTH;
    const finalValue = value.slice(0, max);
    input.value = finalValue;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Executes manual paste from the clipboard upon explicit user button click.
 *
 * @param {HTMLInputElement} input
 * @param {HTMLButtonElement} button
 * @returns {Promise<boolean>}
 */
export async function handleManualPasteClick(input, button) {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
        triggerButtonErrorFeedback(button);
        showToast(translate('alerts.clipboardPermissionDenied') || 'Failed to read from clipboard. Please ensure clipboard permission is granted.', 'error');
        return false;
    }

    let rawText = '';
    try {
        rawText = await navigator.clipboard.readText();
    } catch {
        triggerButtonErrorFeedback(button);
        showToast(translate('alerts.clipboardPermissionDenied') || 'Failed to read from clipboard. Please ensure clipboard permission is granted.', 'error');
        return false;
    }

    if (!rawText || !rawText.trim()) {
        showToast(translate('alerts.clipboardEmpty') || 'Clipboard is empty.', 'info');
        return false;
    }

    const patternDef = resolveInputPattern(input);
    if (patternDef) {
        if (!patternDef.validate(rawText)) {
            triggerButtonErrorFeedback(button);
            const patternKey = input.dataset.clipboardPaste;
            if (patternKey === 'player-tag') {
                showToast(translate('apiErrors.invalidTag') || 'Invalid player tag.', 'error');
            } else if (patternKey === 'uuid') {
                showToast(translate('alerts.invalidUserId') || 'Invalid User ID format.', 'error');
            } else {
                showToast(translate('apiErrors.default') || 'Invalid format.', 'error');
            }
            return false;
        }

        const cleaned = patternDef.clean(rawText);
        applyValueToInput(input, cleaned);
        input.focus();
        return true;
    }

    const pruned = rawText.slice(0, GLOBAL_MAX_CLIPBOARD_LENGTH);
    applyValueToInput(input, pruned);
    input.focus();
    return true;
}

/**
 * Automatically inspects the clipboard and pre-fills the input if permissions are pre-granted
 * and content matches the required pattern. Strictly zero-prompt.
 *
 * @param {HTMLInputElement} input
 * @returns {Promise<boolean>} True if content was auto-pasted, false otherwise.
 */
export async function triggerAutoPaste(input) {
    if (!input || !input.dataset) return false;

    // Auto-paste is optional and strictly disabled unless data-clipboard-auto is set to "true"
    if (input.dataset.clipboardAuto !== 'true') {
        return false;
    }

    // Auto-paste MUST have a valid pattern; generic free-form inputs cannot auto-paste
    const patternDef = resolveInputPattern(input);
    if (!patternDef) {
        return false;
    }

    // Do not overwrite existing non-empty input content
    if (input.value && input.value.trim().length > 0) {
        return false;
    }

    // Strictly check permission without prompting the user
    const isGranted = await isClipboardReadPreGranted();
    if (!isGranted) {
        return false;
    }

    try {
        const rawText = await navigator.clipboard.readText();
        if (!rawText || rawText.length > GLOBAL_MAX_CLIPBOARD_LENGTH) {
            return false;
        }

        if (!patternDef.validate(rawText)) {
            return false;
        }

        const cleaned = patternDef.clean(rawText);
        if (!cleaned) return false;

        applyValueToInput(input, cleaned);
        return true;
    } catch {
        return false;
    }
}

/**
 * Enhances a single input element with a centralized paste button and wrappers.
 *
 * @param {HTMLInputElement} input
 * @returns {HTMLButtonElement | null} The created paste button or null.
 */
export function enhanceClipboardInput(input) {
    if (!input) {
        return null;
    }

    if (input.dataset?.clipboardEnhanced === 'true') {
        const parent = input.parentElement;
        return parent && typeof parent.querySelector === 'function' ? parent.querySelector('.clipboard-paste-btn') : null;
    }

    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
        return null;
    }

    const parent = input.parentElement;
    if (!parent || typeof parent.insertBefore !== 'function') {
        return null;
    }

    let wrapper = parent;
    if (!wrapper.classList?.contains('clipboard-input-wrapper')) {
        wrapper = document.createElement('div');
        wrapper.className = 'clipboard-input-wrapper';
        parent.insertBefore(wrapper, input);
        if (typeof wrapper.appendChild === 'function') {
            wrapper.appendChild(input);
        }
    }

    const pasteBtn = document.createElement('button');
    pasteBtn.type = 'button';
    pasteBtn.className = 'clipboard-paste-btn';
    pasteBtn.setAttribute('aria-label', translate('actions.paste') || 'Paste');
    pasteBtn.title = translate('actions.paste') || 'Paste';
    pasteBtn.innerHTML = '<clashcalc-assets-svg name="paste"></clashcalc-assets-svg>';

    if (typeof pasteBtn.addEventListener === 'function') {
        pasteBtn.addEventListener('click', (e) => {
            if (e && typeof e.preventDefault === 'function') e.preventDefault();
            if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
            void handleManualPasteClick(input, pasteBtn);
        });
    }

    if (typeof wrapper.appendChild === 'function') {
        wrapper.appendChild(pasteBtn);
    }
    if (input.dataset) {
        input.dataset.clipboardEnhanced = 'true';
    }

    return pasteBtn;
}

/**
 * Scans the provided DOM root for any inputs with data-clipboard-paste and enhances them.
 *
 * @param {ParentNode | null} [root]
 */
export function initClipboardInputs(root = (typeof document !== 'undefined' ? document : null)) {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    const inputs = root.querySelectorAll('input[data-clipboard-paste]');
    inputs.forEach((el) => {
        if (typeof HTMLInputElement !== 'undefined' && el instanceof HTMLInputElement) {
            enhanceClipboardInput(el);
        } else if (el) {
            enhanceClipboardInput(/** @type {HTMLInputElement} */ (el));
        }
    });
}
