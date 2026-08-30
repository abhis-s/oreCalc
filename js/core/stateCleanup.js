import { getEquipmentMaxLevel } from '../data/equipmentCommonData.js';
import { safeJsonParse } from '../utils/jsonUtils.js';
import { compareVersions } from '../utils/versionUtils.js';

const PLAYER_PREFIX = 'oreCalc_player_';
const PLAYER_TAGS_KEY = 'oreCalc_playerTags';
const RECENT_SEARCHES_KEY = 'oreCalc_recentSearches';

const normalizePlayerTag = (tag) => {
    if (!tag) return '';
    const trimmed = String(tag).trim().toUpperCase();
    if (trimmed === 'DEFAULT0') return 'DEFAULT0';
    return trimmed.replace(/#/g, '');
};

const getPlayerStorageKey = (tag) => `${PLAYER_PREFIX}${normalizePlayerTag(tag)}`;

/**
 * Copies the level of each equipment item from old player data to new player data.
 * @param {Record<string, any>} oldHeroData - Legacy hero state.
 * @param {Record<string, any>} newHeroData - Target hero state to populate.
 */
function migrateEquipmentLevels(oldHeroData, newHeroData) {
    if (!oldHeroData || !newHeroData) return;
    for (const heroName in oldHeroData) {
        const oldHero = oldHeroData[heroName];
        const newHero = newHeroData[heroName];
        if (oldHero && newHero && oldHero.equipment && newHero.equipment) {
            for (const equipName in oldHero.equipment) {
                const oldEquip = oldHero.equipment[equipName];
                const newEquip = newHero.equipment[equipName];
                if (oldEquip && newEquip) {
                    newEquip.level = Number(oldEquip.level) || 1;
                }
            }
        }
    }
}

/**
 * Sequential priority list step migrator from step 1 to 100.
 *
 * @param {Record<string, any>} oldEquipPlan - Legacy equipment upgrade plan.
 * @returns {Record<string, import('./types.js').UpgradePlanStep> | undefined} Cleaned upgrade plan.
 */
function migrateUpgradePlan(oldEquipPlan) {
    if (!oldEquipPlan) return undefined;
    const cleanPlan = {};
    for (let step = 1; step <= 100; step++) {
        const stepStr = String(step);
        const stepData = oldEquipPlan[stepStr];
        // If we do not find a specific step number or if it is disabled, we end there
        if (!stepData || !stepData.enabled) {
            break;
        }
        cleanPlan[stepStr] = {
            targetLevel: Number(stepData.target) || 18,
            enabled: true,
            priorityIndex: Number(stepData.priorityIndex) || 0
        };
    }
    return Object.keys(cleanPlan).length > 0 ? cleanPlan : undefined;
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
            privacy: rawTimestamps.privacy ?? null,
            tos: rawTimestamps.tos ?? rawTimestamps.terms ?? null,
            welcome: rawTimestamps.welcome ?? null,
            tour: rawTimestamps.tour ?? null
        }
    };
}

/**
 * Migrates a player state instance (individual player data).
 *
 * @param {Record<string, any>} playerState - Raw player state slice.
 * @returns {import('./types.js').PlayerData | null} Migrated player data.
 */
function migratePlayerState(playerState) {
    if (!playerState) return null;

    const heroes = {};
    if (playerState.heroes) {
        for (const heroName in playerState.heroes) {
            try {
                const oldHero = playerState.heroes[heroName];
                if (!oldHero || typeof oldHero !== 'object') continue;
                const newHero = {
                    enabled: oldHero.enabled !== undefined ? !!oldHero.enabled : true,
                    equipment: {}
                };
                if (oldHero.equipment) {
                    for (const equipName in oldHero.equipment) {
                        try {
                            const oldEquip = oldHero.equipment[equipName];
                            if (!oldEquip || typeof oldEquip !== 'object') continue;
                            const newEquip = {
                                level: 1,
                                checked: oldEquip.checked !== undefined ? !!oldEquip.checked : true
                            };
                            const plan = migrateUpgradePlan(oldEquip.upgradePlan);
                            if (plan) {
                                newEquip.upgradePlan = plan;
                            }
                            newHero.equipment[equipName] = newEquip;
                        } catch (err) {
                            console.error(`Error migrating equipment ${equipName} for hero ${heroName}:`, err);
                        }
                    }
                }
                heroes[heroName] = newHero;
            } catch (err) {
                console.error(`Error migrating hero ${heroName}:`, err);
            }
        }
    }

    try {
        migrateEquipmentLevels(playerState.heroes, heroes);
    } catch (err) {
        console.error('Error migrating equipment levels:', err);
    }

    let income = {};
    try {
        const oldInc = playerState.income || {};
        const oldStar = oldInc.starBonus || {};
        const oldShop = oldInc.shopOffers || {};
        const shopOffersObj = {
            "0": {},
            "15": {},
            "16": {}
        };

        const cleanSet = (oldSet) => {
            const result = {};
            if (oldSet && typeof oldSet === 'object') {
                for (const key in oldSet) {
                    const count = Number(oldSet[key]) || 0;
                    if (count > 0) {
                        result[key] = count;
                    }
                }
            }
            return result;
        };

        if (oldShop.sets) {
            if (oldShop.sets.TH16_Set) {
                shopOffersObj["16"] = cleanSet(oldShop.sets.TH16_Set);
            }
            if (oldShop.sets.TH15_Set) {
                shopOffersObj["15"] = cleanSet(oldShop.sets.TH15_Set);
            }
        }

        let selectedSetNum = 0;
        if (oldShop.selectedSet && typeof oldShop.selectedSet === 'string') {
            if (oldShop.selectedSet === 'none') {
                selectedSetNum = 0;
            } else {
                const match = oldShop.selectedSet.match(/\d+/);
                selectedSetNum = match ? (Number(match[0]) || 0) : 0;
            }
        } else if (oldShop.selectedSet !== undefined && oldShop.selectedSet !== null) {
            selectedSetNum = Number(oldShop.selectedSet) || 0;
        }
        shopOffersObj.selectedSet = selectedSetNum;

        income = {
            starBonus: {
                league: oldStar.league || 105000000,
                "2x": {
                    frequency: 2,
                    duration: 0,
                    lastEvent: '2026-05'
                },
                thUpgrades: {}
            },
            shopOffers: shopOffersObj,
            raidMedals: {
                packs: {
                    shiny: oldInc.raidMedals?.packs?.shiny || 0,
                    glowy: oldInc.raidMedals?.packs?.glowy || 0,
                    starry: oldInc.raidMedals?.packs?.starry || 0
                },
                earned: oldInc.raidMedals?.earned || 0
            },
            gems: {
                packs: {
                    shiny: oldInc.gems?.packs?.shiny || 0,
                    glowy: oldInc.gems?.packs?.glowy || 0,
                    starry: oldInc.gems?.packs?.starry || 0
                }
            },
            eventPass: {
                eventPass: oldInc.eventPass?.type === 'event',
                includeEquipment: !!oldInc.eventPass?.equipmentBought,
                bonusTrackMedals: 0,
                purchasedMedals: 0
            },
            eventTrader: {
                packs: {
                    shiny: oldInc.eventTrader?.packs?.shiny || 0,
                    glowy: oldInc.eventTrader?.packs?.glowy || 0,
                    starry: oldInc.eventTrader?.packs?.starry || 0
                }
            },
            clanWar: {
                oresPerAttack: {
                    shiny: oldInc.clanWar?.oresPerAttack?.shiny || 0,
                    glowy: oldInc.clanWar?.oresPerAttack?.glowy || 0,
                    starry: oldInc.clanWar?.oresPerAttack?.starry || 0
                },
                warsPerMonth: oldInc.clanWar?.warsPerMonth || 0,
                winRate: oldInc.clanWar?.winRate || 50,
                drawRate: oldInc.clanWar?.drawRate || 0
            },
            cwl: {
                oresPerAttack: {
                    shiny: oldInc.cwl?.oresPerAttack?.shiny || 0,
                    glowy: oldInc.cwl?.oresPerAttack?.glowy || 0,
                    starry: oldInc.cwl?.oresPerAttack?.starry || 0
                },
                hitsPerSeason: oldInc.cwl?.hitsPerSeason || 0,
                winRate: oldInc.cwl?.winRate || 50,
                drawRate: oldInc.cwl?.drawRate || 0
            },
            supercellEvents: {
                worldChampionship: !!oldInc.championship?.supercellEvents
            },
            prospector: {
                fromOre: 'shiny',
                toOre: 'glowy',
                goldPass: !!oldInc.prospector?.goldPass,
                assistedConversion: true,
                strategyMode: 0
            }
        };
    } catch (err) {
        console.error('Error migrating income state:', err);
    }

    let planner = {};
    try {
        const oldPlan = playerState.planner || {};
        planner = {
            customMaxLevel: {
                common: oldPlan.customMaxLevel?.common || getEquipmentMaxLevel('common'),
                epic: oldPlan.customMaxLevel?.epic || getEquipmentMaxLevel('epic')
            },
            calendar: {
                settings: { firstDayOfWeek: 'auto', showChipIcons: true, autoPlaceScope: 'tillEnd' },
                view: { select: 'monthly', month: '', week: '' },
                dates: {},
                isDirty: true,
                customChips: [],
                customChipData: {},
                customChipSettings: {}
            }
        };
    } catch (err) {
        console.error('Error migrating planner state:', err);
    }

    return {
        heroes,
        // storedOres is intentionally NOT migrated (deleted/reset during migration)
        // to align with the clean state tracking.
        storedOres: {
            shiny: 0,
            glowy: 0,
            starry: 0
        },
        income,
        planner,
        // playerProfile is intentionally NOT migrated (deleted/reset during migration)
        // because it is supposed to load fresh from the Clash of Clans API.
        playerProfile: null,
        onboardingTimestamp: typeof playerState.onboardingTimestamp === 'number' ? playerState.onboardingTimestamp : null,
        heroJourney: playerState.heroJourney || { acceleratedRewards: false },
        currency: {
            code: typeof playerState.currency === 'string' ? playerState.currency : 'USD',
            globalPricing: {}
        }
    };
}

/**
 * Migrates the full monolithic state into partitioned keys.
 * @param {Record<string, any>} legacyState - Legacy monolithic state payload.
 */
export function migrateFullState(legacyState) {
    if (!legacyState || !legacyState.allPlayersData) {
        // Safeguard: Ensure appVersion is written so the lock is released
        const appSettingsStr = localStorage.getItem('oreCalc_appSettings');
        const cleanAppSettings = (appSettingsStr ? safeJsonParse(appSettingsStr, {}) : {}) || {};
        cleanAppSettings.appVersion = '2.0.0';
        localStorage.setItem('oreCalc_appSettings', JSON.stringify(cleanAppSettings));
        localStorage.removeItem('oreCalculatorState');
        localStorage.removeItem('OreCalculatorState');
        return;
    }

    const originalVersion = legacyState.appVersion || '1.0.0';
    try {
        sessionStorage.setItem('oreCalc_showChangelog', 'true');
        sessionStorage.setItem('oreCalc_showChangelogFromVersion', originalVersion);
    } catch (e) {
        console.error('Error setting migration changelog version flag:', e);
    }

    try {
        const legacyUserId = localStorage.getItem('oreCalcUserId');
        if (legacyUserId) {
            localStorage.setItem('oreCalc_userId', legacyUserId);
            localStorage.removeItem('oreCalcUserId');
        }
    } catch (e) {
        console.error('Error migrating user ID:', e);
    }

    try {
        const oldUI = legacyState.uiSettings || {};
        const cleanAppSettings = migrateAppSettings(oldUI);
        cleanAppSettings.appVersion = '2.0.0';
        cleanAppSettings.timestamp = legacyState.timestamp || new Date().toISOString();
        localStorage.setItem('oreCalc_appSettings', JSON.stringify(cleanAppSettings));
    } catch (e) {
        console.error('Error migrating global UI settings:', e);
    }

    let savedPlayerTags = [];
    try {
        savedPlayerTags = legacyState.savedPlayerTags && legacyState.savedPlayerTags.length > 0
            ? legacyState.savedPlayerTags
            : (legacyState.lastPlayerTag ? [legacyState.lastPlayerTag] : ['DEFAULT0']);
    } catch (e) {
        console.error('Error determining player tags:', e);
        savedPlayerTags = ['DEFAULT0'];
    }

    const migratedPlayerTags = [];
    for (const tag of savedPlayerTags) {
        if (!tag) continue;
        try {
            const upperTag = tag.toUpperCase();
            if (upperTag.includes('DEFAULT') || upperTag.includes('GUEST')) continue;

            const cleanTag = upperTag.startsWith('#') ? upperTag.substring(1) : upperTag;

            const oldPlayer = legacyState.allPlayersData[tag] || legacyState.allPlayersData[upperTag] || legacyState.allPlayersData[cleanTag];

            if (oldPlayer) {
                const cleanPlayer = migratePlayerState(oldPlayer);
                if (cleanPlayer) {
                    localStorage.setItem(`oreCalc_player_${cleanTag}`, JSON.stringify(cleanPlayer));
                    migratedPlayerTags.push(cleanTag);
                }
            }
        } catch (e) {
            console.error(`Error migrating player state for tag ${tag}:`, e);
        }
    }

    try {
        localStorage.setItem('oreCalc_playerTags', JSON.stringify(migratedPlayerTags));
    } catch (e) {
        console.error('Error writing player tags list:', e);
    }

    try {
        localStorage.removeItem('oreCalculatorState');
        localStorage.removeItem('OreCalculatorState');
    } catch (e) {
        console.error('Error removing legacy state keys:', e);
    }
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
        const savedTagsStr = localStorage.getItem(PLAYER_TAGS_KEY);
        const savedTagsList = safeJsonParse(savedTagsStr, []);
        const allowedTags = new Set();

        if (Array.isArray(savedTagsList)) {
            savedTagsList.forEach(t => {
                const clean = normalizePlayerTag(t);
                if (clean) allowedTags.add(clean);
            });
        }

        const recentSearchesStr = localStorage.getItem(RECENT_SEARCHES_KEY);
        const recentSearchesList = safeJsonParse(recentSearchesStr, []);
        if (Array.isArray(recentSearchesList)) {
            recentSearchesList.forEach(item => {
                const clean = item?.cleanTag || normalizePlayerTag(item?.tag);
                if (clean) allowedTags.add(clean);
            });
        }

        const isGuestAllowed = allowedTags.has('DEFAULT0') || allowedTags.size === 0;

        const allKeys = typeof localStorage.key === 'function'
            ? Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter(Boolean)
            : Object.keys(localStorage);

        for (const key of allKeys) {
            if (key && key.startsWith(PLAYER_PREFIX)) {
                const rawSuffix = key.slice(PLAYER_PREFIX.length);
                const cleanTag = normalizePlayerTag(rawSuffix);
                const canonicalKey = getPlayerStorageKey(cleanTag);

                const isAllowed = cleanTag && (
                    allowedTags.has(cleanTag) ||
                    (cleanTag === 'DEFAULT0' && isGuestAllowed)
                );

                if (!isAllowed) {
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
                            if (parsed && typeof parsed === 'object' && parsed.heroJourney && typeof parsed.heroJourney === 'object') {
                                parsed.heroJourney = {
                                    acceleratedRewards: Boolean(parsed.heroJourney.acceleratedRewards ?? parsed.heroJourney.accelerated ?? (parsed.heroJourney.rewardMode === 'accelerated')),
                                    revealBeyondTH: Boolean(parsed.heroJourney.revealBeyondTH),
                                    hidden: Boolean(parsed.heroJourney.hidden)
                                };
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
                    if (parsed && typeof parsed === 'object' && parsed.heroJourney && typeof parsed.heroJourney === 'object') {
                        parsed.heroJourney = {
                            acceleratedRewards: Boolean(parsed.heroJourney.acceleratedRewards ?? parsed.heroJourney.accelerated ?? (parsed.heroJourney.rewardMode === 'accelerated')),
                            revealBeyondTH: Boolean(parsed.heroJourney.revealBeyondTH),
                            hidden: Boolean(parsed.heroJourney.hidden)
                        };
                        localStorage.setItem(canonicalKey, JSON.stringify(parsed));
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error during orphaned player partitions cleanup:", error);
    }
    return deletedKeys;
}
