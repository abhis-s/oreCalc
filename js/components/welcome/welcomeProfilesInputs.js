import { translate } from '../../i18n/translator.js';

import { removePlayerTag, updateSavedPlayerTags } from '../../core/localStorageManager.js';
import { getDefaultPlayerState, isProfileOnboarded, state } from '../../core/state.js';
import { handleStateUpdate, switchActivePlayer } from '../../core/stateManager.js';

import { logger } from '../../utils/logger.js';
import { validatePlayerTagInput } from '../../utils/playerTagValidator.js';

import {
    getVisualIndexFromPage,
    updateContinueButtonDisabledState,
    updateHeaderSkipButtonVisibility,
    updateWelcomeContinueButtonText,
    updateWelcomePage2Buttons
} from './welcomeCarouselDisplay.js';
import {
    generateGuestPlayerData,
    initializeGuestHeroesState
} from './welcomeGuestHeroState.js';
import { welcomeState } from './welcomeModalState.js';
import {
    renderVerticalProfilesList,
    renderWelcomeProfilesList
} from './welcomeProfileCardRenderer.js';
import { renderProfilePreviewCard } from './welcomeProfileDisplay.js';
import { updateWelcomeSyncState } from './welcomeSyncDisplay.js';
import { getWizardCallbacks } from './welcomeWizardInputs.js';
import {
    applyChecklistToProfile,
    openSetupWizard
} from './welcomeWizardState.js';
import { fetchPlayerData } from '../../services/apiService.js';
import { processPlayerDataResponse } from '../../services/serverResponseHandler.js';
import { sanitizeHTML, showAlert, showConfirm } from '../../ui/noticeModal.js';

const safeRaf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 0);

/**
 * Initializes Page 2 profile management event listeners (Tag input, fetch, delete, preview tabs, guest mode).
 *
 * @param {HTMLElement} modal - The Welcome modal root element.
 * @param {HTMLElement|null} carousel - The Welcome modal carousel element.
 */
export function initializeWelcomeProfilesInputs(modal, carousel) {
    if (!modal) return;

    const input = document.getElementById('welcome-player-tag-input');
    const errorMsg = document.getElementById('welcome-player-tag-error');
    const loadProfileBtn = document.getElementById('welcome-load-btn');
    const guestBtn = document.getElementById('welcome-guest-btn');
    const deleteBtn = document.getElementById('welcome-profile-delete-btn');
    const previewContainer = document.getElementById('welcome-profile-preview-container');

    const tabBtnInfo = document.getElementById('welcome-tab-btn-info');
    const tabBtnEquipment = document.getElementById('welcome-tab-btn-equipment');
    const tabContentInfo = document.getElementById('welcome-tab-content-info');
    const tabContentEquipment = document.getElementById('welcome-tab-content-equipment');

    if (tabBtnInfo && tabBtnEquipment && tabContentInfo && tabContentEquipment) {
        tabBtnInfo.addEventListener('click', (e) => {
            e.preventDefault();
            tabBtnInfo.classList.add('active');
            tabBtnEquipment.classList.remove('active');
            tabContentInfo.style.display = 'block';
            tabContentEquipment.style.display = 'none';
        });

        tabBtnEquipment.addEventListener('click', (e) => {
            e.preventDefault();
            tabBtnEquipment.classList.add('active');
            tabBtnInfo.classList.remove('active');
            tabContentEquipment.style.display = 'block';
            tabContentInfo.style.display = 'none';
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const activeTag = state.savedPlayerTags[0];
            if (!activeTag || activeTag === 'DEFAULT0') return;

            const validSavedTags = state.savedPlayerTags.filter(t => t !== 'DEFAULT0');
            if (validSavedTags.length <= 1) {
                await showAlert(
                    translate('alerts.cannotDeleteLastProfile'),
                    'status.info'
                );
                return;
            }

            const confirmed = await showConfirm(
                translate('confirms.deleteProfile')
            );
            if (!confirmed) return;

            removePlayerTag(activeTag);
            welcomeState.welcomeProfilesOrder = welcomeState.welcomeProfilesOrder.filter(t => t !== activeTag);

            renderWelcomeProfilesList(welcomeState.updatingProfiles, welcomeState.errorProfiles);
            renderVerticalProfilesList();
            updateWelcomeContinueButtonText(welcomeState.currentPage);
            updateHeaderSkipButtonVisibility();

            const nextTag = state.savedPlayerTags[0];
            if (nextTag) {
                const el = document.querySelector(`.welcome-profile-card-compact[data-tag="${nextTag}"]`);
                if (el) {
                    el.click();
                } else {
                    const activePlayer = state.allPlayersData[nextTag];
                    if (activePlayer && (activePlayer.playerProfile || activePlayer.playerData)) {
                        renderProfilePreviewCard(activePlayer.playerProfile || activePlayer.playerData);
                        welcomeState.isProfileLoaded = true;
                    } else {
                        if (previewContainer) previewContainer.style.display = 'none';
                        welcomeState.isProfileLoaded = false;
                    }
                }
            } else {
                if (previewContainer) previewContainer.style.display = 'none';
                welcomeState.isProfileLoaded = false;
            }

            updateWelcomePage2Buttons();
            updateWelcomeSyncState();
        });
    }

    if (input) {
        input.addEventListener('input', () => {
            input.value = input.value.toUpperCase();
            if (previewContainer) previewContainer.style.display = 'none';
            welcomeState.isProfileLoaded = false;

            updateWelcomePage2Buttons();
            validatePlayerTagInput(input, errorMsg);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (loadProfileBtn) {
                    loadProfileBtn.click();
                }
            }
        });
    }

    const handleLoadProfile = async () => {
        const { cleanedTag, isValid } = validatePlayerTagInput(input, errorMsg);
        if (isValid && cleanedTag) {
            const originalText = loadProfileBtn.textContent;
            try {
                loadProfileBtn.disabled = true;
                welcomeState.isInputProfileLoading = true;
                updateContinueButtonDisabledState();
                loadProfileBtn.textContent = translate('actions.loading');
                if (errorMsg) {
                    errorMsg.textContent = '';
                    errorMsg.classList.remove('show');
                }
                input.classList.remove('input-error');

                const playerData = await fetchPlayerData(cleanedTag);
                if (playerData && playerData.tag) {
                    input.value = '';
                    processPlayerDataResponse(playerData);
                    const tagKey = playerData.tag.startsWith('#') ? playerData.tag.substring(1) : playerData.tag;

                    handleStateUpdate(() => {
                        const playerObj = state.allPlayersData[tagKey];
                        if (playerObj) {
                            applyChecklistToProfile(playerObj);
                        }
                    }, true);

                    welcomeState.successProfiles[tagKey] = true;
                    welcomeState.updatingProfiles[tagKey] = false;
                    delete welcomeState.errorProfiles[tagKey];

                    welcomeState.welcomeProfilesOrder = [...state.savedPlayerTags];
                    renderWelcomeProfilesList(welcomeState.updatingProfiles, welcomeState.errorProfiles);
                    setTimeout(() => {
                        const el = document.querySelector(`.welcome-profile-card-compact[data-tag="${tagKey}"]`);
                        if (el) el.click();
                    }, 50);
                    welcomeState.isProfileLoaded = true;
                    updateWelcomePage2Buttons();
                    updateWelcomeSyncState();
                } else {
                    throw new Error('errors.invalidServerData');
                }
            } catch (err) {
                logger.error('Failed to load player preview data:', err);
                let errKey = err.message;
                if (err.name === 'TypeError' || errKey === 'Failed to fetch' || (typeof errKey === 'string' && errKey.includes('Failed to fetch'))) {
                    errKey = 'apiErrors.serverOffline';
                }
                const transMsg = translate(errKey);
                errorMsg.innerHTML = sanitizeHTML(translate('errors.fetchPlayerFailed', { error: transMsg }));
                errorMsg.classList.add('show');
                input.classList.add('input-error');
                input.classList.remove('shake');
                void input.offsetWidth;
                input.classList.add('shake');
                welcomeState.isProfileLoaded = false;
            } finally {
                loadProfileBtn.disabled = false;
                welcomeState.isInputProfileLoading = false;
                updateContinueButtonDisabledState();
                loadProfileBtn.textContent = originalText;
            }
        }
    };

    if (loadProfileBtn) {
        loadProfileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleLoadProfile();
        });
    }

    if (guestBtn) {
        guestBtn.addEventListener('click', () => {
            if (document.activeElement && typeof document.activeElement.blur === 'function') {
                document.activeElement.blur();
            }
            if (!state.savedPlayerTags.includes('DEFAULT0')) {
                const guestPlayerData = generateGuestPlayerData(welcomeState.selectedTH, welcomeState.selectedLeague);
                const guestPlayerState = {
                    ...getDefaultPlayerState(),
                    playerProfile: guestPlayerData,
                    onboardingTimestamp: null
                };
                initializeGuestHeroesState(guestPlayerState);

                handleStateUpdate(() => {
                    updateSavedPlayerTags('DEFAULT0');
                    state.allPlayersData['DEFAULT0'] = guestPlayerState;
                }, true);
            }

            switchActivePlayer('DEFAULT0');
            welcomeState.isProfileLoaded = true;

            renderVerticalProfilesList();
            updateWelcomeSyncState();

            if (carousel) {
                welcomeState.scrollTargetPage = 3;
                const visualIndex = getVisualIndexFromPage(3);
                carousel.scrollTo({ left: visualIndex * carousel.clientWidth, behavior: 'smooth' });
            }

            const isGuestComplete = isProfileOnboarded(state.allPlayersData['DEFAULT0']);
            if (!isGuestComplete) {
                setTimeout(() => {
                    openSetupWizard('DEFAULT0', getWizardCallbacks());
                }, 350);
            }
        });
    }

    const verticalProfilesList = document.getElementById('welcome-vertical-profiles-list');
    if (verticalProfilesList) {
        verticalProfilesList.addEventListener('click', (e) => {
            const card = e.target.closest('.welcome-profile-card-vertical');
            if (!card) return;
            const tag = card.dataset.tag;
            if (tag) {
                openSetupWizard(tag, getWizardCallbacks());
            }
        });
        verticalProfilesList.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const card = e.target.closest('.welcome-profile-card-vertical');
                if (card) {
                    e.preventDefault();
                    card.click();
                }
            }
        });
    }

    document.addEventListener('welcome:profiles-updated', () => {
        renderWelcomeProfilesList(welcomeState.updatingProfiles, welcomeState.errorProfiles);
        updateContinueButtonDisabledState();
    });
}
