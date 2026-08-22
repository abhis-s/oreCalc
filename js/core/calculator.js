import { currencyData } from '../data/pricingData.js';

import { UNRANKED_LEAGUE_ID } from './constants.js';
import { calculateRequiredOres } from './oreCalculator.js';
import { calculateRemainingTime } from './timeCalculator.js';

import { calculateClanWarIncome } from '../domain/income/clanWarIncome.js';
import { calculateCwlIncome } from '../domain/income/cwlIncome.js';
import { calculateEventPassIncome } from '../domain/income/eventPassIncome.js';
import { calculateEventTraderIncome } from '../domain/income/eventTraderIncome.js';
import { calculateGemTraderIncome } from '../domain/income/gemTraderIncome.js';
import { calculateHeroJourneyUpcomingOres } from '../domain/income/heroJourneyIncome.js';
import { calculateProspectorIncome } from '../domain/income/prospectorManager.js';
import { calculateRaidMedalTraderIncome } from '../domain/income/raidMedalTraderIncome.js';
import { calculateShopOfferIncome } from '../domain/income/shopOffersIncome.js';
import { calculateStarBonusIncome } from '../domain/income/starBonusIncome.js';
import { calculateSupercellEventsIncome } from '../domain/income/supercellEventsIncome.js';

/**
 * Recalculates all derived state slices (required ores, income sources, total income, ETAs, real money costs).
 * @param {import('./types.js').AppState} state - Global application state.
 */
export function recalculateAll(state) {
    const heroJourneyUpcomingOres = calculateHeroJourneyUpcomingOres(state);
    state.derived.heroJourneyUpcomingOres = heroJourneyUpcomingOres;
    state.derived.requiredOres = calculateRequiredOres(state.heroes, state.storedOres, state.planner, heroJourneyUpcomingOres);

    const eventPassIncome = calculateEventPassIncome(state.income.eventPass);
    const eventTraderIncome = calculateEventTraderIncome(state.income.eventTrader, eventPassIncome?.availableMedals);

    const supercellEventsState = state.income.supercellEvents || { worldChampionship: false };

    // Compute all non-prospector sources first so they are available
    // for the assisted-conversion context when calculating prospector income.
    const baseIncomeSources = {
        starBonus: calculateStarBonusIncome(
            state.income.starBonus?.league || UNRANKED_LEAGUE_ID,
            state.income.starBonus || {}
        ),
        supercellEvents: calculateSupercellEventsIncome(
            supercellEventsState.worldChampionship,
            state.planner?.calendar?.customChipSettings?.supercellEvents
        ),
        clanWar: calculateClanWarIncome(state.income.clanWar),
        cwl: calculateCwlIncome(state.income.cwl),
        raidMedalTrader: calculateRaidMedalTraderIncome(state.income.raidMedals),
        gemTrader: calculateGemTraderIncome(state.income.gems),
        eventPass: eventPassIncome,
        eventTrader: eventTraderIncome,
        shopOffers: calculateShopOfferIncome(state.income.shopOffers),
    };

    // Compute prospector income, optionally driven by the assisted-conversion schedule
    let prospectorIncome;
    if (!state.income.prospector?.assistedConversion) {
        prospectorIncome = calculateProspectorIncome(state.income.prospector);
    } else {
        const baseMonthly = { shiny: 0, glowy: 0, starry: 0 };
        for (const src of Object.values(baseIncomeSources)) {
            baseMonthly.shiny += src?.monthly?.shiny || 0;
            baseMonthly.glowy += src?.monthly?.glowy || 0;
            baseMonthly.starry += src?.monthly?.starry || 0;
        }
        const baseIncome = {
            shiny: baseMonthly.shiny / 30.44,
            glowy: baseMonthly.glowy / 30.44,
            starry: baseMonthly.starry / 30.44,
        };
        const missing = state.derived.requiredOres;
        prospectorIncome = calculateProspectorIncome(state.income.prospector, { missing, baseIncome });
    }

    const incomeSources = { ...baseIncomeSources, prospector: prospectorIncome };
    state.derived.incomeSources = incomeSources;

    let totalIncomeForTimeframe = { shiny: 0, glowy: 0, starry: 0 };
    let totalMonthlyIncome = { shiny: 0, glowy: 0, starry: 0 };

    for (const currencyCode of Object.keys(currencyData)) {
        totalIncomeForTimeframe[currencyCode] = 0;
        totalMonthlyIncome[currencyCode] = 0;
    }

    const timeframe = state.uiSettings.summaryTimeframe || 'monthly';
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
    state.derived.totalMonthlyIncome = totalMonthlyIncome;

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
