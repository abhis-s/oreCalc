/**
 * Canonical Entity Display Name Resolvers & Metadata.
 * Tier 2: Pure Metadata & String Formatting Utility.
 */

import { equipmentDamageData } from '../data/equipmentDamageData.js';
import { translate } from '../i18n/translator.js';
import { toCamelCase } from './stringUtils.js';

const HERO_NAME_MAP = Object.freeze({
    archerQueen: 'Archer Queen',
    barbarianKing: 'Barbarian King',
    grandWarden: 'Grand Warden',
    royalChampion: 'Royal Champion',
    minionPrince: 'Minion Prince',
    dragonDuke: 'Dragon Duke'
});

/**
 * Resolves localized display name for hero equipment.
 *
 * @param {string} equipKey - Canonical equipment identifier (e.g. 'giant_gauntlet', 'Giant Gauntlet').
 * @returns {string} Localized equipment title.
 */
export function getEquipmentDisplayName(equipKey) {
    if (!equipKey) return '';
    const camel = toCamelCase(equipKey);
    const translated = translate(`entities.equipment.${camel}`);
    if (translated && !translated.startsWith('entities.')) {
        return translated;
    }
    return equipmentDamageData[equipKey]?.name || equipKey;
}

/**
 * Resolves localized display name for heroes.
 *
 * @param {string} heroKey - Canonical hero identifier (e.g. 'barbarian_king', 'Barbarian King').
 * @returns {string} Localized hero title.
 */
export function getHeroDisplayName(heroKey) {
    if (!heroKey) return translate('views.equipment.heroEquipment');
    const camel = toCamelCase(heroKey);
    const translated = translate(`entities.heroes.${camel}`);
    if (translated && !translated.startsWith('entities.')) {
        return translated;
    }
    return HERO_NAME_MAP[camel] || HERO_NAME_MAP[heroKey] || heroKey;
}

/**
 * Resolves localized display name for defenses, structures, and targeted units/heroes.
 *
 * @param {string} defKey - Canonical defense identifier (e.g. 'air_defense', 'archer_queen').
 * @returns {string} Localized target title.
 */
export function getDefenseDisplayName(defKey) {
    if (!defKey) return '';
    const camel = toCamelCase(defKey);
    const defTranslated = translate(`entities.defenses.${camel}`);
    if (defTranslated && !defTranslated.startsWith('entities.')) {
        return defTranslated;
    }
    const heroTranslated = translate(`entities.heroes.${camel}`);
    if (heroTranslated && !heroTranslated.startsWith('entities.')) {
        return heroTranslated;
    }
    return HERO_NAME_MAP[camel] || HERO_NAME_MAP[defKey] || defKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
