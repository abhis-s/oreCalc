import { calculateRequiredOres } from './oreCalculator.js';
import { calculateRemainingTime } from './timeCalculator.js';

import { calculateStarBonusIncome } from '../incomeCalculations/starBonusIncome.js';
import { calculateClanWarIncome } from '../incomeCalculations/clanWarIncome.js';
import { calculateCwlIncome } from '../incomeCalculations/cwlIncome.js';
import { calculateRaidMedalTraderIncome } from '../incomeCalculations/raidMedalTraderIncome.js';
import { calculateGemTraderIncome } from '../incomeCalculations/gemTraderIncome.js';
import { calculateEventPassIncome } from '../incomeCalculations/eventPassIncome.js';
import { calculateEventTraderIncome } from '../incomeCalculations/eventTraderIncome.js';
import { calculateShopOfferIncome } from '../incomeCalculations/shopOfferIncome.js';
import { calculateChampionshipIncome } from '../incomeCalculations/championshipIncome.js';
import { currencySymbols } from '../data/appData.js';

export function recalculateAll(state) {
    state.derived.requiredOres = calculateRequiredOres(state.heroes, state.storedOres, state.planner);

    const eventPassIncome = calculateEventPassIncome(state.income.eventPass, state.uiSettings.regionalPricingEnabled);
    const eventTraderIncome = calculateEventTraderIncome(state.income.eventTrader, eventPassIncome?.availableMedals);

    const incomeSources = {
        starBonus: calculateStarBonusIncome(state.income.starBonus.league, state.income.starBonus.is4xEnabled),
        championship: calculateChampionshipIncome(state.income.championship.supercellEvents),
        clanWar: calculateClanWarIncome(state.income.clanWar),
        cwl: calculateCwlIncome(state.income.cwl),
        raidMedalTrader: calculateRaidMedalTraderIncome(state.income.raidMedals),
        gemTrader: calculateGemTraderIncome(state.income.gems),
        eventPass: eventPassIncome,
        eventTrader: eventTraderIncome,
        shopOffers: calculateShopOfferIncome(state.income.shopOffers, state.uiSettings),
    };
    state.derived.incomeSources = incomeSources;

    let totalIncomeForTimeframe = { shiny: 0, glowy: 0, starry: 0 };
    let totalMonthlyIncome = { shiny: 0, glowy: 0, starry: 0 };

    for (const currencyCode of Object.keys(currencySymbols)) {
        totalIncomeForTimeframe[currencyCode.toLowerCase()] = 0;
        totalMonthlyIncome[currencyCode.toLowerCase()] = 0;
    }

    for (const source in incomeSources) {
        const timeframeIncome = incomeSources[source]?.[state.uiSettings.incomeTimeframe];
        const monthlyIncome = incomeSources[source]?.['monthly'];
        if (timeframeIncome) {
            totalIncomeForTimeframe.shiny += timeframeIncome.shiny || 0;
            totalIncomeForTimeframe.glowy += timeframeIncome.glowy || 0;
            totalIncomeForTimeframe.starry += timeframeIncome.starry || 0;
            for (const currencyCode of Object.keys(currencySymbols)) {
                totalIncomeForTimeframe[currencyCode] += timeframeIncome[currencyCode] || 0;
            }
        }
        if (monthlyIncome) {
            totalMonthlyIncome.shiny += monthlyIncome.shiny || 0;
            totalMonthlyIncome.glowy += monthlyIncome.glowy || 0;
            totalMonthlyIncome.starry += monthlyIncome.starry || 0;
            for (const currencyCode of Object.keys(currencySymbols)) {
                totalMonthlyIncome[currencyCode] += monthlyIncome[currencyCode] || 0;
            }
        }
    }
    state.derived.totalIncome = totalIncomeForTimeframe;

    state.derived.remainingTime = calculateRemainingTime(state.derived.requiredOres, totalMonthlyIncome);

    const shopOfferMonthly = incomeSources.shopOffers?.monthly || {};
    const eventPassMonthly = incomeSources.eventPass?.monthly || {};

    const totalMoneyCost = {};
    for (const currencyCode of Object.keys(currencySymbols)) {
        totalMoneyCost[currencyCode] = (shopOfferMonthly[currencyCode] || 0) + (eventPassMonthly[currencyCode] || 0);
    }
    state.derived.totalMoneyCost = totalMoneyCost;
}