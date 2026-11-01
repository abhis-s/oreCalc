/**
 * Player Profile Summary Statistics Resolver.
 * Tier 3: Core Service (Player Profile Summary Resolution).
 */

import { UNRANKED_LEAGUE_ID } from './constants.js';
import { state } from './state.js';
import { safeJsonParse } from '../utils/jsonUtils.js';
import { escapeHTML } from '../utils/stringUtils.js';
import { translate } from '../i18n/translator.js';
import { getPlayerStorageKey } from './storageKeys.js';
import { getSavedProfiles } from './playerStorage.js';
import { calculateEquipmentProgress } from '../domain/equipment/equipmentProgressDomain.js';
import { getCumulativeHeroLevel } from '../domain/income/heroJourneyLevels.js';
import { heroJourneyNodes } from '../data/heroJourneyData.js';
import { leagueTiers } from '../data/leagueTiers.js';
import { heroData } from '../data/heroData.js';

/**
 * Resolves normalized, display-ready summary statistics for a given player tag or profile.
 *
 * @param {string} [cleanTag=''] - Raw or normalized player tag.
 * @param {Object} [explicitProfile=null] - Optional override player profile object.
 * @returns {{
 *   rawTag: string,
 *   cleanTag: string,
 *   cleanName: string,
 *   profileName: string,
 *   hasProfile: boolean,
 *   displayTag: string,
 *   thLevel: number,
 *   orePct: number,
 *   oreProgressPct: number,
 *   heroLevel: number | null,
 *   oresDoneText: string,
 *   nextNodeText: string,
 *   finalTrophies: number,
 *   trophies: number,
 *   leagueIcon: string,
 *   leagueAlt: string,
 *   leagueName: string,
 *   clanBadge: string,
 *   clanName: string
 * }}
 */
export function resolvePlayerSummaryStats(cleanTag = '', explicitProfile = null) {
    const rawTag = cleanTag ? cleanTag.replace(/^#+/, '').trim() : '';
    let name = explicitProfile?.name || '';
    let townHallLevel = explicitProfile?.townHallLevel;
    let trophies = typeof explicitProfile?.trophies === 'number'
        ? Math.max(0, explicitProfile.trophies)
        : (explicitProfile?.trophies ? Math.max(0, Number(explicitProfile.trophies) || 0) : null);
    let oreProgressPct = typeof explicitProfile?.oreProgressPct === 'number'
        ? explicitProfile.oreProgressPct
        : (typeof explicitProfile?.progressPct === 'number' ? explicitProfile.progressPct : null);
    let heroLevel = typeof explicitProfile?.heroLevel === 'number'
        ? explicitProfile.heroLevel
        : (explicitProfile?.heroJourney?.cumulativeHeroLevel ?? null);

    let found = null;
    if (rawTag && rawTag !== 'DEFAULT0' && rawTag !== 'GUEST') {
        const savedProfiles = getSavedProfiles();
        found = savedProfiles.find(p => p.cleanTag === rawTag);
        if (found) {
            if (!name) name = found.name;
            if (!townHallLevel) townHallLevel = found.townHallLevel;
            if (trophies === null && found.trophies !== undefined && found.trophies !== null) {
                trophies = Math.max(0, Number(found.trophies) || 0);
            }
            if (heroLevel === null && found.heroJourney?.cumulativeHeroLevel != null) {
                heroLevel = Number(found.heroJourney.cumulativeHeroLevel) || 0;
            }
        }

        const sourceCachedData = explicitProfile?.cachedData || found?.cachedData;
        let ownedEquipment = {};
        let ownedHeroes = {};

        if (sourceCachedData?.ownedEquipment && typeof sourceCachedData.ownedEquipment === 'object' && !Array.isArray(sourceCachedData.ownedEquipment)) {
            ownedEquipment = { ...sourceCachedData.ownedEquipment };
            if (sourceCachedData.ownedHeroes && typeof sourceCachedData.ownedHeroes === 'object' && !Array.isArray(sourceCachedData.ownedHeroes)) {
                ownedHeroes = { ...sourceCachedData.ownedHeroes };
            }
        } else if (Array.isArray(sourceCachedData?.heroEquipment) || Array.isArray(sourceCachedData?.heroes)) {
            if (Array.isArray(sourceCachedData.heroEquipment)) {
                sourceCachedData.heroEquipment.forEach(eq => {
                    if (eq?.name && (!eq.village || eq.village === 'home')) {
                        ownedEquipment[eq.name] = Number(eq.level) || 1;
                    }
                });
            }
            if (Array.isArray(sourceCachedData.heroes)) {
                sourceCachedData.heroes.forEach(h => {
                    if (h?.name && (!h.village || h.village === 'home')) {
                        ownedHeroes[h.name] = h;
                    }
                });
            }
        }

        if (Object.keys(ownedEquipment).length === 0 && rawTag) {
            let partition = state?.allPlayersData?.[rawTag] || state?.allPlayersData?.[cleanTag];
            if (!partition) {
                try {
                    const rawPartition = localStorage.getItem(getPlayerStorageKey(cleanTag));
                    if (rawPartition) partition = safeJsonParse(rawPartition, null);
                } catch {}
            }
            if (partition?.heroes && typeof partition.heroes === 'object') {
                for (const heroKey in heroData) {
                    const hero = heroData[heroKey];
                    const heroState = partition.heroes[heroKey] || partition.heroes[hero.name];
                    if (heroState?.enabled !== false) {
                        const hInfo = { level: heroState?.level || 1, maxLevel: 95 };
                        ownedHeroes[heroKey] = hInfo;
                        ownedHeroes[hero.name] = hInfo;
                        if (heroState?.equipment) {
                            for (const eq of hero.equipment) {
                                const eqState = heroState.equipment[eq.key] || heroState.equipment[eq.name];
                                if (eqState && eqState.checked !== false) {
                                    const lvl = eqState.level || 1;
                                    ownedEquipment[eq.key] = lvl;
                                    ownedEquipment[eq.name] = lvl;
                                }
                            }
                        }
                    }
                }
            } else if (partition?.playerProfile?.ownedEquipment) {
                ownedEquipment = { ...partition.playerProfile.ownedEquipment };
                if (partition.playerProfile.ownedHeroes) {
                    ownedHeroes = { ...partition.playerProfile.ownedHeroes };
                }
            }
        }

        if (oreProgressPct === null && (Object.keys(ownedEquipment).length > 0 || Object.keys(ownedHeroes).length > 0)) {
            try {
                oreProgressPct = calculateEquipmentProgress(ownedEquipment, ownedHeroes).overall;
            } catch (_) {}
        }

        if (heroLevel === null) {
            if (sourceCachedData) {
                try {
                    heroLevel = getCumulativeHeroLevel({ playerProfile: sourceCachedData });
                } catch (_) {}
            }
            if (heroLevel === null && Object.keys(ownedHeroes).length > 0) {
                try {
                    heroLevel = getCumulativeHeroLevel({ playerProfile: { ownedHeroes } });
                } catch (_) {}
            }
        }
    }

    const cleanName = (name === 'DEFAULT0' || name === '#DEFAULT0') ? '' : name;
    const hasProfile = Boolean(cleanName);
    const thLevel = Math.max(1, Math.min(18, Number(townHallLevel) || 18));
    const orePct = typeof oreProgressPct === 'number' ? Math.round(Math.max(0, Math.min(100, oreProgressPct))) : 0;
    const oresDoneText = translate('nav.context.oresDone', { percent: orePct }) || `${orePct}% Ores Done`;

    let nextNodeText = '';
    if (heroLevel === null || heroLevel === undefined) {
        nextNodeText = `TH${thLevel}`;
    } else if (heroLevel >= 480) {
        nextNodeText = translate('views.home.profile.maxed') || 'Maxed';
    } else {
        const nextNode = heroJourneyNodes.find(n => n.level > heroLevel);
        if (!nextNode) {
            nextNodeText = translate('views.home.profile.maxed') || 'Maxed';
        } else {
            const delta = Math.max(0, nextNode.level - heroLevel);
            nextNodeText = translate('nav.context.nextNodeIn', { levels: delta }) || `Next Node in ${delta} lvls`;
        }
    }

    const displayTag = explicitProfile?.tag || (rawTag ? `#${rawTag}` : '');
    const finalTrophies = typeof trophies === 'number' ? trophies : 0;

    const rawLeague = explicitProfile?.leagueTier ||
        explicitProfile?.league ||
        explicitProfile?.cachedData?.leagueTier ||
        explicitProfile?.cachedData?.league ||
        found?.cachedData?.leagueTier ||
        found?.cachedData?.league || null;

    const leagueId = Number(rawLeague?.id);
    const canonicalLeague = leagueTiers.items.find(l => l.id === leagueId);
    const unrankedLeague = leagueTiers.items.find(l => l.id === UNRANKED_LEAGUE_ID) || leagueTiers.items[0];
    const leagueIcon = explicitProfile?.leagueIcon ||
        canonicalLeague?.iconUrls?.small ||
        rawLeague?.iconUrls?.small ||
        rawLeague?.iconUrls?.medium ||
        unrankedLeague?.iconUrls?.small ||
        '';
    const leagueAlt = explicitProfile?.leagueAlt || canonicalLeague?.name || rawLeague?.name || unrankedLeague?.name || 'League Icon';

    let leagueName = explicitProfile?.leagueName || canonicalLeague?.name || rawLeague?.name || '';
    if (!explicitProfile?.leagueName && canonicalLeague) {
        const leagueKey = 'entities.leagues.' + canonicalLeague.name.toLowerCase()
            .replace(/\./g, '')
            .replace(/\s(i+)$/i, (_, p1) => p1.toUpperCase())
            .replace(/\s/g, '_');
        leagueName = translate(leagueKey);
    }
    const leagueNameDisplay = leagueName || translate('entities.leagues.unranked') || 'Unranked';

    const rawClan = explicitProfile?.clan || explicitProfile?.cachedData?.clan || found?.cachedData?.clan;
    const clanBadge = rawClan?.badgeUrls?.small || rawClan?.badgeUrls?.medium || '';
    const clanName = escapeHTML(rawClan?.name || '');

    return {
        rawTag,
        cleanTag: rawTag,
        cleanName,
        profileName: cleanName,
        hasProfile,
        displayTag,
        thLevel,
        orePct,
        oreProgressPct: orePct,
        heroLevel,
        oresDoneText,
        nextNodeText,
        finalTrophies,
        trophies: finalTrophies,
        leagueIcon,
        leagueAlt,
        leagueName: leagueNameDisplay,
        clanBadge,
        clanName
    };
}
