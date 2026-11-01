import { runningCostsData } from '../../data/runningCostsData.js';
import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';

import { formatDate } from '../../utils/dateUtils.js';
import { logger } from '../../utils/logger.js';
import { closeModalAnimated, openModal } from '../../utils/modalHistoryManager.js';
import { animateValue, formatCurrency } from '../../utils/numberFormatter.js';

import { fetchRunningCosts } from '../../services/apiService.js';

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

    const lang = state.uiSettings?.language || 'en';
    const date = new Date(parseInt(year, 10), monthIndex, 1);
    return formatDate(date, { month: 'long', year: 'numeric' }, lang);
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
        let endVal = Number(data.totalCostTillDate || 0);
        // Exclude legacy cached invoice taxes from the cumulative total to align with the + TAX badge
        if (data.breakdown && Array.isArray(data.breakdown)) {
            data.breakdown.forEach(item => {
                (item.services || []).forEach(s => {
                    const name = (s.name || '').toLowerCase();
                    if (name === 'invoice' || name === 'tax') {
                        endVal -= (s.cost || 0);
                    }
                });
            });
            endVal = parseFloat(endVal.toFixed(2));
        }
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
            const lang = state.uiSettings?.language || 'en';
            if (!isNaN(date.getTime())) {
                updateDate.textContent = formatDate(date, { day: 'numeric', month: 'short', year: 'numeric' }, lang);
            } else {
                updateDate.textContent = '';
            }
        } catch {
            updateDate.textContent = '';
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

                const rawServices = item.services || [];
                // Defensively exclude invoice taxes and adjustments to ensure values strictly reflect pre-tax infrastructure
                const services = rawServices.filter(s => {
                    const name = (s.name || '').toLowerCase();
                    return name !== 'invoice' && name !== 'tax';
                });
                const hasFilteredTaxes = services.length < rawServices.length;
                const totalCost = hasFilteredTaxes
                    ? parseFloat(services.reduce((sum, s) => sum + (s.cost || 0), 0).toFixed(2))
                    : (item.totalCost || 0);

                const monthTotal = document.createElement('span');
                monthTotal.className = 'costs-month-total';
                monthTotal.textContent = `$${formatCurrency(totalCost)}`;
                header.appendChild(monthTotal);

                card.appendChild(header);

                const list = document.createElement('div');
                list.className = 'costs-services-list';

                let toggleBtn = null;

                if (services.length > 0) {
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

                        list.appendChild(createServiceRow(translate('views.settings.projectCosts.modal.others'), restSum, 'others-row'));

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

                        const icon = document.createElement('clashcalc-assets-svg');
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
 * @param {Record<string, any>} [options={}] - Optional modal display configuration.
 * @returns {Promise<void>}
 */
export async function openRunningCostsModal(options = {}) {
    const modal = document.getElementById('running-costs-modal');
    if (!modal) return;

    if (!modal.hasAttribute('role')) modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    openModal(modal, options);

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
        historyContainer.innerHTML = `<div class="costs-disclaimer costs-disclaimer--center">${translate('views.settings.projectCosts.modal.loading')}</div>`;
    }

    try {
        const data = await fetchRunningCosts();
        renderRunningCostsData(modal, data, totalValue, historyContainer, updateDate);
    } catch (err) {
        logger.warn('Failed to load live running costs from server, falling back to static/cached data:', err);
        renderRunningCostsData(modal, runningCostsData, totalValue, historyContainer, updateDate);
    }
}
