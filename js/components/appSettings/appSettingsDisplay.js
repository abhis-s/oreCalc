import { getLocale, languagesData } from '../../data/languagesData.js';
import { currencyData, priceTierRegistry } from '../../data/pricingData.js';
import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';

import { formatDate } from '../../utils/dateUtils.js';
import { addCurrencyValidation } from '../../utils/inputValidator.js';
import { closeModalAnimated } from '../../utils/modalHistoryManager.js';
import { formatCurrency } from '../../utils/numberFormatter.js';
import { getSVG } from '../../utils/svgManager.js';

import { showChangelogModal } from '../changelog/changelogModal.js';
import { openLicensesModal, openPrivacyModal, openTermsOfUseModal } from './settingsLegalModals.js';
import { openBugReportModal, openRunningCostsModal } from './settingsSupportModals.js';
import { dom } from '../../dom/domElements.js';
import { getChangelogHtml } from '../../services/changelogService.js';
import { showAlert, showConfirm } from '../../ui/noticeModal.js';

/**
 * Populates language and currency select dropdown options with localized labels and symbols.
 */
export function populateDropdowns() {
    const languageSelect = dom.appSettings?.languageSelect;
    const currencySelect = dom.appSettings?.currencySelect;

    if (languageSelect) {
        languageSelect.innerHTML = '';
        languagesData.filter(lang => lang.enabled).forEach(lang => {
            const option = document.createElement('option');
            option.value = lang.code;
            option.dataset.i18nLangName = lang.nameI18n;
            option.dataset.nativeName = lang.nativeName || '';
            option.dataset.fallbackName = lang.fallbackName || 'Unknown';

            const name = lang.nativeName || lang.fallbackName;
            const flag = lang.flag ? `${lang.flag} ` : '';
            option.textContent = `${flag}${name}`;
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

/**
 * Formats the application build/update timestamp into a localized date string.
 * @param {string} [locale=state.uiSettings?.language || 'en'] - Target locale identifier.
 * @returns {string} Formatted localized date string.
 */
export function getAppLastUpdatedDateFormatted(locale = state.uiSettings?.language || 'en') {
    let dateObj;
    const swUpdateTime = localStorage.getItem('oreCalc_SWUpdatedTime') || localStorage.getItem('oreCalcSWUpdatedTime');
    if (swUpdateTime) {
        dateObj = new Date(swUpdateTime);
    }
    if (!dateObj || isNaN(dateObj.getTime())) {
        if (window.__ENV__?.BUILD_TIME) {
            dateObj = new Date(window.__ENV__.BUILD_TIME);
        }
    }
    if (!dateObj || isNaN(dateObj.getTime())) {
        dateObj = new Date();
    }
    return formatDate(dateObj, {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }, locale);
}

/**
 * Renders labeled action rows with trigger buttons and help popovers into settings containers.
 * @param {string} containerSelector - Target CSS query selector.
 * @param {Array<any>} data - List of action configuration objects.
 */
export function renderLabeledActions(containerSelector, data) {
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
        if (item.i18nHelp) {
            const labelTextSpan = document.createElement('span');
            labelTextSpan.dataset.i18n = item.i18nLabel;
            labelTextSpan.textContent = translate(item.i18nLabel);
            label.appendChild(labelTextSpan);

            const infoBtn = document.createElement('button');
            infoBtn.className = 'info-btn';
            infoBtn.dataset.info = item.i18nHelp;
            infoBtn.setAttribute('aria-label', translate('actions.showInfo'));
            infoBtn.dataset.i18nAriaLabel = 'actions.showInfo';
            infoBtn.innerHTML = '<orecalc-assets-svg name="info" class="info-icon" height="16" width="16"></orecalc-assets-svg>';

            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.gap = '6px';
            label.style.margin = '0';
            label.style.cursor = 'pointer';

            label.appendChild(infoBtn);
        } else {
            label.dataset.i18n = item.i18nLabel;
            label.textContent = translate(item.i18nLabel);
        }
        labelWrapper.appendChild(label);

        let labelSide = labelWrapper;
        if (item.i18nDesc) {
            const descriptorGroup = document.createElement('div');
            descriptorGroup.className = 'field-descriptor-group';
            descriptorGroup.appendChild(labelWrapper);

            const descPara = document.createElement('p');
            descPara.className = 'form-setting-text';
            descPara.dataset.i18n = item.i18nDesc;

            if (item.id === 'bugReport') {
                const formattedDate = getAppLastUpdatedDateFormatted(state.uiSettings?.language || 'en');
                descPara.dataset.i18nArgs = JSON.stringify({ date: formattedDate });
                descPara.textContent = translate(item.i18nDesc, { date: formattedDate });
            } else {
                descPara.textContent = translate(item.i18nDesc);
            }

            descriptorGroup.appendChild(descPara);
            labelSide = descriptorGroup;
        }

        itemRow.appendChild(labelSide);

        const btn = document.createElement('button');
        btn.className = `animated-btn ${item.colorClass}`;
        btn.id = `manual-${item.id}-btn`;
        label.htmlFor = btn.id;

        if (item.actionType === 'link') {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const confirmed = await showConfirm(
                    `${translate('confirms.externalLink')}<br><code class="external-link-display">${item.url}</code><br><br>${translate('confirms.externalLinkConfirm')}`
                );
                if (confirmed) {
                    window.open(item.url, '_blank', 'noopener,noreferrer');
                }
            });
        }

        const btnText = document.createElement('span');
        btnText.className = 'animated-btn-text';
        if (item.id === 'version') {
            const versionText = window.__ENV__?.APP_VERSION || state.appVersion || '2.2.0';
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
            if (e.target.closest('.info-btn, .info-button, [data-info]')) {
                return;
            }
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
                } else if (item.id === 'contact') {
                    openContactModal();
                } else if (item.id === 'privacy') {
                    openPrivacyModal();
                } else if (item.id === 'termsOfUse') {
                    openTermsOfUseModal();
                } else if (item.id === 'licenses') {
                    openLicensesModal();
                } else if (item.id === 'runningCosts') {
                    openRunningCostsModal();
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

/**
 * Renders the custom global pricing configuration grid for all store price tiers in the selected currency.
 * @param {string} currencyCode - 3-letter currency code (e.g. 'USD', 'EUR').
 */
export function renderGlobalPricingGrid(currencyCode) {
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
        if (tierData.i18nKey) {
            labelSpan.dataset.i18n = tierData.i18nKey;
            if (tierData.i18nArgs) {
                labelSpan.dataset.i18nArgs = JSON.stringify(tierData.i18nArgs);
            }
        }
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

function openContactModal() {
    const modal = document.getElementById('contact-modal');
    if (!modal) return;

    const closeHeaderBtn = document.getElementById('close-contact-header-btn');
    const closeBtn = document.getElementById('close-contact-modal-btn');
    const mailBtn = document.getElementById('contact-mail-btn');

    const closeModal = () => {
        closeModalAnimated(modal);
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

    if (mailBtn) {
        mailBtn.onclick = (e) => {
            e.stopPropagation();
            closeModal();
        };
    }

    modal.classList.add('show');
    if (dom.overlay) dom.overlay.classList.add('show');
}

/**
 * Populates and synchronizes UI input states in the main App Settings modal.
 * @param {import('../../core/types.js').UISettingsState} uiSettings - Active UI settings configuration.
 */
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
        const themeLabel = document.querySelector('label[for="settings-theme-toggle"]');
        if (themeLabel) {
            const labelKey = themeToggle.checked ? 'views.settings.options.themeDark' : 'views.settings.options.themeLight';
            themeLabel.textContent = translate(labelKey);
            themeLabel.setAttribute('data-i18n', labelKey);
        }
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
    const cloudSyncInfo = dom.appSettings?.cloudSyncInfo || document.getElementById('settings-cloud-sync-info');
    const addPlayerLink = dom.appSettings?.addPlayerLink || document.getElementById('settings-add-player-link');
    const hasOnlyDefaultPlayer = state.savedPlayerTags.length === 1 && state.savedPlayerTags[0] === 'DEFAULT0';

    if (cloudSyncToggle) {
        if (hasOnlyDefaultPlayer) {
            cloudSyncToggle.disabled = true;
            cloudSyncToggle.checked = false;
        } else {
            cloudSyncToggle.disabled = false;
            cloudSyncToggle.checked = uiSettings.cloudSync !== false;
        }
    }

    if (cloudSyncInfo) {
        if (hasOnlyDefaultPlayer) {
            cloudSyncInfo.textContent = translate('views.settings.cloudSyncDisabledNoPlayer');
            cloudSyncInfo.setAttribute('data-i18n', 'views.settings.cloudSyncDisabledNoPlayer');
        } else {
            cloudSyncInfo.textContent = translate('views.settings.cloudSyncInfo');
            cloudSyncInfo.setAttribute('data-i18n', 'views.settings.cloudSyncInfo');
        }
    }

    if (addPlayerLink) {
        if (hasOnlyDefaultPlayer) {
            addPlayerLink.classList.remove('hidden');
        } else {
            addPlayerLink.classList.add('hidden');
        }
    }

    const cozyQuiltToggle = document.getElementById('settings-cozy-quilt-toggle');
    const layoutBtns = document.querySelectorAll('.layout-segmented-control .segmented-btn');

    if (cozyQuiltToggle) {
        const isCompact = uiSettings.cardLayout === 'compact0' || uiSettings.cardLayout === 'compact1' || uiSettings.cardLayout === 'quilt';
        cozyQuiltToggle.checked = isCompact;
        layoutBtns.forEach(btn => {
            const isQuilt = btn.dataset.layout === 'quilt';
            btn.classList.toggle('active', isQuilt === isCompact);
        });
    }
}
