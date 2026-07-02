import { getChangelogHtml } from './services/changelogService.js';
import { handleStateUpdate } from './app.js';
import { renderApp } from './core/renderer.js';
import { saveState } from './core/localStorageManager.js';
import { showChangelogModal } from './components/changelog/changelogModal.js';
import { showSaveErrorIndicator } from './ui/savingIndicator.js';
import { state } from './core/state.js';
import { showWelcomeModal } from './components/welcome/welcomeModal.js';
import { applyCardLayout } from './ui/cardLayoutManager.js';

window.enableLevelInput = () => {
    const newEnableLevelInput = !state.uiSettings.enableLevelInput;
    handleStateUpdate(() => {
        state.uiSettings.enableLevelInput = newEnableLevelInput;
    });
    const newModeText = newEnableLevelInput ? 'Enabled' : 'Disabled';
    return `Level input has been ${newModeText}.`;
};

window.switchLayout = (layout) => {
    let targetLayout;
    if (layout === undefined || layout === null) {
        targetLayout = (state.uiSettings.cardLayout === 'compact0' || state.uiSettings.cardLayout === 'compact1') ? 'cozy' : 'compact0';
    } else if (layout === 'cozy') {
        targetLayout = 'cozy';
    } else if (layout === 'compact0' || layout === 'quilt') {
        targetLayout = 'compact0';
    } else if (layout === 'compact1') {
        targetLayout = 'compact1';
    } else {
        return "Invalid layout. Options: 'cozy' (default), 'compact0' (keeps row constraints, swaps columns), or 'compact1' (Google Keep masonry flow). Omit to toggle.";
    }

    handleStateUpdate(() => {
        state.uiSettings.cardLayout = targetLayout;
    }, true);
    applyCardLayout(targetLayout);
    
    const cozyQuiltToggle = document.getElementById('settings-cozy-quilt-toggle');
    if (cozyQuiltToggle) {
        const isCompact = targetLayout === 'compact0' || targetLayout === 'compact1';
        cozyQuiltToggle.checked = isCompact;
        const layoutBtns = document.querySelectorAll('.layout-segmented-control .segmented-btn');
        layoutBtns.forEach(btn => {
            const isQuilt = btn.dataset.layout === 'quilt';
            btn.classList.toggle('active', isQuilt === isCompact);
        });
    }

    return `Layout switched to ${targetLayout === 'cozy' ? 'cozy' : targetLayout}.`;
};

window.resetApp = () => {
    let countdown = 5;
    if (window.resetAppTimerId) {
        clearTimeout(window.resetAppTimerId);
        console.log("Previous reset countdown cancelled. Starting a new one.");
    }
    const startCountdown = () => {
        if (countdown > 0) {
            if (countdown < 5)
                console.log(`Resetting app in ${countdown} seconds...`);
            countdown--;
            window.resetAppTimerId = setTimeout(startCountdown, 1000);
        } else {
            console.log("Resetting app now.");
            window.resetApplication();
            window.resetAppTimerId = null;
        }
    };
    startCountdown();
    return "App reset initiated. Check console for countdown. Type 'cancelResetApp()' to abort.";
};

window.cancelResetApp = () => {
    if (window.resetAppTimerId) {
        clearTimeout(window.resetAppTimerId);
        window.resetAppTimerId = null;
        return "App reset successfully cancelled.";
    } else {
        return "No active app reset to cancel.";
    }
};

window.logState = () => {
    console.log(state);
    return "Current application state logged to console.";
};

window.clearPlannerState = () => {
    handleStateUpdate(() => {
        state.planner.calendar.dates = {};
    });
    renderApp(state);
    saveState(state);
    return "Planner state cleared.";
};

window.showChangelog = async () => {
    const changelogContent = getChangelogHtml();
    showChangelogModal(changelogContent);
    return "Changelog modal displayed.";
};

window.simulateSaveFail = () => {
    console.log("Simulating save failure...");
    showSaveErrorIndicator();
    return "Save failure simulated.";
};

window.triggerWelcomeModal = () => {
    handleStateUpdate(() => {
        if (state.uiSettings?.timestamp) {
            delete state.uiSettings.timestamp.welcome;
        }
    });
    for (const tag of state.savedPlayerTags) {
        sessionStorage.removeItem(`oreCalc_onboardingComplete_${tag}`);
    }
    showWelcomeModal(true);
    return "Welcome modal triggered. Welcome timestamp has been reset.";
};

window.disableWelcomeModal = () => {
    showWelcomeModal(false);
    handleStateUpdate(() => {
        if (!state.uiSettings.timestamp) {
            state.uiSettings.timestamp = {};
        }
        state.uiSettings.timestamp.welcome = Date.now();
    });
    for (const tag of state.savedPlayerTags) {
        sessionStorage.setItem(`oreCalc_onboardingComplete_${tag}`, 'true');
    }
    return "Welcome modal closed and marked as completed.";
};

window.startTour = async (setId) => {
    const module = await import('./components/tour/appTour.js');
    if (!setId) {
        // Reset the tour timestamp so startTour() resolves all steps from the beginning
        handleStateUpdate(() => {
            if (state.uiSettings?.timestamp) {
                delete state.uiSettings.timestamp.tour;
            }
        });
    }
    await module.startTour(setId);
    return setId ? `Tour started for set: ${setId}` : "Tour reset and started from the beginning.";
};

window.resetTour = () => {
    handleStateUpdate(() => {
        if (state.uiSettings?.timestamp) {
            delete state.uiSettings.timestamp.tour;
        }
    });
    return "Tour timestamp reset. Reload or run startTour() to see it again.";
};

window.disableTour = () => {
    handleStateUpdate(() => {
        if (!state.uiSettings.timestamp) {
            state.uiSettings.timestamp = {};
        }
        state.uiSettings.timestamp.tour = Date.now();
    });
    return "Tour marked as completed.";
};

window.checkMigration = async (testUserId) => {
    if (!testUserId) {
        console.error("[Migration Test] Please provide a valid user ID string.");
        return "Error: User ID is required.";
    }
    console.log(`[Migration Test] Fetching legacy data for user ID: ${testUserId}...`);
    try {
        const { loadUserData } = await import('./services/apiService.js');
        const { generateUUID } = await import('./utils/uuidGenerator.js');

        const importedData = await loadUserData(testUserId);
        if (!importedData) {
            console.error(`[Migration Test] No data found in Cloud/Firebase for user ID: ${testUserId}`);
            return `Error: No data found for ${testUserId}`;
        }

        console.log("[Migration Test] Legacy monolithic data fetched successfully:", importedData);

        // Generate a new random local user ID so we don't overwrite or push back to the tested cloud ID
        const newLocalUserId = generateUUID();

        // Purge settings/profiles to prevent collision before simulating migration
        localStorage.removeItem('oreCalc_appSettings');
        localStorage.removeItem('oreCalc_players');
        localStorage.removeItem('oreCalc_playerTags');
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('oreCalc_player_')) {
                localStorage.removeItem(key);
                i--;
            }
        }

        // Set the legacy monolithic state on disk to be migrated by application boot
        localStorage.setItem('oreCalculatorState', JSON.stringify(importedData));
        localStorage.setItem('oreCalc_userId', newLocalUserId);
        console.log(`[Migration Test] Simulated environment: local user ID set to ${newLocalUserId}, old monolithic data stored.`);

        console.log("[Migration Test] Reloading page to trigger Migration Lock and run migration natively...");
        location.reload();
        return "Migration test initiated. Page is reloading to run boot migration.";
    } catch (error) {
        console.error("[Migration Test] Error testing migration:", error);
        return `Error: ${error.message}`;
    }
};

console.info(
    "%c Ore Calculator Console Commands:\n\n" +
    "%c  enableLevelInput():     %cToggles the 'Enable level input' setting.\n" +
    "%c  switchLayout(layout):   %cSwitches layout ('cozy', 'compact0', or 'compact1'). Omit layout to toggle.\n" +
    "%c  resetApp():             %cInitiates a 5-second countdown to reset all app data and reload. Can be cancelled.\n" +
    "%c  cancelResetApp():       %cCancels an active resetApp countdown.\n" +
    "%c  logState():             %cLogs the current state object to the console.\n" +
    "%c  clearPlannerState():    %cClears all saved chips from the planner calendar.\n" +
    "%c  showChangelog():        %cDisplays the changelog modal.\n" +
    "%c  simulateSaveFail():     %cSimulates a save failure to test the error indicator.\n" +
    "%c  triggerWelcomeModal():  %cTriggers the Welcome modal (resets welcome state).\n" +
    "%c  disableWelcomeModal():  %cCloses the Welcome modal and marks it as completed.\n" +
    "%c  startTour(setId):       %cResets and starts tour from beginning (or optionally for a specific set, e.g., 'v1.0').\n" +
    "%c  resetTour():            %cResets the tour completion state so it triggers again.\n" +
    "%c  disableTour():          %cMarks the tour as completed.\n" +
    "%c  checkMigration(userId): %cTests migration of legacy user data by fetching from cloud and migrating locally under a new random userId.\n\n" +
    "%c For more information, refer to the documentation.",
    "color: #4facfe; font-weight: bold;",
    "color: #a5d6a7; font-weight: bold;", "color: #e3e2e6;",
    "color: #a5d6a7; font-weight: bold;", "color: #e3e2e6;",
    "color: #a5d6a7; font-weight: bold;", "color: #e3e2e6;",
    "color: #a5d6a7; font-weight: bold;", "color: #e3e2e6;",
    "color: #a5d6a7; font-weight: bold;", "color: #e3e2e6;",
    "color: #a5d6a7; font-weight: bold;", "color: #e3e2e6;",
    "color: #a5d6a7; font-weight: bold;", "color: #e3e2e6;",
    "color: #a5d6a7; font-weight: bold;", "color: #e3e2e6;",
    "color: #a5d6a7; font-weight: bold;", "color: #e3e2e6;",
    "color: #a5d6a7; font-weight: bold;", "color: #e3e2e6;",
    "color: #a5d6a7; font-weight: bold;", "color: #e3e2e6;",
    "color: #a5d6a7; font-weight: bold;", "color: #e3e2e6;",
    "color: #a5d6a7; font-weight: bold;", "color: #e3e2e6;",
    "color: #a5d6a7; font-weight: bold;", "color: #e3e2e6;",
    "color: #bdc1c6; font-style: italic;"
);