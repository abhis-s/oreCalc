/**
 * Pure DOM rendering for Account Page shells and user profile identity.
 * Tier 4: UI Renderer (Pure DOM generation, zero direct event listeners).
 */

import { MAX_TOWN_HALL } from '../../core/constants.js';
import { getLanguageFromPath } from '../../core/languageRouter.js';
import { getSavedProfiles } from '../../core/playerStorage.js';
import { state } from '../../core/state.js';
import { getTownHallIconUrl } from '../../domain/townHall/townHallSchedule.js';
import { translate } from '../../i18n/translator.js';
import { fetchPasskeys } from '../../services/authPasskeyClientService.js';
import { formatDate, getDefaultDateLocale } from '../../utils/dateUtils.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { getAvatarSrc, stopAvatarAnimation, syncSupporterIconState } from '../../utils/avatarUtils.js';
import { hideCardHelpPopover } from '../../utils/cardHelpPopover.js';
import {
    getAvatarMilestoneContext,
    highlightActiveAvatarInTray,
    renderAvatarLockStates,
    resetAvatarMilestoneCache,
    toggleAvatarTray
} from './accountPageAvatarDisplay.js';
import { renderPasswordSection, togglePasswordDrawer } from './accountPagePasswordDisplay.js';
import {
    renderAccountGuestPairingCard,
    setGuestPairingActiveTab,
    toggleGuestPairingDrawer,
    togglePairingDrawer
} from './accountPageSessionsDisplay.js';

/**
 * Renders inline supporter feedback and input error state in the compact supporter drawer.
 *
 * @param {'hidden' | 'error' | 'success'} mode - Display mode for feedback message.
 * @param {string} [message=''] - Feedback message text to show.
 */
export function renderSupporterFeedback(mode, message = '') {
    const codeInput = /** @type {HTMLInputElement | null} */ (document.getElementById('account-supporter-code-input'));
    const feedbackEl = document.getElementById('account-supporter-code-feedback');
    const feedbackText = document.getElementById('account-supporter-code-feedback-text');

    codeInput?.classList?.toggle('is-invalid', mode === 'error');
    if (!feedbackEl) return;

    if (mode === 'hidden') {
        feedbackEl.setAttribute('hidden', '');
        if (feedbackText) feedbackText.textContent = '';
        return;
    }

    feedbackEl.removeAttribute('hidden');
    if (feedbackText) feedbackText.textContent = message;
}

/**
 * Resets supporter code input value and hides inline feedback.
 */
function resetSupporterFormState() {
    const codeInput = /** @type {HTMLInputElement | null} */ (document.getElementById('account-supporter-code-input'));
    if (codeInput) {
        codeInput.value = '';
    }
    renderSupporterFeedback('hidden');
}

/**
 * Toggles visibility of the supporter code input drawer inside #account-supporter-panel.
 *
 * @param {boolean} [forceState] - Explicit open/closed state.
 * @returns {boolean} Current open state after toggle.
 */
export function toggleSupporterCodeDrawer(forceState) {
    const drawer = document.getElementById('account-supporter-code-drawer');
    const toggleBtn = document.getElementById('account-btn-toggle-supporter-code');
    if (!drawer) return false;

    const isOpen = forceState !== undefined ? forceState : drawer.hasAttribute('hidden');
    if (isOpen) {
        drawer.removeAttribute('hidden');
    } else {
        drawer.setAttribute('hidden', '');
        resetSupporterFormState();
    }

    if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        const labelKey = isOpen ? 'actions.close' : 'auth.supporter.redeemBtn';
        toggleBtn.textContent = translate(labelKey);
        toggleBtn.setAttribute('data-i18n', labelKey);
    }

    return isOpen;
}

/**
 * Toggles visibility of the collapsible #account-supporter-panel inside #account-profile-card.
 *
 * @param {boolean} [forceState] - Explicit open/closed state.
 * @returns {boolean} Current open state after toggle.
 */
export function toggleSupporterPanel(forceState) {
    const panel = document.getElementById('account-supporter-panel');
    if (!panel) return false;

    const isOpen = forceState !== undefined ? forceState : panel.hasAttribute('hidden');
    if (isOpen) {
        panel.removeAttribute('hidden');
    } else {
        panel.setAttribute('hidden', '');
        toggleSupporterCodeDrawer(false);
    }

    document.getElementById('account-profile-supporter-btn')?.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    return isOpen;
}

/**
 * Renders supporter badge state and updates the profile supporter panel content.
 *
 * @param {boolean} isSupporter - Whether the active user is a verified supporter.
 */
export function renderSupporterStatus(isSupporter) {
    const active = Boolean(isSupporter);

    syncSupporterIconState(
        document.getElementById('account-profile-supporter-btn'),
        active ? 'supporter' : 'standard',
        translate(active ? 'auth.supporter.statusActive' : 'auth.supporter.statusInactive')
    );

    const panel = document.getElementById('account-supporter-panel');
    panel?.classList?.toggle('is-supporter', active);

    const panelIcon = document.getElementById('account-supporter-panel-icon');
    panelIcon?.setAttribute('name', active ? 'premium' : 'bmc');

    const panelTitle = document.getElementById('account-supporter-panel-title');
    if (panelTitle) {
        const titleKey = active ? 'auth.supporter.activeTitle' : 'auth.supporter.title';
        panelTitle.textContent = translate(titleKey);
        panelTitle.setAttribute('data-i18n', titleKey);
    }

    const panelDesc = document.getElementById('account-supporter-panel-desc');
    if (panelDesc) {
        const descKey = active ? 'auth.supporter.activeDesc' : 'auth.supporter.description';
        panelDesc.textContent = translate(descKey);
        panelDesc.setAttribute('data-i18n', descKey);
    }

    const redeemToggleBtn = document.getElementById('account-btn-toggle-supporter-code');
    if (redeemToggleBtn) {
        if (active) {
            redeemToggleBtn.setAttribute('hidden', '');
        } else {
            redeemToggleBtn.removeAttribute('hidden');
        }
    }

    if (active) {
        toggleSupporterCodeDrawer(false);
        resetSupporterFormState();
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
        const sorted = [...profiles].sort((a, b) => (Number(b.townHallLevel) || MAX_TOWN_HALL) - (Number(a.townHallLevel) || MAX_TOWN_HALL));
        const topFive = sorted.slice(0, 5);

        stackEl.innerHTML = topFive.map((p) => {
            const th = Math.max(1, Math.min(MAX_TOWN_HALL, Number(p.townHallLevel) || MAX_TOWN_HALL));
            return `<clashcalc-assets-image src="${getTownHallIconUrl(th, { rootRelative: true })}" alt="TH${th}" class="account-village-stack-th" size="thumbnail"></clashcalc-assets-image>`;
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
 * @param {{ username: string, avatar?: string, hasPassword?: boolean, isSupporter?: boolean } | null} [user=null] - Authenticated user details.
 * @param {{ skipPasskeysFetch?: boolean }} [options={}] - Optional render flags to avoid redundant network fetches on lightweight profile updates.
 */
export function renderAccountPageShell(isAuthenticated, user = null, { skipPasskeysFetch = false } = {}) {
    const guestView = document.getElementById('account-guest-view');
    const authView = document.getElementById('account-auth-view');

    if (!guestView || !authView) return;

    if (isAuthenticated && user && user.username) {
        guestView.setAttribute('hidden', '');
        authView.removeAttribute('hidden');

        const usernameEl = document.getElementById('account-profile-username');
        const prevUsername = usernameEl?.getAttribute('data-active-username');
        if (prevUsername && prevUsername !== user.username) {
            resetAvatarMilestoneCache();
            toggleSupporterPanel(false);
            resetSupporterFormState();
        }
        if (usernameEl) {
            usernameEl.textContent = escapeHTML(user.username);
            usernameEl.setAttribute('data-active-username', user.username);
        }

        const avatar = user.avatar || 'archer';
        const avatarImg = document.getElementById('account-profile-avatar-img');
        if (avatarImg) {
            const prevAvatar = avatarImg.getAttribute('data-active-avatar');
            if (prevAvatar && prevAvatar !== avatar) {
                stopAvatarAnimation(avatarImg, avatar, '200');
            } else if (!/** @type {any} */ (avatarImg)._avatarAnimTimer && !/** @type {any} */ (avatarImg)._avatarAnimPending) {
                avatarImg.setAttribute('src', getAvatarSrc(avatar, { animated: false, size: '200' }));
            }
            avatarImg.setAttribute('data-active-avatar', avatar);
        }
        highlightActiveAvatarInTray(avatar);
        renderAvatarLockStates(getAvatarMilestoneContext(user));
        renderSupporterStatus(Boolean(user.isSupporter));
        renderAccountVillagesSummary();
        renderAccountErasureCard(true);

        const pairingDrawer = document.getElementById('account-pairing-drawer');
        const isPairingOpen = Boolean(pairingDrawer && !pairingDrawer.hasAttribute('hidden'));
        togglePairingDrawer(isPairingOpen);

        if (!skipPasskeysFetch) {
            fetchPasskeys().then((passkeys) => {
                const count = Array.isArray(passkeys) ? passkeys.length : 0;
                renderPasskeysInlineList(passkeys);
                renderPasswordSection(user.hasPassword !== false, count);
                renderAvatarLockStates(getAvatarMilestoneContext(user, passkeys));
            }).catch(() => {
                resetAvatarMilestoneCache();
                renderPasskeysInlineList([]);
                renderPasswordSection(user.hasPassword !== false, 0);
                renderAvatarLockStates(getAvatarMilestoneContext(user, []));
            });
        }
    } else {
        resetAvatarMilestoneCache();
        stopAvatarAnimation(document.getElementById('account-profile-avatar-img'), 'archer', '200');
        document.getElementById('account-profile-avatar-img')?.removeAttribute('data-active-avatar');
        hideCardHelpPopover();
        toggleSupporterPanel(false);
        renderSupporterStatus(false);
        syncSupporterIconState(document.getElementById('account-profile-supporter-btn'), 'hidden');
        resetSupporterFormState();
        document.getElementById('account-profile-username')?.removeAttribute('data-active-username');
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
