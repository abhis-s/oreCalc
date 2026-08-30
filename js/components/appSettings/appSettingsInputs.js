import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { populateDropdowns } from './appSettingsDisplay.js';
import { showChangelogModal } from '../changelog/changelogModal.js';
import { openLicensesModal, openPrivacyModal, openTermsOfUseModal } from './settingsLegalModals.js';
import { openBugReportModal, openContactModal, openRunningCostsModal } from './settingsSupportModals.js';
import { initializeSettingsAppearance } from './settingsAppearanceInputs.js';
import { initializeSettingsDataManagement } from './settingsDataManagementInputs.js';
import { initializeDeviceSyncInputs } from './settingsDeviceSyncInputs.js';
import { initializeSettingsPricing } from './settingsPricingInputs.js';
import { dom } from '../../dom/domElements.js';
import { getChangelogHtml } from '../../services/changelogService.js';
import { showAlert, showConfirm } from '../../ui/noticeModal.js';

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
        appVersionDisplay.textContent = '| v' + (window.__ENV__?.APP_VERSION || state.appVersion || '2.2.0').replace(/^v/, '');
    }

    const settingsTab = document.getElementById('settings-tab') || document.querySelector('.settings-tab');
    if (settingsTab) {
        settingsTab.addEventListener('click', async (e) => {
            const target = /** @type {HTMLElement | null} */ (e.target);
            const btn = target?.closest('.animated-btn');
            if (!btn || !(btn instanceof HTMLElement)) return;
            const actionType = btn.dataset.actionType;
            const itemId = btn.dataset.itemId;
            const url = btn.dataset.url;

            if (actionType === 'link' && url) {
                e.preventDefault();
                const confirmed = await showConfirm(
                    `${translate('confirms.externalLink')}<br><code class="external-link-display">${url}</code><br><br>${translate('confirms.externalLinkConfirm')}`
                );
                if (confirmed) {
                    window.open(url, '_blank', 'noopener,noreferrer');
                }
                return;
            }

            if (actionType === 'modal') {
                e.preventDefault();
                if (itemId === 'changelog') {
                    const content = getChangelogHtml();
                    showChangelogModal(content);
                } else if (itemId === 'bugReport') {
                    openBugReportModal();
                } else if (itemId === 'contact') {
                    openContactModal();
                } else if (itemId === 'privacy') {
                    openPrivacyModal();
                } else if (itemId === 'termsOfUse') {
                    openTermsOfUseModal();
                } else if (itemId === 'licenses') {
                    openLicensesModal();
                } else if (itemId === 'runningCosts') {
                    openRunningCostsModal();
                }
                return;
            }

            if (actionType === 'placeholder') {
                e.preventDefault();
                showAlert(translate('app.comingSoon'));
                return;
            }
        });
    }

    document.dispatchEvent(new CustomEvent('app:translate'));
}
