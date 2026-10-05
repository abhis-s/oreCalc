/**
 * Player Profile Partition Sanitization and Storage Hygiene Utilities.
 * Tier 2: Pure Storage Sanitizer.
 */

import { formatDisplayTag, normalizePlayerTag } from './storageKeys.js';
import { LAB_SCALING_TROOP_KEYS } from '../data/labTroopsData.js';

/**
 * Strips auto-placed calendar chips (-cal-auto) from planner dates,
 * preserving manual user-placed events and removing empty dates/months.
 *
 * @param {Record<string, Record<string, string[]>>} [dates] - Calendar dates object.
 * @returns {Record<string, Record<string, string[]>>} Sanitized dates object.
 */
export function stripAutoPlacedCalendarChips(dates) {
    if (!dates || typeof dates !== 'object') return {};
    const cleanDates = {};
    for (const monthKey in dates) {
        const monthDays = dates[monthKey];
        if (!monthDays || typeof monthDays !== 'object') continue;
        const cleanDays = {};
        for (const dayKey in monthDays) {
            const chips = monthDays[dayKey];
            if (Array.isArray(chips)) {
                const cleanChips = chips.filter(id => typeof id === 'string' && !id.endsWith('-cal-auto'));
                if (cleanChips.length > 0) {
                    cleanDays[dayKey] = cleanChips;
                }
            }
        }
        if (Object.keys(cleanDays).length > 0) {
            cleanDates[monthKey] = cleanDays;
        }
    }
    return cleanDates;
}

/**
 * Sanitizes and whitelists a playerProfile object, extracting strictly consumed properties
 * and pruning raw Supercell API bloat (achievements, troops array, raw spells array, labels, etc.).
 * Guarantees normalized spells { lightning, earthquake } for Damage Calculator.
 *
 * @param {Record<string, any>} [rawProfile] - Raw API response or partition profile.
 * @returns {Record<string, any> | null} Lean, normalized player profile.
 */
export function sanitizePlayerProfile(rawProfile) {
    if (!rawProfile || typeof rawProfile !== 'object') return null;
    const cleanTag = normalizePlayerTag(rawProfile.tag);
    if (!cleanTag || cleanTag === 'DEFAULT0') return null;

    let spells = null;
    if (rawProfile.spells && typeof rawProfile.spells === 'object' && !Array.isArray(rawProfile.spells)) {
        spells = {
            lightning: Number(rawProfile.spells.lightning) || 1,
            earthquake: Number(rawProfile.spells.earthquake) || 1
        };
    } else if (Array.isArray(rawProfile.spells)) {
        let zapLvl = 1;
        let eqLvl = 1;
        for (const sp of rawProfile.spells) {
            if (!sp || !sp.name) continue;
            const clean = sp.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
            if (clean === 'lightning_spell' || clean === 'lightning') {
                zapLvl = Number(sp.level) || 1;
            } else if (clean === 'earthquake_spell' || clean === 'earthquake') {
                eqLvl = Number(sp.level) || 1;
            }
        }
        spells = { lightning: zapLvl, earthquake: eqLvl };
    }

    const homeHeroes = Array.isArray(rawProfile.heroes)
        ? rawProfile.heroes.filter(h => h && (h.village === 'home' || !h.village))
        : [];
    const ownedHeroes = rawProfile.ownedHeroes && typeof rawProfile.ownedHeroes === 'object'
        ? rawProfile.ownedHeroes
        : Object.fromEntries(homeHeroes.map(h => [h.name, {
            level: h.level,
            maxLevel: h.maxLevel,
            equipment: h.equipment?.map(eq => ({ name: eq.name, level: eq.level })) || []
        }]));

    const homeEquipment = Array.isArray(rawProfile.heroEquipment)
        ? rawProfile.heroEquipment.filter(e => e && (e.village === 'home' || !e.village))
        : [];
    const ownedEquipment = rawProfile.ownedEquipment && typeof rawProfile.ownedEquipment === 'object'
        ? rawProfile.ownedEquipment
        : Object.fromEntries(homeEquipment.map(e => [e.name, e.level]));

    const labTroops = rawProfile.labTroops && typeof rawProfile.labTroops === 'object'
        ? rawProfile.labTroops
        : Object.fromEntries(
            (Array.isArray(rawProfile.troops) ? rawProfile.troops.filter(t => t && t.village === 'home') : [])
                .filter(t => Boolean(LAB_SCALING_TROOP_KEYS[t.name]))
                .map(t => [LAB_SCALING_TROOP_KEYS[t.name], t.level])
        );

    const clan = rawProfile.clan ? {
        tag: rawProfile.clan.tag || '',
        name: rawProfile.clan.name || '',
        badgeUrls: {
            small: rawProfile.clan.badgeUrls?.small || '',
            medium: rawProfile.clan.badgeUrls?.medium || '',
            large: rawProfile.clan.badgeUrls?.large || ''
        }
    } : null;

    const leagueTier = rawProfile.leagueTier ? {
        id: rawProfile.leagueTier.id,
        name: rawProfile.leagueTier.name,
        iconUrls: {
            small: rawProfile.leagueTier.iconUrls?.small || '',
            large: rawProfile.leagueTier.iconUrls?.large || ''
        }
    } : (rawProfile.league ? {
        id: rawProfile.league.id,
        name: rawProfile.league.name,
        iconUrls: {
            small: rawProfile.league.iconUrls?.small || '',
            large: rawProfile.league.iconUrls?.large || ''
        }
    } : null);

    /** @type {Record<string, any>} */
    const cleanProfile = {
        tag: cleanTag,
        name: rawProfile.name || formatDisplayTag(cleanTag),
        townHallLevel: Number(rawProfile.townHallLevel) || 1,
        clanBadgeUrl: rawProfile.clanBadgeUrl || rawProfile.clan?.badgeUrls?.small || '',
        clan,
        role: rawProfile.role || null,
        leagueTier,
        trophies: Number(rawProfile.trophies) || 0,
        warStars: Number(rawProfile.warStars) || 0,
        ownedHeroes,
        ownedEquipment,
        labTroops: labTroops || {},
        spells: spells || { lightning: 1, earthquake: 1 }
    };

    if (rawProfile.clanWarStats) cleanProfile.clanWarStats = rawProfile.clanWarStats;
    if (rawProfile.cwlSeasons) cleanProfile.cwlSeasons = rawProfile.cwlSeasons;
    if (rawProfile.lastCwlFetchTime) cleanProfile.lastCwlFetchTime = rawProfile.lastCwlFetchTime;

    return cleanProfile;
}
