/**
 * Saved Accounts Manager & Profile State Controller for Landing Portal.
 * Handles saved village selection, deletion, UI sync, and background profile refresh.
 * Tier 4: User Inputs & Storage Sync.
 */

import { safeJsonParse } from '../../utils/jsonUtils.js';
import { getSavedProfiles, removePlayerTag, setActivePlayerTag } from '../../core/playerStorage.js';
import { normalizePlayerTag } from '../../core/storageKeys.js';
import { calculateEquipmentProgress } from '../../domain/equipment/equipmentProgressDomain.js';
import { translate } from '../../i18n/translator.js';
import { showConfirm } from '../../ui/noticeModal.js';
import { loadAndProcessPlayerData } from '../../services/serverResponseHandler.js';
import { showApiErrorToast, showToast } from '../../ui/toast.js';
import { startTopProgressBar, finishTopProgressBar } from '../../utils/topProgressBar.js';
import {
    extractEquipmentAndHeroes,
    calculateMaxedEquipmentCount,
    calculateHeroJourneyProgress,
    renderActiveProfile
} from './landingActiveProfile.js';
import {
    renderLiveDashboards
} from './landingDashboards.js';
import { renderAccountsGrid } from './landingAccounts.js';

/**
 * Loads full partitioned player data from localStorage.
 * @param {string} cleanTag
 * @returns {any | null}
 */
export function loadPlayerData(cleanTag) {
    try {
        const canonicalKey = `clashCalc_player_${cleanTag}`;
        const legacyKey = `oreCalc_player_${cleanTag}`;
        const raw = localStorage.getItem(canonicalKey) || localStorage.getItem(legacyKey);
        if (!raw) return null;
        return safeJsonParse(raw, null);
    } catch {
        return null;
    }
}

export const ACCOUNT_REFRESH_DELAY_MS = 2000;

/**
 * Iterates through saved profiles sequentially and refreshes their data in the background.
 *
 * @param {string[]} tags - Normalized player tags to refresh.
 * @param {((tag: string) => void) | { onTagStart?: (tag: string) => void, onProfileUpdated?: (tag: string) => void, throttleMs?: number }} [onProfileUpdatedOrOptions] - Callback or options object.
 * @returns {Promise<{ total: number, successCount: number, failedCount: number }>}
 */
export async function refreshSavedProfilesSequentially(tags, onProfileUpdatedOrOptions) {
    const summary = { total: 0, successCount: 0, failedCount: 0 };
    if (!Array.isArray(tags) || tags.length === 0) return summary;

    const options = typeof onProfileUpdatedOrOptions === 'function'
        ? { onProfileUpdated: onProfileUpdatedOrOptions, throttleMs: 0 }
        : (onProfileUpdatedOrOptions || {});

    const { onTagStart, onProfileUpdated, throttleMs = 0 } = options;
    const validTags = tags.filter(tag => tag && tag !== 'DEFAULT0');
    summary.total = validTags.length;

    for (let i = 0; i < validTags.length; i++) {
        const tag = validTags[i];
        if (typeof onTagStart === 'function') {
            onTagStart(tag);
        }
        try {
            const result = await loadAndProcessPlayerData(tag, { updateOrder: false });
            if (result?.success) {
                summary.successCount++;
                if (typeof onProfileUpdated === 'function') {
                    onProfileUpdated(tag);
                }
            } else {
                summary.failedCount++;
            }
        } catch {
            summary.failedCount++;
        }

        if (i < validTags.length - 1 && throttleMs > 0) {
            await new Promise(resolve => setTimeout(resolve, throttleMs));
        }
    }

    return summary;
}

/**
 * Initializes saved accounts management, profile cards, and village selection for the landing portal.
 *
 * @param {Object} options
 * @param {(cleanTag: string, summary: any) => void} options.onActiveVillageChanged - Callback when active village changes.
 * @param {() => void} options.onAllVillagesDeleted - Callback when all saved villages are deleted.
 * @param {() => boolean} options.isSearchFormOpen - Function checking if search form is currently open.
 * @param {(open: boolean) => void} options.setToggleAddBtnState - Callback to update toggle add button state.
 * @param {(village: any) => void} options.openLaunchModal - Callback to open launch choice modal.
 * @returns {{ selectVillage: (cleanTag: string) => void, handleDeleteVillage: (cleanTag: string) => void, getActiveTag: () => string | null, getActiveProfile: () => any | null }}
 */
export function initLandingAccountsManager({
    onActiveVillageChanged,
    onAllVillagesDeleted,
    isSearchFormOpen,
    setToggleAddBtnState,
    openLaunchModal
}) {
    let savedProfiles = getSavedProfiles();
    const manageBtn = document.getElementById('landing-manage-accounts-btn');

    let activeTag = savedProfiles.length > 0 ? savedProfiles[0].cleanTag : null;
    let activeProfile = savedProfiles.length > 0 ? savedProfiles[0] : null;
    let isManagingAccounts = false;

    /**
     * Activates a player account, updating showcase, cards highlight, tool links, and live progress.
     * @param {string} cleanTag
     */
    const selectVillage = (cleanTag) => {
        activeTag = cleanTag;
        setActivePlayerTag(cleanTag);

        if (typeof document !== 'undefined') {
            if (document?.documentElement?.classList) {
                document.documentElement.classList.add('has-player');
            }
            const showcaseSection = document.getElementById('landing-active-profile');
            if (showcaseSection) {
                showcaseSection.hidden = false;
                showcaseSection.style.display = 'block';
            }
        }

        const allCards = document.querySelectorAll('.landing-account-card');
        allCards.forEach(c => {
            const isMatch = (/** @type {HTMLElement} */ (c)).dataset.tag === cleanTag;
            c.classList.toggle('is-active', isMatch);
            c.setAttribute('aria-selected', isMatch ? 'true' : 'false');
        });

        const currentProfiles = getSavedProfiles();
        const summary = currentProfiles.find(p => p.cleanTag === cleanTag);
        if (!summary) return;

        activeProfile = summary;

        const playerData = loadPlayerData(cleanTag);
        const { ownedEquipment, ownedHeroes } = extractEquipmentAndHeroes(playerData, summary.cachedData);
        const oreProgress = calculateEquipmentProgress(ownedEquipment, ownedHeroes);
        const thLevel = Math.max(1, Math.min(18, Number(summary.townHallLevel || summary.cachedData?.townHallLevel || playerData?.townHallLevel) || 18));
        const { maxedCount, totalCount } = calculateMaxedEquipmentCount(ownedEquipment);
        const hjProgress = calculateHeroJourneyProgress(playerData, summary.cachedData, thLevel);

        renderActiveProfile(summary, playerData, maxedCount, totalCount);
        renderLiveDashboards(oreProgress, hjProgress, thLevel);

        if (typeof onActiveVillageChanged === 'function') {
            onActiveVillageChanged(cleanTag, summary);
        }
    };

    /**
     * Deletes a saved profile, handles active tag fallbacks, and re-renders the grid and showcase.
     * @param {string} cleanTagToDelete
     */
    const handleDeleteVillage = async (cleanTagToDelete) => {
        const confirmed = await showConfirm(
            translate('confirms.deleteProfile'),
            'actions.confirm',
            'actions.delete'
        );
        if (!confirmed) return;

        removePlayerTag(cleanTagToDelete);
        const updatedProfiles = getSavedProfiles();

        if (updatedProfiles.length === 0) {
            isManagingAccounts = false;
            if (manageBtn) {
                manageBtn.classList.remove('is-active');
                manageBtn.innerHTML = `
                    <orecalc-assets-svg name="edit" width="14" height="14"></orecalc-assets-svg>
                    <span data-i18n="actions.manage">${translate('actions.manage')}</span>
                `;
            }
            const cardsContainer = document.getElementById('landing-accounts-list');
            if (cardsContainer) {
                cardsContainer.innerHTML = '';
                cardsContainer.classList.remove('is-managing');
            }
            activeTag = null;
            activeProfile = null;
            if (typeof onAllVillagesDeleted === 'function') {
                onAllVillagesDeleted();
            }
            return;
        }

        let nextTag = activeTag;
        if (cleanTagToDelete === activeTag) {
            nextTag = updatedProfiles[0].cleanTag;
        }

        renderAccountsGrid(updatedProfiles, nextTag, selectVillage, handleDeleteVillage);
        if (isManagingAccounts) {
            const cardsContainer = document.getElementById('landing-accounts-list');
            cardsContainer?.classList.add('is-managing');
        }

        if (nextTag) {
            selectVillage(nextTag);
        }
    };

    const refreshBtn = document.getElementById('landing-refresh-accounts-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            const btnEl = /** @type {HTMLButtonElement} */ (refreshBtn);
            if (btnEl.classList.contains('is-refreshing') || btnEl.disabled) return;
            const currentTags = getSavedProfiles().map(p => p.cleanTag).filter(t => t && t !== 'DEFAULT0');
            if (currentTags.length === 0) return;

            btnEl.disabled = true;
            btnEl.setAttribute('aria-busy', 'true');
            btnEl.classList.add('is-refreshing');
            startTopProgressBar();

            const btnTextSpan = btnEl.querySelector('span');
            let completedCount = 0;

            let summary = { total: currentTags.length, successCount: 0, failedCount: 0 };
            try {
                summary = await refreshSavedProfilesSequentially(currentTags, {
                    throttleMs: ACCOUNT_REFRESH_DELAY_MS,
                    onTagStart: (tag) => {
                        const targetCard = document.querySelector(`.landing-account-card[data-tag="${tag}"]`);
                        if (targetCard) {
                            targetCard.classList.add('is-refreshing');
                        }
                        if (btnTextSpan) {
                            const index = completedCount + 1;
                            btnTextSpan.textContent = currentTags.length > 1
                                ? `${translate('actions.loading')} (${index}/${currentTags.length})`
                                : translate('actions.loading');
                        }
                    },
                    onProfileUpdated: (updatedTag) => {
                        completedCount++;
                        const refreshedProfiles = getSavedProfiles();
                        renderAccountsGrid(refreshedProfiles, activeTag, selectVillage, handleDeleteVillage);
                        if (isManagingAccounts) {
                            const cardsContainer = document.getElementById('landing-accounts-list');
                            cardsContainer?.classList.add('is-managing');
                        }
                        if (updatedTag === activeTag) {
                            selectVillage(activeTag);
                        }
                        const updatedCard = document.querySelector(`.landing-account-card[data-tag="${updatedTag}"]`);
                        if (updatedCard) {
                            updatedCard.classList.add('is-pulse');
                        }
                    }
                });
            } finally {
                finishTopProgressBar();
                btnEl.classList.remove('is-refreshing');
                btnEl.removeAttribute('aria-busy');
                btnEl.disabled = false;
                if (btnTextSpan) {
                    btnTextSpan.textContent = translate('actions.refresh');
                }
                document.querySelectorAll('.landing-account-card.is-refreshing').forEach(c => c.classList.remove('is-refreshing'));
            }

            if (summary.total > 0) {
                if (summary.successCount === summary.total) {
                    showToast(translate('views.landing.villagesRefreshed'), 'success');
                } else if (summary.successCount > 0) {
                    showToast(translate('views.landing.villagesRefreshPartial', { success: summary.successCount, total: summary.total }), 'warning');
                } else {
                    showApiErrorToast('apiErrors.500');
                }
            }
        });
    }

    if (manageBtn) {
        manageBtn.addEventListener('click', () => {
            isManagingAccounts = !isManagingAccounts;
            manageBtn.classList.toggle('is-active', isManagingAccounts);
            manageBtn.innerHTML = isManagingAccounts
                ? `<orecalc-assets-svg name="check" width="14" height="14"></orecalc-assets-svg><span data-i18n="actions.done">${translate('actions.done')}</span>`
                : `<orecalc-assets-svg name="edit" width="14" height="14"></orecalc-assets-svg><span data-i18n="actions.manage">${translate('actions.manage')}</span>`;

            const cardsContainer = document.getElementById('landing-accounts-list');
            cardsContainer?.classList.toggle('is-managing', isManagingAccounts);
        });
    }

    const accountsListContainer = document.getElementById('landing-accounts-list');
    if (accountsListContainer) {
        accountsListContainer.addEventListener('click', (e) => {
            const target = /** @type {HTMLElement} */ (e.target);

            const deleteBtn = target.closest('.landing-account-delete-btn');
            if (deleteBtn) {
                e.stopPropagation();
                const card = deleteBtn.closest('.landing-account-card');
                const tag = (/** @type {HTMLElement | null} */ (card))?.dataset.tag;
                if (tag) handleDeleteVillage(tag);
                return;
            }

            const card = target.closest('.landing-account-card');
            if (card) {
                const tag = (/** @type {HTMLElement} */ (card)).dataset.tag;
                if (tag) selectVillage(tag);
            }
        });
    }

    // Initial render of saved accounts
    if (savedProfiles.length > 0) {
        renderAccountsGrid(savedProfiles, activeTag, selectVillage, handleDeleteVillage);
        if (activeTag) {
            selectVillage(activeTag);
        }
    } else {
        if (typeof onAllVillagesDeleted === 'function') {
            onAllVillagesDeleted();
        }
    }

    // URL tag routing
    const urlParams = new URLSearchParams(window.location.search);
    const hasUrlTagParam = urlParams.has('tag') || urlParams.has('p') || urlParams.has('player');
    const rawUrlTag = urlParams.get('tag') || urlParams.get('p') || urlParams.get('player');
    const cleanUrlTag = normalizePlayerTag(rawUrlTag);

    if (hasUrlTagParam) {
        if (!cleanUrlTag || cleanUrlTag === 'DEFAULT0') {
            showToast(translate('apiErrors.invalidTag'), 'error');
        } else {
            const existing = savedProfiles.find(p => p.cleanTag === cleanUrlTag);
            if (existing) {
                activeTag = cleanUrlTag;
                selectVillage(cleanUrlTag);
            } else {
                (async () => {
                    try {
                        const result = await loadAndProcessPlayerData(cleanUrlTag, { updateOrder: true });
                        if (result?.success) {
                            savedProfiles = getSavedProfiles();
                            activeTag = cleanUrlTag;
                            const newProfile = savedProfiles.find(p => p.cleanTag === cleanUrlTag);
                            const accountsSection = document.getElementById('landing-saved-accounts');
                            if (accountsSection) accountsSection.style.display = 'flex';
                            renderAccountsGrid(savedProfiles, activeTag, selectVillage, handleDeleteVillage);
                            selectVillage(cleanUrlTag);
                            if (newProfile && typeof openLaunchModal === 'function') {
                                openLaunchModal(newProfile);
                            }
                        } else {
                            showApiErrorToast(result?.message);
                        }
                    } catch (err) {
                        console.error('URL Tag lookup failed:', err);
                    }
                })();
            }
        }
    }

    // Background sync of saved accounts
    if (savedProfiles.length > 1) {
        const backgroundTags = savedProfiles.slice(1).map(p => p.cleanTag);
        refreshSavedProfilesSequentially(backgroundTags, {
            throttleMs: ACCOUNT_REFRESH_DELAY_MS,
            onProfileUpdated: (updatedTag) => {
                const refreshedProfiles = getSavedProfiles();
                renderAccountsGrid(refreshedProfiles, activeTag, selectVillage, handleDeleteVillage);
                if (updatedTag === activeTag) {
                    selectVillage(activeTag);
                }
            }
        });
    }

    return {
        selectVillage,
        handleDeleteVillage,
        getActiveTag: () => activeTag,
        getActiveProfile: () => activeProfile
    };
}
