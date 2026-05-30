import { currencyData } from '../data/appData.js';
import { calculateRequiredOres } from './oreCalculator.js';
import { calculateRemainingTime } from './timeCalculator.js';

import { calculateClanWarIncome } from '../incomeCalculations/clanWarIncome.js';
import { calculateCwlIncome } from '../incomeCalculations/cwlIncome.js';
import { calculateEventPassIncome } from '../incomeCalculations/eventPassIncome.js';
import { calculateEventTraderIncome } from '../incomeCalculations/eventTraderIncome.js';
import { calculateGemTraderIncome } from '../incomeCalculations/gemTraderIncome.js';
import { calculateProspectorIncome } from '../incomeCalculations/prospectorManager.js';
import { calculateRaidMedalTraderIncome } from '../incomeCalculations/raidMedalTraderIncome.js';
import { calculateShopOfferIncome } from '../incomeCalculations/shopOffersIncome.js';
import { calculateStarBonusIncome } from '../incomeCalculations/starBonusIncome.js';
import { calculateSupercellEventsIncome } from '../incomeCalculations/supercellEventsIncome.js';

export function recalculateAll(state) {
    state.derived.requiredOres = calculateRequiredOres(state.heroes, state.storedOres, state.planner);

    const eventPassIncome = calculateEventPassIncome(state.income.eventPass);
    const eventTraderIncome = calculateEventTraderIncome(state.income.eventTrader, eventPassIncome?.availableMedals);

    const supercellEventsState = state.income.supercellEvents || { worldChampionship: false };

    const incomeSources = {
        starBonus: calculateStarBonusIncome(
            state.income.starBonus?.league || 105000000, 
            state.income.starBonus?.eventFrequency ?? 2,
            state.income.starBonus?.eventDuration ?? 5,
            state.income.starBonus?.thUpgrades || {}
        ),
        supercellEvents: calculateSupercellEventsIncome(supercellEventsState.worldChampionship),
        clanWar: calculateClanWarIncome(state.income.clanWar),
        cwl: calculateCwlIncome(state.income.cwl),
        raidMedalTrader: calculateRaidMedalTraderIncome(state.income.raidMedals),
        gemTrader: calculateGemTraderIncome(state.income.gems),
        eventPass: eventPassIncome,
        eventTrader: eventTraderIncome,
        shopOffers: calculateShopOfferIncome(state.income.shopOffers),
        prospector: calculateProspectorIncome(state.income.prospector),
    };
    state.derived.incomeSources = incomeSources;

    let totalIncomeForTimeframe = { shiny: 0, glowy: 0, starry: 0 };
    let totalMonthlyIncome = { shiny: 0, glowy: 0, starry: 0 };

    for (const currencyCode of Object.keys(currencyData)) {
        totalIncomeForTimeframe[currencyCode.toLowerCase()] = 0;
        totalMonthlyIncome[currencyCode.toLowerCase()] = 0;
    }

    const timeframe = state.uiSettings.incomeCard?.timeframe || 'monthly';
    for (const source in incomeSources) {
        const timeframeIncome = incomeSources[source]?.[timeframe];
        const monthlyIncome = incomeSources[source]?.['monthly'];
        if (timeframeIncome) {
            totalIncomeForTimeframe.shiny += timeframeIncome.shiny || 0;
            totalIncomeForTimeframe.glowy += timeframeIncome.glowy || 0;
            totalIncomeForTimeframe.starry += timeframeIncome.starry || 0;
            for (const currencyCode of Object.keys(currencyData)) {
                totalIncomeForTimeframe[currencyCode] += timeframeIncome[currencyCode] || 0;
            }
        }
        if (monthlyIncome) {
            totalMonthlyIncome.shiny += monthlyIncome.shiny || 0;
            totalMonthlyIncome.glowy += monthlyIncome.glowy || 0;
            totalMonthlyIncome.starry += monthlyIncome.starry || 0;
            for (const currencyCode of Object.keys(currencyData)) {
                totalMonthlyIncome[currencyCode] += monthlyIncome[currencyCode] || 0;
            }
        }
    }
    state.derived.totalIncome = totalIncomeForTimeframe;

    state.derived.remainingTime = calculateRemainingTime(state.derived.requiredOres, totalMonthlyIncome);

    const shopOfferMonthly = incomeSources.shopOffers?.monthly || {};
    const eventPassMonthly = incomeSources.eventPass?.monthly || {};
    const prospectorMonthly = incomeSources.prospector?.monthly || {};

    const totalMoneyCost = {};
    for (const currencyCode of Object.keys(currencyData)) {
        totalMoneyCost[currencyCode] = (shopOfferMonthly[currencyCode] || 0) + (eventPassMonthly[currencyCode] || 0) + (prospectorMonthly[currencyCode] || 0);
    }
    state.derived.totalMoneyCost = totalMoneyCost;
}