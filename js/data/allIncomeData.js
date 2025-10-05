import { leagues } from './leagues.js';

const leagueNameToId = leagues.items.reduce((acc, league) => {
    acc[league.name] = league.id;
    return acc;
}, {});

export const starBonusData = [
    { league: leagueNameToId["Unranked"], shiny: 0, glowy: 0 }, { league: leagueNameToId["Bronze League III"], shiny: 125, glowy: 6 },
    { league: leagueNameToId["Bronze League II"], shiny: 175, glowy: 7 }, { league: leagueNameToId["Bronze League I"], shiny: 175, glowy: 8 },
    { league: leagueNameToId["Silver League III"], shiny: 200, glowy: 9 }, { league: leagueNameToId["Silver League II"], shiny: 250, glowy: 10 },
    { league: leagueNameToId["Silver League I"], shiny: 275, glowy: 11 }, { league: leagueNameToId["Gold League III"], shiny: 300, glowy: 12 },
    { league: leagueNameToId["Gold League II"], shiny: 325, glowy: 14 }, { league: leagueNameToId["Gold League I"], shiny: 350, glowy: 16 },
    { league: leagueNameToId["Crystal League III"], shiny: 375, glowy: 18 }, { league: leagueNameToId["Crystal League II"], shiny: 400, glowy: 20 },
    { league: leagueNameToId["Crystal League I"], shiny: 425, glowy: 22 }, { league: leagueNameToId["Master League III"], shiny: 450, glowy: 24 },
    { league: leagueNameToId["Master League II"], shiny: 500, glowy: 26 }, { league: leagueNameToId["Master League I"], shiny: 525, glowy: 28 },
    { league: leagueNameToId["Champion League III"], shiny: 550, glowy: 30 }, { league: leagueNameToId["Champion League II"], shiny: 625, glowy: 34 },
    { league: leagueNameToId["Champion League I"], shiny: 700, glowy: 38 }, { league: leagueNameToId["Titan League III"], shiny: 775, glowy: 42 },
    { league: leagueNameToId["Titan League II"], shiny: 850, glowy: 46 }, { league: leagueNameToId["Titan League I"], shiny: 925, glowy: 50 },
    { league: leagueNameToId["Legend League"], shiny: 1000, glowy: 54 },
];

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