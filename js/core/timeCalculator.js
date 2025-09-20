export function calculateRemainingTime(requiredOres, monthlyIncome) {
    function formatResult(required, income) {
        if (income <= 0 || required <= 0) {
            return { years: null, months: null, days: null, date: "N/A" };
        }

        const totalMonths = required / income;
        const years = Math.floor(totalMonths / 12);
        const months = Math.floor(totalMonths % 12);
        let days = Math.round((totalMonths * 30.44) % 30.44);

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