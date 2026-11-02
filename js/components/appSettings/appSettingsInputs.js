import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { populateDropdowns } from './appSettingsDisplay.js';
import { initializeSettingsAppearance } from './settingsAppearanceInputs.js';
import { initializeSettingsAccount } from './settingsAccountInputs.js';
import { initializeAuthModal } from '../auth/authModalInputs.js';
import { initializeSettingsDataManagement } from './settingsDataManagementInputs.js';
import { initializeSettingsPricing } from './settingsPricingInputs.js';
import { dom } from '../../dom/domElements.js';
import { initAppSettings } from '../common/appSettingsManager.js';

let isSettingsInitialized = false;

/**
 * Initializes all application settings subsystems and event listeners.
 */
export function initializeAppSettings() {
    if (isSettingsInitialized) {
        return;
    }
    isSettingsInitialized = true;

    initAppSettings();
    populateDropdowns();
    initializeSettingsAccount({
        settingsItems: ['cardLayout']
    });
    initializeAuthModal();

    initializeSettingsAppearance();
    initializeSettingsDataManagement();
    initializeSettingsPricing();

    const enableLevelInputToggle = /** @type {HTMLInputElement|null} */ (dom.equipment?.enableLevelInputToggle);
    if (enableLevelInputToggle) {
        enableLevelInputToggle.checked = state.uiSettings.enableLevelInput;

        enableLevelInputToggle.addEventListener('change', (e) => {
            handleStateUpdate(() => {
                state.uiSettings.enableLevelInput = /** @type {HTMLInputElement} */ (e.target).checked;
            }, false, { preferencesOnly: true });
        });
    }

    const hideMaxedToggle = /** @type {HTMLInputElement|null} */ (dom.equipment?.hideMaxedToggle);
    if (hideMaxedToggle) {
        hideMaxedToggle.checked = state.uiSettings.hideMaxedEquipment;

        hideMaxedToggle.addEventListener('change', (e) => {
            const updateState = () => {
                state.uiSettings.hideMaxedEquipment = /** @type {HTMLInputElement} */ (e.target).checked;
            };
            if (typeof document.startViewTransition === 'function' && !document.hidden) {
                try {
                    const transition = document.startViewTransition(() => {
                        window.__FORCE_SYNC_RENDER__ = true;
                        try {
                            handleStateUpdate(updateState, false, { preferencesOnly: true });
                        } finally {
                            window.__FORCE_SYNC_RENDER__ = false;
                        }
                    });
                    transition?.ready?.catch(() => {});
                    transition?.finished?.catch(() => {});
                } catch (_) {
                    handleStateUpdate(updateState, false, { preferencesOnly: true });
                }
            } else {
                handleStateUpdate(updateState, false, { preferencesOnly: true });
            }
        });
    }

    const hideLockedToggle = /** @type {HTMLInputElement|null} */ (dom.equipment?.hideLockedToggle);
    if (hideLockedToggle) {
        hideLockedToggle.checked = state.uiSettings.hideLockedEquipment;

        hideLockedToggle.addEventListener('change', (e) => {
            const updateState = () => {
                state.uiSettings.hideLockedEquipment = /** @type {HTMLInputElement} */ (e.target).checked;
            };
            if (typeof document.startViewTransition === 'function' && !document.hidden) {
                try {
                    const transition = document.startViewTransition(() => {
                        window.__FORCE_SYNC_RENDER__ = true;
                        try {
                            handleStateUpdate(updateState, false, { preferencesOnly: true });
                        } finally {
                            window.__FORCE_SYNC_RENDER__ = false;
                        }
                    });
                    transition?.ready?.catch(() => {});
                    transition?.finished?.catch(() => {});
                } catch (_) {
                    handleStateUpdate(updateState, false, { preferencesOnly: true });
                }
            } else {
                handleStateUpdate(updateState, false, { preferencesOnly: true });
            }
        });
    }

    document.dispatchEvent(new CustomEvent('app:translate'));
}
