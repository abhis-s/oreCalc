import { isComingSoonEquipment } from '../../core/constants.js';
import { CRAFT_PASS_PRELEVEL } from '../../data/incomeSources/craftPass.js';
import { isEquipmentServerUnowned } from '../income/heroJourneyResolution.js';
import { toCamelCase } from '../../utils/stringUtils.js';

/**
 * Checks whether an equipment item qualifies for Craft Pass Level 15 pre-leveling.
 *
 * @param {string} equipKeyOrName - Equipment identifier.
 * @param {string} rarity - Equipment rarity.
 * @param {import('../../core/types.js').AppState | any} [state=null] - Global state for ownership check.
 * @param {number} [currentYear=new Date().getFullYear()] - Year check (Blizzard Axe exception active in < 2027).
 * @returns {boolean}
 */
export function isEligibleForCraftPassPrelevel(equipKeyOrName, rarity, state = null, currentYear = new Date().getFullYear()) {
    if (!equipKeyOrName) return false;
    const isUnowned = isEquipmentServerUnowned(equipKeyOrName, state);
    if (!isUnowned) return false;

    const key = toCamelCase(equipKeyOrName.trim());
    const r = (rarity || '').toLowerCase();

    // 1. Blizzard Axe exception valid strictly while currentYear < 2027
    if ((key === 'blizzardAxe' || equipKeyOrName === 'Blizzard Axe') && currentYear < 2027) {
        return true;
    }

    // 2. Custom Coming Soon Equipment with Legendary rarity
    if (isComingSoonEquipment(equipKeyOrName) && r === 'legendary') {
        return true;
    }

    return false;
}

/**
 * Synchronizes pre-leveled levels across eligible unowned equipment based on Craft Pass purchase state.
 *
 * @param {Record<string, any>} heroesState - Heroes dictionary in state.
 * @param {boolean} isCraftPassBought - Whether Craft Pass is active.
 * @param {any} [appState=null] - Full application state.
 * @param {number} [currentYear=new Date().getFullYear()] - Year check.
 */
export function syncCraftPassPreleveling(heroesState, isCraftPassBought, appState = null, currentYear = new Date().getFullYear()) {
    if (!heroesState || typeof heroesState !== 'object') return;
    const targetLevel = isCraftPassBought ? CRAFT_PASS_PRELEVEL : 1;

    // Check Barbarian King Blizzard Axe
    const bk = heroesState.barbarianKing || heroesState['Barbarian King'];
    if (bk?.equipment) {
        const axe = bk.equipment.blizzardAxe || bk.equipment['Blizzard Axe'];
        if (axe && isEligibleForCraftPassPrelevel('blizzardAxe', 'legendary', appState, currentYear)) {
            axe.level = targetLevel;
        }
    }

    // Check custom coming soon items across all heroes
    for (const hKey of Object.keys(heroesState)) {
        const hero = heroesState[hKey];
        if (!hero?.equipment) continue;
        for (const eqKey of Object.keys(hero.equipment)) {
            if (isComingSoonEquipment(eqKey)) {
                const item = hero.equipment[eqKey];
                if (item && item.type === 'legendary' && isEligibleForCraftPassPrelevel(eqKey, 'legendary', appState, currentYear)) {
                    item.level = targetLevel;
                }
            }
        }
    }
}
