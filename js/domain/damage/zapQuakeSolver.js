/**
 * Pure Domain Calculations for ZapQuake Spell Combinations & Diminishing Returns.
 * Tier 2: Pure Domain Math (0 side effects, 0 DOM references, 0 browser globals).
 */

import { getDefensesData } from '../../data/defenseTargetsData.js';
import { spellsData } from '../../data/spellsData.js';
import {
    getSpellCapacities,
    calculateEarthquakeDamage,
    calculateEarthquakeDamageWithPools,
    calculateRequiredZapsTwoPools,
    isSameHeroEquipment,
    getEffectiveEquipmentLevel,
    calculateEquipmentTargetDamage,
    isValidHeroEquipmentCombo,
    isTargetImmuneToSpell
} from './damageFormulas.js';
import {
    getDefenseMaxHp,
    canEquipmentTarget
} from './defenseProgressionDomain.js';

/**
 * Computes all viable Lightning and Earthquake spell combinations to destroy a defensive structure.
 *
 * @param {string} defenseKey - Defense identifier.
 * @param {number} defenseLevel - Defense level.
 * @param {number} [lightningLevel=13] - Lightning Spell level (1 to 13).
 * @param {number} [eqLevel=8] - Earthquake Spell level (1 to 8).
 * @param {Object} [options={}] - Calculation options.
 * @param {number} [options.superchargeTier=0] - Supercharge tier (0, 1, 2).
 * @param {number} [options.townHallLevel=18] - Target Town Hall level for spell capacity limit.
 * @param {number} [options.regularSpellCapacity] - Optional explicit regular army spell capacity override.
 * @param {number} [options.ccSpellCapacity] - Optional explicit Clan Castle spell capacity override.
 * @param {number} [options.maxEq=4] - Maximum Earthquake spells to test in combinations (defaults to 4, or up to spell capacity if remaining HP <= 67.7%).
 * @param {number} [options.maxHousingSpace] - Max spell housing space allowed.
 * @param {Object} [options.enabledSpells] - Allowed spells map.
 * @param {Object} [options.enabledSources] - Allowed damage sources map.
 * @param {Array<Object>} [options.enabledEquipment] - Allowed equipment array.
 * @param {string} [options.modifier] - Battle modifier key ('standard', 'legend3', 'legend2', 'legend1', 'esports').
 * @param {string} [options.modifierKey] - Alias for modifier key.
 * @param {string} [options.leagueId='standard'] - Battle modifier / league id.
 * @param {{ lightning?: number, earthquake?: number }} [options.ccSpells] - Donated Clan Castle spell levels.
 * @param {boolean} [options.includeStepDetails=true] - Whether to include detailed execution steps in combination candidates.
 * @returns {Object} Optimal spell combination, all valid candidates, and metadata.
 */
export function solveZapQuakeCombinations(defenseKey, defenseLevel = 1, lightningLevel = 13, eqLevel = 8, options = {}) {
    const def = getDefensesData()[defenseKey];
    if (!def) {
        return { optimalCombination: null, candidates: [], totalCombinationsTested: 0, reason: 'invalid_defense' };
    }

    const superchargeTier = options.superchargeTier || 0;
    const targetHp = getDefenseMaxHp(defenseKey, defenseLevel, {
        modifier: options.modifier,
        superchargeTier,
        leagueId: options.leagueId
    });

    // Explicit immunities check
    const isImmuneToLightning = isTargetImmuneToSpell(defenseKey, 'lightning', def);
    const isImmuneToEarthquake = isTargetImmuneToSpell(defenseKey, 'earthquake', def);

    const zapDmg = spellsData.spells.lightning.levels[lightningLevel]?.damage || 720;
    const th = Number(options.townHallLevel ?? (/** @type {any} */ (options)).playerTownHall) || 18;
    const defaultCaps = getSpellCapacities(th);
    const regCap = options.regularSpellCapacity != null ? Number(options.regularSpellCapacity) : defaultCaps.regularCapacity;
    const ccCap = options.ccSpellCapacity != null ? Number(options.ccSpellCapacity) : defaultCaps.ccCapacity;
    const maxTotalHousing = options.maxHousingSpace != null
        ? Math.min(Number(options.maxHousingSpace) || 0, regCap + ccCap)
        : (regCap + ccCap);

    const isRegZapAllowed = !isImmuneToLightning && (options.enabledSpells?.regularLightning !== undefined
        ? Boolean(options.enabledSpells.regularLightning)
        : (options.enabledSources?.lightning !== undefined
            ? Boolean(options.enabledSources.lightning)
            : options.enabledSpells?.lightning !== false));

    const isCcZapAllowed = !isImmuneToLightning && (options.enabledSpells?.ccLightning !== undefined
        ? Boolean(options.enabledSpells.ccLightning)
        : (options.enabledSources?.cc_lightning !== undefined
            ? Boolean(options.enabledSources.cc_lightning)
            : (options.enabledSpells?.cc_lightning !== undefined
                ? Boolean(options.enabledSpells.cc_lightning)
                : (options.ccSpells?.lightning != null && ccCap > 0))));

    const isRegEqAllowed = !isImmuneToEarthquake && (options.enabledSpells?.regularEarthquake !== undefined
        ? Boolean(options.enabledSpells.regularEarthquake)
        : (options.enabledSources?.earthquake !== undefined
            ? Boolean(options.enabledSources.earthquake)
            : options.enabledSpells?.earthquake !== false));

    const isCcEqAllowed = !isImmuneToEarthquake && (options.enabledSpells?.ccEarthquake !== undefined
        ? Boolean(options.enabledSpells.ccEarthquake)
        : (options.enabledSources?.cc_earthquake !== undefined
            ? Boolean(options.enabledSources.cc_earthquake)
            : (options.enabledSpells?.cc_earthquake !== undefined
                ? Boolean(options.enabledSpells.cc_earthquake)
                : (options.ccSpells?.earthquake != null && ccCap > 0))));

    const ccEqLevel = options.ccSpells?.earthquake != null ? Number(options.ccSpells.earthquake) : eqLevel;
    const ccLightningLevel = options.ccSpells?.lightning != null ? Number(options.ccSpells.lightning) : lightningLevel;
    const ccZapDmg = spellsData.spells.lightning.levels[ccLightningLevel]?.damage || zapDmg;

    /** @type {Array<Object>} */
    const candidates = [];

    // Build combination search space: pure spells, single equipment, or equipment pairs (for high HP)
    const leagueId = options.leagueId || 'standard';
    const rawEquipmentList = options.enabledEquipment || [];
    const enabledEquipment = rawEquipmentList
        .filter(eqItem => canEquipmentTarget(eqItem.id, defenseKey, defenseLevel))
        .map(eqItem => {
            const rawLevel = eqItem.rawLevel || eqItem.level || 18;
            const effectiveLevel = getEffectiveEquipmentLevel(eqItem.id, rawLevel, leagueId);
            return {
                id: eqItem.id,
                level: effectiveLevel,
                rawLevel
            };
        });
    const equipCombos = [[]];

    for (const eqItem of enabledEquipment) {
        equipCombos.push([eqItem]);
    }

    if (targetHp >= 3500 && enabledEquipment.length >= 2) {
        for (let i = 0; i < enabledEquipment.length; i++) {
            for (let j = i + 1; j < enabledEquipment.length; j++) {
                equipCombos.push([enabledEquipment[i], enabledEquipment[j]]);
            }
        }

        if (enabledEquipment.length >= 3) {
            for (let i = 0; i < enabledEquipment.length; i++) {
                for (let j = i + 1; j < enabledEquipment.length; j++) {
                    for (let k = j + 1; k < enabledEquipment.length; k++) {
                        const triplet = [enabledEquipment[i], enabledEquipment[j], enabledEquipment[k]];
                        if (isValidHeroEquipmentCombo(triplet)) {
                            equipCombos.push(triplet);
                        }
                    }
                }
            }
        }

        if (enabledEquipment.length >= 4) {
            for (let i = 0; i < enabledEquipment.length; i++) {
                for (let j = i + 1; j < enabledEquipment.length; j++) {
                    for (let k = j + 1; k < enabledEquipment.length; k++) {
                        for (let m = k + 1; m < enabledEquipment.length; m++) {
                            const quad = [enabledEquipment[i], enabledEquipment[j], enabledEquipment[k], enabledEquipment[m]];
                            if (isValidHeroEquipmentCombo(quad)) {
                                equipCombos.push(quad);
                            }
                        }
                    }
                }
            }
        }
    }

    for (const equipList of equipCombos) {
        let equipDamage = 0;
        for (const item of equipList) {
            equipDamage += calculateEquipmentTargetDamage(item.id, item.level, defenseKey, targetHp, { level: defenseLevel });
        }

        const remainingAfterEquip = Math.max(0, targetHp - equipDamage);
        const remainingFraction = targetHp > 0 ? (remainingAfterEquip / targetHp) : 0;
        const maxEqLimit = (options.maxEq != null)
            ? options.maxEq
            : (remainingFraction <= 0.677 ? maxTotalHousing : 4);
        const curMaxRegEq = isRegEqAllowed ? Math.min(maxEqLimit, regCap) : 0;
        const curMaxCcEq = isCcEqAllowed ? Math.min(maxEqLimit, ccCap) : 0;

        // Target destroyed by equipment alone (0 spell housing space)
        if (remainingAfterEquip === 0 && equipList.length > 0) {
            candidates.push({
                equipment: equipList,
                isSameHero: isSameHeroEquipment(equipList),
                eqCount: 0,
                zapCount: 0,
                regEqCount: 0,
                ccEqCount: 0,
                regZapCount: 0,
                ccZapCount: 0,
                totalHousingSpace: 0,
                regHousingSpace: 0,
                ccHousingSpace: 0,
                totalDamage: equipDamage,
                overkill: equipDamage - targetHp,
                eqLevel,
                ccEqLevel,
                lightningLevel,
                ccLightningLevel
            });
            continue;
        }

        // Combine with spells to finish off remaining HP
        for (let eqReg = 0; eqReg <= curMaxRegEq; eqReg++) {
            for (let eqCc = 0; eqCc <= curMaxCcEq; eqCc++) {
                const totalEq = eqReg + eqCc;
                if (totalEq > maxTotalHousing) continue;
                if (totalEq > maxEqLimit) continue;
                if (!isRegZapAllowed && !isCcZapAllowed && totalEq === 0) continue;

                const eqDamage = totalEq > 0
                    ? calculateEarthquakeDamageWithPools(targetHp, eqReg, eqLevel, eqCc, ccEqLevel, defenseKey)
                    : 0;
                const remainingHp = Math.max(0, remainingAfterEquip - eqDamage);

                /** @type {Array<{ regZaps: number, ccZaps: number, totalZapDamage: number }>} */
                const zapAllocations = [];

                if (remainingHp === 0) {
                    zapAllocations.push({ regZaps: 0, ccZaps: 0, totalZapDamage: 0 });
                } else {
                    if (!isRegZapAllowed && !isCcZapAllowed) continue;
                    const availRegZap = isRegZapAllowed ? Math.max(0, regCap - eqReg) : 0;
                    const availCcZap = isCcZapAllowed ? Math.max(0, ccCap - eqCc) : 0;

                    const zapRes = calculateRequiredZapsTwoPools(remainingHp, zapDmg, ccZapDmg, availRegZap, availCcZap);
                    if (zapRes.possible) {
                        zapAllocations.push({
                            regZaps: zapRes.regZapCount,
                            ccZaps: zapRes.ccZapCount,
                            totalZapDamage: zapRes.totalZapDamage
                        });
                    }

                    if (isRegZapAllowed && availRegZap > 0 && zapDmg > 0) {
                        const regNeeded = Math.ceil(remainingHp / zapDmg);
                        if (regNeeded <= availRegZap) {
                            zapAllocations.push({
                                regZaps: regNeeded,
                                ccZaps: 0,
                                totalZapDamage: regNeeded * zapDmg
                            });
                        } else if (isCcZapAllowed && availCcZap > 0 && ccZapDmg > 0) {
                            const remAfterReg = remainingHp - (availRegZap * zapDmg);
                            const ccNeeded = Math.ceil(remAfterReg / ccZapDmg);
                            if (ccNeeded <= availCcZap) {
                                zapAllocations.push({
                                    regZaps: availRegZap,
                                    ccZaps: ccNeeded,
                                    totalZapDamage: (availRegZap * zapDmg) + (ccNeeded * ccZapDmg)
                                });
                            }
                        }
                    }

                    if (isCcZapAllowed && availCcZap > 0 && ccZapDmg > 0 && zapDmg > ccZapDmg) {
                        const ccNeeded = Math.ceil(remainingHp / ccZapDmg);
                        if (ccNeeded <= availCcZap) {
                            zapAllocations.push({
                                regZaps: 0,
                                ccZaps: ccNeeded,
                                totalZapDamage: ccNeeded * ccZapDmg
                            });
                        }
                    }
                }

                for (const zapAlloc of zapAllocations) {
                    const regZapsNeeded = zapAlloc.regZaps;
                    const ccZapsNeeded = zapAlloc.ccZaps;
                    const totalZapDamage = zapAlloc.totalZapDamage;
                    const totalHousing = totalEq + regZapsNeeded + ccZapsNeeded;
                    if (totalHousing <= maxTotalHousing) {
                        const totalDamage = equipDamage + eqDamage + totalZapDamage;
                        candidates.push({
                            equipment: equipList,
                            isSameHero: isSameHeroEquipment(equipList),
                            eqCount: totalEq,
                            zapCount: regZapsNeeded + ccZapsNeeded,
                            regEqCount: eqReg,
                            ccEqCount: eqCc,
                            regZapCount: regZapsNeeded,
                            ccZapCount: ccZapsNeeded,
                            totalHousingSpace: totalHousing,
                            regHousingSpace: eqReg + regZapsNeeded,
                            ccHousingSpace: eqCc + ccZapsNeeded,
                            totalDamage,
                            overkill: totalDamage - targetHp,
                            eqLevel,
                            ccEqLevel,
                            lightningLevel,
                            ccLightningLevel
                        });
                    }
                }
            }
        }
    }

    // Sort combinations by equipment count, housing space, synergy, donation burden, and spell preferences
    candidates.sort((a, b) => {
        const aEq = a.equipment ? a.equipment.length : 0;
        const bEq = b.equipment ? b.equipment.length : 0;
        const aOver2 = aEq > 2 ? 1 : 0;
        const bOver2 = bEq > 2 ? 1 : 0;
        if (aOver2 !== bOver2) {
            return aOver2 - bOver2;
        }

        if (a.totalHousingSpace !== b.totalHousingSpace) {
            return a.totalHousingSpace - b.totalHousingSpace;
        }
        if (aEq !== bEq) {
            return aEq - bEq;
        }
        if (aEq >= 2 && bEq >= 2) {
            const aSame = a.isSameHero ? 1 : 0;
            const bSame = b.isSameHero ? 1 : 0;
            if (aSame !== bSame) {
                return bSame - aSame;
            }
        }
        if (a.totalHousingSpace === 0 && b.totalHousingSpace === 0) {
            if (a.totalDamage !== b.totalDamage) {
                return b.totalDamage - a.totalDamage;
            }
        }
        if (a.ccHousingSpace !== b.ccHousingSpace) {
            return a.ccHousingSpace - b.ccHousingSpace;
        }
        if (a.eqCount !== b.eqCount) {
            return b.eqCount - a.eqCount;
        }
        return a.zapCount - b.zapCount;
    });

    const uniqueCandidates = deduplicateCandidates(candidates);
    const nonDominatedCandidates = filterDominatedCombos(uniqueCandidates);

    for (const combo of nonDominatedCandidates) {
        attachLazyStepDetails(combo, {
            targetHp,
            regEqCount: combo.regEqCount,
            ccEqCount: combo.ccEqCount,
            regZapCount: combo.regZapCount,
            ccZapCount: combo.ccZapCount,
            eqLevel: combo.eqLevel,
            ccEqLevel: combo.ccEqLevel,
            zapDmg,
            ccZapDmg,
            lightningLevel: combo.lightningLevel,
            ccLightningLevel: combo.ccLightningLevel,
            equipmentList: combo.equipment || [],
            options,
            defenseKey,
            defenseLevel
        });
    }

    /** @type {Object|null} */
    let bestAttempt = null;
    let failureReason = undefined;

    if (uniqueCandidates.length === 0) {
        let maxAttemptDamage = -1;
        for (const equipList of equipCombos) {
            let equipDmg = 0;
            const equipDetails = [];
            for (const item of equipList) {
                const dmg = calculateEquipmentTargetDamage(item.id, item.level, defenseKey, targetHp, { level: defenseLevel });
                equipDmg += dmg;
                equipDetails.push({ id: item.id, level: item.level, rawLevel: item.rawLevel, damage: dmg });
            }

            const remainingAfterEquip = Math.max(0, targetHp - equipDmg);
            const remainingFraction = targetHp > 0 ? (remainingAfterEquip / targetHp) : 0;
            const maxEqLimit = (options.maxEq != null)
                ? options.maxEq
                : (remainingFraction <= 0.677 ? maxTotalHousing : 4);
            const curMaxRegEq = isRegEqAllowed ? Math.min(maxEqLimit, regCap) : 0;
            const curMaxCcEq = isCcEqAllowed ? Math.min(maxEqLimit, ccCap) : 0;

            for (let eqReg = 0; eqReg <= curMaxRegEq; eqReg++) {
                for (let eqCc = 0; eqCc <= curMaxCcEq; eqCc++) {
                    const totalEq = eqReg + eqCc;
                    if (totalEq > maxTotalHousing) continue;
                    if (totalEq > maxEqLimit) continue;
                    const eqDmg = totalEq > 0
                        ? calculateEarthquakeDamageWithPools(targetHp, eqReg, eqLevel, eqCc, ccEqLevel, defenseKey)
                        : 0;

                    const availRegZap = isRegZapAllowed ? Math.min(Math.max(0, regCap - eqReg), Math.max(0, maxTotalHousing - totalEq)) : 0;
                    const availCcZap = isCcZapAllowed ? Math.min(Math.max(0, ccCap - eqCc), Math.max(0, maxTotalHousing - totalEq - availRegZap)) : 0;
                    const zapDmgTotal = (availRegZap * zapDmg) + (availCcZap * ccZapDmg);

                    const totalDmg = Math.min(targetHp, equipDmg + eqDmg + zapDmgTotal);
                    if (totalDmg > maxAttemptDamage) {
                        maxAttemptDamage = totalDmg;
                        bestAttempt = {
                            equipment: equipDetails,
                            regEqCount: eqReg,
                            ccEqCount: eqCc,
                            eqCount: totalEq,
                            regZapCount: availRegZap,
                            ccZapCount: availCcZap,
                            zapCount: availRegZap + availCcZap,
                            equipDamage: equipDmg,
                            eqDamage: eqDmg,
                            zapDamage: zapDmgTotal,
                            totalDamage: totalDmg,
                            remainingHp: Math.max(0, targetHp - totalDmg),
                            percentDealt: targetHp > 0 ? (totalDmg / targetHp) * 100 : 0,
                            percentRemaining: targetHp > 0 ? (Math.max(0, targetHp - totalDmg) / targetHp) * 100 : 0
                        };
                    }
                }
            }
        }

        if (isImmuneToLightning && isImmuneToEarthquake && enabledEquipment.length === 0) {
            failureReason = 'immune_to_both_spells';
        } else if (isImmuneToLightning && enabledEquipment.length === 0 && !isRegEqAllowed && !isCcEqAllowed) {
            failureReason = 'immune_to_lightning';
        } else if (isImmuneToEarthquake && enabledEquipment.length === 0 && !isRegZapAllowed && !isCcZapAllowed) {
            failureReason = 'immune_to_earthquake';
        } else {
            failureReason = (isImmuneToLightning && isImmuneToEarthquake)
                ? 'immune_to_both_spells'
                : 'insufficient_spell_capacity';
        }
    }

    return {
        defenseKey,
        defenseLevel,
        targetHp,
        isImmuneToLightning,
        isImmuneToEarthquake,
        optimalCombination: nonDominatedCandidates[0] || null,
        combinations: nonDominatedCandidates,
        bestAttempt,
        reason: failureReason
    };
}

/**
 * Returns a unique deterministic signature string for a combination.
 *
 * @param {Object} combo - Combination candidate.
 * @returns {string} Unique combination signature.
 */
export function getComboSignature(combo) {
    if (!combo) return '';
    const equipKey = (combo.equipment || []).map(e => `${e.id}_${e.level}`).sort().join('__');
    const regEq = combo.regEqCount ?? combo.eqCount ?? 0;
    const ccEq = combo.ccEqCount ?? 0;
    const regZap = combo.regZapCount ?? combo.zapCount ?? 0;
    const ccZap = combo.ccZapCount ?? 0;
    return equipKey
        ? `${equipKey}__${regEq}eq_${regZap}zap__cc_${ccEq}eq_${ccZap}zap`
        : `${regEq}eq_${regZap}zap__cc_${ccEq}eq_${ccZap}zap`;
}

/**
 * Calculates higher-level (or duplicate CC) spell burden for a combination candidate.
 * When levels are identical, CC spells are treated as higher burden to prefer regular spells.
 * When levels differ, the higher-level spell pool carries the burden.
 *
 * @param {Object} combo - Candidate combination.
 * @returns {{ eqBurden: number, zapBurden: number }}
 */
function getSpellTierBurden(combo) {
    const eqLvl = combo.eqLevel ?? 8;
    const ccEqLvl = combo.ccEqLevel ?? eqLvl;
    const zapLvl = combo.lightningLevel ?? 13;
    const ccZapLvl = combo.ccLightningLevel ?? zapLvl;

    const ccEq = combo.ccEqCount ?? 0;
    const regEq = combo.regEqCount ?? combo.eqCount ?? 0;
    const ccZap = combo.ccZapCount ?? 0;
    const regZap = combo.regZapCount ?? combo.zapCount ?? 0;

    const eqBurden = eqLvl <= ccEqLvl ? ccEq : regEq;
    const zapBurden = zapLvl <= ccZapLvl ? ccZap : regZap;

    return { eqBurden, zapBurden };
}

/**
 * Filters out Pareto-dominated and redundant combination candidates with identical equipment.
 *
 * Dominance Rules:
 * 1. Total Spell Count Dominance:
 *    A candidate is pruned if another candidate requires less than or equal counts
 *    of every spell type and strictly fewer in at least one spell type.
 * 2. Equal Count Spell Tier & Duplicate Pruning:
 *    When two candidates share identical equipment and identical total spell counts:
 *    - If spell levels are identical, exact duplicate combinations using CC spells
 *      are pruned in favor of regular spells.
 *    - If spell levels differ, the candidate using higher-level spells is pruned
 *      in favor of the lower-level spell option when the spell count for destruction
 *      is the same.
 *
 * @param {Array<Object>} candidates - Combination candidates.
 * @returns {Array<Object>} Filtered candidates with dominated combinations removed.
 */
export function filterDominatedCombos(candidates) {
    if (!Array.isArray(candidates) || candidates.length <= 1) return candidates || [];

    // Group candidates by equipment key so comparisons only run between identical equipment sets
    const groups = new Map();
    for (const c of candidates) {
        const key = (c.equipment || []).map(e => `${e.id}_${e.level}`).sort().join('__');
        let arr = groups.get(key);
        if (!arr) {
            arr = [];
            groups.set(key, arr);
        }
        arr.push(c);
    }

    const result = [];
    for (const group of groups.values()) {
        if (group.length === 1) {
            result.push(group[0]);
            continue;
        }

        const stats = group.map(c => {
            const regEq = c.regEqCount ?? c.eqCount ?? 0;
            const ccEq = c.ccEqCount ?? 0;
            const regZap = c.regZapCount ?? c.zapCount ?? 0;
            const ccZap = c.ccZapCount ?? 0;
            return {
                candidate: c,
                eq: regEq + ccEq,
                zap: regZap + ccZap,
                burden: getSpellTierBurden(c)
            };
        });

        for (let i = 0; i < stats.length; i++) {
            const c = stats[i];
            let isDominated = false;
            for (let j = 0; j < stats.length; j++) {
                if (i === j) continue;
                const o = stats[j];

                // Strict Pareto dominance (strictly fewer spells of at least one type)
                if (o.eq <= c.eq && o.zap <= c.zap && (o.eq < c.eq || o.zap < c.zap)) {
                    isDominated = true;
                    break;
                }

                // Equal total spell counts: prune exact duplicate CC spells & higher-level spell options
                if (o.eq === c.eq && o.zap === c.zap) {
                    const oBurden = o.burden;
                    const cBurden = c.burden;
                    if (oBurden.eqBurden <= cBurden.eqBurden &&
                        oBurden.zapBurden <= cBurden.zapBurden &&
                        (oBurden.eqBurden < cBurden.eqBurden || oBurden.zapBurden < cBurden.zapBurden)) {
                        isDominated = true;
                        break;
                    }
                }
            }
            if (!isDominated) {
                result.push(c.candidate);
            }
        }
    }
    return result;
}

/**
 * Deduplicates combination candidates by spell and equipment composition.
 *
 * @param {Array<Object>} list - Combination list.
 * @returns {Array<Object>} Deduplicated combination list.
 */
function deduplicateCandidates(list) {
    const seen = new Set();
    const result = [];
    for (const c of list) {
        const key = getComboSignature(c);
        if (!seen.has(key)) {
            seen.add(key);
            result.push(c);
        }
    }
    return result;
}

/**
 * Builds chronological strike breakdown steps for a combination.
 * Supports both options object and positional parameter signatures for backward compatibility.
 *
 * @param {Object | number} firstArg - Parameters object or target max hit points.
 * @param {number} [eqCount=0] - Legacy earthquake spells count.
 * @param {number} [zapCount=0] - Legacy lightning spells count.
 * @param {number} [eqLevel=8] - Legacy earthquake spell level.
 * @param {number} [zapDmg=720] - Legacy lightning spell damage.
 * @param {Array<Object>} [equipmentList=[]] - Equipment used.
 * @param {Object} [options={}] - Calculation options.
 * @param {string} [defenseKey=''] - Building key.
 * @param {number|null} [defenseLevel=null] - Defense level.
 * @returns {Array<Object>} Ordered steps with remaining HP.
 */
function buildStepDetails(firstArg, eqCount = 0, zapCount = 0, eqLevel = 8, zapDmg = 720, equipmentList = [], options = {}, defenseKey = '', defenseLevel = null) {
    let params;
    if (typeof firstArg === 'object' && firstArg !== null && 'targetHp' in firstArg) {
        params = firstArg;
    } else {
        const legacyCcZap = options?.ccSpells?.lightning != null
            ? (spellsData.spells.lightning.levels[options.ccSpells.lightning]?.damage || zapDmg)
            : zapDmg;
        params = {
            targetHp: firstArg,
            regEqCount: eqCount,
            ccEqCount: 0,
            regZapCount: zapCount,
            ccZapCount: 0,
            eqLevel,
            ccEqLevel: options?.ccSpells?.earthquake ?? eqLevel,
            zapDmg,
            ccZapDmg: legacyCcZap,
            lightningLevel: options?.lightningLevel ?? 13,
            ccLightningLevel: options?.ccSpells?.lightning ?? 13,
            equipmentList,
            options,
            defenseKey,
            defenseLevel
        };
    }

    const {
        targetHp,
        regEqCount = 0,
        ccEqCount = 0,
        regZapCount = 0,
        ccZapCount = 0,
        eqLevel: strikeEqLevel = 8,
        ccEqLevel: strikeCcEqLevel = 8,
        zapDmg: strikeZapDmg = 720,
        ccZapDmg: strikeCcZapDmg = 720,
        lightningLevel: strikeLightningLevel = 13,
        ccLightningLevel: strikeCcLightningLevel = 13,
        equipmentList: equipItems = [],
        defenseKey: dKey = '',
        defenseLevel: dLevel = null
    } = params;

    const steps = [];
    let currentHp = targetHp;

    // Hero Equipment strikes fire first
    for (const item of equipItems) {
        const dmg = calculateEquipmentTargetDamage(item.id, item.level, dKey, targetHp, { level: dLevel });
        const actualDmg = Math.min(currentHp, dmg);
        currentHp -= actualDmg;
        steps.push({
            type: 'equipment',
            id: item.id,
            level: item.level,
            rawLevel: item.rawLevel || item.level,
            damageDealt: actualDmg,
            remainingHp: currentHp,
            percentRemaining: Math.round((currentHp / targetHp) * 1000) / 10
        });
        if (currentHp <= 0) break;
    }

    // Earthquakes are cast next to maximize diminishing returns percentage
    if (currentHp > 0 && (regEqCount > 0 || ccEqCount > 0)) {
        const eqStrikes = [];
        if (strikeCcEqLevel > strikeEqLevel) {
            for (let i = 0; i < ccEqCount; i++) eqStrikes.push({ level: strikeCcEqLevel, isDonated: true });
            for (let i = 0; i < regEqCount; i++) eqStrikes.push({ level: strikeEqLevel, isDonated: false });
        } else {
            for (let i = 0; i < regEqCount; i++) eqStrikes.push({ level: strikeEqLevel, isDonated: false });
            for (let i = 0; i < ccEqCount; i++) eqStrikes.push({ level: strikeCcEqLevel, isDonated: true });
        }

        let damagingStrikeIndex = 1;
        for (let i = 1; i <= eqStrikes.length; i++) {
            const strike = eqStrikes[i - 1];
            const dmg = calculateEarthquakeDamage(targetHp, strike.level, damagingStrikeIndex, dKey);
            if (dmg > 0) damagingStrikeIndex++;
            const actualDmg = Math.min(currentHp, dmg);
            currentHp -= actualDmg;
            steps.push({
                spell: 'earthquake',
                index: i,
                level: strike.level,
                isDonated: strike.isDonated,
                damageDealt: actualDmg,
                remainingHp: currentHp,
                percentRemaining: Math.round((currentHp / targetHp) * 1000) / 10
            });
            if (currentHp <= 0) break;
        }
    }

    // Lightnings follow to finish off remaining HP
    if (currentHp > 0 && (regZapCount > 0 || ccZapCount > 0)) {
        const zapStrikes = [];
        if (strikeCcZapDmg > strikeZapDmg) {
            for (let j = 0; j < ccZapCount; j++) zapStrikes.push({ level: strikeCcLightningLevel, dmg: strikeCcZapDmg, isDonated: true });
            for (let j = 0; j < regZapCount; j++) zapStrikes.push({ level: strikeLightningLevel, dmg: strikeZapDmg, isDonated: false });
        } else {
            for (let j = 0; j < regZapCount; j++) zapStrikes.push({ level: strikeLightningLevel, dmg: strikeZapDmg, isDonated: false });
            for (let j = 0; j < ccZapCount; j++) zapStrikes.push({ level: strikeCcLightningLevel, dmg: strikeCcZapDmg, isDonated: true });
        }

        for (let j = 1; j <= zapStrikes.length; j++) {
            const strike = zapStrikes[j - 1];
            const actualDmg = Math.min(currentHp, strike.dmg);
            currentHp -= actualDmg;
            steps.push({
                spell: 'lightning',
                index: j,
                level: strike.level,
                isDonated: strike.isDonated,
                damageDealt: actualDmg,
                remainingHp: currentHp,
                percentRemaining: Math.round((currentHp / targetHp) * 1000) / 10
            });
            if (currentHp <= 0) break;
        }
    }

    return steps;
}

/**
 * Attaches a lazy memoized stepDetails getter to a combination candidate.
 * Defers chronological strike breakdown construction until explicitly accessed.
 *
 * @param {Object} candidate - Combination candidate object.
 * @param {Object} params - Step details construction parameters.
 */
function attachLazyStepDetails(candidate, params) {
    Object.defineProperty(candidate, 'stepDetails', {
        configurable: true,
        enumerable: true,
        get() {
            const details = buildStepDetails(params);
            Object.defineProperty(this, 'stepDetails', {
                value: details,
                writable: true,
                configurable: true,
                enumerable: true
            });
            return details;
        }
    });
}

/**
 * Partitions combinations into optimal (< threshold spells) and non-optimal (>= threshold spells).
 *
 * @param {Array<Object>} combinations - List of non-dominated combinations.
 * @param {number} [threshold=6] - Maximum spell count for optimal classification.
 * @returns {{ optimal: Array<Object>, nonOptimal: Array<Object> }}
 */
export function partitionOptimalCombos(combinations, threshold = 6) {
    if (!Array.isArray(combinations)) {
        return { optimal: [], nonOptimal: [] };
    }
    const optimal = [];
    const nonOptimal = [];
    for (const combo of combinations) {
        const spellCount = combo.totalHousingSpace ?? ((combo.eqCount || 0) + (combo.zapCount || 0));
        if (spellCount < threshold) {
            optimal.push(combo);
        } else {
            nonOptimal.push(combo);
        }
    }
    return { optimal, nonOptimal };
}
