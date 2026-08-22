/**
 * Calculates estimated completion time (years, months, days, projected date) for each ore type.
 *
 * @param {import('./types.js').OreQuantity} requiredOres - Missing ores required for target upgrades.
 * @param {import('./types.js').OreQuantity | import('./types.js').IncomeTimeframeRates} monthlyIncome - Monthly ore income rate.
 * @returns {import('./types.js').RemainingTimeEstimate} Completion estimates per ore type.
 */
export function calculateRemainingTime(requiredOres, monthlyIncome) {
    /**
     * @param {number} required
     * @param {number} income
     * @returns {import('./types.js').SingleTimeEstimate}
     */
    function formatResult(required, income) {
        if (required <= 0) {
            return { years: 0, months: 0, days: 0, date: null, status: 'DONE' };
        }

        if (income <= 0) {
            return { years: null, months: null, days: null, date: "N/A" };
        }

        const totalMonths = required / income;
        const years = Math.floor(totalMonths / 12);
        const months = Math.floor(totalMonths % 12);
        let days = Math.round((totalMonths * 30.44) % 30.44);

        if (years >= 5) {
            return { years: null, months: null, days: null, date: "N/A" };
        }

        const totalDays = totalMonths * 30.44;
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + totalDays);

        return {
            years: years,
            months: months,
            days: days,
            date: futureDate
        };
    }

    return {
        shiny: formatResult(requiredOres.shiny, monthlyIncome.shiny),
        glowy: formatResult(requiredOres.glowy, monthlyIncome.glowy),
        starry: formatResult(requiredOres.starry, monthlyIncome.starry),
    };
}
