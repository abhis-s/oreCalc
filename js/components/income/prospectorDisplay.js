import { dom } from '../../dom/domElements.js';
import { state } from '../../core/state.js';
import { formatNumber } from '../../utils/numberFormatter.js';
import { getGlobalPriorityList } from '../planner/priorityListModal.js';
import { heroData, upgradeCosts } from '../../data/heroData.js';
import { getDailyIncomeFromCalendar } from '../../utils/predictionCalculator.js';
import { translate } from '../../i18n/translator.js';
import { convertOres, getStepValue } from '../../incomeCalculations/prospectorManager.js';
import { oreMaxValues } from '../../data/oreConversionData.js';

export function renderProspectorIncomeDisplay(prospectorIncome) {
    const dailyValues = prospectorIncome.daily || { shiny: 0, glowy: 0, starry: 0 };
    const monthlyValues = prospectorIncome.monthly || { shiny: 0, glowy: 0, starry: 0 };

    dom.income.prospector.display.daily.shiny.textContent = formatNumber(dailyValues.shiny);
    dom.income.prospector.display.daily.glowy.textContent = formatNumber(dailyValues.glowy);
    dom.income.prospector.display.daily.starry.textContent = formatNumber(dailyValues.starry);

    dom.income.prospector.display.monthly.shiny.textContent = formatNumber(monthlyValues.shiny);
    dom.income.prospector.display.monthly.glowy.textContent = formatNumber(monthlyValues.glowy);
    dom.income.prospector.display.monthly.starry.textContent = formatNumber(monthlyValues.starry);

    updateProspectorTip();
}

function updateProspectorTip() {
    const tipContainer = dom.income.prospector.tip?.container;
    const tipEmoji = dom.income.prospector.tip?.emoji;
    const tipText = dom.income.prospector.tip?.text;
    if (!tipContainer || !tipText || !tipEmoji) return;

    if (!state.income.prospector.goldPass) {
        tipContainer.style.display = 'none';
        return;
    }

    const { globalPriorityList } = getGlobalPriorityList();
    if (!globalPriorityList || globalPriorityList.length === 0) {
        tipEmoji.textContent = '💡';
        tipText.innerHTML = `<p>Add equipment to your priority list in the <b>Planner</b> tab to get dynamic conversion tips.</p>`;
        tipContainer.style.display = 'block';
        return;
    }

    const firstItem = globalPriorityList[0];
    const heroDataEntry = heroData[Object.keys(heroData).find(key => heroData[key].name === firstItem.heroName)];
    const equipmentType = heroDataEntry?.equipment.find(eq => eq.name === firstItem.name)?.type;
    const currentLevel = state.heroes[firstItem.heroName]?.equipment[firstItem.name]?.level || 1;
    
    let req = { shiny: 0, glowy: 0, starry: 0 };
    for (let level = currentLevel + 1; level <= firstItem.targetLevel; level++) {
        const cost = upgradeCosts[level];
        if (cost) {
            req.shiny += cost.shiny;
            req.glowy += cost.glowy;
            if (equipmentType === 'epic') req.starry += cost.starry;
        }
    }

    const missing = {
        shiny: Math.max(0, req.shiny - state.storedOres.shiny),
        glowy: Math.max(0, req.glowy - state.storedOres.glowy),
        starry: Math.max(0, req.starry - state.storedOres.starry)
    };

    if (missing.shiny === 0 && missing.glowy === 0 && missing.starry === 0) {
        tipContainer.style.display = 'none';
        return;
    }

    // 1. Get Base Income (Exclude current prospector settings)
    const totalDailyIncome = getDailyIncomeFromCalendar(new Date());
    const currentProspectorDaily = state.derived.incomeSources.prospector?.daily || { shiny: 0, glowy: 0, starry: 0 };
    const baseIncome = {
        shiny: Math.max(0, totalDailyIncome.shiny - currentProspectorDaily.shiny),
        glowy: Math.max(0, totalDailyIncome.glowy - currentProspectorDaily.glowy),
        starry: Math.max(0, totalDailyIncome.starry - currentProspectorDaily.starry)
    };

    // 2. Calculate "Natural" days to finish
    const days = {
        shiny: missing.shiny > 0 ? (baseIncome.shiny > 0 ? missing.shiny / baseIncome.shiny : Infinity) : 0,
        glowy: missing.glowy > 0 ? (baseIncome.glowy > 0 ? missing.glowy / baseIncome.glowy : Infinity) : 0,
        starry: missing.starry > 0 ? (baseIncome.starry > 0 ? missing.starry / baseIncome.starry : Infinity) : 0
    };

    const naturalMaxDays = Math.max(days.shiny, days.glowy, days.starry);
    let bottleneck = 'shiny';
    if (days.glowy === naturalMaxDays) bottleneck = 'glowy';
    else if (days.starry === naturalMaxDays) bottleneck = 'starry';

    let source = 'shiny';
    const naturalMinDays = Math.min(
        days.shiny === 0 ? Infinity : days.shiny,
        days.glowy === 0 ? Infinity : days.glowy,
        days.starry === 0 ? Infinity : days.starry
    );
    if (days.glowy === naturalMinDays) source = 'glowy';
    else if (days.starry === naturalMinDays) source = 'starry';

    if (bottleneck === source || naturalMaxDays === Infinity) {
        tipContainer.style.display = 'none';
        return;
    }

    // 3. Calculate Optimal Conversion Rate (n)
    const conversionFactor = convertOres(source, bottleneck, 1000) / 1000;
    const numerator = (missing[bottleneck] * baseIncome[source]) - (missing[source] * baseIncome[bottleneck]);
    const denominator = (missing[source] * conversionFactor) + missing[bottleneck];
    let rawOptimalN = Math.max(0, numerator / denominator);
    
    // Round optimalN to the nearest step
    const step = getStepValue(source, bottleneck);
    let optimalN = Math.round(rawOptimalN / step) * step;

    // Constraints: Don't convert more than we earn daily, or more than the max limit
    const limit = Math.min(baseIncome[source], oreMaxValues[source]);
    optimalN = Math.min(optimalN, limit);

    // 4. Evaluate current user settings
    const currentFrom = state.income.prospector.fromOre;
    const currentTo = state.income.prospector.toOre;
    const currentAmount = state.income.prospector.fromAmount;

    const itemName = translate(firstItem.name.toLowerCase().replace(/\s/g, '_')) || firstItem.name;
    const bottleneckTrans = translate(`${bottleneck}_ore`) || bottleneck;
    const sourceTrans = translate(`${source}_ore`) || source;
    const upgradeInfo = `<b>${itemName}</b> (to level ${firstItem.targetLevel})`;

    let emoji = '💡';
    let textContent = '';

    // Check if current setting is "Close enough" to optimal
    const isOptimal = (currentAmount === 0 && optimalN === 0) || 
                      (currentTo === bottleneck && currentFrom === source && Math.abs(currentAmount - optimalN) < step);

    if (isOptimal) {
        emoji = '✅';
        const activeRate = (currentTo === bottleneck && currentFrom === source) ? currentAmount : 0;
        const balancedDays = Math.ceil(missing[source] / (baseIncome[source] - activeRate));
        textContent = `<p><b>Optimal Setting!</b></p><p>Your ores for ${upgradeInfo} are balanced.</p><p>Ready in ~<b>${balancedDays} days</b>.</p>`;
    } else if (currentTo !== bottleneck && currentAmount > 0) {
        emoji = '💡';
        textContent = `<p>Your primary bottleneck for ${upgradeInfo} is <b>${bottleneckTrans}</b>.</p><p>Change your conversion target to finish faster.</p>`;
    } else if (currentTo === bottleneck && currentFrom === source && currentAmount > optimalN) {
        emoji = '⚠️';
        const recText = optimalN > 0 ? `~<b>${optimalN}</b>` : '<b>0</b> (disable conversion)';
        textContent = `<p><b>Over-converting!</b></p><p>For ${upgradeInfo}, <b>${sourceTrans}</b> will become your new bottleneck.</p><p>Reduce conversion to ${recText}.</p>`;
    } else {
        emoji = '💡';
        const recText = optimalN > 0 ? `~<b>${optimalN}</b>` : '<b>0</b> (no conversion needed)';
        textContent = `<p>Finish ${upgradeInfo} faster by converting <b>${sourceTrans}</b> to <b>${bottleneckTrans}</b>.</p><p>Recommended: ${recText}.</p>`;
    }

    const otherOre = ['shiny', 'glowy', 'starry'].find(o => o !== source && o !== bottleneck);
    if (days[otherOre] > naturalMaxDays) {
        const otherTrans = translate(`${otherOre}_ore`) || otherOre;
        textContent += `<small>Note: <b>${otherTrans}</b> is currently your slowest resource; converting other ores won't reduce total time.</small>`;
    }

    tipEmoji.textContent = emoji;
    tipText.innerHTML = textContent;
    tipContainer.style.display = 'block';
}

export function renderProspectorHomeDisplay(prospectorIncome, timeframe) {
    const prospectorRow = dom.income.home.incomeCard.table.prospector;
    if (!prospectorRow) return;

    const timeframeIncome = prospectorIncome[timeframe] || { shiny: 0, glowy: 0, starry: 0 };

    prospectorRow.shiny.textContent = formatNumber(Math.round(timeframeIncome.shiny));
    prospectorRow.glowy.textContent = formatNumber(Math.round(timeframeIncome.glowy));
    prospectorRow.starry.textContent = formatNumber(Math.round(timeframeIncome.starry));

    const prospectorState = state.income.prospector;
    if (prospectorState.goldPass) {
        prospectorRow.resource.textContent = 'Gold Pass';
    } else {
        prospectorRow.resource.textContent = 'Silver Pass';
    }
}
