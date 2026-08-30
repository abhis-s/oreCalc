import { deepFreeze } from '../utils/objectUtils.js';

export const heroData = deepFreeze({
    barbarianKing: {
        key: "barbarianKing",
        name: "Barbarian King",
        image: "assets/heroes/barbarianKing.png",
        emblem: "assets/heroes/emblemBarbarianKing.png",
        equipment: [
            { key: "barbarianPuppet", name: "Barbarian Puppet", type: "common", image: "assets/equipment/barbarian_king/BK_barbarian_puppet.png" },
            { key: "rageVial", name: "Rage Vial", type: "common", image: "assets/equipment/barbarian_king/BK_rage_vial.png" },
            { key: "earthquakeBoots", name: "Earthquake Boots", type: "common", image: "assets/equipment/barbarian_king/BK_earthquake_boots.png" },
            { key: "vampstache", name: "Vampstache", type: "common", image: "assets/equipment/barbarian_king/BK_vampstache.png" },
            { key: "giantGauntlet", name: "Giant Gauntlet", type: "epic", image: "assets/equipment/barbarian_king/BK_giant_gauntlet.png", heroJourneyNode: 20, inHeroJourneyPool: true },
            { key: "spikyBall", name: "Spiky Ball", type: "epic", image: "assets/equipment/barbarian_king/BK_spiky_ball.png", heroJourneyNode: 180, inHeroJourneyPool: true },
            { key: "snakeBracelet", name: "Snake Bracelet", type: "epic", image: "assets/equipment/barbarian_king/BK_snake_bracelet.png", heroJourneyNode: 452, inHeroJourneyPool: true },
            { key: "stickHorse", name: "Stick Horse", type: "epic", image: "assets/equipment/barbarian_king/BK_stick_horse.png", inHeroJourneyPool: true },
        ],
    },
    archerQueen: {
        key: "archerQueen",
        name: "Archer Queen",
        image: "assets/heroes/archerQueen.png",
        emblem: "assets/heroes/emblemArcherQueen.png",
        equipment: [
            { key: "archerPuppet", name: "Archer Puppet", type: "common", image: "assets/equipment/archer_queen/AQ_archer_puppet.png" },
            { key: "invisibilityVial", name: "Invisibility Vial", type: "common", image: "assets/equipment/archer_queen/AQ_invisibility_vial.png" },
            { key: "giantArrow", name: "Giant Arrow", type: "common", image: "assets/equipment/archer_queen/AQ_giant_arrow.png" },
            { key: "healerPuppet", name: "Healer Puppet", type: "common", image: "assets/equipment/archer_queen/AQ_healer_puppet.png" },
            { key: "frozenArrow", name: "Frozen Arrow", type: "epic", image: "assets/equipment/archer_queen/AQ_frozen_arrow.png", heroJourneyNode: 50, inHeroJourneyPool: true },
            { key: "magicMirror", name: "Magic Mirror", type: "epic", image: "assets/equipment/archer_queen/AQ_magic_mirror.png", heroJourneyNode: 203, inHeroJourneyPool: true },
            { key: "actionFigure", name: "Action Figure", type: "epic", image: "assets/equipment/archer_queen/AQ_action_figure.png", inHeroJourneyPool: true },
            { key: "monolithArrow", name: "Monolith Arrow", type: "epic", image: "assets/equipment/archer_queen/AQ_monolith_arrow.png", inHeroJourneyPool: false },
        ],
    },
    minionPrince: {
        key: "minionPrince",
        name: "Minion Prince",
        image: "assets/heroes/minionPrince.png",
        emblem: "assets/heroes/emblemMinionPrince.png",
        equipment: [
            { key: "henchmenPuppet", name: "Henchmen Puppet", type: "common", image: "assets/equipment/minion_prince/MP_henchmen_puppet.png" },
            { key: "darkOrb", name: "Dark Orb", type: "common", image: "assets/equipment/minion_prince/MP_dark_orb.png" },
            { key: "metalPants", name: "Metal Pants", type: "common", image: "assets/equipment/minion_prince/MP_metal_pants.png" },
            { key: "nobleIron", name: "Noble Iron", type: "common", image: "assets/equipment/minion_prince/MP_noble_iron.png" },
            { key: "darkCrown", name: "Dark Crown", type: "epic", image: "assets/equipment/minion_prince/MP_dark_crown.png", heroJourneyNode: 99, inHeroJourneyPool: true },
            { key: "meteorStaff", name: "Meteor Staff", type: "epic", image: "assets/equipment/minion_prince/MP_meteor_staff.png", heroJourneyNode: 302, inHeroJourneyPool: true },
        ],
    },
    grandWarden: {
        key: "grandWarden",
        name: "Grand Warden",
        image: "assets/heroes/grandWarden.png",
        emblem: "assets/heroes/emblemGrandWarden.png",
        equipment: [
            { key: "eternalTome", name: "Eternal Tome", type: "common", image: "assets/equipment/grand_warden/GW_eternal_tome.png" },
            { key: "lifeGem", name: "Life Gem", type: "common", image: "assets/equipment/grand_warden/GW_life_gem.png" },
            { key: "rageGem", name: "Rage Gem", type: "common", image: "assets/equipment/grand_warden/GW_rage_gem.png" },
            { key: "healingTome", name: "Healing Tome", type: "common", image: "assets/equipment/grand_warden/GW_healing_tome.png" },
            { key: "fireball", name: "Fireball", type: "epic", image: "assets/equipment/grand_warden/GW_fireball.png", heroJourneyNode: 150, inHeroJourneyPool: true },
            { key: "lavaloonPuppet", name: "Lavaloon Puppet", type: "epic", image: "assets/equipment/grand_warden/GW_lavaloon_puppet.png", heroJourneyNode: 354, inHeroJourneyPool: true },
            { key: "heroicTorch", name: "Heroic Torch", type: "epic", image: "assets/equipment/grand_warden/GW_heroic_torch.png", inHeroJourneyPool: true },
        ],
    },
    royalChampion: {
        key: "royalChampion",
        name: "Royal Champion",
        image: "assets/heroes/royalChampion.png",
        emblem: "assets/heroes/emblemRoyalChampion.png",
        equipment: [
            { key: "royalGem", name: "Royal Gem", type: "common", image: "assets/equipment/royal_champion/RC_royal_gem.png" },
            { key: "seekingShield", name: "Seeking Shield", type: "common", image: "assets/equipment/royal_champion/RC_seeking_shield.png" },
            { key: "hogRiderPuppet", name: "Hog Rider Puppet", type: "common", image: "assets/equipment/royal_champion/RC_hog_rider_puppet.png" },
            { key: "hasteVial", name: "Haste Vial", type: "common", image: "assets/equipment/royal_champion/RC_haste_vial.png" },
            { key: "rocketSpear", name: "Rocket Spear", type: "epic", image: "assets/equipment/royal_champion/RC_rocket_spear.png", heroJourneyNode: 250, inHeroJourneyPool: true },
            { key: "electroBoots", name: "Electro Boots", type: "epic", image: "assets/equipment/royal_champion/RC_electro_boots.png", heroJourneyNode: 425, inHeroJourneyPool: true },
            { key: "frostFlake", name: "Frost Flake", type: "epic", image: "assets/equipment/royal_champion/RC_frost_flake.png", inHeroJourneyPool: true },
        ],
    },
    dragonDuke: {
        key: "dragonDuke",
        name: "Dragon Duke",
        image: "assets/heroes/dragonDuke.png",
        emblem: "assets/heroes/emblemDragonDuke.png",
        equipment: [
            { key: "fireHeart", name: "Fire Heart", type: "common", image: "assets/equipment/dragon_duke/DD_fire_heart.png" },
            { key: "flameBlower", name: "Flame Blower", type: "common", image: "assets/equipment/dragon_duke/DD_flame_blower.png" },
            { key: "stunBlaster", name: "Stun Blaster", type: "common", image: "assets/equipment/dragon_duke/DD_stun_blaster.png" },
            { key: "electroFangs", name: "Electro Fangs", type: "common", image: "assets/equipment/dragon_duke/DD_electro_fangs.png" },
            { key: "rocketBackpack", name: "Rocket Backpack", type: "epic", image: "assets/equipment/dragon_duke/DD_rocket_backpack.png", heroJourneyNode: 373, inHeroJourneyPool: true },
            { key: "revengeDeck", name: "Revenge Deck", type: "epic", image: "assets/equipment/dragon_duke/DD_revenge_deck.png", inHeroJourneyPool: false },
        ],
    },
});

/**
 * Returns the pool of epic equipment (name and image icon) for a given hero key derived directly from heroData.
 */
export function getHeroEpicEquipmentPool(heroKey) {
    const hero = heroData[heroKey];
    if (!hero || !hero.equipment) return [];

    return hero.equipment
        .filter(eq => eq.type === 'epic' && eq.inHeroJourneyPool === true && eq.key !== 'comingSoon' && eq.name !== 'Coming Soon')
        .map(eq => ({
            key: eq.key,
            name: eq.name,
            icon: eq.image,
            heroJourneyNode: eq.heroJourneyNode || null
        }));
}
