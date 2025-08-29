import { currencySymbols, heroData, shopOfferData, eventPassData } from '../data/appData.js';

export let state = {};

export function getWeekNumber(d) {
    // Copy date so don't modify original
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    // Set to nearest Thursday: current date + 4 - current day number
    // Monday is 1
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    // Get first day of year
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    // Calculate full weeks to nearest Thursday
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    // Return array of year and week number
    return [d.getUTCFullYear(), weekNo];
}

export function getDefaultState() {
    const now = new Date();
    const [year, weekNo] = getWeekNumber(now);

    return {
        lastPlayerTag: '',
        savedPlayerTags: [],
        allPlayersData: {}, 
        playerData: null,

        uiSettings: {
            mode: 'ease',
            currency: 'USD',
            regionalPricingEnabled: false,
            language: 'en',
            incomeTimeframe: 'monthly',
            incomeCardExpanded: false,
            activeTab: 'home-tab',
        },

        heroes: initializeHeroesState(),
        storedOres: { shiny: 0, glowy: 0, starry: 0 },
        income: {
            starBonusLeague: 'Unranked',
            shopOffers: { selectedSet: 'none', sets: { TH16_Set: {}, TH15_Set: {} } },
            raidMedals: { earned: 0, packs: { shiny: 0, glowy: 0, starry: 0 } },
            gems: { packs: { shiny: 0, glowy: 0, starry: 0 } },
            eventPass: { type: 'free', storeMedals: false, equipmentBought: false },
            eventTrader: { packs: { shiny: 0, glowy: 0, starry: 0 } },
            clanWar: { warsPerMonth: 0, winRate: 50, drawRate: 0, oresPerAttack: { shiny: 0, glowy: 0, starry: 0 } },
            cwl: { hitsPerSeason: 0, winRate: 50, drawRate: 0, oresPerAttack: { shiny: 0, glowy: 0, starry: 0 } },
        },
        planner: {
            customMaxLevel: {
                common: 18,
                epic: 27,
            },
            calendar: {
                view: {
                    select: 'monthly',
                    month: `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`,
                    week: `${weekNo}-${year}`,
                },
                dates: {} // "MM-YYYY": { "DD": ["chipId1", "chipId2"] }
            },
        },
        playerSpecificDefaults: {
            heroes: initializeHeroesState(),
            storedOres: { shiny: 0, glowy: 0, starry: 0 },
            income: {
                starBonusLeague: 'Unranked',
                shopOffers: { selectedSet: 'none', sets: { TH16_Set: {}, TH15_Set: {} } },
                raidMedals: { earned: 0, packs: { shiny: 0, glowy: 0, starry: 0 } },
                gems: { packs: { shiny: 0, glowy: 0, starry: 0 } },
                eventPass: { type: 'free', storeMedals: false, equipmentBought: false },
                eventTrader: { packs: { shiny: 0, glowy: 0, starry: 0 } },
                clanWar: { warsPerMonth: 0, winRate: 50, drawRate: 0, oresPerAttack: { shiny: 0, glowy: 0, starry: 0 } },
                cwl: { hitsPerSeason: 0, winRate: 50, drawRate: 0, oresPerAttack: { shiny: 0, glowy: 0, starry: 0 } },
            },
            playerData: null,
            planner: {
                customMaxLevel: {
                    common: 18,
                    epic: 27,
                },
            },
            regionalPricingEnabled: false,
        },

        derived: {
            requiredOres: { shiny: 0, glowy: 0, starry: 0 },
            incomeSources: {}, 
            totalIncome: { shiny: 0, glowy: 0, starry: 0 },
            remainingTime: { shiny: 'N/A', glowy: 'N/A', starry: 'N/A' },
        }
    };
}

function initializeHeroesState() {
    const heroes = {};
    for (const heroKey in heroData) {
        const hero = heroData[heroKey];
        heroes[hero.name] = {
            enabled: true,
            equipment: hero.equipment.reduce((acc, equip) => {
                acc[equip.name] = { level: 1, checked: true };
                return acc;
            }, {})
        };
    }
    return heroes;
}

export function getDefaultPlayerState() {
    const now = new Date();
    const [year, weekNo] = getWeekNumber(now);

    return JSON.parse(JSON.stringify({
        heroes: initializeHeroesState(),
        storedOres: { shiny: 0, glowy: 0, starry: 0 },
        income: {
            starBonusLeague: 'Unranked',
            shopOffers: { selectedSet: 'none', sets: { TH16_Set: {}, TH15_Set: {} } },
            raidMedals: { earned: 0, packs: { shiny: 0, glowy: 0, starry: 0 } },
            gems: { packs: { shiny: 0, glowy: 0, starry: 0 } },
            eventPass: { type: 'free', storeMedals: false, equipmentBought: false },
            eventTrader: { packs: { shiny: 0, glowy: 0, starry: 0 } },
            clanWar: { warsPerMonth: 0, winRate: 50, drawRate: 0, oresPerAttack: { shiny: 0, glowy: 0, starry: 0 } },
            cwl: { hitsPerSeason: 0, winRate: 50, drawRate: 0, oresPerAttack: { shiny: 0, glowy: 0, starry: 0 } },
        },
        planner: {
            customMaxLevel: {
                common: 18,
                epic: 27,
            },
            calendar: {
                view: {
                    select: 'monthly',
                    month: `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`,
                    week: `${weekNo}-${year}`,
                },
                dates: {} // "MM-YYYY": { "DD": ["chipId1", "chipId2"] }
            },
        },
        playerData: null,
        regionalPricingEnabled: false,
    }));
}

export function initializeState(savedState) {
    const defaultState = getDefaultState();
    
    state = { ...defaultState };
    state.uiSettings.currencySymbol = currencySymbols[state.uiSettings.currency]?.symbol || '';

    if (savedState) {
        state.appVersion = savedState.appVersion || defaultState.appVersion;

        if (savedState.savedPlayerTags) {
            state.savedPlayerTags = savedState.savedPlayerTags;
        }

        // Ensure lastPlayerTag is set to DEFAULT0 if it's empty
        if (!state.lastPlayerTag) {
            state.lastPlayerTag = 'DEFAULT0';
        }

        if (savedState.allPlayersData) {
            for (const playerTag in savedState.allPlayersData) {
                if (state.allPlayersData[playerTag]) {
                    Object.assign(state.allPlayersData[playerTag].heroes, savedState.allPlayersData[playerTag].heroes);
                    Object.assign(state.allPlayersData[playerTag].storedOres, savedState.allPlayersData[playerTag].storedOres);
                    Object.assign(state.allPlayersData[playerTag].income, savedState.allPlayersData[playerTag].income);
                    Object.assign(state.allPlayersData[playerTag].planner, savedState.allPlayersData[playerTag].planner);
                    Object.assign(state.allPlayersData[playerTag].playerData, savedState.allPlayersData[playerTag].playerData);
                    if (savedState.allPlayersData[playerTag].regionalPricingEnabled !== undefined) {
                        state.allPlayersData[playerTag].regionalPricingEnabled = savedState.allPlayersData[playerTag].regionalPricingEnabled;
                    }
                    for (const heroKey in heroData) {
                        const heroName = heroData[heroKey].name;
                        if (state.allPlayersData[playerTag].heroes[heroName]) {
                            for (const equip of heroData[heroKey].equipment) {
                                if (!state.allPlayersData[playerTag].heroes[heroName].equipment[equip.name]) {
                                    state.allPlayersData[playerTag].heroes[heroName].equipment[equip.name] = { level: 1, checked: true };
                                }
                            }
                        }
                    }
                } else {
                    state.allPlayersData[playerTag] = savedState.allPlayersData[playerTag];
                    for (const heroKey in heroData) {
                        const heroName = heroData[heroKey].name;
                        if (state.allPlayersData[playerTag].heroes[heroName]) {
                            for (const equip of heroData[heroKey].equipment) {
                                if (!state.allPlayersData[playerTag].heroes[heroName].equipment[equip.name]) {
                                    state.allPlayersData[playerTag].heroes[heroName].equipment[equip.name] = { level: 1, checked: true };
                                }
                            }
                        }
                    }
                }
            }
        }

        for (const key in savedState) {
            if (key === 'derived' || key === 'heroes' || key === 'storedOres' || key === 'income' || key === 'playerData' || key === 'allPlayersData' || key === 'planner' || key === 'uiSettings') {
                continue;
            }
            Object.assign(state, { [key]: savedState[key] });
        }

        if (state.activeTab === undefined) {
            state.activeTab = 'home-tab';
        }

        if (state.lastPlayerTag && state.allPlayersData[state.lastPlayerTag]) {
            const activePlayerData = state.allPlayersData[state.lastPlayerTag];
            Object.assign(state.heroes, activePlayerData.heroes);
            for (const heroKey in heroData) {
                const heroName = heroData[heroKey].name;
                if (state.heroes[heroName]) {
                    for (const equip of heroData[heroKey].equipment) {
                        if (!state.heroes[heroName].equipment[equip.name]) {
                            state.heroes[heroName].equipment[equip.name] = { level: 1, checked: true };
                        }
                    }
                }
            }

            Object.assign(state.storedOres, activePlayerData.storedOres);
            Object.assign(state.income, getDefaultState().income, activePlayerData.income);
            Object.assign(state.planner, getDefaultState().planner, activePlayerData.planner);
            // Ensure state.planner.calendar.view.month is always a valid string
            if (!state.planner.calendar.view.month || typeof state.planner.calendar.view.month !== 'string' || !state.planner.calendar.view.month.includes('-')) {
                state.planner.calendar.view.month = `${String(new Date().getMonth() + 1).padStart(2, '0')}-${new Date().getFullYear()}`;
            }

            // Ensure dates object exists in planner.calendar
            if (!state.planner.calendar.dates) {
                state.planner.calendar.dates = {};
            }
            
            if (!shopOfferData[state.income.shopOffers.selectedSet]) {
                state.income.shopOffers.selectedSet = 'none';
            }
            if (!eventPassData[state.income.eventPass.type]) {
                state.income.eventPass.type = 'free';
            }
            state.playerData = activePlayerData.playerData;
            state.uiSettings.regionalPricingEnabled = activePlayerData.regionalPricingEnabled;
        }
    }
}