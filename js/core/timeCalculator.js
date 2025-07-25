export function calculateRemainingTime(requiredOres, monthlyIncome) {
    function formatResult(required, income) {
        if (income <= 0 || required <= 0) {
            return { time: "N/A", date: "N/A" };
        }

        const totalMonths = required / income;
        const years = Math.floor(totalMonths / 12);
        const months = Math.floor(totalMonths % 12);
        let days = Math.round((totalMonths * 30.44) % 30.44);

        const totalDays = totalMonths * 30.44;
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + totalDays);
        const day = String(futureDate.getDate()).padStart(2, '0');
        const month = String(futureDate.getMonth() + 1).padStart(2, '0');
        const year = String(futureDate.getFullYear()).slice(-2);

        return {
            time: `${years}y ${months}m ${days}d`,
            date: `${day}.${month}.${year}`
        };
    }

    return {
        shiny: formatResult(requiredOres.shiny, monthlyIncome.shiny),
        glowy: formatResult(requiredOres.glowy, monthlyIncome.glowy),
        starry: formatResult(requiredOres.starry, monthlyIncome.starry),
    };
}