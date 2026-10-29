/**
 * Pure DOM rendering for Account Page shells and user profile identity.
 * Tier 4: UI Renderer (Pure DOM generation, zero direct event listeners).
 */

import { getLanguageFromPath } from '../../core/languageRouter.js';
import { getSavedProfiles } from '../../core/playerStorage.js';
import { state } from '../../core/state.js';
import { translate } from '../../i18n/translator.js';
import { fetchPasskeys } from '../../services/authPasskeyClientService.js';
import { formatDate, getDefaultDateLocale } from '../../utils/dateUtils.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { renderPasswordSection, togglePasswordDrawer } from './accountPagePasswordDisplay.js';
import {
    renderAccountGuestPairingCard,
    setGuestPairingActiveTab,
    toggleGuestPairingDrawer,
    togglePairingDrawer
} from './accountPageSessionsDisplay.js';

/**
 * Toggles the visibility and expanded state of the in-page avatar selector tray.
 *
 * @param {boolean} [forceState] - Explicit open/closed state.
 * @returns {boolean} Current open state after toggle.
 */
export function toggleAvatarTray(forceState) {
    const tray = document.getElementById('account-avatar-tray');
    if (!tray) return false;

    const isOpen = forceState !== undefined ? forceState : tray.hasAttribute('hidden');
    if (isOpen) {
        tray.removeAttribute('hidden');
        tray.setAttribute('aria-expanded', 'true');
    } else {
        tray.setAttribute('hidden', '');
        tray.setAttribute('aria-expanded', 'false');
    }

    const avatarBtn = document.getElementById('account-profile-avatar-btn');
    if (avatarBtn) {
        avatarBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        const iconSvg = avatarBtn.querySelector('clashcalc-assets-svg, orecalc-assets-svg');
        if (iconSvg) {
            iconSvg.setAttribute('name', isOpen ? 'check' : 'edit');
        }
    }

    return isOpen;
}

/**
 * Highlights the actively selected avatar button inside the avatar tray.
 *
 * @param {string} avatar - Active avatar identifier ('archer', 'builder', etc.).
 */
export function highlightActiveAvatarInTray(avatar) {
    const tray = document.getElementById('account-avatar-tray');
    if (!tray) return;

    const btns = tray.querySelectorAll('.avatar-option-btn');
    btns.forEach((btn) => {
        const isMatch = btn.getAttribute('data-avatar') === avatar;
        btn.classList.toggle('is-selected', isMatch);
        btn.setAttribute('aria-selected', isMatch ? 'true' : 'false');
    });

    const profileImg = document.getElementById('account-profile-avatar-img');
    if (profileImg) {
        profileImg.setAttribute('src', `/assets/avatars/${avatar}.png`);
    }
}

/**
 * Renders the inline list of registered passkey credentials.
 *
 * @param {Array<{ credentialID: string, deviceName: string, createdAt: number }>} passkeys
 */
export function renderPasskeysInlineList(passkeys) {
    const listEl = document.getElementById('account-passkeys-items-list');
    const emptyEl = document.getElementById('account-passkeys-empty');
    if (!listEl || !emptyEl) return;

    const safePasskeys = Array.isArray(passkeys) ? passkeys : [];

    if (safePasskeys.length === 0) {
        listEl.innerHTML = '';
        emptyEl.classList.remove('is-hidden');
        return;
    }

    emptyEl.classList.add('is-hidden');
    const currentLang = getLanguageFromPath() || state.uiSettings?.language || getDefaultDateLocale() || 'en';
    const deleteLabel = escapeHTML(translate('auth.deletePasskey'));

    listEl.innerHTML = safePasskeys.map((pk) => {
        let dateStr = '';
        if (pk.createdAt) {
            const formatted = formatDate(new Date(pk.createdAt), { month: 'short', day: 'numeric', year: 'numeric' }, currentLang);
            dateStr = translate('auth.addedDate', { date: formatted });
        }

        const defaultName = translate('auth.defaultPasskeyName') || 'Passkey';
        const safeName = escapeHTML(pk.deviceName || defaultName);
        const safeId = escapeHTML(pk.credentialID);

        return `
            <div class="account-passkey-item" data-credential-id="${safeId}">
                <div class="account-passkey-item__info">
                    <span class="account-passkey-item__name">${safeName}</span>
                    <span class="account-passkey-item__date">${escapeHTML(dateStr)}</span>
                </div>
                <button type="button" class="account-passkey-item__delete-btn" data-credential-id="${safeId}" aria-label="${deleteLabel}" title="${deleteLabel}">
                    <clashcalc-assets-svg name="trash" width="16" height="16"></clashcalc-assets-svg>
                </button>
            </div>
        `;
    }).join('');
}

/**
 * Toggles the Step-Up Account Deletion panel.
 *
 * @param {boolean} [forceState] - Explicit open/closed state.
 * @param {string} [username=''] - Authenticated username required for confirmation.
 */
export function toggleDeleteStepUp(forceState, username = '') {
    const panel = document.getElementById('account-delete-stepup-panel');
    const descEl = document.getElementById('account-delete-stepup-desc');
    const input = /** @type {HTMLInputElement | null} */ (document.getElementById('account-delete-confirm-input'));
    const executeBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('account-delete-execute-btn'));

    if (!panel) return;

    const isOpen = forceState !== undefined ? forceState : panel.hasAttribute('hidden');
    if (isOpen) {
        panel.removeAttribute('hidden');
        if (descEl && username) {
            descEl.textContent = translate('views.account.deleteStepUpHint', { username });
        }
        if (input) {
            input.value = '';
            input.placeholder = username;
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() => input.focus());
            } else {
                input.focus();
            }
        }
        if (executeBtn) {
            executeBtn.disabled = true;
        }
    } else {
        panel.setAttribute('hidden', '');
        if (input) input.value = '';
        if (executeBtn) executeBtn.disabled = true;
    }
}

/**
 * Renders the connected villages summary (overlapping top 5 TH avatar stack + count badge).
 *
 * @param {Array<{ townHallLevel?: number|string, [key: string]: any }>|null} [customProfiles=null] - Optional injected profiles for testing or manual overrides.
 */
export function renderAccountVillagesSummary(customProfiles = null) {
    const stackEl = document.getElementById('account-village-stack');
    const badgeEl = document.getElementById('account-village-count-badge');
    if (!badgeEl) return;

    const profiles = Array.isArray(customProfiles) ? customProfiles : getSavedProfiles();
    const count = Array.isArray(profiles) ? profiles.length : 0;

    badgeEl.textContent = translate('auth.villagesConnected', { count });

    if (!stackEl) return;
    stackEl.innerHTML = '';

    if (count > 0) {
        // Sort descending by townHallLevel (highest level first) and cap at top 5
        const sorted = [...profiles].sort((a, b) => (Number(b.townHallLevel) || 18) - (Number(a.townHallLevel) || 18));
        const topFive = sorted.slice(0, 5);

        stackEl.innerHTML = topFive.map((p) => {
            const th = Math.max(1, Math.min(18, Number(p.townHallLevel) || 18));
            return `<clashcalc-assets-image src="/assets/th/th${th}.png" alt="TH${th}" class="account-village-stack-th" size="thumbnail"></clashcalc-assets-image>`;
        }).join('');
    }
}

/**
 * Determines whether a valid, non-default player profile exists on this device.
 * Checks both partitioned storage (getSavedProfiles) and in-memory state.
 *
 * @returns {boolean}
 */
export function hasRealPlayerProfile() {
    const profiles = getSavedProfiles();
    if (Array.isArray(profiles) && profiles.length > 0) return true;
    return Boolean(state.savedPlayerTags && state.savedPlayerTags.some(t => t && t !== 'DEFAULT0'));
}

/**
 * Renders the reactive view shell for the Account page based on authentication state.
 *
 * @param {boolean} isAuthenticated - Whether a valid cloud user session exists.
 * @param {{ username: string, avatar?: string, hasPassword?: boolean } | null} [user=null] - Authenticated user details.
 */
export function renderAccountPageShell(isAuthenticated, user = null) {
    const guestView = document.getElementById('account-guest-view');
    const authView = document.getElementById('account-auth-view');

    if (!guestView || !authView) return;

    if (isAuthenticated && user && user.username) {
        guestView.setAttribute('hidden', '');
        authView.removeAttribute('hidden');

        const usernameEl = document.getElementById('account-profile-username');
        if (usernameEl) {
            usernameEl.textContent = escapeHTML(user.username);
        }

        const avatar = user.avatar || 'archer';
        const avatarImg = document.getElementById('account-profile-avatar-img');
        if (avatarImg) {
            avatarImg.setAttribute('src', `/assets/avatars/${avatar}.png`);
        }
        highlightActiveAvatarInTray(avatar);
        renderAccountVillagesSummary();
        renderAccountErasureCard(true);

        const pairingDrawer = document.getElementById('account-pairing-drawer');
        const isPairingOpen = Boolean(pairingDrawer && !pairingDrawer.hasAttribute('hidden'));
        togglePairingDrawer(isPairingOpen);

        fetchPasskeys().then((passkeys) => {
            const count = Array.isArray(passkeys) ? passkeys.length : 0;
            renderPasskeysInlineList(passkeys);
            renderPasswordSection(user.hasPassword !== false, count);
        }).catch(() => {
            renderPasskeysInlineList([]);
            renderPasswordSection(user.hasPassword !== false, 0);
        });
    } else {
        const isAlreadyGuest = !guestView.hasAttribute('hidden');
        const guestPairingDrawer = document.getElementById('account-guest-pairing-drawer');
        const isGuestPairingOpen = isAlreadyGuest && Boolean(guestPairingDrawer && !guestPairingDrawer.hasAttribute('hidden'));

        authView.setAttribute('hidden', '');
        guestView.removeAttribute('hidden');
        const hasRealPlayer = hasRealPlayerProfile();
        renderAccountGuestPairingCard(hasRealPlayer);
        renderAccountErasureCard(false);

        if (!isAlreadyGuest) {
            toggleAvatarTray(false);
            togglePasswordDrawer(false);
            togglePairingDrawer(false);
            toggleGuestPairingDrawer(false);
            setGuestPairingActiveTab('qr');
            toggleDeleteStepUp(false);
        } else {
            toggleGuestPairingDrawer(isGuestPairingOpen);
        }
    }
}

/**
 * Resolves the dynamic description and confirmation message for village data reset.
 *
 * @param {boolean} isAuthed - Whether the active session is authenticated.
 * @param {boolean} hasRealPlayer - Whether a real player tag is saved/connected.
 * @returns {{ description: string, confirmMessage: string }}
 */
export function getResetVillageDataCopy(isAuthed, hasRealPlayer) {
    const action = hasRealPlayer
        ? translate('auth.explanations.resetTracked')
        : translate('auth.explanations.resetDefaults');

    let scope = '';
    if (isAuthed) {
        scope = translate('auth.explanations.resetAuthSafe');
    } else if (hasRealPlayer) {
        scope = translate('auth.explanations.resetCloudDelete');
    }

    const description = scope ? `${action} ${scope}` : action;
    const confirmPrompt = translate('confirms.resetVillageData');
    const confirmMessage = `<p>${confirmPrompt}</p><p class="account-confirm-detail">${description}</p>`;

    return { description, confirmMessage };
}

/**
 * Renders the state-aware erasure card description based on authentication and player tags.
 *
 * @param {boolean} isAuthed - Whether the active session is authenticated.
 * @param {boolean|null} [hasRealPlayerOverride=null] - Optional override for testing or manual injection.
 */
export function renderAccountErasureCard(isAuthed, hasRealPlayerOverride = null) {
    const hasRealPlayer = typeof hasRealPlayerOverride === 'boolean'
        ? hasRealPlayerOverride
        : hasRealPlayerProfile();

    const { description } = getResetVillageDataCopy(isAuthed, hasRealPlayer);

    const descEl = isAuthed
        ? document.getElementById('account-auth-reset-data-desc')
        : document.getElementById('account-guest-reset-data-desc');

    if (descEl) {
        descEl.textContent = description;
    }
}
