import { handleStateUpdate } from '../app.js';
import { state } from '../core/state.js';

import { incomeData, getSourceById } from '../data/incomeSourceRegistry.js';
import { supercellEventsData } from '../data/appData.js';

import { getSupercellEventsForYear } from './dateUtils.js';
import { getProspectorIncomeForDate, getProspectorConversions, convertOres } from '../incomeCalculations/prospectorManager.js';
import { oreMaxValues } from '../data/oreConversionData.js';

export function calculateCumulativeOres(targetDate, initialOres) {
    let cumulativeOres = {
        shiny: parseFloat(initialOres?.shiny) || 0,
        glowy: parseFloat(initialOres?.glowy) || 0,
        starry: parseFloat(initialOres?.starry) || 0
    };
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    let currentDate = new Date(todayUTC); 
    currentDate.setUTCDate(currentDate.getUTCDate() + 1); // Start calculations from the next day

    while (currentDate.getTime() <= targetDate.getTime()) {
        const monthYearKey = `${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}-${currentDate.getUTCFullYear()}`;
        const dayKey = String(currentDate.getUTCDate()).padStart(2, '0');

        const chipsForThisDay = state.planner.calendar.dates[monthYearKey]?.[dayKey] || [];
        const hasMultiplierChip = chipsForThisDay.some(id => {
            const cleanId = id.replace(/^custom-/, '');
            return cleanId.startsWith('starBonus') && !cleanId.startsWith('starBonus-') && cleanId.includes('x');
        });
        const hasCustomStarBonus = chipsForThisDay.some(id => id.startsWith('custom-starBonus'));

        if (!hasMultiplierChip && !hasCustomStarBonus) {
            const starBonusSource = incomeData.starBonus;
            const starBonusIncome = starBonusSource.getBaseIncome(state);
            cumulativeOres.shiny += Math.round(starBonusIncome.shiny || 0);
            cumulativeOres.glowy += Math.round(starBonusIncome.glowy || 0);
            cumulativeOres.starry += Math.round(starBonusIncome.starry || 0);
        }

        const hasCustomProspector = chipsForThisDay.some(id => id.startsWith('custom-prospector'));
        if (state.income.prospector && state.income.prospector.goldPass && !hasCustomProspector) {
            const prospectorIncome = getProspectorIncomeForDate(currentDate, state);
            cumulativeOres.shiny += Math.round(prospectorIncome.shiny || 0);
            cumulativeOres.glowy += Math.round(prospectorIncome.glowy || 0);
            cumulativeOres.starry += Math.round(prospectorIncome.starry || 0);
        }

        if (state.income.supercellEvents && state.income.supercellEvents.worldChampionship) {
            const supercellEvents = getSupercellEventsForYear(currentDate.getUTCFullYear(), supercellEventsData);
            supercellEvents.forEach((event) => {
                const startDate = new Date(event.start);
                const endDate = new Date(event.end);
                
            const startUTC = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
                const endUTC = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

                const diffDays = Math.round((endUTC - startUTC) / (1000 * 60 * 60 * 24));
                const middleDayOffset = Math.floor(diffDays / 2);
                const middleDateUTC = new Date(startUTC);
                middleDateUTC.setUTCDate(startUTC.getUTCDate() + middleDayOffset);

                if (currentDate.getTime() === middleDateUTC.getTime()) {
                    let rewardType = 'otherEvents';
                    if (event.name === 'Monthly Finals') rewardType = 'monthlyQualifiers';
                    else if (event.name === 'Last Chance Qualifier') rewardType = 'lastChanceQualifiers';
                    else if (event.name === 'World Finals') rewardType = 'worldChampionships';

                    let rewardsYear = currentDate.getUTCFullYear();
                    if (!supercellEventsData.rewards[rewardsYear]) rewardsYear = currentDate.getUTCFullYear() - 1;
                    if (!supercellEventsData.rewards[rewardsYear]) {
                        const availableYears = Object.keys(supercellEventsData.rewards).map(Number).sort((a, b) => b - a);
                        rewardsYear = availableYears[0] || 2025;
                    }
                    const rewards = (supercellEventsData.rewards[rewardsYear] && supercellEventsData.rewards[rewardsYear][rewardType]) || { shiny: 0, glowy: 0, starry: 0 };
                    
                    cumulativeOres.shiny += Math.round(rewards.shiny || 0);
                    cumulativeOres.glowy += Math.round(rewards.glowy || 0);
                    cumulativeOres.starry += Math.round(rewards.starry || 0);
                }
            });
        }

        chipsForThisDay.forEach(chipId => {
            const parts = chipId.split('-');
            const type = parts[0];
            
            // Check for custom chip data override
            if (chipId.startsWith('custom-') && state.planner.calendar.customChipData?.[chipId]) {
                const customData = state.planner.calendar.customChipData[chipId];
                cumulativeOres.shiny += Math.round(customData.shiny || 0);
                cumulativeOres.glowy += Math.round(customData.glowy || 0);
                cumulativeOres.starry += Math.round(customData.starry || 0);
                return;
            }

            if (type === 'starBonus' || type === 'prospector' || type === 'supercellEvents') {
                return;
            }
            const incomeSource = getSourceById(type);

            if (incomeSource) {
                const income = incomeSource.getIncome(state);
                cumulativeOres.shiny += Math.round(income.shiny || 0);
                cumulativeOres.glowy += Math.round(income.glowy || 0);
                cumulativeOres.starry += Math.round(income.starry || 0);
            }
        });

        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    return cumulativeOres;
}

export function checkAndGenerateRecurringChips() {
    const now = new Date();
    const currentMonth = now.getUTCMonth();
    const currentYear = now.getUTCFullYear();
    const currentMonthYear = `${String(currentMonth + 1).padStart(2, '0')}-${currentYear}`;

    if (state.planner.calendar.lastRecurringProcessed === currentMonthYear) return;

    handleStateUpdate(() => {
        const settings = state.planner.calendar.customChipSettings;
        const customChips = state.planner.calendar.customChips || [];

        const generate = (type, data, count = 1) => {
            for (let i = 0; i < count; i++) {
                const shortId = Math.random().toString(36).substring(2, 7);
                const newId = `custom-${type}-${shortId}-${i}`;
                customChips.push({ ...data, id: newId, isCustom: true, isRecurring: true, instance: i + 1 });
            }
        };

        // Star Bonus
        if (settings.starBonus.monthly && settings.starBonus.count > 0) {
            const sbType = 'starBonus' + settings.starBonus.multiplier; // e.g. "starBonus3x"
            const baseIncome = getSourceById('starBonus')?.getBaseIncome(state) || { shiny: 0, glowy: 0, starry: 0 };
            const multValue = parseInt(settings.starBonus.multiplier.replace('x', ''), 10) || 1;
            generate(sbType, {
                type: sbType,
                multiplier: settings.starBonus.multiplier,
                shiny: baseIncome.shiny * multValue,
                glowy: baseIncome.glowy * multValue,
                starry: baseIncome.starry * multValue
            }, settings.starBonus.count);
        }

        // Shop Offers
        if (settings.shopOffers.monthly) {
            generate('shopOffers', { type: 'shopOffers', shiny: settings.shopOffers.shiny, glowy: settings.shopOffers.glowy, starry: settings.shopOffers.starry }, 1);
        }

        // Gem Trader (Weekly -> ~4 per month)
        if (settings.gemTrader.weekly) {
            generate('gemTrader', { type: 'gemTrader', shiny: settings.gemTrader.shiny, glowy: settings.gemTrader.glowy, starry: settings.gemTrader.starry }, 4);
        }

        // Event Trader
        if (settings.eventTrader.monthly) {
            // Check if current month is an event month
            const eventTraderSource = incomeData.eventTrader;
            const availableMonths = eventTraderSource.schedule.availableMonths[currentYear] || [];
            if (availableMonths.includes(currentMonth + 1)) {
                generate('eventTrader', { type: 'eventTrader', shiny: settings.eventTrader.shiny, glowy: settings.eventTrader.glowy, starry: settings.eventTrader.starry }, 1);
            }
        }

        // Raid Medal Trader (Weekly -> ~4 per month)
        if (settings.raidMedalTrader.weekly) {
            generate('raidMedalTrader', { type: 'raidMedalTrader', shiny: settings.raidMedalTrader.shiny, glowy: settings.raidMedalTrader.glowy, starry: settings.raidMedalTrader.starry }, 4);
        }

        // Event Pass (Bimonthly -> check if current month is event month)
        if (settings.eventPass.monthly) {
            const eventPassSource = incomeData.eventPass;
            const availableMonths = eventPassSource.schedule.availableMonths[currentYear] || [];
            if (availableMonths.includes(currentMonth + 1)) {
                generate('eventPass', { type: 'eventPass', shiny: settings.eventPass.shiny, glowy: settings.eventPass.glowy, starry: settings.eventPass.starry }, 1);
            }
        }

        // Clan War
        if (settings.clanWar.monthly && settings.clanWar.count > 0) {
            const factor = settings.clanWar.result === 'win' ? 1.0 : (settings.clanWar.result === 'loss' ? 0.5 : 0.75);
            generate('clanWar', {
                type: 'clanWar',
                result: settings.clanWar.result,
                shiny: Math.round(2 * (settings.clanWar.shiny || 0) * factor),
                glowy: Math.round(2 * (settings.clanWar.glowy || 0) * factor),
                starry: Math.round(2 * (settings.clanWar.starry || 0) * factor)
            }, settings.clanWar.count);
        }

        // CWL
        if (settings.cwl.monthly && settings.cwl.count > 0) {
            const factor = settings.cwl.result === 'win' ? 1.0 : (settings.cwl.result === 'loss' ? 0.5 : 0.75);
            generate('cwl', {
                type: 'cwl',
                result: settings.cwl.result,
                shiny: Math.round(1 * (settings.cwl.shiny || 0) * factor),
                glowy: Math.round(1 * (settings.cwl.glowy || 0) * factor),
                starry: Math.round(1 * (settings.cwl.starry || 0) * factor)
            }, settings.cwl.count);
        }

        // Prospector
        if (settings.prospector.monthly) {
            if (state.income.prospector?.assistedConversion) {
                const conversions = getProspectorConversions(state);
                let countIndex = 0;
                conversions.forEach(conv => {
                    const days = conv.days || 30;
                    const fromRate = conv.amount || oreMaxValues[conv.from];
                    const toRate = convertOres(conv.from, conv.to, fromRate);
                    
                    const chipData = { type: 'prospector', shiny: 0, glowy: 0, starry: 0 };
                    chipData[conv.from] = -fromRate;
                    chipData[conv.to] = toRate;
                    
                    for (let i = 0; i < days; i++) {
                        const shortId = Math.random().toString(36).substring(2, 7);
                        const newId = `custom-prospector-${shortId}-${countIndex}`;
                        customChips.push({ ...chipData, id: newId, isCustom: true, isRecurring: true, instance: countIndex + 1 });
                        countIndex++;
                    }
                });
            } else if (settings.prospector.count > 0) {
                generate('prospector', {
                    type: 'prospector',
                    shiny: settings.prospector.shiny,
                    glowy: settings.prospector.glowy,
                    starry: settings.prospector.starry
                }, settings.prospector.count);
            }
        }

        state.planner.calendar.customChips = customChips;
        state.planner.calendar.lastRecurringProcessed = currentMonthYear;
    }, true);
}

export function reindexCalendarChips(chipType) {
    let changed = false;

    for (const monthYearKey in state.planner.calendar.dates) {
        const chipsToReindexThisMonth = [];
        const daysInMonth = state.planner.calendar.dates[monthYearKey];

        for (const dayStr in daysInMonth) {
            const chipIds = daysInMonth[dayStr];
            const chipsOnThisDay = chipIds.filter(id => id.startsWith(`${chipType}-`));

            chipsOnThisDay.forEach(chipId => {
                const parts = chipId.split('-');
                const type = parts[0];
                const instance = parseInt(parts[1], 10);
                const month = parseInt(parts[2], 10) - 1;
                const year = parseInt(parts[3], 10);
                const date = new Date(Date.UTC(year, month, parseInt(dayStr, 10)));

                const incomeSource = getSourceById(type);
                if (incomeSource && (incomeSource.schedule?.type === 'weekly' || type === 'raidMedalTrader' || type === 'gemTrader')) {
                    return;
                }

                chipsToReindexThisMonth.push({
                    originalId: chipId,
                    type: type,
                    instance: instance,
                    date: date,
                    monthYearKey: monthYearKey,
                    dayKey: dayStr,
                });
            });
        }

        chipsToReindexThisMonth.sort((a, b) => a.date.getTime() - b.date.getTime());

        chipsToReindexThisMonth.forEach((chip, index) => {
            const newInstance = index + 1;
            const wasAuto = chip.originalId.endsWith('-auto');

            if (chip.instance !== newInstance) {
                changed = true;

                const oldChipIds = state.planner.calendar.dates[chip.monthYearKey][chip.dayKey];
                const oldIndex = oldChipIds.indexOf(chip.originalId);
                if (oldIndex > -1) {
                    oldChipIds.splice(oldIndex, 1);
                }

                const newInstanceStr = String(newInstance).padStart(2, '0');
                const newMonthStr = String(parseInt(chip.monthYearKey.split('-')[0], 10)).padStart(2, '0');
                let newChipId = `${chip.type}-${newInstanceStr}-${newMonthStr}-${chip.monthYearKey.split('-')[1]}-cal`;
                if (wasAuto) {
                    newChipId += '-auto';
                }

                if (!state.planner.calendar.dates[chip.monthYearKey][chip.dayKey]) {
                    state.planner.calendar.dates[chip.monthYearKey][chip.dayKey] = [];
                }
                state.planner.calendar.dates[chip.monthYearKey][chip.dayKey].push(newChipId);
            }
        });
    }

    return changed;
}