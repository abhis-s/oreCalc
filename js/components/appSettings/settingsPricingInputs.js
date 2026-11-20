import { currencyData } from '../../data/pricingData.js';
import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { closeModalAnimated, openModal } from '../../utils/modalHistoryManager.js';

import { toMinorUnits } from '../../utils/incomeUtils.js';
import { renderGlobalPricingGrid } from './appSettingsDisplay.js';
import { dom } from '../../dom/domElements.js';
import { showConfirm } from '../../ui/noticeModal.js';

/** @type {WeakSet<Element>} */
const boundPricingControls = new WeakSet();

/** @type {WeakSet<Element>} */
const dirtyPricingModals = new WeakSet();

/**
 * Registers a single event listener per DOM element lifetime.
 *
 * @param {Element | null | undefined} el
 * @param {string} eventName
 * @param {EventListenerOrEventListenerObject} handler
 */
function bindControlOnce(el, eventName, handler) {
    if (!el || boundPricingControls.has(el)) return;
    boundPricingControls.add(el);
    el.addEventListener(eventName, handler);
}

/**
 * Initializes pricing, cloud sync toggle, and support/transparency sections.
 */
export function initializeSettingsPricing() {
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

    if (cloudSyncToggle) {
        cloudSyncToggle.checked = state.uiSettings.cloudSync !== false;
        bindControlOnce(cloudSyncToggle, 'change', async () => {
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
                }, false, { preferencesOnly: true });
            } else {
                handleStateUpdate(() => {
                    state.uiSettings.cloudSync = true;
                }, false, { preferencesOnly: true });
            }
        });
    }

    bindControlOnce(currencySelect, 'change', (e) => {
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
        }, false, { preferencesOnly: true });
    });

    bindControlOnce(resetGlobalPricingBtn, 'click', async () => {
        if (await showConfirm(translate('confirms.resetGlobalPricing'))) {
            const selectedCurrency = globalPricingCurrencySelect ? globalPricingCurrencySelect.value : state.uiSettings.currency.code;
            handleStateUpdate(() => {
                const activeTag = state.savedPlayerTags[0];
                if (state.allPlayersData[activeTag]?.currency?.globalPricing?.[selectedCurrency]) {
                    delete state.allPlayersData[activeTag].currency.globalPricing[selectedCurrency];
                }
            });
            renderGlobalPricingGrid(selectedCurrency);
            if (globalPricingModal) dirtyPricingModals.delete(globalPricingModal);
        }
    });

    if (openGlobalPricingBtn && globalPricingModal && dom.overlay) {
        bindControlOnce(openGlobalPricingBtn, 'click', () => {
            dirtyPricingModals.delete(globalPricingModal);
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
            openModal(globalPricingModal);
        });

        bindControlOnce(globalPricingCurrencySelect, 'change', (e) => {
            dirtyPricingModals.add(globalPricingModal);
            renderGlobalPricingGrid(/** @type {HTMLSelectElement} */ (e.target).value);
        });

        bindControlOnce(dom.appSettings?.globalPricingGridBody, 'input', () => {
            dirtyPricingModals.add(globalPricingModal);
        });

        const closeGlobalPricing = async (isCancel = false) => {
            if (isCancel && dirtyPricingModals.has(globalPricingModal)) {
                if (await showConfirm(translate('views.settings.globalPricing.modal.confirmCancel'))) {
                    closeModalAnimated(globalPricingModal);
                }
            } else {
                closeModalAnimated(globalPricingModal);
            }
        };

        const closeBtn = document.getElementById('close-global-pricing-modal-btn');
        bindControlOnce(closeBtn, 'click', () => closeGlobalPricing(true));
        bindControlOnce(cancelGlobalPricingBtn, 'click', () => closeGlobalPricing(true));

        bindControlOnce(saveGlobalPricingBtn, 'click', () => {
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
                    const parsedFloat = parseFloat(val);
                    if (tierKey && !isNaN(parsedFloat)) {
                        newPricing[tierKey] = toMinorUnits(parsedFloat, selectedCurrency);
                    }
                }
            });

            handleStateUpdate(() => {
                const activeTag = state.savedPlayerTags[0];

                state.uiSettings.currency = {
                    code: selectedCurrency
                };

                if (currencySelect) {
                    currencySelect.value = selectedCurrency;
                }

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

            dirtyPricingModals.delete(globalPricingModal);

            setTimeout(() => {
                saveGlobalPricingBtn.disabled = false;
                saveGlobalPricingBtn.textContent = originalText;
                closeGlobalPricing(false);
            }, 500);
        });
    }
}
