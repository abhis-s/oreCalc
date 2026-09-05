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

export const STORAGE_KEYS = Object.freeze({
    STATE: 'oreCalculatorState',
    APP_VERSION: 'oreCalc_appVersion',
    USER_ID: 'oreCalc_userId',
    PLAYER_PREFIX: 'oreCalc_player_',
    DOMAIN_NOTICE_DISMISSED: 'oreCalc_domainNoticeDismissed'
});

export const MOTION_DURATION_INSTANT_MS = 100;
export const MOTION_DURATION_FAST_MS = 150;
export const MOTION_DURATION_EXIT_MS = 180;
export const MOTION_DURATION_BASE_MS = 250;
export const MOTION_DURATION_MODERATE_MS = 300;
export const MOTION_DURATION_SLOW_MS = 400;
