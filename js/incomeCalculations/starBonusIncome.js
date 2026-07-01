import { DAYS_IN_WEEK, DAYS_IN_MONTH, MONTHS_IN_BIMONTH } from "../data/timeConstants.js";
import { starBonusData, leagueTiers } from "../data/appData.js";

export function calculateStarBonusIncome(selectedLeague, starBonusState = {}) {
    const leagueData = starBonusData.find(data => data.league === parseInt(selectedLeague)) || starBonusData[0];
    const tierData = leagueTiers.items.find(l => l.id === parseInt(selectedLeague)) || leagueTiers.items.find(l => l.id === 105000000);
    const iconUrl = tierData?.iconUrls?.small || '';

    let eventFrequency = 2;
    let eventDuration = 0;
    let duration4x = 6;
    let thUpgrades = {};

    if (typeof starBonusState === 'number') {
        // Fallback for old signature: (selectedLeague, eventFrequency, eventDuration, thUpgrades)
        eventFrequency = starBonusState;
        eventDuration = arguments[2] !== undefined ? arguments[2] : 0;
        thUpgrades = arguments[3] || {};
    } else if (starBonusState && typeof starBonusState === 'object') {
        // New nested signature
        const config2x = starBonusState["2x"] || {};
        eventFrequency = config2x.frequency !== undefined ? config2x.frequency : 2;
        eventDuration = config2x.duration !== undefined ? config2x.duration : 0;

        thUpgrades = starBonusState.thUpgrades || {};
    }

    let extraInstancesPerMonth = 0;

    // 2x Star Bonus Averaging
    if (eventDuration > 0) {
        // Monthly average extra instances is duration / frequency
        extraInstancesPerMonth += eventDuration / Math.max(1, eventFrequency);
    }

    // 4x Star Bonus (TH Upgrade) Averaging
    // Each upgrade gives duration4x days of 4x bonus (3 extra instances per day)
    // We average these over a 12-month window for long-term projection
    const upgradeCount = Object.keys(thUpgrades).length;
    if (upgradeCount > 0 && duration4x > 0) {
        const totalExtra4xInstances = upgradeCount * duration4x * 3;
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
