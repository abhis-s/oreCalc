/**
 * Pure Domain Simulation Engine for Multi-Strike Attack Sequences & Shared Diminishing Returns.
 * Tier 2: Pure Domain Math (0 side effects, 0 DOM references, 0 browser globals).
 */

import { getDefensesData } from '../../data/defenseTargetsData.js';
import { spellsData } from '../../data/spellsData.js';
import { equipmentDamageData } from '../../data/equipmentDamageData.js';
import {
    calculateEarthquakeDamage,
    isTargetImmuneToSpell
} from './damageFormulas.js';
import {
    getDefenseMaxHp,
    isDefenseInSeason,
    getBuildingGroupId,
    getMaxDefenseLevelForTownHall,
    isUnitTarget
} from './defenseProgressionDomain.js';
import { calculateEquipmentDamage } from './equipmentDamage.js';

/**
 * Per-hit repair healing delivered to defending structures by Builder Huts.
 * Level 1: 0 HP (not a defensive structure yet).
 * Levels 2-8: official per-hit repair amounts.
 * Supercharge Tier 1 and 2: 71.25 HP.
 * @type {Readonly<Record<string | number, number>>}
 */
export const BUILDER_REPAIR_PER_HIT = Object.freeze({
    1: 0,
    2: 37.5,
    3: 45.0,
    4: 52.5,
    5: 60.0,
    6: 63.75,
    7: 67.5,
    8: 71.25,
    sc1: 71.25,
    sc2: 71.25
});

/**
 * Simulates a chronological sequence of spells, hero equipment, troop death drops, and repairs on a defense.
 *
 * @param {string} targetDefenseKey - Target defense key.
 * @param {number} targetLevel - Target defense level.
 * @param {Array<Object>} sequenceSteps - Array of ordered attack actions.
 * @param {Object} [options={}] - Simulation options.
 * @param {string} [options.modifier='standard'] - Competitive league modifier ID or key.
 * @param {string} [options.modifierKey] - Alias for options.modifier.
 * @param {string} [options.leagueId='standard'] - Competitive league modifier ID (legacy alias).
 * @param {number} [options.superchargeTier=0] - Target supercharge tier (0, 1, 2).
 * @param {Object} [options.defenseSuperchargeOverrides] - Optional per-defense supercharge overrides.
 * @param {number} [options.builderHutLevel=8] - Level of repairing builder huts (1-8).
 * @param {number} [options.builderCount=1] - Number of builders actively repairing the target.
 * @param {boolean} [options.rageTowerActive=false] - Whether a Rage Spell Tower is boosting the defense.
 * @returns {{
 *   isDestroyed: boolean,
 *   targetDefenseKey: string,
 *   defenseKey?: string,
 *   targetDefenseName: string,
 *   defenseName?: string,
 *   name?: string,
 *   targetLevel: number,
 *   targetMaxHp: number,
 *   initialHp?: number,
 *   remainingHp: number,
 *   totalDamageDealt: number,
 *   overkillDamage: number,
 *   overkill?: number,
 *   damagePercentage: number,
 *   percentageRemaining?: number,
 *   stepsToDestroy: number,
 *   earthquakeStrikeCounter: number,
 *   timeline: Array<Object>,
 *   strikeLog?: Array<Object>
 * }}
 */
export function simulateAttackSequence(targetDefenseKey, targetLevel, sequenceSteps = [], options = {}) {
    const def = getDefensesData()[targetDefenseKey];
    const activeSupercharge = options.defenseSuperchargeOverrides?.[targetDefenseKey] !== undefined
        ? options.defenseSuperchargeOverrides[targetDefenseKey]
        : (options.superchargeTier || 0);
    const targetMaxHp = def ? getDefenseMaxHp(targetDefenseKey, targetLevel, { ...options, superchargeTier: activeSupercharge }) : 0;
    const modifier = options.modifier || options.modifierKey || options.leagueId || 'standard';

    let currentHp = targetMaxHp;
    let eqStrikeCounter = 1;
    const timeline = [];

    const isImmuneToLightning = isTargetImmuneToSpell(targetDefenseKey, 'lightning', def);
    const isImmuneToEarthquake = isTargetImmuneToSpell(targetDefenseKey, 'earthquake', def);

    let stepIndex = 1;
    let cumulativeRawDamage = 0;

    for (const step of sequenceSteps) {
        if (!step || typeof step !== 'object') continue;

        // If target is already destroyed, record skipped steps
        if (currentHp <= 0) {
            timeline.push({
                stepIndex: stepIndex++,
                type: step.type,
                id: step.id,
                name: equipmentDamageData[step.id]?.name || spellsData.spells[step.id]?.name || (step.type === 'builder_repair' ? 'Builder Repair' : step.id),
                damageDealt: 0,
                hpBefore: 0,
                remainingHp: 0,
                percentageRemaining: 0,
                isDestroyed: true,
                skipped: true,
                notes: 'target_already_destroyed'
            });
            continue;
        }

        const hpBefore = currentHp;

        switch (step.type) {
            case 'spell': {
                if (step.id === 'lightning') {
                    if (isImmuneToLightning) {
                        timeline.push({
                            stepIndex: stepIndex++,
                            type: 'spell',
                            id: 'lightning',
                            name: 'Lightning Spell',
                            damageDealt: 0,
                            hpBefore,
                            remainingHp: currentHp,
                            percentageRemaining: Math.round((currentHp / targetMaxHp) * 1000) / 10,
                            isDestroyed: false,
                            notes: 'target_immune_to_lightning'
                        });
                        break;
                    }

                    const zapDmg = spellsData.spells.lightning.levels[step.level || 13]?.damage || 720;
                    const count = Math.max(1, step.count || 1);

                    for (let c = 0; c < count; c++) {
                        if (currentHp <= 0) break;
                        const subBefore = currentHp;
                        const actualDmg = Math.min(currentHp, zapDmg);
                        currentHp -= actualDmg;
                        cumulativeRawDamage += zapDmg;

                        timeline.push({
                            stepIndex: stepIndex++,
                            type: 'spell',
                            id: 'lightning',
                            name: `Lightning Spell (${c + 1}/${count})`,
                            damageDealt: actualDmg,
                            hpBefore: subBefore,
                            remainingHp: currentHp,
                            percentageRemaining: Math.round((currentHp / targetMaxHp) * 1000) / 10,
                            isDestroyed: currentHp <= 0,
                            notes: 'direct_lightning_strike'
                        });
                    }
                } else if (step.id === 'earthquake') {
                    if (isImmuneToEarthquake) {
                        timeline.push({
                            stepIndex: stepIndex++,
                            type: 'spell',
                            id: 'earthquake',
                            name: 'Earthquake Spell',
                            damageDealt: 0,
                            hpBefore,
                            remainingHp: currentHp,
                            percentageRemaining: Math.round((currentHp / targetMaxHp) * 1000) / 10,
                            isDestroyed: false,
                            notes: 'immune_to_earthquake'
                        });
                        continue;
                    }

                    const eqLevel = step.level || 8;
                    const count = Math.max(1, step.count || 1);

                    for (let c = 0; c < count; c++) {
                        if (currentHp <= 0) break;
                        const subBefore = currentHp;
                        const strikeDamage = calculateEarthquakeDamage(targetMaxHp, eqLevel, eqStrikeCounter, def);
                        const actualDmg = Math.min(currentHp, strikeDamage);
                        currentHp -= actualDmg;
                        cumulativeRawDamage += strikeDamage;

                        const isZeroDmgUnit = strikeDamage === 0 && isUnitTarget(def);
                        const strikeLabel = strikeDamage > 0 ? ` (Strike #${eqStrikeCounter})` : '';

                        timeline.push({
                            stepIndex: stepIndex++,
                            type: 'spell',
                            id: 'earthquake',
                            name: `Earthquake Spell${strikeLabel}`,
                            strikeIndex: strikeDamage > 0 ? eqStrikeCounter : null,
                            damageDealt: actualDmg,
                            hpBefore: subBefore,
                            remainingHp: currentHp,
                            percentageRemaining: Math.round((currentHp / targetMaxHp) * 1000) / 10,
                            isDestroyed: currentHp <= 0,
                            notes: isZeroDmgUnit ? 'zero_damage_to_units_below_lvl6' : `diminishing_returns_strike_${eqStrikeCounter}`
                        });

                        if (strikeDamage > 0) {
                            eqStrikeCounter += 1;
                        }
                    }
                }
                break;
            }

            case 'equipment': {
                const equipRes = calculateEquipmentDamage(step.id, step.level || 18, targetDefenseKey, targetLevel, { ...options, modifier, modifierKey: modifier, leagueId: modifier });
                const actualDmg = Math.min(currentHp, equipRes.damageDealt);
                currentHp -= actualDmg;
                cumulativeRawDamage += equipRes.damageDealt;

                timeline.push({
                    stepIndex: stepIndex++,
                    type: 'equipment',
                    id: step.id,
                    name: equipmentDamageData[step.id]?.name || equipRes.equipmentId,
                    damageDealt: actualDmg,
                    hpBefore,
                    remainingHp: currentHp,
                    percentageRemaining: Math.round((currentHp / targetMaxHp) * 1000) / 10,
                    isDestroyed: currentHp <= 0,
                    notes: equipRes.specialNotes.join(', ') || 'hero_equipment_strike'
                });
                break;
            }

            case 'builder_repair': {
                const hutLvl = step.hutLevel || options.builderHutLevel || 8;
                const healAmount = BUILDER_REPAIR_PER_HIT[hutLvl] ?? 71.25;
                let actualHealed = 0;

                // Defenses can only be repaired while alive (HP > 0) and below maximum HP
                if (currentHp > 0 && currentHp < targetMaxHp && healAmount > 0) {
                    actualHealed = Math.min(targetMaxHp - currentHp, healAmount);
                    currentHp += actualHealed;
                }

                timeline.push({
                    stepIndex: stepIndex++,
                    type: 'builder_repair',
                    id: 'builder_repair',
                    name: `Builder Repair (Lvl ${hutLvl})`,
                    hpBefore,
                    damageDealt: -actualHealed,
                    remainingHp: currentHp,
                    percentageRemaining: Math.round((currentHp / targetMaxHp) * 1000) / 10,
                    isDestroyed: currentHp <= 0,
                    notes: actualHealed > 0 ? `+${actualHealed} HP Healed` : (currentHp <= 0 ? 'Cannot repair destroyed building' : 'Already at max HP')
                });
                break;
            }

            default: {
                break;
            }
        }
    }

    const totalDamageDealt = targetMaxHp - currentHp;
    const overkill = currentHp <= 0 ? Math.max(0, cumulativeRawDamage - targetMaxHp) : 0;
    const percentageRemaining = targetMaxHp > 0 ? Math.round((currentHp / targetMaxHp) * 1000) / 10 : 0;
    const damagePercentage = targetMaxHp > 0 ? Math.round((totalDamageDealt / targetMaxHp) * 1000) / 10 : 0;
    const stepsToDestroy = timeline.findIndex(step => step.isDestroyed) !== -1 ? timeline.findIndex(step => step.isDestroyed) + 1 : 0;

    return {
        targetDefenseKey,
        defenseKey: targetDefenseKey,
        targetDefenseName: def?.name || targetDefenseKey,
        defenseName: def?.name || targetDefenseKey,
        name: def?.name || targetDefenseKey,
        targetLevel,
        targetMaxHp,
        initialHp: targetMaxHp,
        remainingHp: Math.max(0, currentHp),
        totalDamageDealt,
        overkill,
        overkillDamage: overkill,
        damagePercentage,
        percentageRemaining,
        stepsToDestroy,
        isDestroyed: currentHp <= 0,
        earthquakeStrikeCounter: eqStrikeCounter,
        timeline,
        strikeLog: timeline
    };
}

/**
 * Simulates an attack action sequence simultaneously across all 28 defensive structures.
 *
 * @param {Array<Object>} sequenceSteps - Array of attack actions in sequence.
 * @param {Record<string, any>} [options={}] - Simulation options (townHallLevel, defenseLevelOverrides, leagueId, referenceDate, etc.).
 * @returns {Array<Object>} Results list for every defense.
 */
export function simulateSequenceAcrossAllDefenses(sequenceSteps = [], options = {}) {
    const townHall = options.townHallLevel ?? (/** @type {any} */ (options)).playerTownHall;
    const overrides = options.defenseLevelOverrides || {};
    const enabledGroups = options.enabledBuildingGroups;
    const results = [];

    for (const [key, def] of Object.entries(getDefensesData())) {
        if (!isDefenseInSeason(def, options.referenceDate)) continue;

        const info = townHall != null ? getMaxDefenseLevelForTownHall(key, townHall) : { level: def.maxLevel, status: 'available' };
        const isUnavailable = info.status === 'locked' || info.status === 'sunset';

        if (enabledGroups) {
            const groupId = getBuildingGroupId(key, townHall != null ? townHall : 18);
            // Defenses invariant: defenses group is always enabled
            const isGroupEnabled = groupId === 'defenses'
                ? true
                : (enabledGroups[groupId] !== undefined ? Boolean(enabledGroups[groupId]) : (groupId !== 'unavailable'));
            if (!isGroupEnabled) continue;
        } else if (townHall != null) {
            if (def.minTH && townHall < def.minTH) continue;
            if ('maxTH' in def && typeof def.maxTH === 'number' && townHall > def.maxTH) continue;
        }

        let level = overrides[key];
        if (!level) {
            if (isUnavailable) {
                level = info.status === 'locked' ? 1 : def.maxLevel;
            } else {
                const availableLevels = Object.entries(def.levels)
                    .filter(([_, lvlData]) => !townHall || (lvlData.th && lvlData.th <= townHall))
                    .map(([lvl]) => Number(lvl));
                level = availableLevels.length > 0 ? Math.max(...availableLevels) : def.maxLevel;
            }
        }

        const simResult = simulateAttackSequence(key, level, sequenceSteps, options);
        results.push({
            defenseKey: key,
            name: def.id,
            defenseName: def.id,
            level,
            minTH: def.minTH,
            category: def.category,
            subCategory: 'subCategory' in def ? def.subCategory : undefined,
            ...simResult
        });
    }

    return results;
}
