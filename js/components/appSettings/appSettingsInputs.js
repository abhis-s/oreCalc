import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { populateDropdowns } from './appSettingsDisplay.js';
import { initializeSettingsAppearance } from './settingsAppearanceInputs.js';
import { initializeSettingsDataManagement } from './settingsDataManagementInputs.js';
import { initializeDeviceSyncInputs } from './settingsDeviceSyncInputs.js';
import { initializeSettingsPricing } from './settingsPricingInputs.js';
import { dom } from '../../dom/domElements.js';

let isAppSettingsInitialized = false;

/**
 * Initializes all application settings subsystems and event listeners.
 */
export function initializeAppSettings() {
    if (isAppSettingsInitialized) return;
    isAppSettingsInitialized = true;

    populateDropdowns();
    initializeSettingsAppearance();
    initializeSettingsDataManagement();
    initializeDeviceSyncInputs();
    initializeSettingsPricing();

    const {
        appVersionDisplay,
        addPlayerLink
    } = dom.appSettings || {};

    if (addPlayerLink) {
        addPlayerLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const { showAddPlayerModal } = await import('../player/playerModal.js');
            showAddPlayerModal();
        });
    }

    const enableLevelInputToggle = /** @type {HTMLInputElement|null} */ (dom.equipment?.enableLevelInputToggle);
    if (enableLevelInputToggle) {
        enableLevelInputToggle.checked = state.uiSettings.enableLevelInput;

        enableLevelInputToggle.addEventListener('change', (e) => {
            handleStateUpdate(() => {
                state.uiSettings.enableLevelInput = /** @type {HTMLInputElement} */ (e.target).checked;
            });
        });
    }

    const hideMaxedToggle = /** @type {HTMLInputElement|null} */ (dom.equipment?.hideMaxedToggle);
    if (hideMaxedToggle) {
        hideMaxedToggle.checked = state.uiSettings.hideMaxedEquipment;

        hideMaxedToggle.addEventListener('change', (e) => {
            const updateState = () => {
                state.uiSettings.hideMaxedEquipment = /** @type {HTMLInputElement} */ (e.target).checked;
            };
            if (document.startViewTransition) {
                document.startViewTransition(() => {
                    window.__FORCE_SYNC_RENDER__ = true;
                    try {
                        handleStateUpdate(updateState);
                    } finally {
                        window.__FORCE_SYNC_RENDER__ = false;
                    }
                });
            } else {
                handleStateUpdate(updateState);
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
            if (document.startViewTransition) {
                document.startViewTransition(() => {
                    window.__FORCE_SYNC_RENDER__ = true;
                    try {
                        handleStateUpdate(updateState);
                    } finally {
                        window.__FORCE_SYNC_RENDER__ = false;
                    }
                });
            } else {
                handleStateUpdate(updateState);
            }
        });
    }

    if (appVersionDisplay) {
        appVersionDisplay.textContent = '| v' + (window.__ENV__?.APP_VERSION || state.appVersion || '2.1.0').replace(/^v/, '');
    }

    document.dispatchEvent(new CustomEvent('app:translate'));
}
