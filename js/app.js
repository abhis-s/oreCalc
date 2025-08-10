import { dom, initializeDOMElements } from './dom/domElements.js';
import { state, initializeState } from './core/state.js';
import { saveState, loadState, resetState } from './core/localStorageManager.js';
import { renderApp } from './core/renderer.js';
import { recalculateAll } from './core/calculator.js';
import { initializeAppData } from './utils/cloudSaveHandler.js';

import { initializeHeader } from './components/layout/header.js';
import { initializeTabs } from './components/layout/tabs.js';
import { initializeNavigation } from './components/layout/navigation.js';
import { initializeStorageInputs } from './components/equipment/storageInputs.js';
import { initializeHeroCards } from './components/equipment/heroCard.js';
import { initializePlayerDropdown } from './components/player/playerDropdown.js';
import { initializePlayerModal } from './components/player/playerModal.js';
import { initializeFab } from './components/fab/fab.js';
import { initializeModeToggle } from './components/layout/modeToggle.js';
import { initializeAppSettings } from './components/appSettings/appSettings.js';
import { initializePlanner } from './components/planner/planner.js';

import { initializeStarBonusSelector } from './components/income/starBonusSelector.js';
import { initializeClanWarInputs } from './components/income/clanWarInputs.js';
import { initializeCwlInputs } from './components/income/cwlInputs.js';
import { initializeEventPassInputs } from './components/income/eventPassInputs.js';
import { initializeRaidMedalTrader } from './components/income/raidMedalTrader.js';
import { initializeGemTrader } from './components/income/gemTrader.js';
import { initializeEventTrader } from './components/income/eventTrader.js';
import { initializeShopOffers } from './components/income/shopOffers.js';
import { initializeIncomeCardHandler } from './components/income/incomeCardHandler.js';
import { initializeIncomeCardObserver } from './components/income/incomeCardObserver.js';
import { initializeResponsiveTextHandler } from './utils/responsiveTextHandler.js';
import { initializeCloudSaveButtons } from './utils/cloudSaveHandler.js';
import { loadAndProcessPlayerData } from './services/serverResponseHandler.js';

import './console.js';

let userId = localStorage.getItem('oreCalcUserId');

document.addEventListener('DOMContentLoaded', async () => {
    initializeDOMElements();

    const savedState = await initializeAppData();
    initializeState(savedState);

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
    initializeModeToggle();
    initializeAppSettings();
    initializePlanner();
    initializeStarBonusSelector();
    initializeClanWarInputs();
    initializeCwlInputs();
    initializeEventPassInputs();
    initializeRaidMedalTrader();
    initializeGemTrader();
    initializeEventTrader();
    initializeShopOffers();
    initializeIncomeCardHandler();
    initializeIncomeCardObserver();
    initializeResponsiveTextHandler();
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
    }

    const preloader = dom.preloader;
    if (preloader) {
        setTimeout(() => {
            preloader.style.display = 'none';
        }, 1000);
    }

    // Service Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                // console.log('Service Worker registered: ', registration);
            })
            .catch(registrationError => {
                console.error('Service Worker registration failed: ', registrationError);
            });
    }
});

export function handleStateUpdate(mutator) {
    mutator();
    recalculateAll(state);
    renderApp(state);
    saveState(state);
}

window.resetApplication = () => {
    resetState();
    localStorage.removeItem('oreCalcUserId'); // Clear userId on reset
    location.reload();
};