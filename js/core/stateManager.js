import { state } from './state.js';
import { saveState } from './localStorageManager.js';

let stateUpdateCallback = null;
let cloudSaveTimeout = null;

/**
 * Registers the callback for updating UI elements on state change.
 * This decouples the state manager from calculator and renderer modules.
 *
 * @param {Function} callback - Callback function(state, silent).
 */
export function registerStateUpdateCallback(callback) {
    stateUpdateCallback = callback;
}

/**
 * Updates application state safely, triggering recalculations, UI renders, local storage persistence,
 * and debounced cloud saves.
 *
 * @param {Function} updateFn - Function that modifies state.
 * @param {boolean} [silent=false] - If true, skips UI rendering.
 */
export function handleStateUpdate(updateFn, silent = false) {
    if (!silent && state.planner?.calendar) {
        state.planner.calendar.isDirty = true;
    }
    updateFn();

    if (stateUpdateCallback) {
        stateUpdateCallback(state, silent);
    }
    saveState(state);

    if (state.uiSettings.cloudSync !== false) {
        if (cloudSaveTimeout) {
            clearTimeout(cloudSaveTimeout);
        }
        cloudSaveTimeout = setTimeout(() => {
            import('../utils/cloudSaveHandler.js').then(module => {
                module.triggerCloudSave({ silent: true });
            });
        }, 3000);
    } else {
        if (cloudSaveTimeout) {
            clearTimeout(cloudSaveTimeout);
            cloudSaveTimeout = null;
        }
    }
}
