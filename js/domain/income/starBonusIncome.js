import { getStarBonusForTownHall } from '../../data/incomeSources/starBonus.js';
import { DAYS_IN_MONTH, DAYS_IN_WEEK, MONTHS_IN_BIMONTH } from '../../data/timeConstants.js';

/**
 * Calculates daily, weekly, monthly, and bimonthly ore income from Star Bonus based on
 * player Town Hall level, incorporating 2x Star Bonus event averaging and 4x Town Hall boost projections.
 *
 * @param {number | string} townHallLevel - Active Town Hall level.
 * @param {import('../../core/types.js').StarBonusIncomeState | any} [starBonusState={}] - Star bonus configuration object.
 * @returns {import('../../core/types.js').IncomeResult} Composite star bonus ore income rates and badge icon URL.
 */
export function calculateStarBonusIncome(townHallLevel, starBonusState = {}) {
    const thLevel = Math.max(1, Number(townHallLevel) || 18);
    const baseOres = getStarBonusForTownHall(thLevel);
    const iconUrl = `assets/th/th${Math.min(thLevel, 18)}.png`;

    const stateObj = (starBonusState && typeof starBonusState === 'object') ? /** @type {any} */ (starBonusState) : {};
    const config2x = stateObj["2x"] || {};
    const eventFrequency = config2x.frequency !== undefined ? config2x.frequency : 2;
    const eventDuration = config2x.duration !== undefined ? config2x.duration : 0;
    const duration4x = 6;
    const thUpgrades = stateObj.thUpgrades || {};

    let extraInstancesPerMonth = 0;

    // 2x Star Bonus Averaging
    if (eventDuration > 0) {
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
    const starBonusSnacksPerMonth = 2;
    const totalMonthlyInstances = daysInMonth + starBonusSnacksPerMonth + extraInstancesPerMonth;

    const baseDaily = {
        shiny: (baseOres.shiny || 0),
        glowy: (baseOres.glowy || 0),
        starry: (baseOres.starry || 0),
    };
    const daily = {
        shiny: baseDaily.shiny,
        glowy: baseDaily.glowy,
        starry: baseDaily.starry,
    };
    const weekly = {
        shiny: daily.shiny * DAYS_IN_WEEK,
        glowy: daily.glowy * DAYS_IN_WEEK,
        starry: daily.starry * DAYS_IN_WEEK,
    };
    const monthly = {
        shiny: baseDaily.shiny * totalMonthlyInstances,
        glowy: baseDaily.glowy * totalMonthlyInstances,
        starry: baseDaily.starry * totalMonthlyInstances,
    };
    const bimonthly = {
        shiny: monthly.shiny * MONTHS_IN_BIMONTH,
        glowy: monthly.glowy * MONTHS_IN_BIMONTH,
        starry: monthly.starry * MONTHS_IN_BIMONTH,
    };

    return { daily, baseDaily, weekly, monthly, bimonthly, iconUrl };
}

/**
 * Resolves the effective Town Hall level for a specific date, factoring in planned Town Hall upgrades.
 *
 * @param {Date} date - Calendar date being evaluated.
 * @param {import('../../core/types.js').AppState | any} state - Application state.
 * @returns {number} Effective Town Hall level for that date.
 */
export function getEffectiveTownHallForDate(date, state) {
    let effectiveTH = Math.max(1, Number(state?.playerProfile?.townHallLevel) || 18);
    const upgrades = state?.income?.starBonus?.thUpgrades;
    if (upgrades && typeof upgrades === 'object') {
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth() + 1;
        const dateKey = `${year}-${String(month).padStart(2, '0')}`;
        for (const thStr in upgrades) {
            const targetKey = upgrades[thStr];
            if (targetKey && targetKey <= dateKey) {
                const thNum = Number(thStr);
                if (thNum > effectiveTH) {
                    effectiveTH = thNum;
                }
            }
        }
    }
    return effectiveTH;
}
