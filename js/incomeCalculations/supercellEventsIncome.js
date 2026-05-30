import { supercellEventsData } from "../data/appData.js";
import { DAYS_IN_WEEK, DAYS_IN_MONTH, MONTHS_IN_BIMONTH } from "../data/timeConstants.js";
import { state } from "../core/state.js";

export function calculateSupercellEventsIncome(isWorldChampionshipEnabled) {
    const scOverride = state.planner?.calendar?.customChipSettings?.supercellEvents;
    if (scOverride && scOverride.globalOverride) {
        const monthly = {
            shiny: scOverride.shiny,
            glowy: scOverride.glowy,
            starry: scOverride.starry,
        };
        const daily = {
            shiny: monthly.shiny / DAYS_IN_MONTH,
            glowy: monthly.glowy / DAYS_IN_MONTH,
            starry: monthly.starry / DAYS_IN_MONTH,
        };
        const weekly = {
            shiny: daily.shiny * DAYS_IN_WEEK,
            glowy: daily.glowy * DAYS_IN_WEEK,
            starry: daily.starry * DAYS_IN_WEEK,
        };
        const bimonthly = {
            shiny: monthly.shiny * MONTHS_IN_BIMONTH,
            glowy: monthly.glowy * MONTHS_IN_BIMONTH,
            starry: monthly.starry * MONTHS_IN_BIMONTH,
        };
        const perEvent = {
            shiny: monthly.shiny,
            glowy: monthly.glowy,
            starry: monthly.starry,
        };
        return { perEvent, daily, weekly, monthly, bimonthly };
    }

    if (!isWorldChampionshipEnabled) {
        return {
            perEvent: { shiny: 0, glowy: 0, starry: 0 },
            daily: { shiny: 0, glowy: 0, starry: 0 },
            weekly: { shiny: 0, glowy: 0, starry: 0 },
            monthly: { shiny: 0, glowy: 0, starry: 0 },
            bimonthly: { shiny: 0, glowy: 0, starry: 0 },
        };
    }

    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const events = (supercellEventsData.events && supercellEventsData.events[currentYear]) || [];

    const counts = {
        monthlyQualifiers: events.filter(e => e.name === 'Monthly Finals').length,
        lastChanceQualifiers: events.filter(e => e.name === 'Last Chance Qualifier').length,
        worldChampionships: events.filter(e => e.name === 'World Finals').length,
        otherEvents: events.filter(e => !['Monthly Finals', 'Last Chance Qualifier', 'World Finals'].includes(e.name)).length
    };

    // Find best available rewards year (current year or fallback to previous year)
    let rewardsYear = currentYear;
    if (!supercellEventsData.rewards[rewardsYear]) {
        rewardsYear = currentYear - 1;
    }
    
    // If still not found, find the latest year available in the rewards object
    if (!supercellEventsData.rewards[rewardsYear]) {
        const availableYears = Object.keys(supercellEventsData.rewards).map(Number).sort((a, b) => b - a);
        rewardsYear = availableYears[0] || 2025; // Default to 2025 or highest available
    }

    const rewards = supercellEventsData.rewards[rewardsYear] || {
        monthlyQualifiers: { shiny: 0, glowy: 0, starry: 0 },
        lastChanceQualifiers: { shiny: 0, glowy: 0, starry: 0 },
        worldChampionships: { shiny: 0, glowy: 0, starry: 0 },
        otherEvents: { shiny: 0, glowy: 0, starry: 0 },
    };

    const monthlyQualifiers = rewards.monthlyQualifiers;
    const lastChanceQualifiers = rewards.lastChanceQualifiers;
    const worldChampionships = rewards.worldChampionships;
    const otherEvents = rewards.otherEvents;

    const totalPerYear = {
        shiny: (monthlyQualifiers.shiny * counts.monthlyQualifiers) + 
               (lastChanceQualifiers.shiny * counts.lastChanceQualifiers) + 
               (worldChampionships.shiny * counts.worldChampionships) +
               (otherEvents.shiny * counts.otherEvents),
        glowy: (monthlyQualifiers.glowy * counts.monthlyQualifiers) + 
               (lastChanceQualifiers.glowy * counts.lastChanceQualifiers) + 
               (worldChampionships.glowy * counts.worldChampionships) +
               (otherEvents.glowy * counts.otherEvents),
        starry: (monthlyQualifiers.starry * counts.monthlyQualifiers) + 
                (lastChanceQualifiers.starry * counts.lastChanceQualifiers) + 
                (worldChampionships.starry * counts.worldChampionships) +
                (otherEvents.starry * counts.otherEvents),
    };

    const monthly = {
        shiny: totalPerYear.shiny / 12,
        glowy: totalPerYear.glowy / 12,
        starry: totalPerYear.starry / 12,
    };

    const daily = {
        shiny: monthly.shiny / DAYS_IN_MONTH,
        glowy: monthly.glowy / DAYS_IN_MONTH,
        starry: monthly.starry / DAYS_IN_MONTH,
    };

    const weekly = {
        shiny: daily.shiny * DAYS_IN_WEEK,
        glowy: daily.glowy * DAYS_IN_WEEK,
        starry: daily.starry * DAYS_IN_WEEK,
    };

    const bimonthly = {
        shiny: monthly.shiny * MONTHS_IN_BIMONTH,
        glowy: monthly.glowy * MONTHS_IN_BIMONTH,
        starry: monthly.starry * MONTHS_IN_BIMONTH,
    };

    const perEvent = {
        shiny: monthlyQualifiers.shiny,
        glowy: monthlyQualifiers.glowy,
        starry: monthlyQualifiers.starry,
    };

    return { perEvent, daily, weekly, monthly, bimonthly };
}