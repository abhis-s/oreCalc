import { starBonusData } from "../data/appData.js";
import { DAYS_IN_WEEK, DAYS_IN_MONTH, MONTHS_IN_BIMONTH } from "../data/timeConstants.js";

export function calculateStarBonusIncome(selectedLeague) {
    const leagueData = starBonusData.find(data => data.league === parseInt(selectedLeague)) || starBonusData[0];
    const daily = {
        shiny: leagueData.shiny || 0,
        glowy: leagueData.glowy || 0,
        starry: leagueData.starry || 0,
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

    return { daily, weekly, monthly, bimonthly };
}