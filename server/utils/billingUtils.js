const { SERVER_CONSTANTS } = require('../constants.js');

/**
 * @typedef {Object} BillingRow
 * @property {string} [service_name]
 * @property {string} [sku_name]
 * @property {number|string} [total_cost]
 * @property {string} [billing_month]
 */

/**
 * @typedef {Object} BillingExtra
 * @property {string} name
 * @property {number} cost
 * @property {string} month
 */

/**
 * @typedef {Object} BillingFooter
 * @property {string} month
 * @property {string} text
 */

/**
 * @typedef {Object} BillingExtrasConfig
 * @property {BillingExtra[]} [extras]
 * @property {BillingFooter[]} [footers]
 */

/**
 * @typedef {Object} ServiceItem
 * @property {string} name
 * @property {number} cost
 * @property {boolean} [highlight]
 */

/**
 * @typedef {Object} MonthlyBreakdown
 * @property {string} month
 * @property {number} totalCost
 * @property {ServiceItem[]} services
 * @property {string} [footer]
 */

/**
 * Pure function to aggregate BigQuery billing cost rows and merge manual extras.
 *
 * @param {BillingRow[]} rows - Raw BigQuery cost rows.
 * @param {BillingExtrasConfig} [extrasConfig] - Extra items and footer config.
 * @param {string} [currentMonthStr] - Current month in YYYY-MM format to separate history from active month.
 * @returns {{ totalCostTillDate: number, breakdown: MonthlyBreakdown[] }} Aggregated billing summary.
 */
function aggregateMonthlyBilling(rows = [], extrasConfig = { extras: [], footers: [] }, currentMonthStr = '') {
    if (!currentMonthStr) {
        const currentDate = new Date();
        currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    }

    let totalCostTillDate = 0;
    /** @type {Record<string, { month: string, services: Record<string, number> }>} */
    const monthlyGroups = {};

    if (Array.isArray(rows)) {
        rows.forEach(row => {
            const cost = typeof row.total_cost === 'number' ? row.total_cost : parseFloat(String(row.total_cost || 0));
            const month = row.billing_month;
            if (!month || isNaN(cost)) return;

            if (month < currentMonthStr) {
                totalCostTillDate += cost;
            }

            if (!monthlyGroups[month]) {
                monthlyGroups[month] = {
                    month: month,
                    services: {}
                };
            }

            const serviceName = row.service_name || 'Other Services';
            if (!monthlyGroups[month].services[serviceName]) {
                monthlyGroups[month].services[serviceName] = 0;
            }
            monthlyGroups[month].services[serviceName] += cost;
        });
    }

    const safeExtras = extrasConfig && Array.isArray(extrasConfig.extras) ? extrasConfig.extras : [];
    safeExtras.forEach(extra => {
        const cost = typeof extra.cost === 'number' ? extra.cost : parseFloat(String(extra.cost || 0));
        const month = extra.month;
        if (!month || isNaN(cost)) return;

        if (month < currentMonthStr) {
            totalCostTillDate += cost;
        }

        if (!monthlyGroups[month]) {
            monthlyGroups[month] = {
                month: month,
                services: {}
            };
        }
    });

    const sortedMonths = Object.keys(monthlyGroups).sort((a, b) => b.localeCompare(a));
    const historyMonths = sortedMonths
        .filter(m => m < currentMonthStr)
        .slice(0, SERVER_CONSTANTS.MAX_HISTORICAL_BILLING_MONTHS);

    const breakdown = historyMonths.map(month => {
        const group = monthlyGroups[month];
        let negligibleSum = 0;
        /** @type {ServiceItem[]} */
        const filteredServices = [];

        Object.keys(group.services).forEach(name => {
            const rawCost = group.services[name];
            if (rawCost < SERVER_CONSTANTS.NEGLIGIBLE_COST_THRESHOLD) {
                negligibleSum += rawCost;
            } else {
                filteredServices.push({
                    name: name,
                    cost: parseFloat(rawCost.toFixed(2))
                });
            }
        });

        if (negligibleSum > 0) {
            filteredServices.push({
                name: 'Others',
                cost: parseFloat(Math.max(0.01, negligibleSum).toFixed(2))
            });
        }

        filteredServices.sort((a, b) => b.cost - a.cost);

        const monthExtras = safeExtras
            .filter(e => e.month === month)
            .map(e => ({
                name: e.name,
                cost: parseFloat(Number(e.cost || 0).toFixed(2)),
                highlight: true
            }));

        const finalServices = [...monthExtras, ...filteredServices];
        const totalCost = parseFloat(finalServices.reduce((sum, s) => sum + s.cost, 0).toFixed(2));
        const safeFooters = extrasConfig && Array.isArray(extrasConfig.footers) ? extrasConfig.footers : [];
        const footerMatch = safeFooters.find(f => f.month === month);

        /** @type {MonthlyBreakdown} */
        const result = {
            month: month,
            totalCost: totalCost,
            services: finalServices
        };

        if (footerMatch && footerMatch.text) {
            result.footer = footerMatch.text;
        }

        return result;
    });

    return {
        totalCostTillDate: parseFloat(totalCostTillDate.toFixed(2)),
        breakdown
    };
}

module.exports = { aggregateMonthlyBilling };
