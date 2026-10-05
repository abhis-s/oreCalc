import { safeJsonParse } from '../utils/jsonUtils.js';
import {
    CANONICAL_PLAYER_PREFIX,
    COMING_SOON_EQUIPMENT_MAPPINGS,
    isComingSoonEquipment,
    LEGACY_PLAYER_PREFIX
} from './constants.js';
const normalizePlayerTag = (tag) => {
    if (!tag) return '';
    const trimmed = String(tag).trim().toUpperCase();
    if (trimmed === 'DEFAULT0') return 'DEFAULT0';
    return trimmed.replace(/#/g, '');
};

/**
 * Cleans up and sorts upgrade plan steps against the equipment current level.
 * @param {Record<string, any>} equipment - Target equipment state object.
 */
function cleanupEquipmentUpgradePlan(equipment) {
    if (!equipment?.upgradePlan) return;
    const currentLevel = equipment.level || 1;
    const remainingSteps = [];
    for (const stepKey in equipment.upgradePlan) {
        const step = equipment.upgradePlan[stepKey];
        if (step?.enabled && (step.targetLevel || step.target) > currentLevel) {
            remainingSteps.push({
                targetLevel: Number(step.targetLevel || step.target),
                enabled: true,
                priorityIndex: Number(step.priorityIndex) || 0
            });
        }
    }
    if (remainingSteps.length === 0) {
        delete equipment.upgradePlan;
    } else {
        remainingSteps.sort((a, b) => a.targetLevel - b.targetLevel);
        const newUpgradePlan = {};
        remainingSteps.forEach((step, index) => {
            newUpgradePlan[String(index + 1)] = step;
        });
        equipment.upgradePlan = newUpgradePlan;
    }
}

/**
 * Migrates obsolete "Coming Soon" equipment in player hero state to newly added equipment.
 * Invariants:
 * 1. ONLY priority list planning (upgradePlan) is migrated to the replacement equipment.
 * 2. If the replacement equipment already has an active upgradePlan, migration is NOT made.
 * 3. Equipment levels and checked states are strictly preserved / untouched.
 * 4. Obsolete "Coming Soon" equipment entries are purged from hero.equipment.
 *
 * @param {Record<string, any>} heroes - Player hero state slice.
 * @returns {boolean} True if any changes were made.
 */
export function migrateComingSoonEquipment(heroes) {
    if (!heroes || typeof heroes !== 'object') return false;
    let modified = false;

    for (const heroKey in heroes) {
        const hero = heroes[heroKey];
        if (!hero || !hero.equipment || typeof hero.equipment !== 'object') continue;

        const comingSoonKeys = Object.keys(hero.equipment).filter(isComingSoonEquipment);
        if (comingSoonKeys.length === 0) continue;

        const mapping = COMING_SOON_EQUIPMENT_MAPPINGS.find(m =>
            m.heroKeys.includes(heroKey)
        );

        if (mapping) {
            /** @type {string} */
            let targetKey = mapping.targetName;
            if (!hero.equipment[targetKey] && hero.equipment[mapping.targetKey]) {
                targetKey = mapping.targetKey;
            }

            if (!hero.equipment[targetKey]) {
                hero.equipment[targetKey] = {
                    level: 1,
                    checked: true
                };
                modified = true;
            }

            const targetEquip = hero.equipment[targetKey];
            const targetHasPlan = Boolean(targetEquip.upgradePlan && Object.keys(targetEquip.upgradePlan).length > 0);

            let sourceWithPlan = null;
            for (const sKey of comingSoonKeys) {
                const sEquip = hero.equipment[sKey];
                if (sEquip?.upgradePlan && Object.keys(sEquip.upgradePlan).length > 0) {
                    sourceWithPlan = sEquip;
                    break;
                }
            }

            // Invariant: Only migrate priority planning if target has no plan and source has one
            if (!targetHasPlan && sourceWithPlan) {
                targetEquip.upgradePlan = structuredClone(sourceWithPlan.upgradePlan);
                cleanupEquipmentUpgradePlan(targetEquip);
                modified = true;
            }
        }

        // Purge coming-soon equipment in all cases (mapped or unmapped)
        for (const sKey of comingSoonKeys) {
            delete hero.equipment[sKey];
            modified = true;
        }
    }

    return modified;
}

/**
 * Application Settings Migration helper.
 *
 * @param {Record<string, any>} oldUI - Legacy UI settings.
 * @returns {Record<string, any>} Migrated app settings.
 */
export function migrateAppSettings(oldUI) {
    if (!oldUI) return {};
    const rawTimestamps = oldUI.timestamp || oldUI.uiTimestamps || {};
    return {
        currency: {
            code: typeof oldUI.currency === 'string' ? oldUI.currency : 'USD'
        },
        language: oldUI.language || 'auto',
        enableLevelInput: !!oldUI.enableLevelInput,
        summaryTimeframe: oldUI.incomeTimeframe || 'monthly',
        uiTimestamps: {
            tour: rawTimestamps.tour ?? null
        }
    };
}

/**
 * Scans localStorage for orphaned or legacy player partition keys and deletes or migrates them.
 * Also sanitizes the heroJourney schema on valid retained partitions.
 * @param {any} [stateObj=null] - Optional application state object to prune in-memory.
 * @returns {string[]} Array of deleted orphaned player partition keys.
 */
export function cleanupOrphanedPlayerPartitions(stateObj = null) {
    /** @type {string[]} */
    const deletedKeys = [];
    if (typeof localStorage === 'undefined') return deletedKeys;

    try {
        const allowedTags = new Set();

        const collectTags = (key) => {
            const savedTagsStr = localStorage.getItem(key);
            const savedTagsList = safeJsonParse(savedTagsStr, []);
            if (Array.isArray(savedTagsList)) {
                savedTagsList.forEach(t => {
                    const clean = normalizePlayerTag(t);
                    if (clean) allowedTags.add(clean);
                });
            }
        };

        collectTags('clashCalc_playerTags');
        collectTags('oreCalc_playerTags');

        const isGuestAllowed = allowedTags.has('DEFAULT0') || allowedTags.size === 0;

        const allKeys = typeof localStorage.key === 'function'
            ? Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter(Boolean)
            : Object.keys(localStorage);

        for (const key of allKeys) {
            if (!key) continue;
            let activePrefix = null;
            if (key.startsWith(CANONICAL_PLAYER_PREFIX)) {
                activePrefix = CANONICAL_PLAYER_PREFIX;
            } else if (key.startsWith(LEGACY_PLAYER_PREFIX)) {
                activePrefix = LEGACY_PLAYER_PREFIX;
            }

            if (activePrefix) {
                const rawSuffix = key.slice(activePrefix.length);
                const cleanTag = normalizePlayerTag(rawSuffix);
                const canonicalKey = `${activePrefix}${cleanTag}`;

                const isAllowed = cleanTag && (
                    allowedTags.has(cleanTag) ||
                    (cleanTag === 'DEFAULT0' && isGuestAllowed)
                );

                const isLegacy = key.startsWith(LEGACY_PLAYER_PREFIX);
                const canonicalCounterpart = `${CANONICAL_PLAYER_PREFIX}${cleanTag}`;
                const canonicalExists = isLegacy && localStorage.getItem(canonicalCounterpart) !== null;

                if (isLegacy && canonicalExists) {
                    localStorage.removeItem(key);
                    deletedKeys.push(key);
                } else if (!isAllowed) {
                    localStorage.removeItem(key);
                    deletedKeys.push(key);
                    if (stateObj?.allPlayersData && cleanTag && stateObj.allPlayersData[cleanTag]) {
                        delete stateObj.allPlayersData[cleanTag];
                    }
                } else if (key !== canonicalKey) {
                    const canonicalExists = localStorage.getItem(canonicalKey) !== null;
                    if (canonicalExists) {
                        localStorage.removeItem(key);
                        deletedKeys.push(key);
                    } else {
                        const raw = localStorage.getItem(key);
                        if (raw) {
                            const parsed = safeJsonParse(raw, null);
                            if (parsed && typeof parsed === 'object') {
                                if (parsed.heroJourney && typeof parsed.heroJourney === 'object') {
                                    parsed.heroJourney = {
                                        acceleratedRewards: Boolean(parsed.heroJourney.acceleratedRewards ?? parsed.heroJourney.accelerated ?? (parsed.heroJourney.rewardMode === 'accelerated')),
                                        revealBeyondTH: Boolean(parsed.heroJourney.revealBeyondTH),
                                        hidden: Boolean(parsed.heroJourney.hidden)
                                    };
                                }
                                if (parsed.heroes && typeof parsed.heroes === 'object') {
                                    migrateComingSoonEquipment(parsed.heroes);
                                }
                                localStorage.setItem(canonicalKey, JSON.stringify(parsed));
                            } else {
                                localStorage.setItem(canonicalKey, raw);
                            }
                        }
                        localStorage.removeItem(key);
                        deletedKeys.push(key);
                    }
                } else {
                    const raw = localStorage.getItem(canonicalKey);
                    const parsed = safeJsonParse(raw, null);
                    if (parsed && typeof parsed === 'object') {
                        let shouldWrite = false;
                        if (parsed.heroJourney && typeof parsed.heroJourney === 'object') {
                            parsed.heroJourney = {
                                acceleratedRewards: Boolean(parsed.heroJourney.acceleratedRewards ?? parsed.heroJourney.accelerated ?? (parsed.heroJourney.rewardMode === 'accelerated')),
                                revealBeyondTH: Boolean(parsed.heroJourney.revealBeyondTH),
                                hidden: Boolean(parsed.heroJourney.hidden)
                            };
                            shouldWrite = true;
                        }
                        if (parsed.heroes && typeof parsed.heroes === 'object') {
                            if (migrateComingSoonEquipment(parsed.heroes)) {
                                shouldWrite = true;
                            }
                        }
                        if (shouldWrite) {
                            localStorage.setItem(canonicalKey, JSON.stringify(parsed));
                        }
                    }
                }
            }
        }

        if (stateObj) {
            if (stateObj.heroes && typeof stateObj.heroes === 'object') {
                migrateComingSoonEquipment(stateObj.heroes);
            }
            if (stateObj.allPlayersData && typeof stateObj.allPlayersData === 'object') {
                for (const t in stateObj.allPlayersData) {
                    if (stateObj.allPlayersData[t]?.heroes) {
                        migrateComingSoonEquipment(stateObj.allPlayersData[t].heroes);
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error during orphaned player partitions cleanup:", error);
    }
    return deletedKeys;
}
