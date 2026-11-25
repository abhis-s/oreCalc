/**
 * Interaction bindings for Account Page avatar tray, emote playback, and unlock requirement actions.
 * Tier 4: Account Sub-Panel Interaction Engine.
 */

import { showToast } from '../../ui/toast.js';
import { getAuthenticatedUser, updateAvatar } from '../../services/authClientService.js';
import { resolveErrorMessage } from '../auth/authModalInputs.js';
import { showAddPlayerModal } from '../player/playerModalInputs.js';
import { logger } from '../../utils/logger.js';
import {
    getAvatarLockStatus,
    isEmoteAvatar,
    playAvatarAnimationOnce,
    stopAvatarAnimation
} from '../../utils/avatarUtils.js';
import { hideCardHelpPopover } from '../../utils/cardHelpPopover.js';
import {
    getAvatarMilestoneContext,
    highlightActiveAvatarInTray,
    renderAvatarLockStates,
    renderAvatarUnlockPopover,
    switchAvatarTrayTab,
    toggleAvatarTray
} from './accountPageAvatarDisplay.js';
import {
    toggleSupporterCodeDrawer,
    toggleSupporterPanel
} from './accountPageDisplay.js';

let isUnlockActionListenerBound = false;

/**
 * Resolves the active column count for an avatar options grid, preserving the 5-column
 * desktop animated grid while adapting accurately to the 4-column phone breakpoint.
 *
 * @param {Element} activeGrid
 * @returns {number}
 */
function resolveAvatarGridColumns(activeGrid) {
    if (!activeGrid.classList.contains('avatar-options-grid--animated')) {
        return 4;
    }

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        if (window.matchMedia('(max-width: 480px)').matches) {
            return 4;
        }
    }

    return 5;
}

/**
 * Selects and persists a new avatar image for the authenticated user.
 *
 * @param {string} avatar - Desired avatar identifier ('archer', 'builder', etc.).
 */
async function handleSelectAvatar(avatar) {
    if (!avatar) return;

    const currentUser = getAuthenticatedUser();
    if (currentUser?.avatar === avatar) {
        return;
    }

    try {
        await updateAvatar(avatar);
        const profileImg = document.getElementById('account-profile-avatar-img');
        if (profileImg) {
            stopAvatarAnimation(profileImg, avatar, '200');
        }
        highlightActiveAvatarInTray(avatar);
    } catch (err) {
        logger.error('[Account] Failed to update avatar:', err);
        const errorMsg = resolveErrorMessage(err);
        showToast(errorMsg, 'error');
    }
}

/**
 * Handles keyboard navigation within the avatar tray (tablist ArrowLeft/ArrowRight
 * and avatar grid 2D arrow navigation + Escape).
 *
 * @param {KeyboardEvent} e - Keyboard interaction event.
 */
function handleAvatarTrayKeyDown(e) {
    const activeTab = document.activeElement?.closest('[data-avatar-tab]');
    if (activeTab && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        const tablist = activeTab.closest('[role="tablist"]');
        if (!tablist) return;
        const tabs = Array.from(tablist.querySelectorAll('[data-avatar-tab]'));
        const tabIdx = tabs.indexOf(activeTab);
        if (tabIdx === -1 || tabs.length < 2) return;

        e.preventDefault();
        const delta = e.key === 'ArrowRight' ? 1 : -1;
        const nextTab = /** @type {HTMLElement} */ (tabs[(tabIdx + delta + tabs.length) % tabs.length]);
        const targetTabName = nextTab.getAttribute('data-avatar-tab');
        if (targetTabName) {
            hideCardHelpPopover();
            switchAvatarTrayTab(targetTabName);
        }
        nextTab.focus();
        return;
    }

    const activeBtn = document.activeElement?.closest('.avatar-option-btn');
    if (!activeBtn) return;

    const tray = document.getElementById('account-avatar-tray');
    if (!tray) return;

    const activeGrid = activeBtn.closest('.avatar-options-grid');
    if (!activeGrid) return;

    const btns = Array.from(activeGrid.querySelectorAll('.avatar-option-btn'));
    const index = btns.indexOf(/** @type {HTMLButtonElement} */ (activeBtn));
    if (index === -1) return;

    const cols = resolveAvatarGridColumns(activeGrid);

    let targetIndex = -1;
    if (e.key === 'ArrowRight') targetIndex = (index + 1) % btns.length;
    else if (e.key === 'ArrowLeft') targetIndex = (index - 1 + btns.length) % btns.length;
    else if (e.key === 'ArrowDown') targetIndex = (index + cols) % btns.length;
    else if (e.key === 'ArrowUp') targetIndex = (index - cols + btns.length) % btns.length;
    else if (e.key === 'Escape') {
        hideCardHelpPopover();
        toggleAvatarTray(false);
        document.getElementById('account-profile-avatar-btn')?.focus();
        return;
    }

    if (targetIndex !== -1) {
        e.preventDefault();
        /** @type {HTMLElement} */ (btns[targetIndex]).focus();
    }
}

/**
 * Initializes all avatar tray, profile avatar playback, and unlock popover action bindings.
 */
export function initAccountAvatarModule() {
    const toggleAvatar = () => {
        const user = getAuthenticatedUser();
        const isOpen = toggleAvatarTray();
        if (isOpen) {
            toggleSupporterPanel(false);
            renderAvatarLockStates(getAvatarMilestoneContext(user));
            if (user?.avatar) {
                highlightActiveAvatarInTray(user.avatar, { syncTab: true });
                const activeBtn = document.querySelector(`.avatar-option-btn[data-avatar="${user.avatar}"]`);
                /** @type {HTMLElement | null} */ (activeBtn)?.focus();
            }
        }
    };

    const triggerProfileAvatarAnimation = () => {
        const user = getAuthenticatedUser();
        const avatar = user?.avatar;
        if (!avatar || !isEmoteAvatar(avatar)) return;
        const profileImg = document.getElementById('account-profile-avatar-img');
        if (profileImg) {
            playAvatarAnimationOnce(profileImg, avatar, '200');
        }
    };

    const avatarBtn = document.getElementById('account-profile-avatar-btn');
    avatarBtn?.addEventListener('click', () => {
        triggerProfileAvatarAnimation();
        toggleAvatar();
    });
    avatarBtn?.addEventListener('pointerenter', triggerProfileAvatarAnimation);
    avatarBtn?.addEventListener('focus', triggerProfileAvatarAnimation);

    const avatarDoneBtn = document.getElementById('account-btn-avatar-done');
    avatarDoneBtn?.addEventListener('click', () => {
        hideCardHelpPopover();
        toggleAvatarTray(false);
        document.getElementById('account-profile-avatar-btn')?.focus();
    });

    const avatarTray = document.getElementById('account-avatar-tray');
    avatarTray?.addEventListener('keydown', handleAvatarTrayKeyDown);
    avatarTray?.addEventListener('mouseover', (e) => {
        const btn = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('.avatar-option-btn'));
        if (!btn) return;
        const related = /** @type {HTMLElement | null} */ (e.relatedTarget);
        if (related && btn.contains(related)) {
            return;
        }
        const avatar = btn.getAttribute('data-avatar');
        if (avatar && isEmoteAvatar(avatar)) {
            playAvatarAnimationOnce(btn, avatar, '100');
        }
    });
    avatarTray?.addEventListener('click', (e) => {
        const tabBtn = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-avatar-tab]'));
        if (tabBtn) {
            hideCardHelpPopover();
            const tab = tabBtn.getAttribute('data-avatar-tab');
            if (tab) switchAvatarTrayTab(tab);
            return;
        }

        const btn = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('.avatar-option-btn'));
        if (btn) {
            const avatar = btn.getAttribute('data-avatar');
            if (avatar) {
                if (btn.classList.contains('is-locked') || btn.getAttribute('data-locked') === 'true') {
                    const ctx = getAvatarMilestoneContext();
                    const lockStatus = getAvatarLockStatus(avatar, ctx);
                    renderAvatarUnlockPopover(btn, avatar, lockStatus);
                    return;
                }
                hideCardHelpPopover();
                if (isEmoteAvatar(avatar)) {
                    playAvatarAnimationOnce(btn, avatar, '100');
                }
                handleSelectAvatar(avatar);
            }
        }
    });

    const animatedGrid = document.getElementById('account-avatar-grid-animated');
    animatedGrid?.addEventListener('scroll', () => {
        hideCardHelpPopover();
    }, { passive: true });

    if (!isUnlockActionListenerBound) {
        isUnlockActionListenerBound = true;
        document.addEventListener('click', (e) => {
            const actionLink = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target)?.closest?.('#card-help-popover [data-unlock-action]'));
            if (!actionLink) return;
            e.preventDefault();
            const reqType = actionLink.getAttribute('data-unlock-action');
            hideCardHelpPopover();
            if (reqType === 'add_passkey') {
                const passkeyInput = document.getElementById('account-add-passkey-name');
                passkeyInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                passkeyInput?.focus();
            } else if (reqType === 'supporter') {
                toggleAvatarTray(false);
                toggleSupporterPanel(true);
                toggleSupporterCodeDrawer(true);
                const codeInput = document.getElementById('account-supporter-code-input');
                codeInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                codeInput?.focus();
            } else if (reqType === 'link_village') {
                toggleAvatarTray(false);
                showAddPlayerModal();
            }
        });
    }
}
