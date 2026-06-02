import { currencyData, heroData, shopOfferData, eventPassData, leagueTiers } from '../data/appData.js';
import { purgeLegacyStateData, normalizeEquipmentState, migrateFullState, migratePlayerState } from './stateCleanup.js';
import { getISOWeekNumber } from '../utils/dateUtils.js';

export let state = {};

export function getDefaultState() {
    return {
        appVersion: '2.0.0',
        activeTab: 'home-tab',
        savedPlayerTags: [],
        allPlayersData: {},
        playerProfile: null,

        uiSettings: {
            currency: {
                code: 'USD',
            },
            theme: 'dark',
            accentColor: 'blue',
            language: 'auto',
            enableLevelInput: false,
            hideMaxedEquipment: false,
            hideLockedEquipment: false,
            cloudSync: true,
            incomeCard: {
                timeframe: 'monthly',
                expanded: true
            }
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
            shopOffers: { selectedSet: 0, '0': {} },
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
            },
            starBonus: {
                eventFrequency: 2,
                eventDuration: 5,
                thUpgrades: {}
            }
        },
        planner: {
            customMaxLevel: {},
            calendar: {
                settings: {
                    firstDayOfWeek: 'auto', // 'auto', 'monday', 'sunday'
                    showChipIcons: true,
                    autoPlaceScope: 'month' // 'month', 'year'
                },
                view: {
                    select: 'monthly',
                    month: `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`,
                    week: `${weekNo}-${year}`,
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
    const defaultState = getDefaultState();
    state = { ...defaultState };

    if (savedState) {
        state.appVersion = savedState.appVersion || defaultState.appVersion;

        if (savedState.savedPlayerTags) {
            state.savedPlayerTags = savedState.savedPlayerTags;
        }

        if (state.savedPlayerTags.length === 0) {
            state.savedPlayerTags = [savedState.lastPlayerTag || 'DEFAULT0'];
        }

        const activePlayerTag = state.savedPlayerTags[0];

        if (savedState.allPlayersData) {
            for (const playerTag in savedState.allPlayersData) {
                const savedPlayerState = savedState.allPlayersData[playerTag];
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

                migratePlayerState(playerState);
            }
        }

        // Copy top-level properties
        const preservedKeys = ['derived', 'heroes', 'storedOres', 'income', 'playerData', 'playerProfile', 'allPlayersData', 'planner', 'lastPlayerTag', 'savedPlayerTags', 'uiSettings'];
        for (const key in savedState) {
            if (!preservedKeys.includes(key)) {
                state[key] = savedState[key];
            }
        }

        state.uiSettings = { ...defaultState.uiSettings, ...(savedState.uiSettings || {}) };
        
        // Ensure currency is always an object, not a string (legacy/migration fix)
        if (typeof state.uiSettings.currency === 'string') {
            state.uiSettings.currency = { code: state.uiSettings.currency };
        }
        
        state.uiSettings.saveError = false;

        migrateFullState(state);
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
    const defaultMonth = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    const defaultWeek = `${weekNo}-${year}`;

    if (s.allPlayersData) {
        for (const tag in s.allPlayersData) {
            const ps = s.allPlayersData[tag];
            
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
                    autoPlaceScope: 'month'
                };
            }
            if (!ps.planner.calendar.view) ps.planner.calendar.view = {};
            
            if (!ps.planner.calendar.view.month) {
                ps.planner.calendar.view.month = defaultMonth;
            } else {
                const parts = ps.planner.calendar.view.month.split('-');
                const m = parseInt(parts[0], 10);
                const y = parseInt(parts[1], 10);
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
                const w = parseInt(parts[0], 10);
                const y = parseInt(parts[1], 10);
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
