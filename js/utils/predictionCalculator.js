import { state } from '../core/state.js';
import { upgradeCosts, heroData } from '../data/heroData.js';
import { incomeData } from '../data/incomeChipData.js';
import { translate } from '../i18n/translator.js';
import { storageCapacities } from '../data/oreConversionData.js';

export function getDailyIncomeFromCalendar(date) {
    const dailyIncome = { shiny: 0, glowy: 0, starry: 0 };
    const monthYearKey = `${String(date.getUTCMonth() + 1).padStart(2, '0')}-${date.getUTCFullYear()}`;
    const dayKey = String(date.getUTCDate()).padStart(2, '0');

    const starBonusSource = incomeData.starBonus;
    const starBonusIncome = starBonusSource.getIncome(state);
    dailyIncome.shiny += Math.round(starBonusIncome.shiny);
    dailyIncome.glowy += Math.round(starBonusIncome.glowy);
    dailyIncome.starry += Math.round(starBonusIncome.starry);

    if (state.income.prospector && state.income.prospector.goldPass) {
        const prospectorSource = incomeData.prospector;
        const prospectorIncome = prospectorSource.getIncome(state);
        dailyIncome.shiny += Math.round(prospectorIncome.shiny);
        dailyIncome.glowy += Math.round(prospectorIncome.glowy);
        dailyIncome.starry += Math.round(prospectorIncome.starry);
    }

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
    const suggestions = [];
    let currentOres = { ...state.storedOres };
    let currentDate = new Date();
    let stopProcessing = false;

    const simulatedLevels = {};
    const stopDate = new Date('2027-12-31T23:59:59Z');

    const lastProcessedStep = {};

    for (let i = 0; i < priorityList.length; i++) {
        const item = priorityList[i];
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
                message: translate('error_fix_order')
            });
            continue;
        }

        const hero = state.heroes[item.heroName];
        const actualCurrentLevel = hero?.equipment[item.name]?.level || 1;
        const effectiveStartLevel = simulatedLevels[equipmentKey] || actualCurrentLevel;

        if (effectiveStartLevel >= item.targetLevel) {
            continue;
        }

        const heroDataEntry = heroData[Object.keys(heroData).find(key => heroData[key].name === item.heroName)];
        const equipmentType = heroDataEntry?.equipment.find(eq => eq.name === item.name)?.type;

        let totalRequiredShiny = 0;
        let totalRequiredGlowy = 0;
        let totalRequiredStarry = 0;

        for (let level = effectiveStartLevel + 1; level <= item.targetLevel; level++) {
            const cost = upgradeCosts[level];
            if (!cost) continue;
            totalRequiredShiny += cost.shiny;
            totalRequiredGlowy += cost.glowy;
            if (equipmentType === 'epic') {
                totalRequiredStarry += cost.starry;
            }
        }

        let requiredShiny = totalRequiredShiny;
        let requiredGlowy = totalRequiredGlowy;
        let requiredStarry = totalRequiredStarry;

        let completionDate = null;
        let simulatedOres = { ...currentOres };
        let simulationDate = new Date(currentDate);
        let isStarryBottleneck = false;
        let bottleneckOre = 'shiny';
        let previousSimulatedOres = { ...simulatedOres };

        while (simulationDate <= stopDate) {
            const dailyIncome = getDailyIncomeFromCalendar(simulationDate);
            
            const prevShinyReady = previousSimulatedOres.shiny >= requiredShiny;
            const prevGlowyReady = previousSimulatedOres.glowy >= requiredGlowy;
            const prevStarryReady = previousSimulatedOres.starry >= requiredStarry;

            simulatedOres.shiny += dailyIncome.shiny;
            simulatedOres.glowy += dailyIncome.glowy;
            simulatedOres.starry += dailyIncome.starry;

            if (equipmentType === 'epic') {
                const shinyReady = simulatedOres.shiny >= requiredShiny;
                const glowyReady = simulatedOres.glowy >= requiredGlowy;
                if (shinyReady && glowyReady) {
                    isStarryBottleneck = true;
                }
            }

            if (simulatedOres.shiny >= requiredShiny && simulatedOres.glowy >= requiredGlowy && simulatedOres.starry >= requiredStarry) {
                if (!prevStarryReady && equipmentType === 'epic') bottleneckOre = 'starry';
                else if (!prevGlowyReady) bottleneckOre = 'glowy';
                else if (!prevShinyReady) bottleneckOre = 'shiny';

                completionDate = new Date(simulationDate);
                break;
            }
            
            previousSimulatedOres.shiny = simulatedOres.shiny;
            previousSimulatedOres.glowy = simulatedOres.glowy;
            previousSimulatedOres.starry = simulatedOres.starry;
            simulationDate.setUTCDate(simulationDate.getUTCDate() + 1);
        }

        if (completionDate) {
            simulatedLevels[equipmentKey] = item.targetLevel;

            const preUpgradeOres = { ...simulatedOres };
            currentOres.shiny = simulatedOres.shiny - requiredShiny;
            currentOres.glowy = simulatedOres.glowy - requiredGlowy;
            currentOres.starry = simulatedOres.starry - requiredStarry;
            
            predictions.push({ 
                item: item, 
                completionDate: completionDate,
                oresPreCompletion: preUpgradeOres,
                oresPostCompletion: { ...currentOres },
                requiredOres: { shiny: requiredShiny, glowy: requiredGlowy, starry: requiredStarry },
                bottleneckOre: bottleneckOre
            });

            currentDate = new Date(completionDate);

            // --- Efficiency Boost Logic ---
            if (isStarryBottleneck) {
                let surplusShiny = currentOres.shiny;
                let surplusGlowy = currentOres.glowy;
                const interleavedItems = [];

                for (let j = i + 1; j < priorityList.length; j++) {
                    const futureItem = priorityList[j];
                    const futureHeroDataEntry = heroData[Object.keys(heroData).find(key => heroData[key].name === futureItem.heroName)];
                    const futureEquipmentType = futureHeroDataEntry?.equipment.find(eq => eq.name === futureItem.name)?.type;

                    if (futureEquipmentType === 'common') {
                        let futureShinyCost = 0;
                        let futureGlowyCost = 0;
                        const futureEffectiveStartLevel = simulatedLevels[`${futureItem.heroName}-${futureItem.name}`] || state.heroes[futureItem.heroName]?.equipment[futureItem.name]?.level || 1;

                        if (futureEffectiveStartLevel >= futureItem.targetLevel) continue;

                        for (let level = futureEffectiveStartLevel + 1; level <= futureItem.targetLevel; level++) {
                            futureShinyCost += upgradeCosts[level]?.shiny || 0;
                            futureGlowyCost += upgradeCosts[level]?.glowy || 0;
                        }

                        if (futureShinyCost <= surplusShiny && futureGlowyCost <= surplusGlowy) {
                            interleavedItems.push(futureItem);
                            surplusShiny -= futureShinyCost;
                            surplusGlowy -= futureGlowyCost;
                        }
                    }
                }

                if (interleavedItems.length > 0) {
                    const itemNames = interleavedItems.map(item => `<b>${item.name}</b> (Step #${item.step})`).join(', ');
                    if (!suggestions.some(s => s.type === 'efficiency_interleave')) {
                        suggestions.push({
                            type: 'efficiency_interleave',
                            message: `You can complete ${itemNames} while waiting for Starry Ores for <b>${item.name}</b> without delaying your plan.`,
                            itemsToMove: interleavedItems.map(item => ({ heroName: item.heroName, name: item.name, step: item.step })),
                            moveBefore: { heroName: item.heroName, name: item.name, step: item.step }
                        });
                    }
                }
            }

            // --- Move Epic Up Logic ---
            if (equipmentType === 'common') {
                for (let j = i + 1; j < priorityList.length; j++) {
                    const futureItem = priorityList[j];
                    const futureHeroDataEntry = heroData[Object.keys(heroData).find(key => heroData[key].name === futureItem.heroName)];
                    const futureEquipmentType = futureHeroDataEntry?.equipment.find(eq => eq.name === futureItem.name)?.type;

                    if (futureEquipmentType === 'epic') {
                        let futureStarryCost = 0;
                        const futureSimulatedLevels = { ...simulatedLevels };
                        const futureEffectiveStartLevel = futureSimulatedLevels[`${futureItem.heroName}-${futureItem.name}`] || state.heroes[futureItem.heroName]?.equipment[futureItem.name]?.level || 1;

                        if (futureEffectiveStartLevel >= futureItem.targetLevel) continue;

                        for (let level = futureEffectiveStartLevel + 1; level <= futureItem.targetLevel; level++) {
                            futureStarryCost += upgradeCosts[level]?.starry || 0;
                        }

                        if (currentOres.starry >= futureStarryCost) {
                            if (!suggestions.some(s => s.type === 'move_epic_up')) {
                                suggestions.push({
                                    type: 'move_epic_up',
                                    message: `<b>${futureItem.name}</b> (Step #${futureItem.step}) can be finished sooner if moved up, as you have a surplus of Starry Ores.`,
                                    itemToMove: { heroName: futureItem.heroName, name: futureItem.name, step: futureItem.step },
                                    moveBefore: { heroName: item.heroName, name: item.name, step: item.step }
                                });
                            }
                            break;
                        }
                    }
                }
            }
        } else {
            predictions.push({
                item: item,
                completionDate: null,
            });
            stopProcessing = true;
        }
    }
    return { predictions, suggestions };
}
