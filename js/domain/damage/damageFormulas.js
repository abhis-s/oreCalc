/**
 * Pure Mathematical Domain Calculations for Equipment, Spells, and Target Damage.
 * Tier 2: Pure Domain Math (0 side effects, 0 DOM references, 0 browser globals).
 */

import { getDefensesData } from '../../data/defenseTargetsData.js';
import { spellsData } from '../../data/spellsData.js';
import { equipmentDamageData } from '../../data/equipmentDamageData.js';
import { battleModifiersData } from '../../data/battleModifiersData.js';
import { canEquipmentTarget, isUnitTarget } from './defenseProgressionDomain.js';

/**
 * Resolves the effective equipment level taking competitive modifier level loss into account (Esports Mode).
 *
 * @param {string} equipmentId - Equipment identifier.
 * @param {number} requestedLevel - User's chosen level.
 * @param {string} [modifierKey='standard'] - Battle modifier key ('standard', 'legend3', 'legend2', 'legend1', 'esports').
 * @returns {number} Effective level after applying modifier level loss.
 */
export function getEffectiveEquipmentLevel(equipmentId, requestedLevel, modifierKey = 'standard') {
    const equip = equipmentDamageData[equipmentId];
    if (!equip) return Math.max(1, requestedLevel || 1);

    const league = battleModifiersData.leagues[modifierKey] || battleModifiersData.leagues.standard;
    const isEpic = equip.rarity === 'epic';
    const loss = isEpic ? (league.equipLevelLossEpic || 0) : (league.equipLevelLossCommon || 0);

    const maxLevel = equip.maxLevel || (isEpic ? 27 : 18);
    const validLevel = Math.min(Math.max(1, requestedLevel || 1), maxLevel);

    return Math.max(1, validLevel - loss);
}

/**
 * Calculates raw burst damage dealt by hero equipment to a specific target structure.
 * Pure mathematical calculation without browser dependencies.
 *
 * @param {string} equipmentId - Equipment identifier.
 * @param {number} effectiveLevel - Effective equipment level after league modifiers.
 * @param {string} defenseKey - Target defense key.
 * @param {number} targetMaxHp - Target max hitpoints.
 * @param {number|Object} [options={}] - Calculation options or target level.
 * @returns {number} Hitpoints damage dealt.
 */
export function calculateEquipmentTargetDamage(equipmentId, effectiveLevel, defenseKey, targetMaxHp, options = {}) {
    const equip = equipmentDamageData[equipmentId];
    if (!equip || targetMaxHp <= 0) return 0;
    if (!canEquipmentTarget(equipmentId, defenseKey, options)) return 0;

    const validLevel = Math.max(1, effectiveLevel || 1);
    const def = getDefensesData()[defenseKey];

    switch (equip.id) {
        case 'giant_arrow': {
            const base = equip.damageByLevel[validLevel] || 0;
            const mult = (def?.damageMultipliers?.giant_arrow) || (defenseKey === 'air_defense' ? (equip.airDefenseMultiplier || 2.0) : 1.0);
            return Math.floor(base * mult);
        }
        case 'fireball':
        case 'spiky_ball':
        case 'seeking_shield':
        case 'flame_blower':
        case 'rocket_backpack': {
            return equip.damageByLevel[validLevel] || 0;
        }
        default:
            return 0;
    }
}

/**
 * Calculates damage dealt by the N-th Earthquake strike on a target with specified max HP.
 * Diminishing returns series: Strike N deals basePct / (2N - 1) of max HP.
 * Defending heroes and guardians take troop damage percentage (0% for L1-5, 5% for L6, 10% for L7, 14.5% for L8).
 *
 * @param {number} maxHp - Target maximum hit points.
 * @param {number} eqLevel - Earthquake spell level (1 to 8).
 * @param {number} [strikeIndex=1] - 1-indexed strike sequence number (1, 2, 3...).
 * @param {string|Object} [targetDefOrKey=null] - Optional canonical defense key or target definition.
 * @returns {number} Hitpoints damaged in this strike (integer).
 */
export function calculateEarthquakeDamage(maxHp, eqLevel, strikeIndex = 1, targetDefOrKey = null) {
    if (maxHp <= 0 || strikeIndex < 1) return 0;

    if (targetDefOrKey) {
        const defKey = typeof targetDefOrKey === 'string' ? targetDefOrKey : targetDefOrKey.id;
        if (defKey && isTargetImmuneToSpell(defKey, 'earthquake')) return 0;
        if (typeof targetDefOrKey === 'object' && targetDefOrKey.immunities?.earthquake === true) return 0;
    }

    const eqConfig = spellsData.spells.earthquake;
    const levelInfo = eqConfig.levels[eqLevel] || eqConfig.levels[8];
    const isHeroOrUnit = isUnitTarget(targetDefOrKey);
    const basePct = isHeroOrUnit ? (levelInfo.troopDamagePct ?? 0) : levelInfo.damagePct;

    if (basePct <= 0) return 0;

    const divider = (2 * strikeIndex) - 1;
    const damageFraction = basePct / divider;

    return Math.floor(maxHp * damageFraction);
}

/**
 * Calculates cumulative damage dealt by K Earthquake strikes.
 * Non-damaging strikes (e.g. L1-5 on heroes) do not advance the diminishing returns series.
 *
 * @param {number} maxHp - Target maximum hit points.
 * @param {number} eqLevel - Earthquake spell level (1 to 8).
 * @param {number} [count=1] - Total number of Earthquake strikes.
 * @param {string|Object} [targetDefOrKey=null] - Optional canonical defense key or target definition.
 * @returns {number} Total hitpoints damaged across all strikes.
 */
export function calculateCumulativeEarthquakeDamage(maxHp, eqLevel, count = 1, targetDefOrKey = null) {
    if (maxHp <= 0 || count <= 0) return 0;

    let totalDamage = 0;
    let damagingStrikeIndex = 1;
    for (let i = 1; i <= count; i++) {
        const dmg = calculateEarthquakeDamage(maxHp, eqLevel, damagingStrikeIndex, targetDefOrKey);
        if (dmg > 0) {
            totalDamage += dmg;
            damagingStrikeIndex++;
        }
    }
    return Math.min(maxHp, totalDamage);
}

/**
 * Resolves regular army spell capacity and donated Clan Castle spell capacity for a Town Hall level.
 *
 * @param {number} [townHallLevel=18] - Player Town Hall level (1-18).
 * @returns {{ regularCapacity: number, ccCapacity: number, totalCapacity: number, regular: number, clanCastle: number }}
 */
export function getSpellCapacities(townHallLevel = 18) {
    const th = Math.min(Math.max(1, Number(townHallLevel) || 18), 18);
    const regularCapacity = spellsData.spellCapacitiesByTH[th] ?? 11;
    const ccCapacity = spellsData.ccSpellCapacitiesByTH[th] ?? 4;
    return {
        regularCapacity,
        ccCapacity,
        regular: regularCapacity,
        clanCastle: ccCapacity,
        totalCapacity: regularCapacity + ccCapacity
    };
}

/**
 * Calculates cumulative Earthquake damage using separate regular and Clan Castle spell counts.
 * Prioritizes higher level Earthquakes for earlier strikes in the diminishing returns series.
 * Non-damaging strikes do not advance the diminishing returns series.
 *
 * @param {number} maxHp - Target maximum hit points.
 * @param {number} [eqRegCount=0] - Regular Earthquake strikes.
 * @param {number} [eqLevel=8] - Regular Earthquake level.
 * @param {number} [eqCcCount=0] - Donated Clan Castle Earthquake strikes.
 * @param {number} [ccEqLevel=8] - Donated Clan Castle Earthquake level.
 * @param {string|Object} [targetDefOrKey=null] - Optional canonical defense key or target definition.
 * @returns {number} Hitpoints damage dealt.
 */
export function calculateEarthquakeDamageWithPools(maxHp, eqRegCount = 0, eqLevel = 8, eqCcCount = 0, ccEqLevel = 8, targetDefOrKey = null) {
    if (maxHp <= 0 || (eqRegCount <= 0 && eqCcCount <= 0)) return 0;
    const safeEqLevel = Math.min(Math.max(1, Number(eqLevel) || 8), 8);
    const safeCcEqLevel = Math.min(Math.max(1, Number(ccEqLevel) || safeEqLevel), 8);

    const strikes = [];
    if (safeCcEqLevel > safeEqLevel) {
        for (let i = 0; i < eqCcCount; i++) strikes.push(safeCcEqLevel);
        for (let i = 0; i < eqRegCount; i++) strikes.push(safeEqLevel);
    } else {
        for (let i = 0; i < eqRegCount; i++) strikes.push(safeEqLevel);
        for (let i = 0; i < eqCcCount; i++) strikes.push(safeCcEqLevel);
    }

    let total = 0;
    let damagingStrikeIndex = 1;
    for (let strikeIdx = 0; strikeIdx < strikes.length; strikeIdx++) {
        const dmg = calculateEarthquakeDamage(maxHp, strikes[strikeIdx], damagingStrikeIndex, targetDefOrKey);
        if (dmg > 0) {
            total += dmg;
            damagingStrikeIndex++;
        }
    }
    return Math.min(maxHp, total);
}

/**
 * Calculates cumulative Earthquake damage taking into account a donated Clan Castle spell.
 * Non-damaging strikes do not advance the diminishing returns series.
 *
 * @param {number} maxHp - Target maximum hit points.
 * @param {number} eqLevel - Laboratory Earthquake level.
 * @param {number} [count=1] - Total earthquake strikes.
 * @param {number} [ccEqLevel] - Donated Clan Castle Earthquake level.
 * @param {string|Object} [targetDefOrKey=null] - Optional canonical defense key or target definition.
 * @returns {number} Hitpoints damage dealt.
 */
export function calculateEarthquakeDamageWithCc(maxHp, eqLevel, count = 1, ccEqLevel, targetDefOrKey = null) {
    if (maxHp <= 0 || count <= 0) return 0;
    const effectiveFirst = (ccEqLevel != null && ccEqLevel > eqLevel) ? ccEqLevel : eqLevel;
    const strikes = [effectiveFirst];
    for (let i = 2; i <= count; i++) {
        strikes.push(eqLevel);
    }

    let total = 0;
    let damagingStrikeIndex = 1;
    for (let i = 0; i < strikes.length; i++) {
        const dmg = calculateEarthquakeDamage(maxHp, strikes[i], damagingStrikeIndex, targetDefOrKey);
        if (dmg > 0) {
            total += dmg;
            damagingStrikeIndex++;
        }
    }
    return Math.min(maxHp, total);
}

/**
 * Calculates required Lightning spells within available regular and Clan Castle capacity limits.
 *
 * @param {number} remainingHp - Hit points remaining after equipment and earthquakes.
 * @param {number} zapDmg - Damage per regular lightning strike.
 * @param {number} ccZapDmg - Damage per donated CC lightning strike.
 * @param {number} maxRegZap - Maximum regular lightning capacity available.
 * @param {number} maxCcZap - Maximum donated CC lightning capacity available.
 * @returns {{
 *   possible: boolean,
 *   zapsNeeded: number,
 *   regZapCount: number,
 *   ccZapCount: number,
 *   totalZapDamage: number
 * }}
 */
export function calculateRequiredZapsTwoPools(remainingHp, zapDmg, ccZapDmg, maxRegZap, maxCcZap) {
    if (remainingHp <= 0) {
        return {
            possible: true,
            zapsNeeded: 0,
            regZapCount: 0,
            ccZapCount: 0,
            totalZapDamage: 0
        };
    }

    if (maxRegZap <= 0 && maxCcZap <= 0) {
        return {
            possible: false,
            zapsNeeded: 0,
            regZapCount: 0,
            ccZapCount: 0,
            totalZapDamage: 0
        };
    }

    // Case 1: CC zap deals strictly higher damage than personal zap
    if (ccZapDmg > zapDmg && maxCcZap > 0) {
        const ccNeeded = Math.ceil(remainingHp / ccZapDmg);
        if (ccNeeded <= maxCcZap) {
            return {
                possible: true,
                zapsNeeded: ccNeeded,
                regZapCount: 0,
                ccZapCount: ccNeeded,
                totalZapDamage: ccNeeded * ccZapDmg
            };
        }

        const remAfterCc = remainingHp - (maxCcZap * ccZapDmg);
        if (maxRegZap > 0 && zapDmg > 0) {
            const regNeeded = Math.ceil(remAfterCc / zapDmg);
            if (regNeeded <= maxRegZap) {
                return {
                    possible: true,
                    zapsNeeded: maxCcZap + regNeeded,
                    regZapCount: regNeeded,
                    ccZapCount: maxCcZap,
                    totalZapDamage: (maxCcZap * ccZapDmg) + (regNeeded * zapDmg)
                };
            }
        }

        return {
            possible: false,
            zapsNeeded: 0,
            regZapCount: 0,
            ccZapCount: 0,
            totalZapDamage: 0
        };
    }

    // Case 2: Regular zap deals equal or higher damage (or no CC zaps available)
    if (maxRegZap > 0 && zapDmg > 0) {
        const regNeeded = Math.ceil(remainingHp / zapDmg);
        if (regNeeded <= maxRegZap) {
            return {
                possible: true,
                zapsNeeded: regNeeded,
                regZapCount: regNeeded,
                ccZapCount: 0,
                totalZapDamage: regNeeded * zapDmg
            };
        }

        const remAfterReg = remainingHp - (maxRegZap * zapDmg);
        if (maxCcZap > 0 && ccZapDmg > 0) {
            const ccNeeded = Math.ceil(remAfterReg / ccZapDmg);
            if (ccNeeded <= maxCcZap) {
                return {
                    possible: true,
                    zapsNeeded: maxRegZap + ccNeeded,
                    regZapCount: maxRegZap,
                    ccZapCount: ccNeeded,
                    totalZapDamage: (maxRegZap * zapDmg) + (ccNeeded * ccZapDmg)
                };
            }
        }

        return {
            possible: false,
            zapsNeeded: 0,
            regZapCount: 0,
            ccZapCount: 0,
            totalZapDamage: 0
        };
    }

    // Case 3: Regular zaps are disabled (maxRegZap === 0), but CC zaps are available
    if (maxCcZap > 0 && ccZapDmg > 0) {
        const ccNeeded = Math.ceil(remainingHp / ccZapDmg);
        if (ccNeeded <= maxCcZap) {
            return {
                possible: true,
                zapsNeeded: ccNeeded,
                regZapCount: 0,
                ccZapCount: ccNeeded,
                totalZapDamage: ccNeeded * ccZapDmg
            };
        }
    }

    return {
        possible: false,
        zapsNeeded: 0,
        regZapCount: 0,
        ccZapCount: 0,
        totalZapDamage: 0
    };
}

/**
 * Calculates required Lightning spells and total zap damage taking donated CC spell into account.
 *
 * @param {number} remainingHp - Hit points remaining.
 * @param {number} zapDmg - Personal lightning damage.
 * @param {number} ccZapDmg - Donated lightning damage.
 * @param {number} [maxRegZap=11] - Max regular zaps.
 * @param {number} [maxCcZap=4] - Max CC zaps.
 * @returns {{ zapsNeeded: number, totalZapDamage: number }}
 */
export function calculateRequiredZaps(remainingHp, zapDmg, ccZapDmg, maxRegZap = 11, maxCcZap = 4) {
    const res = calculateRequiredZapsTwoPools(remainingHp, zapDmg, ccZapDmg, maxRegZap, maxCcZap);
    return {
        zapsNeeded: res.zapsNeeded,
        totalZapDamage: res.totalZapDamage
    };
}

/**
 * Checks whether all items in an equipment list belong to the same hero.
 *
 * @param {Array<Object>} [equipList=[]] - Array of equipment items.
 * @returns {boolean} True if 2 or more equipment items all belong to the same hero.
 */
export function isSameHeroEquipment(equipList = []) {
    if (!equipList || equipList.length < 2) return false;
    const firstHero = equipmentDamageData[equipList[0]?.id]?.hero;
    if (!firstHero) return false;
    return equipList.every(item => equipmentDamageData[item?.id]?.hero === firstHero);
}

/**
 * Checks whether an equipment combination is valid under Clash of Clans hero equipment limits:
 * at most 2 distinct heroes, and at most 2 equipment per hero.
 *
 * @param {Array<Object>} [equipList=[]] - Array of equipment items.
 * @returns {boolean} True if the combination uses at most 2 heroes and at most 2 equipment per hero.
 */
export function isValidHeroEquipmentCombo(equipList = []) {
    if (!equipList || equipList.length <= 2) return true;
    const heroCounts = {};
    for (const item of equipList) {
        const hero = equipmentDamageData[item?.id]?.hero;
        if (!hero) return false;
        heroCounts[hero] = (heroCounts[hero] || 0) + 1;
        if (heroCounts[hero] > 2) return false;
    }
    return Object.keys(heroCounts).length <= 2;
}

/**
 * Evaluates whether a target defense or structure is immune to a specific spell type.
 * Checks the entity's subCategory, explicit entity definition immunities, and spell data immunity tables.
 *
 * @param {string} defenseKey - Canonical building/defense key.
 * @param {'lightning'|'earthquake'} spellType - Spell identifier.
 * @param {Object} [def=getDefensesData()[defenseKey]] - Building definition object.
 * @returns {boolean} True if immune to the spell.
 */
export function isTargetImmuneToSpell(defenseKey, spellType, def = getDefensesData()[defenseKey]) {
    if (!defenseKey || !spellType) return false;
    if (def?.subCategory === 'resource') return true;
    if (spellType === 'lightning' && (def?.subCategory === 'townhall' || def?.subCategory === 'cc')) return true;
    if (def?.immunities?.[spellType] !== undefined) return Boolean(def.immunities[spellType]);
    if (spellsData?.spells?.[spellType]?.immunities?.[defenseKey] !== undefined) {
        return Boolean(spellsData.spells[spellType].immunities[defenseKey]);
    }
    return false;
}
