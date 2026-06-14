import { showAlert, showConfirm } from './ui/noticeModal.js';

import { dom, initializeDOMElements } from './dom/domElements.js';
import { state, initializeState, EFFECTIVE_DATE_TERMS, EFFECTIVE_DATE_PRIVACY } from './core/state.js';
import { compareVersions } from './core/stateCleanup.js';
import { saveState, loadState, resetState } from './core/localStorageManager.js';
import { renderApp } from './core/renderer.js';
import { recalculateAll } from './core/calculator.js';
import { registerStateUpdateCallback } from './core/stateManager.js';

import { initializeHeader } from './components/layout/header.js';
import { initializeTabs } from './components/layout/tabs.js';
import { initializeNavigation } from './components/layout/navigation.js';
import { initializeStorageInputs } from './components/equipment/storageInputs.js';
import { initializeHeroCards } from './components/equipment/heroCard.js';
import { initializePlayerDropdown } from './components/player/playerDropdown.js';
import { initializePlayerModal, showAddPlayerModal } from './components/player/playerModal.js';
import { initializeFab } from './components/fab/fab.js';
import { initializeAppSettings, openTermsOfUseModal, openPrivacyModal } from './components/appSettings/appSettings.js';
import { initializePlanner } from './components/planner/planner.js';
import { initializePriorityListModal } from './components/planner/priorityListModal.js';
import { initializeChangelogModal, showChangelogModal } from './components/changelog/changelogModal.js';
import { initializeCommitsModal, showCommitsModal } from './components/changelog/commitsModal.js';

import { initializeStarBonusSelector } from './components/income/starBonusInputs.js';
import { initializeClanWarInputs } from './components/income/clanWarInputs.js';
import { initializeCwlInputs } from './components/income/cwlInputs.js';
import { initializeEventPassInputs } from './components/income/eventPassInputs.js';
import { initializeRaidMedalTrader } from './components/income/raidMedalTraderInputs.js';
import { initializeGemTrader } from './components/income/gemTraderInputs.js';
import { initializeEventTrader } from './components/income/eventTraderInputs.js';
import { initializeShopOffers } from './components/income/shopOffersInputs.js';
import { initializeSupercellEventsInputs } from './components/income/supercellEventsInputs.js';
import { initializeProspector } from './components/income/prospectorInputs.js';

import { initializeIncomeCardHandler } from './components/income/incomeCardHandler.js';
import { updateResponsiveText } from './utils/responsiveTextHandler.js';
import { validateAllInputs, validateAllSelects } from './utils/inputValidator.js';

import { loadTranslations, translate } from './i18n/translator.js';
import { getChangelogHtml } from './services/changelogService.js';
import { currencyData } from './data/appData.js';
import { checkAndGenerateRecurringChips } from './utils/chipManager.js';

import './console.js';
import './utils/svgManager.js';
import { logger } from './utils/logger.js';

// Register global error boundaries immediately
window.addEventListener('error', (event) => {
    logger.error('Uncaught error:', event.error || event.message);
    if (!window.__APP_LOADED_STATUS__) return;
    showAlert(translate('errors.unexpectedError') || 'An unexpected error occurred. Please reload the page.', 'errors.errorTitle');
});

window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection:', event.reason);
    if (!window.__APP_LOADED_STATUS__) return;
    showAlert(translate('errors.unexpectedError') || 'An unexpected error occurred. Please reload the page.', 'errors.errorTitle');
});

// Global modal focus manager for accessibility & usability
function setupModalFocusManager() {
    const activeListeners = new Map();

    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                if (target.classList.contains('modal')) {
                    if (target.classList.contains('show')) {
                        // Save the element that currently has focus
                        if (document.activeElement && document.activeElement !== document.body && document.activeElement !== target) {
                            target._previouslyFocusedElement = document.activeElement;
                        }

                        // Ensure the modal container itself can be focused
                        if (!target.hasAttribute('tabindex')) {
                            target.setAttribute('tabindex', '-1');
                        }

                        setTimeout(() => {
                            const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
                            const focusableElements = Array.from(target.querySelectorAll(focusableSelector))
                                .filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0);

                            let firstFocusable = focusableElements.find(el => !el.closest('.modal-header')) || focusableElements[0];

                            if (firstFocusable) {
                                firstFocusable.focus();
                            } else {
                                target.focus();
                            }

                            // Trap focus inside the modal
                            const handleKeyDown = (e) => {
                                if (e.key !== 'Tab') return;

                                const currentFocusables = Array.from(target.querySelectorAll(focusableSelector))
                                    .filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0);

                                if (currentFocusables.length === 0) {
                                    e.preventDefault();
                                    target.focus();
                                    return;
                                }

                                const first = currentFocusables[0];
                                const last = currentFocusables[currentFocusables.length - 1];

                                if (e.shiftKey) {
                                    // Shift + Tab: wrap from first to last
                                    if (document.activeElement === first || document.activeElement === target) {
                                        e.preventDefault();
                                        last.focus();
                                    }
                                } else {
                                    // Tab: wrap from last to first
                                    if (document.activeElement === last) {
                                        e.preventDefault();
                                        first.focus();
                                    }
                                }
                            };

                            target.addEventListener('keydown', handleKeyDown);
                            activeListeners.set(target, handleKeyDown);
                        }, 50);
                    } else {
                        // Remove keydown listener
                        const listener = activeListeners.get(target);
                        if (listener) {
                            target.removeEventListener('keydown', listener);
                            activeListeners.delete(target);
                        }

                        // Restore focus to the previously focused element
                        setTimeout(() => {
                            if (target._previouslyFocusedElement && typeof target._previouslyFocusedElement.focus === 'function') {
                                target._previouslyFocusedElement.focus();
                            }
                            delete target._previouslyFocusedElement;
                        }, 50);
                    }
                }
            }
        }
    });

    observer.observe(document.body, {
        attributes: true,
        subtree: true,
        attributeFilter: ['class']
    });
}

import './utils/imageManager.js';

let userId = localStorage.getItem('oreCalcUserId');

let sessionRandomAccent = null;
const availableAccents = ['blue', 'gold', 'purple', 'green', 'red'];

export function updateUIWithTranslations(isInitialLoad = false) {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const argsAttr = element.getAttribute('data-i18n-args');
        let args = {};
        if (argsAttr) {
            try {
                args = JSON.parse(argsAttr);
            } catch (e) {
                console.error('Failed to parse i18n args:', argsAttr, e);
            }
        }

        if (key === 'settings.bugReportPrivacyInfo') {
            const privacyText = translate('settings.privacyPolicyText');
            args.link = `<a href="#" id="bug-report-privacy-link" class="theme-link">${privacyText}</a>`;
        }

        let translatedName = translate(key, args);
        if (key === 'settings.options.userId') {
            const currentUserId = localStorage.getItem('oreCalcUserId');
            const maskedId = currentUserId ? (currentUserId.length > 8 ? currentUserId.substring(0, 8) + '...' : currentUserId) : '********';
            translatedName = `${translatedName}: ${maskedId}`;
            if (currentUserId) {
                element.dataset.fullId = currentUserId;
            }
        }

        // 1. If translation contains HTML tags (like <a>, <b>, etc.)
        // we must use innerHTML to render it correctly.
        if (translatedName.includes('<') && translatedName.includes('>')) {
            element.innerHTML = translatedName;
            return;
        }

        // 2. Surgical update: If the element has children (like icons), 
        // find the first text node and update only that.
        let updated = false;
        for (const child of element.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                child.textContent = translatedName;
                updated = true;
                break;
            }
        }

        // 3. Fallback: If no text node found, or a simple text container
        if (!updated) {
            element.textContent = translatedName;
        }
    });

    document.querySelectorAll('[data-i18n-alt]').forEach(element => {
        const key = element.getAttribute('data-i18n-alt');
        element.setAttribute('alt', translate(key));
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        element.setAttribute('placeholder', translate(key));
    });

    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        const key = element.getAttribute('data-i18n-title');
        element.setAttribute('title', translate(key));
    });

    document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
        const key = element.getAttribute('data-i18n-aria-label');
        element.setAttribute('aria-label', translate(key));
    });

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) metaDescription.setAttribute('content', translate('app.description'));

    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) ogDescription.setAttribute('content', translate('app.description'));

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', translate('app.title'));

    // Skip applyThemeSettings during initial load as it's already handled by DOMContentLoaded
    if (!isInitialLoad) {
        applyThemeSettings(state.uiSettings.theme || 'dark', state.uiSettings.accentColor || 'blue');
    }

    document.documentElement.lang = state.uiSettings.language || 'auto';
    document.dispatchEvent(new CustomEvent('languageChanged'));
}

export function applyThemeSettings(theme, accentColor, origin = null) {
    let effectiveAccentColor = accentColor;
    if (accentColor === 'random') {
        if (!sessionRandomAccent || (origin && origin.isSwatchClick)) {
            sessionRandomAccent = availableAccents[Math.floor(Math.random() * availableAccents.length)];
        }
        effectiveAccentColor = sessionRandomAccent;
    }

    const updateThemeProperties = () => {
        if (theme === 'light') {
            document.body.classList.add('light-mode');
            document.body.classList.remove('dark-mode');
            document.documentElement.style.setProperty('color-scheme', 'light');
            document.body.style.setProperty('color-scheme', 'light');
        } else {
            document.body.classList.add('dark-mode');
            document.body.classList.remove('light-mode');
            document.documentElement.style.setProperty('color-scheme', 'dark');
            document.body.style.setProperty('color-scheme', 'dark');
        }

        const palette = {
            blue: {
                dark: {
                    primary: '#8ab4f8', hover: '#aecbfa', soft: 'rgba(138, 180, 248, 0.1)',
                    bgApp: '#0f131a', bgPrimary: '#1a1f2b', bgSecondary: '#252c3d', bgTertiary: '#2e374d'
                },
                light: {
                    primary: '#1a73e8', hover: '#1967d2', soft: 'rgba(26, 115, 232, 0.12)',
                    bgApp: '#f4f8ff', bgPrimary: '#ffffff', bgSecondary: '#e9f2ff', bgTertiary: '#d9e8ff'
                }
            },
            gold: {
                dark: {
                    primary: '#fde293', hover: '#feefc3', soft: 'rgba(253, 226, 147, 0.1)',
                    bgApp: '#1a180f', bgPrimary: '#262215', bgSecondary: '#362f1d', bgTertiary: '#423b1f'
                },
                light: {
                    primary: '#f9ab00', hover: '#f29900', soft: 'rgba(249, 171, 0, 0.12)',
                    bgApp: '#fffbf0', bgPrimary: '#ffffff', bgSecondary: '#fff4e1', bgTertiary: '#ffecd1'
                }
            },
            purple: {
                dark: {
                    primary: '#ce93d8', hover: '#e1bee7', soft: 'rgba(206, 147, 216, 0.1)',
                    bgApp: '#16111a', bgPrimary: '#211a26', bgSecondary: '#2d2236', bgTertiary: '#3b2a47'
                },
                light: {
                    primary: '#9c27b0', hover: '#8e24aa', soft: 'rgba(156, 39, 176, 0.12)',
                    bgApp: '#fbf5ff', bgPrimary: '#ffffff', bgSecondary: '#f3e8ff', bgTertiary: '#ebd9ff'
                }
            },
            green: {
                dark: {
                    primary: '#a8dab5', hover: '#ceead6', soft: 'rgba(168, 218, 181, 0.1)',
                    bgApp: '#0f1a14', bgPrimary: '#16261d', bgSecondary: '#1d3627', bgTertiary: '#264230'
                },
                light: {
                    primary: '#34a853', hover: '#1e8e3e', soft: 'rgba(52, 168, 83, 0.12)',
                    bgApp: '#f0fff4', bgPrimary: '#ffffff', bgSecondary: '#e2fbe9', bgTertiary: '#cff9de'
                }
            },
            red: {
                dark: {
                    primary: '#f8b4ae', hover: '#fad2cf', soft: 'rgba(248, 180, 174, 0.1)',
                    bgApp: '#1a0f0f', bgPrimary: '#261515', bgSecondary: '#361d1d', bgTertiary: '#421f1f'
                },
                light: {
                    primary: '#ee675c', hover: '#ea4335', soft: 'rgba(238, 103, 92, 0.12)',
                    bgApp: '#fff5f5', bgPrimary: '#ffffff', bgSecondary: '#ffe3e3', bgTertiary: '#ffd1d1'
                }
            }
        };

        const themePalette = palette[effectiveAccentColor] || palette.blue;
        const colors = theme === 'light' ? themePalette.light : themePalette.dark;

        const target = document.body;
        target.style.setProperty('--accent-primary', colors.primary);
        target.style.setProperty('--accent-primary-hover', colors.hover);
        target.style.setProperty('--accent-primary-active', colors.primary);
        target.style.setProperty('--accent-primary-soft', colors.soft);
        target.style.setProperty('--accent-hover', colors.hover);
        target.style.setProperty('--accent-soft', colors.soft);

        // Apply accented backgrounds for both modes
        target.style.setProperty('--bg-app', colors.bgApp);
        target.style.setProperty('--bg-surface-primary', colors.bgPrimary);
        target.style.setProperty('--bg-surface-secondary', colors.bgSecondary);
        target.style.setProperty('--bg-surface-tertiary', colors.bgTertiary);
    };

    if (origin && document.startViewTransition) {
        document.documentElement.style.setProperty('--ripple-x', `${origin.x}px`);
        document.documentElement.style.setProperty('--ripple-y', `${origin.y}px`);

        document.documentElement.dataset.transitionType = 'theme-switch';
        document.body.classList.add('no-transition');

        const transition = document.startViewTransition(() => {
            updateThemeProperties();
            renderApp(state);
            document.body.offsetHeight;
        });

        transition.ready.catch(() => { });
        transition.finished.catch(() => { }).finally(() => {
            document.body.classList.remove('no-transition');
            delete document.documentElement.dataset.transitionType;
        });
    } else {
        updateThemeProperties();
        // Skip renderApp here if it's the initial load (checked via origin)
        if (origin === 'manual-toggle') {
            renderApp(state);
        }
    }
}

export function applyTheme(theme, origin = null) {
    applyThemeSettings(theme, state.uiSettings.accentColor || 'blue', origin || 'manual-toggle');
}

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    let userIdFromUrl = urlParams.get('userId');

    if (userIdFromUrl) {
        localStorage.setItem('oreCalcUserId', userIdFromUrl);
        window.history.replaceState({}, document.title, window.location.pathname);
        location.reload();
        return;
    }

    const savedState = loadState();
    const originalVersion = savedState?.appVersion || '1.0.0';
    initializeState(savedState);
    if (savedState && state.appVersion !== originalVersion) {
        logger.log(`Upgraded localStorage state version from ${originalVersion} to ${state.appVersion}`);
        saveState(state, true); // Save immediately to persist version bump
        if (compareVersions(originalVersion, state.appVersion) < 0) {
            setTimeout(() => {
                const content = getChangelogHtml();
                showChangelogModal(content);
            }, 1200);
        } else {
            const commits = window.__ENV__?.COMMITS_SINCE_TAG || [];
            if (commits.length > 0) {
                setTimeout(() => {
                    showCommitsModal(commits);
                }, 1200);
            }
        }
    }

    // Redirect invalid pathnames (404 fallback routing)
    const pathName = window.location.pathname;
    if (pathName !== '/' && pathName !== '/index.html' && pathName !== '/404') {
        window.location.href = '/404';
        return;
    }

    // Sync active tab with location hash on startup to prevent routing mismatch
    if (window.location.hash) {
        const initialTab = `${window.location.hash.substring(1)}-tab`;
        const validTabs = ['home-tab', 'planner-tab', 'equipment-tab', 'income-tab', 'settings-tab'];
        if (validTabs.includes(initialTab)) {
            state.activeTab = initialTab;
        } else {
            window.location.href = '/404';
            return;
        }
    }

    registerStateUpdateCallback((state, silent) => {
        if (!silent) {
            recalculateAll(state);
            renderApp(state);
        }
    });

    // Custom event listeners to decouple components from app.js imports
    document.addEventListener('app:theme-change', (e) => {
        applyTheme(e.detail.theme, e.detail.origin);
    });

    document.addEventListener('app:translate', () => {
        updateUIWithTranslations();
    });

    initializeDOMElements();
    setupModalFocusManager();

    const preloader = dom.preloader;
    if (preloader) {
        let effectivePreloaderAccent = state.uiSettings.accentColor || 'blue';
        if (effectivePreloaderAccent === 'random') {
            if (!sessionRandomAccent) {
                sessionRandomAccent = availableAccents[Math.floor(Math.random() * availableAccents.length)];
            }
            effectivePreloaderAccent = sessionRandomAccent;
        }
        preloader.dataset.accent = effectivePreloaderAccent;

        // Randomize circular positions (slots)
        const dots = preloader.querySelectorAll('.preloader-loader .preloader-dot-wrapper');
        const angles = [0, 72, 144, 216, 288];
        // Fisher-Yates shuffle for better randomness
        for (let i = angles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [angles[i], angles[j]] = [angles[j], angles[i]];
        }
        dots.forEach((dot, i) => {
            dot.style.setProperty('--angle', `${angles[i]}deg`);
        });
    }



    // 1. PERFORM MINIMAL BACKGROUND INIT IMMEDIATELY
    // Only load core translations and non-DOM state
    (async () => {
        await loadTranslations('en');
        if (state.uiSettings.language && state.uiSettings.language !== 'en' && state.uiSettings.language !== 'auto') {
            await loadTranslations(state.uiSettings.language);
        }
    })();

    // 2. DEFER ALL HEAVY RENDERING AND THEME APPLICATION
    // This gives the CPU 2.3s of complete silence to perform the 60fps cinematic sequence.
    // The "hiccup" of rendering happens at 2.3s while the screen is covered by a solid color.
    setTimeout(async () => {
        if (!state.uiSettings.language || state.uiSettings.language === 'auto') {
            const userLangs = navigator.languages || [navigator.language];
            let detectedLang = 'en';

            for (const l of userLangs) {
                if (l.startsWith('de')) { detectedLang = 'de'; break; }
                if (l.startsWith('fr')) { detectedLang = 'fr'; break; }
                if (l.startsWith('it')) { detectedLang = 'it'; break; }
                if (l.startsWith('es')) { detectedLang = 'es'; break; }
                if (l.startsWith('nl')) { detectedLang = 'nl'; break; }
            }
            state.uiSettings.language = detectedLang;
        }

        if (!state.uiSettings.currency || !state.uiSettings.currency.code) {
            const userLangs = navigator.languages || [navigator.language];
            let detectedCurrency = 'USD';
            const enabledCurrencies = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CNY', 'BRL'];

            for (const l of userLangs) {
                if (l.startsWith('de') || l.startsWith('fr') || l.startsWith('it') || l.startsWith('es') || l.startsWith('nl')) {
                    detectedCurrency = 'EUR';
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

        // Apply theme and translate everything in one batch
        applyThemeSettings(state.uiSettings.theme || 'dark', state.uiSettings.accentColor || 'blue', 'manual-toggle');
        updateUIWithTranslations(true);
        updateResponsiveText();

        recalculateAll(state);
        checkAndGenerateRecurringChips();
        renderApp(state);

        // Make footer notices visible after initial tab rendering to prevent layout shifts
        const notices = document.querySelectorAll('.supercell-notice, .app-copyright');
        notices.forEach(notice => notice.classList.add('show'));

        initializeHeader();
        initializeTabs();
        initializeNavigation();
        initializeStorageInputs();
        initializeHeroCards(state.heroes, state.uiSettings, state.planner);
        initializePlayerDropdown();
        initializePlayerModal();
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
        import('./utils/cloudSaveHandler.js').then(module => {
            module.initializeCloudSaveButtons();
        });

        validateAllInputs();
        validateAllSelects();

        const refreshButton = dom.controls.refreshButton;
        if (refreshButton) {
            refreshButton.addEventListener('click', async () => {
                const activeTag = state.savedPlayerTags[0];
                if (activeTag && activeTag !== 'DEFAULT0') {
                    try {
                        refreshButton.classList.add('saving');
                        const { loadAndProcessPlayerData } = await import('./services/serverResponseHandler.js');
                        const result = await loadAndProcessPlayerData(activeTag);

                        refreshButton.classList.remove('saving');
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
                        logger.error("Refresh failed:", error);
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
    }, 100);

    // 3. SYNCHRONIZE PRELOADER REMOVAL
    if (preloader) {
        setTimeout(() => {
            preloader.classList.add('hidden');
            setTimeout(() => {
                preloader.style.display = 'none';
                if (typeof window.__APP_LOADED__ === 'function') {
                    window.__APP_LOADED__();
                }
            }, 600);

            if (state.activeTab === 'planner-tab') {
                import('./components/planner/calendar.js').then(module => {
                    module.setAnimateNextRender('all', 0.6); // 0.6s delay to wait for preloader fade out
                    renderApp(state);

                    const calendar = document.getElementById('calendar-container');
                    if (calendar) {
                        calendar.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                });
            }
        }, 1400); // 1.0s for animation + 0.4s buffer for renderApp
    } else {
        if (typeof window.__APP_LOADED__ === 'function') {
            window.__APP_LOADED__();
        }
    }

    if ('serviceWorker' in navigator && 'workbox' in window) {
        const wb = new workbox.Workbox('/service-worker.js');

        wb.addEventListener('waiting', (event) => {
            logger.log('A new version is available. Showing update prompt.');
            import('./components/modals/updateModal.js').then(m => m.showUpdateModal(wb));
        });

        wb.register().catch(err => logger.error('SW registration failed:', err));
    }

    // Start background cloud sync initialization after initial render is complete
    setTimeout(async () => {
        try {
            const { initializeAppData } = await import('./utils/cloudSaveHandler.js');
            const syncedState = await initializeAppData();
            if (syncedState) {
                const originalVersion = syncedState.appVersion || '1.0.0';
                initializeState(syncedState);
                if (state.appVersion !== originalVersion) {
                    logger.log(`Upgraded synced state version from ${originalVersion} to ${state.appVersion}`);
                    saveState(state, true); // Save immediately to persist version bump
                } else {
                    saveState(state);
                }
                const appVersionDisplay = document.getElementById('app-version-display');
                if (appVersionDisplay) {
                    appVersionDisplay.textContent = '| v' + (window.__ENV__?.APP_VERSION || state.appVersion || '2.0.0').replace(/^v/, '');
                }
                recalculateAll(state);
                renderApp(state);
            }
        } catch (error) {
            console.error("Error initializing app data:", error);
        }
    }, 2000);


    // Generic handler for modals (close buttons and clicking outside)
    document.addEventListener('click', (e) => {
        // Handle Update Modal close button
        if (e.target.closest('#close-update-modal-btn')) {
            const modal = document.getElementById('update-available-modal');
            if (modal) {
                modal.classList.remove('show');
                if (dom.overlay) dom.overlay.classList.remove('show');
            }
            return;
        }

        // Close any modal when clicking its dark background/overlay
        if (e.target.classList.contains('modal') || e.target.id === 'overlay') {
            if (e.target.classList.contains('modal')) {
                if (e.target.id === 'consent-modal' || e.target.id === 'cloud-sync-notice-modal') return;
                e.target.classList.remove('show');
                if (dom.overlay) dom.overlay.classList.remove('show');
            } else if (e.target.id === 'overlay') {
                const consentModal = document.getElementById('consent-modal');
                const cloudSyncNoticeModal = document.getElementById('cloud-sync-notice-modal');
                if ((consentModal && consentModal.classList.contains('show')) || (cloudSyncNoticeModal && cloudSyncNoticeModal.classList.contains('show'))) {
                    document.querySelectorAll('.modal.show').forEach(m => {
                        if (m.id !== 'consent-modal' && m.id !== 'cloud-sync-notice-modal') m.classList.remove('show');
                    });
                    return;
                }
                document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));
                e.target.classList.remove('show');
            }
        }
    });


    // Handle Escape key to close active modal, navigation drawer, or FAB menu
    document.addEventListener('keydown', async (event) => {
        if (event.key === 'Escape') {
            // 1. Prioritize closing open modals
            const activeModal = document.querySelector('.modal.show');
            if (activeModal) {
                if (activeModal.id === 'consent-modal' || activeModal.id === 'cloud-sync-notice-modal') return;
                const rejectBtn = activeModal.querySelector('.reject-button');
                const closeBtn = activeModal.querySelector('.close-button');
                const acceptBtn = activeModal.querySelector('.accept-button');

                if (rejectBtn && window.getComputedStyle(rejectBtn).display !== 'none') {
                    rejectBtn.click();
                } else if (closeBtn && window.getComputedStyle(closeBtn).display !== 'none') {
                    closeBtn.click();
                } else if (acceptBtn && window.getComputedStyle(acceptBtn).display !== 'none') {
                    acceptBtn.click();
                } else {
                    activeModal.classList.remove('show');
                    const overlay = document.getElementById('overlay');
                    if (overlay) overlay.classList.remove('show');
                }
                return;
            }

            // 2. Close navigation drawer if open
            const drawer = document.querySelector('.navigation-drawer');
            if (drawer && drawer.classList.contains('open')) {
                const hamburger = document.querySelector('.hamburger');
                if (hamburger) {
                    hamburger.click();
                    hamburger.focus();
                }
                return;
            }

            // 3. Close FAB menu if active
            const mainFab = document.getElementById('main-fab');
            if (mainFab && mainFab.classList.contains('active')) {
                const { closeFabMenu } = await import('./components/fab/fab.js');
                closeFabMenu();
                mainFab.focus();
            }
        }
    });

    // Global link interceptor for all external links
    document.body.addEventListener('click', async (e) => {
        const link = e.target.closest('a');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href) return;

        // Skip internal/anchor links
        if (href.startsWith('#') || href.startsWith('javascript:')) return;

        const isMailto = href.startsWith('mailto:');
        if (isMailto) {
            e.preventDefault();
            const confirmed = await showConfirm(translate('confirms.mailtoLink'));
            if (confirmed) {
                window.location.href = href;
            }
            return;
        }

        const isHttpExternal = (href.startsWith('http://') || href.startsWith('https://')) && !href.includes(window.location.host);

        if (isHttpExternal) {
            e.preventDefault();
            const confirmed = await showConfirm(translate('confirms.externalLink'));
            if (confirmed) {
                window.open(href, '_blank', 'noopener,noreferrer');
            }
        }
    });


});

export { handleStateUpdate } from './core/stateManager.js';
window.resetApplication = () => {
    resetState();
    localStorage.removeItem('oreCalcUserId');
    setTimeout(() => {
        location.reload();
    }, 500);
};

window.refreshConsentModalStatus = () => {
    const privacyTimestamp = state.uiSettings?.acceptanceTimestamp?.privacy;
    const tosTimestamp = state.uiSettings?.acceptanceTimestamp?.tos;

    const privacyAccepted = privacyTimestamp && privacyTimestamp >= EFFECTIVE_DATE_PRIVACY;
    const tosAccepted = tosTimestamp && tosTimestamp >= EFFECTIVE_DATE_TERMS;

    const acceptedText = translate('actions.accepted');

    const viewTermsBtn = document.getElementById('consent-view-terms-btn');
    if (viewTermsBtn && tosAccepted) {
        viewTermsBtn.removeAttribute('data-i18n');
        viewTermsBtn.disabled = true;
        viewTermsBtn.style.backgroundColor = 'transparent';
        viewTermsBtn.style.borderColor = 'transparent';
        viewTermsBtn.style.cursor = 'default';
        viewTermsBtn.style.padding = '0';
        viewTermsBtn.style.opacity = '1';
        viewTermsBtn.innerHTML = `<span style="display: flex; align-items: center; gap: 6px; color: var(--color-success); font-size: 0.9em; font-weight: 500;">
            <orecalc-assets-svg name="check" fill="var(--color-success)"></orecalc-assets-svg>
            ${acceptedText}
        </span>`;
    }

    const viewPrivacyBtn = document.getElementById('consent-view-privacy-btn');
    if (viewPrivacyBtn && privacyAccepted) {
        viewPrivacyBtn.removeAttribute('data-i18n');
        viewPrivacyBtn.disabled = true;
        viewPrivacyBtn.style.backgroundColor = 'transparent';
        viewPrivacyBtn.style.borderColor = 'transparent';
        viewPrivacyBtn.style.cursor = 'default';
        viewPrivacyBtn.style.padding = '0';
        viewPrivacyBtn.style.opacity = '1';
        viewPrivacyBtn.innerHTML = `<span style="display: flex; align-items: center; gap: 6px; color: var(--color-success); font-size: 0.9em; font-weight: 500;">
            <orecalc-assets-svg name="check" fill="var(--color-success)"></orecalc-assets-svg>
            ${acceptedText}
        </span>`;
    }
};

function checkLegalConsent() {
    const privacyTimestamp = state.uiSettings.acceptanceTimestamp?.privacy;
    const tosTimestamp = state.uiSettings.acceptanceTimestamp?.tos;

    // Check if consent timestamp is missing, or older than terms/privacy effective dates
    const needsConsent = !privacyTimestamp ||
        privacyTimestamp < EFFECTIVE_DATE_PRIVACY ||
        !tosTimestamp ||
        tosTimestamp < EFFECTIVE_DATE_TERMS;

    if (!needsConsent) return;

    const consentModal = document.getElementById('consent-modal');
    if (!consentModal) return;

    const needsPrivacy = !privacyTimestamp || privacyTimestamp < EFFECTIVE_DATE_PRIVACY;
    const needsTerms = !tosTimestamp || tosTimestamp < EFFECTIVE_DATE_TERMS;

    const termsRow = document.getElementById('consent-terms-row');
    const privacyRow = document.getElementById('consent-privacy-row');
    if (termsRow) termsRow.style.display = needsTerms ? 'flex' : 'none';
    if (privacyRow) privacyRow.style.display = needsPrivacy ? 'flex' : 'none';

    const viewTermsBtn = document.getElementById('consent-view-terms-btn');
    const viewPrivacyBtn = document.getElementById('consent-view-privacy-btn');
    const acceptBtn = document.getElementById('confirm-consent-btn');

    window.refreshConsentModalStatus();

    if (viewTermsBtn) {
        viewTermsBtn.onclick = (e) => {
            e.preventDefault();
            const termsModal = document.getElementById('terms-modal');
            if (termsModal) termsModal.classList.add('modal-top');
            openTermsOfUseModal();
        };
    }

    if (viewPrivacyBtn) {
        viewPrivacyBtn.onclick = (e) => {
            e.preventDefault();
            const privacyModal = document.getElementById('privacy-modal');
            if (privacyModal) privacyModal.classList.add('modal-top');
            openPrivacyModal();
        };
    }

    if (acceptBtn) {
        acceptBtn.onclick = (e) => {
            e.preventDefault();
            const now = Date.now();
            if (!state.uiSettings.acceptanceTimestamp) {
                state.uiSettings.acceptanceTimestamp = {};
            }
            state.uiSettings.acceptanceTimestamp.privacy = Math.max(now, EFFECTIVE_DATE_PRIVACY + 1);
            state.uiSettings.acceptanceTimestamp.tos = Math.max(now, EFFECTIVE_DATE_TERMS + 1);
            saveState(state);

            consentModal.classList.remove('show');
            if (dom.overlay) {
                const visibleModals = document.querySelectorAll('.modal.show');
                if (visibleModals.length === 0) {
                    dom.overlay.classList.remove('show');
                }
            }
        };
    }

    // Open the consent modal and overlay
    consentModal.classList.add('show');
    if (dom.overlay) dom.overlay.classList.add('show');
}


