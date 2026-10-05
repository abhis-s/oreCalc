import { LEGENDS_LEAGUE_ID } from '../../core/constants.js';
import { formatNumber } from '../../utils/numberFormatter.js';
import { battleModifiersData } from '../../data/battleModifiersData.js';

export const ESPORTS_COMMON_DOWNGRADE = battleModifiersData.leagues.esports.equipLevelLossCommon;
export const ESPORTS_EPIC_DOWNGRADE = battleModifiersData.leagues.esports.equipLevelLossEpic;

export const MODIFIER_HERO_BOOST_MULTIPLIERS = Object.freeze({
    standard: battleModifiersData.leagues.standard.atkHeroMultiplier,
    legend3: battleModifiersData.leagues.legend3.atkHeroMultiplier,
    legend2: battleModifiersData.leagues.legend2.atkHeroMultiplier,
    legend1: battleModifiersData.leagues.legend1.atkHeroMultiplier,
    esports: battleModifiersData.leagues.esports.atkHeroMultiplier
});

/**
 * Resolves the recommended target equipment level for a specific Town Hall.
 *
 * @param {any} recommendation - Equipment recommendation configuration.
 * @param {number} [userTH] - User Town Hall level.
 * @returns {number | null} Recommended level or null.
 */
export function getRecommendedLevelForTownHall(recommendation, userTH) {
    if (!recommendation || !recommendation.recommendedLevels) return null;
    const { default: defaultLevel, byTownHall } = recommendation.recommendedLevels;
    if (!byTownHall) return defaultLevel || null;

    if (userTH) {
        const availableTHs = Object.keys(byTownHall)
            .map(Number)
            .filter(th => !isNaN(th) && th <= userTH)
            .sort((a, b) => b - a);

        if (availableTHs.length > 0) {
            return byTownHall[availableTHs[0]];
        }
    }

    return defaultLevel || null;
}

/**
 * Determines whether a stat definition is affected by league level modifiers (e.g. Hero Boost stat multipliers).
 *
 * @param {any} meta - Stat metadata object.
 * @returns {boolean} Whether stat is modifiable.
 */
export function isStatModifiable(meta) {
    if (!meta) return false;
    if (meta.isModifiable !== undefined) {
        return Boolean(meta.isModifiable);
    }
    return meta.category === 'heroBoost' && [
        'dpsIncrease',
        'damagePerSecondIncrease',
        'damagePerShotIncrease',
        'hitpointIncrease',
        'hpIncrease',
        'maxHealthIncrease',
        'selfHealingPerSecond',
        'healthRecovery'
    ].includes(meta.key);
}

/**
 * Calculates effective equipment level and max levels under active tournament/league modifiers (e.g. Esports level downgrades).
 *
 * @param {number | string} currentLevel - Current equipment level.
 * @param {number} calculatedMaxLevel - Maximum unadjusted equipment level for Town Hall.
 * @param {string} [rarity='Common'] - Equipment rarity ('Common' | 'Epic').
 * @param {string} [modifierKey='standard'] - Active modifier mode ('standard' | 'esports' | 'legend1' | etc.).
 * @returns {import('../../core/types.js').EquipmentModifierResult} Effective level calculations.
 */
export function computeEffectiveLevels(currentLevel, calculatedMaxLevel, rarity = 'Common', modifierKey = 'standard') {
    const isEpic = rarity.toLowerCase() === 'epic';
    const validCurrentLevel = Math.max(1, Math.min(calculatedMaxLevel, Number(currentLevel) || 1));
    const league = battleModifiersData.leagues[modifierKey] || battleModifiersData.leagues.standard;
    const downgrade = isEpic ? (league.equipLevelLossEpic || 0) : (league.equipLevelLossCommon || 0);

    if (downgrade > 0) {
        const esportsMaxLevel = Math.max(1, calculatedMaxLevel - downgrade);
        const effectiveLevel = Math.max(1, Math.min(esportsMaxLevel, validCurrentLevel - downgrade));
        const effectiveMaxLevel = esportsMaxLevel;
        return {
            effectiveLevel,
            effectiveMaxLevel,
            trueMaxLevel: calculatedMaxLevel,
            isDowngraded: true,
            downgrade
        };
    }
    return {
        effectiveLevel: validCurrentLevel,
        effectiveMaxLevel: calculatedMaxLevel,
        trueMaxLevel: calculatedMaxLevel,
        isDowngraded: false,
        downgrade: 0
    };
}

/**
 * Formats a numeric stat delta value with optional signed prefix and units.
 *
 * @param {number} diffVal - Numeric difference value.
 * @param {string} [vUnit] - Value unit descriptor ('seconds' | 'tiles' | 'percentage' | 'percent').
 * @param {Object} [options={}] - Formatting options.
 * @param {string} [options.tilesSuffix='tiles'] - Localized suffix for tiles unit.
 * @returns {string} Formatted difference string.
 */
export function formatDiffVal(diffVal, vUnit, options = {}) {
    if (typeof diffVal !== 'number' || isNaN(diffVal) || diffVal === 0) return '0';
    const isPositive = diffVal > 0;
    const absVal = Math.abs(diffVal);
    let formattedNum = '';

    if (vUnit === 'seconds' || vUnit === 'tiles') {
        const num = Math.round(absVal * 10) / 10;
        const tilesSuffix = options.tilesSuffix ? ` ${options.tilesSuffix}` : ' tiles';
        formattedNum = `${formatNumber(num)}${vUnit === 'seconds' ? 's' : tilesSuffix}`;
    } else if (vUnit === 'percentage' || vUnit === 'percent') {
        const num = Number.isInteger(absVal) ? Math.round(absVal) : (Math.round(absVal * 10) / 10);
        formattedNum = `${formatNumber(num)}%`;
    } else {
        const isInt = Number.isInteger(absVal);
        const num = isInt ? Math.round(absVal) : (Math.round(absVal * 10) / 10);
        formattedNum = formatNumber(num);
    }

    return isPositive ? `+${formattedNum}` : `-${formattedNum}`;
}

/**
 * Resolves the equipment recommendation status and target recommendation level for the current active modifier.
 *
 * @param {any} rec - Equipment recommendation object.
 * @param {string} [modifierKey='standard'] - Active modifier mode key.
 * @param {number} [userTH=16] - User Town Hall level.
 * @param {number} [calculatedMaxLevel=18] - Equipment maximum level.
 * @param {boolean} [isUnreleasedEquipment=false] - Whether equipment is unreleased.
 * @returns {import('../../core/types.js').ModifierRecommendationResult} Resolved recommendation details.
 */
export function resolveModifierRecommendation(rec, modifierKey = 'standard', userTH = 16, calculatedMaxLevel = 18, isUnreleasedEquipment = false) {
    if (isUnreleasedEquipment) {
        return { recStatus: 'unreleased', targetRecLevel: null, isAutoMax: false };
    }
    if (!rec) return { recStatus: null, targetRecLevel: null, isAutoMax: false };

    let effectiveObj = rec;
    if (modifierKey !== 'standard' && rec.modifiers) {
        const modSpecific = rec.modifiers[modifierKey];
        const modDefault = rec.modifiers.default;
        if (modSpecific) {
            effectiveObj = {
                ...rec,
                ...modSpecific
            };
        } else if (modDefault) {
            effectiveObj = {
                ...rec,
                ...modDefault
            };
        }
    }

    const recStatus = (effectiveObj.isUnreleased || isUnreleasedEquipment)
        ? 'unreleased'
        : (effectiveObj.recStatus || (effectiveObj.isRecommended === false ? 'not_recommended' : (effectiveObj.isRecommended === true ? 'recommended' : effectiveObj.status || 'recommended')));

    let targetRecLevel = null;
    let isAutoMax = false;

    if (recStatus === 'unreleased') {
        return { recStatus: 'unreleased', targetRecLevel: null, isAutoMax: false };
    }

    if (modifierKey === 'standard') {
        targetRecLevel = getRecommendedLevelForTownHall(effectiveObj, userTH);
    }

    return {
        recStatus,
        targetRecLevel,
        isAutoMax
    };
}

/**
 * Resolves the default modifier key corresponding to a given League ID or League name.
 *
 * @param {number | string} [leagueId=0] - Numeric or string League ID.
 * @param {string} [leagueName=''] - League name.
 * @returns {string} Modifier mode key ('standard' | 'legend1' | 'legend2' | 'legend3').
 */
export function getDefaultModifierKey(leagueId = 0, leagueName = '') {
    const numericLeagueId = Number(leagueId) || 0;
    const lowerLeagueName = (leagueName || '').toLowerCase();

    if (numericLeagueId === LEGENDS_LEAGUE_ID || (lowerLeagueName.includes('legend i') && !lowerLeagueName.includes('legend ii') && !lowerLeagueName.includes('legend iii'))) {
        return 'legend1';
    }
    if (numericLeagueId === 105000035 || (lowerLeagueName.includes('legend ii') && !lowerLeagueName.includes('legend iii'))) {
        return 'legend2';
    }
    if (numericLeagueId === 105000034 || lowerLeagueName.includes('legend iii')) {
        return 'legend3';
    }

    return 'standard';
}
