import { deepFreeze } from '../../utils/objectUtils.js';

export const raidMedalTraderData = deepFreeze([
    { id: "raid_starry", shiny: 0, glowy: 0, starry: 5, cost: 350, currency: "raid_medals", maxPacks: 2 },
    { id: "raid_glowy", shiny: 0, glowy: 50, starry: 0, cost: 300, currency: "raid_medals", maxPacks: 2 },
    { id: "raid_shiny", shiny: 500, glowy: 0, starry: 0, cost: 350, currency: "raid_medals", maxPacks: 2 },
]);

export const gemTraderData = deepFreeze([
    { id: "gem_starry", shiny: 0, glowy: 0, starry: 15, cost: 115, currency: "gems", maxPacks: 10 },
    { id: "gem_glowy", shiny: 0, glowy: 60, starry: 0, cost: 90, currency: "gems", maxPacks: 10 },
    { id: "gem_shiny", shiny: 300, glowy: 0, starry: 0, cost: 75, currency: "gems", maxPacks: 10 },
]);

export const eventTraderData = deepFreeze([
    { id: "event_starry", shiny: 0, glowy: 0, starry: 10, cost: 320, currency: "event_medals", maxPacks: 8 },
    { id: "event_glowy", shiny: 0, glowy: 60, starry: 0, cost: 280, currency: "event_medals", maxPacks: 10 },
    { id: "event_shiny", shiny: 350, glowy: 0, starry: 0, cost: 325, currency: "event_medals", maxPacks: 40 },
]);
