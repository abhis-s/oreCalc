import { currencySymbols, heroData, shopOfferData, eventPassData } from '../data/appData.js';

export let state = {};

export function getDefaultState() {
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
            shopOffers: { selectedSet: 'none', sets: { set_A: {}, set_B: {} } },
            raidMedals: { earned: 0, packs: { shiny: 0, glowy: 0, starry: 0 } },
            gems: { packs: { shiny: 0, glowy: 0, starry: 0 } },
            eventPass: { type: 'free', equipmentBought: false },
            eventTrader: { packs: { shiny: 0, glowy: 0, starry: 0 } },
            clanWar: { warsPerMonth: 0, winRate: 50, drawRate: 0, oresPerAttack: { shiny: 0, glowy: 0, starry: 0 } },
            cwl: { hitsPerSeason: 0, winRate: 50, drawRate: 0, oresPerAttack: { shiny: 0, glowy: 0, starry: 0 } },
        },
        

        playerSpecificDefaults: {
            heroes: initializeHeroesState(),
            storedOres: { shiny: 0, glowy: 0, starry: 0 },
            income: {
                starBonusLeague: 'Unranked',
                shopOffers: { selectedSet: 'none', sets: { set_A: {}, set_B: {} } },
                raidMedals: { earned: 0, packs: { shiny: 0, glowy: 0, starry: 0 } },
                gems: { packs: { shiny: 0, glowy: 0, starry: 0 } },
                eventPass: { type: 'free', equipmentBought: false },
                eventTrader: { packs: { shiny: 0, glowy: 0, starry: 0 } },
                clanWar: { warsPerMonth: 0, winRate: 50, drawRate: 0, oresPerAttack: { shiny: 0, glowy: 0, starry: 0 } },
                cwl: { hitsPerSeason: 0, winRate: 50, drawRate: 0, oresPerAttack: { shiny: 0, glowy: 0, starry: 0 } },
            },
            playerData: null,
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
    return JSON.parse(JSON.stringify({
        heroes: initializeHeroesState(),
        storedOres: { shiny: 0, glowy: 0, starry: 0 },
        income: {
            starBonusLeague: 'Unranked',
            shopOffers: { selectedSet: 'none', sets: { set_A: {}, set_B: {} } },
            raidMedals: { earned: 0, packs: { shiny: 0, glowy: 0, starry: 0 } },
            gems: { packs: { shiny: 0, glowy: 0, starry: 0 } },
            eventPass: { type: 'free', equipmentBought: false },
            eventTrader: { packs: { shiny: 0, glowy: 0, starry: 0 } },
            clanWar: { warsPerMonth: 0, winRate: 50, drawRate: 0, oresPerAttack: { shiny: 0, glowy: 0, starry: 0 } },
            cwl: { hitsPerSeason: 0, winRate: 50, drawRate: 0, oresPerAttack: { shiny: 0, glowy: 0, starry: 0 } },
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

        if (savedState.allPlayersData) {
            for (const playerTag in savedState.allPlayersData) {
                if (state.allPlayersData[playerTag]) {
                    Object.assign(state.allPlayersData[playerTag].heroes, savedState.allPlayersData[playerTag].heroes);
                    Object.assign(state.allPlayersData[playerTag].storedOres, savedState.allPlayersData[playerTag].storedOres);
                    Object.assign(state.allPlayersData[playerTag].income, savedState.allPlayersData[playerTag].income);
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
            if (key === 'derived' || key === 'heroes' || key === 'storedOres' || key === 'income' || key === 'playerData' || key === 'allPlayersData' || key === 'appVersion') {
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
            Object.assign(state.income, activePlayerData.income);
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