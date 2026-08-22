import { translate } from '../../i18n/translator.js';

import {
    computeEffectiveLevels,
    formatDiffVal,
    isStatModifiable,
    MODIFIER_HERO_BOOST_MULTIPLIERS
} from '../../domain/equipment/modifierCalculator.js';
import { animateValue } from '../../utils/numberFormatter.js';

/**
 * Generates map of current stat values and progress percentages for mode interpolation.
 *
 * @param {Object} data
 * @param {Array<any>} levelsArray
 * @param {number} currentLevel
 * @param {number} calculatedMaxLevel
 * @param {string} equipmentRarity
 * @param {string} activeModifierTab
 * @returns {Record<string, {numVal: number | string, pct: number}>}
 */
export function getCurrentStatsStateMap(data, levelsArray, currentLevel, calculatedMaxLevel, equipmentRarity, activeModifierTab) {
    const map = {};
    if (data?.statsMeta && levelsArray.length > 0) {
        const effective = computeEffectiveLevels(currentLevel, calculatedMaxLevel, data.rarity || equipmentRarity, activeModifierTab);
        const activeLevelObj = levelsArray[effective.effectiveLevel - 1] || levelsArray[0];
        const trueMaxLevelObj = levelsArray[calculatedMaxLevel - 1] || levelsArray.at(-1);

        data.statsMeta.forEach((meta, idx) => {
            const getStatValue = (obj) => {
                if (!obj) return 0;
                if (Array.isArray(obj)) return obj[idx];
                const raw = obj.stats ? obj.stats[meta.key] : obj[meta.key];
                return typeof raw === 'object' ? raw.value : raw;
            };

            const rawNumVal = getStatValue(activeLevelObj);
            const rawTrueMaxVal = getStatValue(trueMaxLevelObj) || rawNumVal || 1;
            const isMod = isStatModifiable(meta);
            const multiplier = isMod ? (MODIFIER_HERO_BOOST_MULTIPLIERS[activeModifierTab] || 1.00) : 1.00;
            const baseNumVal = (typeof rawNumVal === 'number') ? Math.round(rawNumVal * multiplier * 100) / 100 : rawNumVal;
            const maxVal = (typeof rawTrueMaxVal === 'number' && rawTrueMaxVal > 0) ? rawTrueMaxVal : 1;
            const basePct = Math.min(100, Math.max(0, Math.round(((typeof baseNumVal === 'number' ? baseNumVal : 0) / maxVal) * 100)));
            map[meta.key] = { numVal: baseNumVal, pct: basePct };
        });
    }
    return map;
}

/**
 * Renders main equipment stats progress bars.
 *
 * @param {HTMLElement | null} statsProgressList
 * @param {Object} data
 * @param {Array<any>} levelsArray
 * @param {number} currentLevel
 * @param {number} calculatedMaxLevel
 * @param {string} equipmentRarity
 * @param {string} activeModifierTab
 * @param {boolean} [animateEntry=false]
 * @param {Record<string, any> | null} [previousModeMap=null]
 */
export function renderStatsProgressList(statsProgressList, data, levelsArray, currentLevel, calculatedMaxLevel, equipmentRarity, activeModifierTab, animateEntry = false, previousModeMap = null) {
    if (!statsProgressList) return;

    if (!data?.statsMeta || levelsArray.length === 0) {
        const metaList = (data?.statsMeta && data.statsMeta.length > 0) ? data.statsMeta : null;
        let barsHTML = '';
        if (metaList) {
            barsHTML = metaList.map(meta => {
                const statLabel = translate(`entities.stats.${meta.key}`);
                return `
                    <div class="stat-progress-row">
                        <div class="stat-label-line">
                            <span class="stat-name" title="${statLabel}"><span class="stat-name-text">${statLabel}</span></span>
                            <span class="stat-val"><span class="stat-val-number">-</span></span>
                        </div>
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill" style="width: 0%;"></div>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            const notAvailableLabel = translate('views.equipment.dataNotAvailable');
            for (let i = 0; i < 3; i++) {
                barsHTML += `
                    <div class="stat-progress-row">
                        <div class="stat-label-line">
                            <span class="stat-name" title="${notAvailableLabel}"><span class="stat-name-text">${notAvailableLabel}</span></span>
                            <span class="stat-val"><span class="stat-val-number">-</span></span>
                        </div>
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill" style="width: 0%;"></div>
                        </div>
                    </div>
                `;
            }
        }
        statsProgressList.innerHTML = barsHTML;
        return;
    }

    const effective = computeEffectiveLevels(currentLevel, calculatedMaxLevel, data.rarity || equipmentRarity, activeModifierTab);
    const activeLevelObj = levelsArray[effective.effectiveLevel - 1] || levelsArray[0];
    const standardLevelObj = levelsArray[currentLevel - 1] || levelsArray[0];
    const trueMaxLevelObj = levelsArray[calculatedMaxLevel - 1] || levelsArray.at(-1);

    statsProgressList.innerHTML = data.statsMeta.map((meta, idx) => {
        const getStatValue = (obj) => {
            if (!obj) return 0;
            if (Array.isArray(obj)) return obj[idx];
            const raw = obj.stats ? obj.stats[meta.key] : obj[meta.key];
            return typeof raw === 'object' ? raw.value : raw;
        };

        const rawNumVal = getStatValue(activeLevelObj);
        const rawStandardNumVal = getStatValue(standardLevelObj);
        const rawTrueMaxVal = getStatValue(trueMaxLevelObj) || rawNumVal || 1;
        const isMod = isStatModifiable(meta);
        const multiplier = isMod ? (MODIFIER_HERO_BOOST_MULTIPLIERS[activeModifierTab] || 1.00) : 1.00;

        const baseNumVal = (typeof rawNumVal === 'number') ? Math.round(rawNumVal * multiplier * 100) / 100 : rawNumVal;
        const standardNumVal = (typeof rawStandardNumVal === 'number') ? rawStandardNumVal : rawStandardNumVal;
        const maxVal = (typeof rawTrueMaxVal === 'number' && rawTrueMaxVal > 0) ? rawTrueMaxVal : 1;

        const statLabel = translate(`entities.stats.${meta.key}`);
        const formatVal = (v, vUnit) => {
            if (v === undefined || v === null) return '-';
            if (typeof v !== 'number') return String(v);
            const isInt = Number.isInteger(v);
            const numStr = isInt ? Math.round(v).toLocaleString() : (Math.round(v * 100) / 100).toLocaleString();
            if (vUnit === 'percentage' || vUnit === 'percent') return `${numStr}%`;
            if (vUnit === 'seconds') return `${numStr}s`;
            if (vUnit === 'tiles') return `${numStr} tiles`;
            return numStr;
        };

        const basePct = Math.min(100, Math.max(0, Math.round(((typeof baseNumVal === 'number' ? baseNumVal : 0) / (typeof maxVal === 'number' ? maxVal : 1)) * 100)));
        const prevModeData = previousModeMap ? previousModeMap[meta.key] : null;
        const isModeAnim = prevModeData && typeof prevModeData.numVal === 'number';

        const startVal = isModeAnim ? prevModeData.numVal : (animateEntry ? 0 : baseNumVal);
        const startPct = isModeAnim ? prevModeData.pct : (animateEntry ? 0 : basePct);

        const initialWidth = (animateEntry || isModeAnim) ? startPct : basePct;
        const initialValDisplay = (animateEntry || isModeAnim) ? formatVal(startVal, meta.valueUnit) : formatVal(baseNumVal, meta.valueUnit);

        const isModified = typeof baseNumVal === 'number' && typeof standardNumVal === 'number'
            ? baseNumVal !== standardNumVal
            : String(baseNumVal) !== String(standardNumVal);
        const modifiedClass = isModified ? 'stat-val-modified' : '';

        return `
            <div class="stat-progress-row" data-stat-idx="${idx}">
                <div class="stat-label-line">
                    <span class="stat-name" title="${statLabel}"><span class="stat-name-text" data-i18n="entities.stats.${meta.key}">${statLabel}</span></span>
                    <span class="stat-val"><span class="stat-val-number ${modifiedClass}" data-start-val="${startVal}" data-target-val="${baseNumVal}">${initialValDisplay}</span></span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill ${(animateEntry || isModeAnim) ? 'is-initial-animating' : ''}" data-target-width="${basePct}" style="width: ${initialWidth}%;"></div>
                    <div class="progress-bar-increase ${(animateEntry || isModeAnim) ? 'is-initial-animating' : ''}" data-target-width="${basePct}" style="width: ${initialWidth}%;"></div>
                    <div class="progress-bar-decrease ${(animateEntry || isModeAnim) ? 'is-initial-animating' : ''}" data-target-width="${basePct}" style="width: ${initialWidth}%;"></div>
                </div>
            </div>
        `;
    }).join('');

    if (animateEntry || previousModeMap) {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                statsProgressList.querySelectorAll('.progress-bar-fill, .progress-bar-increase, .progress-bar-decrease').forEach((bar) => {
                    const targetWidth = bar.getAttribute('data-target-width');
                    if (targetWidth !== null) {
                        /** @type {HTMLElement} */ (bar).style.width = `${targetWidth}%`;
                    }
                });

                statsProgressList.querySelectorAll('.stat-progress-row').forEach((row, idx) => {
                    const meta = data.statsMeta[idx];
                    if (!meta) return;
                    const numSpan = row.querySelector('.stat-val-number');
                    if (numSpan) {
                        const startVal = parseFloat(numSpan.getAttribute('data-start-val') || '0');
                        const targetVal = parseFloat(numSpan.getAttribute('data-target-val') || '0');
                        if (!isNaN(startVal) && !isNaN(targetVal) && startVal !== targetVal) {
                            const isIntStat = Number.isInteger(startVal) && Number.isInteger(targetVal);
                            const formatAnimValue = (v, vUnit) => {
                                if (v === undefined || v === null) return '-';
                                if (typeof v !== 'number') return String(v);
                                if (vUnit === 'seconds' || vUnit === 'tiles') {
                                    const num = Math.round(v * 10) / 10;
                                    return `${num.toLocaleString()}${vUnit === 'seconds' ? 's' : ' tiles'}`;
                                }
                                const isInt = isIntStat || Number.isInteger(v);
                                const num = isInt ? Math.round(v) : (Math.round(v * 10) / 10);
                                if (vUnit === 'percentage' || vUnit === 'percent') return `${num.toLocaleString()}%`;
                                return num.toLocaleString();
                            };
                            const delta = Math.abs(targetVal - startVal);
                            const animDuration = Math.min(450, Math.max(150, Math.round(Math.log10(delta + 1) * 160)));
                            animateValue(numSpan, startVal, targetVal, animDuration, (v) => formatAnimValue(v, meta.valueUnit));
                        }
                    }
                });
            });
        });
    }
}

/**
 * Updates stats progress bars and numbers during table row hover for live diff comparison.
 *
 * @param {HTMLElement | null} statsProgressList
 * @param {Object} data
 * @param {Array<any>} levelsArray
 * @param {number} currentLevel
 * @param {number} calculatedMaxLevel
 * @param {string} equipmentRarity
 * @param {string} activeModifierTab
 * @param {number | null} hoverLevel
 */
export function updateStatsProgressHover(statsProgressList, data, levelsArray, currentLevel, calculatedMaxLevel, equipmentRarity, activeModifierTab, hoverLevel) {
    if (!statsProgressList || !data?.statsMeta || levelsArray.length === 0) return;

    if (!/** @type {any} */ (statsProgressList).__lastHoveredValues) {
        /** @type {any} */ (statsProgressList).__lastHoveredValues = {};
    }

    const effective = computeEffectiveLevels(currentLevel, calculatedMaxLevel, data.rarity || equipmentRarity, activeModifierTab);
    const activeLevelObj = levelsArray[effective.effectiveLevel - 1] || levelsArray[0];
    const standardLevelObj = levelsArray[currentLevel - 1] || levelsArray[0];
    const trueMaxLevelObj = levelsArray[calculatedMaxLevel - 1] || levelsArray.at(-1);

    let hoverLevelObj = null;
    if (hoverLevel !== null && hoverLevel >= 1 && hoverLevel <= levelsArray.length) {
        const clampedHoverLevel = Math.min(hoverLevel, effective.effectiveMaxLevel);
        hoverLevelObj = levelsArray[clampedHoverLevel - 1] || activeLevelObj;
    } else {
        /** @type {any} */ (statsProgressList).__lastHoveredValues = {};
    }

    const rowElements = statsProgressList.querySelectorAll('.stat-progress-row');

    data.statsMeta.forEach((meta, idx) => {
        const rowEl = rowElements[idx];
        if (!rowEl) return;

        const getStatValue = (obj) => {
            if (!obj) return 0;
            if (Array.isArray(obj)) return obj[idx];
            const raw = obj.stats ? obj.stats[meta.key] : obj[meta.key];
            return typeof raw === 'object' ? raw.value : raw;
        };

        const rawNumVal = getStatValue(activeLevelObj);
        const rawTrueMaxVal = getStatValue(trueMaxLevelObj) || rawNumVal || 1;
        const isMod = isStatModifiable(meta);
        const multiplier = isMod ? (MODIFIER_HERO_BOOST_MULTIPLIERS[activeModifierTab] || 1.00) : 1.00;

        const baseNumVal = (typeof rawNumVal === 'number') ? Math.round(rawNumVal * multiplier * 100) / 100 : rawNumVal;
        const maxVal = (typeof rawTrueMaxVal === 'number' && rawTrueMaxVal > 0) ? rawTrueMaxVal : 1;

        const formatVal = (v, vUnit) => {
            if (v === undefined || v === null) return '-';
            if (typeof v !== 'number') return String(v);
            if (vUnit === 'seconds' || vUnit === 'tiles') {
                const num = Math.round(v * 10) / 10;
                return `${num.toLocaleString()}${vUnit === 'seconds' ? 's' : ' tiles'}`;
            }
            const isInt = Number.isInteger(v);
            const numStr = isInt ? Math.round(v).toLocaleString() : (Math.round(v * 10) / 10).toLocaleString();
            if (vUnit === 'percentage' || vUnit === 'percent') return `${numStr}%`;
            return numStr;
        };

        const isLowerBetter = meta.deltaType === 'decrease' || meta.lowerIsBetter === true || meta.key.toLowerCase().includes('cooldown');
        const basePct = Math.min(100, Math.max(0, Math.round(((typeof baseNumVal === 'number' ? baseNumVal : 0) / (typeof maxVal === 'number' ? maxVal : 1)) * 100)));

        let mainWidth = basePct;
        let increaseWidth = basePct;
        let decreaseWidth = basePct;
        let isComparing = false;

        const rawStandardNumVal = getStatValue(standardLevelObj);
        const standardNumVal = (typeof rawStandardNumVal === 'number') ? rawStandardNumVal : rawStandardNumVal;

        const isModified = typeof baseNumVal === 'number' && typeof standardNumVal === 'number'
            ? baseNumVal !== standardNumVal
            : String(baseNumVal) !== String(standardNumVal);
        const modClass = isModified ? 'stat-val-modified' : '';

        if (hoverLevelObj && hoverLevelObj !== activeLevelObj) {
            const rawHoverVal = getStatValue(hoverLevelObj);
            const hoverNumVal = (typeof rawHoverVal === 'number') ? Math.round(rawHoverVal * multiplier * 100) / 100 : rawHoverVal;

            if (typeof baseNumVal === 'number' && typeof hoverNumVal === 'number' && typeof maxVal === 'number' && maxVal > 0) {
                const diff = Math.round((hoverNumVal - baseNumVal) * 100) / 100;
                const isSame = diff === 0;
                const isGain = isLowerBetter ? diff < 0 : diff > 0;
                const hoverPct = Math.min(100, Math.max(0, Math.round((hoverNumVal / maxVal) * 100)));

                isComparing = true;

                if (isSame) {
                    mainWidth = basePct;
                    increaseWidth = basePct;
                    decreaseWidth = basePct;
                } else if (isGain) {
                    if (isLowerBetter) {
                        mainWidth = hoverPct;
                        increaseWidth = hoverPct;
                        decreaseWidth = basePct;
                    } else {
                        mainWidth = basePct;
                        increaseWidth = hoverPct;
                        decreaseWidth = basePct;
                    }
                } else {
                    if (isLowerBetter) {
                        mainWidth = basePct;
                        increaseWidth = hoverPct;
                        decreaseWidth = hoverPct;
                    } else {
                        mainWidth = hoverPct;
                        increaseWidth = hoverPct;
                        decreaseWidth = basePct;
                    }
                }
            }
        }

        rowEl.classList.toggle('is-comparing', isComparing);
        const valEl = rowEl.querySelector('.stat-val');
        if (valEl) {
            if (isComparing && typeof baseNumVal === 'number' && hoverLevelObj) {
                const rawHoverVal = getStatValue(hoverLevelObj);
                const hoverNumVal = (typeof rawHoverVal === 'number') ? Math.round(rawHoverVal * multiplier * 100) / 100 : rawHoverVal;
                const diff = (typeof hoverNumVal === 'number') ? Math.round((hoverNumVal - baseNumVal) * 100) / 100 : 0;
                const diffSign = formatDiffVal(diff, meta.valueUnit);
                const formattedBase = formatVal(baseNumVal, meta.valueUnit);
                const formattedHover = formatVal(hoverNumVal, meta.valueUnit);

                const isSame = diff === 0;
                const isGain = isLowerBetter ? diff < 0 : diff > 0;
                const deltaTextClass = isGain ? 'val-increase' : (isSame ? '' : 'val-decrease');

                const prevHoverVal = /** @type {any} */ (statsProgressList).__lastHoveredValues[meta.key];
                const startVal = (prevHoverVal !== undefined && typeof prevHoverVal === 'number') ? prevHoverVal : baseNumVal;
                /** @type {any} */ (statsProgressList).__lastHoveredValues[meta.key] = hoverNumVal;

                const existingCompare = valEl.querySelector('.stat-val-compare');
                const existingHoverSpan = valEl.querySelector('.stat-val-hover');

                const isIntStat = Number.isInteger(startVal) && Number.isInteger(hoverNumVal);
                const formatAnimVal = (v, vUnit) => {
                    if (v === undefined || v === null) return '-';
                    if (typeof v !== 'number') return String(v);
                    if (vUnit === 'seconds' || vUnit === 'tiles') {
                        const num = Math.round(v * 10) / 10;
                        return `${num.toLocaleString()}${vUnit === 'seconds' ? 's' : ' tiles'}`;
                    }
                    const isInt = isIntStat || Number.isInteger(v);
                    const num = isInt ? Math.round(v) : (Math.round(v * 10) / 10);
                    if (vUnit === 'percentage' || vUnit === 'percent') return `${num.toLocaleString()}%`;
                    return num.toLocaleString();
                };

                if (!existingCompare) {
                    valEl.innerHTML = `
                        <span class="stat-val-compare">
                            <span class="stat-val-base ${modClass}">${formattedBase}</span>
                            <span class="stat-val-arrow">→</span>
                            <span class="stat-val-hover ${deltaTextClass}">${formattedHover} (${diffSign})</span>
                        </span>
                    `;
                    const newHoverSpan = valEl.querySelector('.stat-val-hover');
                    if (newHoverSpan && typeof hoverNumVal === 'number' && startVal !== hoverNumVal) {
                        const stepDelta = Math.abs(hoverNumVal - startVal);
                        const animDuration = Math.min(450, Math.max(150, Math.round(Math.log10(stepDelta + 1) * 160)));
                        animateValue(newHoverSpan, startVal, hoverNumVal, animDuration, (v) => `${formatAnimVal(v, meta.valueUnit)} (${diffSign})`);
                    }
                } else if (existingHoverSpan) {
                    existingHoverSpan.className = `stat-val-hover ${deltaTextClass}`;
                    if (typeof hoverNumVal === 'number' && startVal !== hoverNumVal) {
                        const stepDelta = Math.abs(hoverNumVal - startVal);
                        const animDuration = Math.min(450, Math.max(150, Math.round(Math.log10(stepDelta + 1) * 160)));
                        animateValue(existingHoverSpan, startVal, hoverNumVal, animDuration, (v) => `${formatAnimVal(v, meta.valueUnit)} (${diffSign})`);
                    }
                }
            } else {
                valEl.innerHTML = `<span class="stat-val-number ${modClass}">${formatVal(baseNumVal, meta.valueUnit)}</span>`;
            }
        }

        const fillEl = /** @type {HTMLElement | null} */ (rowEl.querySelector('.progress-bar-fill'));
        const incEl = /** @type {HTMLElement | null} */ (rowEl.querySelector('.progress-bar-increase'));
        const decEl = /** @type {HTMLElement | null} */ (rowEl.querySelector('.progress-bar-decrease'));

        if (fillEl) fillEl.style.width = `${mainWidth}%`;
        if (incEl) incEl.style.width = `${increaseWidth}%`;
        if (decEl) decEl.style.width = `${decreaseWidth}%`;
    });
}
