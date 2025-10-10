import { championshipData } from "../data/appData.js";
import { DAYS_IN_WEEK, DAYS_IN_MONTH, MONTHS_IN_BIMONTH } from "../data/timeConstants.js";

export function calculateChampionshipIncome(isSupercellEventsEnabled) {
    if (!isSupercellEventsEnabled) {
        return {
            perEvent: { shiny: 0, glowy: 0, starry: 0 },
            daily: { shiny: 0, glowy: 0, starry: 0 },
            weekly: { shiny: 0, glowy: 0, starry: 0 },
            monthly: { shiny: 0, glowy: 0, starry: 0 },
            bimonthly: { shiny: 0, glowy: 0, starry: 0 },
        };
    }

    const monthlyQualifiers = championshipData.monthlyQualifiers;
    const lastChanceQualifiers = championshipData.lastChanceQualifiers;
    const worldChampionships = championshipData.worldChampionships;

    const totalPerYear = {
        shiny: (monthlyQualifiers.shiny * monthlyQualifiers.perYear) + (lastChanceQualifiers.shiny * lastChanceQualifiers.perYear) + (worldChampionships.shiny * worldChampionships.perYear),
        glowy: (monthlyQualifiers.glowy * monthlyQualifiers.perYear) + (lastChanceQualifiers.glowy * lastChanceQualifiers.perYear) + (worldChampionships.glowy * worldChampionships.perYear),
        starry: (monthlyQualifiers.starry * monthlyQualifiers.perYear) + (lastChanceQualifiers.starry * lastChanceQualifiers.perYear) + (worldChampionships.starry * worldChampionships.perYear),
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