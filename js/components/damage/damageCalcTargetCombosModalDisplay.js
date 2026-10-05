/**
 * DOM Rendering Engine for Damage Calculator Target Combinations Modal.
 * Tier 4: UI Presentation (Dedicated exclusively to modal dialog DOM rendering, 0 event listeners).
 */

import { getDefensesData } from '../../data/defenseTargetsData.js';
import { equipmentDamageData } from '../../data/equipmentDamageData.js';
import { getBuildingAssetUrl } from '../../core/buildingAssetHelper.js';
import {
    getDefenseMaxHp,
    getMaxSuperchargeTier,
    getMaxDefenseLevelForTownHall,
    snapDefenseLevel,
    getValidDefenseLevels,
    isHeroDefense,
    getMinDefenseLevel
} from '../../domain/damage/defenseProgressionDomain.js';
import {
    solveZapQuakeCombinations,
    filterDominatedCombos,
    getComboSignature,
    partitionOptimalCombos
} from '../../domain/damage/zapQuakeSolver.js';
import { translate } from '../../i18n/translator.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { formatNumber } from '../../utils/numberFormatter.js';
import { getActiveModifier, getShownTownHall, getGlobalSuperchargeTier } from './damageCalcState.js';
import {
    getDefenseDisplayName,
    getEquipmentDisplayName
} from '../../utils/equipmentMetadata.js';
import {
    getLvlShort,
    getHpUnit,
    renderSuperchargePipsHtml
} from './damageCalcDisplay.js';
import { getEnabledEquipmentList } from '../../domain/damage/equipmentDamage.js';
import { getDashboardAssignedDefensesMap } from '../../domain/damage/zapQuakeDashboardDomain.js';
import { renderSteppedSliderHtml } from '../common/steppedSlider.js';

/**
 * Renders a single combination row HTML for the target combos modal.
 *
 * @param {Object} combo - Evaluated combo object.
 * @param {Object} options - Rendering options.
 * @param {string} options.activeSig - Signature of the currently selected combination.
 * @param {string} [options.optimalSig] - Signature of the default optimal combination.
 * @param {Map<string, Array<string>>} [options.assignedDefensesMap] - Map of assigned defenses per combo on dashboard.
 * @param {Record<string, string>} [options.selectedCombos] - Map of selected combos across defenses.
 * @param {string} options.defenseKey - Key of the target defense.
 * @param {number} options.currentLevel - Current defense level.
 * @param {number} options.activeSupercharge - Active supercharge tier.
 * @param {number} options.targetHp - Target defense HP.
 * @param {number} options.zapLvl - Regular Lightning spell level.
 * @param {number} options.eqLvl - Regular Earthquake spell level.
 * @param {number} options.ccZapLvl - CC Lightning spell level.
 * @param {number} options.ccEqLvl - CC Earthquake spell level.
 * @returns {string} HTML markup string.
 */
function renderComboRowHtml(combo, options) {
    const {
        activeSig,
        optimalSig,
        assignedDefensesMap,
        selectedCombos = {},
        defenseKey,
        currentLevel,
        activeSupercharge,
        targetHp,
        zapLvl,
        eqLvl,
        ccZapLvl,
        ccEqLvl
    } = options;
    const sig = getComboSignature(combo);
    const isSelected = sig === activeSig;
    const isDefault = Boolean(optimalSig && sig === optimalSig);
    const sharedDefKeys = assignedDefensesMap
        ? (assignedDefensesMap.get(sig) || []).filter(key => key !== defenseKey)
        : Object.entries(selectedCombos)
            .filter(([key, s]) => key !== defenseKey && s === sig)
            .map(([key]) => key);
    const sharedCount = sharedDefKeys.length;

    const equipHtml = (combo.equipment || []).map(eq => {
        const equip = equipmentDamageData[eq.id];
        if (!equip) return '';
        return `
            <div class="calc-target-combo-badge calc-target-combo-badge--equip">
                <orecalc-assets-image src="${equip.icon}" alt="${escapeHTML(getEquipmentDisplayName(eq.id))}" size="thumbnail" class="calc-target-combo-badge__icon"></orecalc-assets-image>
            </div>
        `;
    }).join('');

    const regEq = combo.regEqCount ?? combo.eqCount ?? 0;
    const ccEq = combo.ccEqCount ?? 0;
    const regZap = combo.regZapCount ?? combo.zapCount ?? 0;
    const ccZap = combo.ccZapCount ?? 0;

    const eqHtml = regEq > 0 ? `
        <div class="calc-target-combo-badge calc-target-combo-badge--eq">
            <span class="calc-target-combo-badge__multiplier">${regEq}x</span>
            <orecalc-assets-image src="/assets/spells/earthquake.png" alt="Earthquake" size="thumbnail" class="calc-target-combo-badge__icon"></orecalc-assets-image>
        </div>
    ` : '';

    const ccEqHtml = ccEq > 0 ? `
        <div class="calc-target-combo-badge calc-target-combo-badge--eq calc-target-combo-badge--cc">
            <span class="calc-target-combo-badge__multiplier">${ccEq}x</span>
            <orecalc-assets-image src="/assets/spells/earthquake.png" alt="CC Earthquake" size="thumbnail" class="calc-target-combo-badge__icon"></orecalc-assets-image>
        </div>
    ` : '';

    const zapHtml = regZap > 0 ? `
        <div class="calc-target-combo-badge calc-target-combo-badge--zap">
            <span class="calc-target-combo-badge__multiplier">${regZap}x</span>
            <orecalc-assets-image src="/assets/spells/lightning.png" alt="Lightning" size="thumbnail" class="calc-target-combo-badge__icon"></orecalc-assets-image>
        </div>
    ` : '';

    const ccZapHtml = ccZap > 0 ? `
        <div class="calc-target-combo-badge calc-target-combo-badge--zap calc-target-combo-badge--cc">
            <span class="calc-target-combo-badge__multiplier">${ccZap}x</span>
            <orecalc-assets-image src="/assets/spells/lightning.png" alt="CC Lightning" size="thumbnail" class="calc-target-combo-badge__icon"></orecalc-assets-image>
        </div>
    ` : '';

    const activeBadges = [equipHtml, eqHtml, ccEqHtml, zapHtml, ccZapHtml].filter(Boolean);
    const allBadges = activeBadges.map((badge, idx) => `
        <div class="calc-combo-item">
            ${idx > 0 ? '<span class="calc-combo-plus">+</span>' : ''}
            ${badge}
        </div>
    `).join('');

    return `
        <div class="calc-target-combo-row ${isSelected ? 'is-selected' : ''}"
            data-building-key="${defenseKey}"
            data-building-level="${currentLevel}"
            data-supercharge="${activeSupercharge}"
            data-max-hp="${targetHp}"
            data-eq-count="${regEq + ccEq}"
            data-zap-count="${regZap + ccZap}"
            data-reg-eq="${regEq}"
            data-cc-eq="${ccEq}"
            data-reg-zap="${regZap}"
            data-cc-zap="${ccZap}"
            data-zap-level="${zapLvl}"
            data-cc-zap-level="${ccZapLvl}"
            data-eq-level="${eqLvl}"
            data-cc-eq-level="${ccEqLvl}"
            data-equip='${escapeHTML(JSON.stringify(combo.equipment || []))}'>
            <div class="calc-target-combo-row__badges">
                ${allBadges}
            </div>
            <div class="calc-target-combo-row__actions">
                ${sharedCount > 0 ? `
                    <button type="button" class="calc-target-combo-row__shared-pill"
                        data-shared-combo-info="true"
                        data-shared-defenses="${escapeHTML(sharedDefKeys.join(','))}"
                        aria-label="${escapeHTML(translate('views.damageCalc.zapQuake.sharedCombo', { count: sharedCount }) || `Shared (${sharedCount})`)}">
                        <orecalc-assets-svg name="link" width="12" height="12"></orecalc-assets-svg>
                        <span data-i18n="views.damageCalc.zapQuake.sharedCombo" data-i18n-args='{"count":${sharedCount}}'>${escapeHTML(translate('views.damageCalc.zapQuake.sharedCombo', { count: sharedCount }) || `Shared (${sharedCount})`)}</span>
                    </button>
                ` : ''}
                ${isDefault ? `
                    <span class="calc-target-combo-row__default-pill">
                        <span data-i18n="views.damageCalc.zapQuake.defaultCombo">${escapeHTML(translate('views.damageCalc.zapQuake.defaultCombo') || 'Default')}</span>
                    </span>
                ` : ''}
                <button type="button" class="calc-target-combo-row__info-btn calc-info-btn"
                    data-combo-defense-info="true"
                    aria-label="${escapeHTML(translate('views.damageCalc.zapQuake.combinationBreakdownAria') || 'Damage Breakdown')}">
                    <orecalc-assets-svg name="info" width="14" height="14"></orecalc-assets-svg>
                </button>
                ${isSelected ? `
                    <span class="calc-target-combo-row__selected-pill">
                        <orecalc-assets-svg name="check" width="14" height="14"></orecalc-assets-svg>
                        <span data-i18n="views.damageCalc.zapQuake.selectedCombo">${escapeHTML(translate('views.damageCalc.zapQuake.selectedCombo') || 'Selected')}</span>
                    </span>
                ` : `
                    <button type="button" class="btn-secondary calc-target-combo-row__select-btn"
                        data-action="select-target-combo"
                        data-defense-key="${defenseKey}"
                        data-combo-sig="${escapeHTML(sig)}">
                        <span data-i18n="views.damageCalc.zapQuake.selectCombo">${escapeHTML(translate('views.damageCalc.zapQuake.selectCombo') || 'Select')}</span>
                    </button>
                `}
            </div>
        </div>
    `;
}

/**
 * Renders the combinations list subtree HTML (used for both initial modal rendering and slider updates).
 *
 * @param {Object} state - Calculator state.
 * @param {string} defenseKey - Target defense key.
 * @param {number} currentLevel - Target level.
 * @param {number} activeSupercharge - Supercharge tier.
 * @returns {{ listHtml: string, targetHp: number, optimalCount: number, optimalSig: string, selectedSig: string | undefined }}
 */
export function renderTargetCombosListHtml(state, defenseKey, currentLevel, activeSupercharge) {
    const def = getDefensesData()[defenseKey];
    if (!def) return { listHtml: '', targetHp: 0, optimalCount: 0, optimalSig: '', selectedSig: undefined };

    const zq = state.zapQuake || {};
    const spells = state.offense?.spells || { lightning: 13, earthquake: 8 };
    const zapLvl = spells.lightning || zq.lightningLevel || 13;
    const eqLvl = spells.earthquake || zq.earthquakeLevel || 8;
    const enabledSources = state.offense?.enabledSources || {};
    const ccSpells = state.offense?.ccSpells || { lightning: 13, earthquake: 8 };
    const ccZapLvl = ccSpells.lightning || 13;
    const ccEqLvl = ccSpells.earthquake || 8;
    const isCcZapEnabled = enabledSources.cc_lightning !== false;
    const isCcEqEnabled = enabledSources.cc_earthquake !== false;
    const enabledEquipment = getEnabledEquipmentList(state);
    const activeMod = getActiveModifier(state);

    const solverOpts = {
        superchargeTier: activeSupercharge,
        townHallLevel: getShownTownHall(state),
        enabledSpells: {
            lightning: enabledSources.lightning !== false,
            earthquake: enabledSources.earthquake !== false,
            cc_lightning: isCcZapEnabled,
            cc_earthquake: isCcEqEnabled
        },
        enabledEquipment,
        modifier: activeMod,
        leagueId: activeMod,
        ccSpells: {
            lightning: isCcZapEnabled ? ccZapLvl : null,
            earthquake: isCcEqEnabled ? ccEqLvl : null
        }
    };

    const targetHp = getDefenseMaxHp(defenseKey, currentLevel, solverOpts);
    const solution = solveZapQuakeCombinations(defenseKey, currentLevel, zapLvl, eqLvl, solverOpts);
    const nonDominated = filterDominatedCombos(solution.combinations || []);
    const { optimal: optimalCombos, nonOptimal: nonOptimalCombos } = partitionOptimalCombos(nonDominated, 6);

    const selectedSig = zq.selectedCombos?.[defenseKey];
    const optimalSig = solution.optimalCombination ? getComboSignature(solution.optimalCombination) : '';
    const activeSig = selectedSig || optimalSig;
    const assignedDefensesMap = getDashboardAssignedDefensesMap(state, defenseKey);

    const rowOpts = {
        activeSig,
        optimalSig,
        assignedDefensesMap,
        selectedCombos: zq.selectedCombos || {},
        defenseKey,
        currentLevel,
        activeSupercharge,
        targetHp,
        zapLvl,
        eqLvl,
        ccZapLvl,
        ccEqLvl
    };

    let optimalListHtml = '';
    if (optimalCombos.length === 0 && nonOptimalCombos.length === 0) {
        optimalListHtml = `
            <div class="calc-empty-notice" data-i18n="views.damageCalc.offense.insufficientCapacityNotice">
                ${escapeHTML(translate('views.damageCalc.offense.insufficientCapacityNotice') || 'Requires more capacity than available.')}
            </div>
        `;
    } else {
        optimalListHtml = optimalCombos.map(c => renderComboRowHtml(c, rowOpts)).join('');
    }

    let nonOptimalHtml = '';
    if (nonOptimalCombos.length > 0) {
        const isSelectionInNonOptimal = nonOptimalCombos.some(c => getComboSignature(c) === activeSig);
        const shouldAutoOpen = optimalCombos.length === 0 || isSelectionInNonOptimal;

        nonOptimalHtml = `
            <details class="calc-target-combos-collapse" ${shouldAutoOpen ? 'open' : ''}>
                <summary class="calc-target-combos-collapse__summary">
                    <span class="calc-target-combos-collapse__title">
                        <span data-i18n="views.damageCalc.zapQuake.nonOptimalCombosTitle">${escapeHTML(translate('views.damageCalc.zapQuake.nonOptimalCombosTitle') || 'Non-Optimal Combinations (6+ spells)')}</span>
                        <span class="calc-target-combos-collapse__count">(${nonOptimalCombos.length})</span>
                    </span>
                    <orecalc-assets-svg name="chevron-down" width="14" height="14" class="calc-target-combos-collapse__icon"></orecalc-assets-svg>
                </summary>
                <div class="calc-target-combos-collapse__content">
                    ${nonOptimalCombos.map(c => renderComboRowHtml(c, rowOpts)).join('')}
                </div>
            </details>
        `;
    }

    const listHtml = `
        <div class="calc-target-combos-list-header">
            <span class="calc-target-combos-list-title">
                <span data-i18n="views.damageCalc.zapQuake.possibleCombosTitle">${escapeHTML(translate('views.damageCalc.zapQuake.possibleCombosTitle') || 'Possible Combinations')}</span> (${optimalCombos.length})
            </span>
        </div>
        <div class="calc-target-combos-list">
            ${optimalListHtml}
        </div>
        ${nonOptimalHtml}
    `;

    return { listHtml, targetHp, optimalCount: optimalCombos.length, optimalSig, selectedSig };
}

/**
 * Renders the Target Combinations modal sheet for a specific defense.
 * Partitions combinations so that high-spell investments (>= 6 spells) are collapsed at the bottom
 * and excluded from the primary possible combinations counter.
 *
 * @param {Object} state - Calculator state.
 * @param {HTMLElement} container - Modal container.
 * @param {string} defenseKey - Target defense key.
 * @param {number} [level] - Optional level override.
 * @param {number} [superchargeTier] - Optional supercharge tier.
 */
export function renderTargetCombosModal(state, container, defenseKey, level, superchargeTier) {
    if (!container || !defenseKey) return;
    const def = getDefensesData()[defenseKey];
    if (!def) return;

    const zq = state.zapQuake || {};
    const currentTH = getShownTownHall(state);
    const overallMaxLevel = def.maxLevel || 1;
    const thInfo = getMaxDefenseLevelForTownHall(defenseKey, currentTH);
    const maxAllowedLevel = (thInfo?.status === 'available' && thInfo.level > 0) ? thInfo.level : overallMaxLevel;
    const requestedLevel = Number(level) || state.defenseLevelOverrides?.[defenseKey] || zq.defenseLevel || maxAllowedLevel;
    const currentLevel = snapDefenseLevel(defenseKey, requestedLevel, maxAllowedLevel);
    const activeSupercharge = superchargeTier !== undefined
        ? superchargeTier
        : (state.defenseSuperchargeOverrides?.[defenseKey] !== undefined ? state.defenseSuperchargeOverrides[defenseKey] : getGlobalSuperchargeTier(state));

    const maxSupercharge = getMaxSuperchargeTier(defenseKey, def.maxLevel || 1);
    const isScDisabled = currentLevel < (def.maxLevel || 1) || currentTH < 18;
    const effectiveSupercharge = isScDisabled ? 0 : activeSupercharge;

    const defDisplayName = getDefenseDisplayName(defenseKey);
    const isCrafted = def?.subCategory === 'crafted';
    const moduleHint = `(${translate('views.damageCalc.filters.craftedHpModule') || 'HP Module'})`;
    const modalDefenseName = isCrafted ? `${defDisplayName} ${moduleHint}` : defDisplayName;
    const hpUnit = getHpUnit();

    const listResult = renderTargetCombosListHtml(state, defenseKey, currentLevel, effectiveSupercharge);
    const selectedSig = listResult.selectedSig;
    const optimalSig = listResult.optimalSig;

    let superchargeHtml = '';
    if (maxSupercharge > 0) {
        let scPills = '';
        for (let tier = 0; tier <= maxSupercharge; tier++) {
            const isSelected = tier === effectiveSupercharge;
            const tierLabel = tier === 0
                ? `${translate('views.damageCalc.offense.superchargeLabel') || 'Supercharge'}: ${translate('app.none') || 'None'}`
                : (translate('views.damageCalc.zapQuake.tierLabel') || 'Tier {tier}').replace('{tier}', String(tier));

            const pipsHtml = tier === 0
                ? `<orecalc-assets-image
                    src="/assets/supercharge/supercharge_uncharged.png"
                    alt="${escapeHTML(tierLabel)}"
                    size="thumbnail"
                    class="calc-supercharge-pip is-uncharged">
                </orecalc-assets-image>`
                : Array.from({ length: tier }, () => `
                    <orecalc-assets-image
                        src="/assets/supercharge/supercharge_bolt.png"
                        alt="${escapeHTML(tierLabel)}"
                        size="thumbnail"
                        class="calc-supercharge-pip is-charged">
                    </orecalc-assets-image>
                `).join('');

            scPills += `
                <button type="button"
                    class="calc-supercharge-pill ${isSelected && !isScDisabled ? 'active is-active' : ''} ${isScDisabled && tier === 0 ? 'active is-active' : ''}"
                    data-defense-key="${defenseKey}"
                    data-tier="${tier}"
                    role="radio"
                    aria-checked="${isSelected}"
                    ${isScDisabled ? 'disabled' : ''}
                    title="${escapeHTML(tierLabel)}"
                    aria-label="${escapeHTML(tierLabel)}">
                    <span class="calc-supercharge-pips calc-supercharge-pips--compact">${pipsHtml}</span>
                </button>
            `;
        }

        superchargeHtml = `
            <div class="calc-target-modal-supercharge-wrap ${isScDisabled ? 'is-disabled' : ''}" id="calc-target-modal-supercharge-wrap">
                <div class="calc-supercharge-pills" role="radiogroup" aria-label="${escapeHTML(modalDefenseName)} ${escapeHTML(translate('views.damageCalc.offense.superchargeLabel') || 'Supercharge')}">
                    ${scPills}
                </div>
            </div>
        `;
    }

    const isAtMax = currentLevel >= maxAllowedLevel;
    const thTagText = isAtMax ? (translate('views.damageCalc.offense.thMaxTag', { th: currentTH }) || `TH ${currentTH} Max`) : '';
    const isHero = isHeroDefense(defenseKey);
    const heroTickValues = isHero ? getValidDefenseLevels(defenseKey, overallMaxLevel) : null;
    const minLevel = getMinDefenseLevel(defenseKey);

    container.innerHTML = `
        <div class="calc-target-combos-sheet" data-defense-key="${defenseKey}" data-current-level="${currentLevel}" data-active-supercharge="${effectiveSupercharge}">
            <div class="calc-target-combos-sticky-header">
                <div class="calc-target-combos-overview">
                    <div class="calc-target-combos-overview__thumb-wrapper">
                        <orecalc-assets-image
                            src="${getBuildingAssetUrl(defenseKey, currentLevel)}"
                            alt="${escapeHTML(modalDefenseName)}"
                            class="calc-target-combos-overview__thumb"
                            id="calc-target-modal-thumb"
                            size="card">
                        </orecalc-assets-image>
                        ${isCrafted ? `
                            <span class="calc-target-combos-overview__seasonal-badge" title="${escapeHTML(translate('views.damageCalc.filters.craftedDefenseTooltip'))}">
                                <orecalc-assets-svg name="timer" width="12" height="12"></orecalc-assets-svg>
                            </span>
                        ` : ''}
                    </div>
                    <div class="calc-target-combos-overview__meta">
                        <div class="calc-target-combos-overview__title-row">
                            <h3 class="calc-target-combos-overview__name">${escapeHTML(modalDefenseName)}</h3>
                            <div class="calc-target-combos-overview__actions" id="calc-target-modal-reset-wrap">
                                ${selectedSig && selectedSig !== optimalSig ? `
                                    <button type="button" class="calc-target-combos-overview__reset-btn" data-action="reset-to-optimal" data-defense-key="${defenseKey}">
                                        <orecalc-assets-svg name="undo" width="12" height="12"></orecalc-assets-svg>
                                        <span data-i18n="actions.reset">${escapeHTML(translate('actions.reset') || 'Reset')}</span>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                        <div class="calc-target-combos-overview__hp-row">
                            <span class="calc-target-combos-overview__hp" id="calc-target-modal-hp">${formatNumber(listResult.targetHp)} ${hpUnit}</span>
                            <span class="calc-target-combos-overview__sep" aria-hidden="true">&middot;</span>
                            <span class="calc-target-combos-overview__level-label" id="calc-target-modal-level-label">
                                ${getLvlShort(defenseKey)} ${currentLevel}
                                ${effectiveSupercharge > 0 ? `
                                    <span class="calc-target-combos-overview__supercharge" title="${escapeHTML(translate('views.damageCalc.offense.superchargeLabel'))} &middot; ${escapeHTML(translate('views.damageCalc.zapQuake.tierLabel', { tier: effectiveSupercharge }))}">
                                        ${renderSuperchargePipsHtml(effectiveSupercharge, getMaxSuperchargeTier(defenseKey, currentLevel), { variant: 'compact' })}
                                    </span>
                                ` : ''}
                            </span>
                            ${currentTH < 18 && isAtMax ? `<span class="calc-target-combos-overview__th-max" id="calc-target-modal-th-max">${escapeHTML(thTagText)}</span>` : ''}
                        </div>
                        <div class="calc-target-combos-overview__level-control">
                            <div class="calc-stepper-track">
                                <button type="button" class="calc-stepper-btn calc-stepper-btn--step" data-action="target-level-dec" data-defense-key="${defenseKey}" ${currentLevel <= minLevel ? 'disabled' : ''} aria-label="${escapeHTML(translate('actions.decrease'))} ${escapeHTML(modalDefenseName)} ${escapeHTML(translate('validation.level'))}">
                                    <orecalc-assets-svg name="minus"></orecalc-assets-svg>
                                </button>
                                ${renderSteppedSliderHtml({
                                    min: minLevel,
                                    max: overallMaxLevel,
                                    maxAllowed: maxAllowedLevel,
                                    value: currentLevel,
                                    id: 'calc-target-modal-level-slider',
                                    className: 'calc-target-modal-slider',
                                    wrapClassName: 'calc-target-modal-slider-wrap',
                                    dataAttributes: {
                                        action: 'target-level-slider',
                                        defenseKey: defenseKey,
                                        maxAllowed: maxAllowedLevel
                                    },
                                    ariaLabel: `${modalDefenseName} ${getLvlShort(defenseKey)}`,
                                    withTicks: true,
                                    tickValues: heroTickValues
                                })}
                                <button type="button" class="calc-stepper-btn calc-stepper-btn--step" data-action="target-level-inc" data-defense-key="${defenseKey}" ${currentLevel >= maxAllowedLevel ? 'disabled' : ''} aria-label="${escapeHTML(translate('actions.increase'))} ${escapeHTML(modalDefenseName)} ${escapeHTML(translate('validation.level'))}">
                                    <orecalc-assets-svg name="plus"></orecalc-assets-svg>
                                </button>
                            </div>
                            ${superchargeHtml}
                        </div>
                    </div>
                </div>
            </div>

            <div class="calc-target-combos-list-wrapper" id="calc-target-combos-list-wrapper">
                ${listResult.listHtml}
            </div>
        </div>
    `;
}
