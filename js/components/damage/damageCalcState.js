/**
 * State Management for Equipment Damage & ZapQuake Calculator.
 * Tier 3: Core State & Services.
 */

import { safeJsonParse } from '../../utils/jsonUtils.js';
import { getDefensesData } from '../../data/defenseTargetsData.js';
import { getDefaultSuperchargeTier, getMaxSuperchargeTier, getMaxDefenseLevelForTownHall, isDefenseInSeason, snapDefenseLevel } from '../../domain/damage/defenseProgressionDomain.js';
import { state as appGlobalState } from '../../core/state.js';

const STORAGE_KEY = 'clashCalc_damageCalcState';

/**
 * Default state snapshot for Damage Calculator.
 */
function createDefaultState() {
    const defaultTh = 18;
    const defaultSimDefKey = 'scattershot';
    /** @type {number} */
    const defaultSimMaxLvl = getDefensesData()?.[defaultSimDefKey]?.maxLevel || 7;

    const stateObj = {
        activeTab: 'zapquake',
        activeTag: null,
        playerTownHall: defaultTh,
        globalSuperchargeTier: 2,
        modifier: 'standard',
        isModifierExplicit: false,
        modalActiveTab: 'offense',
        enabledBuildingGroups: {
            defenses: true,
            heroes: true,
            guardians: true,
            other: true,
            unavailable: false
        },
        defenseLevelOverrides: {},
        defenseSuperchargeOverrides: {},
        offense: {
            spells: {
                lightning: 13,
                earthquake: 8
            },
            ccSpells: {
                lightning: 13,
                earthquake: 8
            },
            equipment: {
                spiky_ball: 27,
                giant_arrow: 18,
                fireball: 27,
                seeking_shield: 18,
                flame_blower: 18,
                rocket_backpack: 27
            },
            enabledSources: {
                lightning: true,
                earthquake: true,
                spiky_ball: true,
                giant_arrow: true,
                fireball: true,
                seeking_shield: true,
                flame_blower: true,
                rocket_backpack: true,
                cc_lightning: true,
                cc_earthquake: true
            }
        },
        zapQuake: {
            searchQuery: '',
            buildingFilter: 'all',
            lightningLevel: 13,
            earthquakeLevel: 8,
            selectedCluster: [],
            adjacentPairs: [],
            clusterEquipment: [],
            clusterEquipmentSharing: {},
            multiSelectMode: true,
            viewMode: 'compact',
            combosExpanded: false,
            isRemainingExpanded: false,
            selectedCombos: {},
            selectedComboIndex: 0,
            selectedClusterComboIndex: 0,
            mobileDockExpanded: false
        },
        simulator: {
            targetDefenseKey: defaultSimDefKey,
            targetDefenseLevel: defaultSimMaxLvl,
            superchargeTier: getDefaultSuperchargeTier(defaultSimDefKey, defaultSimMaxLvl, defaultTh),
            filterStatus: 'all',
            buildingFilter: 'all',
            searchQuery: '',
            builderHutLevel: 8,
            builderCount: 1,
            rageTowerActive: false,
            steps: [
                { type: 'equipment', id: 'fireball', level: 27 },
                { type: 'spell', id: 'earthquake', level: 8, count: 1 },
                { type: 'spell', id: 'lightning', level: 13, count: 2 }
            ]
        }
    };

    Object.defineProperty(stateObj, 'leagueId', {
        get() {
            return this.modifier;
        },
        set(val) {
            this.modifier = val;
        },
        enumerable: true,
        configurable: true
    });

    return stateObj;
}

/**
 * Active in-memory state.
 */
export const damageCalcState = createDefaultState();

/**
 * Loads persisted damage calculator state from local storage.
 */
export function loadPersistedState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;

        const parsed = safeJsonParse(raw, null);
        if (!parsed || typeof parsed !== 'object') return;

        damageCalcState.modalActiveTab = 'offense';
        if (parsed.activeTab) damageCalcState.activeTab = parsed.activeTab;
        if (parsed.modifier) {
            damageCalcState.modifier = parsed.modifier;
            damageCalcState.isModifierExplicit = Boolean(parsed.isModifierExplicit);
        } else if (parsed.leagueId) {
            damageCalcState.modifier = parsed.leagueId;
            damageCalcState.isModifierExplicit = Boolean(parsed.isModifierExplicit);
        } else if (appGlobalState.uiSettings?.leagueModifier) {
            damageCalcState.modifier = appGlobalState.uiSettings.leagueModifier;
        }
        if (parsed.playerTownHall) damageCalcState.playerTownHall = Math.max(1, Math.min(18, Number(parsed.playerTownHall) || 18));
        if (parsed.enabledBuildingGroups && typeof parsed.enabledBuildingGroups === 'object') {
            damageCalcState.enabledBuildingGroups = {
                defenses: true,
                heroes: parsed.enabledBuildingGroups.heroes !== false,
                guardians: parsed.enabledBuildingGroups.guardians !== false,
                other: parsed.enabledBuildingGroups.other !== false,
                unavailable: Boolean(parsed.enabledBuildingGroups.unavailable)
            };
        }

        if (parsed.offense) {
            if (parsed.offense.spells) Object.assign(damageCalcState.offense.spells, parsed.offense.spells);
            if (parsed.offense.ccSpells) Object.assign(damageCalcState.offense.ccSpells, parsed.offense.ccSpells);
            if (parsed.offense.equipment) Object.assign(damageCalcState.offense.equipment, parsed.offense.equipment);
            if (parsed.offense.enabledSources) Object.assign(damageCalcState.offense.enabledSources, parsed.offense.enabledSources);
        }

        if (parsed.zapQuake) {
            Object.assign(damageCalcState.zapQuake, parsed.zapQuake);
            damageCalcState.zapQuake.mobileDockExpanded = false;
            if (!['all', 'defenses', 'heroes', 'guardians', 'other'].includes(damageCalcState.zapQuake.buildingFilter)) {
                damageCalcState.zapQuake.buildingFilter = 'all';
            }
            if (!['compact', 'detailed'].includes(damageCalcState.zapQuake.viewMode)) {
                damageCalcState.zapQuake.viewMode = 'compact';
            }
            if (!damageCalcState.zapQuake.selectedCombos || typeof damageCalcState.zapQuake.selectedCombos !== 'object') {
                damageCalcState.zapQuake.selectedCombos = {};
            }
            if (!Array.isArray(damageCalcState.zapQuake.adjacentPairs)) {
                damageCalcState.zapQuake.adjacentPairs = [];
            }
            if (!Array.isArray(damageCalcState.zapQuake.clusterEquipment)) {
                damageCalcState.zapQuake.clusterEquipment = [];
            }
            if (!damageCalcState.zapQuake.clusterEquipmentSharing || typeof damageCalcState.zapQuake.clusterEquipmentSharing !== 'object') {
                damageCalcState.zapQuake.clusterEquipmentSharing = {};
            }
        }

        if (parsed.simulator) {
            Object.assign(damageCalcState.simulator, parsed.simulator);
            if (!['all', 'defenses', 'heroes', 'guardians', 'other'].includes(damageCalcState.simulator.buildingFilter)) {
                damageCalcState.simulator.buildingFilter = 'all';
            }
            if (Array.isArray(damageCalcState.simulator.steps)) {
                damageCalcState.simulator.steps = damageCalcState.simulator.steps.filter(
                    s => s && s.type !== 'delay'
                );
            }
        }
        if (Array.isArray(damageCalcState.zapQuake.selectedCluster)) {
            let seenCrafted = false;
            let seenGuardian = false;
            let heroCount = 0;
            const shownTh = getShownTownHall(damageCalcState);
            damageCalcState.zapQuake.selectedCluster = damageCalcState.zapQuake.selectedCluster
                .filter(t => {
                    if (!t || !isDefenseInSeason(t.defenseKey)) return false;
                    const defObj = getDefensesData()[t.defenseKey];
                    if (defObj?.minTH && shownTh < defObj.minTH) return false;
                    if (defObj?.subCategory === 'crafted') {
                        if (seenCrafted) return false;
                        seenCrafted = true;
                    }
                    if (defObj?.category === 'guardian') {
                        if (seenGuardian) return false;
                        seenGuardian = true;
                    }
                    if (defObj?.category === 'hero') {
                        if (heroCount >= 4) return false;
                        heroCount++;
                    }
                    return true;
                })
                .slice(0, 5)
                .map(item => {
                    const maxThLvl = getMaxDefenseLevelForTownHall(item.defenseKey, shownTh).level;
                    const cappedLvl = maxThLvl > 0 ? Math.min(item.level, maxThLvl) : item.level;
                    const maxTier = getMaxSuperchargeTier(item.defenseKey, cappedLvl);
                    return {
                        ...item,
                        level: cappedLvl,
                        superchargeTier: item.superchargeTier !== undefined ? Math.min(item.superchargeTier, maxTier) : 0
                    };
                });
        }

        if (typeof parsed.globalSuperchargeTier === 'number' && Number.isInteger(parsed.globalSuperchargeTier)) {
            damageCalcState.globalSuperchargeTier = Math.max(0, Math.min(2, parsed.globalSuperchargeTier));
        }

        if (parsed.modalActiveTab === 'offense' || parsed.modalActiveTab === 'defense' || parsed.modalActiveTab === 'buildings') {
            damageCalcState.modalActiveTab = parsed.modalActiveTab === 'buildings' ? 'defense' : parsed.modalActiveTab;
        }

        if (parsed.defenseLevelOverrides && typeof parsed.defenseLevelOverrides === 'object') {
            damageCalcState.defenseLevelOverrides = {};
            for (const [k, v] of Object.entries(parsed.defenseLevelOverrides)) {
                const def = getDefensesData()[k];
                if (def && isDefenseInSeason(def) && typeof v === 'number' && Number.isInteger(v)) {
                    const clamped = snapDefenseLevel(k, v, def.maxLevel || 1);
                    damageCalcState.defenseLevelOverrides[k] = clamped;
                }
            }
        }

        if (parsed.defenseSuperchargeOverrides && typeof parsed.defenseSuperchargeOverrides === 'object') {
            damageCalcState.defenseSuperchargeOverrides = {};
            for (const [k, v] of Object.entries(parsed.defenseSuperchargeOverrides)) {
                const def = getDefensesData()[k];
                if (def && isDefenseInSeason(def) && typeof v === 'number' && Number.isInteger(v) && v > 0) {
                    const currentLvl = damageCalcState.defenseLevelOverrides[k] || def.maxLevel;
                    const maxTier = getMaxSuperchargeTier(k, currentLvl);
                    if (maxTier > 0) {
                        damageCalcState.defenseSuperchargeOverrides[k] = Math.min(v, maxTier);
                    }
                }
            }
        }
    } catch {
        // Fall back gracefully to defaults on storage failure
    }
}

/**
 * Persists current damage calculator state to local storage.
 */
export function persistState() {
    try {
        const { mobileDockExpanded, ...persistedZapQuake } = damageCalcState.zapQuake;

        const payload = JSON.stringify({
            activeTab: damageCalcState.activeTab,
            modifier: damageCalcState.modifier,
            leagueId: damageCalcState.modifier,
            isModifierExplicit: damageCalcState.isModifierExplicit,
            playerTownHall: damageCalcState.playerTownHall,
            globalSuperchargeTier: damageCalcState.globalSuperchargeTier,
            modalActiveTab: damageCalcState.modalActiveTab,
            defenseLevelOverrides: damageCalcState.defenseLevelOverrides,
            defenseSuperchargeOverrides: damageCalcState.defenseSuperchargeOverrides,
            offense: damageCalcState.offense,
            zapQuake: persistedZapQuake,
            simulator: damageCalcState.simulator
        });
        localStorage.setItem(STORAGE_KEY, payload);
    } catch {
        // Storage quotas or private browsing guard
    }
}

/**
/**
 * Resets state to default values.
 */
export function resetDamageCalcState() {
    const fresh = createDefaultState();
    Object.assign(damageCalcState, fresh);
    Object.defineProperty(damageCalcState, 'leagueId', {
        get() {
            return this.modifier;
        },
        set(val) {
            this.modifier = val;
        },
        enumerable: true,
        configurable: true
    });
    persistState();
}

/**
 * Actively compares and prunes defense level and supercharge overrides against the current Town Hall defaults.
 * Any override that matches the default max level for the active Town Hall, exceeds the Town Hall cap,
 * or belongs to a locked building is wiped out of the state.
 *
 * @param {Object} [state=damageCalcState] - Target damage calculator state.
 * @returns {number} Active pruned overrides count.
 */
export function pruneDefenseOverrides(state = damageCalcState) {
    if (!state) return 0;

    const currentTH = getShownTownHall(state);

    if (state.defenseLevelOverrides && typeof state.defenseLevelOverrides === 'object') {
        for (const [key, level] of Object.entries(state.defenseLevelOverrides)) {
            const def = getDefensesData()[key];
            const info = getMaxDefenseLevelForTownHall(key, currentTH);
            if (key === 'town_hall' || !def || !info || info.status === 'locked' || info.level === 0 || !isDefenseInSeason(def)) {
                delete state.defenseLevelOverrides[key];
                continue;
            }

            const defaultLvl = info.level || def.maxLevel || 1;
            const numericLvl = Number(level) || 1;
            const validLvl = snapDefenseLevel(key, numericLvl, defaultLvl);

            if (validLvl >= defaultLvl) {
                delete state.defenseLevelOverrides[key];
            } else if (validLvl !== numericLvl) {
                state.defenseLevelOverrides[key] = validLvl;
            }
        }
    }

    if (state.defenseSuperchargeOverrides && typeof state.defenseSuperchargeOverrides === 'object') {
        for (const [key, tier] of Object.entries(state.defenseSuperchargeOverrides)) {
            const def = getDefensesData()[key];
            const info = getMaxDefenseLevelForTownHall(key, currentTH);
            if (!def || !info || info.status === 'locked' || !isDefenseInSeason(def)) {
                delete state.defenseSuperchargeOverrides[key];
                continue;
            }

            const currentLvl = state.defenseLevelOverrides?.[key] !== undefined
                ? state.defenseLevelOverrides[key]
                : (info.level || def.maxLevel || 1);

            const maxSc = getMaxSuperchargeTier(key, currentLvl);
            if (maxSc === 0 || currentTH < 18) {
                delete state.defenseSuperchargeOverrides[key];
                continue;
            }

            const defaultSc = (currentTH >= 18 && currentLvl >= (def.maxLevel || 1))
                ? getDefaultSuperchargeTier(key, currentLvl, currentTH)
                : 0;

            const numericTier = Number(tier) || 0;
            if (numericTier === defaultSc) {
                delete state.defenseSuperchargeOverrides[key];
            } else if (numericTier > maxSc) {
                const clampedTier = Math.min(numericTier, maxSc);
                if (clampedTier === defaultSc) {
                    delete state.defenseSuperchargeOverrides[key];
                } else {
                    state.defenseSuperchargeOverrides[key] = clampedTier;
                }
            }
        }
    }

    if (currentTH < 18) {
        state.globalSuperchargeTier = 0;
    } else if (state.globalSuperchargeTier === undefined || state.globalSuperchargeTier === null) {
        state.globalSuperchargeTier = 2;
    }

    const levelCount = Object.keys(state.defenseLevelOverrides || {}).length;
    const scCount = Object.keys(state.defenseSuperchargeOverrides || {}).length;
    return levelCount + scCount;
}

/**
 * Resolves the active Town Hall shown and used in the Damage Calculator.
 * Clamps the default shown Town Hall to TH 9 if the player's Town Hall is lower (TH 1–8),
 * while preserving the actual playerTownHall in state without mutating it.
 *
 * @param {Object} [state=damageCalcState] - Target damage calculator state.
 * @returns {number} Shown Town Hall level (9 to 18).
 */
export function getShownTownHall(state = damageCalcState) {
    const raw = state?.playerTownHall;
    const th = Number(raw) || 18;
    return Math.max(9, Math.min(18, Math.floor(th)));
}

/**
 * Resolves the active global supercharge tier from damage calculator state.
 * At Town Hall levels below 18, supercharge is unavailable and returns 0.
 * At Town Hall 18, returns state.globalSuperchargeTier (defaulting to 2).
 *
 * @param {Object} [state=damageCalcState] - Target damage calculator state.
 * @returns {number} Active supercharge tier (0, 1, or 2).
 */
export function getGlobalSuperchargeTier(state = damageCalcState) {
    const currentTH = getShownTownHall(state);
    if (currentTH < 18) return 0;
    const tier = state?.globalSuperchargeTier;
    if (tier !== undefined && tier !== null) {
        return Math.max(0, Math.min(2, Math.floor(Number(tier)) || 0));
    }
    return 2;
}

/**
 * Sets the active player Town Hall level and actively prunes overrides that match
 * the new Town Hall baseline defaults.
 *
 * @param {number} townHallLevel - Town Hall level (1 to 18).
 */
export function setPlayerTownHall(townHallLevel) {
    const th = Math.max(1, Math.min(Math.floor(Number(townHallLevel) || 18), 18));
    const prevTh = damageCalcState.playerTownHall;
    damageCalcState.playerTownHall = th;
    const shownTh = getShownTownHall(damageCalcState);
    const prevShownTh = getShownTownHall({ playerTownHall: prevTh });
    if (shownTh >= 18 && (prevShownTh < 18 || damageCalcState.globalSuperchargeTier === undefined || damageCalcState.globalSuperchargeTier === 0)) {
        setGlobalSuperchargeTier(2);
    }
    pruneDefenseOverrides(damageCalcState);
    if (Array.isArray(damageCalcState.zapQuake.selectedCluster)) {
        damageCalcState.zapQuake.selectedCluster = damageCalcState.zapQuake.selectedCluster
            .filter(item => {
                if (!item) return false;
                const def = getDefensesData()[item.defenseKey];
                return !def?.minTH || shownTh >= def.minTH;
            })
            .map(item => {
                const maxThLvl = getMaxDefenseLevelForTownHall(item.defenseKey, shownTh).level;
                const cappedLvl = maxThLvl > 0 ? Math.min(item.level, maxThLvl) : item.level;
                const maxTier = getMaxSuperchargeTier(item.defenseKey, cappedLvl);
                return {
                    ...item,
                    level: cappedLvl,
                    superchargeTier: item.superchargeTier !== undefined ? Math.min(item.superchargeTier, maxTier) : 0
                };
            });
    }
    persistState();
}

/**
 * Applies a Town Hall preset by setting the player Town Hall and resetting all defense buildings
 * to their maximum available level for that Town Hall (clearing all custom overrides).
 *
 * @param {number} townHallLevel - Town Hall level (1 to 18).
 */
export function applyTownHallPreset(townHallLevel) {
    const th = Math.max(1, Math.min(Math.floor(Number(townHallLevel) || 18), 18));
    damageCalcState.playerTownHall = th;
    damageCalcState.defenseLevelOverrides = {};
    damageCalcState.defenseSuperchargeOverrides = {};
    const shownTh = getShownTownHall(damageCalcState);
    if (shownTh >= 18) {
        setGlobalSuperchargeTier(2);
    } else {
        damageCalcState.globalSuperchargeTier = 0;
    }
    pruneDefenseOverrides(damageCalcState);
    if (Array.isArray(damageCalcState.zapQuake.selectedCluster)) {
        damageCalcState.zapQuake.selectedCluster = damageCalcState.zapQuake.selectedCluster
            .filter(item => {
                if (!item) return false;
                const def = getDefensesData()[item.defenseKey];
                return !def?.minTH || shownTh >= def.minTH;
            })
            .map(item => {
                const maxThLvl = getMaxDefenseLevelForTownHall(item.defenseKey, shownTh).level;
                const newLvl = maxThLvl > 0 ? maxThLvl : item.level;
                const maxTier = getMaxSuperchargeTier(item.defenseKey, newLvl);
                const defaultTier = getDefaultSuperchargeTier(item.defenseKey, newLvl, shownTh);
                return {
                    ...item,
                    level: newLvl,
                    superchargeTier: Math.min(defaultTier, maxTier)
                };
            });
    }
    persistState();
}

/**
 * Clears all defense level and supercharge overrides back to default empty state.
 */
export function resetDefenseOverrides() {
    damageCalcState.defenseLevelOverrides = {};
    damageCalcState.defenseSuperchargeOverrides = {};
    const shownTh = getShownTownHall(damageCalcState);
    if (shownTh >= 18) {
        setGlobalSuperchargeTier(2);
    }
    if (Array.isArray(damageCalcState.zapQuake.selectedCluster)) {
        damageCalcState.zapQuake.selectedCluster.forEach(item => {
            if (!item) return;
            const maxThLvl = getMaxDefenseLevelForTownHall(item.defenseKey, shownTh).level;
            if (maxThLvl > 0) {
                item.level = maxThLvl;
            }
            item.superchargeTier = getDefaultSuperchargeTier(item.defenseKey, item.level, shownTh);
        });
    }
    persistState();
}

/**
 * Globally sets the supercharge tier across all supported defenses upon explicit user interaction.
 * Completely overrides any per-building supercharge overrides in defenseSuperchargeOverrides,
 * clamping each defense to its maximum supported tier at its current level.
 *
 * @param {number|string} tier - Supercharge tier (0, 1, or 2).
 */
export function setGlobalSuperchargeTier(tier) {
    const validTier = Math.max(0, Math.min(2, Math.floor(Number(tier) || 0)));
    damageCalcState.globalSuperchargeTier = validTier;

    if (!damageCalcState.defenseSuperchargeOverrides) {
        damageCalcState.defenseSuperchargeOverrides = {};
    }

    const currentTH = getShownTownHall(damageCalcState);
    for (const [key, def] of Object.entries(getDefensesData())) {
        if (!isDefenseInSeason(def)) {
            delete damageCalcState.defenseSuperchargeOverrides[key];
            continue;
        }
        const info = getMaxDefenseLevelForTownHall(key, currentTH);
        const currentLvl = damageCalcState.defenseLevelOverrides?.[key] !== undefined
            ? damageCalcState.defenseLevelOverrides[key]
            : (info?.level || def.maxLevel || 1);
        const maxTier = getMaxSuperchargeTier(key, currentLvl);
        if (maxTier > 0) {
            damageCalcState.defenseSuperchargeOverrides[key] = Math.min(validTier, maxTier);
        } else {
            delete damageCalcState.defenseSuperchargeOverrides[key];
        }
    }

    if (Array.isArray(damageCalcState.zapQuake.selectedCluster)) {
        damageCalcState.zapQuake.selectedCluster = damageCalcState.zapQuake.selectedCluster.filter(
            item => item && isDefenseInSeason(item.defenseKey)
        );
        damageCalcState.zapQuake.selectedCluster.forEach(item => {
            const maxTier = getMaxSuperchargeTier(item.defenseKey, item.level);
            item.superchargeTier = Math.min(validTier, maxTier);
        });
    }

    persistState();
}

/**
 * Resolves the active battle modifier from damage calculator state.
 * Supports state.modifier as canonical while honoring legacy state.leagueId.
 *
 * @param {Record<string, any>} [state] - Damage calculator state.
 * @returns {string} The active modifier key ('standard', 'legend3', 'legend2', 'legend1', 'esports').
 */
export function getActiveModifier(state) {
    if (!state) return 'standard';
    if (state.modifier && state.modifier !== 'standard') return state.modifier;
    return state.leagueId || state.modifier || 'standard';
}

let memoryBuildingGroupPrefs = null;

/**
 * Retrieves the in-memory collapse preferences for building editor groups.
 * Default: only 'defenses' is expanded (true), all others collapsed (false).
 *
 * @returns {Record<string, boolean>}
 */
export function getBuildingGroupSessionPreferences() {
    if (memoryBuildingGroupPrefs) {
        return { ...memoryBuildingGroupPrefs };
    }
    return {
        defenses: true,
        heroes: false,
        guardians: false,
        other: false,
        unavailable: false
    };
}

/**
 * Updates a single building editor group's collapse preference in memory.
 *
 * @param {string} groupId - Group identifier ('defenses', 'heroes', 'guardians', 'other', 'unavailable').
 * @param {boolean} isExpanded - Whether the group is expanded.
 */
export function setBuildingGroupSessionPreference(groupId, isExpanded) {
    const prefs = getBuildingGroupSessionPreferences();
    prefs[groupId] = Boolean(isExpanded);
    memoryBuildingGroupPrefs = { ...prefs };
}

/**
 * Resolves whether a building category group is enabled for display on the page.
 * 'defenses' is an invariant and always returns true.
 *
 * @param {Object | null | undefined} state - Damage calculator state.
 * @param {string} groupId - Group identifier ('defenses', 'heroes', 'guardians', 'other', 'unavailable').
 * @returns {boolean} Whether the group is enabled.
 */
export function isBuildingGroupEnabled(state, groupId) {
    if (groupId === 'defenses') return true;
    const groups = state?.enabledBuildingGroups || damageCalcState.enabledBuildingGroups;
    if (!groups) {
        return groupId !== 'unavailable';
    }
    if (groupId === 'unavailable') {
        return Boolean(groups.unavailable);
    }
    return groups[groupId] !== false;
}
