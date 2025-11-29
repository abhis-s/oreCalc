import { state } from './core/state.js';
import { handleStateUpdate } from './app.js';
import { saveState } from './core/localStorageManager.js';
import { renderApp } from './core/renderer.js';
import { showChangelogModal } from './components/changelog/changelogModal.js';
import { fetchChangelog } from './services/githubService.js';
import { showSaveErrorIndicator } from './ui/savingIndicator.js';

window.enableLevelInput = () => {
    const newEnableLevelInput = !state.uiSettings.enableLevelInput;
    handleStateUpdate(() => {
        state.uiSettings.enableLevelInput = newEnableLevelInput;
    });
    const newModeText = newEnableLevelInput ? 'Enabled' : 'Disabled';
    return `Level input has been ${newModeText}.`;
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
    const changelogContent = await fetchChangelog();
    showChangelogModal(changelogContent);
    return "Changelog modal displayed.";
};

window.simulateSaveFail = () => {
    console.log("Simulating save failure...");
    showSaveErrorIndicator();
    return "Save failure simulated.";
};

console.info(
    "%c Ore Calculator Console Commands:\n\n" +
    "%c  enableLevelInput(): %cToggles the 'Enable level input' setting.\n" +
    "%c  resetApp():       %cInitiates a 5-second countdown to reset all app data and reload. Can be cancelled.\n" +
    "%c  cancelResetApp(): %cCancels an active resetApp countdown.\n" +
    "%c  logState():       %cLogs the current state object to the console.\n" +
    "%c  clearPlannerState(): %cClears all saved chips from the planner calendar.\n" +
    "%c  showChangelog():  %cDisplays the changelog modal.\n" +
    "%c  simulateSaveFail(): %cSimulates a save failure to test the error indicator.\n\n" +
    "%c For more information, refer to the documentation.",
    "color: #8ab4f8; font-weight: bold;",
    "color: #a5d6a7; font-weight: bold;", "color: #e3e2e6;",
    "color: #a5d6a7; font-weight: bold;", "color: #e3e2e6;",
    "color: #a5d6a7; font-weight: bold;", "color: #e3e2e6;",
    "color: #a5d6a7; font-weight: bold;", "color: #e3e2e6;",
    "color: #a5d6a7; font-weight: bold;", "color: #e3e2e6;",
    "color: #a5d6a7; font-weight: bold;", "color: #e3e2e6;",
    "color: #a5d6a7; font-weight: bold;", "color: #e3e2e6;",
    "color: #bdc1c6; font-style: italic;"
);