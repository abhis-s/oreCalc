/**
 * Pure Domain Calculations for ZapQuake Dashboard combo bucketing, layout analysis, and sorting.
 * Tier 2: Pure Domain Math (0 side effects, 0 DOM references, 0 browser globals).
 */

import { getDefensesData } from '../../data/defenseTargetsData.js';
import { groupDefensesBySpellCombo } from './zapQuakeBatchSolver.js';
import { isSameHeroEquipment } from './damageFormulas.js';
import {
    getDefenseCategoryTier,
    isDefenseInSeason
} from './defenseProgressionDomain.js';
import { getEnabledEquipmentList } from './equipmentDamage.js';

/**
 * Resolves the unified combo buckets for all defenses on the dashboard based on active state.
 *
 * @param {Object} state - Damage calculator state.
 * @returns {Array<Object>} List of grouped combo buckets from groupDefensesBySpellCombo.
 */
export function getDashboardComboBuckets(state) {
    if (!state) return [];
    const zq = state.zapQuake || {};
    const spells = state.offense?.spells || { lightning: 13, earthquake: 8 };
    const zapLvl = spells.lightning || zq.lightningLevel || 13;
    const eqLvl = spells.earthquake || zq.earthquakeLevel || 8;
    const enabledSources = state.offense?.enabledSources || {};

    const rawTh = Number(state.playerTownHall) || 18;
    const shownTh = Math.max(9, Math.min(18, Math.floor(rawTh)));

    const zapSuperchargeTier = (shownTh < 18)
        ? 0
        : (state.globalSuperchargeTier !== undefined && state.globalSuperchargeTier !== null
            ? Math.max(0, Math.min(2, Math.floor(Number(state.globalSuperchargeTier)) || 0))
            : 2);

    const ccSpells = state.offense?.ccSpells || { lightning: 13, earthquake: 8 };
    const ccZapLvl = ccSpells.lightning || 13;
    const ccEqLvl = ccSpells.earthquake || 8;
    const isCcZapEnabled = enabledSources.cc_lightning !== false;
    const isCcEqEnabled = enabledSources.cc_earthquake !== false;

    const enabledSpells = {
        lightning: enabledSources.lightning !== false,
        earthquake: enabledSources.earthquake !== false,
        cc_lightning: isCcZapEnabled,
        cc_earthquake: isCcEqEnabled
    };

    const enabledEquipment = getEnabledEquipmentList(state);
    const activeMod = (state.modifier && state.modifier !== 'standard')
        ? state.modifier
        : (state.leagueId || state.modifier || 'standard');

    return groupDefensesBySpellCombo({
        lightningLevel: zapLvl,
        earthquakeLevel: eqLvl,
        modifier: activeMod,
        leagueId: activeMod,
        townHallLevel: shownTh,
        enabledSpells,
        enabledEquipment,
        superchargeTier: zapSuperchargeTier,
        defenseLevelOverrides: state.defenseLevelOverrides || {},
        defenseSuperchargeOverrides: state.defenseSuperchargeOverrides || {},
        selectedCombos: zq.selectedCombos || {},
        enabledBuildingGroups: state.enabledBuildingGroups,
        ccSpells: {
            lightning: isCcZapEnabled ? ccZapLvl : null,
            earthquake: isCcEqEnabled ? ccEqLvl : null
        }
    });
}

/**
 * Maps combo signatures to arrays of defense keys assigned to that combo on the dashboard.
 * Accounts for both default optimal assignments and manual user selections.
 *
 * @param {Object} state - Damage calculator state.
 * @param {string} [targetDefenseKey] - Optional target defense key to align category filter.
 * @returns {Map<string, Array<string>>} Map from combo signature to array of defense keys.
 */
export function getDashboardAssignedDefensesMap(state, targetDefenseKey) {
    const comboBuckets = getDashboardComboBuckets(state);
    const zq = state?.zapQuake || {};
    let effectiveFilter = zq.buildingFilter || 'all';
    if (targetDefenseKey) {
        const targetDef = getDefensesData()[targetDefenseKey];
        const tier = getDefenseCategoryTier(targetDefenseKey, targetDef);
        if (tier === 2) {
            effectiveFilter = 'heroes';
        } else if (tier === 3) {
            effectiveFilter = 'guardians';
        } else if (tier === 4) {
            effectiveFilter = 'other';
        } else {
            effectiveFilter = 'defenses';
        }
    }

    const map = new Map();
    for (const combo of comboBuckets) {
        if (!combo.key || !combo.defenses) continue;
        const validDefKeys = combo.defenses
            .filter(d => {
                if (!isDefenseInSeason(d.defenseKey)) return false;
                const defObj = getDefensesData()[d.defenseKey];
                const tier = getDefenseCategoryTier(d.defenseKey, defObj);

                if (effectiveFilter === 'defenses' && tier !== 1) return false;
                if (effectiveFilter === 'heroes' && tier !== 2) return false;
                if (effectiveFilter === 'guardians' && tier !== 3) return false;
                if (effectiveFilter === 'other' && tier !== 4) return false;
                return true;
            })
            .map(d => d.defenseKey);

        map.set(combo.key, validDefKeys);
    }
    return map;
}

/**
 * Determines whether a combo card qualifies for full-width grid expansion.
 *
 * Requirements:
 * 1. ONLY detailed mode (viewMode === 'detailed').
 * 2. Multi-combo precondition: Requires at least 2 active combos (allActiveCounts.length >= 2).
 *    When there is only 1 combo, the umbrella expansion logic makes no sense.
 * 3. At most ONE combo (the unique maximum) can ever expand. Tied maximums never expand.
 * 4. Substantial building count: The combo must have at least 12 defenses.
 * 5. Solitary dominant umbrella: No other combo may have a bunch of buildings (runner-up <= 8).
 * 6. High disparity: The top combo must have at least 2.0x the runner-up and >= 8 more buildings.
 *
 * @param {number} comboDefCount - Number of filtered defenses in the current combo card.
 * @param {number[]} allActiveCounts - Array of filtered defense counts across all rendered combos.
 * @param {string} viewMode - Active view mode ('compact' | 'detailed').
 * @returns {boolean} True if the card should span full width.
 */
export function shouldComboExpandFullWidth(comboDefCount, allActiveCounts, viewMode) {
    if (viewMode !== 'detailed') return false;
    if (!comboDefCount || comboDefCount < 12) return false;
    if (!Array.isArray(allActiveCounts) || allActiveCounts.length < 2) return false;

    // Must be the unique maximum combo
    const sorted = [...allActiveCounts].sort((a, b) => b - a);
    const max = sorted[0];
    if (comboDefCount !== max) return false;
    if (sorted[1] === max) return false;

    const secondMax = sorted[1] || 0;

    // Cut-off rule: If any other combo has "a bunch of buildings" (secondMax > 8),
    // do not expand to prevent stacking multiple large full-width blocks.
    if (secondMax > 8) return false;

    const isDominantRatio = secondMax === 0 || (max / secondMax >= 2.0);
    const isDominantDiff = (max - secondMax) >= 8;

    return isDominantRatio && isDominantDiff;
}

/**
 * Sorts active combination cards for the Detailed View Mode.
 *
 * Places cards with higher defense target counts first so long lists cluster
 * on the same grid line/row, while preserving all 7 canonical solver rules
 * as deterministic tiebreakers.
 *
 * @param {Array<{ combo: Object, filteredDefenses: Array<Object> }>} activeCombos - List of active combo items.
 * @returns {Array<{ combo: Object, filteredDefenses: Array<Object> }>} Sorted activeCombos array.
 */
export function sortDetailedCombos(activeCombos) {
    if (!Array.isArray(activeCombos) || activeCombos.length <= 1) {
        return activeCombos;
    }

    return activeCombos.sort((a, b) => {
        const aLen = a.filteredDefenses ? a.filteredDefenses.length : 0;
        const bLen = b.filteredDefenses ? b.filteredDefenses.length : 0;
        if (bLen !== aLen) return bLen - aLen;

        const aCombo = a.combo || {};
        const bCombo = b.combo || {};

        const aOver2 = (aCombo.equipment?.length || 0) > 2 ? 1 : 0;
        const bOver2 = (bCombo.equipment?.length || 0) > 2 ? 1 : 0;
        if (aOver2 !== bOver2) return aOver2 - bOver2;

        const aHousing = aCombo.housingSpace !== undefined ? aCombo.housingSpace : 0;
        const bHousing = bCombo.housingSpace !== undefined ? bCombo.housingSpace : 0;
        if (aHousing !== bHousing) return aHousing - bHousing;

        const aEq = aCombo.equipment ? aCombo.equipment.length : 0;
        const bEq = bCombo.equipment ? bCombo.equipment.length : 0;
        if (aEq !== bEq) return bEq - aEq;

        if (aEq >= 2 && bEq >= 2) {
            const aSame = isSameHeroEquipment(aCombo.equipment) ? 1 : 0;
            const bSame = isSameHeroEquipment(bCombo.equipment) ? 1 : 0;
            if (aSame !== bSame) return bSame - aSame;
        }

        const aCc = (aCombo.ccEqCount || 0) + (aCombo.ccZapCount || 0);
        const bCc = (bCombo.ccEqCount || 0) + (bCombo.ccZapCount || 0);
        if (aCc !== bCc) return aCc - bCc;

        const aEqCount = aCombo.eqCount !== undefined ? aCombo.eqCount : (aCombo.regEqCount !== undefined ? aCombo.regEqCount : 0);
        const bEqCount = bCombo.eqCount !== undefined ? bCombo.eqCount : (bCombo.regEqCount !== undefined ? bCombo.regEqCount : 0);
        if (aEqCount !== bEqCount) return bEqCount - aEqCount;

        const aZapCount = aCombo.zapCount !== undefined ? aCombo.zapCount : (aCombo.regZapCount !== undefined ? aCombo.regZapCount : 0);
        const bZapCount = bCombo.zapCount !== undefined ? bCombo.zapCount : (bCombo.regZapCount !== undefined ? bCombo.regZapCount : 0);
        return aZapCount - bZapCount;
    });
}
