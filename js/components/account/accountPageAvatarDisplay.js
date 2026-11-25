/**
 * Pure DOM rendering for Account Page avatar tray and milestone lock badges.
 * Tier 4: Account Sub-Panel Display Module.
 */

import { getSavedProfiles } from '../../core/playerStorage.js';
import { state } from '../../core/state.js';
import { translate } from '../../i18n/translator.js';
import { getAuthenticatedUser } from '../../services/authClientService.js';
import { isEmoteAvatar, isBonusAvatar, getAvatarSrc, getAvatarLockStatus, stopAvatarAnimation } from '../../utils/avatarUtils.js';
import { showCardHelpPopover } from '../../utils/cardHelpPopover.js';
import { escapeHTML } from '../../utils/stringUtils.js';

let cachedPasskeysCount = 0;

/**
 * Resets cached passkey milestone count on logout or account switch.
 */
export function resetAvatarMilestoneCache() {
    cachedPasskeysCount = 0;
}

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
        const overlayIcon = avatarBtn.querySelector('.account-profile-avatar-overlay clashcalc-assets-svg, .account-profile-avatar-overlay orecalc-assets-svg')
            || avatarBtn.querySelector('clashcalc-assets-svg, orecalc-assets-svg');
        if (overlayIcon) {
            overlayIcon.setAttribute('name', isOpen ? 'check' : 'edit');
        }
        const badgeIcon = avatarBtn.querySelector('.account-profile-avatar-badge clashcalc-assets-svg, .account-profile-avatar-badge orecalc-assets-svg');
        if (badgeIcon && badgeIcon !== overlayIcon) {
            badgeIcon.setAttribute('name', isOpen ? 'check-simple' : 'edit');
        }
    }

    return isOpen;
}

/**
 * Switches the active tab panel in the avatar selector tray.
 *
 * @param {'classic' | 'animated' | string} targetTab - Selected tab category.
 */
export function switchAvatarTrayTab(targetTab) {
    const isAnimated = targetTab === 'animated';
    const tabClassic = document.getElementById('account-avatar-tab-classic');
    const tabAnimated = document.getElementById('account-avatar-tab-animated');
    const gridClassic = document.getElementById('account-avatar-grid-classic');
    const gridAnimated = document.getElementById('account-avatar-grid-animated');

    if (tabClassic && tabAnimated) {
        tabClassic.classList.toggle('is-active', !isAnimated);
        tabClassic.setAttribute('aria-selected', !isAnimated ? 'true' : 'false');
        tabAnimated.classList.toggle('is-active', isAnimated);
        tabAnimated.setAttribute('aria-selected', isAnimated ? 'true' : 'false');
    }

    if (gridClassic && gridAnimated) {
        if (isAnimated) {
            gridClassic.classList.add('is-hidden');
            gridClassic.setAttribute('hidden', '');
            gridAnimated.classList.remove('is-hidden');
            gridAnimated.removeAttribute('hidden');
        } else {
            gridAnimated.classList.add('is-hidden');
            gridAnimated.setAttribute('hidden', '');
            gridClassic.classList.remove('is-hidden');
            gridClassic.removeAttribute('hidden');
        }
    }
}

/**
 * Highlights the actively selected avatar button inside the avatar tray.
 *
 * @param {string} avatar - Active avatar identifier ('archer', 'barbarian_laugh', etc.).
 * @param {{ syncTab?: boolean }} [options={}] - Whether to sync the visible tray tab to match the avatar category.
 */
export function highlightActiveAvatarInTray(avatar, { syncTab = false } = {}) {
    const tray = document.getElementById('account-avatar-tray');
    if (!tray) return;

    const safeAvatar = avatar || 'archer';
    const isTrayClosed = tray.hasAttribute('hidden');
    if (syncTab || isTrayClosed) {
        const activeTab = isEmoteAvatar(safeAvatar) ? 'animated' : 'classic';
        switchAvatarTrayTab(activeTab);
    }

    const btns = tray.querySelectorAll('.avatar-option-btn');
    btns.forEach((btn) => {
        const btnAvatar = btn.getAttribute('data-avatar');
        const isMatch = btnAvatar === safeAvatar;
        btn.classList.toggle('is-selected', isMatch);
        btn.setAttribute('aria-pressed', isMatch ? 'true' : 'false');

        if (btnAvatar && isEmoteAvatar(btnAvatar)) {
            const imgEl = btn.querySelector('clashcalc-assets-image, orecalc-assets-image, img');
            if (imgEl && !/** @type {any} */ (btn)._avatarAnimTimer && !/** @type {any} */ (btn)._avatarAnimPending) {
                const targetSrc = getAvatarSrc(btnAvatar, { animated: false, size: '100' });
                imgEl.setAttribute('src', targetSrc);
            }
        }
    });

    const profileImg = document.getElementById('account-profile-avatar-img');
    if (profileImg) {
        const prevAvatar = profileImg.getAttribute('data-active-avatar');
        if (prevAvatar && prevAvatar !== safeAvatar) {
            stopAvatarAnimation(profileImg, safeAvatar, '200');
        } else if (!/** @type {any} */ (profileImg)._avatarAnimTimer && !/** @type {any} */ (profileImg)._avatarAnimPending) {
            profileImg.setAttribute('src', getAvatarSrc(safeAvatar, { animated: false, size: '200' }));
        }
        profileImg.setAttribute('data-active-avatar', safeAvatar);
    }

    const avatarBtn = document.getElementById('account-profile-avatar-btn');
    if (avatarBtn) {
        if (isBonusAvatar(safeAvatar)) {
            avatarBtn.classList?.add('is-bonus');
        } else {
            avatarBtn.classList?.remove('is-bonus');
        }
    }
}

/**
 * Builds the milestone context for avatar lock evaluation.
 *
 * @param {{ isSupporter?: boolean }|null} [customUser=null]
 * @param {Array<any>|null} [customPasskeys=null]
 * @returns {{ townHallLevel: number, passkeysCount: number, isSupporter: boolean }}
 */
export function getAvatarMilestoneContext(customUser = null, customPasskeys = null) {
    const profiles = getSavedProfiles();
    const maxSavedTownHall = Array.isArray(profiles) && profiles.length > 0
        ? profiles.reduce((max, p) => Math.max(max, Number(p.cachedData?.townHallLevel) || 0), 0)
        : 0;
    const fallbackStateTh = (!Array.isArray(profiles) || profiles.length === 0) &&
        state.playerProfile?.tag && state.playerProfile.tag !== 'DEFAULT0'
        ? (Number(state.playerProfile.townHallLevel) || 0)
        : 0;
    const maxTownHall = Math.max(maxSavedTownHall, fallbackStateTh);

    const user = customUser || getAuthenticatedUser();
    if (Array.isArray(customPasskeys)) {
        cachedPasskeysCount = customPasskeys.length;
    }
    const passkeysCount = Array.isArray(customPasskeys) ? customPasskeys.length : (cachedPasskeysCount || 0);
    const isSupporter = Boolean(user?.isSupporter);

    return {
        townHallLevel: maxTownHall,
        passkeysCount,
        isSupporter
    };
}

/**
 * Evaluates and renders the locked/unlocked visual overlays and badges on bonus avatar buttons.
 *
 * @param {{ townHallLevel?: number, passkeysCount?: number, isSupporter?: boolean }|null} [context=null]
 */
export function renderAvatarLockStates(context = null) {
    const tray = document.getElementById('account-avatar-tray');
    if (!tray) return;

    const ctx = context || getAvatarMilestoneContext();
    const bonusBtns = tray.querySelectorAll('.avatar-option-btn.is-bonus');

    bonusBtns.forEach((btn) => {
        const avatar = btn.getAttribute('data-avatar');
        if (!avatar) return;
        const lockStatus = getAvatarLockStatus(avatar, ctx);
        const overlay = btn.querySelector('.avatar-lock-overlay, .avatar-locked-overlay');
        const badge = btn.querySelector('.avatar-lock-badge');

        if (lockStatus.isLocked) {
            btn.classList.add('is-locked');
            btn.setAttribute('data-locked', 'true');
            if (overlay) {
                overlay.classList.remove('is-hidden');
                overlay.removeAttribute('hidden');
            }
            if (badge) {
                badge.classList.remove('is-hidden');
                badge.removeAttribute('hidden');
            }
        } else {
            btn.classList.remove('is-locked');
            btn.setAttribute('data-locked', 'false');
            if (overlay) {
                overlay.classList.add('is-hidden');
                overlay.setAttribute('hidden', '');
            }
            if (badge) {
                badge.classList.add('is-hidden');
                badge.setAttribute('hidden', '');
            }
        }
    });
}

/**
 * Renders the contextual unlock requirement popover using ClashCalc's canonical #card-help-popover.
 *
 * @param {HTMLElement} anchorEl - The locked avatar button element.
 * @param {string} avatar - The avatar key.
 * @param {{
 *     isLocked: boolean,
 *     milestoneType: 'th' | 'passkey' | 'supporter' | null,
 *     titleKey: string,
 *     descriptionKey: string,
 *     reqLabelKey?: string,
 *     progressKey: string,
 *     progressParams: Record<string, any>,
 *     actionType: 'link_village' | 'add_passkey' | 'supporter' | null
 * }} lockStatus
 */
export function renderAvatarUnlockPopover(anchorEl, avatar, lockStatus) {
    if (!anchorEl || !lockStatus) return;

    const previewSrc = getAvatarSrc(avatar, { animated: false, size: '100' });
    const title = lockStatus.titleKey ? translate(lockStatus.titleKey) : '';
    const lockedBadge = translate('views.home.profile.locked');
    const desc = lockStatus.descriptionKey ? translate(lockStatus.descriptionKey) : '';
    const reqLabel = lockStatus.reqLabelKey ? translate(lockStatus.reqLabelKey) : '';

    const progressParams = { ...(lockStatus.progressParams || {}) };
    if (progressParams.statusKey) {
        progressParams.status = translate(progressParams.statusKey);
    }
    const progressText = lockStatus.progressKey ? translate(lockStatus.progressKey, progressParams) : '';

    const actionLabel = lockStatus.actionType === 'add_passkey'
        ? translate('auth.addPasskey')
        : lockStatus.actionType === 'supporter'
        ? translate('auth.supporter.unlockAction')
        : lockStatus.actionType === 'link_village'
        ? translate('views.landing.manageVillages')
        : '';
    const actionHref = lockStatus.actionType === 'add_passkey'
        ? '#account-add-passkey-name'
        : lockStatus.actionType === 'supporter'
        ? '#account-supporter-panel'
        : '#account-profile-villages-row';

    const statusHtml = progressText
        ? `<p><strong>${escapeHTML(reqLabel)}:</strong> ${escapeHTML(progressText)}</p>`
        : '';
    const footerHtml = actionLabel && lockStatus.actionType
        ? `<a href="${actionHref}" class="theme-link" data-unlock-action="${escapeHTML(lockStatus.actionType)}">${escapeHTML(actionLabel)}</a>`
        : null;

    showCardHelpPopover(anchorEl, {
        header: `
            <clashcalc-assets-image src="${escapeHTML(previewSrc)}" alt="${escapeHTML(title)}" class="popover-img"></clashcalc-assets-image>
            <div class="popover-title-group">
                <span class="popover-title">${escapeHTML(title)}</span>
                <span class="popover-badge">${escapeHTML(lockedBadge)}</span>
            </div>
        `,
        body: `<p>${escapeHTML(desc)}</p>${statusHtml}`,
        footer: footerHtml
    }, { isToggle: true });
}
