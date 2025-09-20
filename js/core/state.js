import { currencySymbols, heroData, shopOfferData, eventPassData } from '../data/appData.js';

export let state = {};

export function getISOWeekNumber(d) {
    const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);

    const isoYear = date.getUTCFullYear();

    const yearStart = new Date(Date.UTC(isoYear, 0, 1));
    const yearStartDay = yearStart.getUTCDay() || 7;
    yearStart.setUTCDate(yearStart.getUTCDate() + 4 - yearStartDay);

    const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);

    return [isoYear, weekNo];
}

export function getDefaultState() {
    const now = new Date();
    const [year, weekNo] = getISOWeekNumber(now);

    return {
        lastPlayerTag: '',
        savedPlayerTags: [],
        allPlayersData: {},
        playerData: null,

        uiSettings: {
            currency: 'USD',
            regionalPricingEnabled: false,
            language: 'auto',
            incomeTimeframe: 'monthly',
            incomeCardExpanded: false,
            activeTab: 'home-tab',
            enableLevelInput: false,
        },

        heroes: initializeHeroesState(),
        storedOres: { shiny: 0, glowy: 0, starry: 0 },
        income: {
            starBonusLeague: 'Unranked',
            shopOffers: {
                selectedSet: 'none',
                sets: { TH16_Set: {}, TH15_Set: {} },
            },
            raidMedals: { earned: 0, packs: { shiny: 0, glowy: 0, starry: 0 } },
            gems: { packs: { shiny: 0, glowy: 0, starry: 0 } },
            eventPass: {
                type: 'free',
                storeMedals: false,
                equipmentBought: false,
            },
            eventTrader: { packs: { shiny: 0, glowy: 0, starry: 0 } },
            clanWar: {
                warsPerMonth: 0,
                winRate: 50,
                drawRate: 0,
                oresPerAttack: { shiny: 0, glowy: 0, starry: 0 },
            },
            cwl: {
                hitsPerSeason: 0,
                winRate: 50,
                drawRate: 0,
                oresPerAttack: { shiny: 0, glowy: 0, starry: 0 },
            },
        },
        planner: {
            customMaxLevel: {
                common: 18,
                epic: 27,
            },
            currentHeroIndex: 0,
            calendar: {
                view: {
                    select: 'monthly',
                    month: `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`,
                    week: `${weekNo}-${year}`,
                },
                dates: {},
            },
        },
        playerSpecificDefaults: {
            heroes: initializeHeroesState(),
            storedOres: { shiny: 0, glowy: 0, starry: 0 },
            income: {
                starBonusLeague: 'Unranked',
                shopOffers: {
                    selectedSet: 'none',
                    sets: { TH16_Set: {}, TH15_Set: {} },
                },
                raidMedals: {
                    earned: 0,
                    packs: { shiny: 0, glowy: 0, starry: 0 },
                },
                gems: { packs: { shiny: 0, glowy: 0, starry: 0 } },
                eventPass: {
                    type: 'free',
                    storeMedals: false,
                    equipmentBought: false,
                },
                eventTrader: { packs: { shiny: 0, glowy: 0, starry: 0 } },
                clanWar: {
                    warsPerMonth: 0,
                    winRate: 50,
                    drawRate: 0,
                    oresPerAttack: { shiny: 0, glowy: 0, starry: 0 },
                },
                cwl: {
                    hitsPerSeason: 0,
                    winRate: 50,
                    drawRate: 0,
                    oresPerAttack: { shiny: 0, glowy: 0, starry: 0 },
                },
            },
            playerData: null,
            planner: {
                customMaxLevel: {
                    common: 18,
                    epic: 27,
                },
                currentHeroIndex: 0,
                calendar: {
                    view: {
                        select: 'monthly',
                        month: `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`,
                        week: `${weekNo}-${year}`,
                    },
                    dates: {},
                },
            },
            regionalPricingEnabled: false,
        },

        derived: {
            requiredOres: { shiny: 0, glowy: 0, starry: 0 },
            incomeSources: {},
            totalIncome: { shiny: 0, glowy: 0, starry: 0 },
            remainingTime: { shiny: 'N/A', glowy: 'N/A', starry: 'N/A' },
        },
    };
}

function initializeHeroesState() {
    const heroes = {};
    for (const heroKey in heroData) {
        const hero = heroData[heroKey];
        heroes[hero.name] = {
            enabled: true,
            equipment: hero.equipment.reduce((acc, equip) => {
                acc[equip.name] = {
                    level: 1,
                    checked: true,
                    upgradePlan: {
                        1: { target: 1, priorityIndex: 0, enabled: false },
                        2: { target: 1, priorityIndex: 0, enabled: false },
                        3: { target: 1, priorityIndex: 0, enabled: false },
                    },
                };
                return acc;
            }, {}),
        };
    }
    return heroes;
}

export function getDefaultPlayerState() {
    const now = new Date();
    const [year, weekNo] = getISOWeekNumber(now);

    return JSON.parse(
        JSON.stringify({
            heroes: initializeHeroesState(),
            storedOres: { shiny: 0, glowy: 0, starry: 0 },
            income: {
                starBonusLeague: 'Unranked',
                shopOffers: {
                    selectedSet: 'none',
                    sets: { TH16_Set: {}, TH15_Set: {} },
                },
                raidMedals: {
                    earned: 0,
                    packs: { shiny: 0, glowy: 0, starry: 0 },
                },
                gems: { packs: { shiny: 0, glowy: 0, starry: 0 } },
                eventPass: {
                    type: 'free',
                    storeMedals: false,
                    equipmentBought: false,
                },
                eventTrader: { packs: { shiny: 0, glowy: 0, starry: 0 } },
                clanWar: {
                    warsPerMonth: 0,
                    winRate: 50,
                    drawRate: 0,
                    oresPerAttack: { shiny: 0, glowy: 0, starry: 0 },
                },
                cwl: {
                    hitsPerSeason: 0,
                    winRate: 50,
                    drawRate: 0,
                    oresPerAttack: { shiny: 0, glowy: 0, starry: 0 },
                },
            },
            planner: {
                customMaxLevel: {
                    common: 18,
                    epic: 27,
                },
                currentHeroIndex: 0,
                calendar: {
                    view: {
                        select: 'monthly',
                        month: `${String(now.getMonth() + 1).padStart(
                            2,
                            '0'
                        )}-${now.getFullYear()}`,
                        week: `${weekNo}-${year}`,
                    },
                    dates: {},
                },
            },
            playerData: null,
            regionalPricingEnabled: false,
        })
    );
}

export function initializeState(savedState) {
    const defaultState = getDefaultState();

    state = { ...defaultState };
    state.uiSettings.currencySymbol =
        currencySymbols[state.uiSettings.currency]?.symbol || '';

    if (savedState) {
        state.appVersion = savedState.appVersion || defaultState.appVersion;

        if (savedState.savedPlayerTags) {
            state.savedPlayerTags = savedState.savedPlayerTags;
        }

        if (!state.lastPlayerTag) {
            state.lastPlayerTag = 'DEFAULT0';
        }

        if (savedState.allPlayersData) {
            for (const playerTag in savedState.allPlayersData) {
                if (state.allPlayersData[playerTag]) {
                    Object.assign(
                        state.allPlayersData[playerTag].heroes,
                        savedState.allPlayersData[playerTag].heroes
                    );
                    Object.assign(
                        state.allPlayersData[playerTag].storedOres,
                        savedState.allPlayersData[playerTag].storedOres
                    );
                    Object.assign(
                        state.allPlayersData[playerTag].income,
                        savedState.allPlayersData[playerTag].income
                    );
                    Object.assign(
                        state.allPlayersData[playerTag].planner,
                        savedState.allPlayersData[playerTag].planner
                    );
                    Object.assign(
                        state.allPlayersData[playerTag].playerData,
                        savedState.allPlayersData[playerTag].playerData
                    );
                    if (
                        savedState.allPlayersData[playerTag]
                            .regionalPricingEnabled !== undefined
                    ) {
                        state.allPlayersData[playerTag].regionalPricingEnabled =
                            savedState.allPlayersData[
                                playerTag
                            ].regionalPricingEnabled;
                    }
                    for (const heroKey in heroData) {
                        const heroName = heroData[heroKey].name;
                        if (state.allPlayersData[playerTag].heroes[heroName]) {
                            for (const equip of heroData[heroKey].equipment) {
                                if (
                                    !state.allPlayersData[playerTag].heroes[
                                        heroName
                                    ].equipment[equip.name]
                                ) {
                                    state.allPlayersData[playerTag].heroes[
                                        heroName
                                    ].equipment[equip.name] = {
                                        level: 1,
                                        checked: true,
                                        upgradePlan: {
                                            1: {
                                                target: 1,
                                                priorityIndex: 0,
                                                enabled: false,
                                            },
                                            2: {
                                                target: 1,
                                                priorityIndex: 0,
                                                enabled: false,
                                            },
                                            3: {
                                                target: 1,
                                                priorityIndex: 0,
                                                enabled: false,
                                            },
                                        },
                                    };
                                } else if (
                                    !state.allPlayersData[playerTag].heroes[
                                        heroName
                                    ].equipment[equip.name].upgradePlan
                                ) {
                                    state.allPlayersData[playerTag].heroes[
                                        heroName
                                    ].equipment[equip.name].upgradePlan = {
                                        1: {
                                            target: 1,
                                            priorityIndex: 0,
                                            enabled: false,
                                        },
                                        2: {
                                            target: 1,
                                            priorityIndex: 0,
                                            enabled: false,
                                        },
                                        3: {
                                            target: 1,
                                            priorityIndex: 0,
                                            enabled: false,
                                        },
                                    };
                                }
                            }
                        }
                    }
                } else {
                    state.allPlayersData[playerTag] =
                        savedState.allPlayersData[playerTag];
                    for (const heroKey in heroData) {
                        const heroName = heroData[heroKey].name;
                        if (state.allPlayersData[playerTag].heroes[heroName]) {
                            for (const equip of heroData[heroKey].equipment) {
                                if (
                                    !state.allPlayersData[playerTag].heroes[
                                        heroName
                                    ].equipment[equip.name]
                                ) {
                                    state.allPlayersData[playerTag].heroes[
                                        heroName
                                    ].equipment[equip.name] = {
                                        level: 1,
                                        checked: true,
                                        upgradePlan: {
                                            1: {
                                                target: 1,
                                                priorityIndex: 0,
                                                enabled: false,
                                            },
                                            2: {
                                                target: 1,
                                                priorityIndex: 0,
                                                enabled: false,
                                            },
                                            3: {
                                                target: 1,
                                                priorityIndex: 0,
                                                enabled: false,
                                            },
                                        },
                                    };
                                } else if (
                                    !state.allPlayersData[playerTag].heroes[
                                        heroName
                                    ].equipment[equip.name].upgradePlan
                                ) {
                                    state.allPlayersData[playerTag].heroes[
                                        heroName
                                    ].equipment[equip.name].upgradePlan = {
                                        1: {
                                            target: 1,
                                            priorityIndex: 0,
                                            enabled: false,
                                        },
                                        2: {
                                            target: 1,
                                            priorityIndex: 0,
                                            enabled: false,
                                        },
                                        3: {
                                            target: 1,
                                            priorityIndex: 0,
                                            enabled: false,
                                        },
                                    };
                                }
                            }
                        }
                    }
                }
            }
        }

        for (const key in savedState) {
            if (
                key === 'derived' ||
                key === 'heroes' ||
                key === 'storedOres' ||
                key === 'income' ||
                key === 'playerData' ||
                key === 'allPlayersData' ||
                key === 'planner'
            ) {
                continue;
            }
            Object.assign(state, { [key]: savedState[key] });
        }

        // Explicitly merge uiSettings to ensure deep merge
        Object.assign(
            state.uiSettings,
            savedState.uiSettings
        );

        if (state.activeTab === undefined) {
            state.activeTab = 'home-tab';
        }
        if (state.lastPlayerTag && state.allPlayersData[state.lastPlayerTag]) {
            const activePlayerData = state.allPlayersData[state.lastPlayerTag];
            for (const heroKey in heroData) {
                const heroName = heroData[heroKey].name;
                const defaultHero = getDefaultState().heroes[heroName];

                if (state.heroes[heroName]) {
                    const savedHero = activePlayerData.heroes?.[heroName];
                    if (savedHero) {
                        Object.assign(state.heroes[heroName], savedHero);
                        for (const equipKey in defaultHero.equipment) {
                            const savedEquip = savedHero.equipment?.[equipKey];
                            if (savedEquip) {
                                Object.assign(
                                    state.heroes[heroName].equipment[equipKey],
                                    savedEquip
                                );
                                if (
                                    !state.heroes[heroName].equipment[equipKey]
                                        .upgradePlan
                                ) {
                                    state.heroes[heroName].equipment[
                                        equipKey
                                    ].upgradePlan = {
                                        1: {
                                            target: 1,
                                            priorityIndex: 0,
                                            enabled: false,
                                        },
                                        2: {
                                            target: 1,
                                            priorityIndex: 0,
                                            enabled: false,
                                        },
                                        3: {
                                            target: 1,
                                            priorityIndex: 0,
                                            enabled: false,
                                        },
                                    };
                                } else if (
                                    savedEquip.upgradePlan &&
                                    Object.keys(savedEquip.upgradePlan)
                                        .length === 0
                                ) {
                                    state.heroes[heroName].equipment[
                                        equipKey
                                    ].upgradePlan =
                                        defaultHero.equipment[
                                            equipKey
                                        ].upgradePlan;
                                }
                            }
                        }
                    }
                }
            }

            Object.assign(state.storedOres, activePlayerData.storedOres);
            Object.assign(
                state.income,
                getDefaultState().income,
                activePlayerData.income
            );
            Object.assign(
                state.planner,
                getDefaultState().planner,
                activePlayerData.planner
            );

            if (!Array.isArray(state.planner.priorityList)) {
                state.planner.priorityList = [];
            }

            if (
                !state.planner.calendar.view.month ||
                typeof state.planner.calendar.view.month !== 'string' ||
                !state.planner.calendar.view.month.includes('-')
            ) {
                state.planner.calendar.view.month = `${String(
                    new Date().getMonth() + 1
                ).padStart(2, '0')}-${new Date().getFullYear()}`;
            }

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
            state.uiSettings.regionalPricingEnabled =
                activePlayerData.regionalPricingEnabled;
        }
    }
}
