import { oreMaxValues } from '../../data/oreConversionData.js';
import { translate } from '../../i18n/translator.js';

import { getLanguageFromPath } from '../../core/languageRouter.js';
import { calculateRequiredOres } from '../../core/oreCalculator.js';
import { selectDerivedSourceIncome } from '../../core/selectors.js';
import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { convertOres, findOptimalConversionSchedule, getBaseIncome, getStepValue, getUpgradeRequirements } from '../../domain/income/prospectorManager.js';
import { formatNumber, updateCalculatedValue } from '../../utils/numberFormatter.js';
import { getDailyIncomeFromCalendar } from '../../utils/predictionCalculator.js';
import { toCamelCase } from '../../utils/stringUtils.js';
import { getSVG } from '../../utils/svgManager.js';

import { getGlobalPriorityList, getStepOrderErrors } from '../planner/priorityListScheduler.js';
import { dom } from '../../dom/domElements.js';

// Session-only toggle for when the planner list is empty. Never persisted to state,
// so it always resets to false (= show global) on page reload.
let _emptyPlannerSessionToggle = false;

/**
 * Renders Prospector daily and monthly calculated ore income and recommendation tips.
 * @param {import('../../core/types.js').IncomeResult} prospectorIncome - Calculated Prospector conversion income results.
 */
export function renderProspectorIncomeDisplay(prospectorIncome) {
    const dailyValues = prospectorIncome.daily || { shiny: 0, glowy: 0, starry: 0 };
    const monthlyValues = prospectorIncome.monthly || { shiny: 0, glowy: 0, starry: 0 };

    updateCalculatedValue(dom.income.prospector.display.daily.shiny, dailyValues.shiny);
    updateCalculatedValue(dom.income.prospector.display.daily.glowy, dailyValues.glowy);
    updateCalculatedValue(dom.income.prospector.display.daily.starry, dailyValues.starry);

    updateCalculatedValue(dom.income.prospector.display.monthly.shiny, monthlyValues.shiny);
    updateCalculatedValue(dom.income.prospector.display.monthly.glowy, monthlyValues.glowy);
    updateCalculatedValue(dom.income.prospector.display.monthly.starry, monthlyValues.starry);

    updateProspectorTip();
}

function getAllUnfinishedUpgradeRequirements() {
    return calculateRequiredOres(state.heroes, { shiny: 0, glowy: 0, starry: 0 }, state.planner);
}

function generateRecommendationHtml(title, req, stored, baseIncome, isActualDays = false, subTitleInfo = '', itemImage = '', cardType = '') {
    const missing = {
        shiny: Math.max(0, req.shiny - stored.shiny),
        glowy: Math.max(0, req.glowy - stored.glowy),
        starry: Math.max(0, req.starry - stored.starry)
    };

    const infoKey = cardType === 'next' ? 'views.income.prospector.nextUpgradeHelp' : 'views.income.prospector.strategyModeHelp';
    const infoBtnHtml = `<button class="info-btn" data-info="${infoKey}" aria-label="Show Information" data-i18n-aria-label="actions.showInfo"><orecalc-assets-svg name="info" class="info-icon" height="16" width="16"></orecalc-assets-svg></button>`;

    if (missing.shiny === 0 && missing.glowy === 0 && missing.starry === 0) {
        return `
            <div class="prospector-rec-section" data-card-type="${cardType}">
                <div class="prospector-rec-header">
                    <span class="prospector-rec-badge">
                        ${itemImage
                            ? `<orecalc-assets-image src="${itemImage}" alt="${title}" class="prospector-rec-icon" size="thumbnail"></orecalc-assets-image>`
                            : getSVG('suggestion', 'prospector-rec-icon', 20, 20, 'currentColor')}
                        ${subTitleInfo ? `<span class="prospector-upgrade-subtitle">${subTitleInfo}</span>` : `<span>${title}</span>`}
                        ${infoBtnHtml}
                    </span>
                    <span class="prospector-rec-time"><span style="color:var(--color-success);">${translate('views.planner.completed')}</span></span>
                </div>
                <div class="prospector-rec-empty">
                    <span>✓ ${translate('views.income.prospector.tips.optimal')}</span>
                </div>
            </div>
        `;
    }

    const opt = findOptimalConversionSchedule(req, stored, baseIncome);

    let timeText = '';
    if (opt.completionDays === Infinity) {
        timeText = `<span>${translate('views.planner.infinity')}</span>`;
    } else {
        const roundedOptimal = Math.ceil(opt.completionDays);
        let maxNatural = 0;
        for (const ore of ['shiny', 'glowy', 'starry']) {
            if (opt.naturalDays && opt.naturalDays[ore] > maxNatural) {
                maxNatural = opt.naturalDays[ore];
            }
        }
        const roundedNatural = maxNatural === Infinity ? Infinity : Math.ceil(maxNatural);
        const daysLabel = translate('time.daysSuffix');

        if (roundedNatural > roundedOptimal) {
            const naturalText = roundedNatural === Infinity ? '∞' : `${roundedNatural}${daysLabel}`;
            const displayVal = `${naturalText} ➔ ${roundedOptimal}`;
            timeText = `${translate('views.income.prospector.tips.readyIn', { days: displayVal })}`.replace('~', '');
        } else {
            timeText = `${translate('views.income.prospector.tips.readyIn', { days: roundedOptimal })}`.replace('~', '');
        }
    }

    let listHtml = '';
    if (opt.conversions.length === 0) {
        listHtml = `
            <div class="prospector-rec-empty">
                <span style="color:var(--color-success);">✓</span> <span>${translate('views.income.prospector.tips.noConversionNeeded')}</span>
            </div>
        `;
    } else {
        listHtml = '<ul class="prospector-rec-list">';
        for (const conv of opt.conversions) {
            const fromName = translate('entities.ores.' + conv.from);
            const toName = translate('entities.ores.' + conv.to);
            const fromRate = oreMaxValues[conv.from];
            const toRate = convertOres(conv.from, conv.to, fromRate);

            const fromImg = `assets/${conv.from}_ore.png`;
            const toImg = `assets/${conv.to}_ore.png`;

            const flowText = `<span>${formatNumber(fromRate)} <orecalc-assets-image src="${fromImg}" alt="${fromName}" size="thumbnail"></orecalc-assets-image></span> ➔ <span>${formatNumber(toRate)} <orecalc-assets-image src="${toImg}" alt="${toName}" size="thumbnail"></orecalc-assets-image></span>`;
            const daysLabel = translate('time.daysSuffix');

            let displayDays = conv.days;
            if (isActualDays && opt.completionDays !== Infinity) {
                displayDays = Math.max(1, Math.round(opt.completionDays * conv.days / 30));
            }

            listHtml += `
                <li class="prospector-rec-item">
                    <span class="day-count">${displayDays}${daysLabel}</span>
                    <div class="conversion-flow">${flowText}</div>
                </li>
            `;
        }
        listHtml += '</ul>';
    }

    return `
        <div class="prospector-rec-section" data-card-type="${cardType}">
            <div class="prospector-rec-header">
                <span class="prospector-rec-badge">
                    ${itemImage
                        ? `<orecalc-assets-image src="${itemImage}" alt="${title}" class="prospector-rec-icon" size="thumbnail"></orecalc-assets-image>`
                        : getSVG('suggestion', 'prospector-rec-icon', 20, 20, 'currentColor')}
                    ${subTitleInfo ? `<span class="prospector-upgrade-subtitle">${subTitleInfo}</span>` : `<span>${title}</span>`}
                    ${infoBtnHtml}
                </span>
                <span class="prospector-rec-time">${timeText}</span>
            </div>
            ${listHtml}
        </div>
    `;
}

function updateProspectorTip() {
    const tipContainer = dom.income.prospector.tip?.container;
    if (!tipContainer) return;

    const goldPass = state.income.prospector?.goldPass || false;
    const assistedConversion = state.income.prospector?.assistedConversion !== undefined
        ? state.income.prospector.assistedConversion
        : true;

    if (!goldPass || !assistedConversion) {
        tipContainer.classList.remove('show');
        return;
    }

    const { globalPriorityList } = getGlobalPriorityList();
    const isPriorityListEmpty = !globalPriorityList || globalPriorityList.length === 0;

    // When the list is non-empty, clear the session toggle so it doesn't linger.
    if (!isPriorityListEmpty) _emptyPlannerSessionToggle = false;

    let firstItem = null;
    let hasOrderError = false;
    let errorItems = new Set();

    if (!isPriorityListEmpty) {
        firstItem = globalPriorityList[0];
        const errorsResult = getStepOrderErrors(globalPriorityList);
        errorItems = errorsResult.errorItems;
        const itemKey = `${firstItem.name}-${firstItem.step}`;
        hasOrderError = errorItems.has(itemKey);

        if (firstItem.error || hasOrderError) {
            const errName = translate('entities.equipment.' + toCamelCase(firstItem.name));
            tipContainer.innerHTML = `
                <div class="prospector-rec-container">
                    <div class="prospector-rec-section" style="border-color: var(--color-error);" data-card-type="error">
                        <div class="prospector-rec-header">
                            <span class="prospector-rec-badge" style="color: var(--color-error);">
                                ${getSVG('error', 'prospector-rec-icon', 20, 20, 'currentColor')}
                                <span><b>${errName}</b>: ${translate('views.planner.orderError')}</span>
                            </span>
                        </div>
                    </div>
                </div>
            `;
            tipContainer.classList.add('show');
            return;
        }
    }

    // Bind strategy mode toggling click listener once
    if (!tipContainer.dataset.listenerAttached) {
        tipContainer.addEventListener('click', (e) => {
            if (e.target.closest('.info-btn, .info-button, [data-info]')) return;
            const badge = e.target.closest('.prospector-rec-badge');
            if (badge) {
                const section = badge.closest('.prospector-rec-section');
                if (section && section.dataset.cardType === 'overall') {
                    const listObj = getGlobalPriorityList();
                    const listEmpty = !listObj.globalPriorityList || listObj.globalPriorityList.length === 0;
                    if (listEmpty) {
                        // Session-only toggle — never saved to state so reload always resets to global
                        _emptyPlannerSessionToggle = !_emptyPlannerSessionToggle;
                        updateProspectorTip();
                    } else {
                        const currentMode = state.income.prospector?.strategyMode !== undefined ? state.income.prospector.strategyMode : 1;
                        const nextMode = currentMode === 0 ? 1 : 0;
                        handleStateUpdate(() => {
                            state.income.prospector.strategyMode = nextMode;
                        });
                    }
                }
            }
        });
        tipContainer.dataset.listenerAttached = 'true';
    }

    // When list is empty: use session-only toggle (defaults to global on every reload).
    // When list has items: use persisted strategyMode (defaults to planner).
    const mode = isPriorityListEmpty
        ? (_emptyPlannerSessionToggle ? 1 : 0)
        : (state.income.prospector?.strategyMode !== undefined ? state.income.prospector.strategyMode : 1);

    const stored = {
        shiny: parseFloat(String(state.storedOres?.shiny || 0)) || 0,
        glowy: parseFloat(String(state.storedOres?.glowy || 0)) || 0,
        starry: parseFloat(String(state.storedOres?.starry || 0)) || 0
    };

    const baseIncome = getBaseIncome(state);

    let nextHtml = '';

    if (isPriorityListEmpty) {
        nextHtml = `
            <div class="prospector-rec-section" data-card-type="next">
                <div class="prospector-rec-header">
                    <span class="prospector-rec-badge">
                        ${getSVG('suggestion', 'prospector-rec-icon', 20, 20, 'currentColor')}
                        <span>${translate('views.income.prospector.tips.nextTitle')}</span>
                        <button class="info-btn" data-info="views.income.prospector.nextUpgradeHelp" aria-label="Show Information" data-i18n-aria-label="actions.showInfo">
                            <orecalc-assets-svg name="info" class="info-icon" height="16" width="16"></orecalc-assets-svg>
                        </button>
                    </span>
                </div>
                <div class="prospector-rec-empty">
                    <span>${translate('views.income.prospector.tips.addToPlanner.pre')}<button class="prospector-priority-link" id="prospector-go-to-priority-list">${translate('views.income.prospector.tips.addToPlanner.link')}</button>${translate('views.income.prospector.tips.addToPlanner.post')}</span>
                </div>
            </div>
        `;
    } else {
        const nextReq = getUpgradeRequirements(globalPriorityList, true, state);
        const itemName = translate('entities.equipment.' + toCamelCase(firstItem.name));
        const currentLevel = state.heroes[firstItem.heroName]?.equipment[firstItem.name]?.level || 1;
        const subTitleNext = `<span class="upgrade-levels">${currentLevel} ➔ ${firstItem.targetLevel}</span>`;

        nextHtml = generateRecommendationHtml(
            translate('views.income.prospector.tips.nextTitle'),
            nextReq,
            stored,
            baseIncome,
            true,
            subTitleNext,
            firstItem.image,
            'next'
        );
    }

    let overallHtml = '';
    if (mode === 0) {
        const overallReq = getAllUnfinishedUpgradeRequirements();
        overallHtml = generateRecommendationHtml(
            translate('views.income.prospector.tips.universalTitle'),
            overallReq,
            stored,
            baseIncome,
            false,
            '',
            '',
            'overall'
        );
    } else {
        if (isPriorityListEmpty) {
            overallHtml = `
                <div class="prospector-rec-section" data-card-type="overall">
                    <div class="prospector-rec-header">
                        <span class="prospector-rec-badge">
                            ${getSVG('suggestion', 'prospector-rec-icon', 20, 20, 'currentColor')}
                            <span>${translate('views.income.prospector.tips.plannerTitle')}</span>
                            <button class="info-btn" data-info="views.income.prospector.strategyModeHelp" aria-label="Show Information" data-i18n-aria-label="actions.showInfo">
                                <orecalc-assets-svg name="info" class="info-icon" height="16" width="16"></orecalc-assets-svg>
                            </button>
                        </span>
                    </div>
                    <div class="prospector-rec-empty">
                        <span>${translate('views.income.prospector.tips.addToPlanner.pre')}<button class="prospector-priority-link" id="prospector-go-to-priority-list-planner">${translate('views.income.prospector.tips.addToPlanner.link')}</button>${translate('views.income.prospector.tips.addToPlanner.post')}</span>
                    </div>
                </div>
            `;
        } else {
            const overallReq = getUpgradeRequirements(globalPriorityList, false, state);
            overallHtml = generateRecommendationHtml(
                translate('views.income.prospector.tips.plannerTitle'),
                overallReq,
                stored,
                baseIncome,
                false,
                '',
                '',
                'overall'
            );
        }
    }

    tipContainer.innerHTML = `
        <div class="prospector-rec-container">
            ${nextHtml}
            ${overallHtml}
        </div>
    `;
    tipContainer.classList.add('show');
}

/**
 * Computes recommended daily conversion amounts based on active planner priorities.
 * @param {string} fromOre - Source ore type ('shiny' | 'glowy').
 * @param {string} toOre - Target converted ore type ('glowy' | 'starry').
 * @returns {{ preferred: number, fallback: number, exceeds: boolean }} Object containing preferred and fallback amounts.
 */
export function getRecommendedProspectorAmounts(fromOre, toOre) {
    const { globalPriorityList } = getGlobalPriorityList();
    const isPriorityListEmpty = !globalPriorityList || globalPriorityList.length === 0;
    // Mirror the same session-only toggle logic used in updateProspectorTip
    const mode = isPriorityListEmpty
        ? (_emptyPlannerSessionToggle ? 1 : 0)
        : (state.income.prospector?.strategyMode !== undefined ? state.income.prospector.strategyMode : 1);

    let req;
    if (mode === 0) {
        req = getAllUnfinishedUpgradeRequirements();
    } else {
        req = getUpgradeRequirements(globalPriorityList, false, state);
    }

    const stored = {
        shiny: parseFloat(String(state.storedOres?.shiny || 0)) || 0,
        glowy: parseFloat(String(state.storedOres?.glowy || 0)) || 0,
        starry: parseFloat(String(state.storedOres?.starry || 0)) || 0
    };

    const baseIncome = getBaseIncome(state);

    const missing = {
        shiny: Math.max(0, req.shiny - stored.shiny),
        glowy: Math.max(0, req.glowy - stored.glowy),
        starry: Math.max(0, req.starry - stored.starry)
    };

    const conversionFactor = convertOres(fromOre, toOre, 1000) / 1000;
    const num = (missing[toOre] * baseIncome[fromOre]) - (missing[fromOre] * baseIncome[toOre]);
    const den = (conversionFactor * missing[fromOre]) + missing[toOre];

    if (den <= 0 || num <= 0) {
        return { preferred: 0, fallback: 0, exceeds: false };
    }

    const rawN = num / den;
    const step = getStepValue(fromOre, toOre);
    let preferred = Math.round(rawN / step) * step;

    // Preferred is capped by maximum conversion limit (e.g. 2000 shiny)
    const dailyLimit = oreMaxValues[fromOre];
    preferred = Math.max(0, Math.min(preferred, dailyLimit));

    const incomeLimit = baseIncome[fromOre];
    const fallback = Math.max(0, Math.min(preferred, incomeLimit));

    const exceeds = preferred > incomeLimit + 1e-3;

    return { preferred, fallback, exceeds };
}
