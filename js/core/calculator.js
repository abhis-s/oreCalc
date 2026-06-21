import { calculateClanWarIncome } from '../incomeCalculations/clanWarIncome.js';
import { calculateCwlIncome } from '../incomeCalculations/cwlIncome.js';
import { calculateEventPassIncome } from '../incomeCalculations/eventPassIncome.js';
import { calculateEventTraderIncome } from '../incomeCalculations/eventTraderIncome.js';
import { calculateGemTraderIncome } from '../incomeCalculations/gemTraderIncome.js';
import { calculateProspectorIncome } from '../incomeCalculations/prospectorManager.js';
import { heroData, upgradeCosts } from '../data/heroData.js';
import { calculateRaidMedalTraderIncome } from '../incomeCalculations/raidMedalTraderIncome.js';
import { calculateShopOfferIncome } from '../incomeCalculations/shopOffersIncome.js';
import { calculateStarBonusIncome } from '../incomeCalculations/starBonusIncome.js';
import { calculateSupercellEventsIncome } from '../incomeCalculations/supercellEventsIncome.js';

import { currencyData } from '../data/appData.js';

import { calculateRemainingTime } from './timeCalculator.js';
import { calculateRequiredOres } from './oreCalculator.js';

export function recalculateAll(state) {
    state.derived.requiredOres = calculateRequiredOres(state.heroes, state.storedOres, state.planner);

    const eventPassIncome = calculateEventPassIncome(state.income.eventPass);
    const eventTraderIncome = calculateEventTraderIncome(state.income.eventTrader, eventPassIncome?.availableMedals);

    const supercellEventsState = state.income.supercellEvents || { worldChampionship: false };

    // Compute all non-prospector sources first so they are available
    // for the assisted-conversion context when calculating prospector income.
    const baseIncomeSources = {
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
        const globalReq = { shiny: 0, glowy: 0, starry: 0 };
        const customMaxLevel = state.planner?.customMaxLevel || {};
        const commonMax = customMaxLevel.common !== undefined ? customMaxLevel.common : 18;
        const epicMax = customMaxLevel.epic !== undefined ? customMaxLevel.epic : 27;
        for (const heroName in (state.heroes || {})) {
            const hero = state.heroes[heroName];
            if (hero.enabled === false) continue;
            for (const equipName in hero.equipment) {
                const equip = hero.equipment[equipName];
                if (equip.checked === false) continue;
                const heroDataEntry = Object.values(heroData).find(h => h.name === heroName);
                const eqData = heroDataEntry?.equipment.find(e => e.name === equipName);
                if (!eqData) continue;
                const maxLevel = eqData.type === 'common' ? commonMax : epicMax;
                const currentLevel = equip.level || 1;
                if (currentLevel >= maxLevel) continue;
                for (let level = currentLevel + 1; level <= maxLevel; level++) {
                    const cost = upgradeCosts[level];
                    if (cost) {
                        globalReq.shiny += cost.shiny || 0;
                        globalReq.glowy += cost.glowy || 0;
                        if (eqData.type === 'epic') globalReq.starry += cost.starry || 0;
                    }
                }
            }
        }
        const storedOres = state.storedOres || {};
        const missing = {
            shiny: Math.max(0, globalReq.shiny - (parseFloat(storedOres.shiny) || 0)),
            glowy: Math.max(0, globalReq.glowy - (parseFloat(storedOres.glowy) || 0)),
            starry: Math.max(0, globalReq.starry - (parseFloat(storedOres.starry) || 0)),
        };
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
    state.derived.totalMonthlyIncome = totalMonthlyIncome;

    state.derived.remainingTime = calculateRemainingTime(state.derived.requiredOres, totalMonthlyIncome);

    const shopOfferMonthly = incomeSources.shopOffers?.monthly || {};
    const eventPassMonthly = incomeSources.eventPass?.monthly || {};
    const prospectorMonthly = incomeSources.prospector?.monthly || {};

    const totalMoneyCost = {};
    let factor = 1;
    if (timeframe === 'daily') {
        factor = 1 / 30;
    } else if (timeframe === 'weekly') {
        factor = 7 / 30;
    } else if (timeframe === 'bimonthly') {
        factor = 2;
    }

    for (const currencyCode of Object.keys(currencyData)) {
        const monthlyCost = (shopOfferMonthly[currencyCode] || 0) + (eventPassMonthly[currencyCode] || 0) + (prospectorMonthly[currencyCode] || 0);
        totalMoneyCost[currencyCode] = monthlyCost * factor;
    }
    state.derived.totalMoneyCost = totalMoneyCost;
}