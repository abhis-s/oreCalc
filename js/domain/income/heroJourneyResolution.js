import { getHeroEpicEquipmentPool, heroData } from '../../data/heroData.js';
import { heroJourneyNodes } from '../../data/heroJourneyData.js';
import {
    getCumulativeHeroLevel,
    getEquipmentUnlockLevelForTH,
    getMaxCumulativeLevelsByTH,
    getNodeTownHallLevel,
    hasSyncedHeroInfo,
    isDefaultOrGuestPlayer
} from './heroJourneyLevels.js';

/**
 * Resolves deterministic equipment milestone rewards across the entire Hero Journey track.
 * Traverses from Node 1 to 480 sequentially, checking the player's official server inventory
 * and assigning the first unowned equipment in priority order for each hero.
 *
 * @param {import('../../core/types.js').AppState | any} state - Application state.
 * @returns {Record<number, {
 *   node: any,
 *   bestGuess: { name: string, key: string, icon: string },
 *   resolvedName: string,
 *   resolvedKey: string,
 *   resolvedIcon: string,
 *   isFallbackStarry: boolean,
 *   fallbackStarry: number,
 *   equipmentLevel: number,
 *   isOwned: boolean,
 *   poolOptions: Array<{
 *     name: string,
 *     key: string,
 *     icon: string,
 *     status: 'owned' | 'awardedHere' | 'queued' | 'starryFallback'
 *   }>
 * }>} Map of node level to resolved equipment metadata.
 */
export function resolveHeroJourneyTrack(state) {
    const isGuest = isDefaultOrGuestPlayer(state) || !hasSyncedHeroInfo(state);
    const cumulativeLevel = isGuest ? 0 : getCumulativeHeroLevel(state);
    const maxLevelsByTH = getMaxCumulativeLevelsByTH();
    const allMaxValues = Object.values(maxLevelsByTH);
    const overallTrueMaxLevel = allMaxValues.length > 0 ? Math.max(...allMaxValues) : 0;
    const isTrueMax = !isGuest && cumulativeLevel >= overallTrueMaxLevel && overallTrueMaxLevel > 0;

    const eqNodes = heroJourneyNodes
        .filter(n => n.type === 'equipment' && n.hero)
        .sort((a, b) => a.level - b.level);

    /** @type {Record<number, any>} */
    const resolutionMap = {};

    // Collect verified server-owned equipment (strictly from official API payload)
    const serverOwnedSet = new Set();
    if (!isGuest) {
        if (state?.playerProfile?.ownedEquipment) {
            for (const key in state.playerProfile.ownedEquipment) {
                serverOwnedSet.add(key.toLowerCase());
            }
        }
        if (state?.playerProfile?.ownedHeroes) {
            for (const hName in state.playerProfile.ownedHeroes) {
                const h = state.playerProfile.ownedHeroes[hName];
                if (Array.isArray(h.equipment)) {
                    h.equipment.forEach(e => {
                        if (e.name) serverOwnedSet.add(e.name.toLowerCase());
                        if (e.key) serverOwnedSet.add(e.key.toLowerCase());
                    });
                }
            }
        }
    }

    const isServerOwned = (item) => {
        if (!item) return false;
        const nameLower = (item.name || '').toLowerCase();
        const keyLower = (item.key || '').toLowerCase();
        return Boolean((nameLower && serverOwnedSet.has(nameLower)) || (keyLower && serverOwnedSet.has(keyLower)));
    };

    /** @type {Map<string, any[]>} */
    const heroNodesMap = new Map();
    for (const node of eqNodes) {
        if (!heroNodesMap.has(node.hero)) {
            heroNodesMap.set(node.hero, []);
        }
        heroNodesMap.get(node.hero).push(node);
    }

    for (const [heroKey, nodes] of heroNodesMap.entries()) {
        const pool = getHeroEpicEquipmentPool(heroKey);

        const pastNodes = [];
        const futureNodes = [];
        for (const node of nodes) {
            const isClaimed = isTrueMax || (cumulativeLevel >= node.level);
            if (isClaimed) {
                pastNodes.push(node);
            } else {
                futureNodes.push(node);
            }
        }

        const heroAwardMap = new Map();
        const futureAwardMap = new Map();
        const futureAwardedSet = new Set();

        // Compute future unreached nodes assignments so past unowned nodes know where missed items landed
        const futureResolutions = futureNodes.map((node, k) => {
            const nodeTH = getNodeTownHallLevel(node.level);
            const unlockLevel = getEquipmentUnlockLevelForTH(nodeTH);

            const nodeIndex = pastNodes.length + k;
            const predeterminedItem = nodeIndex < pool.length ? pool[nodeIndex] : null;

            let targetEquipment = null;
            if (predeterminedItem && !isServerOwned(predeterminedItem) && !futureAwardedSet.has(predeterminedItem.key) && !futureAwardedSet.has(predeterminedItem.name)) {
                targetEquipment = predeterminedItem;
            } else {
                targetEquipment = pool.find(item => {
                    const isOwned = isServerOwned(item);
                    const isAlreadyAwarded = futureAwardedSet.has(item.key) || futureAwardedSet.has(item.name);
                    return !isOwned && !isAlreadyAwarded;
                }) || null;
            }

            let bestGuess = null;
            let isFallbackStarry = false;
            let isOwned = false;

            if (targetEquipment) {
                bestGuess = {
                    name: targetEquipment.name,
                    key: targetEquipment.key,
                    icon: targetEquipment.icon || targetEquipment.image
                };
                isFallbackStarry = false;
                isOwned = false;
                heroAwardMap.set(targetEquipment.key, node.level);
                heroAwardMap.set(targetEquipment.name, node.level);
                futureAwardMap.set(targetEquipment.key, node.level);
                futureAwardMap.set(targetEquipment.name, node.level);
                futureAwardedSet.add(targetEquipment.key);
                futureAwardedSet.add(targetEquipment.name);
            } else {
                bestGuess = {
                    name: '50 Starry Ore',
                    key: 'starryOre',
                    icon: 'assets/starry_ore.png'
                };
                isFallbackStarry = true;
                isOwned = true;
            }

            return {
                node,
                nodeTH,
                unlockLevel,
                bestGuess,
                targetEquipment,
                isFallbackStarry,
                isOwned
            };
        });

        // Resolve past claimed nodes in predetermined pool order
        const missedEquipmentSet = new Set();
        pastNodes.forEach((node, j) => {
            if (j < pool.length) {
                const item = pool[j];
                if (!isServerOwned(item) && !futureAwardMap.has(item.key) && !futureAwardMap.has(item.name)) {
                    missedEquipmentSet.add(item.key);
                    missedEquipmentSet.add(item.name);
                }
            }
        });

        pastNodes.forEach((node, j) => {
            const nodeTH = getNodeTownHallLevel(node.level);
            const unlockLevel = getEquipmentUnlockLevelForTH(nodeTH);

            let bestGuess = null;
            let isFallbackStarry = false;
            let isOwned = true;

            if (j < pool.length) {
                const item = pool[j];
                bestGuess = {
                    name: item.name,
                    key: item.key,
                    icon: item.icon || item.image
                };
                isFallbackStarry = false;
                isOwned = isServerOwned(item);
                if (isOwned) {
                    heroAwardMap.set(item.key, node.level);
                    heroAwardMap.set(item.name, node.level);
                }
            } else {
                bestGuess = {
                    name: '50 Starry Ore',
                    key: 'starryOre',
                    icon: 'assets/starry_ore.png'
                };
                isFallbackStarry = true;
                isOwned = true;
            }

            const poolOptions = pool.map(item => {
                let status = 'queued';
                let awardedAtLevel = null;
                const isThisItem = bestGuess && (item.key === bestGuess.key || item.name === bestGuess.name);

                if (isThisItem) {
                    if (isOwned) {
                        status = 'awardedHere';
                        awardedAtLevel = node.level;
                    } else if (futureAwardMap.has(item.key) || futureAwardMap.has(item.name)) {
                        status = 'nowAwardedAt';
                        awardedAtLevel = futureAwardMap.get(item.key) || futureAwardMap.get(item.name);
                    } else {
                        status = 'missed';
                    }
                } else if (missedEquipmentSet.has(item.key) || missedEquipmentSet.has(item.name)) {
                    status = 'missed';
                } else {
                    const targetAwardLevel = heroAwardMap.get(item.key) || heroAwardMap.get(item.name) || futureAwardMap.get(item.key) || futureAwardMap.get(item.name);
                    if (targetAwardLevel && targetAwardLevel < node.level) {
                        status = 'awardedEarlier';
                        awardedAtLevel = targetAwardLevel;
                    } else if (targetAwardLevel && targetAwardLevel > node.level) {
                        status = 'queued';
                        awardedAtLevel = targetAwardLevel;
                    } else if (isServerOwned(item)) {
                        status = 'owned';
                    }
                }

                return {
                    name: item.name,
                    key: item.key,
                    icon: item.icon || item.image,
                    status,
                    ...(awardedAtLevel ? { awardedAtLevel } : {})
                };
            });

            poolOptions.push({
                name: '50 Starry Ore',
                key: 'starryOre',
                icon: 'assets/starry_ore.png',
                status: isFallbackStarry ? 'awardedHere' : 'starryFallback'
            });

            resolutionMap[node.level] = {
                node,
                bestGuess,
                resolvedName: bestGuess.name,
                resolvedKey: bestGuess.key,
                resolvedIcon: bestGuess.icon,
                isFallbackStarry,
                fallbackStarry: node.fallbackStarry || 50,
                equipmentLevel: isFallbackStarry ? null : unlockLevel,
                isOwned,
                poolOptions
            };
        });

        // Assemble future node resolution map with poolOptions
        futureResolutions.forEach(({ node, unlockLevel, bestGuess, targetEquipment, isFallbackStarry, isOwned }) => {
            const poolOptions = pool.map(item => {
                let status = 'queued';
                let awardedAtLevel = null;
                if (targetEquipment && (item.key === targetEquipment.key || item.name === targetEquipment.name)) {
                    status = 'awardedHere';
                    awardedAtLevel = node.level;
                } else if (missedEquipmentSet.has(item.key) || missedEquipmentSet.has(item.name)) {
                    status = 'missed';
                } else {
                    const targetAwardLevel = heroAwardMap.get(item.key) || heroAwardMap.get(item.name) || futureAwardMap.get(item.key) || futureAwardMap.get(item.name);
                    if (targetAwardLevel && targetAwardLevel < node.level) {
                        status = 'awardedEarlier';
                        awardedAtLevel = targetAwardLevel;
                    } else if (targetAwardLevel && targetAwardLevel > node.level) {
                        status = 'queued';
                        awardedAtLevel = targetAwardLevel;
                    } else if (isServerOwned(item)) {
                        status = 'owned';
                    }
                }
                return {
                    name: item.name,
                    key: item.key,
                    icon: item.icon || item.image,
                    status,
                    ...(awardedAtLevel ? { awardedAtLevel } : {})
                };
            });

            poolOptions.push({
                name: '50 Starry Ore',
                key: 'starryOre',
                icon: 'assets/starry_ore.png',
                status: isFallbackStarry ? 'awardedHere' : 'starryFallback'
            });

            resolutionMap[node.level] = {
                node,
                bestGuess,
                resolvedName: bestGuess.name,
                resolvedKey: bestGuess.key,
                resolvedIcon: bestGuess.icon,
                isFallbackStarry,
                fallbackStarry: node.fallbackStarry || 50,
                equipmentLevel: isFallbackStarry ? null : unlockLevel,
                isOwned,
                poolOptions
            };
        });
    }

    return resolutionMap;
}

/**
 * Resolves the specific equipment reward (name, icon, level/fallback Starry Ore)
 * for Equipment milestone nodes based on deterministic track resolution.
 *
 * @param {any} node - Hero's journey node configuration.
 * @param {import('../../core/types.js').AppState | any} state - Application state.
 * @param {Record<number, any> | null} [trackResolution=null] - Optional precalculated track resolution.
 * @returns {any} Resolved node object with dynamic equipment metadata.
 */
export function getResolvedEquipmentReward(node, state, trackResolution = null) {
    if (node.type !== 'equipment' || !node.hero) return node;

    const resolution = trackResolution?.[node.level] || resolveHeroJourneyTrack(state)[node.level];
    if (!resolution) return node;

    return {
        ...node,
        ...resolution
    };
}

/**
 * Resolves the milestone node where an equipment item is actually awarded.
 * If the equipment was missed at an earlier claimed node, it resolves to the
 * future node where the item has been rescheduled to be awarded.
 *
 * @param {string} eqKey - Equipment key (e.g. 'darkCrown').
 * @param {string} eqName - Equipment name (e.g. 'Dark Crown').
 * @param {Record<number, any>} trackResolution - Track resolution map.
 * @param {import('../../core/types.js').AppState | any} [state=null] - Application state.
 * @returns {any | null} The resolved node entry from trackResolution, or null.
 */
function getAssignedEquipmentTrackNode(eqKey, eqName, trackResolution, state = null) {
    if (!trackResolution) return null;

    const cumulativeLevel = state ? getCumulativeHeroLevel(state) : 0;

    // Priority: future unreached node where equipment is awarded
    const futureAwardLevel = Object.keys(trackResolution).find(lvl => {
        if (Number(lvl) <= cumulativeLevel) return false;
        const res = trackResolution[lvl];
        if (!res || res.isFallbackStarry) return false;
        if (res.resolvedKey !== eqKey && res.resolvedName !== eqName) return false;
        const opt = res.poolOptions?.find(o => o.key === eqKey || o.name === eqName);
        return opt ? opt.status === 'awardedHere' : true;
    });

    if (futureAwardLevel) {
        return trackResolution[futureAwardLevel];
    }

    // Check rescheduled future node from earlier missed award
    for (const lvl of Object.keys(trackResolution)) {
        const res = trackResolution[lvl];
        if (!res) continue;
        const opt = res.poolOptions?.find(o => (o.key === eqKey || o.name === eqName) && o.status === 'nowAwardedAt' && o.awardedAtLevel);
        if (opt?.awardedAtLevel && trackResolution[opt.awardedAtLevel]) {
            return trackResolution[opt.awardedAtLevel];
        }
    }

    // Check past awarded node (e.g. already-owned milestone)
    const awardedLevel = Object.keys(trackResolution).find(lvl => {
        const res = trackResolution[lvl];
        if (!res || res.isFallbackStarry) return false;
        if (res.resolvedKey !== eqKey && res.resolvedName !== eqName) return false;
        const opt = res.poolOptions?.find(o => o.key === eqKey || o.name === eqName);
        return opt ? opt.status === 'awardedHere' : false;
    });

    if (awardedLevel) {
        return trackResolution[awardedLevel];
    }

    // Fallback: any matching node in resolution map
    const fallbackLevel = Object.keys(trackResolution).find(lvl => {
        const res = trackResolution[lvl];
        return res && !res.isFallbackStarry && (res.resolvedKey === eqKey || res.resolvedName === eqName);
    });

    if (fallbackLevel) {
        return trackResolution[fallbackLevel];
    }

    return null;
}

/**
 * Resolves the default equipment unlock level for unowned equipment.
 * If application state is provided, it dynamically queries the player's resolved track.
 * Otherwise, it falls back to the static baseline node.
 *
 * @param {string} [heroNameOrKey] - Hero name or identifier.
 * @param {string | any} [equipNameOrKey] - Equipment name or object.
 * @param {import('../../core/types.js').AppState | any} [state=null] - Optional application state.
 * @param {Record<string, any> | null} [precalculatedResolution=null] - Optional precalculated track resolution.
 * @returns {number} Default unlock level.
 */
export function getDefaultEquipmentUnlockLevel(heroNameOrKey, equipNameOrKey, state = null, precalculatedResolution = null) {
    const eqKey = typeof equipNameOrKey === 'string' ? equipNameOrKey : equipNameOrKey?.key;
    const eqName = typeof equipNameOrKey === 'object' ? equipNameOrKey?.name : equipNameOrKey;

    if (state || precalculatedResolution) {
        const trackResolution = precalculatedResolution || resolveHeroJourneyTrack(state);
        const assignedNode = getAssignedEquipmentTrackNode(eqKey, eqName, trackResolution, state);

        if (assignedNode?.equipmentLevel) {
            return assignedNode.equipmentLevel;
        }
    }

    let targetNodeLevel = null;

    for (const hKey in heroData) {
        const hero = heroData[hKey];
        if (!heroNameOrKey || hero.key === heroNameOrKey || hero.name === heroNameOrKey) {
            const eq = hero.equipment?.find(e => e.key === eqKey || e.name === eqName || e.key === equipNameOrKey || e.name === equipNameOrKey);
            if (eq) {
                if (eq.heroJourneyNode) {
                    targetNodeLevel = eq.heroJourneyNode;
                }
                break;
            }
        }
    }

    if (targetNodeLevel !== null) {
        const nodeTH = getNodeTownHallLevel(targetNodeLevel);
        return getEquipmentUnlockLevelForTH(nodeTH);
    }

    return 1;
}

/**
 * Checks whether an equipment item is unowned strictly based on official server response data.
 *
 * @param {string | any} equipNameOrKey - Equipment name or key.
 * @param {import('../../core/types.js').AppState | any} state - Application state.
 * @returns {boolean} Whether equipment is unowned on server.
 */
function isEquipmentServerUnowned(equipNameOrKey, state) {
    if (!state?.playerProfile) {
        return true;
    }
    const equipName = typeof equipNameOrKey === 'string' ? equipNameOrKey : equipNameOrKey?.name;
    const equipKey = typeof equipNameOrKey === 'string' ? equipNameOrKey : equipNameOrKey?.key;

    if (state.playerProfile.ownedEquipment) {
        const oe = state.playerProfile.ownedEquipment;
        if (equipName && Object.hasOwn(oe, equipName)) return false;
        if (equipKey && Object.hasOwn(oe, equipKey)) return false;
        for (const hKey in heroData) {
            const match = heroData[hKey]?.equipment?.find(e => e.key === equipKey || e.name === equipName || e.key === equipName || e.name === equipKey);
            if (match) {
                if (Object.hasOwn(oe, match.name) || Object.hasOwn(oe, match.key)) return false;
            }
        }
    }

    if (state.playerProfile.ownedHeroes) {
        for (const hName in state.playerProfile.ownedHeroes) {
            const h = state.playerProfile.ownedHeroes[hName];
            if (h.equipment?.some(e => e.name === equipName || e.name === equipKey)) {
                return false;
            }
        }
    }

    return true;
}

/**
 * Checks whether an equipment item corresponds to a future unreached node in Hero's Journey.
 *
 * @param {string} heroNameOrKey - Hero name or identifier.
 * @param {string | any} equipNameOrKey - Equipment name or identifier.
 * @param {import('../../core/types.js').AppState | any} state - Application state.
 * @param {Record<string, any> | null} [precalculatedResolution=null] - Optional precalculated track resolution.
 * @returns {boolean} Whether node is future/unreached.
 */
export function isHeroJourneyFutureOrUnclaimedEquipment(heroNameOrKey, equipNameOrKey, state, precalculatedResolution = null) {
    if (!state && !precalculatedResolution) return false;
    const eqKey = typeof equipNameOrKey === 'string' ? equipNameOrKey : equipNameOrKey?.key;
    const eqName = typeof equipNameOrKey === 'object' ? equipNameOrKey?.name : equipNameOrKey;

    const trackResolution = precalculatedResolution || resolveHeroJourneyTrack(state);
    const assignedNode = getAssignedEquipmentTrackNode(eqKey, eqName, trackResolution, state);

    if (assignedNode) {
        const cumulativeLevel = getCumulativeHeroLevel(state);
        return cumulativeLevel < Number(assignedNode.node.level);
    }

    let targetNodeLevel = null;

    for (const hKey in heroData) {
        const hero = heroData[hKey];
        if (!heroNameOrKey || hero.key === heroNameOrKey || hero.name === heroNameOrKey) {
            const eq = hero.equipment?.find(e => e.key === equipNameOrKey || e.name === equipNameOrKey || e.key === equipNameOrKey?.key || e.name === equipNameOrKey?.name);
            if (eq) {
                targetNodeLevel = eq.heroJourneyNode || null;
                break;
            }
        }
    }

    if (!targetNodeLevel) return false;

    const cumulativeLevel = getCumulativeHeroLevel(state);
    return cumulativeLevel < targetNodeLevel;
}

/**
 * Evaluates whether auto unlock level should be applied.
 * @param {string} heroNameOrKey - Hero canonical name or camelCase key (e.g. 'Barbarian King' or 'barbarianKing').
 * @param {string | any} equipNameOrKey - Equipment name or key.
 * @param {import('../../core/types.js').AppState | any} state - Application state.
 * @param {Record<string, any> | null} [precalculatedResolution=null] - Optional precalculated track resolution.
 * @returns {boolean} Whether auto-level adjustment applies.
 */
export function shouldApplyHeroJourneyAutoLevel(heroNameOrKey, equipNameOrKey, state, precalculatedResolution = null) {
    const heroNameMap = {
        barbarianKing: 'Barbarian King',
        archerQueen: 'Archer Queen',
        minionPrince: 'Minion Prince',
        grandWarden: 'Grand Warden',
        royalChampion: 'Royal Champion',
        dragonDuke: 'Dragon Duke'
    };
    const resolvedHeroName = heroNameMap[heroNameOrKey] || heroNameOrKey;
    const equipName = typeof equipNameOrKey === 'string' ? equipNameOrKey : equipNameOrKey?.name;

    if (!isEquipmentServerUnowned(equipName, state)) {
        return false;
    }

    if (!isHeroJourneyFutureOrUnclaimedEquipment(resolvedHeroName, equipName, state, precalculatedResolution)) {
        return false;
    }

    return true;
}
