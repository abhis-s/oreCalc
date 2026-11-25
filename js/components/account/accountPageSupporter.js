/**
 * Interaction bindings and redemption verification for ClashCalc Supporter operations.
 * Tier 4: Interaction Engine.
 */

import { translate } from '../../i18n/translator.js';
import { showToast } from '../../ui/toast.js';
import { getAuthenticatedUser, redeemSupporterCode } from '../../services/authClientService.js';
import { resolveErrorMessage } from '../auth/authModalInputs.js';
import { hideCardHelpPopover } from '../../utils/cardHelpPopover.js';
import {
    getAvatarMilestoneContext,
    renderAvatarLockStates
} from './accountPageAvatarDisplay.js';
import {
    renderSupporterFeedback,
    renderSupporterStatus
} from './accountPageDisplay.js';

let isSupporterSubmitting = false;

/**
 * Initializes form submission and input validation handlers for ClashCalc Supporter redemption.
 */
export function initAccountSupporterModule() {
    const supporterForm = document.getElementById('account-supporter-code-form');
    const codeInput = /** @type {HTMLInputElement | null} */ (document.getElementById('account-supporter-code-input'));

    if (codeInput && !codeInput.dataset?.supporterInputBound) {
        if (codeInput.dataset) codeInput.dataset.supporterInputBound = 'true';
        codeInput.addEventListener('input', () => {
            if (codeInput.classList?.contains('is-invalid')) {
                renderSupporterFeedback('hidden');
            }
        });
    }

    if (!supporterForm || supporterForm.dataset?.supporterFormBound) return;
    if (supporterForm.dataset) supporterForm.dataset.supporterFormBound = 'true';

    supporterForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isSupporterSubmitting) return;

        const inputEl = /** @type {HTMLInputElement | null} */ (document.getElementById('account-supporter-code-input'));
        const submitBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('account-btn-redeem-code'));
        if (!inputEl) return;

        const code = inputEl.value.trim().toUpperCase();
        if (!code) {
            renderSupporterFeedback('error', translate('auth.supporter.emptyCode'));
            inputEl.focus();
            return;
        }

        isSupporterSubmitting = true;
        const originalLabel = submitBtn?.textContent || translate('actions.redeem');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = translate('actions.processing');
        }
        renderSupporterFeedback('hidden');

        let redeemed = false;
        try {
            await redeemSupporterCode(code);
            redeemed = true;
        } catch (err) {
            renderSupporterFeedback('error', resolveErrorMessage(err) || translate('apiErrors.invalidSupporterCode'));
        } finally {
            isSupporterSubmitting = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalLabel;
            }
        }

        if (!redeemed) return;

        renderSupporterStatus(true);
        const user = getAuthenticatedUser();
        const ctx = getAvatarMilestoneContext(user);
        ctx.isSupporter = true;
        renderAvatarLockStates(ctx);
        hideCardHelpPopover();
        showToast(translate('auth.supporter.redeemedSuccess'), 'success');
    });
}
