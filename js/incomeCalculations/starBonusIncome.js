import { starBonusData, leagueTiers } from "../data/appData.js";
import { DAYS_IN_WEEK, DAYS_IN_MONTH, MONTHS_IN_BIMONTH } from "../data/timeConstants.js";

export function calculateStarBonusIncome(selectedLeague, eventFrequency = 2, eventDuration = 5, thUpgrades = {}) {
    const leagueData = starBonusData.find(data => data.league === parseInt(selectedLeague)) || starBonusData[0];
    const tierData = leagueTiers.items.find(l => l.id === parseInt(selectedLeague)) || leagueTiers.items.find(l => l.id === 105000000);
    const iconUrl = tierData?.iconUrls?.small || '';

    let extraInstancesPerMonth = 0;

    // 2x Star Bonus Averaging
    if (eventDuration > 0) {
        // Monthly average extra instances is duration / frequency
        extraInstancesPerMonth += eventDuration / Math.max(1, eventFrequency);
    }

    // 4x Star Bonus (TH Upgrade) Averaging
    // Each upgrade gives 6 days of 4x bonus (3 extra instances per day)
    // We average these over a 12-month window for long-term projection
    const upgradeCount = Object.keys(thUpgrades).length;
    if (upgradeCount > 0) {
        const totalExtra4xInstances = upgradeCount * 6 * 3;
        extraInstancesPerMonth += totalExtra4xInstances / 12;
    }

    const daysInMonth = DAYS_IN_MONTH;
    const multiplier = (extraInstancesPerMonth + daysInMonth) / daysInMonth;

    const daily = {
        shiny: (leagueData.shiny || 0) * multiplier,
        glowy: (leagueData.glowy || 0) * multiplier,
        starry: (leagueData.starry || 0) * multiplier,
    };
    const baseDaily = {
        shiny: (leagueData.shiny || 0),
        glowy: (leagueData.glowy || 0),
        starry: (leagueData.starry || 0),
    };
    const weekly = {
        shiny: daily.shiny * DAYS_IN_WEEK,
        glowy: daily.glowy * DAYS_IN_WEEK,
        starry: daily.starry * DAYS_IN_WEEK,
    };
    const monthly = {
        shiny: daily.shiny * DAYS_IN_MONTH,
        glowy: daily.glowy * DAYS_IN_MONTH,
        starry: daily.starry * DAYS_IN_MONTH,
    };
    const bimonthly = {
        shiny: monthly.shiny * MONTHS_IN_BIMONTH,
        glowy: monthly.glowy * MONTHS_IN_BIMONTH,
        starry: monthly.starry * MONTHS_IN_BIMONTH,
    };

    return { daily, baseDaily, weekly, monthly, bimonthly, iconUrl };
}
