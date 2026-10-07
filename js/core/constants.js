/**
 * js/core/constants.js
 * Centralized, frozen gameplay constants and application boundaries.
 */

export const MAX_SAVED_PLAYERS = 12;
export const UNRANKED_LEAGUE_ID = 105000000;
export const LEGENDS_LEAGUE_ID = 105000036;

export const FREE_WEEKLY_GLOWY = 10;

export const STORAGE_LIMITS = Object.freeze({
    shiny: 50000,
    glowy: 5000,
    starry: 1000
});

export const STORAGE_STEPS = Object.freeze({
    shiny: 100,
    glowy: 10,
    starry: 1
});

export const MEDAL_STEPS = Object.freeze({
    raidMedals: 50,
    bonusTrackMedals: 40,
    purchasedMedals: 50
});

export const CUSTOM_CHIP_LIMITS = Object.freeze({
    shiny: { max: 25000, maxlength: 5 },
    glowy: { max: 2500, maxlength: 4 },
    starry: { max: 500, maxlength: 3 }
});

export const CALENDAR_SETTINGS_DEFAULTS = Object.freeze({
    firstDayOfWeek: 'auto',
    autoPlaceScope: 'month',
    showChipIcons: true,
    showEquipmentMilestones: true,
    highlightUpgradeRanges: true
});

export const STAR_BONUS_2X_DEFAULTS = Object.freeze({
    frequency: 2,
    duration: 5,
    minFrequency: 1,
    maxFrequency: 4,
    minDuration: 0,
    maxDuration: 7
});

export const LEGACY_PLAYER_PREFIX = 'oreCalc_player_';
export const CANONICAL_PLAYER_PREFIX = 'clashCalc_player_';

export const STORAGE_KEY_MAP = Object.freeze({
    appSettings: Object.freeze({
        canonical: 'clashCalc_appSettings',
        legacy: 'oreCalc_appSettings'
    }),
    playerTags: Object.freeze({
        canonical: 'clashCalc_playerTags',
        legacy: 'oreCalc_playerTags'
    }),
    userId: Object.freeze({
        canonical: 'clashCalc_userId',
        legacy: 'oreCalc_userId'
    }),
    playerPrefix: Object.freeze({
        canonical: CANONICAL_PLAYER_PREFIX,
        legacy: LEGACY_PLAYER_PREFIX
    }),
    domainNoticeDismissed: Object.freeze({
        canonical: 'clashCalc_domainNoticeDismissed',
        legacy: 'oreCalc_domainNoticeDismissed'
    }),
    migratedToClashCalc: Object.freeze({
        canonical: 'clashCalc_migratedToClashCalc',
        legacy: 'oreCalc_migratedToClashCalc'
    }),
    migratedUserId: Object.freeze({
        canonical: 'clashCalc_migratedUserId',
        legacy: 'oreCalc_migratedUserId'
    })
});

export const STORAGE_KEYS = Object.freeze({
    STATE: 'oreCalculatorState',
    APP_VERSION: 'oreCalc_appVersion',
    USER_ID: 'oreCalc_userId',
    PLAYER_PREFIX: 'oreCalc_player_',
    DOMAIN_NOTICE_DISMISSED: 'oreCalc_domainNoticeDismissed',
    MIGRATED_TO_CLASHCALC: 'oreCalc_migratedToClashCalc',
    MIGRATED_USER_ID: 'oreCalc_migratedUserId'
});

export const MOTION_DURATION_INSTANT_MS = 100;
export const MOTION_DURATION_FAST_MS = 150;
export const MOTION_DURATION_EXIT_MS = 180;
export const MOTION_DURATION_BASE_MS = 250;
export const MOTION_DURATION_MODERATE_MS = 300;
export const MOTION_DURATION_SLOW_MS = 400;

export const HEADER_BREAKPOINT_DESKTOP = 780;
export const HEADER_DROPDOWN_COMFORTABLE_WIDTH = 140;
export const HEADER_DROPDOWN_MIN_WIDTH = 76;

export const COMING_SOON_EQUIPMENT_MAPPINGS = Object.freeze([
    Object.freeze({
        heroKeys: Object.freeze(['dragonDuke', 'Dragon Duke']),
        sourceKeys: Object.freeze(['comingSoon', 'Coming Soon']),
        targetName: 'Revenge Deck',
        targetKey: 'revengeDeck'
    })
]);

/**
 * Checks whether an equipment identifier represents placeholder "Coming Soon" equipment.
 * @param {string} equipKey - Equipment key or name to check.
 * @returns {boolean} True if identifier represents coming soon equipment.
 */
export function isComingSoonEquipment(equipKey) {
    if (!equipKey || typeof equipKey !== 'string') return false;
    const normalized = equipKey.trim().toLowerCase().replace(/[\s_-]+/g, '');
    return normalized === 'comingsoon';
}
