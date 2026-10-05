/**
 * Player Village Synchronization & Data Ingestion Service for Damage Calculator.
 * Tier 3: Core State & Services.
 */

import { getDefensesData } from '../../data/defenseTargetsData.js';
import { equipmentDamageData } from '../../data/equipmentDamageData.js';
import { getDefaultModifierKey } from '../../domain/equipment/modifierCalculator.js';
import { getDefaultSuperchargeTier } from '../../domain/damage/defenseProgressionDomain.js';
import { state as appGlobalState } from '../../core/state.js';
import {
    damageCalcState,
    persistState,
    getShownTownHall,
    pruneDefenseOverrides
} from './damageCalcState.js';

const ALL_HERO_EQUIPMENT_KEYS = [
    'spiky_ball',
    'giant_arrow',
    'fireball',
    'seeking_shield',
    'flame_blower',
    'rocket_backpack'
];

/**
 * Synchronizes active Damage Calculator state with verified Player Data from Village Profiles.
 * Automatically aligns Town Hall levels, updates available spell/equipment levels,
 * defaults unowned equipment to disabled with level 1, and prunes invalid structure overrides.
 *
 * @param {Object} playerData - Player data payload from Clash API / Player Profile store.
 * @param {Object} [options={}] - Synchronization options.
 * @param {boolean} [options.resetUI] - Explicit flag indicating whether to reset UI state. If omitted, resets UI only when player Town Hall changes.
 * @param {boolean} [options.isFirstPlayer] - Whether this sync is onboarding the first player profile from guest mode.
 */
export function syncPlayerVillageData(playerData, options = {}) {
    if (!playerData || typeof playerData !== 'object') return;

    if (playerData.tag) {
        damageCalcState.activeTag = playerData.tag;
    }

    const prevTh = damageCalcState.playerTownHall;
    let targetTh = prevTh;
    if (playerData.townHallLevel) {
        targetTh = Math.max(1, Math.min(18, Number(playerData.townHallLevel) || 18));
        damageCalcState.playerTownHall = targetTh;
    }

    const shouldResetUI = options.resetUI !== undefined
        ? Boolean(options.resetUI)
        : (prevTh !== targetTh);

    // Automatically resolve and set active league modifier based on player league tier if not explicitly set by user (or if UI resets)
    const leagueObj = playerData.leagueTier || playerData.playerProfile?.leagueTier || playerData.league || playerData.playerProfile?.league;
    if (shouldResetUI) {
        damageCalcState.isModifierExplicit = false;
    }
    if (leagueObj && !damageCalcState.isModifierExplicit) {
        const derivedKey = getDefaultModifierKey(leagueObj.id, leagueObj.name);
        damageCalcState.modifier = derivedKey;
        if (appGlobalState.uiSettings) {
            appGlobalState.uiSettings.leagueModifier = derivedKey;
        }
    }

    // Synchronize spell levels if available in player data
    const spellsPayload = playerData.spells || playerData.playerProfile?.spells;
    if (spellsPayload && typeof spellsPayload === 'object' && !Array.isArray(spellsPayload)) {
        if (Number(spellsPayload.lightning) > 0) {
            damageCalcState.offense.spells.lightning = Number(spellsPayload.lightning);
            damageCalcState.zapQuake.lightningLevel = Number(spellsPayload.lightning);
        }
        if (Number(spellsPayload.earthquake) > 0) {
            damageCalcState.offense.spells.earthquake = Number(spellsPayload.earthquake);
            damageCalcState.zapQuake.earthquakeLevel = Number(spellsPayload.earthquake);
        }
    } else if (Array.isArray(spellsPayload)) {
        for (const sp of spellsPayload) {
            const cleanName = sp?.name ? sp.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') : '';
            if (cleanName === 'lightning_spell' || cleanName === 'lightning') {
                damageCalcState.offense.spells.lightning = sp.level;
                damageCalcState.zapQuake.lightningLevel = sp.level;
            } else if (cleanName === 'earthquake_spell' || cleanName === 'earthquake') {
                damageCalcState.offense.spells.earthquake = sp.level;
                damageCalcState.zapQuake.earthquakeLevel = sp.level;
            }
        }
    }

    // Determine owned equipment set from playerData
    const ownedEquipKeys = new Set();
    const hasEquipmentPayload = Array.isArray(playerData.heroEquipment) ||
        (playerData.ownedEquipment && typeof playerData.ownedEquipment === 'object') ||
        (playerData.heroes && typeof playerData.heroes === 'object');
    const prevEquipLevels = { ...(damageCalcState.offense?.equipment || {}) };

    if (Array.isArray(playerData.heroEquipment)) {
        for (const item of playerData.heroEquipment) {
            const cleanName = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
            if (equipmentDamageData[cleanName] && item.level) {
                damageCalcState.offense.equipment[cleanName] = item.level;
                ownedEquipKeys.add(cleanName);
                if (Array.isArray(damageCalcState.simulator?.steps)) {
                    for (const step of damageCalcState.simulator.steps) {
                        if (step.type === 'equipment' && step.id === cleanName) {
                            step.level = item.level;
                        }
                    }
                }
            }
        }
    } else if (playerData.ownedEquipment && typeof playerData.ownedEquipment === 'object') {
        for (const [name, lvl] of Object.entries(playerData.ownedEquipment)) {
            const cleanName = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
            if (equipmentDamageData[cleanName] && Number(lvl) > 0) {
                damageCalcState.offense.equipment[cleanName] = Number(lvl);
                ownedEquipKeys.add(cleanName);
                if (Array.isArray(damageCalcState.simulator?.steps)) {
                    for (const step of damageCalcState.simulator.steps) {
                        if (step.type === 'equipment' && step.id === cleanName) {
                            step.level = Number(lvl);
                        }
                    }
                }
            }
        }
    }

    if (playerData.heroes && typeof playerData.heroes === 'object') {
        for (const heroState of Object.values(playerData.heroes)) {
            if (heroState?.equipment && typeof heroState.equipment === 'object') {
                for (const [equipName, eqState] of Object.entries(heroState.equipment)) {
                    const cleanName = equipName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                    const lvl = Number(eqState?.level) || (typeof eqState === 'number' ? eqState : 0);
                    if (equipmentDamageData[cleanName] && lvl > 0) {
                        damageCalcState.offense.equipment[cleanName] = lvl;
                        ownedEquipKeys.add(cleanName);
                        if (Array.isArray(damageCalcState.simulator?.steps)) {
                            for (const step of damageCalcState.simulator.steps) {
                                if (step.type === 'equipment' && step.id === cleanName) {
                                    step.level = lvl;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Unowned equipment handling: for player profiles, unowned equipment is disabled and defaults to level 1.
    if (hasEquipmentPayload) {
        if (!damageCalcState.offense.enabledSources) {
            damageCalcState.offense.enabledSources = {
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
            };
        }
        for (const eqKey of ALL_HERO_EQUIPMENT_KEYS) {
            if (!ownedEquipKeys.has(eqKey)) {
                damageCalcState.offense.enabledSources[eqKey] = false;
                damageCalcState.offense.equipment[eqKey] = 1;
                if (Array.isArray(damageCalcState.simulator?.steps)) {
                    for (const step of damageCalcState.simulator.steps) {
                        if (step.type === 'equipment' && step.id === eqKey) {
                            step.level = 1;
                        }
                    }
                }
            } else if (!options.isFirstPlayer) {
                if (shouldResetUI || prevEquipLevels[eqKey] === 1 || damageCalcState.offense.enabledSources[eqKey] === undefined) {
                    damageCalcState.offense.enabledSources[eqKey] = true;
                }
            }
        }
    }

    const shownTH = getShownTownHall(damageCalcState);

    if (shouldResetUI) {
        damageCalcState.defenseLevelOverrides = {};
        damageCalcState.defenseSuperchargeOverrides = {};
        damageCalcState.globalSuperchargeTier = shownTH >= 18 ? 2 : 0;
        damageCalcState.zapQuake.selectedCluster = [];
        damageCalcState.zapQuake.adjacentPairs = [];
        damageCalcState.zapQuake.clusterEquipment = [];
        damageCalcState.zapQuake.clusterEquipmentSharing = {};
        damageCalcState.zapQuake.selectedCombos = {};
        damageCalcState.zapQuake.selectedComboIndex = 0;
        damageCalcState.zapQuake.selectedClusterComboIndex = 0;
        damageCalcState.zapQuake.searchQuery = '';
        damageCalcState.zapQuake.buildingFilter = 'all';
        damageCalcState.zapQuake.combosExpanded = false;
        damageCalcState.zapQuake.isRemainingExpanded = false;
        damageCalcState.enabledBuildingGroups = {
            defenses: true,
            heroes: true,
            guardians: true,
            other: true,
            unavailable: false
        };
        if (damageCalcState.simulator) {
            const simDefKey = damageCalcState.simulator.targetDefenseKey;
            const simMaxLvl = getDefensesData()[simDefKey]?.maxLevel || 1;
            const simTargetLvl = Math.min(damageCalcState.simulator.targetDefenseLevel || simMaxLvl, simMaxLvl);
            damageCalcState.simulator.superchargeTier = getDefaultSuperchargeTier(simDefKey, simTargetLvl, targetTh);
        }
    } else {
        pruneDefenseOverrides(damageCalcState);
    }

    persistState();
}
