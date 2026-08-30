import { getLocale } from '../../data/languagesData.js';
import { runningCostsData } from '../../data/runningCostsData.js';
import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';

import { logger } from '../../utils/logger.js';
import { closeModalAnimated } from '../../utils/modalHistoryManager.js';
import { animateValue, formatCurrency } from '../../utils/numberFormatter.js';

import { openPrivacyModal } from './settingsLegalModals.js';
import { dom } from '../../dom/domElements.js';
import { fetchRunningCosts, submitBugReport } from '../../services/apiService.js';
import { showAlert } from '../../ui/noticeModal.js';

/**
 * Creates a service row DOM element for the running costs modal.
 *
 * @param {string} name - Service name or label.
 * @param {number} cost - Service cost in USD.
 * @param {string} [extraClass=''] - Additional CSS classes (e.g. 'highlighted', 'others-row', 'extra-service').
 * @returns {HTMLDivElement} Configured service row element.
 */
function createServiceRow(name, cost, extraClass = '') {
    const row = document.createElement('div');
    row.className = extraClass ? `costs-service-row ${extraClass}` : 'costs-service-row';

    const serviceName = document.createElement('span');
    serviceName.className = 'costs-service-name';
    serviceName.textContent = name;
    row.appendChild(serviceName);

    const serviceCost = document.createElement('span');
    serviceCost.className = 'costs-service-cost';
    serviceCost.textContent = `$${formatCurrency(cost || 0)}`;
    row.appendChild(serviceCost);

    return row;
}

/**
 * Formats a raw invoice month string (e.g. "2026-07" or "202607") into a localized string (e.g. "July 2026").
 *
 * @param {string} invoiceMonth - Raw month string.
 * @returns {string} Formatted localized month or original string if unmatched.
 */
export function formatInvoiceMonth(invoiceMonth) {
    if (!invoiceMonth || typeof invoiceMonth !== 'string') return invoiceMonth || '';
    const match = invoiceMonth.match(/^(\d{4})-?(\d{2})$/);
    if (!match) return invoiceMonth;

    const year = match[1];
    const monthIndex = parseInt(match[2], 10) - 1;

    const locale = getLocale(state.uiSettings?.language || 'en');
    const date = new Date(parseInt(year, 10), monthIndex, 1);
    return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

/**
 * Renders running costs data into the running costs modal DOM elements.
 *
 * @param {HTMLElement} modal - The modal DOM element.
 * @param {any} data - Running costs payload.
 * @param {HTMLElement|null} [totalValue] - Container for total cost text.
 * @param {HTMLElement|null} [historyContainer] - Container for monthly breakdown cards.
 * @param {HTMLElement|null} [updateDate] - Container for last updated date text.
 */
export function renderRunningCostsData(modal, data, totalValue, historyContainer, updateDate) {
    if (data.isMock) {
        modal.classList.add('is-mock');
    } else {
        modal.classList.remove('is-mock');
    }

    if (totalValue) {
        const prevVal = typeof totalValue._currentNumericValue === 'number'
            ? totalValue._currentNumericValue
            : (parseFloat(totalValue.textContent.replace(/[^0-9.-]/g, '')) || 0);
        const endVal = Number(data.totalCostTillDate || 0);
        totalValue._currentNumericValue = endVal;

        if (totalValue.textContent && totalValue.textContent !== '...' && Math.abs(prevVal - endVal) > 0.0001) {
            animateValue(totalValue, prevVal, endVal, 500, (val) => `$${formatCurrency(val)}`);
        } else {
            totalValue.textContent = `$${formatCurrency(endVal)}`;
        }
    }

    if (updateDate && data.lastUpdated) {
        try {
            const date = new Date(data.lastUpdated);
            if (!isNaN(date.getTime())) {
                const locale = getLocale(state.uiSettings?.language || 'en');
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

                let toggleBtn = null;

                if (item.services && item.services.length > 0) {
                    const services = item.services;
                    const highlightedServices = services.filter(s => s.highlight);
                    const standardServices = services.filter(s => !s.highlight);

                    highlightedServices.forEach(service => {
                        list.appendChild(createServiceRow(service.name, service.cost, 'highlighted'));
                    });

                    if (standardServices.length <= 2) {
                        standardServices.forEach(service => {
                            list.appendChild(createServiceRow(service.name, service.cost));
                        });
                    } else {
                        const top2 = standardServices.slice(0, 2);
                        const rest = standardServices.slice(2);
                        const restSum = rest.reduce((sum, s) => sum + (s.cost || 0), 0);

                        top2.forEach(service => {
                            list.appendChild(createServiceRow(service.name, service.cost));
                        });

                        list.appendChild(createServiceRow(translate('views.settings.runningCostsModal.others'), restSum, 'others-row'));

                        rest.forEach(service => {
                            list.appendChild(createServiceRow(service.name, service.cost, 'extra-service'));
                        });

                        toggleBtn = document.createElement('button');
                        toggleBtn.className = 'costs-toggle-expand-btn';
                        toggleBtn.type = 'button';

                        const btnText = document.createElement('span');
                        btnText.className = 'btn-text';
                        btnText.setAttribute('data-i18n', 'actions.showMore');
                        btnText.textContent = translate('actions.showMore');
                        toggleBtn.appendChild(btnText);

                        const icon = document.createElement('orecalc-assets-svg');
                        icon.setAttribute('name', 'dropdown');
                        icon.className = 'toggle-icon';
                        toggleBtn.appendChild(icon);

                        toggleBtn.onclick = (e) => {
                            e.preventDefault();
                            const isExpanded = card.classList.toggle('expanded');
                            const key = isExpanded ? 'actions.showLess' : 'actions.showMore';
                            btnText.textContent = translate(key);
                            btnText.setAttribute('data-i18n', key);
                        };
                    }
                }

                card.appendChild(list);

                if (toggleBtn) {
                    card.appendChild(toggleBtn);
                }

                if (item.footer) {
                    const footer = document.createElement('div');
                    footer.className = 'costs-month-footer';
                    footer.textContent = item.footer;
                    card.appendChild(footer);
                }

                historyContainer.appendChild(card);
            });
        }
    }
}

/**
 * Opens the Running Costs transparency dialog and fetches live hosting/infrastructure expenses.
 * @returns {Promise<void>}
 */
export async function openRunningCostsModal() {
    const modal = document.getElementById('running-costs-modal');
    if (!modal) return;

    if (!modal.hasAttribute('role')) modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    modal.classList.add('show');
    if (dom.overlay) dom.overlay.classList.add('show');

    const closeBtn = document.getElementById('close-running-costs-modal-btn');
    const closeActionBtn = document.getElementById('running-costs-close-btn');
    const totalValue = document.getElementById('running-costs-total-value');
    const historyContainer = document.getElementById('running-costs-history-container');
    const updateDate = document.getElementById('running-costs-update-date');

    const closeModal = () => {
        closeModalAnimated(modal);
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

    if (totalValue) totalValue.textContent = '...';
    if (historyContainer) {
        historyContainer.innerHTML = `<div class="costs-disclaimer costs-disclaimer--center">${translate('views.settings.runningCostsModal.loading')}</div>`;
    }

    try {
        const data = await fetchRunningCosts();
        renderRunningCostsData(modal, data, totalValue, historyContainer, updateDate);
    } catch (err) {
        logger.warn('Failed to load live running costs from server, falling back to static/cached data:', err);
        renderRunningCostsData(modal, runningCostsData, totalValue, historyContainer, updateDate);
    }
}

/**
 * Opens the Bug Report / Inaccuracy modal dialog with pre-filled telemetry and character limit bindings.
 */
export function openBugReportModal() {
    const modal = document.getElementById('bug-report-modal');
    if (!modal) return;

    if (!modal.hasAttribute('role')) modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const emailInput = document.getElementById('bug-report-email');
    const emailError = document.getElementById('bug-report-email-error');
    const descTextarea = document.getElementById('bug-report-desc');
    const descError = document.getElementById('bug-report-desc-error');
    const charCount = document.getElementById('bug-report-char-count');

    const attachCheckbox = document.getElementById('bug-report-attach-checkbox');
    const submitBtn = document.getElementById('submit-bug-report-btn');
    const closeHeaderBtn = document.getElementById('close-bug-report-header-btn');
    const closeBtn = document.getElementById('close-bug-report-modal-btn');

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

    const resetSWBtn = document.getElementById('bug-report-reset-sw-btn');
    if (resetSWBtn) {
        resetSWBtn.onclick = async (e) => {
            e.preventDefault();
            resetSWBtn.disabled = true;
            resetSWBtn.style.opacity = '0.7';

            if ('serviceWorker' in navigator) {
                try {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (const registration of registrations) {
                        await registration.unregister();
                    }
                } catch (err) {
                    logger.error('Failed to unregister service workers:', err);
                }
            }

            if ('caches' in window) {
                try {
                    await caches.delete('orecalc-cache-v1');
                } catch (err) {
                    logger.error('Failed to clear caches:', err);
                }
            }

            sessionStorage.removeItem('oreCalcLastUpdateReload');
            sessionStorage.removeItem('oreCalcUpdateDetectedAt');
            try { localStorage.removeItem('oreCalcUpdateDetectedAt'); } catch (_) {}
            window.location.reload();
        };
    }

    if (submitBtn) {
        submitBtn.onclick = async (e) => {
            e.preventDefault();

            const email = emailInput ? emailInput.value.trim() : '';
            const description = descTextarea ? descTextarea.value.trim() : '';

            if (description.length < 20) {
                if (descError) {
                    descError.textContent = translate('errors.bugDescriptionRequired');
                    descError.classList.add('show');
                }
                if (descTextarea) {
                    descTextarea.classList.add('input-error');
                    descTextarea.classList.remove('shake');
                    void descTextarea.offsetWidth;
                    descTextarea.classList.add('shake');
                }
                return;
            }

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
                        void emailInput.offsetWidth;
                        emailInput.classList.add('shake');
                    }
                    return;
                }
            }

            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = translate('actions.processing');
            if (closeBtn) closeBtn.disabled = true;

            try {
                const currentUserId = localStorage.getItem('oreCalc_userId') || 'unknown';

                let attachedData = null;
                if (attachCheckbox && attachCheckbox.checked) {
                    const stateClone = structuredClone(state);
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

    const privacyLink = modal.querySelector('#bug-report-privacy-link');
    if (privacyLink) {
        privacyLink.onclick = (e) => {
            e.preventDefault();
            openPrivacyModal();
        };
    }

    modal.classList.add('show');
    if (dom.overlay) dom.overlay.classList.add('show');
}

/**
 * Opens the Contact modal dialog.
 */
export function openContactModal() {
    const modal = document.getElementById('contact-modal');
    if (!modal) return;

    if (!modal.hasAttribute('role')) modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

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
