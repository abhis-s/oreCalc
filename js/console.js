import { state } from './core/state.js';
import { handleStateUpdate } from './app.js';
import { saveState } from './core/localStorageManager.js';
import { renderApp } from './core/renderer.js';

window.switchMode = () => {
    const newMode = state.uiSettings.mode === 'ease' ? 'tweak' : 'ease';
    handleStateUpdate(() => {
        state.uiSettings.mode = newMode;
    });
    return `Switched to ${newMode} mode.`;
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

console.info(
    "%c Ore Calculator Console Commands:\n\n" +
    "%c  switchMode():     %cToggles between 'Ease' and 'Tweak' modes.\n" +
    "%c  resetApp():       %cInitiates a 5-second countdown to reset all app data and reload. Can be cancelled.\n" +
    "%c  cancelResetApp(): %cCancels an active resetApp countdown.\n" +
    "%c  logState():       %cLogs the current state object to the console.\n" +
    "%c  clearPlannerState(): %cCears all saved chips from the planner calendar.\n\n" +
    "%c For more information, refer to the documentation.",
    "color: #8ab4f8; font-weight: bold;",
    "color: #a5d6a7; font-weight: bold;", "color: #e3e2e6;",
    "color: #a5d6a7; font-weight: bold;", "color: #e3e2e6;",
    "color: #a5d6a7; font-weight: bold;", "color: #e3e2e6;",
    "color: #a5d6a7; font-weight: bold;", "color: #e3e2e6;",
    "color: #a5d6a7; font-weight: bold;", "color: #e3e2e6;",
    "color: #bdc1c6; font-style: italic;"
);