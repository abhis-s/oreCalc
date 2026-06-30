import { conversionRates, oreMaxValues } from '../data/oreConversionData.js';
import { currencyData, prospectorData } from '../data/appData.js';
import { getPriceForTier } from '../utils/incomeUtils.js';

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

export function convertOres(fromOre, toOre, fromAmount) {
    if (fromOre === toOre) {
        return fromAmount;
    }

    const fromValue = getOreValue(fromOre);
    const toValue = getOreValue(toOre);

    const conversionFactor = fromValue / toValue;

    return Math.round(fromAmount * conversionFactor);
}

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
 * @param {{ shiny: number, glowy: number, starry: number }} req        - required/missing ores
 * @param {{ shiny: number, glowy: number, starry: number }} stored     - currently stored ores
 * @param {{ shiny: number, glowy: number, starry: number }} baseIncome  - daily base income (without prospector)
 * @returns {{ completionDays: number, conversions: Array, naturalDays: Object }} optimal schedule
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

    let bestSchedule = null;
    let minTmax = Infinity;
    let minConversionDays = Infinity;

    for (let x1 = 0; x1 <= 30; x1++) {
        for (let x2 = 0; x2 <= 30 - x1; x2++) {
            for (let x3 = 0; x3 <= 30 - x1 - x2; x3++) {
                const schedule = [
                    { from: candidates[0].from, to: candidates[0].to, days: x1 },
                    { from: candidates[1].from, to: candidates[1].to, days: x2 },
                    { from: candidates[2].from, to: candidates[2].to, days: x3 }
                ].filter(c => c.days > 0);

                const D_prime = { ...baseIncome };
                for (const conv of schedule) {
                    const fromRate = oreMaxValues[conv.from];
                    const toRate = convertOres(conv.from, conv.to, fromRate);

                    D_prime[conv.from] -= (conv.days / 30) * fromRate;
                    D_prime[conv.to] += (conv.days / 30) * toRate;
                }

                const T = {};
                let possible = true;
                for (const ore of ['shiny', 'glowy', 'starry']) {
                    if (missing[ore] === 0) {
                        T[ore] = 0;
                    } else if (D_prime[ore] <= 0) {
                        possible = false;
                        break;
                    } else {
                        T[ore] = missing[ore] / D_prime[ore];
                    }
                }

                if (!possible) continue;

                const T_max = Math.max(T.shiny, T.glowy, T.starry);

                let valid = true;
                const convertedAway = { shiny: 0, glowy: 0, starry: 0 };
                for (const conv of schedule) {
                    convertedAway[conv.from] += conv.days * oreMaxValues[conv.from];
                }
                for (const ore of ['shiny', 'glowy', 'starry']) {
                    if (convertedAway[ore] > 30 * baseIncome[ore] + 1e-3) {
                        valid = false;
                        break;
                    }
                }

                if (!valid) continue;

                const totalConvDays = x1 + x2 + x3;

                const isBetter = (T_max < minTmax - 1e-4) ||
                                 (Math.abs(T_max - minTmax) <= 1e-4 && totalConvDays < minConversionDays);

                if (isBetter) {
                    minTmax = T_max;
                    minConversionDays = totalConvDays;
                    bestSchedule = schedule;
                }
            }
        }
    }

    return {
        completionDays: minTmax,
        conversions: bestSchedule || [],
        naturalDays: naturalDays
    };
}

/**
 * Compute the optimal assisted conversion schedule (up to 30 days, same algorithm
 * as the display recommendation) and return the net daily delta it produces.
 * @param {{ shiny: number, glowy: number, starry: number }} missing    - still-needed ores
 * @param {{ shiny: number, glowy: number, starry: number }} baseIncome - daily income without prospector
 * @returns {{ shiny: number, glowy: number, starry: number }} net daily change per ore (signed)
 */
export function computeAssistedDailyDelta(missing, baseIncome) {
    const opt = findOptimalConversionSchedule({ shiny: missing.shiny, glowy: missing.glowy, starry: missing.starry }, { shiny: 0, glowy: 0, starry: 0 }, baseIncome);
    if (!opt || !opt.conversions || opt.conversions.length === 0) {
        return { shiny: 0, glowy: 0, starry: 0 };
    }

    const delta = { shiny: 0, glowy: 0, starry: 0 };
    for (const conv of opt.conversions) {
        const fromRate = oreMaxValues[conv.from];
        const toRate = convertOres(conv.from, conv.to, fromRate);
        delta[conv.from] -= (conv.days / 30) * fromRate;
        delta[conv.to] += (conv.days / 30) * toRate;
    }
    return delta;
}

/**
 * Helper to get active prospector conversions configuration for a month based on state.
 * Supports both manual (user-selected) and assisted modes.
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
 */
export function getSprinkledPattern(conversions) {
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

/**
 * Get daily prospector income for a specific date, following the sprinkled pattern.
 */
export function getProspectorIncomeForDate(date, state) {
    const conversions = getProspectorConversions(state);
    if (conversions.length === 0) {
        return { shiny: 0, glowy: 0, starry: 0 };
    }

    const pattern = getSprinkledPattern(conversions);
    const dayIndex = (date.getUTCDate() - 1) % 30;
    const item = pattern[dayIndex];

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
 * @param {object} prospectorState
 * @param {{ missing: object, baseIncome: object } | null} assistedContext
 *   When assistedConversion is true, caller passes pre-computed missing ores
 *   and base daily income (without prospector) so the optimal schedule can be computed.
 */
export function calculateProspectorIncome(prospectorState, assistedContext = null) {
    const zeroIncome = { shiny: 0, glowy: 0, starry: 0 };

    if (!prospectorState) {
        return { daily: zeroIncome, weekly: zeroIncome, monthly: zeroIncome, bimonthly: zeroIncome };
    }

    const { goldPass = false, fromOre = 'shiny', toOre = 'glowy', fromAmount = 0, assistedConversion = false } = prospectorState;

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
