/**
 * Player Tag Search Form & API Lookup Controller for Landing Portal.
 * Handles search input validation, live error banners, API lookup, and loading states.
 * Tier 4: User Inputs & Search Controller.
 */

import { getSavedProfiles } from '../../core/playerStorage.js';
import { validatePlayerTagInput } from '../../utils/playerTagValidator.js';
import { translate } from '../../i18n/translator.js';
import { loadAndProcessPlayerData } from '../../services/serverResponseHandler.js';
import { renderAccountsGrid } from './landingAccounts.js';

/**
 * Triggers the shake animation once on a target element and cleans up.
 * @param {HTMLElement|null} el
 */
function triggerShake(el) {
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    if (typeof el.addEventListener === 'function') {
        el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
    }
}

/**
 * Initializes the Landing Portal player tag search form.
 *
 * @param {Object} options
 * @param {(cleanTag: string) => void} options.selectVillage - Callback to activate an existing or newly added village.
 * @param {(cleanTag: string) => void} options.handleDeleteVillage - Callback when a village is deleted.
 * @param {(village: any) => void} options.openLaunchModal - Callback to open launch choice modal.
 * @returns {{ openSearchForm: () => void, closeSearchForm: () => void, isSearchFormOpen: () => boolean, updateToggleAddBtnState: (isOpen: boolean) => void }}
 */
export function initLandingSearchForm({
    selectVillage,
    handleDeleteVillage,
    openLaunchModal
}) {
    const searchForm = /** @type {HTMLFormElement | null} */ (document.getElementById('landing-search-form'));
    const searchInput = /** @type {HTMLInputElement | null} */ (document.getElementById('landing-search-input'));
    const searchErrorEl = document.getElementById('landing-search-error-message');
    const clearBtn = document.getElementById('landing-search-clear');
    const cancelBtn = document.getElementById('landing-search-cancel-btn');
    const feedbackEl = document.getElementById('landing-search-feedback');
    const searchWrapper = /** @type {HTMLElement|null} */ (searchForm?.querySelector('.landing-search-wrapper') || null);
    const searchBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('landing-search-btn'));
    const toggleAddBtn = document.getElementById('landing-toggle-add-btn');

    if (searchBtn && searchInput) {
        searchBtn.disabled = searchInput.value.trim().length === 0;
    }

    const showSearchFeedback = (type, message) => {
        if (!feedbackEl) return;
        feedbackEl.className = `landing-search-feedback is-${type}`;
        feedbackEl.textContent = message;
        feedbackEl.hidden = false;
        feedbackEl.style.display = 'flex';
        if (searchWrapper) {
            searchWrapper.classList.toggle('has-error', type === 'error');
            if (type === 'error') {
                triggerShake(searchWrapper);
            }
        }
    };

    const clearSearchFeedback = () => {
        if (!feedbackEl) return;
        feedbackEl.textContent = '';
        feedbackEl.hidden = true;
        feedbackEl.style.display = 'none';
        if (searchWrapper) {
            searchWrapper.classList.remove('has-error');
            searchWrapper.classList.remove('shake');
        }
    };

    /**
     * Updates the toggleAddBtn icon, text, and active class depending on whether the search form is open.
     * @param {boolean} isOpen
     */
    const updateToggleAddBtnState = (isOpen) => {
        if (!toggleAddBtn) return;
        toggleAddBtn.classList.toggle('is-active', isOpen);
        if (isOpen) {
            toggleAddBtn.innerHTML = `
                <orecalc-assets-svg name="close" width="14" height="14"></orecalc-assets-svg>
                <span data-i18n="actions.close">${translate('actions.close')}</span>
            `;
            toggleAddBtn.setAttribute('aria-label', translate('actions.close'));
        } else {
            toggleAddBtn.innerHTML = `
                <orecalc-assets-svg name="plus" width="14" height="14"></orecalc-assets-svg>
                <span data-i18n="views.landing.addVillage">${translate('views.landing.addVillage')}</span>
            `;
            toggleAddBtn.setAttribute('aria-label', translate('views.landing.addVillage'));
        }
    };

    const isSearchFormOpen = () => {
        return Boolean(searchForm && !searchForm.hidden && searchForm.style.display !== 'none');
    };

    const openSearchForm = () => {
        if (!searchForm) return;
        searchForm.hidden = false;
        searchForm.style.display = 'flex';
        const currentProfiles = getSavedProfiles();
        if (cancelBtn) {
            cancelBtn.hidden = currentProfiles.length <= 0;
            cancelBtn.style.display = currentProfiles.length > 0 ? 'inline-flex' : 'none';
        }
        if (searchInput) {
            searchInput.value = '';
            searchInput.classList.remove('input-error');
            searchInput.classList.remove('shake');
            if (clearBtn) {
                clearBtn.hidden = true;
                clearBtn.style.display = 'none';
            }
        }
        searchWrapper?.classList.remove('shake');
        if (searchErrorEl) {
            searchErrorEl.textContent = '';
            searchErrorEl.classList.remove('show');
        }
        if (searchBtn && searchInput) {
            searchBtn.disabled = searchInput.value.trim().length === 0;
        }
        clearSearchFeedback();
        updateToggleAddBtnState(true);
        searchInput?.focus();
        searchInput?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    const closeSearchForm = () => {
        if (!searchForm) return;
        const currentProfiles = getSavedProfiles();
        if (currentProfiles.length === 0) return;
        searchForm.hidden = true;
        searchForm.style.display = 'none';
        if (cancelBtn) {
            cancelBtn.hidden = true;
            cancelBtn.style.display = 'none';
        }
        if (searchInput) {
            searchInput.value = '';
            searchInput.classList.remove('input-error');
            searchInput.classList.remove('shake');
            if (clearBtn) {
                clearBtn.hidden = true;
                clearBtn.style.display = 'none';
            }
        }
        searchWrapper?.classList.remove('shake');
        if (searchErrorEl) {
            searchErrorEl.textContent = '';
            searchErrorEl.classList.remove('show');
        }
        clearSearchFeedback();
        updateToggleAddBtnState(false);
    };

    if (toggleAddBtn) {
        toggleAddBtn.addEventListener('click', () => {
            if (isSearchFormOpen()) {
                closeSearchForm();
            } else {
                openSearchForm();
            }
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            closeSearchForm();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const inputTarget = /** @type {HTMLInputElement} */ (e.target);
            inputTarget.value = inputTarget.value.toUpperCase();
            clearSearchFeedback();
            const { isValid } = validatePlayerTagInput(searchInput, searchErrorEl);
            if (!isValid) {
                triggerShake(searchWrapper);
            } else {
                searchWrapper?.classList.remove('shake');
            }
            if (clearBtn) {
                clearBtn.hidden = !searchInput.value;
                clearBtn.style.display = searchInput.value ? 'inline-flex' : 'none';
            }
            if (searchBtn) {
                searchBtn.disabled = searchInput.value.trim().length === 0;
            }
        });

        searchInput.addEventListener('blur', () => {
            searchInput.classList.remove('shake');
            searchWrapper?.classList.remove('shake');
        });
    }

    if (clearBtn && searchInput) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.hidden = true;
            clearBtn.style.display = 'none';
            searchInput.classList.remove('input-error');
            searchInput.classList.remove('shake');
            searchWrapper?.classList.remove('shake');
            if (searchErrorEl) {
                searchErrorEl.textContent = '';
                searchErrorEl.classList.remove('show');
            }
            if (searchBtn) {
                searchBtn.disabled = true;
            }
            clearSearchFeedback();
            searchInput.focus();
        });
    }

    if (searchForm && searchInput) {
        searchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearSearchFeedback();

            const { cleanedTag: clean, isValid } = validatePlayerTagInput(searchInput, searchErrorEl);
            if (!isValid || !clean) {
                triggerShake(searchWrapper);
                return;
            }

            const currentProfiles = getSavedProfiles();
            const existing = currentProfiles.find(p => p.cleanTag === clean);
            if (existing) {
                showSearchFeedback('notice', translate('views.landing.villageAlreadySaved'));
                selectVillage(clean);
                const matchingCard = document.querySelector(`.landing-account-card[data-tag="${clean}"]`);
                if (matchingCard) {
                    matchingCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    matchingCard.classList.add('is-pulse');
                    setTimeout(() => matchingCard.classList.remove('is-pulse'), 1600);
                }
                return;
            }

            if (searchBtn) searchBtn.classList.add('is-loading');
            searchInput.disabled = true;

            try {
                const result = await loadAndProcessPlayerData(clean, { updateOrder: true });
                if (!result || !result.success) {
                    const errorMsg = result?.message || translate('apiErrors.serverOffline');
                    showSearchFeedback('error', errorMsg);
                    return;
                }

                const refreshedProfiles = getSavedProfiles();
                const newProfile = refreshedProfiles.find(p => p.cleanTag === clean) || {
                    cleanTag: clean,
                    name: clean,
                    townHallLevel: 18
                };

                const accountsSection = document.getElementById('landing-saved-accounts');
                if (accountsSection) accountsSection.style.display = 'flex';

                renderAccountsGrid(refreshedProfiles, clean, selectVillage, handleDeleteVillage);
                selectVillage(clean);

                closeSearchForm();
                if (typeof openLaunchModal === 'function') {
                    openLaunchModal(newProfile);
                }
            } catch (err) {
                console.error('Failed to add village:', err);
                showSearchFeedback('error', translate('apiErrors.serverOffline'));
            } finally {
                if (searchBtn) searchBtn.classList.remove('is-loading');
                if (searchInput) searchInput.disabled = false;
            }
        });
    }

    return {
        openSearchForm,
        closeSearchForm,
        isSearchFormOpen,
        updateToggleAddBtnState
    };
}
