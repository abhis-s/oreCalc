/**
 * Calendar Daily Ore Income Aggregator.
 * Tier 2: Pure Domain Math (Zero DOM dependencies, zero side effects).
 */

import { getSourceById } from '../../data/incomeSourceRegistry.js';
import { getStarBonusForTownHall } from '../../data/incomeSources/starBonus.js';
import { supercellEventsData } from '../../data/incomeSources/supercellEvents.js';
import { getProspectorIncomeForDate } from './prospectorManager.js';
import { getEffectiveTownHallForDate } from './starBonusIncome.js';
import { getSupercellEventsForYear } from './supercellEventsSchedule.js';

/**
 * Resolves Supercell championship events with calculated middle timestamps.
 *
 * @param {number} year
 * @param {typeof supercellEventsData} eventsData
 * @returns {Array<{ name: string, middleTime: number }>}
 */
function getSupercellEventsWithMiddleTimes(year, eventsData) {
    const rawEvents = getSupercellEventsForYear(year, eventsData);
    return rawEvents.map(event => {
        const startDate = new Date(event.start);
        const endDate = new Date(event.end);
        const startUTC = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
        const endUTC = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

        const diffDays = Math.round((endUTC.getTime() - startUTC.getTime()) / (1000 * 60 * 60 * 24));
        const middleDayOffset = Math.floor(diffDays / 2);
        const middleDateUTC = new Date(startUTC);
        middleDateUTC.setUTCDate(startUTC.getUTCDate() + middleDayOffset);

        return {
            name: event.name,
            middleTime: middleDateUTC.getTime()
        };
    });
}

/**
 * Calculates total planned ore income accrued on a specific calendar day.
 *
 * @param {Date} date - Target calendar date in UTC.
 * @param {import('../../core/types.js').AppState | any} appState - Global application state.
 * @returns {import('../../core/types.js').OreQuantity} Net day income.
 */
export function calculateDailyCalendarIncome(date, appState) {
    const dailyIncome = { shiny: 0, glowy: 0, starry: 0 };
    if (!date || !appState) return dailyIncome;

    const displayYear = date.getUTCFullYear();
    const displayMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
    const displayDay = String(date.getUTCDate()).padStart(2, '0');
    const monthYearKey = `${displayYear}-${displayMonth}`;

    const chipsForThisDay = appState.planner?.calendar?.dates?.[monthYearKey]?.[displayDay] || [];

    const hasMultiplierChip = chipsForThisDay.some(id => {
        const cleanId = id.replace(/^custom-/, '');
        return cleanId.startsWith('starBonus') && !cleanId.startsWith('starBonus-') && cleanId.includes('x');
    });
    const hasCustomStarBonus = chipsForThisDay.some(id => id.startsWith('custom-starBonus'));

    const effectiveTH = getEffectiveTownHallForDate(date, appState);
    const starBonusIncome = getStarBonusForTownHall(effectiveTH);

    // 1. Star Bonus (daily automatic unless overridden)
    if (!hasMultiplierChip && !hasCustomStarBonus) {
        dailyIncome.shiny += Math.round(starBonusIncome.shiny || 0);
        dailyIncome.glowy += Math.round(starBonusIncome.glowy || 0);
        dailyIncome.starry += Math.round(starBonusIncome.starry || 0);
    }

    // 2. Ore Prospector (assisted conversion or manual conversion)
    const hasCustomProspector = chipsForThisDay.some(id => id.startsWith('custom-prospector'));
    if (appState.income?.prospector?.goldPass && !hasCustomProspector) {
        const prospectorIncome = getProspectorIncomeForDate(date, appState);
        dailyIncome.shiny += Math.round(prospectorIncome.shiny || 0);
        dailyIncome.glowy += Math.round(prospectorIncome.glowy || 0);
        dailyIncome.starry += Math.round(prospectorIncome.starry || 0);
    }

    // 3. Supercell Championship Events
    if (appState.income?.supercellEvents?.worldChampionship) {
        const eventsList = getSupercellEventsWithMiddleTimes(displayYear, supercellEventsData);
        const checkTime = Date.UTC(displayYear, date.getUTCMonth(), date.getUTCDate());

        eventsList.forEach(event => {
            if (checkTime === event.middleTime) {
                let rewardType = 'otherEvents';
                if (event.name === 'Monthly Finals') rewardType = 'monthlyQualifiers';
                else if (event.name === 'Last Chance Qualifier') rewardType = 'lastChanceQualifiers';
                else if (event.name === 'World Finals') rewardType = 'worldChampionships';

                let rewardsYear = displayYear;
                if (!supercellEventsData.rewards[rewardsYear]) rewardsYear = displayYear - 1;
                if (!supercellEventsData.rewards[rewardsYear]) {
                    const availableYears = Object.keys(supercellEventsData.rewards).map(Number).sort((a, b) => b - a);
                    rewardsYear = availableYears[0] || 2025;
                }
                let rewards = (supercellEventsData.rewards[rewardsYear] && supercellEventsData.rewards[rewardsYear][rewardType]) || { shiny: 0, glowy: 0, starry: 0 };

                const scOverride = appState.planner?.calendar?.customChipSettings?.supercellEvents;
                if (scOverride && scOverride.globalOverride) {
                    const derived = appState.derived?.incomeSources?.supercellEvents;
                    if (derived && derived.perEvent) {
                        rewards = { ...derived.perEvent };
                    }
                }

                dailyIncome.shiny += Math.round(rewards.shiny || 0);
                dailyIncome.glowy += Math.round(rewards.glowy || 0);
                dailyIncome.starry += Math.round(rewards.starry || 0);
            }
        });
    }

    // 4. Manual and Custom Chips
    chipsForThisDay.forEach(chipId => {
        const parts = chipId.split('-');
        const type = parts[0];

        if (chipId.startsWith('custom-') && appState.planner?.calendar?.customChipData?.[chipId]) {
            const customData = appState.planner.calendar.customChipData[chipId];
            dailyIncome.shiny += Math.round(customData.shiny || 0);
            dailyIncome.glowy += Math.round(customData.glowy || 0);
            dailyIncome.starry += Math.round(customData.starry || 0);
            return;
        }

        if (type === 'starBonus' || type === 'prospector' || type === 'supercellEvents') {
            return;
        }

        if (type.startsWith('starBonus') && type.includes('x')) {
            const mult = Number(type.replace('starBonus', '').replace('x', '')) || 1;
            dailyIncome.shiny += Math.round(starBonusIncome.shiny * mult);
            dailyIncome.glowy += Math.round(starBonusIncome.glowy * mult);
            dailyIncome.starry += Math.round(starBonusIncome.starry * mult);
            return;
        }

        const incomeSource = getSourceById(type);
        if (incomeSource) {
            const income = incomeSource.getIncome(appState);
            dailyIncome.shiny += Math.round(income.shiny || 0);
            dailyIncome.glowy += Math.round(income.glowy || 0);
            dailyIncome.starry += Math.round(income.starry || 0);
        }
    });

    return dailyIncome;
}
