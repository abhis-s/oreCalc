import { heroData } from '../data/heroData.js';

import { compareVersions } from '../utils/versionUtils.js';

import { getDefaultEquipmentUnlockLevel, shouldApplyHeroJourneyAutoLevel, resolveHeroJourneyTrack } from '../domain/income/heroJourneyResolution.js';
import { getISOWeekNumber } from '../utils/dateUtils.js';

/** @type {import('./types.js').AppState | any} */
export let state = {};

export const EFFECTIVE_DATE_TERMS = 1780617600000; // June 5, 2026 (00:00 UTC)
export const EFFECTIVE_DATE_PRIVACY = 1786060800000; // August 7, 2026 (00:00 UTC)
export const EFFECTIVE_DATE_WELCOME = 1780617600000; // June 5, 2026 (00:00 UTC)
export const EFFECTIVE_DATE_PROFILE_ONBOARDING = 1780617600000; // June 5, 2026 (00:00 UTC)

export const DEFAULT_CUSTOM_CHIP_SETTINGS = Object.freeze({
    custom: Object.freeze({}),
    starBonus: Object.freeze({ monthly: false, count: 0, multiplier: '2x' }),
    shopOffers: Object.freeze({ monthly: false, shiny: 0, glowy: 0, starry: 0 }),
    gemTrader: Object.freeze({ weekly: false, shiny: 0, glowy: 0, starry: 0 }),
    raidMedalTrader: Object.freeze({ weekly: false, shiny: 0, glowy: 0, starry: 0 }),
    eventTrader: Object.freeze({ monthly: false, shiny: 0, glowy: 0, starry: 0 }),
    eventPass: Object.freeze({ monthly: false, shiny: 0, glowy: 0, starry: 0 }),
    clanWar: Object.freeze({ monthly: false, count: 0, shiny: 0, glowy: 0, starry: 0, result: 'win' }),
    cwl: Object.freeze({ monthly: false, count: 0, shiny: 0, glowy: 0, starry: 0, result: 'win' }),
    supercellEvents: Object.freeze({ globalOverride: false, shiny: 0, glowy: 0, starry: 0 }),
    prospector: Object.freeze({ monthly: false, count: 0, shiny: 0, glowy: 0, starry: 0 })
});

/**
 * Creates and returns a fresh top-level application root state object with schema defaults.
 * @returns {import('./types.js').AppState | any} Default global state object.
 */
export function getDefaultState() {
    return {
        appVersion: (typeof window !== 'undefined' ? window.__ENV__?.APP_VERSION : null) || '2.2.0',
        timestamp: new Date().toISOString(),
        activeTab: 'home-tab',
        savedPlayerTags: [],
        allPlayersData: {},
        playerProfile: null,

        uiSettings: {
            currency: {
                code: 'USD',
            },
            theme: 'dark',
            accentColor: 'random',
            language: 'auto',
            enableLevelInput: false,
            hideMaxedEquipment: false,
            hideLockedEquipment: false,
            hideProfileStats: false,
            cloudSync: true,
            uiTimestamps: {
                privacy: null,
                tos: null,
                welcome: null,
                tour: null
            },
            summaryTimeframe: 'monthly',
            cardLayout: 'cozy'
        },

        ...getDefaultPlayerStateProperties(),
        playerSpecificDefaults: initializeDefaultPlayerState(),

        derived: {
            requiredOres: {},
            incomeSources: {},
            totalIncome: {},
            remainingTime: { shiny: 'N/A', glowy: 'N/A', starry: 'N/A' },
        },
    };
}

function getDefaultHeroesState() {
    const heroes = {};
    for (const heroKey in heroData) {
        const hero = heroData[heroKey];
        const heroName = hero.name;
        heroes[heroName] = {
            enabled: true,
            equipment: {}
        };
        if (hero.equipment && Array.isArray(hero.equipment)) {
            hero.equipment.forEach(eq => {
                const defaultLevel = getDefaultEquipmentUnlockLevel(heroKey, eq.name);
                heroes[heroName].equipment[eq.name] = {
                    level: defaultLevel,
                    checked: true
                };
            });
        }
    }
    return heroes;
}

function getDefaultPlayerStateProperties() {
    const now = new Date();
    const [year, weekNo] = getISOWeekNumber(now);

    return {
        heroes: getDefaultHeroesState(),
        storedOres: { shiny: 0, glowy: 0, starry: 0 },
        onboardingTimestamp: null,
        income: {
            shopOffers: { enabled: false, selectedSet: null, purchases: {}, '0': {} },
            raidMedals: { enabled: false, earned: 1200, packs: { shiny: 0, glowy: 0, starry: 0 } },
            gems: { enabled: false, packs: { shiny: 0, glowy: 0, starry: 0 } },
            eventPass: {
                enabled: false,
                eventPass: false,
                includeEquipment: false,
                bonusTrackMedals: 0,
                purchasedMedals: 0,
                trader: { enabled: false, packs: { shiny: 0, glowy: 0, starry: 0 } }
            },
            eventTrader: { enabled: false, packs: { shiny: 0, glowy: 0, starry: 0 } },
            clanWar: {
                enabled: false,
                warsPerMonth: 8,
                winRate: 70,
                drawRate: 0,
                oresPerAttack: { shiny: 0, glowy: 0, starry: 0 },
                warPerformance: { thLevel: 16 }
            },
            cwl: {
                enabled: false,
                hitsPerSeason: 7,
                attacksPerEvent: 7,
                winRate: 50,
                drawRate: 0,
                oresPerAttack: { shiny: 0, glowy: 0, starry: 0 }
            },
            supercellEvents: { enabled: false, worldChampionship: false },
            prospector: {
                fromOre: 'shiny',
                toOre: 'glowy',
                assistedConversion: true
            },
            starBonus: {
                league: 105000000,
                "2x": {
                    frequency: 2,
                    duration: 0,
                    lastEvent: '2026-05'
                },
                thUpgrades: {}
            }
        },
        planner: {
            customMaxLevel: {},
            calendar: {
                isHydrated: false,
                settings: {
                    firstDayOfWeek: 'auto', // 'auto', 'monday', 'sunday'
                    showChipIcons: true,
                    autoPlaceScope: 'tillEnd', // 'month', 'tillEnd'
                    showEquipmentMilestones: true,
                    highlightUpgradeRanges: true
                },
                view: {
                    select: 'monthly',
                    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
                    week: `${year}-${String(weekNo).padStart(2, '0')}`,
                },
                dates: {},
                isDirty: true,
                customChips: [],
                customChipData: {},
                lastRecurringProcessed: '',
                customChipSettings: Object.fromEntries(
                    Object.entries(DEFAULT_CUSTOM_CHIP_SETTINGS).map(([k, v]) => [k, { ...v }])
                )
            },
        },
        heroJourney: {
            hidden: false,
            rewardMode: 'normal',
            acceleratedRewards: false,
            revealBeyondTH: false
        },
    };
}

function initializeDefaultPlayerState() {
    return {
        ...getDefaultPlayerStateProperties(),
        playerProfile: null,
        currency: {
            code: 'USD',
            globalPricing: {}
        },
    };
}

/**
 * Creates and returns a fresh player profile state object with initial hero equipment and income settings.
 * @returns {import('./types.js').PlayerData | any} Default player profile state object.
 */
export function getDefaultPlayerState() {
    return initializeDefaultPlayerState();
}

/**
 * Initializes and reconciles global application state with optional persisted storage data.
 * @param {import('./types.js').AppState | any} [savedState] - Deserialized persisted state object.
 */
export function initializeState(savedState) {
    const currentActiveTab = state.activeTab;
    const defaultState = getDefaultState();
    state = { ...defaultState };
    if (currentActiveTab) {
        state.activeTab = currentActiveTab;
    }

    if (savedState) {
        state.timestamp = savedState.timestamp || defaultState.timestamp;
        const savedVersion = savedState.appVersion || '1.0.0';
        const currentVersion = defaultState.appVersion;
        if (compareVersions(savedVersion, currentVersion) < 0 || savedVersion !== currentVersion) {
            state.appVersion = currentVersion;
        } else {
            state.appVersion = savedVersion;
        }

        if (savedState.savedPlayerTags) {
            const hasRealTags = savedState.savedPlayerTags.some(t => t && t !== 'DEFAULT0');
            if (hasRealTags) {
                state.savedPlayerTags = savedState.savedPlayerTags.filter(t => t && t !== 'DEFAULT0');
            } else {
                state.savedPlayerTags = savedState.savedPlayerTags.length > 0 ? savedState.savedPlayerTags : ['DEFAULT0'];
            }
        }

        if (state.savedPlayerTags.length === 0) {
            state.savedPlayerTags = [savedState.lastPlayerTag || 'DEFAULT0'];
        }

        const activePlayerTag = state.savedPlayerTags[0];
        const hasRealPlayer = state.savedPlayerTags.some(t => t !== 'DEFAULT0');

        if (savedState.allPlayersData) {
            for (const playerTag in savedState.allPlayersData) {
                if (playerTag === 'GUEST') continue;
                if (hasRealPlayer && playerTag === 'DEFAULT0') continue;
                let savedPlayerState = savedState.allPlayersData[playerTag];

                // Migrate legacy flat guest profile structure (DEFAULT0) to nested structure
                if (playerTag === 'DEFAULT0' && savedPlayerState && savedPlayerState.townHallLevel !== undefined && !savedPlayerState.playerProfile) {
                    savedPlayerState = {
                        playerProfile: {
                            name: savedPlayerState.name,
                            tag: savedPlayerState.tag || 'DEFAULT0',
                            townHallLevel: savedPlayerState.townHallLevel,
                            clanBadgeUrl: savedPlayerState.clanBadgeUrl || '',
                            clan: savedPlayerState.clan || null,
                            role: savedPlayerState.role || null,
                            leagueTier: savedPlayerState.leagueTier || null,
                            trophies: savedPlayerState.trophies || 0,
                            warStars: savedPlayerState.warStars || 0,
                            ownedHeroes: savedPlayerState.ownedHeroes || {},
                            ownedEquipment: savedPlayerState.ownedEquipment || {}
                        },
                        heroes: savedPlayerState.heroes || {},
                        storedOres: savedPlayerState.storedOres || {},
                        income: savedPlayerState.income || {},
                        planner: savedPlayerState.planner || {},
                        currency: savedPlayerState.currency
                    };
                }

                if (!state.allPlayersData[playerTag]) {
                    state.allPlayersData[playerTag] = initializeDefaultPlayerState();
                }
                const playerState = state.allPlayersData[playerTag];

                Object.assign(playerState.heroes, savedPlayerState.heroes || {});
                Object.assign(playerState.storedOres, savedPlayerState.storedOres || {});
                Object.assign(playerState.income, savedPlayerState.income || {});
                Object.assign(playerState.planner, savedPlayerState.planner || {});

                if (savedPlayerState.currency) {
                    if (typeof savedPlayerState.currency === 'string') {
                        playerState.currency = {
                            code: savedPlayerState.currency,
                            globalPricing: {}
                        };
                    } else {
                        playerState.currency = {
                            code: savedPlayerState.currency.code || 'USD',
                            globalPricing: savedPlayerState.currency.globalPricing || {}
                        };
                    }
                }

                playerState.playerProfile = savedPlayerState.playerProfile || playerState.playerProfile || null;
                playerState.heroJourney = savedPlayerState.heroJourney || playerState.heroJourney || { acceleratedRewards: false };
                playerState.onboardingTimestamp = typeof savedPlayerState.onboardingTimestamp === 'number'
                    ? savedPlayerState.onboardingTimestamp
                    : (savedPlayerState.onboardingTimestamp ?? null);
            }
        }

        state.uiSettings = { ...defaultState.uiSettings, ...(savedState.uiSettings || {}) };

        // Ensure currency is always an object, not a string (legacy/migration fix)
        if (typeof state.uiSettings.currency === 'string') {
            state.uiSettings.currency = { code: state.uiSettings.currency };
        }

        state.uiSettings.saveError = false;

        ensureStateDefaults(state);

        if (activePlayerTag && state.allPlayersData[activePlayerTag]) {
            const activePlayerState = state.allPlayersData[activePlayerTag];

            state.heroes = activePlayerState.heroes;
            state.storedOres = activePlayerState.storedOres;
            state.income = activePlayerState.income;
            state.planner = activePlayerState.planner;
            state.playerProfile = activePlayerState.playerProfile;
            state.onboardingTimestamp = activePlayerState.onboardingTimestamp ?? null;

            // Ensure player-specific currency is also an object and sync it to UI settings
            if (activePlayerState.currency) {
                if (typeof activePlayerState.currency === 'string') {
                    activePlayerState.currency = { code: activePlayerState.currency };
                }
                state.uiSettings.currency.code = activePlayerState.currency.code || 'USD';
            }
        }
    }
}

function ensureStateDefaults(s) {
    const now = new Date();
    const [year, weekNo] = getISOWeekNumber(now);
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const defaultWeek = `${year}-${String(weekNo).padStart(2, '0')}`;

    if (s.allPlayersData) {
        for (const tag in s.allPlayersData) {
            const ps = s.allPlayersData[tag];

            if (!ps.heroes || Object.keys(ps.heroes).length === 0) {
                ps.heroes = getDefaultHeroesState();
            } else {
                const trackResolution = resolveHeroJourneyTrack(ps);
                for (const heroKey in heroData) {
                    const hero = heroData[heroKey];
                    const heroName = hero.name;
                    if (!ps.heroes[heroName]) {
                        ps.heroes[heroName] = { enabled: true, equipment: {} };
                    }
                    if (!ps.heroes[heroName].equipment) {
                        ps.heroes[heroName].equipment = {};
                    }
                    if (hero.equipment && Array.isArray(hero.equipment)) {
                        hero.equipment.forEach(eq => {
                            const equipName = eq.name;
                            const defaultLevel = getDefaultEquipmentUnlockLevel(heroKey, equipName, ps, trackResolution);
                            if (!ps.heroes[heroName].equipment[equipName]) {
                                ps.heroes[heroName].equipment[equipName] = { level: defaultLevel, checked: true };
                            } else {
                                const eqState = ps.heroes[heroName].equipment[equipName];
                                if (shouldApplyHeroJourneyAutoLevel(heroName, equipName, ps, trackResolution) && eqState.level === 1 && defaultLevel > 1) {
                                    eqState.level = defaultLevel;
                                }
                            }
                        });
                    }
                }
            }

            if (!ps.storedOres) {
                ps.storedOres = { shiny: 0, glowy: 0, starry: 0 };
            } else {
                ps.storedOres.shiny = ps.storedOres.shiny || 0;
                ps.storedOres.glowy = ps.storedOres.glowy || 0;
                ps.storedOres.starry = ps.storedOres.starry || 0;
            }

            if (!ps.income) {
                ps.income = getDefaultPlayerStateProperties().income;
            } else {
                if (!ps.income.shopOffers) ps.income.shopOffers = { enabled: false, selectedSet: null, purchases: {}, '0': {} };
                if (!ps.income.shopOffers.purchases) ps.income.shopOffers.purchases = {};

                if (!ps.income.raidMedals) ps.income.raidMedals = { enabled: false, earned: 1200, packs: { shiny: 0, glowy: 0, starry: 0 } };
                if (!ps.income.raidMedals.packs) ps.income.raidMedals.packs = { shiny: 0, glowy: 0, starry: 0 };

                if (!ps.income.gems) ps.income.gems = { enabled: false, packs: { shiny: 0, glowy: 0, starry: 0 } };
                if (!ps.income.gems.packs) ps.income.gems.packs = { shiny: 0, glowy: 0, starry: 0 };

                if (!ps.income.eventPass) {
                    ps.income.eventPass = {
                        enabled: false,
                        eventPass: false,
                        includeEquipment: false,
                        bonusTrackMedals: 0,
                        purchasedMedals: 0,
                        trader: { enabled: false, packs: { shiny: 0, glowy: 0, starry: 0 } }
                    };
                } else {
                    const ep = ps.income.eventPass;
                    if (!ep.trader) {
                        ep.trader = { enabled: false, packs: { shiny: 0, glowy: 0, starry: 0 } };
                    } else if (!ep.trader.packs) {
                        ep.trader.packs = { shiny: 0, glowy: 0, starry: 0 };
                    }
                }

                if (!ps.income.eventTrader) ps.income.eventTrader = { enabled: false, packs: { shiny: 0, glowy: 0, starry: 0 } };
                if (!ps.income.eventTrader.packs) ps.income.eventTrader.packs = { shiny: 0, glowy: 0, starry: 0 };

                if (!ps.income.clanWar) {
                    ps.income.clanWar = {
                        enabled: false,
                        warsPerMonth: 8,
                        winRate: 70,
                        drawRate: 0,
                        oresPerAttack: { shiny: 0, glowy: 0, starry: 0 },
                        warPerformance: { thLevel: 16 }
                    };
                } else {
                    if (!ps.income.clanWar.oresPerAttack) ps.income.clanWar.oresPerAttack = { shiny: 0, glowy: 0, starry: 0 };
                }

                if (!ps.income.cwl) {
                    ps.income.cwl = {
                        enabled: false,
                        hitsPerSeason: 7,
                        attacksPerEvent: 7,
                        winRate: 50,
                        drawRate: 0,
                        oresPerAttack: { shiny: 0, glowy: 0, starry: 0 }
                    };
                } else {
                    if (!ps.income.cwl.oresPerAttack) ps.income.cwl.oresPerAttack = { shiny: 0, glowy: 0, starry: 0 };
                }

                if (!ps.income.supercellEvents) {
                    ps.income.supercellEvents = { enabled: false, worldChampionship: false };
                }

                if (!ps.income.starBonus) {
                    ps.income.starBonus = {
                        league: 105000000,
                        "2x": { frequency: 2, duration: 0, lastEvent: '2026-05' },
                        thUpgrades: {}
                    };
                }

                if (!ps.income.prospector) {
                    ps.income.prospector = {
                        fromOre: 'shiny',
                        toOre: 'glowy',
                        assistedConversion: true
                    };
                }
            }

            if (!ps.currency) {
                ps.currency = {
                    code: s.uiSettings?.currency?.code || 'USD',
                    globalPricing: {}
                };
            } else {
                if (typeof ps.currency === 'string') {
                    ps.currency = { code: ps.currency, globalPricing: {} };
                }
                if (!ps.currency.code) {
                    ps.currency.code = s.uiSettings?.currency?.code || 'USD';
                }
                if (!ps.currency.globalPricing) {
                    ps.currency.globalPricing = {};
                }
            }

            if (!ps.planner) ps.planner = {};
            if (!ps.planner.calendar) ps.planner.calendar = {};
            if (!ps.planner.calendar.settings) {
                ps.planner.calendar.settings = {
                    firstDayOfWeek: 'auto',
                    showChipIcons: true,
                    autoPlaceScope: 'tillEnd'
                };
            }
            if (!ps.planner.calendar.view) ps.planner.calendar.view = {};

            if (!ps.planner.calendar.view.month) {
                ps.planner.calendar.view.month = defaultMonth;
            } else {
                const parts = ps.planner.calendar.view.month.split('-');
                const y = Number(parts[0]);
                const m = Number(parts[1]);
                const currentMonthNow = now.getMonth() + 1;
                const currentYearNow = now.getFullYear();
                if (isNaN(m) || isNaN(y) || y < currentYearNow || (y === currentYearNow && m < currentMonthNow)) {
                    ps.planner.calendar.view.month = defaultMonth;
                }
            }

            if (!ps.planner.calendar.view.week) {
                ps.planner.calendar.view.week = defaultWeek;
            } else {
                const parts = ps.planner.calendar.view.week.split('-');
                const y = Number(parts[0]);
                const w = Number(parts[1]);
                if (isNaN(w) || isNaN(y) || y < year || (y === year && w < weekNo)) {
                    ps.planner.calendar.view.week = defaultWeek;
                }
            }
            if (!ps.planner.calendar.view.select) ps.planner.calendar.view.select = 'monthly';
            if (!ps.planner.calendar.dates) ps.planner.calendar.dates = {};
            if (!ps.planner.calendar.customChips) ps.planner.calendar.customChips = [];
            if (!ps.planner.calendar.customChipData) ps.planner.calendar.customChipData = {};
            ps.planner.calendar.isHydrated = false;
            if (ps.planner.calendar.isDirty === undefined) {
                ps.planner.calendar.isDirty = true;
            }
            if (!ps.planner.calendar.customChipSettings) {
                ps.planner.calendar.customChipSettings = Object.fromEntries(
                    Object.entries(DEFAULT_CUSTOM_CHIP_SETTINGS).map(([k, v]) => [k, { ...v }])
                );
            } else {
                for (const key in DEFAULT_CUSTOM_CHIP_SETTINGS) {
                    if (!ps.planner.calendar.customChipSettings[key]) {
                        ps.planner.calendar.customChipSettings[key] = { ...DEFAULT_CUSTOM_CHIP_SETTINGS[key] };
                    }
                }
            }

            if (!ps.heroJourney) {
                ps.heroJourney = {
                    hidden: false,
                    acceleratedRewards: false,
                    revealBeyondTH: false
                };
            } else {
                if (ps.heroJourney.hidden === undefined) {
                    ps.heroJourney.hidden = false;
                }
                if (ps.heroJourney.acceleratedRewards === undefined) {
                    ps.heroJourney.acceleratedRewards = false;
                }
                if (ps.heroJourney.revealBeyondTH === undefined) {
                    ps.heroJourney.revealBeyondTH = false;
                }
            }

            if (ps.onboardingTimestamp === undefined) {
                ps.onboardingTimestamp = null;
            }
        }
    }
}

/**
 * Evaluates whether a player's profile has completed the onboarding setup wizard.
 *
 * @param {Record<string, any> | null | undefined} playerData - Target player data object.
 * @returns {boolean} Whether the profile is onboarded.
 */
export function isProfileOnboarded(playerData) {
    if (!playerData || typeof playerData.onboardingTimestamp !== 'number') {
        return false;
    }
    return playerData.onboardingTimestamp >= EFFECTIVE_DATE_PROFILE_ONBOARDING;
}
