import { handleStateUpdate, updateUIWithTranslations, applyTheme } from '../../app.js';
import { removePlayerTag } from '../../core/localStorageManager.js';
import { state } from '../../core/state.js';
import { currencyData, priceTierRegistry, languagesData, transparencyData, developmentSupportData } from '../../data/appData.js';
import { dom } from '../../dom/domElements.js';

import { deleteUserData, fetchPlayerData, erasePlayerTagFromAllUsers, submitBugReport } from '../../services/apiService.js';
import { getChangelogHtml } from '../../services/changelogService.js';

import { renderApp } from '../../core/renderer.js';
import { showAlert, showConfirm } from '../../ui/noticeModal.js';
import { showChangelogModal } from '../changelog/changelogModal.js';

import { importUserData, triggerCloudSave } from '../../utils/cloudSaveHandler.js';
import { getSVG } from '../../utils/svgManager.js';
import { addCurrencyValidation } from '../../utils/inputValidator.js';
import { formatCurrency } from '../../utils/numberFormatter.js';
import { isValidUUID } from '../../utils/uuidGenerator.js';
import { validatePlayerTagInput } from '../../utils/playerTagValidator.js';

import { loadTranslations, translate } from '../../i18n/translator.js';
import { logger } from '../../utils/logger.js';

function populateDropdowns() {
    const languageSelect = dom.appSettings?.languageSelect;
    const currencySelect = dom.appSettings?.currencySelect;

    if (languageSelect) {
        languageSelect.innerHTML = '';
        languagesData.forEach(lang => {
            const option = document.createElement('option');
            option.value = lang.code;
            option.dataset.i18nLangName = lang.nameI18n;
            option.dataset.nativeName = lang.nativeName || '';
            option.dataset.fallbackName = lang.fallbackName || 'Unknown';
            
            const translatedName = translate(lang.nameI18n);
            const nativeName = lang.nativeName;
            const fallbackName = lang.fallbackName;

            let displayName;
            if (!nativeName || !translatedName || translatedName.startsWith('[EN]')) {
                displayName = fallbackName;
            } else if (nativeName === translatedName) {
                displayName = nativeName;
            } else {
                displayName = `${nativeName} (${translatedName})`;
            }

            option.textContent = displayName;
            languageSelect.appendChild(option);
        });
    }

    if (currencySelect) {
        currencySelect.innerHTML = '';
        Object.keys(currencyData).forEach(code => {
            const currency = currencyData[code];
            if (currency.enabled) {
                const option = document.createElement('option');
                option.value = code;
                option.textContent = `${currency.symbol} ${code}`;
                currencySelect.appendChild(option);
            }
        });
    }
}

function renderLabeledActions(containerSelector, data) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    container.innerHTML = '';

    data.forEach(item => {
        const itemRow = document.createElement('div');
        itemRow.className = 'settings-item';

        const labelWrapper = document.createElement('div');
        labelWrapper.className = 'settings-item-label-wrapper';

        const label = document.createElement('label');
        label.className = 'settings-item-label';
        label.dataset.i18n = item.i18nLabel;
        label.textContent = translate(item.i18nLabel);
        labelWrapper.appendChild(label);

        if (item.badge) {
            const badge = document.createElement('span');
            badge.className = 'coming-soon-badge';
            badge.dataset.i18n = item.badge;
            badge.textContent = translate(item.badge);
            labelWrapper.appendChild(badge);
        }

        itemRow.appendChild(labelWrapper);

        const btn = document.createElement('button');
        btn.className = `animated-btn ${item.colorClass}`;
        btn.id = `manual-${item.id}-btn`;
        label.htmlFor = btn.id;

        if (item.actionType === 'link') {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const confirmed = await showConfirm(translate('confirms.externalLink'));
                if (confirmed) {
                    window.open(item.url, '_blank', 'noopener,noreferrer');
                }
            });
        }

        const btnText = document.createElement('span');
        btnText.className = 'animated-btn-text';
        if (item.id === 'version') {
            const versionText = state.appVersion || 'v2.0.0';
            btnText.textContent = versionText;
        } else {
            btnText.dataset.i18n = item.i18nAction;
            btnText.textContent = translate(item.i18nAction);
        }

        const iconWrapper = document.createElement('span');
        iconWrapper.className = 'animated-btn-icon-wrapper';
        iconWrapper.innerHTML = getSVG(item.icon, '', 24, 24, 'currentColor');

        btn.appendChild(iconWrapper);
        btn.appendChild(btnText);
        itemRow.appendChild(btn);
        container.appendChild(itemRow);

        label.addEventListener('click', (e) => {
            e.preventDefault();
            btn.click();
        });

        // Add special handler for modal/placeholder actions
        if (item.actionType === 'modal') {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (item.id === 'changelog') {
                    const content = getChangelogHtml();
                    showChangelogModal(content);
                } else if (item.id === 'bugReport') {
                    openBugReportModal();
                }
            });
        } else if (item.actionType === 'placeholder') {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                showAlert(translate('app.comingSoon'));
            });
        }
    });
}

function renderGlobalPricingGrid(currencyCode) {
    const gridBody = dom.appSettings?.globalPricingGridBody;
    const customHeader = dom.appSettings?.globalPricingCustomHeader;
    const resetBtn = dom.appSettings?.resetGlobalPricingBtn;
    if (!gridBody) return;

    gridBody.innerHTML = '';
    if (customHeader) {
        customHeader.textContent = currencyCode;
    }

    const activeTag = state.savedPlayerTags[0];
    const playerState = state.allPlayersData[activeTag];
    const customPricing = playerState?.currency?.globalPricing?.[currencyCode] || {};

    if (resetBtn) {
        if (Object.keys(customPricing).length > 0) {
            resetBtn.style.display = 'block';
        } else {
            resetBtn.style.display = 'none';
        }
    }

    const tiers = Object.keys(priceTierRegistry).sort((a, b) => {
        const numA = parseInt(a.replace('tier', ''));
        const numB = parseInt(b.replace('tier', ''));
        return numA - numB;
    });

    tiers.forEach(tierKey => {
        const tierData = priceTierRegistry[tierKey];
        const usdPrice = tierData.USD.toFixed(2);
        
        const row = document.createElement('div');
        row.className = 'global-pricing-row';

        const labelSpan = document.createElement('span');
        const labelText = tierData.i18nKey ? translate(tierData.i18nKey, tierData.i18nArgs || {}) : (tierData.label || tierKey);
        labelSpan.textContent = labelText;
        labelSpan.title = `USD: $${usdPrice}`;
        row.appendChild(labelSpan);

        const input = document.createElement('input');
        input.type = 'text';
        input.id = `pricing-tier-${tierKey}`;
        input.name = `pricing-tier-${tierKey}`;
        input.inputMode = 'decimal';
        input.dataset.usdPrice = usdPrice;
        input.dataset.tierKey = tierKey;
        
        const defaultPrice = tierData[currencyCode];
        if (typeof defaultPrice === 'number') {
            input.placeholder = formatCurrency(defaultPrice);
        } else {
            input.placeholder = defaultPrice || '';
        }
        
        const rawValue = customPricing[tierKey] || customPricing[usdPrice] || '';
        if (rawValue !== '') {
            const floatVal = parseFloat(rawValue);
            input.value = !isNaN(floatVal) ? formatCurrency(floatVal) : rawValue;
        } else {
            input.value = '';
        }

        addCurrencyValidation(input);
        row.appendChild(input);

        gridBody.appendChild(row);
    });
}

function openBugReportModal() {
    const modal = document.getElementById('bug-report-modal');
    if (!modal) return;

    const emailInput = document.getElementById('bug-report-email');
    const emailError = document.getElementById('bug-report-email-error');
    const descTextarea = document.getElementById('bug-report-desc');
    const descError = document.getElementById('bug-report-desc-error');
    const charCount = document.getElementById('bug-report-char-count');
    
    const attachCheckbox = document.getElementById('bug-report-attach-checkbox');
    const submitBtn = document.getElementById('submit-bug-report-btn');
    const closeHeaderBtn = document.getElementById('close-bug-report-header-btn');
    const closeBtn = document.getElementById('close-bug-report-modal-btn');

    // Reset Form
    if (emailInput) {
        emailInput.value = '';
        emailInput.classList.remove('input-error');
    }
    if (emailError) {
        emailError.textContent = '';
        emailError.classList.remove('show');
    }
    if (descTextarea) {
        descTextarea.value = '';
        descTextarea.classList.remove('input-error');
    }
    if (descError) {
        descError.textContent = '';
        descError.classList.remove('show');
    }
    if (charCount) {
        charCount.textContent = '0/1000';
    }
    if (attachCheckbox) {
        attachCheckbox.checked = false;
    }

    // Set up Input Listeners (Character Counter)
    if (descTextarea && charCount) {
        descTextarea.oninput = () => {
            const len = descTextarea.value.length;
            charCount.textContent = `${len}/1000`;
            if (len >= 20) {
                descTextarea.classList.remove('input-error');
                if (descError) {
                    descError.textContent = '';
                    descError.classList.remove('show');
                }
            }
        };
    }

    if (emailInput && emailError) {
        emailInput.oninput = () => {
            emailInput.classList.remove('input-error');
            emailError.textContent = '';
            emailError.classList.remove('show');
        };
    }

    // Close Handlers
    const closeModal = () => {
        modal.classList.remove('show');
        if (dom.overlay) dom.overlay.classList.remove('show');
    };

    if (closeHeaderBtn) {
        closeHeaderBtn.onclick = (e) => {
            e.preventDefault();
            closeModal();
        };
    }

    if (closeBtn) {
        closeBtn.onclick = (e) => {
            e.preventDefault();
            closeModal();
        };
    }

    // Submit Handler
    if (submitBtn) {
        submitBtn.onclick = async (e) => {
            e.preventDefault();
            
            const email = emailInput ? emailInput.value.trim() : '';
            const description = descTextarea ? descTextarea.value.trim() : '';

            // Validate description (must be at least 20 characters)
            if (description.length < 20) {
                if (descError) {
                    descError.textContent = translate('errors.bugDescriptionRequired');
                    descError.classList.add('show');
                }
                if (descTextarea) {
                    descTextarea.classList.add('input-error');
                    descTextarea.classList.remove('shake');
                    void descTextarea.offsetWidth; // force reflow
                    descTextarea.classList.add('shake');
                }
                return;
            }

            // Validate email (optional)
            if (email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    if (emailError) {
                        emailError.textContent = translate('errors.invalidEmail');
                        emailError.classList.add('show');
                    }
                    if (emailInput) {
                        emailInput.classList.add('input-error');
                        emailInput.classList.remove('shake');
                        void emailInput.offsetWidth; // force reflow
                        emailInput.classList.add('shake');
                    }
                    return;
                }
            }

            // Disable buttons and show loading feedback
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = translate('actions.processing');
            if (closeBtn) closeBtn.disabled = true;

            try {
                const currentUserId = localStorage.getItem('oreCalcUserId') || 'unknown';
                
                let attachedData = null;
                if (attachCheckbox && attachCheckbox.checked) {
                    // Clone current state
                    const stateClone = JSON.parse(JSON.stringify(state));
                    attachedData = {
                        ...stateClone,
                        userId: currentUserId
                    };
                }
                
                await submitBugReport(email, description, attachedData, currentUserId);
                
                closeModal();
                await showAlert(translate('alerts.bugReportSuccess'), 'status.success');
            } catch (err) {
                logger.error('Error submitting bug report:', err);
                let errMsg = translate('alerts.bugReportFailure');
                if (err.message && err.message.startsWith('apiErrors.')) {
                    errMsg = translate(err.message);
                } else if (err.message) {
                    errMsg = `${errMsg} (${err.message})`;
                }
                await showAlert(errMsg, 'status.error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
                if (closeBtn) closeBtn.disabled = false;
            }
        };
    }


    // Handle privacy link click
    const privacyLink = modal.querySelector('#bug-report-privacy-link');
    if (privacyLink) {
        privacyLink.onclick = async (e) => {
            e.preventDefault();
            await showAlert(translate('app.comingSoon') || 'Coming Soon!', 'status.info');
        };
    }

    // Show modal and overlay
    modal.classList.add('show');
    if (dom.overlay) dom.overlay.classList.add('show');
}

export function initializeAppSettings() {
    let isGlobalPricingDirty = false;

    populateDropdowns();
    renderLabeledActions('.development-list', developmentSupportData);
    renderLabeledActions('.transparency-list', transparencyData);

    const currencySelect = dom.appSettings?.currencySelect;
    const languageSelect = dom.appSettings?.languageSelect;
    const openGlobalPricingBtn = dom.appSettings?.openGlobalPricingBtn;
    
    const {
        resetLocalBtn,
        resetCloudBtn,
        completeDeleteBtn,
        appVersionDisplay,
        accentColorSwatches,
        downloadUserDataBtn,
        importUserDataBtn,
        userIdDisplayLabel,
        copyUserIdBtn,
        openDataErasureBtn,
        dataErasureModal,
        closeDataErasureModalBtn,
        importModal,
        importModalInput,
        importModalError,
        cancelImportBtn,
        confirmImportBtn,
        globalPricingModal,
        closeGlobalPricingModalBtn,
        globalPricingCurrencySelect,
        saveGlobalPricingBtn,
        resetGlobalPricingBtn,
        cancelGlobalPricingBtn,
        deleteModal,
        deleteTagContainer,
        deleteTokenContainer,
        deleteTagInput,
        deleteTokenInput,
        deleteTagError,
        deleteTokenError,
        deleteModalActionsValidate,
        deleteModalActionsVerify,
        cancelDeletePlayerBtn,
        validateDeletePlayerBtn,
        cancelDeleteVerifyBtn,
        verifyDeletePlayerBtn,
        cloudSyncToggle
    } = dom.appSettings || {};

    if (cloudSyncToggle) {
        cloudSyncToggle.checked = state.uiSettings.cloudSync !== false;
        cloudSyncToggle.addEventListener('change', async () => {
            const newState = cloudSyncToggle.checked;
            if (!newState) {
                const confirmed = await showConfirm(
                    translate('confirms.cloudSyncOptOut') || "Opting out of data sync will cause this device to stop synchronizing with others. You may lose data if not backed up manually. Proceed?",
                    'status.warning',
                    'actions.confirm'
                );
                if (!confirmed) {
                    cloudSyncToggle.checked = true;
                    return;
                }
            }
            handleStateUpdate(() => {
                state.uiSettings.cloudSync = newState;
            });
        });
    }

    if (!currencySelect) return;

    currencySelect.addEventListener('change', (e) => {
        handleStateUpdate(() => {
            const selectedCurrency = e.target.value;
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

    if (languageSelect) {
        languageSelect.addEventListener('change', async (e) => {
            const newLanguage = e.target.value;
            await loadTranslations(newLanguage);

            handleStateUpdate(() => {
                state.uiSettings.language = newLanguage;
            });
            
            updateUIWithTranslations();
            renderApp(state);
            
            const event = new Event('languageChanged');
            document.dispatchEvent(event);
        });
    }

    if (resetGlobalPricingBtn) {
        resetGlobalPricingBtn.addEventListener('click', async () => {
            if (await showConfirm(translate('confirms.resetGlobalPricing'))) {
                const selectedCurrency = globalPricingCurrencySelect.value;
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
            dom.overlay.classList.add('show');
        });

        globalPricingCurrencySelect?.addEventListener('change', (e) => {
            isGlobalPricingDirty = true;
            renderGlobalPricingGrid(e.target.value);
        });

        dom.appSettings?.globalPricingGridBody?.addEventListener('input', () => {
            isGlobalPricingDirty = true;
        });

        const closeGlobalPricing = async (isCancel = false) => {
            if (isCancel && isGlobalPricingDirty) {
                if (await showConfirm(translate('settings.globalPricingModal.confirmCancel'))) {
                    globalPricingModal.classList.remove('show');
                    dom.overlay.classList.remove('show');
                }
            } else {
                globalPricingModal.classList.remove('show');
                dom.overlay.classList.remove('show');
            }
        };

        const closeBtn = document.getElementById('close-global-pricing-modal-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => closeGlobalPricing(true));
        }

        cancelGlobalPricingBtn?.addEventListener('click', () => closeGlobalPricing(true));

        saveGlobalPricingBtn?.addEventListener('click', () => {
            const originalText = saveGlobalPricingBtn.textContent;
            saveGlobalPricingBtn.disabled = true;
            saveGlobalPricingBtn.textContent = translate('actions.save'); // Using "Save" as feedback is enough with disabled state

            const selectedCurrency = globalPricingCurrencySelect.value;
            const inputs = dom.appSettings.globalPricingGridBody.querySelectorAll('input');
            const newPricing = {};

            inputs.forEach(input => {
                let val = input.value.trim();
                if (val !== '') {
                    // Normalize: replace German comma with dot before saving
                    val = val.replace(',', '.');
                    newPricing[input.dataset.tierKey] = val;
                }
            });

            handleStateUpdate(() => {
                const activeTag = state.savedPlayerTags[0];
                
                // Update active UI currency to the one just configured
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

    const enableLevelInputToggle = dom.equipment?.enableLevelInputToggle;
    const themeToggle = document.getElementById('settings-theme-toggle');

    if (themeToggle) {
        themeToggle.checked = state.uiSettings.theme === 'light';
        themeToggle.addEventListener('change', (e) => {
            const newTheme = e.target.checked ? 'light' : 'dark';
            
            // Calculate center of the switch for circular reveal
            const rect = e.target.closest('.switch').getBoundingClientRect();
            const origin = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };

            handleStateUpdate(() => {
                state.uiSettings.theme = newTheme;
            }, true);
            applyTheme(newTheme, origin);
        });
    }

    const mobileAccentPickerBtn = dom.appSettings?.mobileAccentPickerBtn;
    const accentPickerModal = dom.appSettings?.accentPickerModal;
    const mobileAccentSwatches = dom.appSettings?.mobileAccentSwatches;
    const closeAccentPickerBtn = dom.appSettings?.closeAccentPickerBtn;

    const handleAccentChange = (color, element) => {
        // For accent color changes, also use the swatch center as origin
        const rect = element.getBoundingClientRect();
        const origin = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            isSwatchClick: true
        };

        handleStateUpdate(() => {
            state.uiSettings.accentColor = color;
        }, true);
        
        if (accentColorSwatches) {
            accentColorSwatches.forEach(s => s.classList.toggle('active', s.dataset.color === color));
        }
        if (mobileAccentSwatches) {
            mobileAccentSwatches.forEach(s => s.classList.toggle('active', s.dataset.color === color));
        }
        
        applyTheme(state.uiSettings.theme, origin);
    };

    if (mobileAccentPickerBtn && accentPickerModal) {
        mobileAccentPickerBtn.addEventListener('click', () => {
            accentPickerModal.classList.add('show');
            dom.overlay.classList.add('show');
        });

        const closeMobilePicker = () => {
            accentPickerModal.classList.remove('show');
            dom.overlay.classList.remove('show');
        };

        closeAccentPickerBtn?.addEventListener('click', closeMobilePicker);
        // Do not add overlay click here as it might conflict with other modals
        // or just let it close all modals

        if (mobileAccentSwatches) {
            mobileAccentSwatches.forEach(swatch => {
                swatch.addEventListener('click', (e) => {
                    const color = e.target.dataset.color;
                    handleAccentChange(color, e.target);
                    closeMobilePicker();
                });
            });
        }
    }

    if (accentColorSwatches) {
        accentColorSwatches.forEach(swatch => {
            swatch.addEventListener('click', (e) => {
                const color = e.target.dataset.color;
                handleAccentChange(color, e.target);
            });
        });
    }

    if (enableLevelInputToggle) {
        enableLevelInputToggle.checked = state.uiSettings.enableLevelInput;

        enableLevelInputToggle.addEventListener('change', (e) => {
            handleStateUpdate(() => {
                state.uiSettings.enableLevelInput = e.target.checked;
            });
        });
    }

    const hideMaxedToggle = dom.equipment?.hideMaxedToggle;
    if (hideMaxedToggle) {
        hideMaxedToggle.checked = state.uiSettings.hideMaxedEquipment;

        hideMaxedToggle.addEventListener('change', (e) => {
            handleStateUpdate(() => {
                state.uiSettings.hideMaxedEquipment = e.target.checked;
            });
        });
    }

    const hideLockedToggle = dom.equipment?.hideLockedToggle;
    if (hideLockedToggle) {
        hideLockedToggle.checked = state.uiSettings.hideLockedEquipment;

        hideLockedToggle.addEventListener('change', (e) => {
            handleStateUpdate(() => {
                state.uiSettings.hideLockedEquipment = e.target.checked;
            });
        });
    }

    const downloadDataModal = dom.appSettings?.downloadDataModal;
    const closeDownloadDataModalBtn = dom.appSettings?.closeDownloadDataModalBtn;
    const confirmDownloadDataBtn = dom.appSettings?.confirmDownloadDataBtn;
    const cancelDownloadDataBtn = dom.appSettings?.cancelDownloadDataBtn;
    const downloadFilenamePreview = dom.appSettings?.downloadFilenamePreview;

    if (downloadUserDataBtn && downloadDataModal) {
        const closeDownloadModal = () => {
            downloadDataModal.classList.remove('show');
            dom.overlay.classList.remove('show');
            if (confirmDownloadDataBtn) {
                confirmDownloadDataBtn.disabled = false;
                confirmDownloadDataBtn.textContent = translate('actions.download');
            }
        };

        downloadUserDataBtn.addEventListener('click', () => {
            const currentUserId = localStorage.getItem('oreCalcUserId') || 'unknown';
            if (downloadFilenamePreview) {
                downloadFilenamePreview.innerHTML = translate('download.filenameInfo', { uuid: currentUserId });
            }
            downloadDataModal.classList.add('show');
            dom.overlay.classList.add('show');
        });

        closeDownloadDataModalBtn?.addEventListener('click', closeDownloadModal);
        cancelDownloadDataBtn?.addEventListener('click', closeDownloadModal);

        confirmDownloadDataBtn?.addEventListener('click', () => {
            const originalText = confirmDownloadDataBtn.textContent;
            confirmDownloadDataBtn.disabled = true;
            confirmDownloadDataBtn.textContent = translate('actions.processing');

            const currentUserId = localStorage.getItem('oreCalcUserId') || 'unknown';
            const dataToExport = {
                ...state,
                userId: currentUserId
            };
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToExport, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `OreCalc-Data_${currentUserId}.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            
            setTimeout(() => {
                confirmDownloadDataBtn.disabled = false;
                confirmDownloadDataBtn.textContent = originalText;
                closeDownloadModal();
            }, 500);
        });
    }

    if (resetLocalBtn) {
        resetLocalBtn.addEventListener('click', async () => {
            if (dom.appSettings?.dataErasureModal) dom.appSettings.dataErasureModal.classList.remove('show');
            if (await showConfirm(translate('confirms.resetAll'), 'status.confirm', 'actions.reset')) {
                window.resetApplication();
            } else {
                if (dom.appSettings?.dataErasureModal) dom.appSettings.dataErasureModal.classList.add('show');
            }
        });
    }

    if (resetCloudBtn) {
        resetCloudBtn.addEventListener('click', async () => {
            if (dom.appSettings?.dataErasureModal) dom.appSettings.dataErasureModal.classList.remove('show');
            if (await showConfirm(translate('confirms.resetAll'), 'status.confirm', 'actions.reset')) {
                const currentUserId = localStorage.getItem('oreCalcUserId');
                if (currentUserId) {
                    await deleteUserData(currentUserId);
                }
                window.resetApplication();
            } else {
                if (dom.appSettings?.dataErasureModal) dom.appSettings.dataErasureModal.classList.add('show');
            }
        });
    }

    if (completeDeleteBtn && deleteModal) {
        const closeDeleteModal = () => {
            deleteModal.classList.remove('show');
            dom.overlay.classList.remove('show');
            if (deleteTagInput) deleteTagInput.value = '';
            if (deleteTokenInput) deleteTokenInput.value = '';
            if (deleteTagError) deleteTagError.textContent = '';
            if (deleteTokenError) deleteTokenError.textContent = '';
            if (deleteTagInput) deleteTagInput.disabled = false;
            if (deleteTokenContainer) deleteTokenContainer.classList.add('hidden');
            if (deleteModalActionsValidate) deleteModalActionsValidate.classList.remove('hidden');
            if (deleteModalActionsVerify) deleteModalActionsVerify.classList.add('hidden');
            if (validateDeletePlayerBtn) {
                validateDeletePlayerBtn.disabled = false;
                validateDeletePlayerBtn.textContent = translate('actions.validate');
            }
            if (verifyDeletePlayerBtn) {
                verifyDeletePlayerBtn.disabled = false;
                verifyDeletePlayerBtn.textContent = translate('actions.verify');
            }
        };

        completeDeleteBtn.addEventListener('click', () => {
            if (dom.appSettings?.dataErasureModal) {
                dom.appSettings.dataErasureModal.classList.remove('show');
            }
            deleteModal.classList.add('show');
            dom.overlay.classList.add('show');
        });

        cancelDeletePlayerBtn?.addEventListener('click', closeDeleteModal);
        cancelDeleteVerifyBtn?.addEventListener('click', closeDeleteModal);

        validateDeletePlayerBtn?.addEventListener('click', async () => {
            const tag = deleteTagInput.value.trim();
            if (!tag) {
                deleteTagError.textContent = translate('errors.playerTagRequired');
                
                // Visual Feedback: Shake
                deleteTagInput.classList.remove('shake');
                void deleteTagInput.offsetWidth; // Force reflow
                deleteTagInput.classList.add('shake');
                return;
            }
            try {
                validateDeletePlayerBtn.disabled = true;
                const playerData = await fetchPlayerData(tag);
                
                // Canonical tag correction: replace user input with official tag from API (cleaned)
                if (playerData && playerData.tag) {
                    const canonicalTag = playerData.tag.startsWith('#') ? playerData.tag.substring(1) : playerData.tag;
                    deleteTagInput.value = canonicalTag.toUpperCase();
                }

                deleteTagError.textContent = '';
                deleteTagInput.disabled = true;
                if (deleteTokenContainer) deleteTokenContainer.classList.remove('hidden');
                if (deleteModalActionsValidate) deleteModalActionsValidate.classList.add('hidden');
                if (deleteModalActionsVerify) deleteModalActionsVerify.classList.remove('hidden');
            } catch (err) {
                // If it's a protection error, the tag is already valid/known to the server
                if (err.message === 'apiErrors.protectedTag') {
                    deleteTagError.textContent = '';
                    deleteTagInput.disabled = true;
                    if (deleteTokenContainer) deleteTokenContainer.classList.remove('hidden');
                    if (deleteModalActionsValidate) deleteModalActionsValidate.classList.add('hidden');
                    if (deleteModalActionsVerify) deleteModalActionsVerify.classList.remove('hidden');
                } else {
                    deleteTagError.textContent = translate(err.message) || "Invalid player tag";
                    
                    // Visual Feedback: Shake
                    deleteTagInput.classList.remove('shake');
                    void deleteTagInput.offsetWidth; // Force reflow
                    deleteTagInput.classList.add('shake');
                }
            } finally {
                validateDeletePlayerBtn.disabled = false;
            }
        });

        verifyDeletePlayerBtn?.addEventListener('click', async () => {
            const tag = deleteTagInput.value.trim();
            const token = deleteTokenInput.value.trim();
            if (!token) {
                deleteTokenError.textContent = translate('errors.tokenRequired');
                
                // Visual Feedback: Shake
                deleteTokenInput.classList.remove('shake');
                void deleteTokenInput.offsetWidth; // Force reflow
                deleteTokenInput.classList.add('shake');
                return;
            }
            try {
                verifyDeletePlayerBtn.disabled = true;
                
                // The server now performs the verification as part of the erasure process.
                // This prevents the one-time token from being consumed prematurely.
                await erasePlayerTagFromAllUsers(tag, token);

                closeDeleteModal();
                await showAlert(translate('alerts.globalErasureSuccess'), "status.success");

                // Wipe everything locally and reload (clearing local state and active User ID)
                if (window.resetApplication) {
                    window.resetApplication();
                } else {
                    localStorage.clear();
                    window.location.reload();
                }
            } catch (err) {
                if (err.message === 'apiErrors.protectedTag' || err.message === 'apiErrors.invalidToken' || err.message === 'apiErrors.403') {
                    deleteTokenError.textContent = translate('apiErrors.invalidToken');
                } else {
                    deleteTokenError.textContent = translate(err.message) || "Verification failed";
                }
                
                // Visual Feedback: Shake
                deleteTokenInput.classList.remove('shake');
                void deleteTokenInput.offsetWidth; // Force reflow
                deleteTokenInput.classList.add('shake');
            } finally {
                verifyDeletePlayerBtn.disabled = false;
            }
        });

        deleteTagInput?.addEventListener('input', (e) => {
            // Validation and error reporting is handled during the click or via a separate listener if needed.
            // For now, let's keep it clean but allow the validator to run.
            const result = validatePlayerTagInput(deleteTagInput, deleteTagError);
            if (result.isValid) {
                // If it's valid, we can keep the cleaned version in the input
                deleteTagInput.value = result.cleanedTag ? '#' + result.cleanedTag : '';
            }
        });

        deleteTokenInput?.addEventListener('input', (e) => {
            // Only allow alphanumeric characters
            e.target.value = e.target.value.replace(/[^a-z0-9]/gi, '');
        });
    }

    if (userIdDisplayLabel) {
        const currentUserId = localStorage.getItem('oreCalcUserId');
        if (currentUserId) {
            const maskedId = currentUserId.length > 8 ? currentUserId.substring(0, 8) + '...' : currentUserId;
            userIdDisplayLabel.textContent = `${translate('settings.options.userId')}: ${maskedId}`;
            userIdDisplayLabel.dataset.fullId = currentUserId;
        }
    }

    const qrCodeModal = dom.appSettings?.qrCodeModal;
    const closeQrCodeModalBtn = dom.appSettings?.closeQrCodeModalBtn;
    const qrCodeContainer = dom.appSettings?.qrCodeContainer;
    const userIdDisplay = dom.appSettings?.userIdDisplay;
    const overlay = dom.overlay;

    if (copyUserIdBtn && userIdDisplayLabel && qrCodeModal && qrCodeContainer && overlay) {
        copyUserIdBtn.addEventListener('click', async () => {
            // 1. Copy Logic
            let copiedSuccessfully = false;
            let messageKey = '';
            if (!navigator.clipboard || !navigator.clipboard.writeText) {
                logger.warn('Clipboard API not supported');
            } else {
                try {
                    await navigator.clipboard.writeText(userIdDisplayLabel.dataset.fullId);
                    
                    // Visual Feedback
                    const originalText = copyUserIdBtn.querySelector('.animated-btn-text').textContent;
                    const textElem = copyUserIdBtn.querySelector('.animated-btn-text');
                    
                    copyUserIdBtn.classList.add('success');
                    if (textElem) textElem.textContent = translate('actions.copied');
                    
                    setTimeout(() => {
                        copyUserIdBtn.classList.remove('success');
                        if (textElem) textElem.textContent = originalText;
                    }, 2000);

                    if (state.uiSettings.cloudSync !== false) {
                        const saveSuccess = await triggerCloudSave({ silent: true });
                        messageKey = saveSuccess ? 'alerts.copyAndSaveSuccess' : 'alerts.copySuccessSaveFailed';
                    } else {
                        messageKey = 'alerts.copySuccess';
                    }
                    copiedSuccessfully = true;
                } catch (err) {
                    logger.error('Failed to copy: ', err);
                }
            }

            // 2. Modal Logic (always show it even if copy failed, so they can manually copy)
            const userId = localStorage.getItem('oreCalcUserId');
            if (userId) {
                const data = window.location.origin + '?userId=' + userId;

                // Clear previous QR code
                qrCodeContainer.innerHTML = '';

                // Get current text color for high contrast dots
                const textPrimaryColor = getComputedStyle(document.body).getPropertyValue('--text-primary').trim();

                const qrCode = new QRCodeStyling({
                    width: 250,
                    height: 250,
                    data: data,
                    image: 'assets/app_icon_small.png',
                    dotsOptions: {
                        color: textPrimaryColor || "#000000",
                        type: "rounded"
                    },
                    backgroundOptions: {
                        color: "transparent",
                    },
                    imageOptions: {
                        crossOrigin: "anonymous",
                        margin: 8
                    },
                    cornersSquareOptions: {
                        type: "extra-rounded",
                        color: textPrimaryColor || "#000000"
                    },
                    cornersDotOptions: {
                        type: "dot",
                        color: textPrimaryColor || "#000000"
                    }
                });

                qrCode.append(qrCodeContainer);

                if (userIdDisplay) {
                    userIdDisplay.textContent = userId;
                }
                
                const instructionElement = qrCodeModal.querySelector('[data-i18n="player.qrDisplayInstruction"]');
                if(instructionElement) {
                    instructionElement.textContent = translate('player.qrDisplayInstruction');
                }
                
                if (dom.appSettings?.qrCopySuccessMessage) {
                    if (copiedSuccessfully) {
                        dom.appSettings.qrCopySuccessMessage.textContent = translate(messageKey);
                        dom.appSettings.qrCopySuccessMessage.classList.remove('hidden');
                    } else {
                        dom.appSettings.qrCopySuccessMessage.classList.add('hidden');
                    }
                }
                
                qrCodeModal.classList.add('show');
                if (overlay) overlay.classList.add('show');
            } else if (!copiedSuccessfully) {
                 await showAlert(translate('alerts.clipboardUnsupported'));
            }
        });

        // Add a click listener to the displayed User ID in the modal to allow copying it from there too
        if (userIdDisplay) {
            userIdDisplay.addEventListener('click', async () => {
                if (!navigator.clipboard || !navigator.clipboard.writeText) {
                    await showAlert(translate('alerts.clipboardUnsupported'));
                    return;
                }
                try {
                    const currentUserId = localStorage.getItem('oreCalcUserId');
                    if (!currentUserId) return;
                    await navigator.clipboard.writeText(currentUserId);
                    let messageKey = '';
                    if (state.uiSettings.cloudSync !== false) {
                        const saveSuccess = await triggerCloudSave({ silent: true });
                        messageKey = saveSuccess ? 'alerts.copyAndSaveSuccess' : 'alerts.copySuccessSaveFailed';
                    } else {
                        messageKey = 'alerts.copySuccess';
                    }
                    if (dom.appSettings?.qrCopySuccessMessage) {
                        dom.appSettings.qrCopySuccessMessage.textContent = translate(messageKey);
                        dom.appSettings.qrCopySuccessMessage.classList.remove('hidden');
                    }
                } catch (err) {
                    logger.error('Failed to copy: ', err);
                    await showAlert(translate('alerts.copiedFailed'));
                }
            });
        }

        if (closeQrCodeModalBtn) {
            closeQrCodeModalBtn.addEventListener('click', () => {
                qrCodeModal.classList.remove('show');
                if (overlay) overlay.classList.remove('show');
                if (dom.appSettings?.qrCopySuccessMessage) {
                    dom.appSettings.qrCopySuccessMessage.classList.add('hidden');
                }
            });
        }

        overlay.addEventListener('click', () => {
            if (qrCodeModal.classList.contains('show')) {
                qrCodeModal.classList.remove('show');
                if (overlay) overlay.classList.remove('show');
                if (dom.appSettings?.qrCopySuccessMessage) {
                    dom.appSettings.qrCopySuccessMessage.classList.add('hidden');
                }
            }
        });
    }

    if (importUserDataBtn && importModal) {
        const closeImportModal = () => {
            importModal.classList.remove('show');
            dom.overlay.classList.remove('show');
            if (importModalInput) importModalInput.value = '';
            if (importModalError) {
                importModalError.textContent = '';
                importModalError.classList.remove('show');
            }
            if (importModalInput) importModalInput.classList.remove('input-error');
            if (confirmImportBtn) {
                confirmImportBtn.disabled = false;
                confirmImportBtn.textContent = translate('actions.import');
            }
        };

        importUserDataBtn.addEventListener('click', async () => {
            let clipboardValue = '';
            try {
                const clipboardText = await navigator.clipboard.readText();
                if (clipboardText) {
                    const trimmed = clipboardText.trim();
                    if (isValidUUID(trimmed)) {
                        clipboardValue = trimmed;
                    }
                }
            } catch (err) {
                logger.warn('Clipboard read failed or denied');
            }

            if (importModalInput) {
                importModalInput.value = clipboardValue;
                if (clipboardValue) {
                    importModalError.textContent = translate('alerts.uuidDetected') || "User ID detected from clipboard";
                    importModalError.classList.add('success-text');
                    importModalError.classList.add('show');
                } else {
                    importModalError.textContent = '';
                    importModalError.classList.remove('show');
                    importModalError.classList.remove('success-text');
                }
            }

            importModal.classList.add('show');
            dom.overlay.classList.add('show');
        });

        cancelImportBtn?.addEventListener('click', closeImportModal);

        confirmImportBtn?.addEventListener('click', async () => {
            const val = importModalInput.value.trim();
            if (isValidUUID(val)) {
                const originalText = confirmImportBtn.textContent;
                try {
                    confirmImportBtn.disabled = true;
                    confirmImportBtn.textContent = translate('actions.processing');
                    
                    await importUserData(val);
                } finally {
                    confirmImportBtn.disabled = false;
                    confirmImportBtn.textContent = originalText;
                }
            } else {
                importModalError.textContent = translate('alerts.invalidUserId') || "Invalid User ID format";
                importModalError.classList.remove('success-text');
                importModalError.classList.add('show');
                importModalInput.classList.add('input-error');
                
                // Interaction Feedback: Shake
                importModalInput.classList.remove('shake');
                void importModalInput.offsetWidth; // Force reflow
                importModalInput.classList.add('shake');
            }
        });

        importModalInput?.addEventListener('input', () => {
            const val = importModalInput.value.trim();
            if (val === '') {
                importModalError.textContent = '';
                importModalError.classList.remove('show');
                importModalInput.classList.remove('input-error');
            } else if (isValidUUID(val)) {
                importModalError.textContent = translate('alerts.uuidDetected') || "User ID detected";
                importModalError.classList.add('success-text');
                importModalError.classList.add('show');
                importModalInput.classList.remove('input-error');
            } else if (val.length === 36) {
                // If it's the right length but still invalid format
                importModalError.textContent = translate('alerts.invalidUserId') || "Invalid User ID format";
                importModalError.classList.remove('success-text');
                importModalError.classList.add('show');
                importModalInput.classList.add('input-error');
            } else {
                // While typing, just hide previous errors
                importModalError.classList.remove('show');
                importModalInput.classList.remove('input-error');
            }
        });

        importModalInput?.addEventListener('paste', (e) => {
            const pasteData = (e.clipboardData || window.clipboardData).getData('text');
            if (pasteData.includes('userId=')) {
                try {
                    const url = new URL(pasteData);
                    const userId = url.searchParams.get('userId');
                    if (userId) {
                        e.preventDefault();
                        importModalInput.value = userId;
                        // Trigger input event to update visual feedback
                        importModalInput.dispatchEvent(new Event('input'));
                    }
                } catch (err) {
                    // Not a valid URL, let default paste happen
                }
            }
        });
    }

    updateUIWithTranslations();

    if (appVersionDisplay) {
        appVersionDisplay.textContent = '| v' + (state.appVersion || '2.0.0').replace(/^v/, '');
    }

    if (openDataErasureBtn && dataErasureModal) {
        openDataErasureBtn.addEventListener('click', () => {
            dataErasureModal.classList.add('show');
            if (dom.overlay) dom.overlay.classList.add('show');
        });
    }

    if (closeDataErasureModalBtn && dataErasureModal) {
        closeDataErasureModalBtn.addEventListener('click', () => {
            dataErasureModal.classList.remove('show');
            if (dom.overlay) dom.overlay.classList.remove('show');
        });
    }

    if (dom.appSettings?.closeDataErasureHeaderBtn && dataErasureModal) {
        dom.appSettings.closeDataErasureHeaderBtn.addEventListener('click', () => {
            dataErasureModal.classList.remove('show');
            if (dom.overlay) dom.overlay.classList.remove('show');
        });
    }

    if (dom.appSettings?.closeDeletePlayerModalBtn && deleteModal) {
        dom.appSettings.closeDeletePlayerModalBtn.addEventListener('click', () => {
            deleteModal.classList.remove('show');
            if (dom.overlay) dom.overlay.classList.remove('show');
        });
    }

    if (dom.appSettings?.closeImportDataModalBtn && importModal) {
        dom.appSettings.closeImportDataModalBtn.addEventListener('click', () => {
            importModal.classList.remove('show');
            if (dom.overlay) dom.overlay.classList.remove('show');
        });
    }
}

export function renderAppSettings(uiSettings) {
    const currencySelect = dom.appSettings?.currencySelect;
    const languageSelect = dom.appSettings?.languageSelect;
    const enableLevelInputToggle = dom.equipment?.enableLevelInputToggle;
    const themeToggle = document.getElementById('settings-theme-toggle');
    const accentColorSwatches = dom.appSettings?.accentColorSwatches;

    if (currencySelect) {
        currencySelect.value = uiSettings.currency.code;
    }

    if (languageSelect) {
        languageSelect.value = uiSettings.language || 'auto';
    }

    if (enableLevelInputToggle) {
        enableLevelInputToggle.checked = uiSettings.enableLevelInput;
    }

    const hideMaxedToggle = dom.equipment?.hideMaxedToggle;
    if (hideMaxedToggle) {
        hideMaxedToggle.checked = uiSettings.hideMaxedEquipment;
    }

    const hideLockedToggle = dom.equipment?.hideLockedToggle;
    if (hideLockedToggle) {
        hideLockedToggle.checked = uiSettings.hideLockedEquipment;
    }

    if (themeToggle) {
        themeToggle.checked = uiSettings.theme === 'light';
    }

    if (accentColorSwatches) {
        accentColorSwatches.forEach(swatch => {
            swatch.classList.toggle('active', swatch.dataset.color === uiSettings.accentColor);
        });
    }

    const mobileAccentSwatches = dom.appSettings?.mobileAccentSwatches;
    if (mobileAccentSwatches) {
        mobileAccentSwatches.forEach(swatch => {
            swatch.classList.toggle('active', swatch.dataset.color === uiSettings.accentColor);
        });
    }

    const cloudSyncToggle = dom.appSettings?.cloudSyncToggle || document.getElementById('settings-cloud-sync-toggle');
    if (cloudSyncToggle) {
        cloudSyncToggle.checked = uiSettings.cloudSync !== false;
    }
}
