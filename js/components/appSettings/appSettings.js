import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { removePlayerTag, saveState } from '../../core/localStorageManager.js';
import { renderApp } from '../../core/renderer.js';
import { state, EFFECTIVE_DATE_TERMS, EFFECTIVE_DATE_PRIVACY } from '../../core/state.js';
import { showToast } from '../../ui/toast.js';

import { addCurrencyValidation } from '../../utils/inputValidator.js';
import { currencyData, priceTierRegistry, languagesData, transparencyData, developmentSupportData } from '../../data/appData.js';

import { formatCurrency } from '../../utils/numberFormatter.js';
import { getChangelogHtml } from '../../services/changelogService.js';
import { getSVG } from '../../utils/svgManager.js';

import { isValidUUID } from '../../utils/uuidGenerator.js';
import { licensesData } from '../../data/licensesData.js';
import { loadTranslations, translate } from '../../i18n/translator.js';
import { logger } from '../../utils/logger.js';
import { runningCostsData } from '../../data/runningCostsData.js';
import { fetchRunningCosts } from '../../services/apiService.js';
import { validatePlayerTagInput } from '../../utils/playerTagValidator.js';

import { showAlert, showConfirm } from '../../ui/noticeModal.js';
import { showChangelogModal } from '../changelog/changelogModal.js';
import { initCardLayoutManager, applyCardLayout } from '../../ui/cardLayoutManager.js';

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
        if (item.i18nHelp) {
            const labelTextSpan = document.createElement('span');
            labelTextSpan.dataset.i18n = item.i18nLabel;
            labelTextSpan.textContent = translate(item.i18nLabel);
            label.appendChild(labelTextSpan);

            const infoBtn = document.createElement('button');
            infoBtn.className = 'info-btn';
            infoBtn.dataset.info = item.i18nHelp;
            infoBtn.setAttribute('aria-label', translate('actions.showInfo') || 'Show Information');
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

        if (item.badge) {
            const badge = document.createElement('span');
            badge.className = 'coming-soon-badge';
            badge.dataset.i18n = item.badge;
            badge.textContent = translate(item.badge);
            labelWrapper.appendChild(badge);
        }

        let labelSide = labelWrapper;
        if (item.i18nDesc) {
            const descriptorGroup = document.createElement('div');
            descriptorGroup.className = 'field-descriptor-group';
            descriptorGroup.appendChild(labelWrapper);

            const descPara = document.createElement('p');
            descPara.className = 'form-setting-text';
            descPara.dataset.i18n = item.i18nDesc;
            descPara.textContent = translate(item.i18nDesc);
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
            const versionText = window.__ENV__?.APP_VERSION || state.appVersion || '2.0.0';
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
            if (e.target.closest('.info-btn')) {
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

function openContactModal() {
    const modal = document.getElementById('contact-modal');
    if (!modal) return;

    const closeHeaderBtn = document.getElementById('close-contact-header-btn');
    const closeBtn = document.getElementById('close-contact-modal-btn');
    const mailBtn = document.getElementById('contact-mail-btn');

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

    if (mailBtn) {
        mailBtn.onclick = (e) => {
            e.stopPropagation();
            closeModal();
        };
    }

    // Show modal and overlay
    modal.classList.add('show');
    if (dom.overlay) dom.overlay.classList.add('show');
}

export function openLicensesModal() {
    const modal = document.getElementById('licenses-modal');
    if (!modal) return;

    const closeHeaderBtn = document.getElementById('close-licenses-header-btn');
    const closeBtn = document.getElementById('close-licenses-modal-btn');
    const container = document.getElementById('licenses-container');

    const closeModal = () => {
        modal.classList.remove('show');
        const visibleModals = document.querySelectorAll('.modal.show');
        if (visibleModals.length === 0 && dom.overlay) {
            dom.overlay.classList.remove('show');
        }
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

    if (container) {
        container.innerHTML = '';
        licensesData.forEach(item => {
            const details = document.createElement('details');
            
            const summary = document.createElement('summary');
            
            const titleSpan = document.createElement('span');
            titleSpan.className = 'license-title';
            titleSpan.textContent = item.name;
            summary.appendChild(titleSpan);
            
            const badgeSpan = document.createElement('span');
            badgeSpan.className = 'license-badge';
            badgeSpan.textContent = item.license;
            summary.appendChild(badgeSpan);
            
            details.appendChild(summary);

            const detailsBody = document.createElement('div');
            detailsBody.className = 'details-body';

            const metaDiv = document.createElement('div');
            metaDiv.className = 'meta-row';

            const authorSpan = document.createElement('span');
            authorSpan.innerHTML = `<strong>${translate('settings.author') || 'Author'}:</strong> ${item.copyright}`;
            metaDiv.appendChild(authorSpan);

            const link = document.createElement('a');
            link.href = item.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = 'license-link';
            
            let text = translate('settings.sourceLink') || 'Source →';
            text = text.replace(' →', '');
            
            const linkText = document.createElement('span');
            linkText.textContent = text;
            link.appendChild(linkText);

            const svgIcon = document.createElement('orecalc-assets-svg');
            svgIcon.setAttribute('name', 'open-in-new');
            link.appendChild(svgIcon);

            metaDiv.appendChild(link);

            detailsBody.appendChild(metaDiv);

            const pre = document.createElement('pre');
            pre.className = 'license-text';
            pre.textContent = translate('settings.loadingLicense') || 'Loading license...';
            detailsBody.appendChild(pre);

            let isLoaded = false;
            details.addEventListener('toggle', () => {
                if (details.open) {
                    // Close all other details elements to maintain accordion behavior
                    const allDetails = container.querySelectorAll('details');
                    allDetails.forEach(d => {
                        if (d !== details && d.open) {
                            d.open = false;
                        }
                    });

                    // Scroll the opened element to the top of the container
                    setTimeout(() => {
                        if (details.open) {
                            const containerTop = container.getBoundingClientRect().top;
                            const detailsTop = details.getBoundingClientRect().top;
                            const scrollOffset = detailsTop - containerTop + container.scrollTop - 5;
                            container.scrollTo({
                                top: scrollOffset,
                                behavior: 'smooth'
                             });
                        }
                    }, 80);

                    if (!isLoaded) {
                        fetch(item.file)
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error('Network response was not ok');
                                }
                                return response.text();
                            })
                            .then(text => {
                                pre.textContent = text;
                                isLoaded = true;
                            })
                            .catch(err => {
                                pre.textContent = `${translate('settings.errorLoadingLicense') || 'Error loading license text.'}\n\n${item.licenseUrl ? 'Please view it here: ' + item.licenseUrl : ''}`;
                                console.error('Error fetching license:', err);
                            });
                    }
                }
            });

            details.appendChild(detailsBody);
            container.appendChild(details);
        });
    }

    // Show modal and overlay
    modal.classList.add('show');
    if (dom.overlay) dom.overlay.classList.add('show');
}

export async function openRunningCostsModal() {
    const modal = document.getElementById('running-costs-modal');
    if (!modal) return;

    modal.classList.add('show');
    if (dom.overlay) dom.overlay.classList.add('show');

    const closeBtn = document.getElementById('close-running-costs-modal-btn');
    const closeActionBtn = document.getElementById('running-costs-close-btn');
    const totalValue = document.getElementById('running-costs-total-value');
    const historyContainer = document.getElementById('running-costs-history-container');
    const updateDate = document.getElementById('running-costs-update-date');

    const closeModal = () => {
        modal.classList.remove('show');
        const visibleModals = document.querySelectorAll('.modal.show');
        if (visibleModals.length === 0 && dom.overlay) {
            dom.overlay.classList.remove('show');
        }
    };

    if (closeBtn) {
        closeBtn.onclick = (e) => {
            e.preventDefault();
            closeModal();
        };
    }

    if (closeActionBtn) {
        closeActionBtn.onclick = (e) => {
            e.preventDefault();
            closeModal();
        };
    }

    // Set temporary loading state
    if (totalValue) totalValue.textContent = '...';
    if (historyContainer) {
        historyContainer.innerHTML = '<div class="costs-disclaimer" style="text-align: center; border-left: none;">Loading costs history...</div>';
    }

    try {
        const data = await fetchRunningCosts();
        renderRunningCostsData(modal, data, totalValue, historyContainer, updateDate);
    } catch (err) {
        console.warn('Failed to load live running costs from server, falling back to static/cached data:', err);
        renderRunningCostsData(modal, runningCostsData, totalValue, historyContainer, updateDate);
    }
}

function renderRunningCostsData(modal, data, totalValue, historyContainer, updateDate) {
    if (data.isMock) {
        modal.classList.add('is-mock');
    } else {
        modal.classList.remove('is-mock');
    }

    if (totalValue) {
        totalValue.textContent = `$${formatCurrency(data.totalCostTillDate || 0)}`;
    }

    if (updateDate && data.lastUpdated) {
        try {
            const date = new Date(data.lastUpdated);
            if (!isNaN(date.getTime())) {
                const locale = state.uiSettings?.language || 'en';
                updateDate.textContent = date.toLocaleDateString(locale, { dateStyle: 'medium' });
            } else {
                updateDate.textContent = data.lastUpdated.split('T')[0];
            }
        } catch {
            updateDate.textContent = data.lastUpdated.split('T')[0];
        }
    }

    if (historyContainer) {
        historyContainer.innerHTML = '';
        if (data.breakdown && data.breakdown.length > 0) {
            data.breakdown.forEach(item => {
                const card = document.createElement('div');
                card.className = 'costs-month-card';

                const header = document.createElement('div');
                header.className = 'costs-month-header';

                const monthName = document.createElement('span');
                monthName.className = 'costs-month-name';
                monthName.textContent = formatInvoiceMonth(item.month);
                header.appendChild(monthName);

                const monthTotal = document.createElement('span');
                monthTotal.className = 'costs-month-total';
                monthTotal.textContent = `$${formatCurrency(item.totalCost || 0)}`;
                header.appendChild(monthTotal);

                card.appendChild(header);

                const list = document.createElement('div');
                list.className = 'costs-services-list';

                if (item.services && item.services.length > 0) {
                    const services = item.services;
                    const highlightedServices = services.filter(s => s.highlight);
                    const standardServices = services.filter(s => !s.highlight);

                    if (standardServices.length <= 2) {
                        // Render always-visible highlighted services first
                        highlightedServices.forEach(service => {
                            const row = document.createElement('div');
                            row.className = 'costs-service-row highlighted';

                            const serviceName = document.createElement('span');
                            serviceName.className = 'costs-service-name';
                            serviceName.textContent = service.name;
                            row.appendChild(serviceName);

                            const serviceCost = document.createElement('span');
                            serviceCost.className = 'costs-service-cost';
                            serviceCost.textContent = `$${formatCurrency(service.cost || 0)}`;
                            row.appendChild(serviceCost);

                            list.appendChild(row);
                        });

                        // Render standard services
                        standardServices.forEach(service => {
                            const row = document.createElement('div');
                            row.className = 'costs-service-row';

                            const serviceName = document.createElement('span');
                            serviceName.className = 'costs-service-name';
                            serviceName.textContent = service.name;
                            row.appendChild(serviceName);

                            const serviceCost = document.createElement('span');
                            serviceCost.className = 'costs-service-cost';
                            serviceCost.textContent = `$${formatCurrency(service.cost || 0)}`;
                            row.appendChild(serviceCost);

                            list.appendChild(row);
                        });
                        card.appendChild(list);
                    } else {
                        // Render highlighted services first (always visible)
                        highlightedServices.forEach(service => {
                            const row = document.createElement('div');
                            row.className = 'costs-service-row highlighted';

                            const serviceName = document.createElement('span');
                            serviceName.className = 'costs-service-name';
                            serviceName.textContent = service.name;
                            row.appendChild(serviceName);

                            const serviceCost = document.createElement('span');
                            serviceCost.className = 'costs-service-cost';
                            serviceCost.textContent = `$${formatCurrency(service.cost || 0)}`;
                            row.appendChild(serviceCost);

                            list.appendChild(row);
                        });

                        // Render top 2 standard services (always visible)
                        const top2 = standardServices.slice(0, 2);
                        const rest = standardServices.slice(2);

                        top2.forEach(service => {
                            const row = document.createElement('div');
                            row.className = 'costs-service-row';

                            const serviceName = document.createElement('span');
                            serviceName.className = 'costs-service-name';
                            serviceName.textContent = service.name;
                            row.appendChild(serviceName);

                            const serviceCost = document.createElement('span');
                            serviceCost.className = 'costs-service-cost';
                            serviceCost.textContent = `$${formatCurrency(service.cost || 0)}`;
                            row.appendChild(serviceCost);

                            list.appendChild(row);
                        });

                        const restSum = rest.reduce((sum, s) => sum + (s.cost || 0), 0);

                        const othersRow = document.createElement('div');
                        othersRow.className = 'costs-service-row others-row';

                        const othersName = document.createElement('span');
                        othersName.className = 'costs-service-name';
                        othersName.dataset.i18n = 'settings.runningCostsModal.others';
                        othersName.textContent = translate('settings.runningCostsModal.others') || 'Others';
                        othersRow.appendChild(othersName);

                        const othersCost = document.createElement('span');
                        othersCost.className = 'costs-service-cost';
                        othersCost.textContent = `$${formatCurrency(restSum || 0)}`;
                        othersRow.appendChild(othersCost);

                        list.appendChild(othersRow);

                        // Render remaining standard services as extra-service rows
                        rest.forEach(service => {
                            const row = document.createElement('div');
                            row.className = 'costs-service-row extra-service';

                            const serviceName = document.createElement('span');
                            serviceName.className = 'costs-service-name';
                            serviceName.textContent = service.name;
                            row.appendChild(serviceName);

                            const serviceCost = document.createElement('span');
                            serviceCost.className = 'costs-service-cost';
                            serviceCost.textContent = `$${formatCurrency(service.cost || 0)}`;
                            row.appendChild(serviceCost);

                            list.appendChild(row);
                        });

                        card.appendChild(list);

                        const toggleBtn = document.createElement('button');
                        toggleBtn.className = 'costs-toggle-expand-btn';

                        const btnText = document.createElement('span');
                        btnText.className = 'btn-text';
                        btnText.dataset.i18n = 'actions.showMore';
                        btnText.textContent = translate('actions.showMore') || 'Show More';
                        toggleBtn.appendChild(btnText);

                        const arrowIcon = document.createElement('orecalc-assets-svg');
                        arrowIcon.setAttribute('name', 'dropdown');
                        arrowIcon.className = 'toggle-icon';
                        toggleBtn.appendChild(arrowIcon);

                        toggleBtn.onclick = (e) => {
                            e.preventDefault();
                            const isExpanded = card.classList.toggle('expanded');
                            if (isExpanded) {
                                btnText.dataset.i18n = 'actions.showLess';
                                btnText.textContent = translate('actions.showLess') || 'Show Less';
                            } else {
                                btnText.dataset.i18n = 'actions.showMore';
                                btnText.textContent = translate('actions.showMore') || 'Show More';
                            }
                        };

                        card.appendChild(toggleBtn);
                    }
                } else {
                    const row = document.createElement('div');
                    row.className = 'costs-service-row';
                    row.style.justifyContent = 'center';
                    row.textContent = 'No services recorded';
                    list.appendChild(row);
                    card.appendChild(list);
                }

                if (item.footer) {
                    const footerNote = document.createElement('div');
                    footerNote.className = 'costs-month-footer';
                    footerNote.textContent = item.footer;
                    card.appendChild(footerNote);
                }

                historyContainer.appendChild(card);
            });
        } else {
            const noData = document.createElement('div');
            noData.className = 'costs-disclaimer';
            noData.style.textAlign = 'center';
            noData.style.borderLeft = 'none';
            noData.textContent = 'No running costs history available.';
            historyContainer.appendChild(noData);
        }
    }
}

function formatInvoiceMonth(invoiceMonth) {
    if (!invoiceMonth || invoiceMonth.length !== 7) return invoiceMonth;
    const parts = invoiceMonth.split('-');
    if (parts.length !== 2) return invoiceMonth;
    const year = parts[0];
    const month = parts[1];
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const locale = state.uiSettings?.language || 'en';
    return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

export function openPrivacyModal() {
    const modal = document.getElementById('privacy-modal');
    if (!modal) return;

    const privacyTimestamp = state.uiSettings?.uiTimestamps?.privacy;
    const needsConsent = !privacyTimestamp || privacyTimestamp < EFFECTIVE_DATE_PRIVACY;

    const closeHeaderBtn = document.getElementById('close-privacy-header-btn');
    const closeBtn = document.getElementById('close-privacy-modal-btn');
    const themeBtn = document.getElementById('privacy-theme-toggle-btn');
    const iframe = document.getElementById('privacy-policy-iframe');
    const externalBtn = document.getElementById('privacy-open-external-btn');
    const translateBtn = document.getElementById('privacy-translate-btn');

    const SUPPORTED_LEGAL_LANGS = ['de'];
    const currentLang = state.uiSettings?.language || 'en';
    const hasTranslation = currentLang !== 'en' && SUPPORTED_LEGAL_LANGS.includes(currentLang);
    let showingEnglish = !hasTranslation;
    const initialUrl = hasTranslation ? `privacy/${currentLang}` : 'privacy';

    if (translateBtn) {
        if (!hasTranslation) {
            translateBtn.style.display = 'none';
        } else {
            translateBtn.style.display = 'inline-flex';
            translateBtn.onclick = (e) => {
                e.preventDefault();
                showingEnglish = !showingEnglish;
                let currentTheme = 'dark';
                if (iframe && iframe.contentDocument) {
                    try {
                        currentTheme = iframe.contentDocument.documentElement.getAttribute('data-theme') || state.uiSettings?.theme || 'dark';
                    } catch (err) {
                        currentTheme = state.uiSettings?.theme || 'dark';
                    }
                } else {
                    currentTheme = state.uiSettings?.theme || 'dark';
                }
                const targetUrl = showingEnglish ? 'privacy' : `privacy/${currentLang}`;
                if (iframe) {
                    iframe.src = `${targetUrl}?theme=${currentTheme}`;
                }
                if (externalBtn) {
                    externalBtn.href = targetUrl;
                }
            };
        }
    }

    const updateThemeBtnIcon = (currentTheme) => {
        if (themeBtn) {
            const svgIcon = themeBtn.querySelector('orecalc-assets-svg');
            if (svgIcon) {
                if (currentTheme === 'light') {
                    svgIcon.setAttribute('name', 'dark-mode');
                    svgIcon.setAttribute('class', 'icon-dark');
                } else {
                    svgIcon.setAttribute('name', 'light-mode');
                    svgIcon.setAttribute('class', 'icon-light');
                }
            }
        }
    };

    const closeModal = () => {
        modal.classList.remove('show');
        modal.classList.remove('modal-top');
        const visibleModals = document.querySelectorAll('.modal.show');
        if (visibleModals.length === 0 && dom.overlay) {
            dom.overlay.classList.remove('show');
        }
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

    const acceptBtn = document.getElementById('accept-privacy-modal-btn');
    if (acceptBtn) {
        if (needsConsent) {
            acceptBtn.style.display = 'inline-block';
            acceptBtn.onclick = (e) => {
                e.preventDefault();
                const now = Date.now();
                if (!state.uiSettings.uiTimestamps) {
                    state.uiSettings.uiTimestamps = {};
                }
                const privacyAcceptedTime = Math.max(now, EFFECTIVE_DATE_PRIVACY + 1);
                state.uiSettings.uiTimestamps.privacy = privacyAcceptedTime;
                
                saveState(state);
                if (typeof window.refreshConsentModalStatus === 'function') {
                    window.refreshConsentModalStatus();
                }
                closeModal();
                
                // Hide legal consent modal if both are now accepted
                const tosTimestamp = state.uiSettings.uiTimestamps.tos;
                if (tosTimestamp && tosTimestamp >= EFFECTIVE_DATE_TERMS) {
                    const consentModal = document.getElementById('consent-modal');
                    if (consentModal) {
                        consentModal.classList.remove('show');
                    }
                }
                const visibleModals = document.querySelectorAll('.modal.show');
                if (visibleModals.length === 0 && dom.overlay) {
                    dom.overlay.classList.remove('show');
                }
            };
        } else {
            acceptBtn.style.display = 'none';
        }
    }

    if (themeBtn) {
        const initialTheme = state.uiSettings?.theme || 'dark';
        updateThemeBtnIcon(initialTheme);
        
        themeBtn.onclick = (e) => {
            e.preventDefault();
            if (iframe && iframe.contentDocument) {
                try {
                    const htmlEl = iframe.contentDocument.documentElement;
                    const currentTheme = htmlEl.getAttribute('data-theme') || 'light';
                    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
                    
                    htmlEl.setAttribute('data-theme', newTheme);
                    updateThemeBtnIcon(newTheme);
                } catch (err) {
                    console.error('Failed to toggle iframe theme:', err);
                }
            }
        };
    }

    // Show modal and overlay
    if (iframe) {
        const initialTheme = state.uiSettings?.theme || 'dark';
        iframe.src = `${initialUrl}?theme=${initialTheme}`;
        if (externalBtn) {
            externalBtn.href = initialUrl;
        }
        iframe.onload = () => {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                if (iframeDoc && (iframeDoc.title === '404' || (iframeDoc.body && iframeDoc.body.innerText.includes('404 Page Not Found')))) {
                    const currentTheme = state.uiSettings?.theme || 'dark';
                    iframe.src = `privacy?theme=${currentTheme}`;
                    if (externalBtn) externalBtn.href = 'privacy';
                    if (translateBtn) translateBtn.style.display = 'none';
                    return;
                }
                if (!iframeDoc || !iframeDoc.body) return;
                iframeDoc.body.addEventListener('click', async (e) => {
                    const link = e.target.closest('a');
                    if (!link) return;

                    const href = link.getAttribute('href');
                    if (!href) return;

                    // Skip internal/anchor links
                    if (href.startsWith('#') || href.startsWith('javascript:')) return;

                    const isMailto = href.startsWith('mailto:');
                    if (isMailto) {
                        e.preventDefault();
                        const confirmed = await showConfirm(translate('confirms.mailtoLink'));
                        if (confirmed) {
                            window.location.href = href;
                        }
                        return;
                    }

                    const isHttpExternal = (href.startsWith('http://') || href.startsWith('https://')) && !href.includes(window.location.host);
                    if (isHttpExternal) {
                        e.preventDefault();
                        const confirmed = await showConfirm(
                            `${translate('confirms.externalLink')}<br><code class="external-link-display">${href}</code><br><br>${translate('confirms.externalLinkConfirm')}`
                        );
                        if (confirmed) {
                            window.open(href, '_blank', 'noopener,noreferrer');
                        }
                    }
                });
            } catch (err) {
                console.error('Failed to attach link listener to iframe:', err);
            }
        };
    }

    modal.classList.add('show');
    if (dom.overlay) dom.overlay.classList.add('show');
}

export function openTermsOfUseModal() {
    const modal = document.getElementById('terms-modal');
    if (!modal) return;

    const tosTimestamp = state.uiSettings?.uiTimestamps?.tos;
    const needsConsent = !tosTimestamp || tosTimestamp < EFFECTIVE_DATE_TERMS;

    const closeHeaderBtn = document.getElementById('close-terms-header-btn');
    const closeBtn = document.getElementById('close-terms-modal-btn');
    const themeBtn = document.getElementById('terms-theme-toggle-btn');
    const iframe = document.getElementById('terms-policy-iframe');
    const externalBtn = document.getElementById('terms-open-external-btn');
    const translateBtn = document.getElementById('terms-translate-btn');

    const SUPPORTED_LEGAL_LANGS = ['de'];
    const currentLang = state.uiSettings?.language || 'en';
    const hasTranslation = currentLang !== 'en' && SUPPORTED_LEGAL_LANGS.includes(currentLang);
    let showingEnglish = !hasTranslation;
    const initialUrl = hasTranslation ? `terms/${currentLang}` : 'terms';

    if (translateBtn) {
        if (!hasTranslation) {
            translateBtn.style.display = 'none';
        } else {
            translateBtn.style.display = 'inline-flex';
            translateBtn.onclick = (e) => {
                e.preventDefault();
                showingEnglish = !showingEnglish;
                let currentTheme = 'dark';
                if (iframe && iframe.contentDocument) {
                    try {
                        currentTheme = iframe.contentDocument.documentElement.getAttribute('data-theme') || state.uiSettings?.theme || 'dark';
                    } catch (err) {
                        currentTheme = state.uiSettings?.theme || 'dark';
                    }
                } else {
                    currentTheme = state.uiSettings?.theme || 'dark';
                }
                const targetUrl = showingEnglish ? 'terms' : `terms/${currentLang}`;
                if (iframe) {
                    iframe.src = `${targetUrl}?theme=${currentTheme}`;
                }
                if (externalBtn) {
                    externalBtn.href = targetUrl;
                }
            };
        }
    }

    const updateThemeBtnIcon = (currentTheme) => {
        if (themeBtn) {
            const svgIcon = themeBtn.querySelector('orecalc-assets-svg');
            if (svgIcon) {
                if (currentTheme === 'light') {
                    svgIcon.setAttribute('name', 'dark-mode');
                    svgIcon.setAttribute('class', 'icon-dark');
                } else {
                    svgIcon.setAttribute('name', 'light-mode');
                    svgIcon.setAttribute('class', 'icon-light');
                }
            }
        }
    };

    const closeModal = () => {
        modal.classList.remove('show');
        modal.classList.remove('modal-top');
        const visibleModals = document.querySelectorAll('.modal.show');
        if (visibleModals.length === 0 && dom.overlay) {
            dom.overlay.classList.remove('show');
        }
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

    const acceptBtn = document.getElementById('accept-terms-modal-btn');
    if (acceptBtn) {
        if (needsConsent) {
            acceptBtn.style.display = 'inline-block';
            acceptBtn.onclick = (e) => {
                e.preventDefault();
                const now = Date.now();
                if (!state.uiSettings.uiTimestamps) {
                    state.uiSettings.uiTimestamps = {};
                }
                const tosAcceptedTime = Math.max(now, EFFECTIVE_DATE_TERMS + 1);
                state.uiSettings.uiTimestamps.tos = tosAcceptedTime;
                
                saveState(state);
                if (typeof window.refreshConsentModalStatus === 'function') {
                    window.refreshConsentModalStatus();
                }
                closeModal();
                
                // Hide legal consent modal if both are now accepted
                const privacyTimestamp = state.uiSettings.uiTimestamps.privacy;
                if (privacyTimestamp && privacyTimestamp >= EFFECTIVE_DATE_PRIVACY) {
                    const consentModal = document.getElementById('consent-modal');
                    if (consentModal) {
                        consentModal.classList.remove('show');
                    }
                }
                const visibleModals = document.querySelectorAll('.modal.show');
                if (visibleModals.length === 0 && dom.overlay) {
                    dom.overlay.classList.remove('show');
                }
            };
        } else {
            acceptBtn.style.display = 'none';
        }
    }

    if (themeBtn) {
        const initialTheme = state.uiSettings?.theme || 'dark';
        updateThemeBtnIcon(initialTheme);
        
        themeBtn.onclick = (e) => {
            e.preventDefault();
            if (iframe && iframe.contentDocument) {
                try {
                    const htmlEl = iframe.contentDocument.documentElement;
                    const currentTheme = htmlEl.getAttribute('data-theme') || 'light';
                    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
                    
                    htmlEl.setAttribute('data-theme', newTheme);
                    updateThemeBtnIcon(newTheme);
                } catch (err) {
                    console.error('Failed to toggle iframe theme:', err);
                }
            }
        };
    }

    // Show modal and overlay
    if (iframe) {
        const initialTheme = state.uiSettings?.theme || 'dark';
        iframe.src = `${initialUrl}?theme=${initialTheme}`;
        if (externalBtn) {
            externalBtn.href = initialUrl;
        }
        iframe.onload = () => {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                if (iframeDoc && (iframeDoc.title === '404' || (iframeDoc.body && iframeDoc.body.innerText.includes('404 Page Not Found')))) {
                    const currentTheme = state.uiSettings?.theme || 'dark';
                    iframe.src = `terms?theme=${currentTheme}`;
                    if (externalBtn) externalBtn.href = 'terms';
                    if (translateBtn) translateBtn.style.display = 'none';
                    return;
                }
                if (!iframeDoc || !iframeDoc.body) return;
                iframeDoc.body.addEventListener('click', async (e) => {
                    const link = e.target.closest('a');
                    if (!link) return;

                    const href = link.getAttribute('href');
                    if (!href) return;

                    // Skip internal/anchor links
                    if (href.startsWith('#') || href.startsWith('javascript:')) return;

                    const isMailto = href.startsWith('mailto:');
                    if (isMailto) {
                        e.preventDefault();
                        const confirmed = await showConfirm(translate('confirms.mailtoLink'));
                        if (confirmed) {
                            window.location.href = href;
                        }
                        return;
                    }

                    const isHttpExternal = (href.startsWith('http://') || href.startsWith('https://')) && !href.includes(window.location.host);
                    if (isHttpExternal) {
                        e.preventDefault();
                        const confirmed = await showConfirm(
                            `${translate('confirms.externalLink')}<br><code class="external-link-display">${href}</code><br><br>${translate('confirms.externalLinkConfirm')}`
                        );
                        if (confirmed) {
                            window.open(href, '_blank', 'noopener,noreferrer');
                        }
                    }
                });
            } catch (err) {
                console.error('Failed to attach link listener to iframe:', err);
            }
        };
    }

    modal.classList.add('show');
    if (dom.overlay) dom.overlay.classList.add('show');
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
        attachCheckbox.checked = true;
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
                const currentUserId = localStorage.getItem('oreCalc_userId') || 'unknown';
                
                let attachedData = null;
                if (attachCheckbox && attachCheckbox.checked) {
                    // Clone current state
                    const stateClone = JSON.parse(JSON.stringify(state));
                    attachedData = {
                        ...stateClone,
                        userId: currentUserId
                    };
                }
                
                const { submitBugReport } = await import('../../services/apiService.js');
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
        privacyLink.onclick = (e) => {
            e.preventDefault();
            openPrivacyModal();
        };
    }

    // Show modal and overlay
    modal.classList.add('show');
    if (dom.overlay) dom.overlay.classList.add('show');
}
class Accordion {
    constructor(el) {
        this.el = el;
        this.summary = el.querySelector('summary');
        this.content = el.querySelector('.details-content');

        this.animation = null;
        this.isClosing = false;
        this.isExpanding = false;
        this.el.classList.toggle('is-open', el.open);
        
        const icon = this.summary.querySelector('orecalc-assets-svg.chevron');
        if (icon) {
            icon.setAttribute('name', el.open ? 'chevron-up' : 'chevron-down');
        }
        
        this.summary.addEventListener('click', (e) => this.onClick(e));
    }

    onClick(e) {
        e.preventDefault();
        if (this.isClosing || this.isExpanding) return;

        if (this.el.open) {
            const allDetails = this.el.parentElement.querySelectorAll('details.sync-section');
            const openDetails = Array.from(allDetails).filter(d => d.open);
            if (openDetails.length <= 1) {
                return;
            }
            this.shrink();
        } else {
            this.open();
        }
    }

    shrink() {
        this.isClosing = true;
        this.el.classList.remove('is-open');
        
        const icon = this.summary.querySelector('orecalc-assets-svg.chevron');
        if (icon) {
            icon.setAttribute('name', 'chevron-down');
        }

        document.dispatchEvent(new CustomEvent('deviceSyncStateChange'));

        const startHeight = `${this.el.offsetHeight}px`;
        const endHeight = `${this.summary.offsetHeight}px`;

        if (this.animation) {
            this.animation.cancel();
        }

        this.animation = this.el.animate({
            height: [startHeight, endHeight]
        }, {
            duration: 250,
            easing: 'ease-out'
        });

        this.animation.onfinish = () => this.onAnimationFinish(false);
        this.animation.oncancel = () => this.isClosing = false;
    }

    async open() {
        const allDetails = this.el.parentElement.querySelectorAll('details.sync-section');
        allDetails.forEach(other => {
            if (other !== this.el && other.open) {
                const otherAccordion = other._accordionInstance;
                if (otherAccordion) {
                    otherAccordion.shrink();
                } else {
                    other.open = false;
                    other.classList.remove('is-open');
                    const otherIcon = other.querySelector('orecalc-assets-svg.chevron');
                    if (otherIcon) {
                        otherIcon.setAttribute('name', 'chevron-down');
                    }
                }
            }
        });

        this.el.classList.add('is-open');
        const icon = this.summary.querySelector('orecalc-assets-svg.chevron');
        if (icon) {
            icon.setAttribute('name', 'chevron-up');
        }
        this.el.style.height = `${this.el.offsetHeight}px`;
        this.el.open = true;

        const input = this.el.querySelector('#device-sync-input');
        if (input && !input.value) {
            try {
                const clipboardText = await navigator.clipboard.readText();
                if (clipboardText) {
                    const trimmed = clipboardText.trim();
                    const userId = localStorage.getItem('oreCalc_userId');
                    if (isValidUUID(trimmed) && trimmed !== userId) {
                        input.value = trimmed;
                        const statusMsg = this.el.querySelector('#device-sync-status');
                        if (statusMsg) {
                            statusMsg.textContent = translate('alerts.uuidDetected') || "User ID detected from clipboard";
                            statusMsg.classList.remove('error');
                            statusMsg.classList.add('success');
                            statusMsg.classList.add('show');
                        }
                    }
                }
            } catch (err) {
                logger.warn('Clipboard read failed or denied during manual expand');
            }
        }

        document.dispatchEvent(new CustomEvent('deviceSyncStateChange'));

        window.requestAnimationFrame(() => this.expand());
    }

    expand() {
        this.isExpanding = true;
        const startHeight = `${this.el.offsetHeight}px`;
        const endHeight = `${this.summary.offsetHeight + this.content.offsetHeight}px`;

        if (this.animation) {
            this.animation.cancel();
        }

        this.animation = this.el.animate({
            height: [startHeight, endHeight]
        }, {
            duration: 250,
            easing: 'ease-out'
        });

        this.animation.onfinish = () => this.onAnimationFinish(true);
        this.animation.oncancel = () => this.isExpanding = false;
    }

    onAnimationFinish(open) {
        this.el.open = open;
        this.animation = null;
        this.isClosing = false;
        this.isExpanding = false;
        this.el.style.height = '';
    }
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
        cloudSyncToggle,
        addPlayerLink
    } = dom.appSettings || {};

    if (addPlayerLink) {
        addPlayerLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const { showAddPlayerModal } = await import('../player/playerModal.js');
            showAddPlayerModal();
        });
    }

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
            
            document.dispatchEvent(new CustomEvent('app:translate'));
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
        const themeLabel = document.querySelector('label[for="settings-theme-toggle"]');
        const updateThemeLabel = () => {
            if (themeLabel) {
                const labelKey = themeToggle.checked ? 'settings.options.themeDark' : 'settings.options.themeLight';
                themeLabel.textContent = translate(labelKey);
                themeLabel.setAttribute('data-i18n', labelKey);
            }
        };
        themeToggle.checked = state.uiSettings.theme === 'light';
        updateThemeLabel();

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
            document.dispatchEvent(new CustomEvent('app:theme-change', { detail: { theme: newTheme, origin } }));
            updateThemeLabel();
        });
    }

    const cozyQuiltToggle = document.getElementById('settings-cozy-quilt-toggle');
    const layoutBtns = document.querySelectorAll('.layout-segmented-control .segmented-btn');

    if (cozyQuiltToggle) {
        const updateLayoutLabel = () => {
            const isCompact = state.uiSettings.cardLayout === 'compact0' || state.uiSettings.cardLayout === 'compact1';
            layoutBtns.forEach(btn => {
                const isQuilt = btn.dataset.layout === 'quilt';
                btn.classList.toggle('active', isQuilt === isCompact);
            });
            cozyQuiltToggle.checked = isCompact;
        };
        updateLayoutLabel();

        cozyQuiltToggle.addEventListener('change', (e) => {
            const layout = e.target.checked ? 'compact0' : 'cozy';
            handleStateUpdate(() => {
                state.uiSettings.cardLayout = layout;
            }, true);
            applyCardLayout(layout);
            updateLayoutLabel();
        });

        layoutBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const layout = btn.dataset.layout;
                const targetLayout = layout === 'quilt' ? 'compact0' : 'cozy';
                if (state.uiSettings.cardLayout !== targetLayout) {
                    handleStateUpdate(() => {
                        state.uiSettings.cardLayout = targetLayout;
                    }, true);
                    applyCardLayout(targetLayout);
                    updateLayoutLabel();
                }
            });
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
        
        document.dispatchEvent(new CustomEvent('app:theme-change', { detail: { theme: state.uiSettings.theme, origin } }));
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
            const updateState = () => {
                state.uiSettings.hideMaxedEquipment = e.target.checked;
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

    const hideLockedToggle = dom.equipment?.hideLockedToggle;
    if (hideLockedToggle) {
        hideLockedToggle.checked = state.uiSettings.hideLockedEquipment;

        hideLockedToggle.addEventListener('change', (e) => {
            const updateState = () => {
                state.uiSettings.hideLockedEquipment = e.target.checked;
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
            const currentUserId = localStorage.getItem('oreCalc_userId') || 'unknown';
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

            const currentUserId = localStorage.getItem('oreCalc_userId') || 'unknown';
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
            if (await showConfirm(translate('confirms.resetLocal'), 'status.confirm', 'actions.reset')) {
                window.resetApplication();
            } else {
                if (dom.appSettings?.dataErasureModal) dom.appSettings.dataErasureModal.classList.add('show');
                if (dom.overlay) dom.overlay.classList.add('show');
            }
        });
    }

    if (resetCloudBtn) {
        resetCloudBtn.addEventListener('click', async () => {
            if (dom.appSettings?.dataErasureModal) dom.appSettings.dataErasureModal.classList.remove('show');
            if (await showConfirm(translate('confirms.resetCloud'), 'status.confirm', 'actions.reset')) {
                const currentUserId = localStorage.getItem('oreCalc_userId');
                if (currentUserId) {
                    try {
                        const { deleteUserData } = await import('../../services/apiService.js');
                        await deleteUserData(currentUserId);
                    } catch (error) {
                        logger.error("Failed to delete cloud data:", error);
                        await showAlert(translate('alerts.deleteCloudFailed', { error: error.message || error }));
                    }
                }
                window.resetApplication();
            } else {
                if (dom.appSettings?.dataErasureModal) dom.appSettings.dataErasureModal.classList.add('show');
                if (dom.overlay) dom.overlay.classList.add('show');
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
                const { fetchPlayerData } = await import('../../services/apiService.js');
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
                const { erasePlayerTagFromAllUsers } = await import('../../services/apiService.js');
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
        const currentUserId = localStorage.getItem('oreCalc_userId');
        if (currentUserId) {
            const maskedId = currentUserId.length > 8 ? currentUserId.substring(0, 8) + '...' : currentUserId;
            userIdDisplayLabel.textContent = `${translate('settings.options.userId')}: ${maskedId}`;
            userIdDisplayLabel.dataset.fullId = currentUserId;
        }
    }

    const {
        deviceSyncBtn,
        deviceSyncModal,
        closeDeviceSyncModalBtn,
        deviceSyncUserIdDisplay,
        deviceSyncCopyBtn,
        deviceSyncQrContainer,
        deviceSyncInput,
        deviceSyncStatus,
        cancelDeviceSyncBtn,
        confirmDeviceSyncBtn
    } = dom.appSettings || {};
    const overlay = dom.overlay;

    const updateConfirmButtonVisibility = () => {
        if (!confirmDeviceSyncBtn) return;
        const linkSection = deviceSyncModal ? deviceSyncModal.querySelectorAll('details.sync-section')[1] : null;
        const isSection2Open = linkSection ? linkSection.classList.contains('is-open') : false;
        
        if (isSection2Open) {
            confirmDeviceSyncBtn.classList.remove('hidden');
            const inputValue = deviceSyncInput ? deviceSyncInput.value.trim() : '';
            const currentUserId = localStorage.getItem('oreCalc_userId');
            confirmDeviceSyncBtn.disabled = !(isValidUUID(inputValue) && inputValue !== currentUserId);
        } else {
            confirmDeviceSyncBtn.classList.add('hidden');
        }
    };

    document.addEventListener('deviceSyncStateChange', updateConfirmButtonVisibility);

    if (deviceSyncBtn && deviceSyncModal && overlay) {
        deviceSyncBtn.addEventListener('click', async () => {
            // First check if cloud sync is disabled
            if (state.uiSettings.cloudSync === false) {
                const enableSync = await showConfirm(
                    translate('alerts.enableCloudSyncToCopy') || "Cloud synchronization is currently disabled. You need to enable it to sync your data across devices. Would you like to enable it now?",
                    'status.info',
                    'actions.enableAndCopy'
                );
                if (enableSync) {
                    handleStateUpdate(() => {
                        state.uiSettings.cloudSync = true;
                    });
                    const toggleEl = cloudSyncToggle || document.getElementById('settings-cloud-sync-toggle');
                    if (toggleEl) {
                        toggleEl.checked = true;
                    }
                } else {
                    return;
                }
            }

            // Populate the current user ID if it exists
            const userId = localStorage.getItem('oreCalc_userId');
            if (userId && deviceSyncUserIdDisplay) {
                deviceSyncUserIdDisplay.textContent = userId;
                deviceSyncUserIdDisplay.dataset.fullId = userId;
                
                // Generate QR code
                if (deviceSyncQrContainer) {
                    deviceSyncQrContainer.innerHTML = '';
                    const data = window.location.origin + '?userId=' + userId;
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
                    qrCode.append(deviceSyncQrContainer);
                }
            }

            // Prefill input from clipboard if a valid UUID is found
            let clipboardHasValidId = false;
            if (deviceSyncInput) {
                deviceSyncInput.value = '';
                try {
                    const clipboardText = await navigator.clipboard.readText();
                    if (clipboardText) {
                        const trimmed = clipboardText.trim();
                        if (isValidUUID(trimmed) && trimmed !== userId) {
                            clipboardHasValidId = true;
                            deviceSyncInput.value = trimmed;
                            if (deviceSyncStatus) {
                                deviceSyncStatus.textContent = translate('alerts.uuidDetected') || "User ID detected from clipboard";
                                deviceSyncStatus.classList.remove('error');
                                deviceSyncStatus.classList.add('success');
                                deviceSyncStatus.classList.add('show');
                            }
                        }
                    }
                } catch (err) {
                    logger.warn('Clipboard read failed or denied');
                }
            }

            // Collapse the first section (and open the second) if there is a valid ID in the clipboard or if the user has no player profiles
            if (deviceSyncModal) {
                const syncDetails = deviceSyncModal.querySelectorAll('details.sync-section');
                const hasNoProfiles = state.savedPlayerTags.length === 0 || (state.savedPlayerTags.length === 1 && state.savedPlayerTags[0] === 'DEFAULT0');
                const shouldOpenSecondSection = clipboardHasValidId || hasNoProfiles;
                
                syncDetails.forEach((details, idx) => {
                    details.open = shouldOpenSecondSection ? (idx === 1) : (idx === 0);
                    details.classList.toggle('is-open', details.open);
                    details.style.height = '';
                });
            }

            deviceSyncModal.classList.add('show');
            overlay.classList.add('show');
            updateConfirmButtonVisibility();
        });
    }

    if (deviceSyncModal) {
        const syncDetails = deviceSyncModal.querySelectorAll('details.sync-section');
        syncDetails.forEach(details => {
            details._accordionInstance = new Accordion(details);
        });
    }

    const handleCopySyncCode = async () => {
        const hasOnlyDefaultPlayer = state.savedPlayerTags.length === 1 && state.savedPlayerTags[0] === 'DEFAULT0';
        if (hasOnlyDefaultPlayer) {
            await showAlert(translate('settings.noPlayerForCopy') || "No player profiles are set up yet. Add a profile first to sync data.");
            return;
        }

        const userId = localStorage.getItem('oreCalc_userId');
        if (!userId) return;

        if (!navigator.clipboard || !navigator.clipboard.writeText) {
            await showAlert(translate('alerts.clipboardUnsupported') || "Clipboard operations are not supported on this browser.");
            return;
        }

        try {
            await navigator.clipboard.writeText(userId);
            
            // Visual feedback
            if (deviceSyncCopyBtn) {
                deviceSyncCopyBtn.classList.add('success');
                const textElem = deviceSyncCopyBtn.querySelector('.animated-btn-text');
                const originalText = textElem ? textElem.textContent : '';
                if (textElem) {
                    textElem.textContent = translate('actions.copied') || 'Copied';
                }
                setTimeout(() => {
                    deviceSyncCopyBtn.classList.remove('success');
                    if (textElem) {
                        textElem.textContent = originalText;
                    }
                }, 2000);
            }

            let messageKey = '';
            if (state.uiSettings.cloudSync !== false) {
                const { triggerCloudSave } = await import('../../utils/cloudSaveHandler.js');
                const saveSuccess = await triggerCloudSave({ silent: true });
                messageKey = saveSuccess ? 'alerts.copyAndSaveSuccess' : 'alerts.copySuccessSaveFailed';
            } else {
                messageKey = 'alerts.copySuccess';
            }
            
            showToast(translate(messageKey) || "User ID copied", 'success');
        } catch (err) {
            logger.error('Failed to copy sync code: ', err);
            await showAlert(translate('alerts.copiedFailed') || "Failed to copy text.");
        }
    };

    if (deviceSyncUserIdDisplay) {
        deviceSyncUserIdDisplay.addEventListener('click', handleCopySyncCode);
    }
    if (deviceSyncCopyBtn) {
        deviceSyncCopyBtn.addEventListener('click', handleCopySyncCode);
    }

    const closeDeviceSyncModal = () => {
        if (deviceSyncModal) {
            deviceSyncModal.classList.remove('show');
            const syncDetails = deviceSyncModal.querySelectorAll('details.sync-section');
            syncDetails.forEach((details, idx) => {
                details.open = (idx === 0);
                details.classList.toggle('is-open', idx === 0);
                details.style.height = '';
                if (details._accordionInstance) {
                    if (details._accordionInstance.animation) {
                        details._accordionInstance.animation.cancel();
                    }
                    details._accordionInstance.isClosing = false;
                    details._accordionInstance.isExpanding = false;
                }
            });
        }
        if (overlay) {
            overlay.classList.remove('show');
        }
        if (deviceSyncInput) {
            deviceSyncInput.value = '';
        }
        if (deviceSyncStatus) {
            deviceSyncStatus.textContent = '';
            deviceSyncStatus.className = 'status-message';
        }
        if (deviceSyncInput) {
            deviceSyncInput.classList.remove('input-error');
        }
        if (confirmDeviceSyncBtn) {
            confirmDeviceSyncBtn.disabled = false;
            confirmDeviceSyncBtn.textContent = translate('actions.linkDevice') || 'Link Device';
        }
    };

    closeDeviceSyncModalBtn?.addEventListener('click', closeDeviceSyncModal);
    cancelDeviceSyncBtn?.addEventListener('click', closeDeviceSyncModal);
    overlay?.addEventListener('click', () => {
        if (deviceSyncModal && deviceSyncModal.classList.contains('show')) {
            closeDeviceSyncModal();
        }
    });

    confirmDeviceSyncBtn?.addEventListener('click', async () => {
        if (!deviceSyncInput) return;
        const val = deviceSyncInput.value.trim();
        if (isValidUUID(val)) {
            const originalText = confirmDeviceSyncBtn.textContent;
            try {
                confirmDeviceSyncBtn.disabled = true;
                confirmDeviceSyncBtn.textContent = translate('actions.processing') || 'Processing...';
                
                const { importUserData } = await import('../../utils/cloudSaveHandler.js');
                await importUserData(val);
            } finally {
                confirmDeviceSyncBtn.disabled = false;
                confirmDeviceSyncBtn.textContent = originalText;
            }
        } else {
            if (deviceSyncStatus) {
                deviceSyncStatus.textContent = translate('alerts.invalidUserId') || "Invalid User ID format";
                deviceSyncStatus.classList.remove('success');
                deviceSyncStatus.classList.add('error');
                deviceSyncStatus.classList.add('show');
            }
            deviceSyncInput.classList.add('input-error');
            
            // Interaction Feedback: Shake
            deviceSyncInput.classList.remove('shake');
            void deviceSyncInput.offsetWidth; // Force reflow
            deviceSyncInput.classList.add('shake');
        }
    });

    const validateInput = () => {
        if (!deviceSyncInput) return;
        const val = deviceSyncInput.value.trim();
        
        if (val === '') {
            if (deviceSyncStatus) {
                deviceSyncStatus.textContent = '';
                deviceSyncStatus.className = 'status-message';
            }
            deviceSyncInput.classList.remove('input-error');
        } else if (isValidUUID(val)) {
            const currentUserId = localStorage.getItem('oreCalc_userId');
            if (val === currentUserId) {
                if (deviceSyncStatus) {
                    deviceSyncStatus.textContent = translate('alerts.sameUserId') || "Cannot link to your own active User ID.";
                    deviceSyncStatus.classList.remove('success');
                    deviceSyncStatus.classList.add('error');
                    deviceSyncStatus.classList.add('show');
                }
                deviceSyncInput.classList.add('input-error');
            } else {
                if (deviceSyncStatus) {
                    deviceSyncStatus.textContent = translate('alerts.validUserId') || "User ID is valid";
                    deviceSyncStatus.classList.remove('error');
                    deviceSyncStatus.classList.add('success');
                    deviceSyncStatus.classList.add('show');
                }
                deviceSyncInput.classList.remove('input-error');
            }
        } else if (val.length < 36) {
            if (deviceSyncStatus) {
                deviceSyncStatus.textContent = translate('alerts.incompleteUserId') || "Incomplete User ID format (must be 36 characters).";
                deviceSyncStatus.classList.remove('success');
                deviceSyncStatus.classList.add('error');
                deviceSyncStatus.classList.add('show');
            }
            deviceSyncInput.classList.add('input-error');
        } else {
            if (deviceSyncStatus) {
                deviceSyncStatus.textContent = translate('alerts.invalidUserId') || "Invalid User ID format.";
                deviceSyncStatus.classList.remove('success');
                deviceSyncStatus.classList.add('error');
                deviceSyncStatus.classList.add('show');
            }
            deviceSyncInput.classList.add('input-error');
        }
        updateConfirmButtonVisibility();
    };

    deviceSyncInput?.addEventListener('input', validateInput);
    deviceSyncInput?.addEventListener('focus', validateInput);
    deviceSyncInput?.addEventListener('blur', validateInput);

    deviceSyncInput?.addEventListener('paste', (e) => {
        const pasteData = (e.clipboardData || window.clipboardData).getData('text');
        if (pasteData.includes('userId=')) {
            try {
                const url = new URL(pasteData);
                const userId = url.searchParams.get('userId');
                if (userId) {
                    e.preventDefault();
                    deviceSyncInput.value = userId;
                    deviceSyncInput.dispatchEvent(new Event('input'));
                }
            } catch (err) {
                // Ignore URL parse failures, proceed with default paste
            }
        }
    });

    document.dispatchEvent(new CustomEvent('app:translate'));

    if (appVersionDisplay) {
        appVersionDisplay.textContent = '| v' + (window.__ENV__?.APP_VERSION || state.appVersion || '2.0.0').replace(/^v/, '');
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
        const themeLabel = document.querySelector('label[for="settings-theme-toggle"]');
        if (themeLabel) {
            const labelKey = themeToggle.checked ? 'settings.options.themeDark' : 'settings.options.themeLight';
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
            cloudSyncInfo.textContent = translate('settings.cloudSyncDisabledNoPlayer');
            cloudSyncInfo.setAttribute('data-i18n', 'settings.cloudSyncDisabledNoPlayer');
        } else {
            cloudSyncInfo.textContent = translate('settings.cloudSyncInfo');
            cloudSyncInfo.setAttribute('data-i18n', 'settings.cloudSyncInfo');
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
