import { leagueTiers } from './appData.js';

const leagueNameToId = leagueTiers.items.reduce((acc, league) => {
    acc[league.name] = league.id;
    return acc;
}, {});

export const starBonusData = [
    { league: leagueNameToId["Unranked"], shiny: 0, glowy: 0, starry: 0 },
    { league: leagueNameToId["Skeleton League 1"], shiny: 300, glowy: 20, starry: 0 }, { league: leagueNameToId["Skeleton League 2"], shiny: 325, glowy: 21, starry: 0 }, { league: leagueNameToId["Skeleton League 3"], shiny: 350, glowy: 22, starry: 0 },
    { league: leagueNameToId["Barbarian League 4"], shiny: 375, glowy: 23, starry: 0 }, { league: leagueNameToId["Barbarian League 5"], shiny: 400, glowy: 24, starry: 0 }, { league: leagueNameToId["Barbarian League 6"], shiny: 425, glowy: 25, starry: 0 },
    { league: leagueNameToId["Archer League 7"], shiny: 450, glowy: 27, starry: 0 }, { league: leagueNameToId["Archer League 8"], shiny: 475, glowy: 27, starry: 1 }, { league: leagueNameToId["Archer League 9"], shiny: 500, glowy: 29, starry: 1 },
    { league: leagueNameToId["Wizard League 10"], shiny: 525, glowy: 31, starry: 1 }, { league: leagueNameToId["Wizard League 11"], shiny: 550, glowy: 33, starry: 1 }, { league: leagueNameToId["Wizard League 12"], shiny: 575, glowy: 35, starry: 1 },
    { league: leagueNameToId["Valkyrie League 13"], shiny: 600, glowy: 37, starry: 1 }, { league: leagueNameToId["Valkyrie League 14"], shiny: 625, glowy: 39, starry: 1 }, { league: leagueNameToId["Valkyrie League 15"], shiny: 650, glowy: 41, starry: 1 },
    { league: leagueNameToId["Witch League 16"], shiny: 675, glowy: 43, starry: 1 }, { league: leagueNameToId["Witch League 17"], shiny: 725, glowy: 45, starry: 1 }, { league: leagueNameToId["Witch League 18"], shiny: 775, glowy: 47, starry: 1 },
    { league: leagueNameToId["Golem League 19"], shiny: 825, glowy: 49, starry: 1 }, { league: leagueNameToId["Golem League 20"], shiny: 875, glowy: 51, starry: 1 }, { league: leagueNameToId["Golem League 21"], shiny: 900, glowy: 53, starry: 1 },
    { league: leagueNameToId["P.E.K.K.A League 22"], shiny: 925, glowy: 54, starry: 1 }, { league: leagueNameToId["P.E.K.K.A League 23"], shiny: 950, glowy: 55, starry: 1 }, { league: leagueNameToId["P.E.K.K.A League 24"], shiny: 963, glowy: 56, starry: 1 },
    { league: leagueNameToId["Titan League 25"], shiny: 1000, glowy: 57, starry: 1 }, { league: leagueNameToId["Titan League 26"], shiny: 1010, glowy: 58, starry: 1 }, { league: leagueNameToId["Titan League 27"], shiny: 1020, glowy: 59, starry: 1 },
    { league: leagueNameToId["Dragon League 28"], shiny: 1030, glowy: 60, starry: 1 }, { league: leagueNameToId["Dragon League 29"], shiny: 1040, glowy: 61, starry: 1 }, { league: leagueNameToId["Dragon League 30"], shiny: 1050, glowy: 62, starry: 1 },
    { league: leagueNameToId["Electro League 31"], shiny: 1060, glowy: 62, starry: 2 }, { league: leagueNameToId["Electro League 32"], shiny: 1070, glowy: 63, starry: 2 }, { league: leagueNameToId["Electro League 33"], shiny: 1080, glowy: 64, starry: 2 },
    { league: leagueNameToId["Legend League"], shiny: 1100, glowy: 65, starry: 2 },
];

export const townHallLeagueFloors = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 105000001,
    8: 105000002,
    9: 105000003,
    10: 105000004,
    11: 105000006,
    12: 105000008,
    13: 105000011,
    14: 105000014,
    15: 105000017,
    16: 105000021,
    17: 105000025,
};

export const shopOfferData = {
    none: { shiny: 0, glowy: 0, starry: 0, townHallLevel: 0 },
    TH16_Set: {
        townHallLevel: 16,
        shiny_large: {
            shiny: 12000,
            glowy: 0,
            starry: 0,
            baseCostUSD: 9.99,
            maxPacks: 2,
        },
        glowy: {
            shiny: 0,
            glowy: 750,
            starry: 0,
            baseCostUSD: 6.99,
            maxPacks: 2,
        },
        starry: {
            shiny: 0,
            glowy: 0,
            starry: 75,
            baseCostUSD: 6.99,
            maxPacks: 2,
        },
        shiny_small: {
            shiny: 6000,
            glowy: 0,
            starry: 0,
            baseCostUSD: 6.99,
            maxPacks: 2,
        },
    },
    TH14_Set: {
        townHallLevel: 14,
        shiny_large: {
            shiny: 12000,
            glowy: 0,
            starry: 0,
            baseCostUSD: 9.99,
            maxPacks: 2,
        },
        glowy: {
            shiny: 0,
            glowy: 630,
            starry: 0,
            baseCostUSD: 5.99,
            maxPacks: 2,
        },
        starry: {
            shiny: 0,
            glowy: 0,
            starry: 65,
            baseCostUSD: 5.99,
            maxPacks: 2,
        },
        shiny_small: {
            shiny: 5000,
            glowy: 0,
            starry: 0,
            baseCostUSD: 5.99,
            maxPacks: 2,
        },
    },
    TH11_Set: {
        townHallLevel: 11,
        shiny_large: {
            shiny: 12000,
            glowy: 0,
            starry: 0,
            baseCostUSD: 9.99,
            maxPacks: 2,
        },
        glowy: {
            shiny: 0,
            glowy: 500,
            starry: 0,
            baseCostUSD: 4.99,
            maxPacks: 2,
        },
        starry: {
            shiny: 0,
            glowy: 0,
            starry: 55,
            baseCostUSD: 4.99,
            maxPacks: 2,
        },
        shiny_small: {
            shiny: 4000,
            glowy: 0,
            starry: 0,
            baseCostUSD: 4.99,
            maxPacks: 2,
        },
    },
    TH8_Set: {
        townHallLevel: 8,
        glowy: {
            shiny: 0,
            glowy: 400,
            starry: 0,
            baseCostUSD: 3.99,
            maxPacks: 2,
        },
        starry: {
            shiny: 0,
            glowy: 0,
            starry: 40,
            baseCostUSD: 3.99,
            maxPacks: 2,
        },
        shiny_small: {
            shiny: 3000,
            glowy: 0,
            starry: 0,
            baseCostUSD: 3.99,
            maxPacks: 2,
        },
    },
};

export const raidMedalTraderData = [
    { id: "raid_starry_5", shiny: 0, glowy: 0, starry: 5, cost: 350, currency: "raid_medals", maxPacks: 2 },
    { id: "raid_glowy_50", shiny: 0, glowy: 50, starry: 0, cost: 300, currency: "raid_medals", maxPacks: 2 },
    { id: "raid_shiny_500", shiny: 500, glowy: 0, starry: 0, cost: 350, currency: "raid_medals", maxPacks: 2 },
];

export const gemTraderData = [
    { id: "gem_starry_15", shiny: 0, glowy: 0, starry: 15, cost: 275, currency: "gems", maxPacks: 1 },
    { id: "gem_glowy_60", shiny: 0, glowy: 60, starry: 0, cost: 150, currency: "gems", maxPacks: 2 },
    { id: "gem_shiny_300", shiny: 300, glowy: 0, starry: 0, cost: 150, currency: "gems", maxPacks: 5 },
];

export const eventPassData = {
    free: { shiny: 5000, glowy: 400, starry: 0, baseCostUSD: 0.00, eventMedals: 3750, storeMedals: 300, equipmentCost: 3100 },
    event: { shiny: 5000, glowy: 1000, starry: 80, baseCostUSD: 4.99, eventMedals: 9250, storeMedals: 300, equipmentCost: 3100 },
};

export const eventTraderData = [
    { id: "event_starry_10", shiny: 0, glowy: 0, starry: 10, cost: 320, currency: "event_medals", maxPacks: 8 },
    { id: "event_glowy_60", shiny: 0, glowy: 60, starry: 0, cost: 280, currency: "event_medals", maxPacks: 10 },
    { id: "event_shiny_350", shiny: 350, glowy: 0, starry: 0, cost: 325, currency: "event_medals", maxPacks: 40 },
];