/**
 * Pure domain logic and lifecycle management for Custom "Coming Soon" Equipment.
 * Tier 2: Domain Logic (Zero DOM dependencies, zero side effects).
 */

import { isComingSoonEquipment } from '../../core/constants.js';
import { CRAFT_PASS_PRELEVEL } from '../../data/incomeSources/craftPass.js';
import { heroData } from '../../data/heroData.js';
import { toCamelCase } from '../../utils/stringUtils.js';

export const COMING_SOON_KEY = 'comingSoon';
const COMING_SOON_DISPLAY_NAME = 'Coming Soon';
const COMING_SOON_IMAGE = 'assets/equipment/equip_placeholder.png';

/**
 * Checks whether an official Coming Soon equipment is already declared in heroData.
 *
 * @returns {boolean}
 */
export function isOfficialComingSoonDefined() {
    return Object.values(heroData).some(hero =>
        hero.equipment?.some(e => isComingSoonEquipment(e.key || e.name))
    );
}

/**
 * Checks whether any hero across the entire heroes state has a custom Coming Soon equipment item.
 *
 * @param {Record<string, import('../../core/types.js').HeroItem> | null | undefined} heroesState
 * @returns {boolean}
 */
export function hasAnyCustomComingSoonEquipment(heroesState) {
    if (!heroesState || typeof heroesState !== 'object') return false;
    return Object.values(heroesState).some(hero => hasComingSoonEquipment(hero));
}

/**
 * Retrieves the active custom Coming Soon equipment info and hero key if one exists globally.
 *
 * @param {Record<string, import('../../core/types.js').HeroItem> | null | undefined} heroesState
 * @returns {{ heroKey: string, heroName: string, item: NonNullable<ReturnType<typeof getComingSoonEquipment>> } | null}
 */
export function getActiveCustomComingSoon(heroesState) {
    if (!heroesState || typeof heroesState !== 'object') return null;
    for (const heroKey of Object.keys(heroesState)) {
        const item = getComingSoonEquipment(heroesState[heroKey]);
        if (item) {
            const heroObj = heroData[heroKey] || Object.values(heroData).find(h => h.name === heroKey || h.key === heroKey);
            return {
                heroKey,
                heroName: heroObj?.name || heroKey,
                item
            };
        }
    }
    return null;
}

/**
 * Checks whether the given hero state contains an active Coming Soon equipment item.
 *
 * @param {import('../../core/types.js').HeroItem | null | undefined} heroState
 * @returns {boolean}
 */
export function hasComingSoonEquipment(heroState) {
    if (!heroState?.equipment || typeof heroState.equipment !== 'object') return false;
    return Object.keys(heroState.equipment).some(isComingSoonEquipment);
}

/**
 * Retrieves the Coming Soon equipment item from hero state or direct equipment state, if present.
 *
 * @param {import('../../core/types.js').HeroItem | { type?: import('../../core/types.js').EquipmentRarity, level?: number, checked?: boolean, isCustom?: boolean } | null | undefined} heroOrEquipState
 * @returns {{ key: string, name: string, level: number, checked: boolean, type: import('../../core/types.js').EquipmentRarity, isCustom: boolean } | null}
 */
export function getComingSoonEquipment(heroOrEquipState) {
    if (!heroOrEquipState || typeof heroOrEquipState !== 'object') return null;
    if ('equipment' in heroOrEquipState && typeof heroOrEquipState.equipment === 'object' && heroOrEquipState.equipment) {
        for (const key of Object.keys(heroOrEquipState.equipment)) {
            if (isComingSoonEquipment(key)) {
                const equip = heroOrEquipState.equipment[key];
                if (!equip) continue;
                const rawType = (equip.type || '').toLowerCase();
                const resolvedType = (rawType === 'common' || rawType === 'legendary') ? rawType : 'epic';
                return {
                    key: COMING_SOON_KEY,
                    name: COMING_SOON_DISPLAY_NAME,
                    level: Number(equip.level) || 1,
                    checked: equip.checked !== false,
                    type: resolvedType,
                    isCustom: Boolean(equip.isCustom ?? true)
                };
            }
        }
        return null;
    }
    if ('type' in heroOrEquipState && heroOrEquipState.type) {
        const rawType = (heroOrEquipState.type || '').toLowerCase();
        const resolvedType = (rawType === 'common' || rawType === 'legendary') ? rawType : 'epic';
        return {
            key: COMING_SOON_KEY,
            name: COMING_SOON_DISPLAY_NAME,
            level: Number(heroOrEquipState.level) || 1,
            checked: heroOrEquipState.checked !== false,
            type: resolvedType,
            isCustom: Boolean(heroOrEquipState.isCustom ?? true)
        };
    }
    return null;
}

/**
 * Deletes any custom Coming Soon equipment keys from the provided hero state.
 *
 * @param {import('../../core/types.js').HeroItem | null | undefined} heroState
 */
export function deleteComingSoonEquipment(heroState) {
    if (!heroState?.equipment || typeof heroState.equipment !== 'object') return;
    for (const key of Object.keys(heroState.equipment)) {
        if (isComingSoonEquipment(key)) {
            delete heroState.equipment[key];
        }
    }
}

/**
 * Checks whether the user is eligible to add a custom Coming Soon equipment item (strictly max 1 globally).
 *
 * @param {Record<string, import('../../core/types.js').HeroItem> | import('../../core/types.js').HeroItem | null | undefined} heroesStateOrHero
 * @param {string | null} [heroKey=null]
 * @returns {boolean}
 */
export function canAddComingSoonEquipment(heroesStateOrHero, heroKey = null) {
    if (isOfficialComingSoonDefined()) return false;
    if (!heroesStateOrHero || typeof heroesStateOrHero !== 'object') return false;
    if ('equipment' in heroesStateOrHero && typeof heroesStateOrHero.equipment === 'object') {
        return !hasComingSoonEquipment(/** @type {import('../../core/types.js').HeroItem} */ (heroesStateOrHero));
    }
    if (hasAnyCustomComingSoonEquipment(/** @type {Record<string, import('../../core/types.js').HeroItem>} */ (heroesStateOrHero))) return false;
    return true;
}

/**
 * Creates a normalized Custom Coming Soon equipment item descriptor.
 * Pure factory with zero side effects.
 *
 * @param {'common' | 'epic' | 'legendary'} [rarity='epic'] - Equipment rarity.
 * @param {boolean} [isCraftPassBought=false] - Whether Craft Pass is active.
 * @returns {{ level: number, checked: boolean, type: import('../../core/types.js').EquipmentRarity, isCustom: boolean }}
 */
export function createComingSoonEquipmentItem(rarity = 'epic', isCraftPassBought = false) {
    const r = (rarity || '').toLowerCase();
    const validatedRarity = (r === 'common' || r === 'legendary') ? r : 'epic';
    const initialLevel = (validatedRarity === 'legendary' && isCraftPassBought) ? CRAFT_PASS_PRELEVEL : 1;
    return {
        level: initialLevel,
        checked: true,
        type: validatedRarity,
        isCustom: true
    };
}

/**
 * Returns the unified equipment list for a given hero definition, appending active dynamic
 * custom/coming-soon equipment if present in hero state.
 *
 * @param {{ name: string, equipment?: Array<{ key?: string, name: string, type: string, costSchedule?: string, image?: string, isUnreleased?: boolean }> } | null | undefined} heroDef
 * @param {import('../../core/types.js').HeroItem | { type?: import('../../core/types.js').EquipmentRarity, level?: number, checked?: boolean, isCustom?: boolean } | null | undefined} [heroOrEquipState=null]
 * @returns {Array<{ name: string, key: string, type: import('../../core/types.js').EquipmentRarity, costSchedule?: import('../../core/types.js').CostSchedule, image: string, isCustom: boolean, isUnreleased: boolean }>}
 */
export function getHeroEquipmentList(heroDef, heroOrEquipState = null) {
    if (!heroDef) return [];
    const baseEquipment = (heroDef.equipment || []).map(equip => ({
        name: equip.name,
        key: equip.key || toCamelCase(equip.name || ''),
        type: /** @type {import('../../core/types.js').EquipmentRarity} */ (equip.type || 'common'),
        costSchedule: /** @type {import('../../core/types.js').CostSchedule | undefined} */ (equip.costSchedule === 'modern' ? 'modern' : (equip.costSchedule === 'classic' ? 'classic' : undefined)),
        image: equip.image || '',
        isCustom: false,
        isUnreleased: Boolean(equip.isUnreleased)
    }));

    const csItem = getComingSoonEquipment(heroOrEquipState);
    if (csItem) {
        baseEquipment.push({
            name: COMING_SOON_DISPLAY_NAME,
            key: COMING_SOON_KEY,
            type: csItem.type,
            costSchedule: csItem.type === 'legendary' ? 'modern' : 'classic',
            image: COMING_SOON_IMAGE,
            isCustom: true,
            isUnreleased: false
        });
    }

    return baseEquipment;
}

/**
 * Finds an equipment item from a hero definition and state matching an identifier (key, name, or camelCase).
 *
 * @param {{ name: string, equipment?: Array<{ key?: string, name: string, type: string, costSchedule?: string, image?: string }> } | null | undefined} heroDef
 * @param {string | null | undefined} equipNameOrKey
 * @param {import('../../core/types.js').HeroItem | { type?: import('../../core/types.js').EquipmentRarity, level?: number, checked?: boolean, isCustom?: boolean } | null | undefined} [heroOrEquipState=null]
 * @returns {{ name: string, key: string, type: import('../../core/types.js').EquipmentRarity, costSchedule?: import('../../core/types.js').CostSchedule, image: string, isCustom: boolean } | null}
 */
export function findHeroEquipment(heroDef, equipNameOrKey, heroOrEquipState = null) {
    if (!heroDef || !equipNameOrKey) return null;
    const list = getHeroEquipmentList(heroDef, heroOrEquipState);
    const target = equipNameOrKey.trim();
    const targetCamel = toCamelCase(target);

    return list.find(e =>
        e.key === target ||
        e.name === target ||
        toCamelCase(e.name) === targetCamel ||
        toCamelCase(e.key) === targetCamel ||
        (isComingSoonEquipment(target) && e.key === COMING_SOON_KEY)
    ) || null;
}

/**
 * Resolves the equipment rarity/type ('common' | 'epic' | 'legendary') for an equipment item.
 *
 * @param {{ name: string, equipment?: Array<{ key?: string, name: string, type: string, costSchedule?: string, image?: string }> } | null | undefined} heroDef
 * @param {string | null | undefined} equipNameOrKey
 * @param {import('../../core/types.js').HeroItem | { type?: import('../../core/types.js').EquipmentRarity, level?: number, checked?: boolean, isCustom?: boolean } | null | undefined} [heroOrEquipState=null]
 * @returns {import('../../core/types.js').EquipmentRarity}
 */
export function resolveEquipmentType(heroDef, equipNameOrKey, heroOrEquipState = null) {
    const item = findHeroEquipment(heroDef, equipNameOrKey, heroOrEquipState);
    return item?.type || 'epic';
}
