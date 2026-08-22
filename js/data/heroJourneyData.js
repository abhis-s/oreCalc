export const heroMaxLevelsPerTH = {
    barbarianKing:  { 7: 10, 8: 20, 9: 30, 10: 40, 11: 50, 12: 65, 13: 75, 14: 85, 15: 90, 16: 95, 17: 100, 18: 110 },
    archerQueen:    { 8: 10, 9: 30, 10: 40, 11: 50, 12: 65, 13: 75, 14: 85, 15: 90, 16: 95, 17: 100, 18: 110 },
    minionPrince:   { 9: 10, 10: 20, 11: 30, 12: 40, 13: 50, 14: 60, 15: 70, 16: 80, 17: 90, 18: 95 },
    grandWarden:    { 11: 20, 12: 40, 13: 50, 14: 60, 15: 65, 16: 70, 17: 75, 18: 85 },
    royalChampion:  { 13: 25, 14: 30, 15: 40, 16: 45, 17: 50, 18: 55 },
    dragonDuke:     { 15: 10, 16: 15, 17: 20, 18: 25 }
};

export const oreChestRewardsNormal = {
    8:  { shiny: { min: 250, max: 350, avg: 300 }, glowy: { min: 9, max: 19, avg: 14 }, starry: { min: 1, max: 3, avg: 2 } },
    9:  { shiny: { min: 300, max: 400, avg: 350 }, glowy: { min: 12, max: 22, avg: 17 }, starry: { min: 1, max: 3, avg: 2 } },
    10: { shiny: { min: 350, max: 450, avg: 400 }, glowy: { min: 15, max: 25, avg: 20 }, starry: { min: 2, max: 4, avg: 3 } },
    11: { shiny: { min: 500, max: 700, avg: 600 }, glowy: { min: 20, max: 40, avg: 30 }, starry: { min: 3, max: 5, avg: 4 } },
    12: { shiny: { min: 700, max: 900, avg: 800 }, glowy: { min: 30, max: 50, avg: 40 }, starry: { min: 4, max: 6, avg: 5 } },
    13: { shiny: { min: 900, max: 1100, avg: 1000 }, glowy: { min: 40, max: 60, avg: 50 }, starry: { min: 8, max: 12, avg: 10 } },
    14: { shiny: { min: 1100, max: 1300, avg: 1200 }, glowy: { min: 50, max: 70, avg: 60 }, starry: { min: 10, max: 18, avg: 14 } },
    15: { shiny: { min: 1325, max: 1525, avg: 1425 }, glowy: { min: 60, max: 80, avg: 70 }, starry: { min: 25, max: 35, avg: 30 } },
    16: { shiny: { min: 1550, max: 1750, avg: 1650 }, glowy: { min: 70, max: 90, avg: 80 }, starry: { min: 30, max: 40, avg: 35 } },
    17: { shiny: { min: 1750, max: 1950, avg: 1850 }, glowy: { min: 80, max: 100, avg: 90 }, starry: { min: 40, max: 50, avg: 45 } },
    18: { shiny: { min: 1950, max: 2150, avg: 2050 }, glowy: { min: 90, max: 110, avg: 100 }, starry: { min: 50, max: 60, avg: 55 } }
};

export const oreChestRewardsAccelerated = {
    8:  { shiny: { min: 250, max: 350, avg: 300 }, glowy: { min: 9, max: 19, avg: 14 }, starry: { min: 1, max: 3, avg: 2 } },
    9:  { shiny: { min: 650, max: 750, avg: 700 }, glowy: { min: 29, max: 39, avg: 34 }, starry: { min: 1, max: 3, avg: 2 } },
    10: { shiny: { min: 750, max: 850, avg: 800 }, glowy: { min: 35, max: 45, avg: 40 }, starry: { min: 4, max: 8, avg: 6 } },
    11: { shiny: { min: 1100, max: 1300, avg: 1200 }, glowy: { min: 50, max: 70, avg: 60 }, starry: { min: 6, max: 10, avg: 8 } },
    12: { shiny: { min: 1500, max: 1700, avg: 1600 }, glowy: { min: 70, max: 90, avg: 80 }, starry: { min: 10, max: 15, avg: 13 } },
    13: { shiny: { min: 1900, max: 2100, avg: 2000 }, glowy: { min: 90, max: 110, avg: 100 }, starry: { min: 20, max: 30, avg: 25 } },
    14: { shiny: { min: 2300, max: 2500, avg: 2400 }, glowy: { min: 110, max: 130, avg: 120 }, starry: { min: 30, max: 40, avg: 35 } },
    15: { shiny: { min: 2750, max: 2950, avg: 2850 }, glowy: { min: 130, max: 150, avg: 140 }, starry: { min: 70, max: 80, avg: 75 } },
    16: { shiny: { min: 3200, max: 3400, avg: 3300 }, glowy: { min: 150, max: 170, avg: 160 }, starry: { min: 80, max: 90, avg: 85 } },
    17: { shiny: { min: 3600, max: 3800, avg: 3700 }, glowy: { min: 170, max: 190, avg: 180 }, starry: { min: 95, max: 105, avg: 100 } },
    18: { shiny: { min: 4000, max: 4200, avg: 4100 }, glowy: { min: 190, max: 210, avg: 200 }, starry: { min: 110, max: 120, avg: 115 } }
};

export const heroJourneyNodes = [
    {
        "level": 2,
        "type": "resource",
        "amount": 3000,
        "icon": "assets/dark_elixir.png",
        "resourceType": "darkElixir"
    },
    {
        "level": 5,
        "type": "magicItem",
        "itemKey": "heroPotion",
        "amount": 1,
        "icon": "assets/magicItems/heroPotion.png"
    },
    {
        "level": 9,
        "type": "resource",
        "amount": 5000,
        "icon": "assets/dark_elixir.png",
        "resourceType": "darkElixir"
    },
    {
        "level": 13,
        "type": "quest",
        "amount": 1,
        "icon": "assets/heroes/emblemBarbarianKing.png",
        "hero": "barbarianKing"
    },
    {
        "level": 20,
        "type": "equipment",
        "amount": 1,
        "icon": "assets/heroes/emblemBarbarianKing.png",
        "hero": "barbarianKing",
        "fallbackStarry": 50
    },
    {
        "level": 21,
        "type": "magicItem",
        "itemKey": "mightyMorsel",
        "amount": 3,
        "icon": "assets/magicItems/mightyMorsel.png"
    },
    {
        "level": 25,
        "type": "quest",
        "amount": 1,
        "icon": "assets/equipment/barbarian_king/BK_giant_gauntlet.png",
        "equipmentKey": "giantGauntlet"
    },
    {
        "level": 29,
        "type": "ore",
        "amount": 2500,
        "icon": "assets/shiny_ore.png",
        "resourceType": "shiny"
    },
    {
        "level": 35,
        "type": "quest",
        "amount": 1,
        "icon": "assets/heroes/emblemArcherQueen.png",
        "hero": "archerQueen"
    },
    {
        "level": 38,
        "type": "resource",
        "amount": 10000,
        "icon": "assets/dark_elixir.png",
        "resourceType": "darkElixir"
    },
    {
        "level": 43,
        "type": "quest",
        "amount": 1,
        "icon": "assets/heroes/emblemBarbarianKing.png",
        "hero": "barbarianKing"
    },
    {
        "level": 50,
        "type": "equipment",
        "amount": 1,
        "icon": "assets/heroes/emblemArcherQueen.png",
        "hero": "archerQueen",
        "fallbackStarry": 50
    },
    {
        "level": 51,
        "type": "magicItem",
        "itemKey": "mightyMorsel",
        "amount": 3,
        "icon": "assets/magicItems/mightyMorsel.png"
    },
    {
        "level": 53,
        "type": "quest",
        "amount": 1,
        "icon": "assets/equipment/archer_queen/AQ_frozen_arrow.png",
        "equipmentKey": "frozenArrow"
    },
    {
        "level": 57,
        "type": "resource",
        "amount": 25000,
        "icon": "assets/dark_elixir.png",
        "resourceType": "darkElixir"
    },
    {
        "level": 64,
        "type": "magicItem",
        "itemKey": "bookOfHeroes",
        "amount": 1,
        "icon": "assets/magicItems/bookOfHeroes.png"
    },
    {
        "level": 69,
        "type": "ore",
        "amount": 200,
        "icon": "assets/glowy_ore.png",
        "resourceType": "glowy"
    },
    {
        "level": 74,
        "type": "magicItem",
        "itemKey": "heroPotion",
        "amount": 1,
        "icon": "assets/magicItems/heroPotion.png"
    },
    {
        "level": 79,
        "type": "quest",
        "amount": 1,
        "icon": "assets/heroes/emblemMinionPrince.png",
        "hero": "minionPrince"
    },
    {
        "level": 83,
        "type": "resource",
        "amount": 50000,
        "icon": "assets/dark_elixir.png",
        "resourceType": "darkElixir"
    },
    {
        "level": 87,
        "type": "quest",
        "amount": 1,
        "icon": "assets/equipment/barbarian_king/BK_rage_vial.png",
        "equipmentKey": "rageVial"
    },
    {
        "level": 92,
        "type": "ore",
        "amount": 10,
        "icon": "assets/starry_ore.png",
        "resourceType": "starry"
    },
    {
        "level": 99,
        "type": "equipment",
        "amount": 1,
        "icon": "assets/heroes/emblemMinionPrince.png",
        "hero": "minionPrince",
        "fallbackStarry": 50
    },
    {
        "level": 101,
        "type": "magicItem",
        "itemKey": "mightyMorsel",
        "amount": 3,
        "icon": "assets/magicItems/mightyMorsel.png"
    },
    {
        "level": 105,
        "type": "quest",
        "amount": 1,
        "icon": "assets/equipment/minion_prince/MP_dark_crown.png",
        "equipmentKey": "darkCrown"
    },
    {
        "level": 110,
        "type": "resource",
        "amount": 5000000,
        "icon": "assets/elixir.png",
        "resourceType": "elixir"
    },
    {
        "level": 115,
        "type": "quest",
        "amount": 1,
        "icon": "assets/heroes/emblemMinionPrince.png",
        "hero": "minionPrince"
    },
    {
        "level": 125,
        "type": "skin",
        "skinKey": "majesticBarbarianKing",
        "amount": 1,
        "icon": "assets/skins/majesticBarbarianKing.png",
        "hero": "barbarianKing"
    },
    {
        "level": 130,
        "type": "ore",
        "amount": 5000,
        "icon": "assets/shiny_ore.png",
        "resourceType": "shiny"
    },
    {
        "level": 135,
        "type": "quest",
        "amount": 1,
        "icon": "assets/heroes/emblemGrandWarden.png",
        "hero": "grandWarden"
    },
    {
        "level": 140,
        "type": "ore",
        "amount": 250,
        "icon": "assets/glowy_ore.png",
        "resourceType": "glowy"
    },
    {
        "level": 145,
        "type": "quest",
        "amount": 1,
        "icon": "assets/equipment/grand_warden/GW_eternal_tome.png",
        "equipmentKey": "eternalTome"
    },
    {
        "level": 150,
        "type": "equipment",
        "amount": 1,
        "icon": "assets/heroes/emblemGrandWarden.png",
        "hero": "grandWarden",
        "fallbackStarry": 50
    },
    {
        "level": 152,
        "type": "magicItem",
        "itemKey": "mightyMorsel",
        "amount": 3,
        "icon": "assets/magicItems/mightyMorsel.png"
    },
    {
        "level": 155,
        "type": "quest",
        "amount": 1,
        "icon": "assets/equipment/grand_warden/GW_fireball.png",
        "equipmentKey": "fireball"
    },
    {
        "level": 158,
        "type": "resource",
        "amount": 100000,
        "icon": "assets/dark_elixir.png",
        "resourceType": "darkElixir"
    },
    {
        "level": 163,
        "type": "quest",
        "amount": 1,
        "icon": "assets/heroes/emblemArcherQueen.png",
        "hero": "archerQueen"
    },
    {
        "level": 167,
        "type": "ore",
        "amount": 5000,
        "icon": "assets/shiny_ore.png",
        "resourceType": "shiny"
    },
    {
        "level": 172,
        "type": "ore",
        "amount": 15,
        "icon": "assets/starry_ore.png",
        "resourceType": "starry"
    },
    {
        "level": 180,
        "type": "equipment",
        "amount": 1,
        "icon": "assets/heroes/emblemBarbarianKing.png",
        "hero": "barbarianKing",
        "fallbackStarry": 50
    },
    {
        "level": 181,
        "type": "magicItem",
        "itemKey": "mightyMorsel",
        "amount": 3,
        "icon": "assets/magicItems/mightyMorsel.png"
    },
    {
        "level": 182,
        "type": "quest",
        "amount": 1,
        "icon": "assets/equipment/barbarian_king/BK_spiky_ball.png",
        "equipmentKey": "spikyBall"
    },
    {
        "level": 185,
        "type": "ore",
        "amount": 250,
        "icon": "assets/glowy_ore.png",
        "resourceType": "glowy"
    },
    {
        "level": 190,
        "type": "quest",
        "amount": 1,
        "icon": "assets/heroes/emblemMinionPrince.png",
        "hero": "minionPrince"
    },
    {
        "level": 195,
        "type": "magicItem",
        "itemKey": "heroPotion",
        "amount": 2,
        "icon": "assets/magicItems/heroPotion.png"
    },
    {
        "level": 203,
        "type": "equipment",
        "amount": 1,
        "icon": "assets/heroes/emblemArcherQueen.png",
        "hero": "archerQueen",
        "fallbackStarry": 50
    },
    {
        "level": 204,
        "type": "magicItem",
        "itemKey": "mightyMorsel",
        "amount": 3,
        "icon": "assets/magicItems/mightyMorsel.png"
    },
    {
        "level": 207,
        "type": "quest",
        "amount": 1,
        "icon": "assets/equipment/archer_queen/AQ_magic_mirror.png",
        "equipmentKey": "magicMirror"
    },
    {
        "level": 211,
        "type": "resource",
        "amount": 10000000,
        "icon": "assets/elixir.png",
        "resourceType": "elixir"
    },
    {
        "level": 215,
        "type": "quest",
        "amount": 1,
        "icon": "assets/heroes/emblemRoyalChampion.png",
        "hero": "royalChampion"
    },
    {
        "level": 225,
        "type": "skin",
        "skinKey": "majesticArcherQueen",
        "amount": 1,
        "icon": "assets/skins/majesticArcherQueen.png",
        "hero": "archerQueen"
    },
    {
        "level": 230,
        "type": "quest",
        "amount": 1,
        "icon": "assets/equipment/royal_champion/RC_royal_gem.png",
        "equipmentKey": "royalGem"
    },
    {
        "level": 233,
        "type": "resource",
        "amount": 150000,
        "icon": "assets/dark_elixir.png",
        "resourceType": "darkElixir"
    },
    {
        "level": 238,
        "type": "quest",
        "amount": 1,
        "icon": "assets/heroes/emblemBarbarianKing.png",
        "hero": "barbarianKing"
    },
    {
        "level": 243,
        "type": "ore",
        "amount": 25,
        "icon": "assets/starry_ore.png",
        "resourceType": "starry"
    },
    {
        "level": 250,
        "type": "equipment",
        "amount": 1,
        "icon": "assets/heroes/emblemRoyalChampion.png",
        "hero": "royalChampion",
        "fallbackStarry": 50
    },
    {
        "level": 251,
        "type": "magicItem",
        "itemKey": "mightyMorsel",
        "amount": 3,
        "icon": "assets/magicItems/mightyMorsel.png"
    },
    {
        "level": 253,
        "type": "quest",
        "amount": 1,
        "icon": "assets/equipment/royal_champion/RC_rocket_spear.png",
        "equipmentKey": "rocketSpear"
    },
    {
        "level": 260,
        "type": "magicItem",
        "itemKey": "bookOfHeroes",
        "amount": 1,
        "icon": "assets/magicItems/bookOfHeroes.png"
    },
    {
        "level": 264,
        "type": "quest",
        "amount": 1,
        "icon": "assets/heroes/emblemArcherQueen.png",
        "hero": "archerQueen"
    },
    {
        "level": 266,
        "type": "ore",
        "amount": 5000,
        "icon": "assets/shiny_ore.png",
        "resourceType": "shiny"
    },
    {
        "level": 276,
        "type": "skin",
        "skinKey": "majesticMinionPrince",
        "amount": 1,
        "icon": "assets/skins/majesticMinionPrince.png",
        "hero": "minionPrince"
    },
    {
        "level": 280,
        "type": "quest",
        "amount": 1,
        "icon": "assets/heroes/emblemRoyalChampion.png",
        "hero": "royalChampion"
    },
    {
        "level": 285,
        "type": "magicItem",
        "itemKey": "runeOfElixir",
        "amount": 1,
        "icon": "assets/magicItems/runeOfElixir.png",
        "resourceType": "elixir"
    },
    {
        "level": 289,
        "type": "quest",
        "amount": 1,
        "icon": "assets/heroes/emblemGrandWarden.png",
        "hero": "grandWarden"
    },
    {
        "level": 292,
        "type": "ore",
        "amount": 500,
        "icon": "assets/glowy_ore.png",
        "resourceType": "glowy"
    },
    {
        "level": 302,
        "type": "equipment",
        "amount": 1,
        "icon": "assets/heroes/emblemMinionPrince.png",
        "hero": "minionPrince",
        "fallbackStarry": 50
    },
    {
        "level": 303,
        "type": "magicItem",
        "itemKey": "mightyMorsel",
        "amount": 3,
        "icon": "assets/magicItems/mightyMorsel.png"
    },
    {
        "level": 305,
        "type": "quest",
        "amount": 1,
        "icon": "assets/equipment/minion_prince/MP_meteor_staff.png",
        "equipmentKey": "meteorStaff"
    },
    {
        "level": 310,
        "type": "resource",
        "amount": 200000,
        "icon": "assets/dark_elixir.png",
        "resourceType": "darkElixir"
    },
    {
        "level": 315,
        "type": "quest",
        "amount": 1,
        "icon": "assets/equipment/archer_queen/AQ_frozen_arrow.png",
        "equipmentKey": "frozenArrow"
    },
    {
        "level": 320,
        "type": "magicItem",
        "itemKey": "petPotion",
        "amount": 1,
        "icon": "assets/magicItems/petPotion.png"
    },
    {
        "level": 330,
        "type": "skin",
        "skinKey": "majesticGrandWarden",
        "amount": 1,
        "icon": "assets/skins/majesticGrandWarden.png",
        "hero": "grandWarden"
    },
    {
        "level": 334,
        "type": "quest",
        "amount": 1,
        "icon": "assets/heroes/emblemDragonDuke.png",
        "hero": "dragonDuke"
    },
    {
        "level": 337,
        "type": "ore",
        "amount": 25,
        "icon": "assets/starry_ore.png",
        "resourceType": "starry"
    },
    {
        "level": 342,
        "type": "quest",
        "amount": 1,
        "icon": "assets/heroes/emblemBarbarianKing.png",
        "hero": "barbarianKing"
    },
    {
        "level": 345,
        "type": "resource",
        "amount": 250000,
        "icon": "assets/dark_elixir.png",
        "resourceType": "darkElixir"
    },
    {
        "level": 354,
        "type": "equipment",
        "amount": 1,
        "icon": "assets/heroes/emblemGrandWarden.png",
        "hero": "grandWarden",
        "fallbackStarry": 50
    },
    {
        "level": 355,
        "type": "magicItem",
        "itemKey": "mightyMorsel",
        "amount": 3,
        "icon": "assets/magicItems/mightyMorsel.png"
    },
    {
        "level": 356,
        "type": "quest",
        "amount": 1,
        "icon": "assets/equipment/grand_warden/GW_lavaloon_puppet.png",
        "equipmentKey": "lavaloonPuppet"
    },
    {
        "level": 360,
        "type": "magicItem",
        "itemKey": "heroPotion",
        "amount": 2,
        "icon": "assets/magicItems/heroPotion.png"
    },
    {
        "level": 364,
        "type": "quest",
        "amount": 1,
        "icon": "assets/heroes/emblemDragonDuke.png",
        "hero": "dragonDuke"
    },
    {
        "level": 366,
        "type": "ore",
        "amount": 500,
        "icon": "assets/glowy_ore.png",
        "resourceType": "glowy"
    },
    {
        "level": 373,
        "type": "equipment",
        "amount": 1,
        "icon": "assets/heroes/emblemDragonDuke.png",
        "hero": "dragonDuke",
        "fallbackStarry": 50
    },
    {
        "level": 375,
        "type": "magicItem",
        "itemKey": "mightyMorsel",
        "amount": 3,
        "icon": "assets/magicItems/mightyMorsel.png"
    },
    {
        "level": 380,
        "type": "quest",
        "amount": 1,
        "icon": "assets/equipment/dragon_duke/DD_rocket_backpack.png",
        "equipmentKey": "rocketBackpack"
    },
    {
        "level": 385,
        "type": "magicItem",
        "itemKey": "runeOfDarkElixir",
        "amount": 1,
        "icon": "assets/magicItems/runeOfDarkElixir.png",
        "resourceType": "darkElixir"
    },
    {
        "level": 388,
        "type": "ore",
        "amount": 25,
        "icon": "assets/starry_ore.png",
        "resourceType": "starry"
    },
    {
        "level": 392,
        "type": "quest",
        "amount": 1,
        "icon": "assets/equipment/dragon_duke/DD_fire_heart.png",
        "equipmentKey": "fireHeart"
    },
    {
        "level": 393,
        "type": "resource",
        "amount": 15000000,
        "icon": "assets/elixir.png",
        "resourceType": "elixir"
    },
    {
        "level": 400,
        "type": "skin",
        "skinKey": "majesticRoyalChampion",
        "amount": 1,
        "icon": "assets/skins/majesticRoyalChampion.png",
        "hero": "royalChampion"
    },
    {
        "level": 402,
        "type": "magicItem",
        "itemKey": "petPotion",
        "amount": 1,
        "icon": "assets/magicItems/petPotion.png"
    },
    {
        "level": 403,
        "type": "quest",
        "amount": 1,
        "icon": "assets/heroes/emblemRoyalChampion.png",
        "hero": "royalChampion"
    },
    {
        "level": 407,
        "type": "ore",
        "amount": 50,
        "icon": "assets/starry_ore.png",
        "resourceType": "starry"
    },
    {
        "level": 410,
        "type": "quest",
        "amount": 1,
        "icon": "assets/heroes/emblemGrandWarden.png",
        "hero": "grandWarden"
    },
    {
        "level": 412,
        "type": "resource",
        "amount": 350000,
        "icon": "assets/dark_elixir.png",
        "resourceType": "darkElixir"
    },
    {
        "level": 416,
        "type": "magicItem",
        "itemKey": "petPotion",
        "amount": 1,
        "icon": "assets/magicItems/petPotion.png"
    },
    {
        "level": 425,
        "type": "equipment",
        "amount": 1,
        "icon": "assets/heroes/emblemRoyalChampion.png",
        "hero": "royalChampion",
        "fallbackStarry": 50
    },
    {
        "level": 426,
        "type": "magicItem",
        "itemKey": "mightyMorsel",
        "amount": 3,
        "icon": "assets/magicItems/mightyMorsel.png"
    },
    {
        "level": 428,
        "type": "quest",
        "amount": 1,
        "icon": "assets/equipment/royal_champion/RC_electro_boots.png",
        "equipmentKey": "electroBoots"
    },
    {
        "level": 430,
        "type": "resource",
        "amount": 20000000,
        "icon": "assets/elixir.png",
        "resourceType": "elixir"
    },
    {
        "level": 434,
        "type": "magicItem",
        "itemKey": "heroPotion",
        "amount": 2,
        "icon": "assets/magicItems/heroPotion.png"
    },
    {
        "level": 438,
        "type": "quest",
        "amount": 1,
        "icon": "assets/heroes/emblemBarbarianKing.png",
        "hero": "barbarianKing"
    },
    {
        "level": 440,
        "type": "resource",
        "amount": 25000000,
        "icon": "assets/elixir.png",
        "resourceType": "elixir"
    },
    {
        "level": 444,
        "type": "ore",
        "amount": 5000,
        "icon": "assets/shiny_ore.png",
        "resourceType": "shiny"
    },
    {
        "level": 452,
        "type": "equipment",
        "amount": 1,
        "icon": "assets/heroes/emblemBarbarianKing.png",
        "hero": "barbarianKing",
        "fallbackStarry": 50
    },
    {
        "level": 453,
        "type": "magicItem",
        "itemKey": "mightyMorsel",
        "amount": 3,
        "icon": "assets/magicItems/mightyMorsel.png"
    },
    {
        "level": 455,
        "type": "quest",
        "amount": 1,
        "icon": "assets/equipment/barbarian_king/BK_snake_bracelet.png",
        "equipmentKey": "snakeBracelet"
    },
    {
        "level": 457,
        "type": "resource",
        "amount": 400000,
        "icon": "assets/dark_elixir.png",
        "resourceType": "darkElixir"
    },
    {
        "level": 460,
        "type": "quest",
        "amount": 1,
        "icon": "assets/heroes/emblemDragonDuke.png",
        "hero": "dragonDuke"
    },
    {
        "level": 465,
        "type": "ore",
        "amount": 50,
        "icon": "assets/starry_ore.png",
        "resourceType": "starry"
    },
    {
        "level": 470,
        "type": "magicItem",
        "itemKey": "bookOfHeroes",
        "amount": 1,
        "icon": "assets/magicItems/bookOfHeroes.png"
    },
    {
        "level": 480,
        "type": "skin",
        "skinKey": "majesticDragonDuke",
        "amount": 1,
        "icon": "assets/skins/majesticDragonDuke.png",
        "hero": "dragonDuke"
    }
];
