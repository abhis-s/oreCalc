/**
 * Planner Calendar Storage Capacity Forecasting & Overflow Prediction Engine.
 * Tier 2: Pure Domain Calculations (Zero DOM dependencies, zero side effects).
 */

import { STORAGE_LIMITS } from '../../core/constants.js';
import { getISOWeekNumber } from '../../utils/dateUtils.js';
import { calculateDailyCalendarIncome } from '../income/calendarDayIncome.js';

/**
 * Simulates day-by-day storage accrual and computes Storage Full milestones, overflow events, and daily balances.
 *
 * @param {import('../../core/types.js').AppState | any} appState - Global application state.
 * @param {Date} startDate - Simulation starting date in UTC (e.g. today).
 * @param {Date} endDate - Simulation ending date in UTC.
 * @param {{ milestones?: Record<string, any[]> } | null} [equipmentSchedule=null] - Planned upgrade milestones.
 * @returns {{
 *   firstFullDates: {
 *     shiny: { dateStr: string, monthKey: string, weekKey: string, daysFromToday: number, alreadyFull: boolean, overflowAmount: number } | null,
 *     glowy: { dateStr: string, monthKey: string, weekKey: string, daysFromToday: number, alreadyFull: boolean, overflowAmount: number } | null,
 *     starry: { dateStr: string, monthKey: string, weekKey: string, daysFromToday: number, alreadyFull: boolean, overflowAmount: number } | null
 *   },
 *   milestonesByDate: Record<string, Array<{ ore: 'shiny' | 'glowy' | 'starry', cap: number, balance: number, daysFromToday: number }>>,
 *   overflowByDate: Record<string, Record<string, { dailyExcess: number, totalBalance: number, overflowAmount: number }>>,
 *   dailyBalancesByDate: Record<string, import('../../core/types.js').OreQuantity>
 * }}
 */
export function calculateStorageForecast(appState, startDate, endDate, equipmentSchedule = null) {
    const ores = ['shiny', 'glowy', 'starry'];
    const stored = appState?.storedOres || {};

    const balance = {
        shiny: Math.max(0, Number(stored.shiny) || 0),
        glowy: Math.max(0, Number(stored.glowy) || 0),
        starry: Math.max(0, Number(stored.starry) || 0)
    };

    const firstFullDates = { shiny: null, glowy: null, starry: null };
    const milestonesByDate = {};
    const overflowByDate = {};
    const dailyBalancesByDate = {};

    const startUTC = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
    const endUTC = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

    const startYear = startUTC.getUTCFullYear();
    const startMonth = String(startUTC.getUTCMonth() + 1).padStart(2, '0');
    const startDay = String(startUTC.getUTCDate()).padStart(2, '0');
    const startStr = `${startYear}-${startMonth}-${startDay}`;
    const [startWeekYear, startWeekNo] = getISOWeekNumber(startUTC);
    const startWeekKey = `${startWeekYear}-${String(startWeekNo).padStart(2, '0')}`;

    // Check Day 0 (Today / starting balance)
    for (const ore of ores) {
        if (balance[ore] >= STORAGE_LIMITS[ore]) {
            firstFullDates[ore] = {
                dateStr: startStr,
                monthKey: `${startYear}-${startMonth}`,
                weekKey: startWeekKey,
                daysFromToday: 0,
                alreadyFull: true,
                overflowAmount: Math.max(0, balance[ore] - STORAGE_LIMITS[ore])
            };
        }
    }

    let currentDate = new Date(startUTC);
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);

    while (currentDate.getTime() <= endUTC.getTime()) {
        const year = currentDate.getUTCFullYear();
        const month = String(currentDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getUTCDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        const monthKey = `${year}-${month}`;
        const [weekYear, weekNo] = getISOWeekNumber(currentDate);
        const weekKey = `${weekYear}-${String(weekNo).padStart(2, '0')}`;
        const daysFromToday = Math.round((currentDate.getTime() - startUTC.getTime()) / (1000 * 60 * 60 * 24));

        // 1. Deduct scheduled equipment upgrades occurring on this date
        const scheduledUpgrades = equipmentSchedule?.milestones?.[dateStr];
        if (Array.isArray(scheduledUpgrades)) {
            for (const upgrade of scheduledUpgrades) {
                if (upgrade?.requiredOres) {
                    balance.shiny = Math.max(0, balance.shiny - (upgrade.requiredOres.shiny || 0));
                    balance.glowy = Math.max(0, balance.glowy - (upgrade.requiredOres.glowy || 0));
                    balance.starry = Math.max(0, balance.starry - (upgrade.requiredOres.starry || 0));
                }
            }
        }

        // 2. Add net daily income
        const dayIncome = calculateDailyCalendarIncome(currentDate, appState);

        for (const ore of ores) {
            const currentBal = balance[ore];
            const earned = dayIncome[ore] || 0;
            const newBal = currentBal + earned;
            const cap = STORAGE_LIMITS[ore];

            // Transition check: crossed from < cap to >= cap
            if (currentBal < cap && newBal >= cap) {
                if (!firstFullDates[ore]) {
                    firstFullDates[ore] = {
                        dateStr,
                        monthKey,
                        weekKey,
                        daysFromToday,
                        alreadyFull: false,
                        overflowAmount: Math.max(0, newBal - cap)
                    };
                }

                if (!milestonesByDate[dateStr]) milestonesByDate[dateStr] = [];
                milestonesByDate[dateStr].push({
                    ore,
                    cap,
                    balance: newBal,
                    daysFromToday
                });
            }

            // Overflow check: storage was already at cap and earned positive income
            if (currentBal >= cap && earned > 0) {
                if (!overflowByDate[dateStr]) overflowByDate[dateStr] = {};
                overflowByDate[dateStr][ore] = {
                    dailyExcess: earned,
                    totalBalance: newBal,
                    overflowAmount: newBal - cap
                };
            }

            balance[ore] = newBal;
        }

        dailyBalancesByDate[dateStr] = {
            shiny: balance.shiny,
            glowy: balance.glowy,
            starry: balance.starry
        };

        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    return {
        firstFullDates,
        milestonesByDate,
        overflowByDate,
        dailyBalancesByDate
    };
}
