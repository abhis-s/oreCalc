import { state } from '../core/state.js';
import { upgradeCosts, heroData } from '../data/heroData.js';
import { incomeData } from '../data/incomeChipData.js';
import { translate } from '../i18n/translator.js'; // Added import

function getDailyIncomeFromCalendar(date) {
    const dailyIncome = { shiny: 0, glowy: 0, starry: 0 };
    const monthYearKey = `${String(date.getUTCMonth() + 1).padStart(2, '0')}-${date.getUTCFullYear()}`;
    const dayKey = String(date.getUTCDate()).padStart(2, '0');

    const starBonusSource = incomeData.starBonus;
    const starBonusIncome = starBonusSource.getIncome(state);
    dailyIncome.shiny += Math.round(starBonusIncome.shiny);
    dailyIncome.glowy += Math.round(starBonusIncome.glowy);
    dailyIncome.starry += Math.round(starBonusIncome.starry);

    const chipsForThisDay = state.planner.calendar.dates[monthYearKey]?.[dayKey] || [];
    chipsForThisDay.forEach(chipId => {
        const parts = chipId.split('-');
        const type = parts[0];
        if (type === 'starBonus') {
            return;
        }
        const incomeSource = incomeData[type];

        if (incomeSource) {
            const income = incomeSource.getIncome(state);
            dailyIncome.shiny += Math.round(income.shiny);
            dailyIncome.glowy += Math.round(income.glowy);
            dailyIncome.starry += Math.round(income.starry);
        }
    });

    return dailyIncome;
}

export function calculateCompletionDates(priorityList) {
    const predictions = [];
    let currentOres = { ...state.storedOres };
    let currentDate = new Date();
    let stopProcessing = false;
    
    const simulatedLevels = {};
    const stopDate = new Date('2027-12-31T23:59:59Z');
    
    const lastProcessedStep = {};

    for (const item of priorityList) {
        const equipmentKey = `${item.heroName}-${item.name}`;
            
        if (lastProcessedStep[equipmentKey] && item.step <= lastProcessedStep[equipmentKey]) {
            stopProcessing = true;
        }
        lastProcessedStep[equipmentKey] = item.step;

        if (stopProcessing) {
            predictions.push({
                item: item,
                completionDate: null,
                error: true,
                message: translate('error_fix_order') // Translated
            });
            continue;
        }

        const hero = state.heroes[item.heroName];
        const actualCurrentLevel = hero?.equipment[item.name]?.level || 1;
        const effectiveStartLevel = simulatedLevels[equipmentKey] || actualCurrentLevel;

        if (effectiveStartLevel >= item.targetLevel) {
            console.log(`Skipping ${item.heroName}'s ${item.name} (Step #${item.step}) as it is already at or above target level ${item.targetLevel}`);
            continue;
        }

        const heroDataEntry = heroData[Object.keys(heroData).find(key => heroData[key].name === item.heroName)];
        const equipmentType = heroDataEntry?.equipment.find(eq => eq.name === item.name)?.type;

        console.log(`--- Calculating for ${item.heroName}'s ${item.name} (Step #${item.step}) ---`);
        console.log(`Actual Level: ${actualCurrentLevel}, Effective Start Level: ${effectiveStartLevel}, Target Level: ${item.targetLevel}`);
        console.log(`Equipment Type: ${equipmentType}`);

        let totalRequiredShiny = 0;
        let totalRequiredGlowy = 0;
        let totalRequiredStarry = 0;

        for (let level = effectiveStartLevel + 1; level <= item.targetLevel; level++) {
            const cost = upgradeCosts[level];
            if (!cost) {
                console.warn(`No upgrade cost found for level ${level}`);
                continue;
            }
            totalRequiredShiny += cost.shiny;
            totalRequiredGlowy += cost.glowy;
            if (equipmentType === 'epic') {
                totalRequiredStarry += cost.starry;
            }
        }

        console.log(`Total Required Ores for upgrade: Shiny: ${totalRequiredShiny}, Glowy: ${totalRequiredGlowy}, Starry: ${totalRequiredStarry}`);

        let requiredShiny = totalRequiredShiny;
        let requiredGlowy = totalRequiredGlowy;
        let requiredStarry = totalRequiredStarry;

        let completionDate = null;
        let simulatedOres = { ...currentOres };
        let simulationDate = new Date(currentDate);

        while (simulationDate <= stopDate) {
            const dailyIncome = getDailyIncomeFromCalendar(simulationDate);
            simulatedOres.shiny += dailyIncome.shiny;
            simulatedOres.glowy += dailyIncome.glowy;
            simulatedOres.starry += dailyIncome.starry;

            if (simulatedOres.shiny >= requiredShiny &&
                simulatedOres.glowy >= requiredGlowy &&
                simulatedOres.starry >= requiredStarry) {
                completionDate = new Date(simulationDate);
                break;
            }
            simulationDate.setUTCDate(simulationDate.getUTCDate() + 1);
        }

        if (completionDate) {
            predictions.push({
                item: item,
                completionDate: completionDate,
            });

            simulatedLevels[equipmentKey] = item.targetLevel;

            console.log(`Completion Date: ${completionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`);
            console.log(`Ores on Completion Date: Shiny: ${simulatedOres.shiny}, Glowy: ${simulatedOres.glowy}, Starry: ${simulatedOres.starry}`);

            currentOres.shiny = simulatedOres.shiny - requiredShiny;
            currentOres.glowy = simulatedOres.glowy - requiredGlowy;
            currentOres.starry = simulatedOres.starry - requiredStarry;
            currentDate = new Date(completionDate);
            console.log(`Ores after upgrade: Shiny: ${currentOres.shiny}, Glowy: ${currentOres.glowy}, Starry: ${currentOres.starry}`);
        } else {
            predictions.push({
                item: item,
                completionDate: null,
            });
            console.log(`Could not predict completion for ${item.heroName}'s ${item.name} (Step #${item.step}) within the timeframe (until Dec 2027).`);
            stopProcessing = true;
        }
    }
    return predictions;
}