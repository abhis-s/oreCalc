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
import { initializePlayerModal } from './components/player/playerModal.js';
import { initializeFab } from './components/fab/fab.js';
import { initializeAppSettings } from './components/appSettings/appSettings.js';
import { initializeSettingsCardObserver } from './components/appSettings/settingsCardObserver.js';
import { initializePlanner } from './components/planner/planner.js';
import { initializePriorityListModal } from './components/planner/priorityListModal.js';
import { initializeChangelogModal, showChangelogModal } from './components/changelog/changelogModal.js';

import { initializeStarBonusSelector } from './components/income/starBonusSelector.js';
import { initializeClanWarInputs } from './components/income/clanWarInputs.js';
import { initializeCwlInputs } from './components/income/cwlInputs.js';
import { initializeEventPassInputs } from './components/income/eventPassInputs.js';
import { initializeRaidMedalTrader } from './components/income/raidMedalTrader.js';
import { initializeGemTrader } from './components/income/gemTrader.js';
import { initializeEventTrader } from './components/income/eventTrader.js';
import { initializeShopOffers } from './components/income/shopOffers.js';
import { initializeChampionshipInputs } from './components/income/championshipInputs.js';

import { initializeIncomeCardHandler } from './components/income/incomeCardHandler.js';
import { initializeIncomeCardObserver } from './components/income/incomeCardObserver.js';
import { updateResponsiveText } from './utils/responsiveTextHandler.js';
import { initializeCloudSaveButtons } from './utils/cloudSaveHandler.js';
import { loadAndProcessPlayerData } from './services/serverResponseHandler.js';
import { loadTranslations, translate } from './i18n/translator.js';
import { fetchChangelog } from './services/githubService.js';

import './console.js';

let userId = localStorage.getItem('oreCalcUserId');

function updateUIWithTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.innerHTML = translate(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        element.placeholder = translate(key);
    });

    document.querySelectorAll('[data-i18n-tooltip]').forEach(element => {
        const key = element.getAttribute('data-i18n-tooltip');
        element.setAttribute('data-tooltip', translate(key));
    });

    document.documentElement.lang = state.uiSettings.language;
    document.dispatchEvent(new CustomEvent('languageChanged'));
}

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    let userIdFromUrl = urlParams.get('userId');

    if (!userIdFromUrl) {
        const hash = window.location.hash;
        const match = hash.match(/[?&]userId=([a-fA-F0-9-]+)/);
        if (match) {
            userIdFromUrl = match[1];
        }
    }

    if (userIdFromUrl) {
        const newUrl = window.location.pathname + window.location.hash.split('?')[0];
        history.replaceState(null, '', newUrl);
        await importUserData(userIdFromUrl);
    }
    
    initializeDOMElements();

    if (localStorage.getItem('showChangelog') === 'true') {
        localStorage.removeItem('showChangelog');
        const changelogContent = await fetchChangelog();
        showChangelogModal(changelogContent);
    }

    const savedState = await initializeAppData();
    initializeState(savedState);

    const hash = window.location.hash.substring(1).split('?')[0];
    if (hash) {
        const validTabs = ['home', 'equipment', 'income', 'planner', 'settings'];
        if (validTabs.includes(hash)) {
            state.activeTab = `${hash}-tab`;
        }
    }

    let initialLanguage = state.uiSettings.language;

    if (!initialLanguage || initialLanguage === 'auto') {
        console.log('Detecting language...');
        const browserLanguage = navigator.language || navigator.languages[0];
        if (browserLanguage && browserLanguage.startsWith('de')) {
            console.log('Detected language: German');
            initialLanguage = 'de';
        } else {
            initialLanguage = 'en';
        }
    }
    state.uiSettings.language = initialLanguage;

    await loadTranslations('en');

    if (state.uiSettings.language !== 'en') {
        await loadTranslations(state.uiSettings.language);
    }

    updateUIWithTranslations();

    recalculateAll(state);

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
    initializeSettingsCardObserver();
    initializePlanner();
    initializePriorityListModal();
    initializeChangelogModal();
    initializeStarBonusSelector();
    initializeClanWarInputs();
    initializeCwlInputs();
    initializeEventPassInputs();
    initializeRaidMedalTrader();
    initializeGemTrader();
    initializeChampionshipInputs();
    initializeEventTrader();
    initializeShopOffers();
    initializeIncomeCardHandler();
    initializeIncomeCardObserver();
    updateResponsiveText();
    initializeCloudSaveButtons();

    const refreshButton = dom.controls.refreshButton;
    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
            if (state.lastPlayerTag) {
                loadAndProcessPlayerData(state.lastPlayerTag);
            } else {
                alert('No player tag selected to refresh.');
            }
        });

        if (state.lastPlayerTag && state.lastPlayerTag !== 'DEFAULT0') {
            refreshButton.click();
        }
    }

    const preloader = dom.preloader;
    if (preloader) {
        setTimeout(() => {
            preloader.style.display = 'none';
        }, 1000);
    }

    if ('serviceWorker' in navigator && 'workbox' in window) {
            const wb = new workbox.Workbox('/service-worker.js');

            wb.addEventListener('waiting', (event) => {
                console.log('A new version is available. Showing update prompt.');

                const updateModal = document.getElementById('update-available-modal');
                const overlay = document.getElementById('overlay');
                const reloadButton = document.getElementById('update-reload-button');
                const laterButton = document.getElementById('update-later-button');

                if (updateModal && overlay && reloadButton && laterButton) {
                    updateModal.classList.add('show');
                    overlay.style.display = 'block';

                    reloadButton.onclick = () => {
                        localStorage.setItem('showChangelog', 'true');
                        wb.addEventListener('controlling', () => {
                            window.location.reload();
                        });
                        wb.messageSkipWaiting();
                    };

                    laterButton.onclick = () => {
                        updateModal.classList.remove('show');
                        overlay.style.display = 'none';
                    };
                }
            });

            wb.register();
    }

    window.addEventListener('popstate', (event) => {
        const hash = window.location.hash.substring(1).split('?')[0];
        if (hash) {
            const validTabs = ['home', 'equipment', 'income', 'planner', 'settings'];
            if (validTabs.includes(hash)) {
                handleStateUpdate(() => {
                    state.activeTab = `${hash}-tab`;
                });
            }
        } else {
            handleStateUpdate(() => {
                state.activeTab = 'home-tab';
            });
        }
    });
});

export function handleStateUpdate(mutator, silent = false) {
    mutator();
    if (!silent) {
        recalculateAll(state);
        renderApp(state);
    }
    saveState(state);
}

window.resetApplication = () => {
    resetState();
    localStorage.removeItem('oreCalcUserId');
    location.reload();
};