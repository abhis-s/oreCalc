import { currencyData } from '../../data/pricingData.js';
import { developmentSupportData, transparencyData } from '../../data/supportData.js';
import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { closeModalAnimated } from '../../utils/modalHistoryManager.js';

import { renderGlobalPricingGrid, renderLabeledActions } from './appSettingsDisplay.js';
import { dom } from '../../dom/domElements.js';
import { showConfirm } from '../../ui/noticeModal.js';

/**
 * Initializes pricing, cloud sync toggle, and support/transparency sections.
 */
export function initializeSettingsPricing() {
    renderLabeledActions('.development-list', developmentSupportData);
    renderLabeledActions('.transparency-list', transparencyData);

    const currencySelect = dom.appSettings?.currencySelect;
    const openGlobalPricingBtn = dom.appSettings?.openGlobalPricingBtn;

    const {
        globalPricingModal,
        globalPricingCurrencySelect,
        saveGlobalPricingBtn,
        resetGlobalPricingBtn,
        cancelGlobalPricingBtn,
        cloudSyncToggle
    } = dom.appSettings || {};

    let isGlobalPricingDirty = false;

    if (cloudSyncToggle) {
        cloudSyncToggle.checked = state.uiSettings.cloudSync !== false;
        cloudSyncToggle.addEventListener('change', async () => {
            const newState = cloudSyncToggle.checked;
            if (!newState) {
                const confirmed = await showConfirm(
                    translate('confirms.cloudSyncOptOut'),
                    'status.warning',
                    'actions.confirm'
                );
                if (!confirmed) {
                    cloudSyncToggle.checked = true;
                    return;
                }
                handleStateUpdate(() => {
                    state.uiSettings.cloudSync = false;
                });
            } else {
                handleStateUpdate(() => {
                    state.uiSettings.cloudSync = true;
                });
            }
        });
    }

    if (currencySelect) {
        currencySelect.addEventListener('change', (e) => {
            handleStateUpdate(() => {
                const selectedCurrency = /** @type {HTMLSelectElement} */ (e.target).value;
                state.uiSettings.currency = {
                    code: selectedCurrency
                };
                const activeTag = state.savedPlayerTags[0];
                if (activeTag && state.allPlayersData[activeTag]) {
                    if (!state.allPlayersData[activeTag].currency) {
                        state.allPlayersData[activeTag].currency = { code: selectedCurrency, globalPricing: {} };
                    } else {
                        state.allPlayersData[activeTag].currency.code = selectedCurrency;
                    }
                }
            });
        });
    }

    if (resetGlobalPricingBtn) {
        resetGlobalPricingBtn.addEventListener('click', async () => {
            if (await showConfirm(translate('confirms.resetGlobalPricing'))) {
                const selectedCurrency = globalPricingCurrencySelect ? globalPricingCurrencySelect.value : state.uiSettings.currency.code;
                handleStateUpdate(() => {
                    const activeTag = state.savedPlayerTags[0];
                    if (state.allPlayersData[activeTag]?.currency?.globalPricing?.[selectedCurrency]) {
                        delete state.allPlayersData[activeTag].currency.globalPricing[selectedCurrency];
                    }
                });
                renderGlobalPricingGrid(selectedCurrency);
                isGlobalPricingDirty = false;
            }
        });
    }

    if (openGlobalPricingBtn && globalPricingModal && dom.overlay) {
        openGlobalPricingBtn.addEventListener('click', () => {
            isGlobalPricingDirty = false;
            if (globalPricingCurrencySelect) {
                globalPricingCurrencySelect.innerHTML = '';
                Object.keys(currencyData).forEach(code => {
                    const option = document.createElement('option');
                    option.value = code;
                    option.textContent = `${currencyData[code].symbol} ${code}`;
                    globalPricingCurrencySelect.appendChild(option);
                });
                globalPricingCurrencySelect.value = state.uiSettings.currency.code;
                renderGlobalPricingGrid(globalPricingCurrencySelect.value);
            }
            globalPricingModal.classList.add('show');
            dom.overlay?.classList.add('show');
        });

        globalPricingCurrencySelect?.addEventListener('change', (e) => {
            isGlobalPricingDirty = true;
            renderGlobalPricingGrid(/** @type {HTMLSelectElement} */ (e.target).value);
        });

        dom.appSettings?.globalPricingGridBody?.addEventListener('input', () => {
            isGlobalPricingDirty = true;
        });

        const closeGlobalPricing = async (isCancel = false) => {
            if (isCancel && isGlobalPricingDirty) {
                if (await showConfirm(translate('views.settings.globalPricingModal.confirmCancel'))) {
                    closeModalAnimated(globalPricingModal);
                }
            } else {
                closeModalAnimated(globalPricingModal);
            }
        };

        const closeBtn = document.getElementById('close-global-pricing-modal-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => closeGlobalPricing(true));
        }

        cancelGlobalPricingBtn?.addEventListener('click', () => closeGlobalPricing(true));

        saveGlobalPricingBtn?.addEventListener('click', () => {
            if (!globalPricingCurrencySelect || !dom.appSettings?.globalPricingGridBody) return;

            const originalText = saveGlobalPricingBtn.textContent;
            saveGlobalPricingBtn.disabled = true;
            saveGlobalPricingBtn.textContent = translate('actions.save');

            const selectedCurrency = globalPricingCurrencySelect.value;
            const inputs = dom.appSettings.globalPricingGridBody.querySelectorAll('input');
            const newPricing = {};

            inputs.forEach(input => {
                let val = input.value.trim();
                if (val !== '') {
                    val = val.replace(',', '.');
                    const tierKey = input.dataset.tierKey;
                    if (tierKey) {
                        newPricing[tierKey] = val;
                    }
                }
            });

            handleStateUpdate(() => {
                const activeTag = state.savedPlayerTags[0];

                state.uiSettings.currency = {
                    code: selectedCurrency
                };

                if (!state.allPlayersData[activeTag].currency) {
                    state.allPlayersData[activeTag].currency = { code: selectedCurrency, globalPricing: {} };
                } else {
                    state.allPlayersData[activeTag].currency.code = selectedCurrency;
                }
                if (!state.allPlayersData[activeTag].currency.globalPricing) {
                    state.allPlayersData[activeTag].currency.globalPricing = {};
                }
                state.allPlayersData[activeTag].currency.globalPricing[selectedCurrency] = newPricing;
            });

            isGlobalPricingDirty = false;

            setTimeout(() => {
                saveGlobalPricingBtn.disabled = false;
                saveGlobalPricingBtn.textContent = originalText;
                closeGlobalPricing(false);
            }, 500);
        });
    }
}
