import { enabledLanguages } from '../../data/languagesData.js';
import { translate } from '../../i18n/translator.js';

import {
    EFFECTIVE_DATE_PRIVACY,
    EFFECTIVE_DATE_PROFILE_ONBOARDING,
    EFFECTIVE_DATE_TERMS,
    EFFECTIVE_DATE_WELCOME,
    state
} from '../../core/state.js';
import { handleStateUpdate, switchActivePlayer } from '../../core/stateManager.js';

import { hideCardHelpPopover } from '../../utils/cardHelpPopover.js';
import { isValidUUID } from '../../utils/uuidGenerator.js';

import { dom } from '../../dom/domElements.js';
import { navigateToTab } from '../layout/tabs.js';
import { closeStoredOresModal } from '../planner/priorityListModal.js';
import { initializeWelcomeAppearanceInputs } from './welcomeAppearanceInputs.js';
import {
    getVisualIndexFromPage,
    measureHeaderHeight,
    syncWelcomeInertState,
    updateHeaderMinimizedState,
    updateLoadProfileButtonText,
    updatePagination,
    updateWelcomeContinueButtonText
} from './welcomeCarouselDisplay.js';
import { initializeWelcomeCarouselInputs } from './welcomeCarouselInputs.js';
import {
    updateSavedProfilesSequentially,
    welcomeState
} from './welcomeModalState.js';
import { renderWelcomeProfilesList } from './welcomeProfileCardRenderer.js';
import { renderProfilePreviewCard } from './welcomeProfileDisplay.js';
import { initializeWelcomeProfilesInputs } from './welcomeProfilesInputs.js';
import { syncWelcomeQuickSettings } from './welcomeSettingsDisplay.js';
import { initializeWelcomeSettingsInputs } from './welcomeSettingsInputs.js';
import { updateWelcomeSyncState } from './welcomeSyncDisplay.js';
import { initializeWelcomeSyncInputs } from './welcomeSyncInputs.js';
import {
    getWizardCallbacks,
    initializeGuestSetup,
    initializeWizardNavigation
} from './welcomeWizardInputs.js';
import { openSetupWizard } from './welcomeWizardState.js';

const safeRaf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 0);

let isWelcomeModalInitialized = false;

/**
 * @typedef {Object} WelcomeModalOptions
 * @property {number} [startPage] - Starting page number (1..4).
 * @property {string|null} [startTag] - Starting player tag.
 * @property {boolean} [openWizard] - Whether to automatically open the setup wizard.
 * @property {'onboarding'|'playerModal'|'inApp'} [entrySource] - Entry source identifier.
 */

/**
 * Displays or closes the Welcome Onboarding & Setup Modal.
 *
 * @param {boolean} isVisible - Whether to display or close the modal dialog.
 * @param {WelcomeModalOptions|string|null} [options=null] - Configuration options or legacy player tag string.
 */
export function showWelcomeModal(isVisible, options = null) {
    const modal = document.getElementById('welcome-modal');
    if (!modal) return;

    if (isVisible) {
        let startPage = 1;
        let startTag = null;
        let openWizard = false;
        let entrySource = 'onboarding';

        if (typeof options === 'string') {
            startTag = options;
        } else if (options && typeof options === 'object') {
            if (typeof options.startPage === 'number') startPage = options.startPage;
            if (options.startTag) startTag = options.startTag;
            if (options.openWizard) openWizard = Boolean(options.openWizard);
            if (options.entrySource) entrySource = options.entrySource;
        }

        hideCardHelpPopover();
        if (typeof modal.showModal === 'function' && !modal.open) {
            try {
                modal.showModal();
            } catch (e) {}
        }
        modal.classList.add('show');
        if (dom.overlay) dom.overlay.classList.add('show');

        welcomeState.entrySource = entrySource;
        welcomeState.currentPage = startPage;
        welcomeState.cameFromSyncStartBtn = false;
        welcomeState.scrollTargetPage = null;

        const carousel = document.getElementById('welcome-carousel');
        if (carousel) {
            const visualIndex = getVisualIndexFromPage(startPage);
            carousel.scrollLeft = visualIndex * carousel.clientWidth;
        }
        updateHeaderMinimizedState(startPage > 1);

        measureHeaderHeight();

        const recommendationsSwitch = document.getElementById('welcome-pref-recommendations');
        if (recommendationsSwitch) {
            recommendationsSwitch.checked = true;
        }
        const wizardView = document.getElementById('welcome-profile-setup-wizard-view');
        if (wizardView) {
            wizardView.classList.add('show-recommendations');
        }

        const currentLang = state.uiSettings.language || 'en';
        const currentTheme = state.uiSettings.theme || 'dark';

        const langSelect = modal.querySelector('#welcome-language-select');
        if (langSelect) {
            langSelect.innerHTML = '';
            enabledLanguages.forEach(lang => {
                const option = document.createElement('option');
                option.value = lang.code;
                const name = lang.nativeName || lang.fallbackName;
                const flag = lang.flag ? `${lang.flag} ` : '';
                option.textContent = `${flag}${name}`;
                if (lang.code === currentLang) {
                    option.selected = true;
                }
                langSelect.appendChild(option);
            });
            langSelect.value = currentLang;
        }

        const themeSwitch = modal.querySelector('.theme-switch');
        if (themeSwitch) {
            themeSwitch.setAttribute('data-active-index', currentTheme === 'dark' ? '0' : '1');
        }

        modal.querySelectorAll('.theme-switch .pref-btn').forEach(btn => {
            if (btn.getAttribute('data-theme') === currentTheme) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        const currentAccent = state.uiSettings.accentColor || 'random';
        modal.querySelectorAll('#welcome-accent-picker .accent-swatch').forEach(swatch => {
            swatch.classList.toggle('active', swatch.dataset.color === currentAccent);
        });

        const savedPlayers = state.savedPlayerTags.filter(tag => tag !== 'DEFAULT0');
        if (savedPlayers.length > 0) {
            welcomeState.welcomeProfilesOrder = [...state.savedPlayerTags];
            const firstDisplayTag = welcomeState.welcomeProfilesOrder.find(tag => tag !== 'DEFAULT0') || savedPlayers[0];
            renderWelcomeProfilesList();

            switchActivePlayer(firstDisplayTag);
            const activePlayer = state.allPlayersData[firstDisplayTag];
            if (activePlayer && (activePlayer.playerProfile || activePlayer.playerData)) {
                renderProfilePreviewCard(activePlayer.playerProfile || activePlayer.playerData);
                welcomeState.isProfileLoaded = true;
            }
            syncWelcomeQuickSettings(firstDisplayTag);

            updateSavedProfilesSequentially();
        } else {
            const listContainer = document.getElementById('welcome-profiles-list-container');
            if (listContainer) listContainer.style.display = 'none';
            const previewContainer = document.getElementById('welcome-profile-preview-container');
            if (previewContainer) previewContainer.style.display = 'none';
            welcomeState.isProfileLoaded = false;
            syncWelcomeQuickSettings(null);
            updateLoadProfileButtonText();
        }

        if (startPage === 1 && state.savedPlayerTags && state.savedPlayerTags.length > 0) {
            welcomeState.currentPage = 2;
            startPage = 2;
            if (carousel) {
                const visualIndex = getVisualIndexFromPage(2);
                carousel.scrollLeft = visualIndex * carousel.clientWidth;
            }
            updateHeaderMinimizedState(true);
        }

        updatePagination(startPage, true);

        if (openWizard && startTag) {
            openSetupWizard(startTag, getWizardCallbacks());
        }

        if (!isWelcomeModalInitialized) {
            initializeWelcomeModal();
        }
    } else {
        welcomeState.entrySource = 'onboarding';
        welcomeState.activeWizardTag = null;
        modal.classList.remove('show');
        if (typeof modal.close === 'function' && modal.open) {
            try {
                modal.close();
            } catch (e) {}
        }
        const visibleModals = document.querySelectorAll('.modal.show, dialog.modal[open]');
        if (visibleModals.length === 0 && dom.overlay) {
            dom.overlay.classList.remove('show');
        }
        navigateToTab('home', { resetScroll: true });
        if (typeof document.dispatchEvent === 'function') {
            document.dispatchEvent(new CustomEvent('welcome:close'));
        }

        import('../../utils/autoPlaceChips.js').then(({ autoPlaceIncomeChipsForRange }) => {
            import('../../utils/dateUtils.js').then(({ getMinDate, getMaxDate }) => {
                const { month: MIN_MONTH, year: MIN_YEAR } = getMinDate();
                const { month: MAX_MONTH, year: MAX_YEAR } = getMaxDate();

                const originalPlanner = state.planner;
                const originalHeroes = state.heroes;
                const originalIncome = state.income;
                const originalProfile = state.playerProfile;

                state.savedPlayerTags.forEach(tag => {
                    const player = state.allPlayersData[tag];
                    if (player) {
                        state.planner = player.planner;
                        state.heroes = player.heroes;
                        state.income = player.income;
                        state.playerProfile = player.playerProfile;

                        autoPlaceIncomeChipsForRange(MIN_MONTH, MIN_YEAR, MAX_MONTH, MAX_YEAR, true);
                        if (player.planner?.calendar) {
                            player.planner.calendar.isHydrated = true;
                        }
                    }
                });

                state.planner = originalPlanner;
                state.heroes = originalHeroes;
                state.income = originalIncome;
                state.playerProfile = originalProfile;
            });
        });
    }
}

/**
 * Initializes Welcome Modal event listeners, swipe gestures, carousel bindings, and sync workflows.
 */
export function initializeWelcomeModal() {
    if (isWelcomeModalInitialized) return;
    isWelcomeModalInitialized = true;

    const modal = document.getElementById('welcome-modal');
    if (!modal) return;

    const carousel = document.getElementById('welcome-carousel');
    const submitBtn = document.getElementById('welcome-submit-btn');

    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            const welcomeSyncInput = document.getElementById('welcome-sync-input');
            const val = welcomeSyncInput ? welcomeSyncInput.value.trim() : '';
            const currentUserId = localStorage.getItem('oreCalc_userId');

            if (welcomeState.cameFromSyncStartBtn && isValidUUID(val) && val !== currentUserId) {
                const originalText = submitBtn.textContent;
                try {
                    submitBtn.disabled = true;
                    submitBtn.textContent = translate('actions.processing');

                    const { importUserData } = await import('../../services/cloudSaveService.js');
                    await importUserData(val);
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                }
                return;
            }

            handleStateUpdate(() => {
                const now = Date.now();
                if (!state.uiSettings.uiTimestamps) {
                    state.uiSettings.uiTimestamps = {};
                }
                state.uiSettings.uiTimestamps.privacy = Math.max(now, EFFECTIVE_DATE_PRIVACY + 1);
                state.uiSettings.uiTimestamps.tos = Math.max(now, EFFECTIVE_DATE_TERMS + 1);
                state.uiSettings.uiTimestamps.welcome = Math.max(now, EFFECTIVE_DATE_WELCOME + 1);

                for (const tag of state.savedPlayerTags) {
                    const player = state.allPlayersData?.[tag];
                    if (player) {
                        if (!player.storedOres) player.storedOres = {};
                        player.storedOres.lastUpdated = now;
                        if (typeof player.onboardingTimestamp !== 'number') {
                            player.onboardingTimestamp = Math.max(now, EFFECTIVE_DATE_PROFILE_ONBOARDING + 1);
                        }
                    }
                }
            });

            closeStoredOresModal();

            const consentBanner = document.getElementById('consent-banner');
            if (consentBanner) {
                consentBanner.classList.remove('show');
            }

            showWelcomeModal(false);
        });
    }

    // Initialize modular subsystems
    initializeWelcomeCarouselInputs(modal, carousel, () => showWelcomeModal(false));
    initializeWelcomeAppearanceInputs(modal, carousel);
    initializeWelcomeProfilesInputs(modal, carousel);
    initializeWelcomeSettingsInputs(modal);
    initializeWelcomeSyncInputs(modal, carousel);
    initializeGuestSetup();
    initializeWizardNavigation();

    document.addEventListener('app:translate', () => {
        initializeGuestSetup();
        safeRaf(() => {
            measureHeaderHeight();
        });
    });

    const wizardView = document.getElementById('welcome-profile-setup-wizard-view');
    if (wizardView) {
        wizardView.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
        wizardView.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });
        wizardView.addEventListener('touchend', (e) => e.stopPropagation(), { passive: true });
        wizardView.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
    }

    const guestThList = document.getElementById('welcome-guest-th-list');
    if (guestThList) {
        guestThList.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
        guestThList.addEventListener('touchend', (e) => e.stopPropagation(), { passive: true });
    }
}
