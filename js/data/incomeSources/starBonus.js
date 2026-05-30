import { leagueTiers } from '../leagueTiers.js';

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
