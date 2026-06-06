import { dom } from '../../dom/domElements.js';
import { state } from '../../core/state.js';

import { convertOres, getStepValue } from '../../incomeCalculations/prospectorManager.js';

import { formatNumber } from '../../utils/numberFormatter.js';
import { getDailyIncomeFromCalendar } from '../../utils/predictionCalculator.js';
import { getSVG } from '../../utils/svgManager.js';
import { heroData, upgradeCosts } from '../../data/heroData.js';
import { oreMaxValues } from '../../data/oreConversionData.js';
import { toCamelCase } from '../../utils/stringUtils.js';
import { translate } from '../../i18n/translator.js';

import { getGlobalPriorityList, getStepOrderErrors } from '../planner/priorityListModal.js';

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
    const tipIcon = dom.income.prospector.tip?.icon;
    const tipText = dom.income.prospector.tip?.text;
    if (!tipContainer || !tipText || !tipIcon) return;

    if (!state.income.prospector.goldPass) {
        tipContainer.style.display = 'none';
        return;
    }

    const { globalPriorityList } = getGlobalPriorityList();
    if (!globalPriorityList || globalPriorityList.length === 0) {
        tipIcon.innerHTML = getSVG('suggestion', '', 24, 24, 'currentColor');
        tipText.innerHTML = `<p>${translate('income.prospector.tips.addToPlanner')}</p>`;
        tipContainer.style.display = 'block';
        return;
    }

    const firstItem = globalPriorityList[0];
    const { errorItems } = getStepOrderErrors(globalPriorityList);
    const itemKey = `${firstItem.name}-${firstItem.step}`;
    const hasOrderError = errorItems.has(itemKey);

    if (firstItem.error || hasOrderError) {
        tipIcon.innerHTML = getSVG('error', '', 24, 24, 'currentColor');
        tipText.innerHTML = `<p><b>${translate('equipment.' + toCamelCase(firstItem.name))}</b>: ${translate('planner.orderError')}</p>`;
        tipContainer.style.display = 'block';
        return;
    }

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
        shiny: Math.max(0, req.shiny - (state.storedOres.shiny || 0)),
        glowy: Math.max(0, req.glowy - (state.storedOres.glowy || 0)),
        starry: Math.max(0, req.starry - (state.storedOres.starry || 0))
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

    const itemName = translate('equipment.' + toCamelCase(firstItem.name)) || firstItem.name;
    const bottleneckTrans = translate('ores.' + bottleneck) || bottleneck;
    const sourceTrans = translate('ores.' + source) || source;
    const toLevelTrans = translate('planner.toLevel', { level: firstItem.targetLevel });
    const upgradeInfo = `<b>${itemName}</b> ${toLevelTrans}`;

    let iconId = 'suggestion';
    let textContent = '';

    // Check if current setting is "Close enough" to optimal
    const isOptimal = (currentAmount === 0 && optimalN === 0) || 
                      (currentTo === bottleneck && currentFrom === source && Math.abs(currentAmount - optimalN) < step);

    if (isOptimal) {
        iconId = 'check';
        const activeRate = (currentTo === bottleneck && currentFrom === source) ? currentAmount : 0;
        const balancedDays = Math.ceil(missing[source] / (baseIncome[source] - activeRate));
        textContent = `<p>${translate('income.prospector.tips.optimal')}</p><p>${translate('income.prospector.tips.balanced', { upgradeInfo })}</p><p>${translate('income.prospector.tips.readyIn', { days: balancedDays })}</p>`;
    } else if (currentTo !== bottleneck && currentAmount > 0) {
        iconId = 'suggestion';
        textContent = `<p>${translate('income.prospector.tips.primaryBottleneck', { upgradeInfo, bottleneck: bottleneckTrans })}</p><p>${translate('income.prospector.tips.changeTarget')}</p>`;
    } else if (currentTo === bottleneck && currentFrom === source && currentAmount > optimalN) {
        iconId = 'warning';
        const recText = optimalN > 0 ? `~<b>${optimalN}</b>` : translate('income.prospector.tips.disableConversion');
        textContent = `<p>${translate('income.prospector.tips.overConverting')}</p><p>${translate('income.prospector.tips.newBottleneck', { upgradeInfo, source: sourceTrans })}</p><p>${translate('income.prospector.tips.reduceConversion', { recText })}</p>`;
    } else {
        iconId = 'suggestion';
        const recText = optimalN > 0 ? `~<b>${optimalN}</b>` : translate('income.prospector.tips.noConversionNeeded');
        textContent = `<p>${translate('income.prospector.tips.finishFaster', { upgradeInfo, source: sourceTrans, bottleneck: bottleneckTrans })}</p><p>${translate('income.prospector.tips.recommended', { recText })}</p>`;
    }

    const otherOre = ['shiny', 'glowy', 'starry'].find(o => o !== source && o !== bottleneck);
    if (days[otherOre] > naturalMaxDays) {
        const otherTrans = translate('ores.' + otherOre) || otherOre;
        textContent += `<small>${translate('income.prospector.tips.slowestResource', { other: otherTrans })}</small>`;
    }

    tipIcon.innerHTML = getSVG(iconId, '', 20, 20, 'currentColor');
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
        prospectorRow.resource.textContent = translate('income.prospector.goldPass');
    } else {
        prospectorRow.resource.textContent = translate('income.prospector.silverPass');
    }
}