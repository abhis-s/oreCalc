import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';

import {
    computeEffectiveLevels,
    formatDiffVal,
    isStatModifiable
} from '../../domain/equipment/modifierCalculator.js';
import { animateValue } from '../../utils/numberFormatter.js';

/**
 * Returns map of spawned unit stat values and percentages for mode animation.
 *
 * @param {Object} data
 * @param {Array<any>} levelsArray
 * @param {number} currentLevel
 * @param {number} calculatedMaxLevel
 * @param {string} equipmentRarity
 * @param {string} activeModifierTab
 * @returns {Record<string, {numVal: number, pct: number}>}
 */
export function getCurrentUnitStatsStateMap(data, levelsArray, currentLevel, calculatedMaxLevel, equipmentRarity, activeModifierTab) {
    const map = {};
    if (data?.hasSpawnedUnits && data.spawnedUnits) {
        const sp = data.spawnedUnits;
        const effective = computeEffectiveLevels(currentLevel, calculatedMaxLevel, data.rarity || equipmentRarity, activeModifierTab);
        const targetLevel = effective.effectiveLevel;
        let unitLevel = targetLevel;

        if (sp.scalingType === 'laboratoryLevel') {
            const labTroops = state.playerProfile?.labTroops || {};
            const val = labTroops[sp.unitType];
            if (typeof val === 'number') unitLevel = val;
            else if (val && val.level) unitLevel = val.level;
            else {
                const availableLevels = Object.keys(sp.levels || {}).map(Number).sort((a, b) => a - b);
                unitLevel = availableLevels.length > 0 ? (availableLevels.at(-1) ?? 1) : 1;
            }
        } else {
            let summonedLevelIdx = -1;
            if (data.statsMeta) summonedLevelIdx = data.statsMeta.findIndex(m => m.key === 'summonedUnitsLevel');
            const levelObj = levelsArray[targetLevel - 1] || levelsArray[0];
            if (summonedLevelIdx !== -1 && Array.isArray(levelObj)) {
                unitLevel = levelObj[summonedLevelIdx] || targetLevel;
            } else if (levelObj && typeof levelObj === 'object') {
                unitLevel = levelObj.summonedUnitsLevel || targetLevel;
            }
        }

        const spLevelsMap = sp.levels || {};
        const unitStatValues = spLevelsMap[String(unitLevel)] || spLevelsMap[unitLevel] || [];
        const allSpLevels = Object.keys(spLevelsMap).map(Number).sort((a, b) => a - b);
        const maxSpLevel = allSpLevels.length > 0 ? (allSpLevels.at(-1) ?? unitLevel) : unitLevel;
        const maxUnitStatValues = spLevelsMap[String(maxSpLevel)] || unitStatValues;

        (sp.statsMeta || []).forEach((meta, idx) => {
            const numVal = Array.isArray(unitStatValues) ? unitStatValues[idx] : unitStatValues[meta.key];
            const maxVal = Array.isArray(maxUnitStatValues) ? maxUnitStatValues[idx] : maxUnitStatValues[meta.key];
            const safeNum = typeof numVal === 'number' ? numVal : 0;
            const safeMax = typeof maxVal === 'number' && maxVal > 0 ? maxVal : safeNum || 1;
            const pct = Math.min(100, Math.round((safeNum / safeMax) * 100));
            map[meta.key] = { numVal: safeNum, pct };
        });
    }
    return map;
}

/**
 * Renders unit stats (summoned units / spawners).
 *
 * @param {HTMLElement | null} unitStatsContent
 * @param {Object} data
 * @param {Array<any>} levelsArray
 * @param {number} currentLevel
 * @param {number} calculatedMaxLevel
 * @param {string} equipmentRarity
 * @param {string} activeModifierTab
 * @param {number} targetLevel
 * @param {boolean} [animateEntry=false]
 * @param {Record<string, any> | null} [previousUnitMap=null]
 */
export function renderUnitStatsView(unitStatsContent, data, levelsArray, currentLevel, calculatedMaxLevel, equipmentRarity, activeModifierTab, targetLevel, animateEntry = false, previousUnitMap = null) {
    if (!unitStatsContent || !data?.spawnedUnits) return;

    const effective = computeEffectiveLevels(currentLevel, calculatedMaxLevel, data.rarity || equipmentRarity, activeModifierTab);
    const sp = data.spawnedUnits;
    const unitTypeKey = sp.unitType;
    const translatedUnitName = translate(`entities.unitTypes.${unitTypeKey}`);

    let unitLevel = targetLevel;

    let standardUnitLevel = currentLevel;
    if (sp.scalingType === 'laboratoryLevel') {
        const labTroops = state.playerProfile?.labTroops || {};
        const val = labTroops[unitTypeKey];
        if (typeof val === 'number') {
            unitLevel = val;
        } else if (val && typeof val === 'object' && val.level) {
            unitLevel = val.level;
        } else {
            const availableLevels = Object.keys(sp.levels || {}).map(Number).sort((a, b) => a - b);
            unitLevel = availableLevels.length > 0 ? (availableLevels.at(-1) ?? 1) : 1;
        }
        standardUnitLevel = unitLevel;
    } else {
        let summonedLevelIdx = -1;
        if (data.statsMeta) {
            summonedLevelIdx = data.statsMeta.findIndex(m => m.key === 'summonedUnitsLevel');
        }

        const levelObj = levelsArray[targetLevel - 1] || levelsArray[0];
        const standardLevelObj = levelsArray[currentLevel - 1] || levelsArray[0];

        if (summonedLevelIdx !== -1 && Array.isArray(levelObj)) {
            unitLevel = levelObj[summonedLevelIdx] || targetLevel;
        } else if (levelObj && typeof levelObj === 'object') {
            unitLevel = levelObj.summonedUnitsLevel || targetLevel;
        }

        if (summonedLevelIdx !== -1 && Array.isArray(standardLevelObj)) {
            standardUnitLevel = standardLevelObj[summonedLevelIdx] || currentLevel;
        } else if (standardLevelObj && typeof standardLevelObj === 'object') {
            standardUnitLevel = standardLevelObj.summonedUnitsLevel || currentLevel;
        }
    }

    const spLevelsMap = sp.levels || {};
    const unitStatValues = spLevelsMap[String(unitLevel)] || spLevelsMap[unitLevel] || [];
    const standardUnitStatValues = spLevelsMap[String(standardUnitLevel)] || spLevelsMap[standardUnitLevel] || [];
    const allSpLevels = Object.keys(spLevelsMap).map(Number).sort((a, b) => a - b);
    const maxSpLevel = allSpLevels.length > 0 ? (allSpLevels.at(-1) ?? unitLevel) : unitLevel;
    const maxUnitStatValues = spLevelsMap[String(maxSpLevel)] || unitStatValues;

    const levelLabelText = translate('validation.level');

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

    const rowsHTML = (sp.statsMeta || []).map((meta, idx) => {
        const numVal = Array.isArray(unitStatValues) ? unitStatValues[idx] : unitStatValues[meta.key];
        const standardNumVal = Array.isArray(standardUnitStatValues) ? standardUnitStatValues[idx] : standardUnitStatValues[meta.key];
        const maxVal = Array.isArray(maxUnitStatValues) ? maxUnitStatValues[idx] : maxUnitStatValues[meta.key];
        const safeNum = typeof numVal === 'number' ? numVal : 0;
        const safeStandardNum = typeof standardNumVal === 'number' ? standardNumVal : 0;
        const safeMax = typeof maxVal === 'number' && maxVal > 0 ? maxVal : safeNum || 1;

        const pct = Math.min(100, Math.round((safeNum / safeMax) * 100));
        const statLabel = translate(`entities.stats.${meta.key}`);

        const prevUnitData = previousUnitMap ? previousUnitMap[meta.key] : null;
        const isModeAnim = prevUnitData && typeof prevUnitData.numVal === 'number';

        const startVal = isModeAnim ? prevUnitData.numVal : (animateEntry ? 0 : safeNum);
        const startPct = isModeAnim ? prevUnitData.pct : (animateEntry ? 0 : pct);

        const initialWidth = (animateEntry || isModeAnim) ? startPct : pct;
        const initialValDisplay = (animateEntry || isModeAnim) ? formatVal(startVal, meta.valueUnit) : formatVal(safeNum, meta.valueUnit);

        const isModified = typeof safeNum === 'number' && typeof safeStandardNum === 'number'
            ? safeNum !== safeStandardNum
            : String(safeNum) !== String(safeStandardNum);
        const modClass = isModified ? 'stat-val-modified' : '';

        return `
            <div class="stat-progress-row" data-unit-stat-idx="${idx}">
                <div class="stat-label-line">
                    <span class="stat-name">${statLabel}</span>
                    <span class="stat-val"><span class="unit-stat-val-number ${modClass}" data-start-val="${startVal}" data-target-val="${safeNum}">${initialValDisplay}</span></span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill ${(animateEntry || isModeAnim) ? 'is-initial-animating' : ''}" data-target-width="${pct}" style="width: ${initialWidth}%;"></div>
                    <div class="progress-bar-increase ${(animateEntry || isModeAnim) ? 'is-initial-animating' : ''}" data-target-width="${pct}" style="width: ${initialWidth}%;"></div>
                    <div class="progress-bar-decrease ${(animateEntry || isModeAnim) ? 'is-initial-animating' : ''}" data-target-width="${pct}" style="width: ${initialWidth}%;"></div>
                </div>
            </div>
        `;
    }).join('');

    const isUnitLvlModified = unitLevel !== standardUnitLevel;
    const badgeClass = isUnitLvlModified ? 'unit-level-badge stat-val-modified' : 'unit-level-badge';

    unitStatsContent.innerHTML = `
        <div class="unit-stats-card-box">
            <div class="unit-stats-header">
                <div class="unit-stats-title-group">
                    <span class="unit-title">${translatedUnitName}</span>
                    <span class="${badgeClass}">${levelLabelText} ${unitLevel}</span>
                </div>
            </div>
            <div class="eq-details-stats-progress-list unit-stats-list">
                ${rowsHTML}
            </div>
        </div>
    `;

    if (animateEntry || previousUnitMap) {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                unitStatsContent.querySelectorAll('.progress-bar-fill, .progress-bar-increase, .progress-bar-decrease').forEach((bar) => {
                    const targetWidth = bar.getAttribute('data-target-width');
                    if (targetWidth !== null) {
                        /** @type {HTMLElement} */ (bar).style.width = `${targetWidth}%`;
                    }
                });

                unitStatsContent.querySelectorAll('.stat-progress-row').forEach((row, idx) => {
                    const meta = (sp.statsMeta || [])[idx];
                    if (!meta) return;
                    const numSpan = row.querySelector('.unit-stat-val-number');
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
 * Updates unit stats progress bars and values during row hover.
 *
 * @param {HTMLElement | null} unitStatsContent
 * @param {Object} data
 * @param {Array<any>} levelsArray
 * @param {number} currentLevel
 * @param {number} calculatedMaxLevel
 * @param {string} equipmentRarity
 * @param {string} activeModifierTab
 * @param {number | null} hoverLevel
 */
export function updateUnitStatsHover(unitStatsContent, data, levelsArray, currentLevel, calculatedMaxLevel, equipmentRarity, activeModifierTab, hoverLevel) {
    if (!unitStatsContent || !data?.spawnedUnits) return;
    const sp = data.spawnedUnits;
    if (!/** @type {any} */ (unitStatsContent).__lastHoveredUnitValues) {
        /** @type {any} */ (unitStatsContent).__lastHoveredUnitValues = {};
    }

    const effective = computeEffectiveLevels(currentLevel, calculatedMaxLevel, data.rarity || equipmentRarity, activeModifierTab);
    const activeLevel = effective.effectiveLevel;
    const activeLevelObj = levelsArray[activeLevel - 1] || levelsArray[0];

    const hoveredEquipLevel = (hoverLevel !== null && hoverLevel >= 1 && hoverLevel <= levelsArray.length)
        ? Math.min(hoverLevel, effective.effectiveMaxLevel)
        : null;
    const hoverLevelObj = hoveredEquipLevel !== null ? (levelsArray[hoveredEquipLevel - 1] || activeLevelObj) : null;
    if (!hoverLevelObj) {
        /** @type {any} */ (unitStatsContent).__lastHoveredUnitValues = {};
    }

    const getUnitLevelFromEquipmentLevel = (eqLvl) => {
        if (sp.scalingType === 'laboratoryLevel') {
            const labTroops = state.playerProfile?.labTroops || {};
            const val = labTroops[sp.unitType];
            if (typeof val === 'number') return val;
            if (val && val.level) return val.level;
            const availableLevels = Object.keys(sp.levels || {}).map(Number).sort((a, b) => a - b);
            return availableLevels.length > 0 ? (availableLevels.at(-1) ?? 1) : 1;
        }
        let summonedLevelIdx = -1;
        if (data.statsMeta) summonedLevelIdx = data.statsMeta.findIndex(m => m.key === 'summonedUnitsLevel');
        const levelObj = levelsArray[eqLvl - 1] || levelsArray[0];
        if (summonedLevelIdx !== -1 && Array.isArray(levelObj)) {
            return levelObj[summonedLevelIdx] || eqLvl;
        } else if (levelObj && typeof levelObj === 'object') {
            return levelObj.summonedUnitsLevel || eqLvl;
        }
        return eqLvl;
    };

    const activeUnitLevel = getUnitLevelFromEquipmentLevel(activeLevel);
    const standardUnitLevel = getUnitLevelFromEquipmentLevel(currentLevel);
    const targetUnitLevel = hoveredEquipLevel !== null ? getUnitLevelFromEquipmentLevel(hoveredEquipLevel) : activeUnitLevel;

    const badgeEl = unitStatsContent.querySelector('.unit-level-badge');
    const isUnitLvlModified = activeUnitLevel !== standardUnitLevel;
    if (badgeEl) {
        const levelLabelText = translate('validation.level');
        badgeEl.classList.toggle('stat-val-modified', isUnitLvlModified);
        badgeEl.textContent = `${levelLabelText} ${targetUnitLevel}`;
    }

    const spLevelsMap = sp.levels || {};
    const baseUnitStatValues = spLevelsMap[String(activeUnitLevel)] || spLevelsMap[activeUnitLevel] || [];
    const standardUnitStatValues = spLevelsMap[String(standardUnitLevel)] || spLevelsMap[standardUnitLevel] || [];
    const hoverUnitStatValues = spLevelsMap[String(targetUnitLevel)] || spLevelsMap[targetUnitLevel] || [];

    const allSpLevels = Object.keys(spLevelsMap).map(Number).sort((a, b) => a - b);
    const maxSpLevel = allSpLevels.length > 0 ? (allSpLevels.at(-1) ?? activeUnitLevel) : activeUnitLevel;
    const maxUnitStatValues = spLevelsMap[String(maxSpLevel)] || baseUnitStatValues;

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

    const rowElements = unitStatsContent.querySelectorAll('.stat-progress-row');

    (sp.statsMeta || []).forEach((meta, idx) => {
        const rowEl = rowElements[idx];
        if (!rowEl) return;

        const baseNumVal = Array.isArray(baseUnitStatValues) ? baseUnitStatValues[idx] : baseUnitStatValues[meta.key];
        const standardNumVal = Array.isArray(standardUnitStatValues) ? standardUnitStatValues[idx] : standardUnitStatValues[meta.key];
        const hoverNumVal = Array.isArray(hoverUnitStatValues) ? hoverUnitStatValues[idx] : hoverUnitStatValues[meta.key];
        const maxVal = Array.isArray(maxUnitStatValues) ? maxUnitStatValues[idx] : maxUnitStatValues[meta.key];

        const safeBase = typeof baseNumVal === 'number' ? baseNumVal : 0;
        const safeStandardNum = typeof standardNumVal === 'number' ? standardNumVal : 0;
        const safeHover = typeof hoverNumVal === 'number' ? hoverNumVal : safeBase;
        const safeMax = typeof maxVal === 'number' && maxVal > 0 ? maxVal : safeBase || 1;

        const isModified = typeof safeBase === 'number' && typeof safeStandardNum === 'number'
            ? safeBase !== safeStandardNum
            : String(safeBase) !== String(safeStandardNum);
        const modClass = isModified ? 'stat-val-modified' : '';

        const isLowerBetter = meta.deltaType === 'decrease' || meta.lowerIsBetter === true || meta.key.toLowerCase().includes('cooldown');
        const basePct = Math.min(100, Math.max(0, Math.round((safeBase / safeMax) * 100)));
        const hoverPct = Math.min(100, Math.max(0, Math.round((safeHover / safeMax) * 100)));

        let mainWidth = basePct;
        let increaseWidth = basePct;
        let decreaseWidth = basePct;
        let isComparing = false;

        if (hoverLevelObj && hoveredEquipLevel !== activeLevel) {
            const diff = Math.round((safeHover - safeBase) * 100) / 100;
            const isSame = diff === 0;
            const isGain = isLowerBetter ? diff < 0 : diff > 0;

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

            const diffSign = formatDiffVal(diff, meta.valueUnit);
            const formattedBase = formatVal(safeBase, meta.valueUnit);
            const formattedHover = formatVal(safeHover, meta.valueUnit);
            const deltaTextClass = isGain ? 'val-increase' : (isSame ? '' : 'val-decrease');

            const prevHoverVal = /** @type {any} */ (unitStatsContent).__lastHoveredUnitValues[meta.key];
            const startVal = (prevHoverVal !== undefined && typeof prevHoverVal === 'number') ? prevHoverVal : safeBase;
            /** @type {any} */ (unitStatsContent).__lastHoveredUnitValues[meta.key] = safeHover;

            rowEl.classList.toggle('is-comparing', isComparing);
            const valEl = rowEl.querySelector('.stat-val');
            if (valEl) {
                const existingCompare = valEl.querySelector('.stat-val-compare');
                const existingHoverSpan = valEl.querySelector('.stat-val-hover');

                const isIntStat = Number.isInteger(startVal) && Number.isInteger(safeHover);
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
                    if (newHoverSpan && startVal !== safeHover) {
                        const stepDelta = Math.abs(safeHover - startVal);
                        const animDuration = Math.min(450, Math.max(150, Math.round(Math.log10(stepDelta + 1) * 160)));
                        animateValue(newHoverSpan, startVal, safeHover, animDuration, (v) => `${formatAnimVal(v, meta.valueUnit)} (${diffSign})`);
                    }
                } else if (existingHoverSpan) {
                    existingHoverSpan.className = `stat-val-hover ${deltaTextClass}`;
                    if (startVal !== safeHover) {
                        const stepDelta = Math.abs(safeHover - startVal);
                        const animDuration = Math.min(450, Math.max(150, Math.round(Math.log10(stepDelta + 1) * 160)));
                        animateValue(existingHoverSpan, startVal, safeHover, animDuration, (v) => `${formatAnimVal(v, meta.valueUnit)} (${diffSign})`);
                    }
                }
            } else {
                valEl.innerHTML = `<span class="unit-stat-val-number ${modClass}">${formatVal(safeBase, meta.valueUnit)}</span>`;
            }
        } else {
            rowEl.classList.remove('is-comparing');
            const valEl = rowEl.querySelector('.stat-val');
            if (valEl) {
                valEl.innerHTML = `<span class="unit-stat-val-number ${modClass}">${formatVal(safeBase, meta.valueUnit)}</span>`;
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
