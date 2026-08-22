import { heroData } from '../../data/heroData.js';

import { state } from '../../core/state.js';

import { autoPlaceIncomeChipsForRange } from '../../utils/autoPlaceChips.js';
import { getMaxDate, getMinDate } from '../../utils/dateUtils.js';
import { logger } from '../../utils/logger.js';
import { calculateCompletionDates } from '../../utils/predictionCalculator.js';
import { toCamelCase } from '../../utils/stringUtils.js';

/**
 * Automatically places recurring income chips across the entire date range based on active priority schedules.
 */
export function autoPlaceChipsForDateRange() {
    const startTime = new Date();

    const { month: MIN_MONTH, year: MIN_YEAR } = getMinDate();
    const { month: MAX_MONTH, year: MAX_YEAR } = getMaxDate();

    autoPlaceIncomeChipsForRange(MIN_MONTH, MIN_YEAR, MAX_MONTH, MAX_YEAR);

    const endTime = new Date();
    const timeTaken = (endTime.getTime() - startTime.getTime()) / 1000;
    logger.log(`Finished auto-placing chips for all months in the range. Total time: ${timeTaken} seconds.`);
}

let cachedPriorityList = null;
let cachedSuggestions = null;
let cachedTimestamp = null;
let cachedIsHydrated = null;

/**
 * Returns the aggregated global priority list along with optimization suggestions.
 * Result is memoized using state timestamp and calendar hydration caching.
 * @returns {{ globalPriorityList: Array<any>, suggestions: Array<any>|null }}
 */
export function getGlobalPriorityList() {
    const isHydrated = state.planner?.calendar?.isHydrated === true;
    if (cachedPriorityList && cachedTimestamp === state.timestamp && cachedIsHydrated === isHydrated) {
        return { globalPriorityList: cachedPriorityList, suggestions: cachedSuggestions };
    }

    const globalPriorityList = [];
    const heroNameMap = {
        'Barbarian King': 'barbarianKing',
        'Archer Queen': 'archerQueen',
        'Minion Prince': 'minionPrince',
        'Grand Warden': 'grandWarden',
        'Royal Champion': 'royalChampion',
        'Dragon Duke': 'dragonDuke',
        barbarianKing: 'barbarianKing',
        archerQueen: 'archerQueen',
        minionPrince: 'minionPrince',
        grandWarden: 'grandWarden',
        royalChampion: 'royalChampion',
        dragonDuke: 'dragonDuke'
    };

    for (const heroKey in state.heroes) {
        const hero = state.heroes[heroKey];
        for (const equipName in hero.equipment) {
            const equipment = hero.equipment[equipName];
            if (equipment.upgradePlan) {
                for (const stepNum in equipment.upgradePlan) {
                    const stepData = equipment.upgradePlan[stepNum];
                    const currentLevel = state.heroes[heroKey]?.equipment[equipName]?.level || 1;
                    if (stepData.enabled && stepData.targetLevel > currentLevel) {
                        const heroDataKey = heroNameMap[heroKey] || heroKey;
                        const heroEntry = heroData[heroDataKey];
                        if (!heroEntry) continue;

                        const equipMatch = heroEntry.equipment.find(e => e.key === equipName || e.key === toCamelCase(equipName));

                        globalPriorityList.push({
                            name: equipName,
                            image: equipMatch?.image,
                            targetLevel: stepData.targetLevel,
                            step: parseInt(stepNum, 10),
                            priorityIndex: stepData.priorityIndex,
                            heroName: heroKey
                        });
                    }
                }
            }
        }
    }
    globalPriorityList.sort((a, b) => a.priorityIndex - b.priorityIndex);

    const { predictions, suggestions } = calculateCompletionDates(globalPriorityList);
    globalPriorityList.forEach(item => {
        const prediction = predictions.find(p =>
            p.item.heroName === item.heroName &&
            p.item.name === item.name &&
            p.item.step === item.step
        );
        if (prediction) {
            item.completionDate = prediction.completionDate;
            item.error = prediction.error;
            item.message = prediction.message;
            item.oresPreCompletion = prediction.oresPreCompletion;
            item.oresPostCompletion = prediction.oresPostCompletion;
            item.requiredOres = prediction.requiredOres;
            item.bottleneckOre = prediction.bottleneckOre;
        }
    });

    cachedPriorityList = globalPriorityList;
    cachedSuggestions = suggestions;
    cachedTimestamp = state.timestamp;
    cachedIsHydrated = isHydrated;

    return { globalPriorityList, suggestions };
}

/**
 * Checks for sequence inversions in upgrade steps for each equipment.
 * @param {Array<any>} globalPriorityList
 * @returns {{ hasError: boolean, errorItems: Set<string> }}
 */
export function getStepOrderErrors(globalPriorityList) {
    const equipmentGroups = {};
    globalPriorityList.forEach(item => {
        if (!equipmentGroups[item.name]) {
            equipmentGroups[item.name] = [];
        }
        equipmentGroups[item.name].push(item);
    });

    let hasError = false;
    const errorItems = new Set();

    for (const equipName in equipmentGroups) {
        const items = equipmentGroups[equipName];
        for (let i = 0; i < items.length - 1; i++) {
            if (items[i].step > items[i + 1].step) {
                hasError = true;
                errorItems.add(`${items[i].name}-${items[i].step}`);
                errorItems.add(`${items[i + 1].name}-${items[i + 1].step}`);
            }
        }
    }
    return { hasError, errorItems };
}
