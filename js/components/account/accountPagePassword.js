/**
 * Controller for in-page Password Management (setup, change, policy verification).
 * Tier 4: Interactive Controller (DOM event listeners and API service dispatch).
 */

import { getAuthenticatedUser, setPassword, changePassword, removePassword } from '../../services/authClientService.js';
import { translate } from '../../i18n/translator.js';
import { showConfirm } from '../../ui/noticeModal.js';
import { showToast } from '../../ui/toast.js';
import { logger } from '../../utils/logger.js';
import { togglePasswordVisibility } from '../auth/authModalDisplay.js';
import {
    renderPasswordSection,
    togglePasswordDrawer,
    updatePasswordRuleIndicators,
    setCurrentPasswordFieldError
} from './accountPagePasswordDisplay.js';

let isSubmitting = false;

/**
 * Validates the password inputs and updates live rule checklist state.
 */
function handlePasswordInputValidation() {
    const user = getAuthenticatedUser();
    const hasPassword = user?.hasPassword !== false;

    const currentInput = /** @type {HTMLInputElement | null} */ (document.getElementById('account-input-current-password'));
    const newInput = /** @type {HTMLInputElement | null} */ (document.getElementById('account-input-new-password'));
    const confirmInput = /** @type {HTMLInputElement | null} */ (document.getElementById('account-input-confirm-password'));
    const submitBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('account-btn-submit-password'));

    const currentVal = currentInput?.value || '';
    const newVal = newInput?.value || '';
    const confirmVal = confirmInput?.value || '';

    const isValidLength = newVal.length >= 6 && newVal.length <= 72;
    const isMatch = newVal.length > 0 && newVal === confirmVal;
    const isCurrentValid = !hasPassword || currentVal.length > 0;

    updatePasswordRuleIndicators(isValidLength, isMatch);

    if (submitBtn) {
        submitBtn.disabled = !isValidLength || !isMatch || !isCurrentValid || isSubmitting;
    }
}

/**
 * Resets all password input fields, rule indicators, and status messages.
 */
function resetPasswordForm() {
    const currentInput = /** @type {HTMLInputElement | null} */ (document.getElementById('account-input-current-password'));
    const newInput = /** @type {HTMLInputElement | null} */ (document.getElementById('account-input-new-password'));
    const confirmInput = /** @type {HTMLInputElement | null} */ (document.getElementById('account-input-confirm-password'));
    const submitBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('account-btn-submit-password'));

    if (currentInput) {
        currentInput.value = '';
        currentInput.type = 'password';
    }
    if (newInput) {
        newInput.value = '';
        newInput.type = 'password';
    }
    if (confirmInput) {
        confirmInput.value = '';
        confirmInput.type = 'password';
    }

    const drawer = document.getElementById('account-password-drawer');
    drawer?.querySelectorAll('.password-toggle-btn').forEach(btn => {
        const onIcon = btn.querySelector('.icon-vis-on');
        const offIcon = btn.querySelector('.icon-vis-off');
        if (onIcon && offIcon) {
            onIcon.classList.remove('is-hidden');
            offIcon.classList.add('is-hidden');
        }
    });

    updatePasswordRuleIndicators(false, false);
    if (submitBtn) submitBtn.disabled = true;
    setCurrentPasswordFieldError('');
}

/**
 * Handles password form submission (either set initial password or change existing password).
 *
 * @param {SubmitEvent} e - Form submit event.
 */
async function handlePasswordFormSubmit(e) {
    e.preventDefault();
    if (isSubmitting) return;

    const user = getAuthenticatedUser();
    const hasPassword = user?.hasPassword !== false;

    const currentInput = /** @type {HTMLInputElement | null} */ (document.getElementById('account-input-current-password'));
    const newInput = /** @type {HTMLInputElement | null} */ (document.getElementById('account-input-new-password'));
    const confirmInput = /** @type {HTMLInputElement | null} */ (document.getElementById('account-input-confirm-password'));
    const submitBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('account-btn-submit-password'));

    const currentVal = currentInput?.value || '';
    const newVal = newInput?.value || '';
    const confirmVal = confirmInput?.value || '';

    if (newVal.length < 6 || newVal.length > 72) {
        showToast(translate('apiErrors.invalidPassword') || 'Password must be at least 6 characters long.', 'error');
        return;
    }

    if (newVal !== confirmVal) {
        showToast(translate('apiErrors.passwordMismatch') || 'Passwords do not match.', 'error');
        return;
    }

    if (hasPassword && !currentVal) {
        showToast(translate('apiErrors.invalidCurrentPassword') || 'Current password is required.', 'error');
        return;
    }

    if (hasPassword && currentVal === newVal) {
        showToast(translate('apiErrors.samePassword') || 'New password must be different from current password.', 'error');
        return;
    }

    isSubmitting = true;
    if (submitBtn) submitBtn.disabled = true;

    try {
        if (hasPassword) {
            await changePassword(currentVal, newVal);
        } else {
            await setPassword(newVal);
            renderPasswordSection(true);
        }

        resetPasswordForm();
        const updatedUser = getAuthenticatedUser();
        togglePasswordDrawer(false, updatedUser?.hasPassword !== false);
        showToast(translate(hasPassword ? 'auth.passwordUpdated' : 'auth.passwordSetSuccess'), 'success');
    } catch (err) {
        logger.error('[Account] Password operation failed:', err);
        const errorKey = err.message || '';
        const localizedMsg = translate(`apiErrors.${errorKey}`) || err.message || translate('apiErrors.default', { status: 'Error' });
        if (errorKey === 'invalidCurrentPassword' || errorKey === 'invalidCredentials' || /current password/i.test(localizedMsg)) {
            setCurrentPasswordFieldError(localizedMsg);
            const currentInputEl = /** @type {HTMLInputElement | null} */ (document.getElementById('account-input-current-password'));
            currentInputEl?.focus();
        }
        showToast(localizedMsg, 'error');
        if (submitBtn) submitBtn.disabled = false;
    } finally {
        isSubmitting = false;
    }
}

/**
 * Handles removing the password to transition to passkey-only mode.
 */
async function handleRemovePassword() {
    const confirmed = await showConfirm(translate('auth.confirmRemovePassword'));
    if (!confirmed) return;

    try {
        await removePassword();
        togglePasswordDrawer(false, false);
        showToast(translate('auth.passwordRemovedSuccess'), 'success');
    } catch (err) {
        logger.error('[Password] Remove password failed:', err);
        showToast(translate('apiErrors.default') || 'Failed to remove password.', 'error');
    }
}

/**
 * Initializes all event bindings for the in-page password management module.
 */
export function initAccountPasswordModule() {
    const removeBtn = document.getElementById('account-btn-remove-password');
    removeBtn?.addEventListener('click', handleRemovePassword);

    const toggleBtn = document.getElementById('account-btn-toggle-password-drawer');
    toggleBtn?.addEventListener('click', () => {
        const user = getAuthenticatedUser();
        const hasPassword = user?.hasPassword !== false;
        const drawer = document.getElementById('account-password-drawer');
        const isCurrentlyHidden = drawer?.hasAttribute('hidden') ?? true;

        if (isCurrentlyHidden) {
            resetPasswordForm();
            togglePasswordDrawer(true, hasPassword);
        } else {
            togglePasswordDrawer(false, hasPassword);
        }
    });

    const cancelBtn = document.getElementById('account-btn-cancel-password');
    cancelBtn?.addEventListener('click', () => {
        const user = getAuthenticatedUser();
        resetPasswordForm();
        togglePasswordDrawer(false, user?.hasPassword !== false);
    });

    const form = document.getElementById('account-password-form');
    form?.addEventListener('submit', handlePasswordFormSubmit);

    const currentInput = document.getElementById('account-input-current-password');
    currentInput?.addEventListener('input', () => {
        if (currentInput.classList.contains('is-invalid')) {
            setCurrentPasswordFieldError('');
        }
        handlePasswordInputValidation();
    });

    const newInput = document.getElementById('account-input-new-password');
    newInput?.addEventListener('input', handlePasswordInputValidation);

    const confirmInput = document.getElementById('account-input-confirm-password');
    confirmInput?.addEventListener('input', handlePasswordInputValidation);

    const drawer = document.getElementById('account-password-drawer');
    drawer?.querySelectorAll('.password-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.parentElement?.querySelector('input');
            if (input) {
                togglePasswordVisibility(input, /** @type {HTMLElement} */ (btn));
            }
        });
    });
}
