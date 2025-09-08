import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { currencySymbols } from '../../data/appData.js';
import { importUserData, triggerCloudSave } from '../../utils/cloudSaveHandler.js';
import { isValidUUID } from '../../utils/uuidGenerator.js';

function updateRegionalPricingVisibility() {
    const currency = state.uiSettings.currency;
    const regionalPricingSwitchContainer = dom.appSettings?.regionalPricingSwitchContainer;
    if (!regionalPricingSwitchContainer) return;

    if (currencySymbols[currency] && currencySymbols[currency].regionalPricing) {
        regionalPricingSwitchContainer.style.display = 'flex';
    } else {
        regionalPricingSwitchContainer.style.display = 'none';
    }
}

export function initializeAppSettings() {
    const currencySelect = dom.appSettings?.currencySelect;
    const regionalPricingToggle = dom.appSettings?.regionalPricingToggle;
    const resetDataButton = dom.controls?.resetDataButton;

    const userIdDisplay = dom.appSettings?.userIdDisplay;
    const copyUserIdBtn = dom.appSettings?.copyUserIdBtn;
    const importUserIdInput = dom.appSettings?.importUserIdInput;
    const importUserDataBtn = dom.appSettings?.importUserDataBtn;

    if (!currencySelect) return;

    currencySelect.addEventListener('change', (e) => {
        handleStateUpdate(() => {
            const oldCurrency = state.uiSettings.currency;
            const wasRegionalPricingEnabled = state.uiSettings.regionalPricingEnabled;

            state.uiSettings.currency = e.target.value;
            state.uiSettings.currencySymbol = currencySymbols[e.target.value]?.symbol || '';

            if (wasRegionalPricingEnabled && !(currencySymbols[state.uiSettings.currency] && currencySymbols[state.uiSettings.currency].regionalPricing)) {
                state.uiSettings.regionalPricingEnabled = false;
                if (dom.appSettings?.regionalPricingToggle) {
                    dom.appSettings.regionalPricingToggle.checked = false;
                }
            }
            updateRegionalPricingVisibility();
        });
    });

    if (regionalPricingToggle) {
        regionalPricingToggle.addEventListener('change', (e) => {
            handleStateUpdate(() => {
                state.uiSettings.regionalPricingEnabled = e.target.checked;
                if (state.lastPlayerTag && state.allPlayersData[state.lastPlayerTag]) {
                    state.allPlayersData[state.lastPlayerTag].regionalPricingEnabled = e.target.checked;
                }
            });
        });
    }

    if (resetDataButton) {
        resetDataButton.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all data? This action cannot be undone.')) {
                window.resetApplication();
            }
        });
    }

    if (userIdDisplay) {
        const currentUserId = localStorage.getItem('oreCalcUserId');
        if (currentUserId) {
            userIdDisplay.textContent = currentUserId;
        }
    }

    if (copyUserIdBtn && userIdDisplay) {
        copyUserIdBtn.addEventListener('click', async () => {
            if (!navigator.clipboard || !navigator.clipboard.writeText) {
                alert('Clipboard API not supported or accessible in this browser/context.');
                userIdDisplay.style.display = 'block'; 
                return;
            }
            try {
                await navigator.clipboard.writeText(userIdDisplay.textContent);
                await triggerCloudSave();
                alert('User ID copied to clipboard!');
            } catch (err) {
                console.error('Failed to copy: ', err);
                alert('Failed to copy User ID.');
                userIdDisplay.style.display = 'block';
            }
        });
    }

    if (importUserDataBtn && importUserIdInput) {
        importUserDataBtn.addEventListener('click', async () => {
            const manualImportId = importUserIdInput.value.trim();

            if (manualImportId) {
                if (isValidUUID(manualImportId)) {
                    importUserData(manualImportId);
                } else {
                    alert('Invalid User ID format.');
                }
                return;
            }

            try {
                const clipboardText = await navigator.clipboard.readText();
                if (clipboardText) {
                    const trimmedClipboardText = clipboardText.trim();
                    if (isValidUUID(trimmedClipboardText)) {
                        importUserData(trimmedClipboardText);
                    } else {
                        alert('Invalid User ID format in clipboard.');
                    }
                } else {
                    importUserIdInput.style.display = 'block';
                    importUserDataBtn.querySelector('.animated-btn-text').textContent = 'Import';
                    importUserDataBtn.querySelector('.animated-btn-icon-wrapper').innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#000000"><path d="M260-160q-91 0-155.5-63T40-377q0-78 47-139t123-78q17-72 85-137t145-65q33 0 56.5 23.5T520-716v242l64-62 56 56-160 160-160-160 56-56 64 62v-242q-76 14-118 73.5T280-520h-20q-58 0-99 41t-41 99q0 58 41 99t99 41h480q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-80q0-48-22-89.5T600-680v-93q74 35 117 103.5T760-520q69 8 114.5 59.5T920-340q0 75-52.5 127.5T740-160H260Zm220-358Z"/></svg>'; 
                    alert('No text found in clipboard. Please enter User ID manually.');
                }
            } catch (err) {
                console.error('Failed to read clipboard:', err);
                importUserIdInput.style.display = 'block';
                importUserDataBtn.querySelector('.animated-btn-text').textContent = 'Import';
                importUserDataBtn.querySelector('.animated-btn-icon-wrapper').innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#000000"><path d="M260-160q-91 0-155.5-63T40-377q0-78 47-139t123-78q17-72 85-137t145-65q33 0 56.5 23.5T520-716v242l64-62 56 56-160 160-160-160 56-56 64 62v-242q-76 14-118 73.5T280-520h-20q-58 0-99 41t-41 99q0 58 41 99t99 41h480q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-80q0-48-22-89.5T600-680v-93q74 35 117 103.5T760-520q69 8 114.5 59.5T920-340q0 75-52.5 127.5T740-160H260Zm220-358Z"/></svg>'; 
                alert('Clipboard access denied or failed. Please enter User ID manually.');
            }
        });
    }

    updateRegionalPricingVisibility();
}

export function renderAppSettings(uiSettings) {
    const currencySelect = dom.appSettings?.currencySelect;
    const regionalPricingToggle = dom.appSettings?.regionalPricingToggle;

    if (currencySelect) {
        currencySelect.value = uiSettings.currency;
    }

    if (regionalPricingToggle) {
        regionalPricingToggle.checked = uiSettings.regionalPricingEnabled;
    }
    updateRegionalPricingVisibility();
}
