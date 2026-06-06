import { state } from "../core/state.js";

import { currencyData, priceTierRegistry } from "../data/appData.js";
import { DAYS_IN_WEEK, DAYS_IN_MONTH, WEEKS_IN_MONTH, MONTHS_IN_BIMONTH } from "../data/timeConstants.js";

export function getPriceForTier(tierKey, targetCurrencyCode) {
    if (!tierKey) return 0;
    
    const selectedCurrency = targetCurrencyCode || state.uiSettings.currency.code;
    const activeTag = state.savedPlayerTags[0];
    const playerState = state.allPlayersData[activeTag];
    
    // 1. Check Custom Pricing first
    if (playerState?.currency?.globalPricing?.[selectedCurrency]) {
        const customPricing = playerState.currency.globalPricing[selectedCurrency];
        if (customPricing[tierKey] !== undefined) {
            return parseFloat(customPricing[tierKey]);
        }
    }
    
    // 2. Default pricing from registry
    const tierData = priceTierRegistry[tierKey];
    if (tierData && tierData[selectedCurrency] !== undefined) {
        return tierData[selectedCurrency];
    }
    
    // 3. Fallback to USD price from registry
    if (tierData && tierData.USD !== undefined) {
        return tierData.USD;
    }
    
    return 0;
}

export function getCurrencySymbol() {
    const selectedCurrency = state.uiSettings.currency.code;
    return currencyData[selectedCurrency]?.symbol || '$';
}

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

export function calculateWarIncome(winRate, drawRate, oresPerAttack, attacksPerEvent, eventsPerMonth) {
    const effectiveWinRate = winRate ?? 50;
    const winFactor = effectiveWinRate / 100;
    const drawFactor = ((drawRate || 0) / 100) * 0.75;
    const lossFactor = ((100 - effectiveWinRate - (drawRate || 0)) / 100) * 0.5;
    const totalFactor = winFactor + drawFactor + lossFactor;

    const avgOresPerEvent = {
        shiny: attacksPerEvent * (oresPerAttack?.shiny || 0) * totalFactor,
        glowy: attacksPerEvent * (oresPerAttack?.glowy || 0) * totalFactor,
        starry: attacksPerEvent * (oresPerAttack?.starry || 0) * totalFactor,
    };
    const monthlyOres = {
        shiny: eventsPerMonth * avgOresPerEvent.shiny,
        glowy: eventsPerMonth * avgOresPerEvent.glowy,
        starry: eventsPerMonth * avgOresPerEvent.starry,
    };
    return calculateTimeframeBreakdown(monthlyOres, { perEvent: avgOresPerEvent });
}

export function calculateWeeklyIncome(weeklyOres) {
    const monthlyOres = {
        shiny: weeklyOres.shiny * WEEKS_IN_MONTH,
        glowy: weeklyOres.glowy * WEEKS_IN_MONTH,
        starry: weeklyOres.starry * WEEKS_IN_MONTH,
    };
    return calculateTimeframeBreakdown(monthlyOres, { weekly: weeklyOres });
}

export function calculateBimonthlyIncome(bimonthlyOres) {
    const monthlyOres = {
        shiny: bimonthlyOres.shiny / MONTHS_IN_BIMONTH,
        glowy: bimonthlyOres.glowy / MONTHS_IN_BIMONTH,
        starry: bimonthlyOres.starry / MONTHS_IN_BIMONTH,
    };
    return calculateTimeframeBreakdown(monthlyOres, { bimonthly: bimonthlyOres });
}

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