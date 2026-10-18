/**
 * Player Data Background Refresh Controller & Staleness Revalidation Coordinator.
 * Manages headless API refreshes, throttled window focus / visibility hydration, and manual sync actions.
 * Tier 4: UI Component Controller.
 */

import { state } from '../../core/state.js';
import { normalizePlayerTag } from '../../core/storageKeys.js';
import { getSavedProfiles } from '../../core/playerStorage.js';
import { isPlayerRefreshStale, setPlayerLastRefreshed } from '../../core/playerRefreshThrottler.js';
import { loadAndProcessPlayerData } from '../../services/serverResponseHandler.js';
import { startTopProgressBar, finishTopProgressBar } from '../../utils/topProgressBar.js';
import { showToast, showApiErrorToast } from '../../ui/toast.js';
import { showAddPlayerModal } from './playerModalInputs.js';
import { translate } from '../../i18n/translator.js';
import { logger } from '../../utils/logger.js';

/** @type {Promise<import('../../core/types.js').ServerResponseResult> | null} */
let activeRefreshPromise = null;
let isAutoRefreshInitialized = false;

/**
 * Executes a headless refresh for the active or targeted player tag.
 *
 * @param {Object} [options={}] - Execution options.
 * @param {boolean} [options.background=false] - When true, suppresses user-facing success toasts and non-blocking error popups.
 * @param {boolean} [options.force=false] - When true, bypasses the 10-minute staleness check.
 * @param {string | null} [options.targetTag=null] - Specific player tag to refresh (defaults to active player tag).
 * @returns {Promise<import('../../core/types.js').ServerResponseResult>}
 */
export async function refreshActivePlayerData({ background = false, force = false, targetTag = null } = {}) {
    let rawTag = targetTag;
    if (!rawTag) {
        if (typeof window !== 'undefined') {
            try {
                const urlParams = new URLSearchParams(window.location.search);
                rawTag = urlParams.get('tag');
            } catch {}
        }
        if (!rawTag && state?.savedPlayerTags && state.savedPlayerTags.length > 0) {
            rawTag = state.savedPlayerTags[0];
        }
        if (!rawTag) {
            const saved = typeof getSavedProfiles === 'function' ? getSavedProfiles() : [];
            rawTag = saved[0]?.cleanTag;
        }
    }
    const cleanTag = normalizePlayerTag(rawTag);

    if (!cleanTag || cleanTag === 'DEFAULT0') {
        return { success: false, message: translate('alerts.noPlayerToRefresh') || 'No player to refresh', isNetworkError: false };
    }

    if (!force && !isPlayerRefreshStale(cleanTag)) {
        return { success: true, cleanTag, skipped: true };
    }

    if (activeRefreshPromise) {
        return activeRefreshPromise;
    }

    activeRefreshPromise = (async () => {
        try {
            startTopProgressBar();
            const result = await loadAndProcessPlayerData(cleanTag, { updateOrder: false });
            finishTopProgressBar();

            if (result.success) {
                setPlayerLastRefreshed(cleanTag, Date.now());
                if (typeof document !== 'undefined') {
                    document.dispatchEvent(new CustomEvent('app:playerDropdownSync'));
                }
                if (!background) {
                    showToast(translate('actions.synced'), 'success');
                }
            } else {
                if (result.errorType === 'apiErrors.protectedTag') {
                    showAddPlayerModal(cleanTag, true);
                } else if (!background) {
                    showApiErrorToast(result);
                }
            }
            return result;
        } catch (error) {
            finishTopProgressBar();
            if (typeof window !== 'undefined' && window.handleChunkError && window.handleChunkError(error)) {
                return { success: false, message: 'Chunk error handled', isNetworkError: false };
            }
            logger.error('Player refresh failed:', error);
            if (!background) {
                showApiErrorToast(error);
            }
            return { success: false, message: String(error), isNetworkError: true };
        } finally {
            activeRefreshPromise = null;
        }
    })();

    return activeRefreshPromise;
}

/**
 * Initializes automated background refresh triggers for visibility change and window focus.
 */
export function initAutoRefreshTriggers() {
    if (typeof document === 'undefined' || isAutoRefreshInitialized) return;
    isAutoRefreshInitialized = true;

    const handleFocusOrVisibility = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        const activeTag = state?.savedPlayerTags?.[0];
        if (activeTag && activeTag !== 'DEFAULT0' && isPlayerRefreshStale(activeTag)) {
            void refreshActivePlayerData({ background: true });
        }
    };

    document.addEventListener('visibilitychange', handleFocusOrVisibility);
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('focus', handleFocusOrVisibility);
    }
}
