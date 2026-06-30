import { state } from '../core/state.js';

import { incomeData, getSourceById } from '../data/incomeSourceRegistry.js';
import { storageCapacities } from '../data/oreConversionData.js';
import { supercellEventsData } from '../data/appData.js';
import { translate } from '../i18n/translator.js';
import { upgradeCosts, heroData } from '../data/heroData.js';

import { getSupercellEventsForYear } from './dateUtils.js';
import { toCamelCase } from './stringUtils.js';
import { getProspectorIncomeForDate } from '../incomeCalculations/prospectorManager.js';

let lastEventsYear = null;
let cachedEvents = null;

export function getDailyIncomeFromCalendar(date) {
    const dailyIncome = { shiny: 0, glowy: 0, starry: 0 };
    const monthYearKey = `${String(date.getUTCMonth() + 1).padStart(2, '0')}-${date.getUTCFullYear()}`;
    const dayKey = String(date.getUTCDate()).padStart(2, '0');

    const chipsForThisDay = state.planner.calendar.dates[monthYearKey]?.[dayKey] || [];
    const hasMultiplierChip = chipsForThisDay.some(id => {
        const cleanId = id.replace(/^custom-/, '');
        return cleanId.startsWith('starBonus') && !cleanId.startsWith('starBonus-') && cleanId.includes('x');
    });
    const hasCustomStarBonus = chipsForThisDay.some(id => id.startsWith('custom-starBonus'));

    if (!hasMultiplierChip && !hasCustomStarBonus) {
        const starBonusSource = incomeData.starBonus;
        const starBonusIncome = starBonusSource.getBaseIncome(state);
        dailyIncome.shiny += Math.round(starBonusIncome.shiny || 0);
        dailyIncome.glowy += Math.round(starBonusIncome.glowy || 0);
        dailyIncome.starry += Math.round(starBonusIncome.starry || 0);
    }

    const hasCustomProspector = chipsForThisDay.some(id => id.startsWith('custom-prospector'));
    if (state.income.prospector && state.income.prospector.goldPass && !hasCustomProspector) {
        const prospectorIncome = getProspectorIncomeForDate(date, state);
        dailyIncome.shiny += Math.round(prospectorIncome.shiny || 0);
        dailyIncome.glowy += Math.round(prospectorIncome.glowy || 0);
        dailyIncome.starry += Math.round(prospectorIncome.starry || 0);
    }

    if (state.income.supercellEvents && state.income.supercellEvents.worldChampionship) {
        const year = date.getUTCFullYear();
        if (year !== lastEventsYear || !cachedEvents) {
            const rawEvents = getSupercellEventsForYear(year, supercellEventsData);
            cachedEvents = rawEvents.map(event => {
                const startDate = new Date(event.start);
                const endDate = new Date(event.end);
                
                const startUTC = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
                const endUTC = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

                const diffDays = Math.round((endUTC - startUTC) / (1000 * 60 * 60 * 24));
                const middleDayOffset = Math.floor(diffDays / 2);
                const middleDateUTC = new Date(startUTC);
                middleDateUTC.setUTCDate(startUTC.getUTCDate() + middleDayOffset);

                return {
                    name: event.name,
                    middleTime: middleDateUTC.getTime()
                };
            });
            lastEventsYear = year;
        }

        const checkTime = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

        cachedEvents.forEach((event) => {
            if (checkTime === event.middleTime) {
                let rewardType = 'otherEvents';
                if (event.name === 'Monthly Finals') rewardType = 'monthlyQualifiers';
                else if (event.name === 'Last Chance Qualifier') rewardType = 'lastChanceQualifiers';
                else if (event.name === 'World Finals') rewardType = 'worldChampionships';

                let rewardsYear = year;
                if (!supercellEventsData.rewards[rewardsYear]) rewardsYear = year - 1;
                if (!supercellEventsData.rewards[rewardsYear]) {
                    const availableYears = Object.keys(supercellEventsData.rewards).map(Number).sort((a, b) => b - a);
                    rewardsYear = availableYears[0] || 2025;
                }
                let rewards = (supercellEventsData.rewards[rewardsYear] && supercellEventsData.rewards[rewardsYear][rewardType]) || { shiny: 0, glowy: 0, starry: 0 };
                
                const scOverride = state.planner?.calendar?.customChipSettings?.supercellEvents;
                if (scOverride && scOverride.globalOverride) {
                    const derived = state.derived?.incomeSources?.supercellEvents;
                    if (derived && derived.perEvent) {
                        rewards = { ...derived.perEvent };
                    }
                }

                dailyIncome.shiny += Math.round(rewards.shiny || 0);
                dailyIncome.glowy += Math.round(rewards.glowy || 0);
                dailyIncome.starry += Math.round(rewards.starry || 0);
            }
        });
    }

    chipsForThisDay.forEach(chipId => {
        const parts = chipId.split('-');
        const type = parts[0];
        
        // Check for custom chip data override
        if (chipId.startsWith('custom-') && state.planner.calendar.customChipData?.[chipId]) {
            const customData = state.planner.calendar.customChipData[chipId];
            dailyIncome.shiny += Math.round(customData.shiny || 0);
            dailyIncome.glowy += Math.round(customData.glowy || 0);
            dailyIncome.starry += Math.round(customData.starry || 0);
            return;
        }

        if (type === 'starBonus' || type === 'prospector' || type === 'supercellEvents') {
            return;
        }
        const incomeSource = getSourceById(type);

        if (incomeSource) {
            const income = incomeSource.getIncome(state);
            dailyIncome.shiny += Math.round(income.shiny || 0);
            dailyIncome.glowy += Math.round(income.glowy || 0);
            dailyIncome.starry += Math.round(income.starry || 0);
        }
    });

    return dailyIncome;
}

export function calculateCompletionDates(priorityList) {
    const predictions = [];
    const suggestions = [];
    let currentOres = {
        shiny: parseFloat(state.storedOres?.shiny) || 0,
        glowy: parseFloat(state.storedOres?.glowy) || 0,
        starry: parseFloat(state.storedOres?.starry) || 0
    };
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
                message: translate('errors.fixOrder')
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
            totalRequiredShiny += cost.shiny || 0;
            totalRequiredGlowy += cost.glowy || 0;
            if (equipmentType === 'epic') {
                totalRequiredStarry += cost.starry || 0;
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
                    const itemNames = interleavedItems.map(item => translate('planner.nameStep', { 
                        equipmentName: `<b>${translate('equipment.' + toCamelCase(item.name))}</b>`, 
                        step: item.step 
                    })).join(', ');
                    if (!suggestions.some(s => s.type === 'efficiency_interleave')) {
                        suggestions.push({
                            type: 'efficiency_interleave',
                            message: translate('planner.suggestionInterleave', { 
                                itemNames: itemNames, 
                                itemName: `<b>${translate('equipment.' + toCamelCase(item.name))}</b>` 
                            }),
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
                                const futureItemNameFormatted = translate('planner.nameStep', {
                                    equipmentName: `<b>${translate('equipment.' + toCamelCase(futureItem.name))}</b>`,
                                    step: futureItem.step
                                });
                                suggestions.push({
                                    type: 'move_epic_up',
                                    message: translate('planner.suggestionEpicUp', { futureItemName: futureItemNameFormatted }),
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
