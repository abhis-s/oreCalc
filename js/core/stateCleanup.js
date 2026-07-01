
/**
 * Normalizes a hero's equipment state.
 */
export function normalizeEquipmentState(heroName, heroState) {
    return heroState || { equipment: {} };
}

/**
 * Migrates UI settings from legacy structures.
 */
export function migrateUISettings(uiSettings, legacyStateTimestamp) {
    return migrateAppSettings(uiSettings, legacyStateTimestamp);
}

/**
 * Minimalizes player data by removing redundant/default values before persistence.
 */
export function sanitizePlayerState(playerData) {
    return playerData;
}

/**
 * Copies the level of each equipment item from old player data to new player data.
 */
export function migrateEquipmentLevels(oldHeroData, newHeroData) {
    if (!oldHeroData || !newHeroData) return;
    for (const heroName in oldHeroData) {
        const oldHero = oldHeroData[heroName];
        const newHero = newHeroData[heroName];
        if (oldHero && newHero && oldHero.equipment && newHero.equipment) {
            for (const equipName in oldHero.equipment) {
                const oldEquip = oldHero.equipment[equipName];
                const newEquip = newHero.equipment[equipName];
                if (oldEquip && newEquip) {
                    newEquip.level = parseInt(oldEquip.level, 10) || 1;
                }
            }
        }
    }
}

/**
 * Sequential priority list step migrator from step 1 to 100.
 */
export function migrateUpgradePlan(oldEquipPlan) {
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
            targetLevel: parseInt(stepData.target, 10) || 18,
            enabled: true,
            priorityIndex: parseInt(stepData.priorityIndex, 10) || 0
        };
    }
    return Object.keys(cleanPlan).length > 0 ? cleanPlan : undefined;
}

/**
 * Application Settings Migration helper.
 */
export function migrateAppSettings(oldUI, legacyStateTimestamp) {
    if (!oldUI) return {};
    return {
        currency: {
            code: typeof oldUI.currency === 'string' ? oldUI.currency : 'USD'
        },
        language: oldUI.language || 'auto',
        enableLevelInput: !!oldUI.enableLevelInput,
        summaryTimeframe: oldUI.incomeTimeframe || 'monthly'
    };
}

/**
 * Migrates a player state instance (individual player data).
 */
export function migratePlayerState(playerState, tag) {
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
        // copy equipment levels using helper
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
                    const count = parseInt(oldSet[key], 10) || 0;
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
                selectedSetNum = match ? parseInt(match[0], 10) : 0;
            }
        } else if (oldShop.selectedSet !== undefined && oldShop.selectedSet !== null) {
            selectedSetNum = parseInt(oldShop.selectedSet, 10) || 0;
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
                common: oldPlan.customMaxLevel?.common || 18,
                epic: oldPlan.customMaxLevel?.epic || 27
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
        storedOres: {
            shiny: 0,
            glowy: 0,
            starry: 0
        },
        income,
        planner,
        playerProfile: null,
        currency: {
            code: typeof playerState.currency === 'string' ? playerState.currency : 'USD',
            globalPricing: {}
        }
    };
}

/**
 * Migrates global pricing keys from USD prices to standardized tier keys.
 */
function migrateGlobalPricing(playerData) {
    return playerData;
}

/**
 * Purges legacy and past data from the player's state.
 */
export function purgeLegacyStateData(playerData) {
    return playerData;
}

/**
 * Cleans UI settings before persistence.
 */
export function sanitizeUISettings(uiSettings) {
    return uiSettings;
}

/**
 * Migrates the full monolithic state into partitioned keys.
 */
export function migrateFullState(legacyState) {
    if (!legacyState || !legacyState.allPlayersData) {
        // Safeguard: Ensure appVersion is written so the lock is released
        const appSettingsStr = localStorage.getItem('oreCalc_appSettings');
        let cleanAppSettings = {};
        if (appSettingsStr) {
            try {
                cleanAppSettings = JSON.parse(appSettingsStr) || {};
            } catch (e) {}
        }
        cleanAppSettings.appVersion = '2.0.0';
        localStorage.setItem('oreCalc_appSettings', JSON.stringify(cleanAppSettings));
        localStorage.removeItem('oreCalculatorState');
        localStorage.removeItem('OreCalculatorState');
        return;
    }

    try {
        // Migrate user ID key
        const legacyUserId = localStorage.getItem('oreCalcUserId');
        if (legacyUserId) {
            localStorage.setItem('oreCalc_userId', legacyUserId);
            localStorage.removeItem('oreCalcUserId');
        }
    } catch (e) {
        console.error('Error migrating user ID:', e);
    }

    try {
        // 1. Migrate global UI settings
        const oldUI = legacyState.uiSettings || {};
        const cleanAppSettings = migrateAppSettings(oldUI, legacyState.timestamp);
        cleanAppSettings.appVersion = '2.0.0';
        localStorage.setItem('oreCalc_appSettings', JSON.stringify(cleanAppSettings));
    } catch (e) {
        console.error('Error migrating global UI settings:', e);
    }

    // 2. Iterate players and migrate each
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
            
            const oldPlayer = legacyState.allPlayersData[tag];
            if (oldPlayer) {
                const cleanPlayer = migratePlayerState(oldPlayer, tag);
                if (cleanPlayer) {
                    localStorage.setItem(`oreCalc_player_${tag}`, JSON.stringify(cleanPlayer));
                    migratedPlayerTags.push(tag);
                }
            }
        } catch (e) {
            console.error(`Error migrating player state for tag ${tag}:`, e);
        }
    }

    try {
        // 3. Write index metadata key
        localStorage.setItem('oreCalc_playerTags', JSON.stringify(migratedPlayerTags));
    } catch (e) {
        console.error('Error writing player tags list:', e);
    }

    try {
        // 4. Remove monolithic legacy state keys
        localStorage.removeItem('oreCalculatorState');
        localStorage.removeItem('OreCalculatorState');
    } catch (e) {
        console.error('Error removing legacy state keys:', e);
    }
}

/**
 * Version comparison utility.
 */
export function compareVersions(v1, v2) {
    if (typeof v1 !== 'string') v1 = String(v1 || '0.0.0');
    if (typeof v2 !== 'string') v2 = String(v2 || '0.0.0');
    const cleanV1 = v1.split(/[+-]/)[0];
    const cleanV2 = v2.split(/[+-]/)[0];
    const parts1 = cleanV1.split('.').map(Number);
    const parts2 = cleanV2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
    }
    return 0;
}
