/**
 * Pure DOM rendering for Settings Tab Account Card and Header Account Button.
 * Tier 4: UI Renderer.
 */

import { translate } from '../../i18n/translator.js';
import { escapeHTML } from '../../utils/stringUtils.js';

/**
 * Updates a card title element's text content while strictly preserving child elements (such as .card-drag-handle).
 *
 * @param {HTMLElement|null} element
 * @param {string} text
 * @param {string} i18nKey
 */
function updateCardTitlePreservingHandle(element, text, i18nKey) {
    if (!element) return;
    element.setAttribute?.('data-i18n', i18nKey);

    if (element.childNodes && typeof element.childNodes[Symbol.iterator] === 'function') {
        for (const child of element.childNodes) {
            if (child.nodeType === 3) {
                child.textContent = text;
                return;
            }
        }

        if (typeof document !== 'undefined' && typeof document.createTextNode === 'function') {
            const textNode = document.createTextNode(text);
            if (element.firstChild) {
                element.insertBefore(textNode, element.firstChild);
            } else {
                element.appendChild(textNode);
            }
            return;
        }
    }

    element.textContent = text;
}

/**
 * Updates all account identity UI elements across settings and header.
 *
 * @param {{ username: string, avatar?: string }|null} authUser
 */
export function updateAccountUI(authUser) {
    const guestSection = document.getElementById('account-guest-section');
    const authSection = document.getElementById('account-auth-section');
    const accountCardTitle = document.getElementById('account-card-title');
    const profileUsername = document.getElementById('account-profile-username');
    const profileAvatarImg = document.getElementById('account-profile-avatar-img');

    const headerBtn = document.getElementById('header-account-btn');
    const headerIconWrapper = document.getElementById('header-account-icon-wrapper');
    const headerAvatarImg = document.getElementById('header-account-avatar-img');

    const popoverAuthSection = document.getElementById('account-popover-auth-section');
    const popoverGuestSection = document.getElementById('account-popover-guest-section');
    const popoverUsername = document.getElementById('account-popover-username');
    const popoverAvatarImg = document.getElementById('account-popover-avatar-img');

    if (authUser && authUser.username) {
        const safeName = escapeHTML(authUser.username);
        const avatar = authUser.avatar || 'archer';

        // Settings Profile Card
        if (profileUsername) {
            profileUsername.textContent = safeName;
        }
        if (profileAvatarImg) {
            profileAvatarImg.setAttribute('src', `assets/avatars/${avatar}.png`);
        }

        // Popover Profile Card
        if (popoverUsername) {
            popoverUsername.textContent = safeName;
        }
        if (popoverAvatarImg) {
            popoverAvatarImg.setAttribute('src', `assets/avatars/${avatar}.png`);
        }
        popoverGuestSection?.classList.add('is-hidden');
        if (popoverGuestSection) popoverGuestSection.style.display = 'none';
        popoverAuthSection?.classList.remove('is-hidden');
        if (popoverAuthSection) popoverAuthSection.style.display = '';

        // Toggle Account Card Sections
        guestSection?.classList.add('is-hidden');
        if (guestSection) guestSection.style.display = 'none';
        authSection?.classList.remove('is-hidden');
        if (authSection) authSection.style.display = '';

        if (accountCardTitle) {
            updateCardTitlePreservingHandle(accountCardTitle, translate('auth.account'), 'auth.account');
        }

        // Header Button
        headerBtn?.classList.add('is-authenticated');
        if (headerAvatarImg) {
            headerAvatarImg.setAttribute('src', `assets/avatars/${avatar}.png`);
            headerAvatarImg.classList.remove('is-hidden');
        }
        headerIconWrapper?.classList.add('is-hidden');

        // Account Data Modal (Authenticated Mode)
        const accountDataModalTitle = document.getElementById('account-data-modal-title');
        const accountDataSignInTier = document.getElementById('account-data-signin-tier');
        const accountDataDeleteAccountTier = document.getElementById('account-data-delete-account-tier');
        const tierClearCacheLabel = document.getElementById('tier-clear-cache-label');
        const tierClearCacheDesc = document.getElementById('tier-clear-cache-desc');
        const modalClearCacheBtnText = document.getElementById('modal-clear-cache-btn-text');
        const tierResetDataLabel = document.getElementById('tier-reset-data-label');
        const tierResetDataDesc = document.getElementById('tier-reset-data-desc');
        const modalResetDataBtnText = document.getElementById('modal-reset-data-btn-text');

        if (accountDataModalTitle) {
            accountDataModalTitle.setAttribute('data-i18n', 'auth.accountAndDataManagement');
            accountDataModalTitle.textContent = translate('auth.accountAndDataManagement');
        }
        if (accountDataSignInTier) {
            accountDataSignInTier.classList.add('is-hidden');
            accountDataSignInTier.style.display = 'none';
        }
        if (accountDataDeleteAccountTier) {
            accountDataDeleteAccountTier.classList.remove('is-hidden');
            accountDataDeleteAccountTier.style.display = '';
        }
        if (tierClearCacheLabel) {
            tierClearCacheLabel.setAttribute('data-i18n', 'auth.clearDeviceCache');
            tierClearCacheLabel.textContent = translate('auth.clearDeviceCache');
        }
        if (tierClearCacheDesc) {
            tierClearCacheDesc.setAttribute('data-i18n', 'auth.explanations.clearCache');
            tierClearCacheDesc.textContent = translate('auth.explanations.clearCache');
        }
        if (modalClearCacheBtnText) {
            modalClearCacheBtnText.setAttribute('data-i18n', 'auth.clearDeviceCache');
            modalClearCacheBtnText.textContent = translate('auth.clearDeviceCache');
        }
        if (tierResetDataLabel) {
            tierResetDataLabel.setAttribute('data-i18n', 'auth.resetVillageData');
            tierResetDataLabel.textContent = translate('auth.resetVillageData');
        }
        if (tierResetDataDesc) {
            tierResetDataDesc.setAttribute('data-i18n', 'auth.explanations.resetData');
            tierResetDataDesc.textContent = translate('auth.explanations.resetData');
        }
        if (modalResetDataBtnText) {
            modalResetDataBtnText.setAttribute('data-i18n', 'auth.resetVillageData');
            modalResetDataBtnText.textContent = translate('auth.resetVillageData');
        }
    } else {
        // Settings Profile Card
        if (profileUsername) {
            profileUsername.textContent = '';
        }

        // Popover Profile Card
        if (popoverUsername) {
            popoverUsername.textContent = '';
        }
        popoverAuthSection?.classList.add('is-hidden');
        if (popoverAuthSection) popoverAuthSection.style.display = 'none';
        popoverGuestSection?.classList.remove('is-hidden');
        if (popoverGuestSection) popoverGuestSection.style.display = '';

        // Toggle Account Card Sections
        authSection?.classList.add('is-hidden');
        if (authSection) authSection.style.display = 'none';
        guestSection?.classList.remove('is-hidden');
        if (guestSection) guestSection.style.display = '';

        if (accountCardTitle) {
            updateCardTitlePreservingHandle(accountCardTitle, translate('views.settings.cards.accountAndSync'), 'views.settings.cards.accountAndSync');
        }

        // Header Button
        headerBtn?.classList.remove('is-authenticated');
        headerAvatarImg?.classList.add('is-hidden');
        headerIconWrapper?.classList.remove('is-hidden');

        // Account Data Modal (Guest Mode)
        const accountDataModalTitle = document.getElementById('account-data-modal-title');
        const accountDataSignInTier = document.getElementById('account-data-signin-tier');
        const accountDataDeleteAccountTier = document.getElementById('account-data-delete-account-tier');
        const tierClearCacheLabel = document.getElementById('tier-clear-cache-label');
        const tierClearCacheDesc = document.getElementById('tier-clear-cache-desc');
        const modalClearCacheBtnText = document.getElementById('modal-clear-cache-btn-text');
        const tierResetDataLabel = document.getElementById('tier-reset-data-label');
        const tierResetDataDesc = document.getElementById('tier-reset-data-desc');
        const modalResetDataBtnText = document.getElementById('modal-reset-data-btn-text');

        if (accountDataModalTitle) {
            accountDataModalTitle.setAttribute('data-i18n', 'auth.accountAndDataManagement');
            accountDataModalTitle.textContent = translate('auth.accountAndDataManagement');
        }
        if (accountDataSignInTier) {
            accountDataSignInTier.classList.remove('is-hidden');
            accountDataSignInTier.style.display = '';
        }
        if (accountDataDeleteAccountTier) {
            accountDataDeleteAccountTier.classList.add('is-hidden');
            accountDataDeleteAccountTier.style.display = 'none';
        }
        if (tierClearCacheLabel) {
            tierClearCacheLabel.setAttribute('data-i18n', 'auth.clearDeviceCache');
            tierClearCacheLabel.textContent = translate('auth.clearDeviceCache');
        }
        if (tierClearCacheDesc) {
            tierClearCacheDesc.setAttribute('data-i18n', 'auth.explanations.clearCache');
            tierClearCacheDesc.textContent = translate('auth.explanations.clearCache');
        }
        if (modalClearCacheBtnText) {
            modalClearCacheBtnText.setAttribute('data-i18n', 'auth.clearDeviceCache');
            modalClearCacheBtnText.textContent = translate('auth.clearDeviceCache');
        }
        if (tierResetDataLabel) {
            tierResetDataLabel.setAttribute('data-i18n', 'auth.resetVillageData');
            tierResetDataLabel.textContent = translate('auth.resetVillageData');
        }
        if (tierResetDataDesc) {
            tierResetDataDesc.setAttribute('data-i18n', 'auth.explanations.resetData');
            tierResetDataDesc.textContent = translate('auth.explanations.resetData');
        }
        if (modalResetDataBtnText) {
            modalResetDataBtnText.setAttribute('data-i18n', 'auth.resetVillageData');
            modalResetDataBtnText.textContent = translate('auth.resetVillageData');
        }
    }
}

/**
 * Highlights the active avatar button in the avatar selection modal.
 *
 * @param {string} activeAvatar
 */
export function highlightActiveAvatar(activeAvatar) {
    const options = document.querySelectorAll('.avatar-option-btn');
    options.forEach(opt => {
        const avatar = opt.getAttribute('data-avatar');
        const isMatch = avatar === activeAvatar;
        opt.classList.toggle('is-selected', isMatch);
        if (typeof opt.setAttribute === 'function' && typeof opt.removeAttribute === 'function') {
            if (isMatch) {
                opt.setAttribute('data-modal-autofocus', 'true');
            } else {
                opt.removeAttribute('data-modal-autofocus');
            }
        }
    });
}
