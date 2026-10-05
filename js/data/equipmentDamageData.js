/**
 * Canonical Equipment Damaging Abilities Data.
 * Source: Clash of Clans Wiki (Hero Equipment stats for damage-dealing abilities).
 */

export const equipmentDamageData = Object.freeze({
    giant_arrow: Object.freeze({
        id: 'giant_arrow',
        name: 'Giant Arrow',
        hero: 'archerQueen',
        rarity: 'common',
        icon: 'assets/equipment/archer_queen/AQ_giant_arrow.png',
        maxLevel: 18,
        damageType: 'projectile',
        radius: 1.0,
        airDefenseMultiplier: 2.0,
        damageByLevel: Object.freeze({
            1: 750, 2: 750, 3: 850, 4: 850, 5: 850, 6: 1000,
            7: 1000, 8: 1000, 9: 1100, 10: 1100, 11: 1100, 12: 1200,
            13: 1200, 14: 1200, 15: 1350, 16: 1350, 17: 1350, 18: 1500
        })
    }),
    fireball: Object.freeze({
        id: 'fireball',
        name: 'Fireball',
        hero: 'grandWarden',
        rarity: 'epic',
        icon: 'assets/equipment/grand_warden/GW_fireball.png',
        maxLevel: 27,
        damageType: 'projectile',
        damageByLevel: Object.freeze({
            1: 1500, 2: 1500, 3: 1700, 4: 1700, 5: 1800, 6: 1950,
            7: 1950, 8: 2050, 9: 2200, 10: 2200, 11: 2350, 12: 2650,
            13: 2650, 14: 2750, 15: 3100, 16: 3100, 17: 3250, 18: 3400,
            19: 3400, 20: 3500, 21: 3650, 22: 3650, 23: 3750, 24: 3900,
            25: 3900, 26: 3950, 27: 4100
        }),
        radiusByLevel: Object.freeze({
            1: 4.0, 2: 4.0, 3: 4.0, 4: 4.0, 5: 4.0, 6: 4.0, 7: 4.0, 8: 4.0,
            9: 5.0, 10: 5.0, 11: 5.0, 12: 5.0, 13: 5.0, 14: 5.0, 15: 5.0,
            16: 5.0, 17: 5.0, 18: 5.0, 19: 5.0, 20: 5.0, 21: 5.0, 22: 5.0,
            23: 5.0, 24: 6.0, 25: 6.0, 26: 6.0, 27: 6.0
        })
    }),
    spiky_ball: Object.freeze({
        id: 'spiky_ball',
        name: 'Spiky Ball',
        hero: 'barbarianKing',
        rarity: 'epic',
        icon: 'assets/equipment/barbarian_king/BK_spiky_ball.png',
        maxLevel: 27,
        damageType: 'projectile',
        damageByLevel: Object.freeze({
            1: 1000, 2: 1000, 3: 1250, 4: 1250, 5: 1250, 6: 1500,
            7: 1500, 8: 1500, 9: 1750, 10: 1750, 11: 1750, 12: 2000,
            13: 2000, 14: 2000, 15: 2250, 16: 2250, 17: 2250, 18: 2500,
            19: 2500, 20: 2500, 21: 2750, 22: 2750, 23: 2750, 24: 3000,
            25: 3000, 26: 3000, 27: 3250
        }),
        targetsByLevel: Object.freeze({
            1: 2, 2: 2, 3: 3, 4: 3, 5: 3, 6: 4, 7: 4, 8: 4,
            9: 5, 10: 5, 11: 5, 12: 6, 13: 6, 14: 6, 15: 6,
            16: 6, 17: 6, 18: 7, 19: 7, 20: 7, 21: 7, 22: 7,
            23: 7, 24: 7, 25: 7, 26: 7, 27: 8
        })
    }),
    seeking_shield: Object.freeze({
        id: 'seeking_shield',
        name: 'Seeking Shield',
        hero: 'royalChampion',
        rarity: 'common',
        icon: 'assets/equipment/royal_champion/RC_seeking_shield.png',
        maxLevel: 18,
        damageType: 'projectile',
        numberOfTargets: 4,
        damageByLevel: Object.freeze({
            1: 1000, 2: 1000, 3: 1250, 4: 1250, 5: 1250, 6: 1500,
            7: 1500, 8: 1500, 9: 1750, 10: 1750, 11: 1750, 12: 2000,
            13: 2000, 14: 2000, 15: 2250, 16: 2250, 17: 2250, 18: 2500
        })
    }),
    earthquake_boots: Object.freeze({
        id: 'earthquake_boots',
        name: 'Earthquake Boots',
        hero: 'barbarianKing',
        rarity: 'common',
        icon: 'assets/equipment/barbarian_king/BK_earthquake_boots.png',
        maxLevel: 18,
        damageType: 'percentage',
        radius: 8.0,
        wallDamagePct: 1.0,
        troopHeroDamagePct: 0.10,
        targetsAllBuildings: true,
        advancesEarthquakeCounter: true,
        buildingDamagePctByLevel: Object.freeze({
            1: 0.10, 2: 0.10, 3: 0.20, 4: 0.20, 5: 0.20, 6: 0.30,
            7: 0.30, 8: 0.30, 9: 0.34, 10: 0.34, 11: 0.34, 12: 0.36,
            13: 0.36, 14: 0.36, 15: 0.38, 16: 0.38, 17: 0.38, 18: 0.40
        })
    }),
    flame_blower: Object.freeze({
        id: 'flame_blower',
        name: 'Flame Blower',
        hero: 'dragonDuke',
        rarity: 'common',
        icon: 'assets/equipment/dragon_duke/DD_flame_blower.png',
        maxLevel: 18,
        damageType: 'projectile',
        damageByLevel: Object.freeze({
            1: 1300, 2: 1300, 3: 1375, 4: 1375, 5: 1375, 6: 1500,
            7: 1500, 8: 1500, 9: 1750, 10: 1750, 11: 1750, 12: 2000,
            13: 2000, 14: 2000, 15: 2250, 16: 2250, 17: 2250, 18: 2500
        })
    }),
    rocket_backpack: Object.freeze({
        id: 'rocket_backpack',
        name: 'Rocket Backpack',
        hero: 'dragonDuke',
        rarity: 'epic',
        icon: 'assets/equipment/dragon_duke/DD_rocket_backpack.png',
        maxLevel: 27,
        damageType: 'projectile',
        radius: 4.0,
        damageByLevel: Object.freeze({
            1: 575, 2: 575, 3: 750, 4: 750, 5: 750, 6: 950,
            7: 950, 8: 950, 9: 1125, 10: 1125, 11: 1125, 12: 1325,
            13: 1325, 14: 1325, 15: 1500, 16: 1500, 17: 1500, 18: 1700,
            19: 1700, 20: 1700, 21: 1875, 22: 1875, 23: 1875, 24: 2050,
            25: 2050, 26: 2050, 27: 2150
        })
    })
});
