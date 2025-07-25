export const heroData = {
    barbarian_king: {
        name: "Barbarian King",
        image: "assets/heroes/barbarian_king.png",
        equipment: [
            { name: "Barbarian Puppet", type: "common", image: "assets/equipment/barbarian_king/BK_barbarian_puppet.png" },
            { name: "Rage Vial", type: "common", image: "assets/equipment/barbarian_king/BK_rage_vial.png" },
            { name: "Earthquake Boots", type: "common", image: "assets/equipment/barbarian_king/BK_earthquake_boots.png" },
            { name: "Vampstache", type: "common", image: "assets/equipment/barbarian_king/BK_vampstache.png" },
            { name: "Giant Gauntlet", type: "epic", image: "assets/equipment/barbarian_king/BK_giant_gauntlet.png" },
            { name: "Spiky Ball", type: "epic", image: "assets/equipment/barbarian_king/BK_spiky_ball.png" },
            { name: "Snake Bracelet", type: "epic", image: "assets/equipment/barbarian_king/BK_snake_bracelet.png" },
        ],
    },
    archer_queen: {
        name: "Archer Queen",
        image: "assets/heroes/archer_queen.png",
        equipment: [
            { name: "Archer Puppet", type: "common", image: "assets/equipment/archer_queen/AQ_archer_puppet.png" },
            { name: "Invisibility Vial", type: "common", image: "assets/equipment/archer_queen/AQ_invisibility_vial.png" },
            { name: "Giant Arrow", type: "common", image: "assets/equipment/archer_queen/AQ_giant_arrow.png" },
            { name: "Healer Puppet", type: "common", image: "assets/equipment/archer_queen/AQ_healer_puppet.png" },
            { name: "Frozen Arrow", type: "epic", image: "assets/equipment/archer_queen/AQ_frozen_arrow.png" },
            { name: "Magic Mirror", type: "epic", image: "assets/equipment/archer_queen/AQ_magic_mirror.png" },
            { name: "Action Figure", type: "epic", image: "assets/equipment/archer_queen/AQ_action_figure.png" },
        ],
    },
    minion_prince: {
        name: "Minion Prince",
        image: "assets/heroes/minion_prince.png",
        equipment: [
            { name: "Henchmen Puppet", type: "common", image: "assets/equipment/minion_prince/MP_henchmen_puppet.png" },
            { name: "Dark Orb", type: "common", image: "assets/equipment/minion_prince/MP_dark_orb.png" },
            { name: "Metal Pants", type: "common", image: "assets/equipment/minion_prince/MP_metal_pants.png" },
            { name: "Noble Iron", type: "common", image: "assets/equipment/minion_prince/MP_noble_iron.png" },
            { name: "Dark Crown", type: "epic", image: "assets/equipment/minion_prince/MP_dark_crown.png" },
        ],
    },
    grand_warden: {
        name: "Grand Warden",
        image: "assets/heroes/grand_warden.png",
        equipment: [
            { name: "Eternal Tome", type: "common", image: "assets/equipment/grand_warden/GW_eternal_tome.png" },
            { name: "Life Gem", type: "common", image: "assets/equipment/grand_warden/GW_life_gem.png" },
            { name: "Rage Gem", type: "common", image: "assets/equipment/grand_warden/GW_rage_gem.png" },
            { name: "Healing Tome", type: "common", image: "assets/equipment/grand_warden/GW_healing_tome.png" },
            { name: "Fireball", type: "epic", image: "assets/equipment/grand_warden/GW_fireball.png" },
            { name: "Lavaloon Puppet", type: "epic", image: "assets/equipment/grand_warden/GW_lavaloon_puppet.png" },
        ],
    },
    royal_champion: {
        name: "Royal Champion",
        image: "assets/heroes/royal_champion.png",
        equipment: [
            { name: "Royal Gem", type: "common", image: "assets/equipment/royal_champion/RC_royal_gem.png" },
            { name: "Seeking Shield", type: "common", image: "assets/equipment/royal_champion/RC_seeking_shield.png" },
            { name: "Hog Rider Puppet", type: "common", image: "assets/equipment/royal_champion/RC_hog_rider_puppet.png" },
            { name: "Haste Vial", type: "common", image: "assets/equipment/royal_champion/RC_haste_vial.png" },
            { name: "Rocket Spear", type: "epic", image: "assets/equipment/royal_champion/RC_rocket_spear.png" },
            { name: "Electro Boots", type: "epic", image: "assets/equipment/royal_champion/RC_electro_boots.png" },
        ],
    },
};

export const upgradeCosts = {
    2: { shiny: 120, glowy: 0, starry: 0 }, 3: { shiny: 240, glowy: 20, starry: 0 },
    4: { shiny: 400, glowy: 0, starry: 0 }, 5: { shiny: 600, glowy: 0, starry: 0 },
    6: { shiny: 840, glowy: 100, starry: 0 }, 7: { shiny: 1120, glowy: 0, starry: 0 },
    8: { shiny: 1440, glowy: 0, starry: 0 }, 9: { shiny: 1800, glowy: 200, starry: 10 },
    10: { shiny: 1900, glowy: 0, starry: 0 }, 11: { shiny: 2000, glowy: 0, starry: 0 },
    12: { shiny: 2100, glowy: 400, starry: 20 }, 13: { shiny: 2200, glowy: 0, starry: 0 },
    14: { shiny: 2300, glowy: 0, starry: 0 }, 15: { shiny: 2400, glowy: 600, starry: 30 },
    16: { shiny: 2500, glowy: 0, starry: 0 }, 17: { shiny: 2600, glowy: 0, starry: 0 },
    18: { shiny: 2700, glowy: 600, starry: 50 }, 19: { shiny: 2800, glowy: 0, starry: 0 },
    20: { shiny: 2900, glowy: 0, starry: 0 }, 21: { shiny: 3000, glowy: 600, starry: 100 },
    22: { shiny: 3100, glowy: 0, starry: 0 }, 23: { shiny: 3200, glowy: 0, starry: 0 },
    24: { shiny: 3300, glowy: 600, starry: 120 }, 25: { shiny: 3400, glowy: 0, starry: 0 },
    26: { shiny: 3500, glowy: 0, starry: 0 }, 27: { shiny: 3600, glowy: 600, starry: 150 },
};