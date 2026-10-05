/**
 * Canonical Spells Data & Spell Capacities.
 * Source: Clash of Clans Wiki (Lightning Spell, Earthquake Spell, Spell Factory, Clan Castle).
 */

export const spellsData = Object.freeze({
    spells: Object.freeze({
        lightning: Object.freeze({
            id: 'lightning',
            name: 'Lightning Spell',
            housingSpace: 1,
            radius: 2.0,
            stunDuration: 0.1,
            immunities: Object.freeze({
                town_hall: true,
                clan_castle: true,
                gold_storage: true,
                elixir_storage: true,
                dark_elixir_storage: true
            }),
            levels: Object.freeze({
                1: Object.freeze({ damage: 150, th: 5 }),
                2: Object.freeze({ damage: 180, th: 5 }),
                3: Object.freeze({ damage: 210, th: 6 }),
                4: Object.freeze({ damage: 240, th: 7 }),
                5: Object.freeze({ damage: 270, th: 8 }),
                6: Object.freeze({ damage: 320, th: 9 }),
                7: Object.freeze({ damage: 400, th: 10 }),
                8: Object.freeze({ damage: 480, th: 11 }),
                9: Object.freeze({ damage: 560, th: 12 }),
                10: Object.freeze({ damage: 600, th: 13 }),
                11: Object.freeze({ damage: 640, th: 14 }),
                12: Object.freeze({ damage: 680, th: 15 }),
                13: Object.freeze({ damage: 720, th: 16 })
            })
        }),
        earthquake: Object.freeze({
            id: 'earthquake',
            name: 'Earthquake Spell',
            housingSpace: 1,
            wallDestructionCount: 4,
            immunities: Object.freeze({
                gold_storage: true,
                elixir_storage: true,
                dark_elixir_storage: true
            }),
            diminishingReturnsDivider: 2,
            levels: Object.freeze({
                1: Object.freeze({ damagePct: 0.145, troopDamagePct: 0, radius: 3.5, th: 8 }),
                2: Object.freeze({ damagePct: 0.170, troopDamagePct: 0, radius: 3.8, th: 8 }),
                3: Object.freeze({ damagePct: 0.210, troopDamagePct: 0, radius: 4.1, th: 9 }),
                4: Object.freeze({ damagePct: 0.250, troopDamagePct: 0, radius: 4.4, th: 10 }),
                5: Object.freeze({ damagePct: 0.290, troopDamagePct: 0, radius: 4.7, th: 11 }),
                6: Object.freeze({ damagePct: 0.290, troopDamagePct: 0.05, radius: 4.7, th: 14 }),
                7: Object.freeze({ damagePct: 0.290, troopDamagePct: 0.10, radius: 4.7, th: 15 }),
                8: Object.freeze({ damagePct: 0.290, troopDamagePct: 0.145, radius: 4.7, th: 16 })
            })
        })
    }),
    spellCapacitiesByTH: Object.freeze({
        1: 0, 2: 0, 3: 0, 4: 0,
        5: 2, 6: 4, 7: 6, 8: 7,
        9: 9, 10: 11, 11: 11, 12: 11,
        13: 11, 14: 11, 15: 11, 16: 11,
        17: 11, 18: 11
    }),
    ccSpellCapacitiesByTH: Object.freeze({
        1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0,
        8: 1, 9: 1, 10: 1, 11: 2, 12: 2, 13: 2,
        14: 3, 15: 3, 16: 3, 17: 3, 18: 4
    })
});
