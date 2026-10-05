import { deepFreeze } from '../../utils/objectUtils.js';

export const SHOP_OFFER_ORDER = deepFreeze({
    'shiny_large': 1,
    'starry': 2,
    'glowy': 3,
    'shiny_small': 4,
    'shiny': 4
});

export const shopOfferData = deepFreeze({
    "0": { shiny: 0, glowy: 0, starry: 0, townHallLevel: 0 },
    "newSet": {
        name: "New Set",
        shiny_large: {
            shiny: 15000,
            glowy: 0,
            starry: 0,
            priceTier: 'tier10',
            maxPacks: 2,
        },
        glowy: {
            shiny: 0,
            glowy: 900,
            starry: 0,
            priceTier: 'tier5',
            maxPacks: 2,
        },
        starry: {
            shiny: 0,
            glowy: 0,
            starry: 90,
            priceTier: 'tier5',
            maxPacks: 2,
        },
        shiny_small: {
            shiny: 7500,
            glowy: 0,
            starry: 0,
            priceTier: 'tier5',
            maxPacks: 2,
        },
    },
    "16": {
        disabled: true,
        townHallLevel: 16,
        shiny_large: {
            shiny: 12000,
            glowy: 0,
            starry: 0,
            priceTier: 'tier10',
            maxPacks: 2,
        },
        glowy: {
            shiny: 0,
            glowy: 750,
            starry: 0,
            priceTier: 'tier7',
            maxPacks: 2,
        },
        starry: {
            shiny: 0,
            glowy: 0,
            starry: 75,
            priceTier: 'tier7',
            maxPacks: 2,
        },
        shiny_small: {
            shiny: 6000,
            glowy: 0,
            starry: 0,
            priceTier: 'tier7',
            maxPacks: 2,
        },
    },
    "14": {
        disabled: true,
        townHallLevel: 14,
        shiny_large: {
            shiny: 12000,
            glowy: 0,
            starry: 0,
            priceTier: 'tier10',
            maxPacks: 2,
        },
        glowy: {
            shiny: 0,
            glowy: 630,
            starry: 0,
            priceTier: 'tier6',
            maxPacks: 2,
        },
        starry: {
            shiny: 0,
            glowy: 0,
            starry: 65,
            priceTier: 'tier6',
            maxPacks: 2,
        },
        shiny_small: {
            shiny: 5000,
            glowy: 0,
            starry: 0,
            priceTier: 'tier6',
            maxPacks: 2,
        },
    },
    "11": {
        disabled: true,
        townHallLevel: 11,
        shiny_large: {
            shiny: 12000,
            glowy: 0,
            starry: 0,
            priceTier: 'tier10',
            maxPacks: 2,
        },
        glowy: {
            shiny: 0,
            glowy: 500,
            starry: 0,
            priceTier: 'tier5',
            maxPacks: 2,
        },
        starry: {
            shiny: 0,
            glowy: 0,
            starry: 55,
            priceTier: 'tier5',
            maxPacks: 2,
        },
        shiny_small: {
            shiny: 4000,
            glowy: 0,
            starry: 0,
            priceTier: 'tier5',
            maxPacks: 2,
        },
    },
    "8": {
        disabled: true,
        townHallLevel: 8,
        glowy: {
            shiny: 0,
            glowy: 400,
            starry: 0,
            priceTier: 'tier4',
            maxPacks: 2,
        },
        starry: {
            shiny: 0,
            glowy: 0,
            starry: 40,
            priceTier: 'tier4',
            maxPacks: 2,
        },
        shiny_small: {
            shiny: 3000,
            glowy: 0,
            starry: 0,
            priceTier: 'tier4',
            maxPacks: 2,
        },
    },
});

/**
 * Resolves the best matching Shop Offer set key.
 * Priority:
 * 1. If 'newSet' exists and is not disabled in shopOfferData, return 'newSet'.
 * 2. If any set named 'New Set' exists and is not disabled, return its key.
 * 3. If any active (non-disabled) Town Hall set exists <= thLevel, return the closest matching TH set.
 * 4. Otherwise, return '0' (None).
 *
 * @param {number} [thLevel] - Player's Town Hall level.
 * @returns {string} Resolved set key ('newSet', TH key, or '0').
 */
export function resolveBestMatchShopOfferSet(thLevel) {
    if (shopOfferData['newSet'] && !shopOfferData['newSet'].disabled) {
        return 'newSet';
    }
    for (const key in shopOfferData) {
        const set = shopOfferData[key];
        if (set && !set.disabled && (set.name === 'New Set' || key.toLowerCase() === 'newset')) {
            return key;
        }
    }

    if (thLevel !== undefined && thLevel !== null) {
        let closestTh = -1;
        let bestThSet = null;
        for (const setKey in shopOfferData) {
            const set = shopOfferData[setKey];
            if (set && !set.disabled && typeof set.townHallLevel === 'number' && set.townHallLevel > 0) {
                if (set.townHallLevel <= thLevel && set.townHallLevel > closestTh) {
                    closestTh = set.townHallLevel;
                    bestThSet = setKey;
                }
            }
        }
        if (bestThSet) return bestThSet;
    }

    return '0';
}
