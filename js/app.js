import { showAlert, showConfirm } from './ui/noticeModal.js';

import { dom, initializeDOMElements } from './dom/domElements.js';
import { state, initializeState } from './core/state.js';
import { saveState, loadState, resetState } from './core/localStorageManager.js';
import { renderApp } from './core/renderer.js';
import { recalculateAll } from './core/calculator.js';
import { initializeAppData, importUserData } from './utils/cloudSaveHandler.js';

import { initializeHeader } from './components/layout/header.js';
import { initializeTabs } from './components/layout/tabs.js';
import { initializeNavigation } from './components/layout/navigation.js';
import { initializeStorageInputs } from './components/equipment/storageInputs.js';
import { initializeHeroCards } from './components/equipment/heroCard.js';
import { initializePlayerDropdown } from './components/player/playerDropdown.js';
import { initializePlayerModal, showAddPlayerModal } from './components/player/playerModal.js';
import { initializeFab } from './components/fab/fab.js';
import { initializeAppSettings } from './components/appSettings/appSettings.js';
import { initializePlanner } from './components/planner/planner.js';
import { initializePriorityListModal } from './components/planner/priorityListModal.js';
import { initializeChangelogModal, showChangelogModal } from './components/changelog/changelogModal.js';

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
import { initializeCloudSaveButtons } from './utils/cloudSaveHandler.js';
import { validateAllInputs, validateAllSelects } from './utils/inputValidator.js';
import { loadAndProcessPlayerData } from './services/serverResponseHandler.js';
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
    showAlert(translate('errors.unexpectedError') || 'An unexpected error occurred. Please reload the page.', 'errors.errorTitle');
});

window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection:', event.reason);
    showAlert(translate('errors.unexpectedError') || 'An unexpected error occurred. Please reload the page.', 'errors.errorTitle');
});
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

        transition.ready.catch(() => {});
        transition.finished.catch(() => {}).finally(() => {
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
    initializeState(savedState);

    initializeDOMElements();

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
        const dots = preloader.querySelectorAll('.preloader-loader span');
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

    initializeAppData();

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
        initializeCloudSaveButtons();

        validateAllInputs();
        validateAllSelects();

        const refreshButton = dom.controls.refreshButton;
        if (refreshButton) {
            refreshButton.addEventListener('click', async () => {
                const activeTag = state.savedPlayerTags[0];
                if (activeTag && activeTag !== 'DEFAULT0') {
                    try {
                        refreshButton.classList.add('saving');
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
    }, 2300);

    // 3. SYNCHRONIZE PRELOADER REMOVAL
    if (preloader) {
        setTimeout(() => {
            preloader.classList.add('hidden');
            setTimeout(() => {
                preloader.style.display = 'none';
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
        }, 2800); // 2.3s for animation + 0.5s buffer for renderApp
    }

    if ('serviceWorker' in navigator && 'workbox' in window) {
            const wb = new workbox.Workbox('/service-worker.js');

            wb.addEventListener('waiting', (event) => {
                logger.log('A new version is available. Showing update prompt.');
                import('./components/modals/updateModal.js').then(m => m.showUpdateModal(wb));
            });

            wb.register().catch(err => logger.error('SW registration failed:', err));
    }


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
                e.target.classList.remove('show');
                if (dom.overlay) dom.overlay.classList.remove('show');
            } else if (e.target.id === 'overlay') {
                // If the standalone overlay was clicked, close all currently showing modals
                document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));
                e.target.classList.remove('show');
            }
        }
    });
});

export function handleStateUpdate(updateFn, silent = false) {
    updateFn();

    // Skip immediate render if we're about to handle it via View Transition (applyTheme)
    // This prevents "double-rendering" which breaks transitions.
    if (!silent) {
        recalculateAll(state);
        renderApp(state);
    }
    saveState(state);

    if (state.uiSettings.cloudSync !== false) {
        import('./utils/cloudSaveHandler.js').then(module => {
            module.triggerCloudSave({ silent: true });
        });
    }
}
window.resetApplication = () => {
    resetState();
    localStorage.removeItem('oreCalcUserId');
    location.reload();
};


