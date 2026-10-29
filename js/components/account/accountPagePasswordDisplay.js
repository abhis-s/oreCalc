/**
 * Account Page Password Display Controller.
 * Manages password configuration card UI states, drawer animations, and validation indicators.
 * Tier 4: Account Sub-Panel Display Module.
 */

import { translate } from '../../i18n/translator.js';
import { setAnimatedButtonContent } from './accountDisplayUtils.js';

let currentPasskeysCount = 0;

/**
 * Renders the password section states, labels, and input group visibility.
 *
 * @param {boolean} [hasPassword=true] - Whether user has a configured password.
 * @param {number} [passkeysCount=currentPasskeysCount] - Number of registered passkeys.
 */
export function renderPasswordSection(hasPassword = true, passkeysCount = currentPasskeysCount) {
    currentPasskeysCount = passkeysCount;
    const desc = document.getElementById('account-password-desc');
    const toggleBtn = document.getElementById('account-btn-toggle-password-drawer');
    const removeSection = document.getElementById('account-password-remove-section');
    const currentGroup = document.getElementById('account-password-current-group');
    const drawer = document.getElementById('account-password-drawer');
    const isDrawerOpen = Boolean(drawer && !drawer.hasAttribute('hidden'));

    if (desc) {
        desc.textContent = hasPassword
            ? translate('views.account.passwordConfiguredDesc')
            : translate('views.account.passwordNotSetDesc');
    }

    if (toggleBtn) {
        let labelKey = 'auth.changePassword';
        let icon = 'password';
        if (isDrawerOpen) {
            labelKey = 'actions.dismiss';
            icon = 'close';
        } else if (!hasPassword) {
            labelKey = 'auth.setPassword';
            icon = 'password';
        } else if (passkeysCount > 0) {
            labelKey = 'actions.manage';
            icon = 'password';
        } else {
            labelKey = 'auth.changePassword';
            icon = 'password';
        }
        toggleBtn.setAttribute('data-i18n', labelKey);
        setAnimatedButtonContent(toggleBtn, translate(labelKey), icon);
    }

    if (removeSection) {
        if (hasPassword && passkeysCount > 0) {
            removeSection.removeAttribute('hidden');
        } else {
            removeSection.setAttribute('hidden', '');
        }
    }

    if (currentGroup) {
        if (hasPassword) {
            currentGroup.removeAttribute('hidden');
        } else {
            currentGroup.setAttribute('hidden', '');
        }
    }
}

/**
 * Toggles the in-page password management drawer.
 *
 * @param {boolean} [forceState] - Explicit open/closed state.
 * @param {boolean} [hasPassword=true] - Whether the account currently has a password configured.
 * @returns {boolean} Current open state.
 */
export function togglePasswordDrawer(forceState, hasPassword = true) {
    const drawer = document.getElementById('account-password-drawer');
    if (!drawer) return false;

    const isOpen = forceState !== undefined ? forceState : drawer.hasAttribute('hidden');

    if (isOpen) {
        drawer.removeAttribute('hidden');
        drawer.setAttribute('aria-expanded', 'true');
        const focusTargetId = hasPassword ? 'account-input-current-password' : 'account-input-new-password';
        const focusInput = /** @type {HTMLInputElement | null} */ (document.getElementById(focusTargetId));
        if (focusInput) {
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() => focusInput.focus());
            } else {
                focusInput.focus();
            }
        }
    } else {
        drawer.setAttribute('hidden', '');
        drawer.setAttribute('aria-expanded', 'false');
    }

    renderPasswordSection(hasPassword, currentPasskeysCount);
    setCurrentPasswordFieldError('');
    return isOpen;
}

/**
 * Updates the visual rule indicators for the password checklist.
 *
 * @param {boolean} isValidLength - Whether length requirement is met.
 * @param {boolean} isMatch - Whether password confirmation matches.
 */
export function updatePasswordRuleIndicators(isValidLength, isMatch) {
    const lengthRule = document.getElementById('rule-length');
    const matchRule = document.getElementById('rule-match');

    if (lengthRule) {
        lengthRule.classList.toggle('is-valid', isValidLength);
    }
    if (matchRule) {
        matchRule.classList.toggle('is-valid', isMatch);
    }
}

/**
 * Sets or clears the field-level error on the current password input.
 *
 * @param {string} text - Error message text. Clears error when falsy.
 */
export function setCurrentPasswordFieldError(text) {
    const errorContainer = document.getElementById('account-error-current-password');
    const errorText = document.getElementById('account-error-current-password-text');
    const input = document.getElementById('account-input-current-password');

    const hasError = Boolean(text);
    if (errorContainer) {
        if (hasError) {
            errorContainer.removeAttribute('hidden');
        } else {
            errorContainer.setAttribute('hidden', '');
        }
    }
    if (errorText) {
        errorText.textContent = text || '';
    }
    if (input) {
        input.classList.toggle('is-invalid', hasError);
    }
}
