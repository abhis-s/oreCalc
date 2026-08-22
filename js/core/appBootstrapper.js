import { currencyData } from '../data/pricingData.js';
import { loadTranslations } from '../i18n/translator.js';
import { updateUIWithTranslations } from '../i18n/uiTranslator.js';

import { isInterruptionRestricted, triggerPendingModals } from './appEventInterceptors.js';
import { recalculateAll } from './calculator.js';
import { renderApp } from './renderer.js';
import { EFFECTIVE_DATE_PRIVACY, EFFECTIVE_DATE_TERMS, state } from './state.js';
import { applyThemeSettings } from './themeManager.js';

import { autoPlaceIncomeChipsForRange } from '../utils/autoPlaceChips.js';
import { checkAndGenerateRecurringChips } from '../utils/chipManager.js';
import { getMaxDate, getMinDate } from '../utils/dateUtils.js';
import { validateAllInputs, validateAllSelects } from '../utils/inputValidator.js';
import { logger } from '../utils/logger.js';
import { initializeModalHistoryManager } from '../utils/modalHistoryManager.js';
import { updateResponsiveText } from '../utils/responsiveTextHandler.js';
import { finishTopProgressBar, startTopProgressBar } from '../utils/topProgressBar.js';
import { initializeViewportHandler } from '../utils/viewportHandler.js';

import { initializeAppSettings } from '../components/appSettings/appSettings.js';
import { initializeChangelogModal } from '../components/changelog/changelogModal.js';
import { initializeCommitsModal } from '../components/changelog/commitsModal.js';
import { initializeHeroCards } from '../components/equipment/heroCard.js';
import { initializeStorageInputs } from '../components/equipment/storageInputs.js';
import { initializeFab } from '../components/fab/fab.js';
import { initializeClanWarInputs } from '../components/income/clanWarInputs.js';
import { initializeCwlInputs } from '../components/income/cwlInputs.js';
import { initializeEventPassInputs } from '../components/income/eventPassInputs.js';
import { initializeEventTrader } from '../components/income/eventTraderInputs.js';
import { initializeGemTrader } from '../components/income/gemTraderInputs.js';
import { initializeIncomeCardHandler } from '../components/income/incomeCardHandler.js';
import { initializeProspector } from '../components/income/prospectorInputs.js';
import { initializeRaidMedalTrader } from '../components/income/raidMedalTraderInputs.js';
import { initializeShopOffers } from '../components/income/shopOffersInputs.js';
import { initializeStarBonusSelector } from '../components/income/starBonusInputs.js';
import { initializeSupercellEventsInputs } from '../components/income/supercellEventsInputs.js';
import { initializeHeader } from '../components/layout/header.js';
import { initializeNavGlideController } from '../components/layout/navGlideController.js';
import { initializeNavigation } from '../components/layout/navigation.js';
import { initializePullToRefresh } from '../components/layout/pullToRefresh.js';
import { initializeTabs } from '../components/layout/tabs.js';
import { initializePlanner } from '../components/planner/planner.js';
import { initializePriorityListModal } from '../components/planner/priorityListModal.js';
import { initializePlayerDropdown } from '../components/player/playerDropdown.js';
import { initializePlayerModal, showAddPlayerModal } from '../components/player/playerModal.js';
import { initializeWelcomeModal } from '../components/welcome/welcomeModal.js';
import { dom } from '../dom/domElements.js';
import { checkLegalConsent } from '../services/consentManager.js';
import { initializeGlobalHaptics } from '../services/hapticService.js';
import { applyCardLayout, initCardLayoutManager } from '../ui/cardLayoutManager.js';

/**
 * Detects currency from browser navigator languages if not explicitly configured.
 */
function autoDetectCurrency() {
    if (state.uiSettings.currency && state.uiSettings.currency.code) return;

    const userLangs = navigator.languages || [navigator.language];
    let detectedCurrency = 'USD';
    const enabledCurrencies = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CHF', 'NZD', 'TRY', 'CNY'];

    for (const l of userLangs) {
        if (l.startsWith('de') || l.startsWith('fr') || l.startsWith('it') || l.startsWith('es') || l.startsWith('nl')) {
            detectedCurrency = 'EUR';
            break;
        }
        if (l.startsWith('tr')) {
            detectedCurrency = 'TRY';
            break;
        }
        if (l.startsWith('zh')) {
            detectedCurrency = 'CNY';
            break;
        }
    }

    if (!enabledCurrencies.includes(detectedCurrency)) {
        detectedCurrency = 'USD';
    }

    if (currencyData[detectedCurrency]) {
        state.uiSettings.currency = {
            code: detectedCurrency
        };
    }
}

/**
 * Initializes all UI components, binds events, and executes initial domain calculations.
 * @param {string} initialLang
 */
export async function bootstrapUIComponents(initialLang) {
    try {
        await loadTranslations('en');
        if (initialLang !== 'en') {
            await loadTranslations(initialLang);
        }
    } catch (e) {
        console.error('Failed loading initial translations:', e);
    }
    state.uiSettings.language = initialLang;

    autoDetectCurrency();

    applyThemeSettings(state.uiSettings.theme || 'dark', state.uiSettings.accentColor || 'random');
    updateUIWithTranslations(true);
    updateResponsiveText();

    if (state.planner?.calendar) {
        try {
            const { month: MIN_MONTH, year: MIN_YEAR } = getMinDate();
            const { month: MAX_MONTH, year: MAX_YEAR } = getMaxDate();
            autoPlaceIncomeChipsForRange(MIN_MONTH, MIN_YEAR, MAX_MONTH, MAX_YEAR, true);
            state.planner.calendar.isHydrated = true;
        } catch (err) {
            logger.warn('Failed to auto-place income chips on startup:', err);
        }
    }
    try {
        recalculateAll(state);
    } catch (err) {
        logger.error('Failed to recalculate domain state on startup:', err);
    }
    try {
        checkAndGenerateRecurringChips();
    } catch (err) {
        logger.warn('Failed to check and generate recurring chips on startup:', err);
    }

    initializeHeader();
    initializePullToRefresh();
    initializeGlobalHaptics();
    initializeViewportHandler();
    initializeTabs();
    initializeNavGlideController();
    initializeNavigation();
    initializeModalHistoryManager();
    initializeStorageInputs();
    initializeHeroCards(state.heroes, state.uiSettings, state.planner);
    initializePlayerDropdown();
    initializePlayerModal();
    initializeWelcomeModal();
    initializeFab();
    initializeAppSettings();
    initializePlanner();
    initializePriorityListModal();
    initializeChangelogModal();
    initializeCommitsModal();
    initializeStarBonusSelector();
    initializeClanWarInputs();
    initializeCwlInputs();
    initializeEventPassInputs();
    initializeRaidMedalTrader();
    initializeGemTrader();
    initializeEventTrader();
    initializeShopOffers();
    initializeSupercellEventsInputs();
    initializeProspector();
    initializeIncomeCardHandler();
    initCardLayoutManager();

    let layoutMode = state.uiSettings.cardLayout;
    if (layoutMode === 'quilt') {
        layoutMode = 'compact0';
        state.uiSettings.cardLayout = 'compact0';
    }
    applyCardLayout(layoutMode || 'cozy', false, false);

    import('../utils/cloudSaveHandler.js').then(module => {
        module.initializeCloudSaveButtons();
    });

    validateAllInputs();
    validateAllSelects();

    renderApp(state);

    const notices = document.querySelectorAll('.supercell-notice, .app-copyright');
    notices.forEach(notice => notice.classList.add('show'));

    const refreshButton = dom.controls.refreshButton;
    if (refreshButton) {
        refreshButton.addEventListener('click', async () => {
            const activeTag = state.savedPlayerTags[0];
            if (activeTag && activeTag !== 'DEFAULT0') {
                try {
                    startTopProgressBar();
                    refreshButton.classList.add('saving');
                    const { loadAndProcessPlayerData } = await import('../services/serverResponseHandler.js');
                    const result = await loadAndProcessPlayerData(activeTag, { updateOrder: false });

                    refreshButton.classList.remove('saving');
                    finishTopProgressBar();
                    if (result.success) {
                        refreshButton.classList.add('success');
                        setTimeout(() => refreshButton.classList.remove('success'), 2000);
                    } else {
                        refreshButton.classList.add('error');
                        setTimeout(() => refreshButton.classList.remove('error'), 3000);
                        if (result.errorType === 'apiErrors.protectedTag') {
                            showAddPlayerModal(activeTag, true);
                        }
                    }
                } catch (error) {
                    finishTopProgressBar();
                    if (window.handleChunkError && window.handleChunkError(error)) return;
                    logger.error('Refresh failed:', error);
                    refreshButton.classList.remove('saving');
                    refreshButton.classList.add('error');
                    setTimeout(() => refreshButton.classList.remove('error'), 3000);
                }
            }
        });

        const activeTag = state.savedPlayerTags[0];
        if (activeTag && activeTag !== 'DEFAULT0') {
            refreshButton.click();
        }
    }
    checkLegalConsent();
}

/**
 * Handles preloader dismiss animation and triggers guided tour or pending modals.
 * @param {HTMLElement|null} preloader
 */
export function handlePreloaderTeardown(preloader) {
    if (preloader) {
        setTimeout(() => {
            preloader.classList.add('hidden');
            setTimeout(() => {
                preloader.style.display = 'none';
                if (typeof window.__APP_LOADED__ === 'function') {
                    window.__APP_LOADED__();
                }

                const welcomeTimestamp = state.uiSettings?.uiTimestamps?.welcome;
                const tourTimestamp = state.uiSettings?.uiTimestamps?.tour;
                const privacyTimestamp = state.uiSettings?.uiTimestamps?.privacy;
                const tosTimestamp = state.uiSettings?.uiTimestamps?.tos;

                const needsPrivacy = !privacyTimestamp || privacyTimestamp < EFFECTIVE_DATE_PRIVACY;
                const needsTerms = !tosTimestamp || tosTimestamp < EFFECTIVE_DATE_TERMS;
                const hasPendingConsent = needsPrivacy || needsTerms;

                if (welcomeTimestamp && !hasPendingConsent) {
                    window.isTourPending = true;
                    setTimeout(() => {
                        import('../components/tour/appTour.js').then(module => {
                            module.startTour().then(started => {
                                window.isAppStartingUp = false;
                                if (!started) {
                                    window.isTourPending = false;
                                    triggerPendingModals();
                                }
                            });
                        });
                    }, 800);
                } else {
                    window.isAppStartingUp = false;
                    triggerPendingModals();
                }
            }, 600);

            if (state.activeTab === 'planner-tab') {
                import('../components/planner/calendar.js').then(module => {
                    module.setAnimateNextRender('all', 0.6);
                    renderApp(state);
                });
            }
        }, 2100);
    } else {
        if (typeof window.__APP_LOADED__ === 'function') {
            window.__APP_LOADED__();
        }
    }
}
