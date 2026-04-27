import { leagueTiers } from './appData.js';

const leagueNameToId = leagueTiers.items.reduce((acc, league) => {
    acc[league.name] = league.id;
    return acc;
}, {});

export const starBonusData = [
    { league: leagueNameToId["Unranked"], shiny: 0, glowy: 0, starry: 0 },
    { league: leagueNameToId["Skeleton 1"], shiny: 790, glowy: 39, starry: 1 }, { league: leagueNameToId["Skeleton 2"], shiny: 795, glowy: 39, starry: 1 }, { league: leagueNameToId["Skeleton 3"], shiny: 800, glowy: 39, starry: 1 },
    { league: leagueNameToId["Barbarian 4"], shiny: 850, glowy: 44, starry: 1 }, { league: leagueNameToId["Barbarian 5"], shiny: 855, glowy: 44, starry: 1 }, { league: leagueNameToId["Barbarian 6"], shiny: 860, glowy: 44, starry: 1 },
    { league: leagueNameToId["Archer 7"], shiny: 910, glowy: 49, starry: 1 }, { league: leagueNameToId["Archer 8"], shiny: 915, glowy: 49, starry: 1 }, { league: leagueNameToId["Archer 9"], shiny: 920, glowy: 49, starry: 1 },
    { league: leagueNameToId["Wizard 10"], shiny: 970, glowy: 52, starry: 1 }, { league: leagueNameToId["Wizard 11"], shiny: 975, glowy: 52, starry: 1 }, { league: leagueNameToId["Wizard 12"], shiny: 980, glowy: 52, starry: 1 },
    { league: leagueNameToId["Valkyrie 13"], shiny: 1030, glowy: 57, starry: 1 }, { league: leagueNameToId["Valkyrie 14"], shiny: 1035, glowy: 57, starry: 1 }, { league: leagueNameToId["Valkyrie 15"], shiny: 1040, glowy: 57, starry: 1 },
    { league: leagueNameToId["Witch 16"], shiny: 1090, glowy: 60, starry: 1 }, { league: leagueNameToId["Witch 17"], shiny: 1095, glowy: 60, starry: 1 }, { league: leagueNameToId["Witch 18"], shiny: 1100, glowy: 60, starry: 1 },
    { league: leagueNameToId["Golem 19"], shiny: 1150, glowy: 63, starry: 1 }, { league: leagueNameToId["Golem 20"], shiny: 1155, glowy: 63, starry: 1 }, { league: leagueNameToId["Golem 21"], shiny: 1160, glowy: 63, starry: 1 },
    { league: leagueNameToId["P.E.K.K.A. 22"], shiny: 1170, glowy: 66, starry: 1 }, { league: leagueNameToId["P.E.K.K.A. 23"], shiny: 1175, glowy: 66, starry: 1 }, { league: leagueNameToId["P.E.K.K.A. 24"], shiny: 1180, glowy: 66, starry: 1 },
    { league: leagueNameToId["Titan 25"], shiny: 1190, glowy: 69, starry: 1 }, { league: leagueNameToId["Titan 26"], shiny: 1195, glowy: 69, starry: 1 }, { league: leagueNameToId["Titan 27"], shiny: 1200, glowy: 69, starry: 1 },
    { league: leagueNameToId["Dragon 28"], shiny: 1210, glowy: 70, starry: 1 }, { league: leagueNameToId["Dragon 29"], shiny: 1215, glowy: 70, starry: 1 }, { league: leagueNameToId["Dragon 30"], shiny: 1220, glowy: 70, starry: 1 },
    { league: leagueNameToId["Electro 31"], shiny: 1230, glowy: 71, starry: 2 }, { league: leagueNameToId["Electro 32"], shiny: 1235, glowy: 71, starry: 2 }, { league: leagueNameToId["Electro 33"], shiny: 1240, glowy: 71, starry: 2 },
    { league: leagueNameToId["Legend III"], shiny: 1250, glowy: 72, starry: 2 }, { league: leagueNameToId["Legend II"], shiny: 1250, glowy: 72, starry: 2 }, { league: leagueNameToId["Legend I"], shiny: 1250, glowy: 72, starry: 2 },
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
    16: 105000020,
    17: 105000023,
    18: 105000026,
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

export const championshipData = {
    monthlyQualifiers: { shiny: 1500, glowy: 75, starry: 15, perYear: 6 },
    lastChanceQualifiers: { shiny: 1500, glowy: 75, starry: 15, perYear: 1 },
    worldChampionships: { shiny: 1500, glowy: 75, starry: 15, perYear: 1 },
};