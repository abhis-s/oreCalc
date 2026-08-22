import { currencyData, priceTierRegistry } from '../data/pricingData.js';
import { DAYS_IN_MONTH, DAYS_IN_WEEK, MONTHS_IN_BIMONTH, WEEKS_IN_MONTH } from '../data/timeConstants.js';

/**
 * Resolves the unit monetary price for a Supercell store tier across supported currencies.
 *
 * @param {string} tierKey - Price tier registry identifier (e.g. 'tier1', 'eventPass').
 * @param {string} [targetCurrencyCode='USD'] - ISO currency code.
 * @param {Record<string, number> | null} [customPricing=null] - Optional custom pricing overrides.
 * @returns {number} Numeric price in target currency.
 */
export function getPriceForTier(tierKey, targetCurrencyCode = 'USD', customPricing = null) {
    if (!tierKey) return 0;

    const selectedCurrency = targetCurrencyCode || 'USD';

    if (customPricing && customPricing[tierKey] !== undefined) {
        return parseFloat(String(customPricing[tierKey]));
    }

    const tierData = priceTierRegistry[tierKey];
    if (tierData && tierData[selectedCurrency] !== undefined) {
        return tierData[selectedCurrency];
    }

    if (tierData && tierData.USD !== undefined) {
        return tierData.USD;
    }

    return 0;
}

/**
 * Returns the display symbol for a currency code.
 *
 * @param {string} [targetCurrencyCode='USD'] - ISO currency code.
 * @returns {string} Currency symbol (e.g. '$', '€').
 */
export function getCurrencySymbol(targetCurrencyCode = 'USD') {
    const selectedCurrency = targetCurrencyCode || 'USD';
    return currencyData[selectedCurrency]?.symbol || '$';
}

/**
 * Derives daily, weekly, monthly, and bimonthly breakdowns from a base monthly ore shape.
 *
 * @param {import('../core/types.js').OreQuantity} monthlyOres - Base monthly ore numbers.
 * @param {Record<string, any>} [additionalData={}] - Additional metadata or rate fields to merge.
 * @returns {import('../core/types.js').IncomeResult} Composite timeframe rates.
 */
function calculateTimeframeBreakdown(monthlyOres, additionalData = {}) {
    const daily = {
        shiny: monthlyOres.shiny / DAYS_IN_MONTH,
        glowy: monthlyOres.glowy / DAYS_IN_MONTH,
        starry: monthlyOres.starry / DAYS_IN_MONTH,
    };
    const weekly = {
        shiny: daily.shiny * DAYS_IN_WEEK,
        glowy: daily.glowy * DAYS_IN_WEEK,
        starry: daily.starry * DAYS_IN_WEEK,
    };
    const bimonthly = {
        shiny: monthlyOres.shiny * MONTHS_IN_BIMONTH,
        glowy: monthlyOres.glowy * MONTHS_IN_BIMONTH,
        starry: monthlyOres.starry * MONTHS_IN_BIMONTH,
    };
    return { daily, weekly, monthly: monthlyOres, bimonthly, ...additionalData };
}

/**
 * Calculates weighted Clan War ore income factoring in win, draw, and loss probabilities.
 *
 * @param {number} [winRate=50] - Win percentage (0-100).
 * @param {number} [drawRate=0] - Draw percentage (0-100).
 * @param {Partial<import('../core/types.js').OreQuantity>} [oresPerAttack={}] - Base ores awarded per war attack.
 * @param {number} [attacksPerEvent=2] - Attacks per war event (2 for Clan Wars, 1 for CWL).
 * @param {number} [eventsPerMonth=0] - Frequency of war events per month.
 * @returns {import('../core/types.js').IncomeResult} Composite war income breakdown.
 */
export function calculateWarIncome(winRate, drawRate, oresPerAttack, attacksPerEvent = 2, eventsPerMonth = 0) {
    const effectiveWinRate = winRate ?? 50;
    const winFactor = effectiveWinRate / 100;
    const drawFactor = ((drawRate || 0) / 100) * 0.75;
    const lossFactor = ((100 - effectiveWinRate - (drawRate || 0)) / 100) * 0.5;
    const totalFactor = winFactor + drawFactor + lossFactor;

    const avgOresPerEvent = {
        shiny: (attacksPerEvent || 1) * (oresPerAttack?.shiny || 0) * totalFactor,
        glowy: (attacksPerEvent || 1) * (oresPerAttack?.glowy || 0) * totalFactor,
        starry: (attacksPerEvent || 1) * (oresPerAttack?.starry || 0) * totalFactor,
    };

    const monthlyOres = {
        shiny: (eventsPerMonth || 0) * avgOresPerEvent.shiny,
        glowy: (eventsPerMonth || 0) * avgOresPerEvent.glowy,
        starry: (eventsPerMonth || 0) * avgOresPerEvent.starry,
    };
    return calculateTimeframeBreakdown(monthlyOres, { perEvent: avgOresPerEvent });
}

/**
 * Calculates monthly and timeframe rates from a weekly ore quantity.
 *
 * @param {import('../core/types.js').OreQuantity} weeklyOres - Weekly ore quantity.
 * @returns {import('../core/types.js').IncomeResult} Composite income breakdown.
 */
export function calculateWeeklyIncome(weeklyOres) {
    const monthlyOres = {
        shiny: weeklyOres.shiny * WEEKS_IN_MONTH,
        glowy: weeklyOres.glowy * WEEKS_IN_MONTH,
        starry: weeklyOres.starry * WEEKS_IN_MONTH,
    };
    return calculateTimeframeBreakdown(monthlyOres, { weekly: weeklyOres });
}

/**
 * Calculates monthly and timeframe rates from a bimonthly ore quantity.
 *
 * @param {import('../core/types.js').OreQuantity} bimonthlyOres - Bimonthly ore quantity.
 * @returns {import('../core/types.js').IncomeResult} Composite income breakdown.
 */
export function calculateBimonthlyIncome(bimonthlyOres) {
    const monthlyOres = {
        shiny: bimonthlyOres.shiny / MONTHS_IN_BIMONTH,
        glowy: bimonthlyOres.glowy / MONTHS_IN_BIMONTH,
        starry: bimonthlyOres.starry / MONTHS_IN_BIMONTH,
    };
    return calculateTimeframeBreakdown(monthlyOres, { bimonthly: bimonthlyOres });
}

/**
 * Adjusts win and draw rates so that their sum does not exceed 100%.
 *
 * @param {number} [winRate=50] - Current win rate.
 * @param {number} [drawRate=0] - Current draw rate.
 * @param {'win' | 'draw' | string} [changedRate='win'] - Which slider or rate changed.
 * @returns {{ winRate: number, drawRate: number }} Adjusted rate pair.
 */
export function adjustWarRates(winRate, drawRate, changedRate) {
    let adjustedWinRate = winRate ?? 50;
    let adjustedDrawRate = drawRate || 0;
    const totalRates = (winRate ?? 50) + (drawRate || 0);

    if (totalRates > 100) {
        const excess = totalRates - 100;
        if (changedRate === 'win') {
            adjustedDrawRate = Math.max(0, (drawRate || 0) - excess);
        } else {
            adjustedWinRate = Math.max(0, winRate - excess);
        }
    }
    return { winRate: adjustedWinRate, drawRate: adjustedDrawRate };
}
