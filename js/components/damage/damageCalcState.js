/**
 * State Management for Equipment Damage & ZapQuake Calculator.
 * Tier 3: Core State & Services.
 */

import { safeJsonParse } from '../../utils/jsonUtils.js';
import { MAX_TOWN_HALL } from '../../core/constants.js';
import { getDefensesData } from '../../data/defenseTargetsData.js';
import { clampSpellLevelToTownHall, getMaxSpellLevel } from '../../domain/damage/damageFormulas.js';
import {
    getDefaultSuperchargeTier,
    getMaxDefenseLevelForTownHall,
    getMaxSuperchargeTier,
    getMaxSuperchargeTierForTownHall,
    isClusterDefenseSunsetForTownHall,
    isDefenseInSeason,
    isSuperchargeAvailableForTownHall,
    snapDefenseLevel
} from '../../domain/damage/defenseProgressionDomain.js';
import { state as appGlobalState } from '../../core/state.js';

const STORAGE_KEY = 'clashCalc_damageCalcState';

/**
 * Default state snapshot for Damage Calculator.
 */
function createDefaultState() {
    const defaultTh = MAX_TOWN_HALL;
    const defaultZapLevel = getMaxSpellLevel('lightning', defaultTh);
    const defaultEqLevel = getMaxSpellLevel('earthquake', defaultTh);
    const defaultCcZapLevel = getMaxSpellLevel('lightning');
    const defaultCcEqLevel = getMaxSpellLevel('earthquake');
    const defenses = getDefensesData();
    // Leave null before preloadDefensesData() resolves so getGlobalSuperchargeTier derives dynamically once loaded.
    const defaultGlobalScTier = Object.keys(defenses).length > 0
        ? getMaxSuperchargeTierForTownHall(defaultTh)
        : null;
    const defaultSimDefKey = 'scattershot';
    /** @type {number} */
    const defaultSimMaxLvl = defenses?.[defaultSimDefKey]?.maxLevel || 7;

    const stateObj = {
        activeTab: 'zapquake',
        activeTag: null,
        playerTownHall: defaultTh,
        globalSuperchargeTier: defaultGlobalScTier,
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
                lightning: defaultZapLevel,
                earthquake: defaultEqLevel
            },
            ccSpells: {
                lightning: defaultCcZapLevel,
                earthquake: defaultCcEqLevel
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
            lightningLevel: defaultZapLevel,
            earthquakeLevel: defaultEqLevel,
            selectedCluster: [],
            adjacentPairs: [],
            clusterEquipment: [],
            clusterEquipmentSharing: {},
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
            steps: [
                { type: 'equipment', id: 'fireball', level: 27 },
                { type: 'spell', id: 'earthquake', level: defaultEqLevel, count: 1 },
                { type: 'spell', id: 'lightning', level: defaultZapLevel, count: 2 }
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
 * Removes retired single-select properties from a zapQuake state object.
 *
 * @param {Record<string, any>} zq - Target zapQuake state map.
 */
function stripLegacyZapQuakeKeys(zq) {
    if (!zq || typeof zq !== 'object') return;
    delete zq.multiSelectMode;
    delete zq.defenseKey;
    delete zq.defenseLevel;
}

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
        if (parsed.playerTownHall) {
            damageCalcState.playerTownHall = Math.max(1, Math.min(MAX_TOWN_HALL, Number(parsed.playerTownHall) || MAX_TOWN_HALL));
        }
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
            stripLegacyZapQuakeKeys(damageCalcState.zapQuake);
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
        syncStateSpellCaps(damageCalcState, false);

        if (parsed.simulator) {
            Object.assign(damageCalcState.simulator, parsed.simulator);
            delete damageCalcState.simulator.builderHutLevel;
            delete damageCalcState.simulator.builderCount;
            delete damageCalcState.simulator.rageTowerActive;
            if (!['all', 'defenses', 'heroes', 'guardians', 'other'].includes(damageCalcState.simulator.buildingFilter)) {
                damageCalcState.simulator.buildingFilter = 'all';
            }
            if (Array.isArray(damageCalcState.simulator.steps)) {
                damageCalcState.simulator.steps = damageCalcState.simulator.steps.filter(
                    s => s && s.type !== 'delay' && s.type !== 'builder_repair'
                );
            }
        }
        if (Array.isArray(damageCalcState.zapQuake.selectedCluster)) {
            pruneSelectedClusterForTownHall(
                damageCalcState.zapQuake,
                getShownTownHall(damageCalcState),
                { enforceCaps: true }
            );
        }

        if (typeof parsed.globalSuperchargeTier === 'number' && Number.isInteger(parsed.globalSuperchargeTier)) {
            const maxLoadedScTier = getMaxSuperchargeTierForTownHall(getShownTownHall(damageCalcState));
            damageCalcState.globalSuperchargeTier = Math.max(0, Math.min(maxLoadedScTier, parsed.globalSuperchargeTier));
        } else if (damageCalcState.globalSuperchargeTier === null) {
            damageCalcState.globalSuperchargeTier = getMaxSuperchargeTierForTownHall(getShownTownHall(damageCalcState));
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
        const persistedZapQuake = { ...damageCalcState.zapQuake };
        delete persistedZapQuake.mobileDockExpanded;
        stripLegacyZapQuakeKeys(persistedZapQuake);

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
 * @param {Date|string|number} [referenceDate=new Date()] - Reference date for seasonal filtering.
 * @returns {number} Active pruned overrides count.
 */
export function pruneDefenseOverrides(state = damageCalcState, referenceDate = new Date()) {
    if (!state) return 0;

    const currentTH = getShownTownHall(state);

    if (state.defenseLevelOverrides && typeof state.defenseLevelOverrides === 'object') {
        for (const [key, level] of Object.entries(state.defenseLevelOverrides)) {
            const def = getDefensesData()[key];
            const info = getMaxDefenseLevelForTownHall(key, currentTH);
            if (key === 'town_hall' || !def || !info || info.status === 'locked' || info.level === 0 || !isDefenseInSeason(def, referenceDate)) {
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
            if (!def || !info || info.status === 'locked' || !isDefenseInSeason(def, referenceDate)) {
                delete state.defenseSuperchargeOverrides[key];
                continue;
            }

            const currentLvl = state.defenseLevelOverrides?.[key] !== undefined
                ? state.defenseLevelOverrides[key]
                : (info.level || def.maxLevel || 1);

            const maxSc = getMaxSuperchargeTier(key, currentLvl);
            if (maxSc === 0 || !isSuperchargeAvailableForTownHall(currentTH)) {
                delete state.defenseSuperchargeOverrides[key];
                continue;
            }

            const defaultSc = (isSuperchargeAvailableForTownHall(currentTH) && currentLvl >= (def.maxLevel || 1))
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

    if (!isSuperchargeAvailableForTownHall(currentTH)) {
        state.globalSuperchargeTier = 0;
    } else if (state.globalSuperchargeTier === undefined || state.globalSuperchargeTier === null) {
        state.globalSuperchargeTier = getMaxSuperchargeTierForTownHall(currentTH);
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
 * @returns {number} Shown Town Hall level (9 to MAX_TOWN_HALL).
 */
export function getShownTownHall(state = damageCalcState) {
    const raw = state?.playerTownHall;
    const th = Number(raw) || MAX_TOWN_HALL;
    return Math.max(9, Math.min(MAX_TOWN_HALL, Math.floor(th)));
}

/**
 * Resolves the active global supercharge tier from damage calculator state.
 * Below the current max Town Hall, supercharge is unavailable and returns 0.
 * At the max Town Hall, returns state.globalSuperchargeTier (defaulting to max available tier).
 *
 * @param {Object} [state=damageCalcState] - Target damage calculator state.
 * @returns {number} Active supercharge tier.
 */
export function getGlobalSuperchargeTier(state = damageCalcState) {
    const currentTH = getShownTownHall(state);
    if (!isSuperchargeAvailableForTownHall(currentTH)) return 0;
    const maxScTier = getMaxSuperchargeTierForTownHall(currentTH);
    const tier = state?.globalSuperchargeTier;
    if (tier !== undefined && tier !== null) {
        return Math.max(0, Math.min(maxScTier, Math.floor(Number(tier)) || 0));
    }
    return maxScTier;
}

/**
 * Synchronizes own and Clan Castle spell levels in damage calculator state to valid bounds.
 * Own spells are capped to the player Town Hall cap (or set to that TH max when usePreset is true).
 * Donated Clan Castle spells remain uncapped by Town Hall and clamp only to global spell maximums.
 *
 * @param {Object} [targetState=damageCalcState] - Target damage calculator state.
 * @param {boolean} [usePreset=false] - Whether to set own spells to the TH unlocked maximum.
 */
export function syncStateSpellCaps(targetState = damageCalcState, usePreset = false) {
    if (!targetState) return;
    const th = Number(targetState.playerTownHall) || MAX_TOWN_HALL;
    if (!targetState.offense) targetState.offense = {};
    if (!targetState.offense.spells) targetState.offense.spells = {};
    if (!targetState.offense.ccSpells) targetState.offense.ccSpells = {};
    if (!targetState.zapQuake) targetState.zapQuake = {};

    const nextZap = usePreset
        ? getMaxSpellLevel('lightning', th)
        : clampSpellLevelToTownHall('lightning', targetState.offense.spells.lightning ?? targetState.zapQuake.lightningLevel, th);
    const nextEq = usePreset
        ? getMaxSpellLevel('earthquake', th)
        : clampSpellLevelToTownHall('earthquake', targetState.offense.spells.earthquake ?? targetState.zapQuake.earthquakeLevel, th);

    targetState.offense.spells.lightning = nextZap;
    targetState.offense.spells.earthquake = nextEq;
    targetState.zapQuake.lightningLevel = nextZap;
    targetState.zapQuake.earthquakeLevel = nextEq;

    targetState.offense.ccSpells.lightning = clampSpellLevelToTownHall('lightning', targetState.offense.ccSpells.lightning, null);
    targetState.offense.ccSpells.earthquake = clampSpellLevelToTownHall('earthquake', targetState.offense.ccSpells.earthquake, null);
}

/**
 * Prunes locked, seasonal, and Cluster-Planner-sunset entries from selectedCluster,
 * synchronizes adjacentPairs and clusterEquipmentSharing indices, and clamps or resets levels.
 *
 * @param {Object} zq - Damage calculator zapQuake state object.
 * @param {number} shownTh - Active effective Town Hall level.
 * @param {Object} [options={}]
 * @param {boolean} [options.resetToMax=false] - Reset kept targets to TH max level & default supercharge.
 * @param {boolean} [options.enforceCaps=false] - Enforce crafted, guardian, hero, season, and 5-target caps.
 */
function pruneSelectedClusterForTownHall(zq, shownTh, { resetToMax = false, enforceCaps = false } = {}) {
    if (!zq || !Array.isArray(zq.selectedCluster)) return;

    let seenCrafted = false;
    let seenGuardian = false;
    let heroCount = 0;
    const keptOldToNewIdx = new Map();
    const nextCluster = [];

    zq.selectedCluster.forEach((item, oldIdx) => {
        if (!item) return;
        if (enforceCaps && !isDefenseInSeason(item.defenseKey)) return;
        const def = getDefensesData()[item.defenseKey];
        if (def?.minTH && shownTh < def.minTH) return;
        if (isClusterDefenseSunsetForTownHall(item.defenseKey, shownTh)) return;
        if (enforceCaps) {
            if (nextCluster.length >= 5) return;
            if (def?.subCategory === 'crafted') {
                if (seenCrafted) return;
                seenCrafted = true;
            }
            if (def?.category === 'guardian') {
                if (seenGuardian) return;
                seenGuardian = true;
            }
            if (def?.category === 'hero') {
                if (heroCount >= 4) return;
                heroCount++;
            }
        }

        keptOldToNewIdx.set(oldIdx, nextCluster.length);
        const maxThLvl = getMaxDefenseLevelForTownHall(item.defenseKey, shownTh).level;
        const nextLvl = resetToMax
            ? (maxThLvl > 0 ? maxThLvl : item.level)
            : (maxThLvl > 0 ? Math.min(item.level, maxThLvl) : item.level);
        const maxTier = getMaxSuperchargeTier(item.defenseKey, nextLvl);
        const nextTier = resetToMax
            ? Math.min(getDefaultSuperchargeTier(item.defenseKey, nextLvl, shownTh), maxTier)
            : (item.superchargeTier !== undefined ? Math.min(item.superchargeTier, maxTier) : 0);

        nextCluster.push({
            ...item,
            level: nextLvl,
            superchargeTier: nextTier
        });
    });

    const clusterChanged = nextCluster.length !== zq.selectedCluster.length;
    zq.selectedCluster = nextCluster;

    if (!clusterChanged) return;

    if (Array.isArray(zq.adjacentPairs)) {
        const remappedPairs = [];
        for (const pair of zq.adjacentPairs) {
            const [uRaw, vRaw] = Array.isArray(pair) ? pair : String(pair).split('-').map(Number);
            const u = keptOldToNewIdx.get(uRaw);
            const v = keptOldToNewIdx.get(vRaw);
            if (u !== undefined && v !== undefined && u !== v) {
                remappedPairs.push(`${Math.min(u, v)}-${Math.max(u, v)}`);
            }
        }
        zq.adjacentPairs = Array.from(new Set(remappedPairs));
    }

    if (zq.clusterEquipmentSharing && typeof zq.clusterEquipmentSharing === 'object') {
        const remappedSharing = {};
        for (const [equipKey, targets] of Object.entries(zq.clusterEquipmentSharing)) {
            if (!Array.isArray(targets)) continue;
            const mappedTargets = Array.from(new Set(
                targets
                    .map(t => keptOldToNewIdx.get(t))
                    .filter(t => t !== undefined)
            )).sort((a, b) => a - b);
            if (mappedTargets.length > 0 && mappedTargets.length < nextCluster.length) {
                remappedSharing[equipKey] = mappedTargets;
            }
        }
        zq.clusterEquipmentSharing = remappedSharing;
    }
}

/**
 * Sets the active player Town Hall level and actively prunes overrides that match
 * the new Town Hall baseline defaults.
 *
 * @param {number} townHallLevel - Town Hall level (1 to MAX_TOWN_HALL).
 */
export function setPlayerTownHall(townHallLevel) {
    const th = Math.max(1, Math.min(Math.floor(Number(townHallLevel) || MAX_TOWN_HALL), MAX_TOWN_HALL));
    const prevTh = damageCalcState.playerTownHall;
    damageCalcState.playerTownHall = th;
    syncStateSpellCaps(damageCalcState, false);
    const shownTh = getShownTownHall(damageCalcState);
    const prevShownTh = getShownTownHall({ playerTownHall: prevTh });
    if (isSuperchargeAvailableForTownHall(shownTh) && (!isSuperchargeAvailableForTownHall(prevShownTh) || damageCalcState.globalSuperchargeTier == null || damageCalcState.globalSuperchargeTier === 0)) {
        setGlobalSuperchargeTier(getMaxSuperchargeTierForTownHall(shownTh));
    }
    pruneDefenseOverrides(damageCalcState);
    pruneSelectedClusterForTownHall(damageCalcState.zapQuake, shownTh);
    persistState();
}

/**
 * Applies a Town Hall preset by setting the player Town Hall and resetting all defense buildings
 * to their maximum available level for that Town Hall (clearing all custom overrides).
 *
 * @param {number} townHallLevel - Town Hall level (1 to 18).
 */
export function applyTownHallPreset(townHallLevel) {
    const th = Math.max(1, Math.min(Math.floor(Number(townHallLevel) || MAX_TOWN_HALL), MAX_TOWN_HALL));
    damageCalcState.playerTownHall = th;
    syncStateSpellCaps(damageCalcState, true);
    damageCalcState.defenseLevelOverrides = {};
    damageCalcState.defenseSuperchargeOverrides = {};
    const shownTh = getShownTownHall(damageCalcState);
    if (isSuperchargeAvailableForTownHall(shownTh)) {
        setGlobalSuperchargeTier(getMaxSuperchargeTierForTownHall(shownTh));
    } else {
        damageCalcState.globalSuperchargeTier = 0;
    }
    pruneDefenseOverrides(damageCalcState);
    pruneSelectedClusterForTownHall(damageCalcState.zapQuake, shownTh, { resetToMax: true });
    persistState();
}

/**
 * Clears all defense level and supercharge overrides back to default empty state.
 */
export function resetDefenseOverrides() {
    damageCalcState.defenseLevelOverrides = {};
    damageCalcState.defenseSuperchargeOverrides = {};
    const shownTh = getShownTownHall(damageCalcState);
    if (isSuperchargeAvailableForTownHall(shownTh)) {
        setGlobalSuperchargeTier(getMaxSuperchargeTierForTownHall(shownTh));
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
