import { currencyData, heroData, shopOfferData, eventPassData, leagueTiers } from '../data/appData.js';
import { getISOWeekNumber } from '../utils/dateUtils.js';

import { purgeLegacyStateData, normalizeEquipmentState, migrateFullState, migratePlayerState, compareVersions } from './stateCleanup.js';

export let state = {};

export const EFFECTIVE_DATE_TERMS = 1780617600000; // June 5, 2026 (00:00 UTC)
export const EFFECTIVE_DATE_PRIVACY = 1780617600000; // June 5, 2026 (00:00 UTC)
export const EFFECTIVE_DATE_WELCOME = 1780617600000; // June 5, 2026 (00:00 UTC)

export function getDefaultState() {
    return {
        appVersion: window.__ENV__?.APP_VERSION || '2.0.0',
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
            cloudSync: true,
            timestamp: {
                privacy: null,
                tos: null,
                welcome: null
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

function getDefaultPlayerStateProperties() {
    const now = new Date();
    const [year, weekNo] = getISOWeekNumber(now);

    return {
        heroes: {},
        storedOres: {},
        income: {
            shopOffers: { selectedSet: null, '0': {} },
            raidMedals: { packs: {} },
            gems: { packs: {} },
            eventPass: {},
            eventTrader: { packs: {} },
            clanWar: {
                oresPerAttack: {},
            },
            cwl: {
                oresPerAttack: {},
            },
            supercellEvents: {},
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
                customChips: [], // Chips waiting to be placed
                customChipData: {}, // Data for chips already on the calendar
                lastRecurringProcessed: '', // Last month-year recurring chips were generated
                customChipSettings: {
                    custom: {},
                    starBonus: { monthly: false, count: 0, multiplier: '2x' },
                    shopOffers: { monthly: false, shiny: 0, glowy: 0, starry: 0 },
                    gemTrader: { weekly: false, shiny: 0, glowy: 0, starry: 0 },
                    raidMedalTrader: { weekly: false, shiny: 0, glowy: 0, starry: 0 },
                    eventTrader: { monthly: false, shiny: 0, glowy: 0, starry: 0 },
                    eventPass: { monthly: false, shiny: 0, glowy: 0, starry: 0 },
                    clanWar: { monthly: false, count: 0, shiny: 0, glowy: 0, starry: 0, result: 'win' },
                    cwl: { monthly: false, count: 0, shiny: 0, glowy: 0, starry: 0, result: 'win' },
                    supercellEvents: { globalOverride: false, shiny: 0, glowy: 0, starry: 0 },
                    prospector: { monthly: false, count: 0, shiny: 0, glowy: 0, starry: 0 }
                }
            },
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

export function getDefaultPlayerState() {
    return initializeDefaultPlayerState();
}

export function initializeState(savedState) {
    const currentActiveTab = state.activeTab;
    const defaultState = getDefaultState();
    state = { ...defaultState };
    if (currentActiveTab) {
        state.activeTab = currentActiveTab;
    }

    if (savedState) {
        const savedVersion = savedState.appVersion || '1.0.0';
        const currentVersion = defaultState.appVersion;
        if (compareVersions(savedVersion, currentVersion) < 0 || savedVersion !== currentVersion) {
            state.appVersion = currentVersion;
        } else {
            state.appVersion = savedVersion;
        }

        if (savedState.savedPlayerTags) {
            state.savedPlayerTags = savedState.savedPlayerTags;
        }

        if (state.savedPlayerTags.length === 0) {
            state.savedPlayerTags = [savedState.lastPlayerTag || 'DEFAULT0'];
        }

        const activePlayerTag = state.savedPlayerTags[0];

        if (savedState.allPlayersData) {
            for (const playerTag in savedState.allPlayersData) {
                if (playerTag === 'GUEST') continue;
                let savedPlayerState = savedState.allPlayersData[playerTag];
                
                // Migrate legacy flat guest profile structure (DEFAULT0) to nested structure
                if (playerTag === 'DEFAULT0' && savedPlayerState && savedPlayerState.townHallLevel !== undefined && !savedPlayerState.playerProfile) {
                    savedPlayerState = {
                        playerProfile: {
                            name: savedPlayerState.name,
                            tag: savedPlayerState.tag,
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
                        currency: savedPlayerState.currency,
                        onboardingComplete: savedPlayerState.onboardingComplete
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

                playerState.playerProfile = savedPlayerState.playerProfile || null;

                // Preserve onboarding/metadata flags from saved state
                if (savedPlayerState.onboardingComplete !== undefined) {
                    playerState.onboardingComplete = savedPlayerState.onboardingComplete;
                }
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
            
            if (ps.income && ps.income.eventPass) {
                const ep = ps.income.eventPass;
                delete ep.claimableMedals;
                delete ep.passMedals;
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
                const y = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10);
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
                const y = parseInt(parts[0], 10);
                const w = parseInt(parts[1], 10);
                if (isNaN(w) || isNaN(y) || y < year || (y === year && w < weekNo)) {
                    ps.planner.calendar.view.week = defaultWeek;
                }
            }
            if (!ps.planner.calendar.view.select) ps.planner.calendar.view.select = 'monthly';
            if (!ps.planner.calendar.dates) ps.planner.calendar.dates = {};
            if (!ps.planner.calendar.customChips) ps.planner.calendar.customChips = [];
            if (!ps.planner.calendar.customChipData) ps.planner.calendar.customChipData = {};
            if (ps.planner.calendar.isDirty === undefined) {
                ps.planner.calendar.isDirty = true;
            }
            if (!ps.planner.calendar.customChipSettings) {
                ps.planner.calendar.customChipSettings = {
                    custom: {},
                    starBonus: { monthly: false, count: 0, multiplier: '2x' },
                    shopOffers: { monthly: false, shiny: 0, glowy: 0, starry: 0 },
                    gemTrader: { weekly: false, shiny: 0, glowy: 0, starry: 0 },
                    raidMedalTrader: { weekly: false, shiny: 0, glowy: 0, starry: 0 },
                    eventTrader: { monthly: false, shiny: 0, glowy: 0, starry: 0 },
                    eventPass: { monthly: false, shiny: 0, glowy: 0, starry: 0 },
                    clanWar: { monthly: false, count: 0, shiny: 0, glowy: 0, starry: 0, result: 'win' },
                    cwl: { monthly: false, count: 0, shiny: 0, glowy: 0, starry: 0, result: 'win' },
                    supercellEvents: { globalOverride: false, shiny: 0, glowy: 0, starry: 0 },
                    prospector: { monthly: false, count: 0, shiny: 0, glowy: 0, starry: 0 }
                };
            } else {
                const defaultSettings = {
                    custom: {},
                    starBonus: { monthly: false, count: 0, multiplier: '2x' },
                    shopOffers: { monthly: false, shiny: 0, glowy: 0, starry: 0 },
                    gemTrader: { weekly: false, shiny: 0, glowy: 0, starry: 0 },
                    raidMedalTrader: { weekly: false, shiny: 0, glowy: 0, starry: 0 },
                    eventTrader: { monthly: false, shiny: 0, glowy: 0, starry: 0 },
                    eventPass: { monthly: false, shiny: 0, glowy: 0, starry: 0 },
                    clanWar: { monthly: false, count: 0, shiny: 0, glowy: 0, starry: 0, result: 'win' },
                    cwl: { monthly: false, count: 0, shiny: 0, glowy: 0, starry: 0, result: 'win' },
                    supercellEvents: { globalOverride: false, shiny: 0, glowy: 0, starry: 0 },
                    prospector: { monthly: false, count: 0, shiny: 0, glowy: 0, starry: 0 }
                };
                for (const key in defaultSettings) {
                    if (!ps.planner.calendar.customChipSettings[key]) {
                        ps.planner.calendar.customChipSettings[key] = { ...defaultSettings[key] };
                    }
                }
            }
        }
    }
}
