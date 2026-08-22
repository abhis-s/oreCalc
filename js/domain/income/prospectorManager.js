import { upgradeCosts } from '../../data/equipmentCommonData.js';
import { heroData } from '../../data/heroData.js';
import { prospectorData } from '../../data/incomeSources/prospector.js';
import { conversionRates, oreMaxValues } from '../../data/oreConversionData.js';
import { currencyData } from '../../data/pricingData.js';

import { selectDerivedSourceIncome } from '../../core/selectors.js';

import { getPriceForTier } from '../../utils/incomeUtils.js';

/**
 * Returns the relative value factor of an ore type for conversion ratios.
 *
 * @param {string} oreType - Ore identifier ('shiny', 'glowy', 'starry').
 * @returns {number} Relative value weighting.
 */
function getOreValue(oreType) {
    switch (oreType) {
        case 'shiny':
            return 1;
        case 'glowy':
            return conversionRates.shiny / conversionRates.glowy;
        case 'starry':
            return conversionRates.shiny / conversionRates.starry;
        default:
            return 0;
    }
}

/**
 * Converts a quantity of ores from one type to another using game exchange rates.
 *
 * @param {string} fromOre - Source ore type.
 * @param {string} toOre - Target ore type.
 * @param {number} fromAmount - Quantity of source ore to convert.
 * @returns {number} Resulting converted ore quantity.
 */
export function convertOres(fromOre, toOre, fromAmount) {
    if (fromOre === toOre) {
        return fromAmount;
    }

    const fromValue = getOreValue(fromOre);
    const toValue = getOreValue(toOre);

    const conversionFactor = fromValue / toValue;

    return Math.round(fromAmount * conversionFactor);
}

/**
 * Gets step increment value for numeric stepper controls based on ore pair.
 *
 * @param {string} fromOre - Source ore type.
 * @param {string} toOre - Target ore type.
 * @returns {number} Stepper increment size.
 */
export function getStepValue(fromOre, toOre) {
    if (fromOre === 'shiny' && toOre === 'glowy') {
        return 50;
    }
    if (fromOre === 'glowy' && toOre === 'shiny') {
        return 3;
    }
    if (fromOre === 'shiny' && toOre === 'starry') {
        return 1000;
    }
    if (fromOre === 'starry' && toOre === 'shiny') {
        return 1;
    }
    if (fromOre === 'glowy' && toOre === 'starry') {
        return 60;
    }
    if (fromOre === 'starry' && toOre === 'glowy') {
        return 1;
    }
    return 1;
}

/**
 * Find the optimal Assisted Conversion schedule for the prospector.
 *
 * @param {import('../../core/types.js').OreQuantity} req - Required/missing ores.
 * @param {import('../../core/types.js').OreQuantity} stored - Currently stored inventory ores.
 * @param {import('../../core/types.js').OreQuantity} baseIncome - Daily base income (without prospector).
 * @returns {{ completionDays: number, conversions: Array<{ from: string, to: string, days: number, amount?: number }>, naturalDays: Record<string, number> }} Optimal schedule.
 */
export function findOptimalConversionSchedule(req, stored, baseIncome) {
    const missing = {
        shiny: Math.max(0, req.shiny - stored.shiny),
        glowy: Math.max(0, req.glowy - stored.glowy),
        starry: Math.max(0, req.starry - stored.starry)
    };

    const naturalDays = {};
    for (const ore of ['shiny', 'glowy', 'starry']) {
        if (missing[ore] === 0) {
            naturalDays[ore] = 0;
        } else if (baseIncome[ore] <= 0) {
            naturalDays[ore] = Infinity;
        } else {
            naturalDays[ore] = missing[ore] / baseIncome[ore];
        }
    }

    const baseIncomeSum = baseIncome.shiny + baseIncome.glowy + baseIncome.starry;
    if (baseIncomeSum <= 0) {
        return {
            completionDays: Infinity,
            conversions: [],
            naturalDays: naturalDays
        };
    }

    if (missing.shiny === 0 && missing.glowy === 0 && missing.starry === 0) {
        return { completionDays: 0, conversions: [], naturalDays: naturalDays };
    }

    const sortedOres = ['shiny', 'glowy', 'starry'].sort((a, b) => naturalDays[a] - naturalDays[b]);
    const oFast = sortedOres[0];
    const oMid = sortedOres[1];
    const oSlow = sortedOres[2];

    const candidates = [
        { from: oFast, to: oSlow },
        { from: oFast, to: oMid },
        { from: oMid, to: oSlow }
    ];

    const c0_from = candidates[0].from;
    const c0_to = candidates[0].to;
    const c0_fromRate = oreMaxValues[c0_from];
    const c0_toRate = convertOres(c0_from, c0_to, c0_fromRate);

    const c1_from = candidates[1].from;
    const c1_to = candidates[1].to;
    const c1_fromRate = oreMaxValues[c1_from];
    const c1_toRate = convertOres(c1_from, c1_to, c1_fromRate);

    const c2_from = candidates[2].from;
    const c2_to = candidates[2].to;
    const c2_fromRate = oreMaxValues[c2_from];
    const c2_toRate = convertOres(c2_from, c2_to, c2_fromRate);

    const baseShiny = baseIncome.shiny || 0;
    const baseGlowy = baseIncome.glowy || 0;
    const baseStarry = baseIncome.starry || 0;

    const missShiny = missing.shiny || 0;
    const missGlowy = missing.glowy || 0;
    const missStarry = missing.starry || 0;

    const maxAllowedShiny = 30 * baseShiny + 1e-3;
    const maxAllowedGlowy = 30 * baseGlowy + 1e-3;
    const maxAllowedStarry = 30 * baseStarry + 1e-3;

    let minTmax = Infinity;
    let minConversionDays = Infinity;
    let bestX1 = 0;
    let bestX2 = 0;
    let bestX3 = 0;
    let hasValidSchedule = false;

    for (let x1 = 0; x1 <= 30; x1++) {
        const x1_ratio = x1 / 30;
        const x1_away = x1 * c0_fromRate;
        const x1_fRate = x1_ratio * c0_fromRate;
        const x1_tRate = x1_ratio * c0_toRate;

        for (let x2 = 0; x2 <= 30 - x1; x2++) {
            const x2_ratio = x2 / 30;
            const x2_away = x2 * c1_fromRate;
            const x2_fRate = x2_ratio * c1_fromRate;
            const x2_tRate = x2_ratio * c1_toRate;

            for (let x3 = 0; x3 <= 30 - x1 - x2; x3++) {
                const x3_ratio = x3 / 30;
                const x3_away = x3 * c2_fromRate;
                const x3_fRate = x3_ratio * c2_fromRate;
                const x3_tRate = x3_ratio * c2_toRate;
                let awayShiny = 0;
                let awayGlowy = 0;
                let awayStarry = 0;

                if (c0_from === 'shiny') awayShiny += x1_away;
                else if (c0_from === 'glowy') awayGlowy += x1_away;
                else awayStarry += x1_away;

                if (c1_from === 'shiny') awayShiny += x2_away;
                else if (c1_from === 'glowy') awayGlowy += x2_away;
                else awayStarry += x2_away;

                if (c2_from === 'shiny') awayShiny += x3_away;
                else if (c2_from === 'glowy') awayGlowy += x3_away;
                else awayStarry += x3_away;

                if (awayShiny > maxAllowedShiny || awayGlowy > maxAllowedGlowy || awayStarry > maxAllowedStarry) {
                    continue;
                }

                let dShiny = baseShiny;
                let dGlowy = baseGlowy;
                let dStarry = baseStarry;

                if (c0_from === 'shiny') dShiny -= x1_fRate;
                else if (c0_from === 'glowy') dGlowy -= x1_fRate;
                else dStarry -= x1_fRate;

                if (c0_to === 'shiny') dShiny += x1_tRate;
                else if (c0_to === 'glowy') dGlowy += x1_tRate;
                else dStarry += x1_tRate;

                if (c1_from === 'shiny') dShiny -= x2_fRate;
                else if (c1_from === 'glowy') dGlowy -= x2_fRate;
                else dStarry -= x2_fRate;

                if (c1_to === 'shiny') dShiny += x2_tRate;
                else if (c1_to === 'glowy') dGlowy += x2_tRate;
                else dStarry += x2_tRate;

                if (c2_from === 'shiny') dShiny -= x3_fRate;
                else if (c2_from === 'glowy') dGlowy -= x3_fRate;
                else dStarry -= x3_fRate;

                if (c2_to === 'shiny') dShiny += x3_tRate;
                else if (c2_to === 'glowy') dGlowy += x3_tRate;
                else dStarry += x3_tRate;

                if ((missShiny > 0 && dShiny <= 0) ||
                    (missGlowy > 0 && dGlowy <= 0) ||
                    (missStarry > 0 && dStarry <= 0)) {
                    continue;
                }

                const tShiny = missShiny > 0 ? (missShiny / dShiny) : 0;
                const tGlowy = missGlowy > 0 ? (missGlowy / dGlowy) : 0;
                const tStarry = missStarry > 0 ? (missStarry / dStarry) : 0;

                const T_max = Math.max(tShiny, tGlowy, tStarry);
                const totalConvDays = x1 + x2 + x3;

                const isBetter = (T_max < minTmax - 1e-4) ||
                                 (Math.abs(T_max - minTmax) <= 1e-4 && totalConvDays < minConversionDays);

                if (isBetter) {
                    minTmax = T_max;
                    minConversionDays = totalConvDays;
                    bestX1 = x1;
                    bestX2 = x2;
                    bestX3 = x3;
                    hasValidSchedule = true;
                }
            }
        }
    }

    let conversions = [];
    if (hasValidSchedule) {
        if (bestX1 > 0) conversions.push({ from: c0_from, to: c0_to, days: bestX1 });
        if (bestX2 > 0) conversions.push({ from: c1_from, to: c1_to, days: bestX2 });
        if (bestX3 > 0) conversions.push({ from: c2_from, to: c2_to, days: bestX3 });
    }

    return {
        completionDays: minTmax,
        conversions,
        naturalDays
    };
}

/**
 * Helper to get active prospector conversions configuration for a month based on state.
 * Supports both manual (user-selected) and assisted modes.
 *
 * @param {import('../../core/types.js').AppState | any} state - Application state.
 * @returns {Array<{ from: string, to: string, days: number, amount?: number }>} Array of conversion schedules.
 */
export function getProspectorConversions(state) {
    const prospectorState = state.income?.prospector;
    if (!prospectorState || !prospectorState.goldPass) {
        return [];
    }

    if (!prospectorState.assistedConversion) {
        const fromOre = prospectorState.fromOre || 'shiny';
        const toOre = prospectorState.toOre || 'glowy';
        const fromAmount = prospectorState.fromAmount || 0;
        if (fromOre === toOre || fromAmount <= 0) {
            return [];
        }
        return [{
            from: fromOre,
            to: toOre,
            days: 30,
            amount: fromAmount
        }];
    }

    // Assisted conversion mode
    const baseMonthly = { shiny: 0, glowy: 0, starry: 0 };
    if (state.derived && state.derived.incomeSources) {
        for (const key in state.derived.incomeSources) {
            if (key === 'prospector') continue;
            const monthly = state.derived.incomeSources[key]?.monthly;
            if (monthly) {
                baseMonthly.shiny += monthly.shiny || 0;
                baseMonthly.glowy += monthly.glowy || 0;
                baseMonthly.starry += monthly.starry || 0;
            }
        }
    }
    const baseIncome = {
        shiny: baseMonthly.shiny / 30.44,
        glowy: baseMonthly.glowy / 30.44,
        starry: baseMonthly.starry / 30.44,
    };

    const missing = {
        shiny: state.derived?.requiredOres?.shiny || 0,
        glowy: state.derived?.requiredOres?.glowy || 0,
        starry: state.derived?.requiredOres?.starry || 0,
    };

    const opt = findOptimalConversionSchedule(missing, { shiny: 0, glowy: 0, starry: 0 }, baseIncome);
    return opt.conversions || [];
}

/**
 * Distribute the recommended conversions evenly across a 30-day pattern.
 *
 * @param {Array<{ from: string, to: string, days: number, amount?: number }>} conversions - Active conversions.
 * @returns {Array<any>} 30-day patterned schedule items.
 */
function getSprinkledPattern(conversions) {
    const activeConvs = conversions.filter(c => c.days > 0);
    const items = [];
    activeConvs.forEach((conv) => {
        for (let i = 0; i < conv.days; i++) {
            items.push({
                type: 'conv',
                from: conv.from,
                to: conv.to,
                amount: conv.amount,
                daysCount: conv.days,
                pos: (i + 1) / conv.days,
                tieBreaker: conv.from + '-' + conv.to
            });
        }
    });

    const totalPlaced = items.length;
    const noneCount = 30 - totalPlaced;
    if (noneCount > 0) {
        for (let i = 0; i < noneCount; i++) {
            items.push({
                type: 'none',
                daysCount: noneCount,
                pos: (i + 1) / noneCount,
                tieBreaker: 'none'
            });
        }
    }

    items.sort((a, b) => {
        if (Math.abs(a.pos - b.pos) > 1e-5) {
            return a.pos - b.pos;
        }
        if (a.daysCount !== b.daysCount) {
            return b.daysCount - a.daysCount;
        }
        return a.tieBreaker.localeCompare(b.tieBreaker);
    });

    return items;
}

let lastCacheKey = '';
let cachedPattern = null;

/**
 * Get daily prospector income for a specific date, following the sprinkled pattern.
 *
 * @param {Date} date - Evaluation date.
 * @param {import('../../core/types.js').AppState | any} state - Application state.
 * @returns {import('../../core/types.js').OreQuantity} Daily ore delta for date.
 */
export function getProspectorIncomeForDate(date, state) {
    const pState = state.income?.prospector || {};
    const req = state.derived?.requiredOres || {};

    // Calculate base monthly income sum to detect income setting changes
    let baseMonthlySum = 0;
    if (state.derived?.incomeSources) {
        for (const key in state.derived.incomeSources) {
            if (key === 'prospector') continue;
            const monthly = state.derived.incomeSources[key]?.monthly;
            if (monthly) {
                baseMonthlySum += (monthly.shiny || 0) + (monthly.glowy || 0) + (monthly.starry || 0);
            }
        }
    }

    const cacheKey = `${pState.goldPass}-${pState.assistedConversion}-${pState.fromOre}-${pState.toOre}-${pState.fromAmount}-${req.shiny}-${req.glowy}-${req.starry}-${baseMonthlySum}`;

    if (cacheKey !== lastCacheKey || !cachedPattern) {
        const conversions = getProspectorConversions(state);
        cachedPattern = conversions.length > 0 ? getSprinkledPattern(conversions) : [];
        lastCacheKey = cacheKey;
    }

    if (cachedPattern.length === 0) {
        return { shiny: 0, glowy: 0, starry: 0 };
    }

    const dayIndex = (date.getUTCDate() - 1) % 30;
    const item = cachedPattern[dayIndex];

    if (!item || item.type === 'none') {
        return { shiny: 0, glowy: 0, starry: 0 };
    }

    const fromRate = item.amount || oreMaxValues[item.from];
    const toRate = convertOres(item.from, item.to, fromRate);

    const income = { shiny: 0, glowy: 0, starry: 0 };
    income[item.from] = -fromRate;
    income[item.to] = toRate;

    return income;
}

/**
 * Calculates daily, weekly, monthly, and bimonthly ore rates and subscription costs for the Ore Prospector.
 *
 * @param {import('../../core/types.js').ProspectorState} [prospectorState={}] - Prospector configuration state.
 * @param {{ missing: import('../../core/types.js').OreQuantity, baseIncome: import('../../core/types.js').OreQuantity } | null} [assistedContext=null] - Pre-computed missing ores and base income when assistedConversion is true.
 * @returns {import('../../core/types.js').IncomeResult} Composite prospector income rates and subscription costs.
 */
export function calculateProspectorIncome(prospectorState = {}, assistedContext = null) {
    const zeroIncome = { shiny: 0, glowy: 0, starry: 0 };

    if (!prospectorState) {
        return { daily: zeroIncome, weekly: zeroIncome, monthly: zeroIncome, bimonthly: zeroIncome };
    }

    const { goldPass = false, fromOre = 'shiny', toOre = 'glowy', fromAmount = 0, assistedConversion = true } = prospectorState;

    if (!goldPass) {
        return { daily: zeroIncome, weekly: zeroIncome, monthly: zeroIncome, bimonthly: zeroIncome };
    }

    const daily = { shiny: 0, glowy: 0, starry: 0 };
    const monthly = { shiny: 0, glowy: 0, starry: 0 };
    const weekly = { shiny: 0, glowy: 0, starry: 0 };
    const bimonthly = { shiny: 0, glowy: 0, starry: 0 };

    if (assistedConversion && assistedContext) {
        // Drive income from the optimal global-recommendation schedule (monthly is true source)
        const opt = findOptimalConversionSchedule(assistedContext.missing, { shiny: 0, glowy: 0, starry: 0 }, assistedContext.baseIncome);
        if (opt && opt.conversions) {
            for (const conv of opt.conversions) {
                const fromRate = oreMaxValues[conv.from];
                const toRate = convertOres(conv.from, conv.to, fromRate);
                monthly[conv.from] -= conv.days * fromRate;
                monthly[conv.to] += conv.days * toRate;
            }
        }

        // Derive other timeframes without premature rounding
        for (const ore of ['shiny', 'glowy', 'starry']) {
            daily[ore] = monthly[ore] / 30;
            weekly[ore] = monthly[ore] * (7 / 30);
            bimonthly[ore] = monthly[ore] * 2;
        }
    } else {
        // Manual mode: daily is the true source
        const toAmount = convertOres(fromOre, toOre, fromAmount);
        daily[fromOre] -= fromAmount;
        daily[toOre]   += toAmount;

        for (const ore of ['shiny', 'glowy', 'starry']) {
            monthly[ore] = daily[ore] * 30;
            weekly[ore] = daily[ore] * 7;
            bimonthly[ore] = monthly[ore] * 2;
        }
    }

    // Gold Pass subscription cost
    if (prospectorData.priceTier) {
        for (const currencyCode in currencyData) {
            monthly[currencyCode] = getPriceForTier(prospectorData.priceTier, currencyCode);
        }
    }

    return { daily, weekly, monthly, bimonthly };
}

/**
 * Computes cumulative required ores to complete specific upgrade items in the priority queue.
 *
 * @param {Array<any>} items - Priority queue items.
 * @param {boolean} [isSingle=false] - Whether to only calculate for the first item.
 * @param {import('../../core/types.js').AppState | any} [appState] - Application state.
 * @returns {import('../../core/types.js').OreQuantity} Required ores.
 */
export function getUpgradeRequirements(items, isSingle = false, appState) {
    const req = { shiny: 0, glowy: 0, starry: 0 };
    if (!items || items.length === 0) return req;

    const listToProcess = isSingle ? [items[0]] : items;
    const startLevels = {};

    for (const item of listToProcess) {
        const key = `${item.heroName}-${item.name}`;
        const actualLevel = appState?.heroes?.[item.heroName]?.equipment?.[item.name]?.level || 1;
        const fromLevel = startLevels[key] !== undefined ? startLevels[key] : actualLevel;

        if (fromLevel >= item.targetLevel) {
            continue;
        }

        const heroKeyFound = item.heroKey || Object.keys(heroData).find(k => k.toLowerCase() === (item.heroName || '').replace(/\s+/g, '').toLowerCase());
        const heroDataEntry = heroData[heroKeyFound];
        const eqKeyFound = item.key || item.equipmentKey;
        const equipmentType = heroDataEntry?.equipment.find(eq => eq.key === eqKeyFound || (eq.key && eq.key.toLowerCase() === (item.name || '').replace(/\s+/g, '').toLowerCase()))?.type;

        for (let level = fromLevel + 1; level <= item.targetLevel; level++) {
            const cost = upgradeCosts[level];
            if (cost) {
                req.shiny += cost.shiny || 0;
                req.glowy += cost.glowy || 0;
                if (equipmentType === 'epic') {
                    req.starry += cost.starry || 0;
                }
            }
        }

        startLevels[key] = item.targetLevel;
    }

    return req;
}

/**
 * Calculates baseline daily non-prospector ore income.
 *
 * @param {import('../../core/types.js').AppState | any} appState - Application state.
 * @returns {import('../../core/types.js').OreQuantity} Baseline daily ores.
 */
export function getBaseIncome(appState) {
    const incomeSources = appState?.derived?.incomeSources || {};
    const baseMonthlyIncome = { shiny: 0, glowy: 0, starry: 0 };
    for (const source in incomeSources) {
        if (source === 'prospector') continue;
        const monthly = selectDerivedSourceIncome(appState, source, 'monthly');
        baseMonthlyIncome.shiny += monthly.shiny || 0;
        baseMonthlyIncome.glowy += monthly.glowy || 0;
        baseMonthlyIncome.starry += monthly.starry || 0;
    }
    return {
        shiny: baseMonthlyIncome.shiny / 30.44,
        glowy: baseMonthlyIncome.glowy / 30.44,
        starry: baseMonthlyIncome.starry / 30.44
    };
}
