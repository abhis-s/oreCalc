/**
 * Canonical Battle & Difficulty Modifiers Data.
 * Source: Clash of Clans Wiki (Ranked Battles, Esports Mode, Rage Spell, Rage Gem, Rage Spell Tower, Builder's Hut).
 */

export const battleModifiersData = Object.freeze({
    leagues: Object.freeze({
        standard: Object.freeze({
            id: 'standard',
            name: 'Standard (Below Legend)',
            defDpsBonus: 0.0,
            defHeroBonus: 0.0,
            defGuardianBonus: 0.0,
            atkHeroMultiplier: 1.0,
            equipLevelLossCommon: 0,
            equipLevelLossEpic: 0
        }),
        legend3: Object.freeze({
            id: 'legend3',
            name: 'Legend III',
            defDpsBonus: 0.10,
            defHeroBonus: 0.10,
            defGuardianBonus: 0.05,
            atkHeroMultiplier: 0.95,
            equipLevelLossCommon: 0,
            equipLevelLossEpic: 0
        }),
        legend2: Object.freeze({
            id: 'legend2',
            name: 'Legend II',
            defDpsBonus: 0.15,
            defHeroBonus: 0.15,
            defGuardianBonus: 0.10,
            atkHeroMultiplier: 0.90,
            equipLevelLossCommon: 0,
            equipLevelLossEpic: 0
        }),
        legend1: Object.freeze({
            id: 'legend1',
            name: 'Legend I',
            defDpsBonus: 0.20,
            defHeroBonus: 0.20,
            defGuardianBonus: 0.20,
            atkHeroMultiplier: 0.80,
            equipLevelLossCommon: 0,
            equipLevelLossEpic: 0
        }),
        esports: Object.freeze({
            id: 'esports',
            name: 'Esports Mode',
            defDpsBonus: 0.20,
            defHeroBonus: 0.20,
            defGuardianBonus: 0.20,
            atkHeroMultiplier: 0.80,
            equipLevelLossCommon: 3,
            equipLevelLossEpic: 6
        })
    }),
    rageSpell: Object.freeze({
        1: 1.30,
        2: 1.40,
        3: 1.50,
        4: 1.60,
        5: 1.70,
        6: 1.80
    }),
    rageGem: Object.freeze({
        1: 0.15, 2: 0.15,
        3: 0.20, 4: 0.20, 5: 0.20,
        6: 0.25, 7: 0.25, 8: 0.25,
        9: 0.30, 10: 0.30, 11: 0.30,
        12: 0.35, 13: 0.35, 14: 0.35,
        15: 0.45, 16: 0.45, 17: 0.45,
        18: 0.50
    }),
    rageSpellTower: Object.freeze({
        damageMultiplier: 2.00,
        builderRepairMultiplier: 1.60
    }),
    buildersHutRepair: Object.freeze({
        2: 37.5,
        3: 45.0,
        4: 52.5,
        5: 60.0,
        6: 63.75,
        7: 67.5,
        8: 71.25
    })
});
