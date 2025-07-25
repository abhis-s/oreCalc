import { DAYS_IN_WEEK, DAYS_IN_MONTH, WEEKS_IN_MONTH, MONTHS_IN_BIMONTH } from "../data/timeConstants.js";

function calculateTimeframeBreakdown(monthlyOres, additionalData = {}) {
    const daily = {
        shiny: monthlyOres.shiny / DAYS_IN_MONTH,
        glowy: monthlyOres.glowy / DAYS_IN_MONTH,
        starry: monthlyOres.starry / DAYS_IN_MONTH,
    };
    const weekly = {
        shiny: daily.shiny * DAYS_IN_WEEK,
        glowy: daily.glowy * DAYS_IN_WEEK,
        starry: daily.starry * DAYS_IN_WEEK,
    };
    const bimonthly = {
        shiny: monthlyOres.shiny * MONTHS_IN_BIMONTH,
        glowy: monthlyOres.glowy * MONTHS_IN_BIMONTH,
        starry: monthlyOres.starry * MONTHS_IN_BIMONTH,
    };
    return { daily, weekly, monthly: monthlyOres, bimonthly, ...additionalData };
}

export function calculateWarIncome(winRate, drawRate, oresPerAttack, attacksPerEvent, eventsPerMonth) {
    const winFactor = winRate / 100;
    const drawFactor = (drawRate / 100) * (4 / 7);
    const lossFactor = ((100 - winRate - drawRate) / 100) * 0.5;
    const totalFactor = winFactor + drawFactor + lossFactor;

    const avgOresPerEvent = {
        shiny: attacksPerEvent * oresPerAttack.shiny * totalFactor,
        glowy: attacksPerEvent * oresPerAttack.glowy * totalFactor,
        starry: attacksPerEvent * oresPerAttack.starry * totalFactor,
    };
    const monthlyOres = {
        shiny: eventsPerMonth * avgOresPerEvent.shiny,
        glowy: eventsPerMonth * avgOresPerEvent.glowy,
        starry: eventsPerMonth * avgOresPerEvent.starry,
    };
    return calculateTimeframeBreakdown(monthlyOres, { perEvent: avgOresPerEvent });
}

export function calculateWeeklyIncome(weeklyOres) {
    const monthlyOres = {
        shiny: weeklyOres.shiny * WEEKS_IN_MONTH,
        glowy: weeklyOres.glowy * WEEKS_IN_MONTH,
        starry: weeklyOres.starry * WEEKS_IN_MONTH,
    };
    return calculateTimeframeBreakdown(monthlyOres, { weekly: weeklyOres });
}

export function calculateBimonthlyIncome(bimonthlyOres) {
    const monthlyOres = {
        shiny: bimonthlyOres.shiny / MONTHS_IN_BIMONTH,
        glowy: bimonthlyOres.glowy / MONTHS_IN_BIMONTH,
        starry: bimonthlyOres.starry / MONTHS_IN_BIMONTH,
    };
    return calculateTimeframeBreakdown(monthlyOres, { bimonthly: bimonthlyOres });
}

export function adjustWarRates(winRate, drawRate, changedRate) {
    let adjustedWinRate = winRate;
    let adjustedDrawRate = drawRate;
    const totalRates = winRate + drawRate;

    if (totalRates > 100) {
        const excess = totalRates - 100;
        if (changedRate === 'win') {
            adjustedDrawRate = Math.max(0, drawRate - excess);
        } else {
            adjustedWinRate = Math.max(0, winRate - excess);
        }
    }
    return { winRate: adjustedWinRate, drawRate: adjustedDrawRate };
}