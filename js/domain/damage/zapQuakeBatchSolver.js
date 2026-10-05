/**
 * Clustered and Batch ZapQuake Solvers for Defensive Structures.
 * Tier 2: Pure Domain Math (0 side effects, 0 DOM references, 0 browser globals).
 */

import { getDefensesData } from '../../data/defenseTargetsData.js';
import { spellsData } from '../../data/spellsData.js';
import {
    getSpellCapacities,
    calculateEarthquakeDamageWithCc,
    calculateRequiredZaps,
    isSameHeroEquipment,
    isTargetImmuneToSpell,
    calculateEquipmentTargetDamage
} from './damageFormulas.js';
import {
    getDefenseMaxHp,
    getMaxSuperchargeTier,
    getDefaultSuperchargeTier,
    isDefenseInSeason,
    getBuildingGroupId,
    getMaxDefenseLevelForTownHall
} from './defenseProgressionDomain.js';
import { solveZapQuakeCombinations, getComboSignature } from './zapQuakeSolver.js';

/**
 * Resolves connected components of targets that share Lightning strikes.
 *
 * @param {number} numTargets - Number of targets in the cluster.
 * @param {Array<[number, number] | string>} [pairs=[]] - List of adjacent index pairs.
 * @returns {Array<Array<number>>} Array of target index groups.
 */
function getConnectedTargetGroups(numTargets, pairs = []) {
    const parent = Array.from({ length: numTargets }, (_, i) => i);
    function find(i) {
        let root = i;
        while (root !== parent[root]) root = parent[root];
        let curr = i;
        while (curr !== root) {
            const nxt = parent[curr];
            parent[curr] = root;
            curr = nxt;
        }
        return root;
    }
    function union(i, j) {
        const rootI = find(i);
        const rootJ = find(j);
        if (rootI !== rootJ) parent[rootI] = rootJ;
    }

    if (Array.isArray(pairs)) {
        for (const pair of pairs) {
            let u, v;
            if (Array.isArray(pair)) {
                [u, v] = pair;
            } else if (typeof pair === 'string') {
                const parts = pair.split('-').map(Number);
                [u, v] = parts;
            }
            if (typeof u === 'number' && typeof v === 'number' && u >= 0 && u < numTargets && v >= 0 && v < numTargets) {
                union(u, v);
            }
        }
    }

    const groups = new Map();
    for (let i = 0; i < numTargets; i++) {
        const root = find(i);
        if (!groups.has(root)) groups.set(root, []);
        groups.get(root).push(i);
    }
    return Array.from(groups.values());
}

/**
 * Computes spell requirements to destroy a cluster of adjacent defenses sharing spells.
 *
 * @param {Array<{ defenseKey: string, level: number, superchargeTier?: number }>} targets - List of clustered targets.
 * @param {number} [lightningLevel=13] - Lightning Spell level.
 * @param {number} [eqLevel=8] - Earthquake Spell level.
 * @param {Object} [options={}] - Options.
 * @param {number} [options.maxEq=4] - Max EQ to test.
 * @param {number} [options.townHallLevel=18] - Target Town Hall level for spell capacity limit.
 * @param {number} [options.regularSpellCapacity] - Optional explicit regular army spell capacity override.
 * @param {number} [options.spellCapacity] - Legacy alias for regularSpellCapacity.
 * @param {number} [options.ccSpellCapacity] - Optional explicit Clan Castle spell capacity override.
 * @param {number} [options.maxHousingSpace] - Optional maximum spell housing space override.
 * @param {{ lightning?: number, earthquake?: number }} [options.ccSpells] - Donated Clan Castle spell levels.
 * @param {Array<[number, number] | string>} [options.adjacentPairs=[]] - Target index pairs that share Lightning.
 * @param {Array<string | { id: string, level?: number, targetIndices?: Array<number> | null }>} [options.clusterEquipment] - Hero equipment to apply to cluster targets.
 * @param {Array<string | { id: string, level?: number, targetIndices?: Array<number> | null }>} [options.equipment] - Alias for clusterEquipment.
 * @param {Record<string, Array<number>>} [options.clusterEquipmentSharing] - Per-equipment target indices map.
 * @returns {{
 *   targets: Array<Object>,
 *   totalHousingSpace: number,
 *   sharedEqCount: number,
 *   totalZaps: number,
 *   spellsSaved: number,
 *   individualZaps: Array<{ defenseKey: string, zapCount: number }>,
 *   combinations: Array<Object>,
 *   optimalCombination: Object | null,
 *   allDestroyed: boolean,
 *   equipment?: Array<{ id: string, level: number, targetIndices: Array<number> | null }>,
 *   maxArmyCapacity: number
 * }}
 */
export function solveClusteredZapQuake(targets, lightningLevel = 13, eqLevel = 8, options = {}) {
    if (!Array.isArray(targets) || targets.length === 0) {
        return {
            targets: [],
            totalHousingSpace: 0,
            sharedEqCount: 0,
            totalZaps: 0,
            spellsSaved: 0,
            individualZaps: [],
            combinations: [],
            optimalCombination: null,
            allDestroyed: false,
            equipment: [],
            maxArmyCapacity: 15
        };
    }

    const zapDmg = spellsData.spells.lightning.levels[lightningLevel]?.damage || 720;
    const maxEqToTest = options.maxEq ?? 4;
    const ccEqLevel = options.ccSpells?.earthquake != null ? Number(options.ccSpells.earthquake) : eqLevel;
    const ccLightningLevel = options.ccSpells?.lightning != null ? Number(options.ccSpells.lightning) : lightningLevel;
    const ccZapDmg = spellsData.spells.lightning.levels[ccLightningLevel]?.damage || zapDmg;

    const townHall = options.townHallLevel ?? (/** @type {any} */ (options)).playerTownHall ?? 18;
    const capacities = getSpellCapacities(townHall);
    const regCap = options.regularSpellCapacity ?? options.spellCapacity ?? capacities.regularCapacity;
    const ccCap = options.ccSpellCapacity ?? capacities.ccCapacity;
    const maxArmyCapacity = regCap + ccCap;
    const maxTotalHousing = options.maxHousingSpace != null ? Number(options.maxHousingSpace) : Infinity;

    const clusterEquipment = Array.isArray(options.clusterEquipment)
        ? options.clusterEquipment
        : (Array.isArray(options.equipment) ? options.equipment : []);
    const sharingMap = options.clusterEquipmentSharing || {};

    const resolvedEquipment = clusterEquipment.map(item => {
        const id = typeof item === 'string' ? item : item.id;
        const level = (typeof item === 'object' && item.level != null) ? item.level : 18;
        const targetsForEquip = (typeof item === 'object' && Array.isArray(item.targetIndices))
            ? item.targetIndices
            : (Array.isArray(sharingMap[id]) ? sharingMap[id] : null);
        return {
            id,
            level,
            targetIndices: targetsForEquip
        };
    });

    const getTargetEquipBreakdown = (targetIndex, maxHp, defenseKey) => {
        let totalDmg = 0;
        const items = [];
        const targetLevel = targets[targetIndex]?.level;
        for (const eq of resolvedEquipment) {
            const hitsTarget = eq.targetIndices === null || eq.targetIndices.includes(targetIndex);
            if (hitsTarget) {
                const dmg = calculateEquipmentTargetDamage(eq.id, eq.level, defenseKey, maxHp, { level: targetLevel });
                if (dmg > 0) {
                    totalDmg += dmg;
                    items.push({ id: eq.id, level: eq.level, damage: dmg });
                }
            }
        }
        return { totalDmg, items };
    };

    const fallbackTargets = targets.map((target, i) => {
        const maxHp = getDefenseMaxHp(target.defenseKey, target.level, target);
        const isImmuneZap = isTargetImmuneToSpell(target.defenseKey, 'lightning');
        const isImmuneEq = isTargetImmuneToSpell(target.defenseKey, 'earthquake');
        const { totalDmg: equipDmg, items: equipItems } = getTargetEquipBreakdown(i, maxHp, target.defenseKey);
        const remAfterEquip = Math.max(0, maxHp - equipDmg);
        const zaps = isImmuneZap ? 0 : calculateRequiredZaps(remAfterEquip, zapDmg, ccZapDmg).zapsNeeded;
        return {
            targetIndex: i,
            defenseKey: target.defenseKey,
            level: target.level,
            superchargeTier: target.superchargeTier || 0,
            maxHp,
            eqDamage: 0,
            equipmentDamage: equipDmg,
            equipment: equipItems,
            remainingHp: remAfterEquip,
            zapCount: zaps,
            isShared: false,
            effectiveZapCount: zaps,
            isImmune: isImmuneZap || isImmuneEq
        };
    });

    const adjacentPairs = options.adjacentPairs || [];
    const connectedGroups = getConnectedTargetGroups(targets.length, adjacentPairs);
    const combinations = [];

    // Test different shared EQ counts (which hit all targets in cluster)
    for (let eq = 0; eq <= maxEqToTest; eq++) {
        if (eq > maxTotalHousing) continue;
        const targetBreakdowns = [];
        let clusterPossible = true;
        let isolatedZapsSum = 0;

        for (let i = 0; i < targets.length; i++) {
            const target = targets[i];
            const maxHp = getDefenseMaxHp(target.defenseKey, target.level, target);
            const isImmuneZap = isTargetImmuneToSpell(target.defenseKey, 'lightning');
            const isImmuneEq = isTargetImmuneToSpell(target.defenseKey, 'earthquake');

            const { totalDmg: equipDmg, items: equipItems } = getTargetEquipBreakdown(i, maxHp, target.defenseKey);

            const eqDmg = (!isImmuneEq && eq > 0)
                ? calculateEarthquakeDamageWithCc(maxHp, eqLevel, eq, ccEqLevel, target.defenseKey)
                : 0;

            const remainingHp = Math.max(0, maxHp - eqDmg - equipDmg);

            if (remainingHp > 0 && isImmuneZap) {
                clusterPossible = false;
                break;
            }

            const { zapsNeeded } = calculateRequiredZaps(remainingHp, zapDmg, ccZapDmg);
            isolatedZapsSum += zapsNeeded;

            targetBreakdowns.push({
                targetIndex: i,
                defenseKey: target.defenseKey,
                level: target.level,
                superchargeTier: target.superchargeTier || 0,
                maxHp,
                eqDamage: eqDmg,
                equipmentDamage: equipDmg,
                equipment: equipItems,
                remainingHp,
                zapCount: zapsNeeded,
                isShared: false,
                effectiveZapCount: zapsNeeded
            });
        }

        if (!clusterPossible) continue;

        let totalZaps = 0;
        for (const group of connectedGroups) {
            const groupMaxZap = Math.max(...group.map(idx => targetBreakdowns[idx].zapCount));
            totalZaps += groupMaxZap;
            if (group.length > 1) {
                for (const idx of group) {
                    targetBreakdowns[idx].isShared = true;
                    targetBreakdowns[idx].effectiveZapCount = groupMaxZap;
                    targetBreakdowns[idx].sharedWith = group.filter(other => other !== idx);
                }
            }
        }

        const spellsSaved = Math.max(0, isolatedZapsSum - totalZaps);
        const totalHousing = eq + totalZaps;
        const exceedsCapacity = totalHousing > maxArmyCapacity;

        if (totalHousing <= maxTotalHousing) {
            combinations.push({
                targets: targetBreakdowns,
                totalHousingSpace: totalHousing,
                sharedEqCount: eq,
                totalZaps,
                spellsSaved,
                equipment: resolvedEquipment,
                individualZaps: targetBreakdowns.map(t => ({ defenseKey: t.defenseKey, zapCount: t.effectiveZapCount })),
                allDestroyed: true,
                exceedsCapacity,
                maxArmyCapacity
            });
        }
    }

    combinations.sort((a, b) => {
        // Viable combinations within capacity sort ahead of over-capacity combinations
        if (a.exceedsCapacity !== b.exceedsCapacity) {
            return a.exceedsCapacity ? 1 : -1;
        }
        if (a.totalHousingSpace !== b.totalHousingSpace) return a.totalHousingSpace - b.totalHousingSpace;
        // Spell type preference: prefer Earthquake over Lightning when housing space is tied (aligned with Tab 1)
        return b.sharedEqCount - a.sharedEqCount;
    });

    const bestSolution = combinations[0] || null;

    if (bestSolution) {
        return {
            ...bestSolution,
            equipment: resolvedEquipment,
            combinations,
            optimalCombination: bestSolution,
            maxArmyCapacity
        };
    }

    return {
        targets: fallbackTargets,
        totalHousingSpace: 0,
        sharedEqCount: 0,
        totalZaps: 0,
        spellsSaved: 0,
        individualZaps: fallbackTargets.map(t => ({ defenseKey: t.defenseKey, zapCount: t.effectiveZapCount })),
        combinations: [],
        optimalCombination: null,
        allDestroyed: false,
        equipment: resolvedEquipment,
        maxArmyCapacity
    };
}

/**
 * Computes optimal ZapQuake combinations for all defensive structures.
 *
 * @param {Object} [options={}]
 * @param {number} [options.lightningLevel=13] - Lightning spell level.
 * @param {number} [options.earthquakeLevel=8] - Earthquake spell level.
 * @param {number} [options.townHallLevel=18] - Target Town Hall level for level resolution.
 * @param {number} [options.superchargeTier=0] - Supercharge tier.
 * @param {Object} [options.defenseLevelOverrides={}] - Specific level overrides per defense key.
 * @param {Object} [options.defenseSuperchargeOverrides={}] - Specific supercharge tier overrides per defense key.
 * @param {Object} [options.enabledSpells] - Allowed spells map.
 * @param {Array<Object>} [options.enabledEquipment] - Allowed equipment array.
 * @param {string} [options.leagueId='standard'] - Battle modifier / league id.
 * @param {{ lightning?: number, earthquake?: number }} [options.ccSpells] - Donated Clan Castle spell levels.
 * @param {Date|string|number} [options.referenceDate=new Date()] - Reference date for seasonal filtering.
 * @param {Object} [options.enabledBuildingGroups] - Group visibility states.
 * @returns {Array<Object>} List of evaluated defenses with their best and all combinations.
 */
export function solveAllDefensesZapQuake(options = {}) {
    const lightningLevel = options.lightningLevel ?? 13;
    const eqLevel = options.earthquakeLevel ?? 8;
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

        const hasSupercharge = Boolean(def.levels[level]?.supercharges);
        const activeSupercharge = options.defenseSuperchargeOverrides?.[key] !== undefined
            ? (hasSupercharge ? Math.min(options.defenseSuperchargeOverrides[key] || 0, getMaxSuperchargeTier(key, level)) : 0)
            : (options.superchargeTier !== undefined
                ? (hasSupercharge ? Math.min(options.superchargeTier || 0, getMaxSuperchargeTier(key, level)) : 0)
                : getDefaultSuperchargeTier(key, level, townHall != null ? townHall : 18));

        const solverOpts = {
            superchargeTier: activeSupercharge,
            townHallLevel: townHall,
            enabledSpells: options.enabledSpells,
            enabledEquipment: options.enabledEquipment,
            leagueId: options.leagueId,
            ccSpells: options.ccSpells
        };
        const maxHp = getDefenseMaxHp(key, level, solverOpts);
        const solution = solveZapQuakeCombinations(key, level, lightningLevel, eqLevel, solverOpts);
        const bestCombo = solution.optimalCombination ? {
            ...solution.optimalCombination,
            isDestroyed: true,
            housingSpace: solution.optimalCombination.totalHousingSpace
        } : null;

        const allCombos = solution.combinations.map(c => ({
            ...c,
            isDestroyed: true,
            housingSpace: c.totalHousingSpace
        }));

        results.push({
            defenseKey: key,
            name: def.id,
            level,
            maxHp,
            superchargeTier: activeSupercharge,
            minTH: def.minTH,
            category: def.category,
            subCategory: 'subCategory' in def ? def.subCategory : undefined,
            immunities: def.immunities || { lightning: false, earthquake: false },
            bestCombo,
            allCombos,
            bestAttempt: solution.bestAttempt || null
        });
    }

    return results;
}

/**
 * In-memory LRU cache for groupDefensesBySpellCombo results.
 * @type {Map<string, Array<Object>>}
 */
const groupDefensesCache = new Map();
const MAX_CACHE_SIZE = 25;

/**
 * Generates a deterministic serialization key for batch solver options.
 *
 * @param {Object} options - Solver options.
 * @returns {string} Cache key string.
 */
function getGroupDefensesCacheKey(options = {}) {
    const th = options.townHallLevel ?? (/** @type {any} */ (options)).playerTownHall ?? 18;
    const mod = options.modifier || options.leagueId || 'standard';
    const zap = options.lightningLevel ?? 13;
    const eq = options.earthquakeLevel ?? 8;
    const sc = options.superchargeTier ?? 0;
    const rem = options.includeRemaining !== false ? '1' : '0';

    const spells = options.enabledSpells
        ? `${options.enabledSpells.lightning !== false ? 1 : 0}${options.enabledSpells.earthquake !== false ? 1 : 0}${options.enabledSpells.cc_lightning !== false ? 1 : 0}${options.enabledSpells.cc_earthquake !== false ? 1 : 0}`
        : '1111';

    const ccZ = options.ccSpells?.lightning ?? '';
    const ccE = options.ccSpells?.earthquake ?? '';

    const eqList = Array.isArray(options.enabledEquipment)
        ? options.enabledEquipment.map(e => `${e.id}:${e.rawLevel ?? e.level ?? 18}`).sort().join(';')
        : '';

    const defLvl = options.defenseLevelOverrides ? JSON.stringify(options.defenseLevelOverrides) : '';
    const defSc = options.defenseSuperchargeOverrides ? JSON.stringify(options.defenseSuperchargeOverrides) : '';
    const selCombos = options.selectedCombos ? JSON.stringify(options.selectedCombos) : '';
    const bldGroups = options.enabledBuildingGroups ? JSON.stringify(options.enabledBuildingGroups) : '';

    return `${th}|${mod}|${zap}|${eq}|${sc}|${rem}|${spells}|${ccZ}|${ccE}|${eqList}|${defLvl}|${defSc}|${selCombos}|${bldGroups}`;
}

/**
 * Groups all evaluated defenses into distinct spell & equipment combinations.
 *
 * @param {Object} [options={}]
 * @returns {Array<Object>} Sorted list of combinations with destroyed defenses.
 */
export function groupDefensesBySpellCombo(options = {}) {
    const cacheKey = getGroupDefensesCacheKey(options);
    if (groupDefensesCache.has(cacheKey)) {
        return /** @type {Array<Object>} */ (groupDefensesCache.get(cacheKey));
    }

    const allDefenses = solveAllDefensesZapQuake(options);
    const groupsMap = new Map();
    const remainingDefenses = [];

    for (const def of allDefenses) {
        if (!def.bestCombo || !def.bestCombo.isDestroyed) {
            remainingDefenses.push({
                defenseKey: def.defenseKey,
                name: def.name,
                level: def.level,
                superchargeTier: def.superchargeTier || 0,
                maxHp: def.maxHp,
                category: def.category,
                subCategory: def.subCategory,
                immunities: def.immunities || { lightning: false, earthquake: false },
                bestAttempt: def.bestAttempt || null
            });
            continue;
        }

        const chosenCombo = (options.selectedCombos?.[def.defenseKey] && def.allCombos)
            ? (def.allCombos.find(c => getComboSignature(c) === options.selectedCombos[def.defenseKey]) || def.bestCombo)
            : def.bestCombo;

        const { eqCount, zapCount, housingSpace, equipment = [] } = chosenCombo;
        const regEq = chosenCombo.regEqCount ?? eqCount;
        const ccEq = chosenCombo.ccEqCount ?? 0;
        const regZap = chosenCombo.regZapCount ?? zapCount;
        const ccZap = chosenCombo.ccZapCount ?? 0;
        const comboKey = getComboSignature(chosenCombo);

        if (!groupsMap.has(comboKey)) {
            groupsMap.set(comboKey, {
                key: comboKey,
                eqCount: regEq + ccEq,
                zapCount: regZap + ccZap,
                equipment,
                regEqCount: regEq,
                ccEqCount: ccEq,
                regZapCount: regZap,
                ccZapCount: ccZap,
                housingSpace,
                defenses: []
            });
        }

        groupsMap.get(comboKey).defenses.push({
            defenseKey: def.defenseKey,
            name: def.name,
            level: def.level,
            superchargeTier: def.superchargeTier || 0,
            maxHp: def.maxHp,
            category: def.category,
            subCategory: def.subCategory,
            overkill: chosenCombo.overkill
        });
    }

    const groups = Array.from(groupsMap.values());
    groups.sort((a, b) => {
        const aOver2 = (a.equipment?.length || 0) > 2 ? 1 : 0;
        const bOver2 = (b.equipment?.length || 0) > 2 ? 1 : 0;
        if (aOver2 !== bOver2) return aOver2 - bOver2;

        if (a.housingSpace !== b.housingSpace) return a.housingSpace - b.housingSpace;
        const aEq = a.equipment ? a.equipment.length : 0;
        const bEq = b.equipment ? b.equipment.length : 0;
        if (aEq !== bEq) return bEq - aEq;
        if (aEq >= 2 && bEq >= 2) {
            const aSame = isSameHeroEquipment(a.equipment) ? 1 : 0;
            const bSame = isSameHeroEquipment(b.equipment) ? 1 : 0;
            if (aSame !== bSame) return bSame - aSame;
        }
        const aCc = (a.ccEqCount || 0) + (a.ccZapCount || 0);
        const bCc = (b.ccEqCount || 0) + (b.ccZapCount || 0);
        if (aCc !== bCc) return aCc - bCc;
        if (a.eqCount !== b.eqCount) return b.eqCount - a.eqCount;
        return a.zapCount - b.zapCount;
    });

    for (const group of groups) {
        group.defenses.sort((a, b) => b.maxHp - a.maxHp);
    }

    if (remainingDefenses.length > 0 && options.includeRemaining !== false) {
        remainingDefenses.sort((a, b) => b.maxHp - a.maxHp);
        groups.push({
            key: 'remaining',
            isRemaining: true,
            equipment: options.enabledEquipment || [],
            eqCount: 0,
            zapCount: 0,
            regEqCount: 0,
            ccEqCount: 0,
            regZapCount: 0,
            ccZapCount: 0,
            housingSpace: Infinity,
            defenses: remainingDefenses
        });
    }

    if (groupDefensesCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = groupDefensesCache.keys().next().value;
        if (oldestKey) groupDefensesCache.delete(oldestKey);
    }
    groupDefensesCache.set(cacheKey, groups);

    return groups;
}
