/**
 * Pure Domain Calculations for Hero Equipment Damage & Sniping Thresholds.
 * Tier 2: Pure Domain Math (0 side effects, 0 DOM references, 0 browser globals).
 */

import { equipmentDamageData } from '../../data/equipmentDamageData.js';
import { getDefensesData } from '../../data/defenseTargetsData.js';
import { getEffectiveEquipmentLevel, calculateEquipmentTargetDamage } from './damageFormulas.js';
import { getDefenseMaxHp, canEquipmentTarget } from './defenseProgressionDomain.js';

/**
 * Calculates damage dealt by hero equipment to a specific defensive structure.
 *
 * @param {string} equipmentId - Equipment identifier (e.g. 'giant_arrow', 'fireball', 'spiky_ball').
 * @param {number} equipmentLevel - Equipment level.
 * @param {string} targetDefenseKey - Target defense key.
 * @param {number} targetLevel - Target defense level.
 * @param {Object} [options={}] - Options (leagueId, superchargeTier, townHallStar, rageMultiplier).
 * @returns {{
 *   equipmentId: string,
 *   effectiveLevel: number,
 *   isLevelDowngradedByEsports: boolean,
 *   isLevelCappedByEsports: boolean,
 *   targetDefenseKey: string,
 *   targetLevel: number,
 *   targetMaxHp: number,
 *   rawDamage: number,
 *   damageDealt: number,
 *   remainingHp: number,
 *   percentDealt: number,
 *   isDestroyed: boolean,
 *   oneShotKill: boolean,
 *   hitsRequired: number,
 *   specialNotes: Array<string>
 * }}
 */
export function calculateEquipmentDamage(equipmentId, equipmentLevel, targetDefenseKey, targetLevel, options = {}) {
    const equip = equipmentDamageData[equipmentId];
    const def = getDefensesData()[targetDefenseKey];
    const modifier = options.modifier || options.modifierKey || options.leagueId || 'standard';

    const targetMaxHp = def ? getDefenseMaxHp(targetDefenseKey, targetLevel, options) : 0;
    const effectiveLevel = getEffectiveEquipmentLevel(equipmentId, equipmentLevel, modifier);
    const isLevelDowngradedByEsports = modifier === 'esports' && effectiveLevel < equipmentLevel;
    const isLevelCappedByEsports = isLevelDowngradedByEsports;

    const specialNotes = [];

    if (!equip) {
        return {
            equipmentId,
            effectiveLevel,
            isLevelDowngradedByEsports,
            isLevelCappedByEsports,
            targetDefenseKey,
            targetLevel,
            targetMaxHp,
            rawDamage: 0,
            damageDealt: 0,
            remainingHp: targetMaxHp,
            percentDealt: 0,
            isDestroyed: false,
            oneShotKill: false,
            hitsRequired: 0,
            specialNotes: ['unknown_equipment']
        };
    }

    if (!canEquipmentTarget(equipmentId, targetDefenseKey, targetLevel)) {
        return {
            equipmentId,
            effectiveLevel,
            isLevelDowngradedByEsports,
            isLevelCappedByEsports,
            targetDefenseKey,
            targetLevel,
            targetMaxHp,
            rawDamage: 0,
            damageDealt: 0,
            remainingHp: targetMaxHp,
            percentDealt: 0,
            isDestroyed: false,
            oneShotKill: false,
            hitsRequired: 0,
            specialNotes: ['invalid_target']
        };
    }

    const rawDamage = calculateEquipmentTargetDamage(equipmentId, effectiveLevel, targetDefenseKey, targetMaxHp, { ...options, level: targetLevel });
    if (equip.id === 'giant_arrow' && (def?.damageMultipliers?.giant_arrow || 1.0) > 1.0) {
        specialNotes.push('giant_arrow_air_defense_2x');
    }

    const damageDealt = Math.min(targetMaxHp, rawDamage);
    const remainingHp = Math.max(0, targetMaxHp - damageDealt);
    const percentDealt = targetMaxHp > 0 ? Math.round((damageDealt / targetMaxHp) * 1000) / 10 : 0;
    const isDestroyed = remainingHp <= 0;
    const oneShotKill = rawDamage >= targetMaxHp && targetMaxHp > 0;
    const hitsRequired = rawDamage > 0 ? Math.ceil(targetMaxHp / rawDamage) : 0;

    return {
        equipmentId,
        effectiveLevel,
        isLevelDowngradedByEsports,
        isLevelCappedByEsports,
        targetDefenseKey,
        targetLevel,
        targetMaxHp,
        rawDamage,
        damageDealt,
        remainingHp,
        percentDealt,
        isDestroyed,
        oneShotKill,
        hitsRequired,
        specialNotes
    };
}

/**
 * Resolves the active list of enabled equipment with effective and raw levels.
 *
 * @param {Object} state - Damage calculator state or offense options.
 * @returns {Array<{ id: string, level: number, rawLevel: number }>} Enabled equipment list.
 */
export function getEnabledEquipmentList(state) {
    const modifier = state?.modifier && state.modifier !== 'standard'
        ? state.modifier
        : (state?.leagueId || state?.modifier || 'standard');
    const enabledSources = state?.offense?.enabledSources || {};
    const equipKeys = [
        'spiky_ball',
        'giant_arrow',
        'fireball',
        'seeking_shield',
        'flame_blower',
        'rocket_backpack'
    ];
    const enabledEquipment = [];
    for (const eqKey of equipKeys) {
        if (enabledSources[eqKey] !== false) {
            const equip = equipmentDamageData[eqKey];
            const defaultLvl = equip?.rarity === 'epic' ? 27 : 18;
            const rawLvl = state?.offense?.equipment?.[eqKey] || defaultLvl;
            const effectiveLvl = getEffectiveEquipmentLevel(eqKey, rawLvl, modifier);
            enabledEquipment.push({
                id: eqKey,
                level: effectiveLvl,
                rawLevel: rawLvl
            });
        }
    }
    return enabledEquipment;
}
