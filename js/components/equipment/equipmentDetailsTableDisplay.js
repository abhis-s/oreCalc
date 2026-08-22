import { getEquipmentUpgradeCost, getRequiredTownHall } from '../../data/equipmentCommonData.js';
import { translate } from '../../i18n/translator.js';

import {
    computeEffectiveLevels,
    isStatModifiable,
    MODIFIER_HERO_BOOST_MULTIPLIERS,
    resolveModifierRecommendation
} from '../../domain/equipment/modifierCalculator.js';
import { formatNumber } from '../../utils/numberFormatter.js';

import { computeStatDelta } from './equipmentDetailsModalData.js';

/**
 * Renders level table headers, rows, town hall icons, step rows, delta tags, and totals row.
 *
 * @param {HTMLElement | null} tableHead
 * @param {HTMLElement | null} tableBody
 * @param {Object} data
 * @param {Array<any>} levelsArray
 * @param {number} currentLevel
 * @param {number} calculatedMaxLevel
 * @param {string} equipmentRarity
 * @param {string | null} heroKey
 * @param {number} userTH
 * @param {string} activeModifierTab
 * @param {Object | null} rec
 * @param {(levelNum: number) => void} onRowHover
 * @param {() => void} onRowLeave
 */
export function renderLevelTable(tableHead, tableBody, data, levelsArray, currentLevel, calculatedMaxLevel, equipmentRarity, heroKey, userTH, activeModifierTab, rec, onRowHover, onRowLeave) {
    if (!tableHead || !tableBody) return;

    const isEpic = (data?.rarity || equipmentRarity || '').toLowerCase() === 'epic';
    const levelLabel = translate('validation.level');
    const shinyText = translate('entities.ores.shiny');
    const glowyText = translate('entities.ores.glowy');
    const starryText = translate('entities.ores.starry');
    const reqTHText = translate('views.equipment.requiredTownHall');

    const categoryGroups = [];
    (data?.statsMeta || []).forEach(meta => {
        const catKey = meta.category || 'ability';
        const lastGroup = categoryGroups.at(-1);
        if (lastGroup && lastGroup.category === catKey) {
            lastGroup.count += 1;
        } else {
            categoryGroups.push({ category: catKey, count: 1 });
        }
    });

    const categorySuperHeadersHTML = categoryGroups.map(group => {
        const title = translate(`views.equipment.${group.category}`);
        return `<th colspan="${group.count}" class="category-header category-${group.category}" data-i18n="views.equipment.${group.category}">${title}</th>`;
    }).join('');

    const oreCostCount = isEpic ? 3 : 2;
    const costTitle = translate('views.equipment.cost');
    const costSuperHeaderHTML = `<th colspan="${oreCostCount}" class="category-header category-cost" data-i18n="views.equipment.cost">${costTitle}</th>`;

    const subHeadersStatHTML = (data?.statsMeta || []).map(meta => `<th><span class="stat-name" data-i18n="entities.stats.${meta.key}">${translate(`entities.stats.${meta.key}`)}</span></th>`).join('');
    const subHeadersOreHTML = `
        <th data-i18n="entities.ores.shiny">${shinyText}</th>
        <th data-i18n="entities.ores.glowy">${glowyText}</th>
        ${isEpic ? `<th data-i18n="entities.ores.starry">${starryText}</th>` : ''}
    `;

    tableHead.innerHTML = `
        <tr class="super-header-row">
            <th rowspan="2" data-i18n="validation.level">${levelLabel}</th>
            ${categorySuperHeadersHTML}
            ${costSuperHeaderHTML}
            <th rowspan="2" data-i18n="views.equipment.requiredTownHall">${reqTHText}</th>
        </tr>
        <tr class="sub-header-row">
            ${subHeadersStatHTML}
            ${subHeadersOreHTML}
        </tr>
    `;

    requestAnimationFrame(() => {
        if (window.innerWidth <= 779) return;
        const categoryCell = tableHead.querySelector('.super-header-row th.category-header') || tableHead.querySelector('.super-header-row th:not([rowspan])');
        if (categoryCell) {
            const row1Height = categoryCell.getBoundingClientRect().height;
            if (row1Height > 0) {
                tableHead.querySelectorAll('.sub-header-row th').forEach(cell => {
                    /** @type {HTMLElement} */ (cell).style.top = `${row1Height}px`;
                });
            }
        }
    });

    const effective = computeEffectiveLevels(currentLevel, calculatedMaxLevel, data?.rarity || equipmentRarity, activeModifierTab);
    const activeCurrentLevel = effective.effectiveLevel;
    const activeMaxLevel = effective.effectiveMaxLevel;
    const isEquipmentMaxed = currentLevel >= calculatedMaxLevel;

    const totalRows = calculatedMaxLevel;
    const rowNumbers = Array.from({ length: totalRows }, (_, i) => i + 1);

    const levelRowsHTML = rowNumbers.map(levelNumber => {
        const index = levelNumber - 1;
        const lvlObj = levelsArray[index] || null;
        const prevLvlObj = index > 0 ? (levelsArray[index - 1] || null) : null;
        const isUnavailableInEsports = activeModifierTab === 'esports' && levelNumber > activeMaxLevel;
        const isPast = levelNumber < activeCurrentLevel || isUnavailableInEsports;
        const isActive = !isUnavailableInEsports && levelNumber === activeCurrentLevel;
        const cost = getEquipmentUpgradeCost(levelNumber);
        const reqTH = getRequiredTownHall(levelNumber, data?.rarity || equipmentRarity, heroKey);
        const isUnreachableTH = activeModifierTab === 'standard' && userTH && reqTH > userTH;

        const isMaxLevel = !isUnavailableInEsports && levelNumber === activeMaxLevel;
        const isFuture = !isUnavailableInEsports && levelNumber > activeCurrentLevel;
        const isStepLevel = levelNumber % 3 === 0;

        let rowClass = '';
        if (isUnavailableInEsports) {
            rowClass = 'past-level-row unavailable-esports-row';
        } else if (isActive && isMaxLevel) {
            rowClass = 'active-max-level-row';
        } else if (isActive) {
            rowClass = 'active-level-row';
        } else if (isPast || isUnreachableTH) {
            rowClass = 'past-level-row';
        } else if (isMaxLevel) {
            rowClass = 'max-level-step-row';
        } else if (isFuture && isStepLevel) {
            rowClass = 'step-level-row';
        }

        const rowClassAttr = rowClass ? `class="${rowClass}"` : '';

        const statCellsHTML = (data?.statsMeta || []).map((meta, metaIdx) => {
            const getStatVal = (obj) => {
                if (!obj) return undefined;
                if (Array.isArray(obj)) return obj[metaIdx];
                const raw = obj.stats ? obj.stats[meta.key] : obj[meta.key];
                return typeof raw === 'object' ? raw.value : raw;
            };

            const rawVal = getStatVal(lvlObj);
            const rawPrevVal = getStatVal(prevLvlObj);

            const isMod = isStatModifiable(meta);
            const multiplier = isMod ? (MODIFIER_HERO_BOOST_MULTIPLIERS[activeModifierTab] || 1.00) : 1.00;

            const val = (rawVal !== undefined && rawVal !== null && typeof rawVal === 'number')
                ? Math.round(rawVal * multiplier * 100) / 100
                : rawVal;

            const prevVal = (rawPrevVal !== undefined && rawPrevVal !== null && typeof rawPrevVal === 'number')
                ? Math.round(rawPrevVal * multiplier * 100) / 100
                : rawPrevVal;

            const deltaText = computeStatDelta(val, prevVal, meta.deltaType, meta.valueUnit || 'number', meta.category || 'ability');
            const isMainStat = meta.category === 'ability';
            const deltaClass = isMainStat ? 'delta-tag delta-tag-main' : 'delta-tag';
            const deltaHTML = deltaText ? `<span class="${deltaClass}">(${deltaText})</span>` : '';
            const formatStatValue = (v, vUnit) => {
                if (v === undefined || v === null) return '-';
                if (typeof v !== 'number') return String(v);
                if (vUnit === 'seconds' || vUnit === 'tiles') {
                    const num = Math.round(v * 10) / 10;
                    return `${formatNumber(num)}${vUnit === 'seconds' ? 's' : ' tiles'}`;
                }
                const isInt = Number.isInteger(v);
                const numStr = isInt ? Math.round(v) : (Math.round(v * 10) / 10);
                if (vUnit === 'percentage' || vUnit === 'percent') return `${formatNumber(numStr)}%`;
                return formatNumber(numStr);
            };

            const displayVal = formatStatValue(val, meta.valueUnit);
            const isModified = typeof val === 'number' && typeof rawVal === 'number'
                ? val !== rawVal
                : String(val) !== String(rawVal);
            const cellValHTML = isModified ? `<span class="stat-val-modified">${displayVal}</span>` : `<span>${displayVal}</span>`;

            return `<td><span class="stat-cell-wrapper">${cellValHTML}${deltaHTML}</span></td>`;
        }).join('');

        const shinyDisplay = cost.shiny > 0
            ? `<span class="shiny-cost-highlight">${formatNumber(cost.shiny)}</span>`
            : '-';

        const glowyDisplay = cost.glowy > 0
            ? `<span class="glowy-cost-highlight">${formatNumber(cost.glowy)}</span>`
            : '-';

        const starryDisplay = cost.starry > 0
            ? `<span class="starry-cost-highlight">${formatNumber(cost.starry)}</span>`
            : '-';

        const starryCellHTML = isEpic ? `<td><div class="ore-cost-cell">${starryDisplay}</div></td>` : '';

        const activeRecRes = resolveModifierRecommendation(rec, activeModifierTab, userTH, calculatedMaxLevel);
        const activeTargetLevel = activeRecRes.targetRecLevel;
        const isRecTarget = !isEquipmentMaxed && activeTargetLevel && levelNumber === activeTargetLevel;
        const recTargetIcon = isRecTarget ? `<orecalc-assets-svg name="thumbs-up" class="rec-level-icon" title="Target Level"></orecalc-assets-svg>` : '';

        const thText = translate('views.equipment.thShort', { level: reqTH });

        return `
            <tr ${rowClassAttr}>
                <td><div class="level-cell-content">${recTargetIcon}<span>${levelNumber}</span></div></td>
                ${statCellsHTML}
                <td><div class="ore-cost-cell">${shinyDisplay}</div></td>
                <td><div class="ore-cost-cell">${glowyDisplay}</div></td>
                ${starryCellHTML}
                <td>
                    <div class="th-req-cell">
                        <orecalc-assets-image src="assets/th/th${reqTH}.png" alt="${thText}" class="th-cell-img"></orecalc-assets-image>
                        <span>${thText}</span>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    const isAtLeast2BelowMax = (calculatedMaxLevel - currentLevel) >= 2;
    let totalCostRowHTML = '';
    if (isAtLeast2BelowMax) {
        let totalShiny = 0;
        let totalGlowy = 0;
        let totalStarry = 0;

        levelsArray.forEach((lvlObj, index) => {
            const levelNumber = index + 1;
            if (levelNumber > currentLevel && levelNumber <= activeMaxLevel) {
                const cost = getEquipmentUpgradeCost(levelNumber);
                totalShiny += (cost.shiny || 0);
                totalGlowy += (cost.glowy || 0);
                if (isEpic) {
                    totalStarry += (cost.starry || 0);
                }
            }
        });

        const totalShinyDisplay = totalShiny > 0 ? `<span class="shiny-cost-highlight">${formatNumber(totalShiny)}</span>` : '-';
        const totalGlowyDisplay = totalGlowy > 0 ? `<span class="glowy-cost-highlight">${formatNumber(totalGlowy)}</span>` : '-';
        const totalStarryDisplay = totalStarry > 0 ? `<span class="starry-cost-highlight">${formatNumber(totalStarry)}</span>` : '-';
        const totalStarryCellHTML = isEpic ? `<td><div class="ore-cost-cell">${totalStarryDisplay}</div></td>` : '';
        const totalLabel = translate('views.equipment.totalCost');

        const statsCount = data?.statsMeta ? data.statsMeta.length : 0;
        let levelCellHTML = '<td></td>';
        let totalStatCellsHTML = '';

        if (statsCount === 0) {
            levelCellHTML = `<td><div class="level-cell-content"><span class="total-cost-label">${totalLabel}</span></div></td>`;
        } else {
            totalStatCellsHTML = (data?.statsMeta || []).map((_, idx) => {
                if (idx === statsCount - 1) {
                    return `<td class="total-cost-label-cell"><span class="total-cost-label">${totalLabel}</span></td>`;
                }
                return '<td></td>';
            }).join('');
        }

        totalCostRowHTML = `
            <tr class="total-cost-row">
                ${levelCellHTML}
                ${totalStatCellsHTML}
                <td><div class="ore-cost-cell">${totalShinyDisplay}</div></td>
                <td><div class="ore-cost-cell">${totalGlowyDisplay}</div></td>
                ${totalStarryCellHTML}
                <td></td>
            </tr>
        `;
    }

    tableBody.innerHTML = levelRowsHTML + totalCostRowHTML;

    let hoverResetTimer = null;

    tableBody.querySelectorAll('tr:not(.total-cost-row)').forEach((row, idx) => {
        const levelNum = idx + 1;
        row.addEventListener('mouseenter', () => {
            if (hoverResetTimer !== null) {
                cancelAnimationFrame(hoverResetTimer);
                hoverResetTimer = null;
            }
            onRowHover(levelNum);
        });
        row.addEventListener('mouseleave', () => {
            if (hoverResetTimer !== null) {
                cancelAnimationFrame(hoverResetTimer);
            }
            hoverResetTimer = requestAnimationFrame(() => {
                hoverResetTimer = null;
                onRowLeave();
            });
        });
    });
}
