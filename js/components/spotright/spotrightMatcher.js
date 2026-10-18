/**
 * Spotright High-Performance Scoring & Zero-Allocation Matcher.
 * Tier 4: Search Matcher Engine.
 */

import { loadAndSwitchPlayerTag } from './spotrightClipboard.js';
import { resolveRecentItems } from './spotrightRecents.js';
import { getCurrentRouteContext, isSelfTarget } from './spotrightNavigator.js';
import { translate } from '../../i18n/translator.js';
import { state } from '../../core/state.js';

/**
 * Checks whether subsequence characters appear in target string in order.
 * @param {string} sub
 * @param {string} target
 * @returns {boolean}
 */
export function isSubsequence(sub, target) {
    let subIdx = 0;
    let targetIdx = 0;
    const subLen = sub.length;
    const targetLen = target.length;

    while (subIdx < subLen && targetIdx < targetLen) {
        if (sub.charCodeAt(subIdx) === target.charCodeAt(targetIdx)) subIdx++;
        targetIdx++;
    }
    return subIdx === subLen;
}

/**
 * Scores a single Spotright item against a pre-normalized query string.
 * High scores indicate stronger match relevance. Returns 0 if no match.
 *
 * @param {string} query - Lowercase trimmed query string.
 * @param {import('./spotrightRegistry.js').SpotrightItem} item - Pre-indexed item.
 * @returns {number} Score from 0 to 300+.
 */
export function scoreSpotrightItem(query, item) {
    if (!query) return 0;
    const isLocalParentBoost = Boolean(
        item.type === 'equipment' &&
        Array.isArray(item.parents) &&
        item.parents.includes('damagecalc') &&
        getCurrentRouteContext().page === 'damagecalc'
    );
    const priority = isLocalParentBoost
        ? (item.rarity === 'epic' ? 35 : 32)
        : (item.priorityTier || 0);
    const activeLang = state?.uiSettings?.language || 'en';
    const isNonEnglish = activeLang !== 'en' && activeLang !== 'auto';

    if (item.compositeAcronym && query === item.compositeAcronym) return 240 + priority;
    if (item.compactComposite && query === item.compactComposite) return 230 + priority;

    if (query.includes(' ') && (item.compositeTitle || item.canonicalCompositeTitle)) {
        const tokens = query.split(/\s+/);
        let allTokensMatch = true;
        let hasEquipMatch = false;
        let matchedOnlyCanonical = false;
        for (const token of tokens) {
            if (!token) continue;
            const matchesHero = item.heroAcronym === token || (item.heroName && item.heroName.toLowerCase().includes(token));
            const matchesEquip = item.acronym === token || item.normalizedTitle.includes(token);
            const matchesCanonicalEquip = Boolean(item.canonicalTitle && item.canonicalTitle.includes(token));
            if (matchesEquip) hasEquipMatch = true;
            if (matchesCanonicalEquip) {
                hasEquipMatch = true;
                if (!matchesEquip) matchedOnlyCanonical = true;
            }
            const matchesComp = Boolean(item.compositeTitle && item.compositeTitle.includes(token));
            const matchesCanonComp = Boolean(item.canonicalCompositeTitle && item.canonicalCompositeTitle.includes(token));
            if (matchesCanonComp && !matchesComp) matchedOnlyCanonical = true;

            if (!matchesHero && !matchesEquip && !matchesCanonicalEquip && !matchesComp && !matchesCanonComp) {
                allTokensMatch = false;
                break;
            }
        }
        if (allTokensMatch && hasEquipMatch) {
            return (isNonEnglish && matchedOnlyCanonical ? 165 : 180) + priority;
        }
    }

    // Searches both 'O' and '0' for saved village tags when query contains 'O'
    if (item.isVillage && item.cleanTag) {
        const cleanTagLower = item.cleanTag.toLowerCase();
        const rawTagQuery = query.startsWith('#') ? query.slice(1) : query;
        if (rawTagQuery) {
            const tagQueryWithZero = rawTagQuery.includes('o') ? rawTagQuery.replace(/o/g, '0') : null;
            if (cleanTagLower === rawTagQuery || (tagQueryWithZero && cleanTagLower === tagQueryWithZero)) {
                return 150 + priority;
            }
            if (cleanTagLower.startsWith(rawTagQuery) || (tagQueryWithZero && cleanTagLower.startsWith(tagQueryWithZero))) {
                const matchedLength = tagQueryWithZero && cleanTagLower.startsWith(tagQueryWithZero)
                    ? tagQueryWithZero.length
                    : rawTagQuery.length;
                return 120 + (matchedLength / cleanTagLower.length) * 15 + priority;
            }
            if (rawTagQuery.length >= 2 && (cleanTagLower.includes(rawTagQuery) || (tagQueryWithZero && cleanTagLower.includes(tagQueryWithZero)))) {
                return 55 + priority;
            }
        }
    }

    if ((item.title && item.title.toLowerCase() === query) || item.normalizedTitle === query) {
        return 150 + priority;
    }
    if (item.canonicalTitle && item.canonicalTitle === query) {
        return (isNonEnglish ? 135 : 150) + priority;
    }

    if (item.title && item.title.toLowerCase().startsWith(query)) {
        return 120 + (query.length / item.title.length) * 15 + priority;
    }
    if (item.normalizedTitle && item.normalizedTitle.startsWith(query)) {
        return 120 + (query.length / item.normalizedTitle.length) * 15 + priority;
    }
    if (item.canonicalTitle && item.canonicalTitle.startsWith(query)) {
        return (isNonEnglish ? 105 : 120) + (query.length / item.canonicalTitle.length) * 15 + priority;
    }

    if (item.acronym === query) return 100 + priority;

    if (item.heroAcronym && (query === item.heroAcronym || (item.heroName && item.heroName.toLowerCase().startsWith(query)))) {
        return 65 + priority;
    }

    if (item.normalizedTitle.includes(' ' + query)) return 55 + priority;
    if (item.canonicalTokens && (
        item.canonicalTokens === query ||
        item.canonicalTokens.startsWith(query + ' ') ||
        item.canonicalTokens.includes(' ' + query) ||
        item.canonicalTokens.endsWith(' ' + query)
    )) {
        return (isNonEnglish ? 40 : 55) + priority;
    }
    if (item.canonicalTitle && item.canonicalTitle.includes(' ' + query)) {
        return (isNonEnglish ? 40 : 55) + priority;
    }

    if (item.normalizedTitle.includes(query)) return 40 + priority;
    if ((item.canonicalTitle && item.canonicalTitle.includes(query)) || (item.canonicalTokens && item.canonicalTokens.includes(query))) {
        return (isNonEnglish ? 28 : 40) + priority;
    }

    if (query.length >= 2) {
        if (isSubsequence(query, item.normalizedTitle)) return 20 + priority;
        if (item.canonicalTitle && isSubsequence(query, item.canonicalTitle)) {
            return (isNonEnglish ? 14 : 20) + priority;
        }
    }

    return 0;
}

/**
 * Scope identifier types.
 * @typedef {'all' | 'villages' | 'equipment' | 'hero' | 'tools' | 'settings'} SpotrightScope
 */

/** @type {Record<string, SpotrightScope>} Universal canonical English & single-letter commands */
const CANONICAL_PREFIX_TO_SCOPE = {
    '/v': 'villages', '/village': 'villages', '/villages': 'villages',
    '/e': 'equipment', '/equip': 'equipment', '/equipment': 'equipment',
    '/h': 'hero', '/hero': 'hero', '/heroes': 'hero',
    '/t': 'tools', '/tool': 'tools', '/tools': 'tools',
    '/s': 'settings', '/setting': 'settings', '/settings': 'settings'
};

/**
 * Scope definitions for command suggestions when typing '/'.
 * Follows the exact visual order of filter chips in #spotright-filter-track.
 * @type {Array<{ scope: SpotrightScope, command: string, titleKey: string, icon: string, canonicalAliases: string[], fallbackTitle: string }>}
 */
const SCOPE_DEFINITIONS = [
    { scope: 'villages', command: '/villages', titleKey: 'nav.views.hub.villages', fallbackTitle: 'Saved Villages', icon: 'user', canonicalAliases: ['villages', 'village', 'v'] },
    { scope: 'equipment', command: '/equipment', titleKey: 'nav.equipment', fallbackTitle: 'Equipment', icon: 'equipment-filled', canonicalAliases: ['equipment', 'equip', 'e'] },
    { scope: 'hero', command: '/heroes', titleKey: 'views.damageCalc.filters.filterHeroes', fallbackTitle: 'Heroes', icon: 'shield-filled', canonicalAliases: ['heroes', 'hero', 'h'] },
    { scope: 'tools', command: '/tools', titleKey: 'nav.drawerTitle', fallbackTitle: 'Tabs & Tools', icon: 'sliders', canonicalAliases: ['tools', 'tool', 't'] },
    { scope: 'settings', command: '/settings', titleKey: 'nav.settings', fallbackTitle: 'Settings', icon: 'settings-filled', canonicalAliases: ['settings', 'setting', 's'] }
];

/**
 * Resolves localized scope title with safe canonical fallback.
 * @param {typeof SCOPE_DEFINITIONS[0]} def
 * @returns {string}
 */
function resolveScopeTitle(def) {
    const raw = translate(def.titleKey);
    return (raw && raw !== def.titleKey) ? raw : def.fallbackTitle;
}

/**
 * Builds a scope suggestion item for the Spotright command list.
 * @param {typeof SCOPE_DEFINITIONS[0]} def
 * @param {string} title
 * @param {string} heading
 * @param {number} priorityTier
 * @returns {import('./spotrightRegistry.js').SpotrightItem}
 */
function createScopeSuggestionItem(def, title, heading, priorityTier) {
    return {
        id: `scope-${def.scope}`,
        type: 'scope',
        parent: 'global',
        scopes: [],
        title,
        category: heading,
        command: def.command,
        icon: def.icon,
        iconType: 'svg',
        acronym: def.command.slice(1, 3),
        isScopeSuggestion: true,
        targetScope: def.scope,
        priorityTier,
        normalizedTitle: `${def.command} ${title.toLowerCase()}`,
        execute: () => {}
    };
}

/**
 * Returns scope suggestions matching the current query (e.g. '/' or '/e').
 * Ranks best localized matches so Tab/Space auto-selects the top recommendation.
 *
 * @param {string} rawQuery - Query starting with '/' and without spaces.
 * @returns {import('./spotrightRegistry.js').SpotrightItem[]}
 */
export function getScopeSuggestions(rawQuery) {
    const query = (rawQuery || '').slice(1).trim().toLowerCase();
    const heading = translate('views.spotright.scopesHeading') || 'Filter Scopes';

    if (!query) {
        return SCOPE_DEFINITIONS.map((def, idx) =>
            createScopeSuggestionItem(def, resolveScopeTitle(def), heading, 100 - idx * 5)
        );
    }

    const normalizedQuery = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const results = [];

    for (let idx = 0; idx < SCOPE_DEFINITIONS.length; idx++) {
        const def = SCOPE_DEFINITIONS[idx];
        const title = resolveScopeTitle(def);
        const lowerTitle = title.toLowerCase();
        const normalizedTitle = lowerTitle.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const germanDeUmlautTitle = lowerTitle.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
        const tokens = lowerTitle.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
        const normalizedTokens = normalizedTitle.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
        const germanTokens = germanDeUmlautTitle.split(/[^\p{L}\p{N}]+/u).filter(Boolean);

        const cmd = def.command.slice(1);
        const shortcut = def.canonicalAliases[def.canonicalAliases.length - 1];
        let score = 0;

        if (query === shortcut) score = Math.max(score, 110);
        if (def.canonicalAliases.some(alias => alias === query)) score = Math.max(score, 105);
        if (lowerTitle.startsWith(query) || normalizedTitle.startsWith(normalizedQuery) || germanDeUmlautTitle.startsWith(query)) {
            score = Math.max(score, 100);
        }
        if (cmd.startsWith(query) || def.canonicalAliases.some(alias => alias.startsWith(query))) {
            score = Math.max(score, 95);
        }
        if (tokens.some(t => t.startsWith(query)) || normalizedTokens.some(t => t.startsWith(normalizedQuery)) || germanTokens.some(t => t.startsWith(query))) {
            score = Math.max(score, 90);
        }
        if (query.length >= 3 && (lowerTitle.includes(query) || normalizedTitle.includes(normalizedQuery) || germanDeUmlautTitle.includes(query))) {
            score = Math.max(score, 60);
        }

        if (score > 0) {
            results.push({
                item: createScopeSuggestionItem(def, title, heading, score),
                score: score - idx * 0.01
            });
        }
    }

    results.sort((a, b) => b.score - a.score);
    return results.map(r => r.item);
}

/**
 * Extracts scope prefix command from user input if present.
 * e.g. '/e gauntlet' -> { scope: 'equipment', remainingQuery: 'gauntlet' }
 *
 * @param {string} rawInput
 * @returns {{ scope: SpotrightScope, remainingQuery: string } | null}
 */
export function extractScopePrefix(rawInput) {
    if (!rawInput || !rawInput.startsWith('/')) return null;
    const spaceIndex = rawInput.indexOf(' ');
    if (spaceIndex === -1) return null;

    const prefix = rawInput.slice(0, spaceIndex).toLowerCase();
    const targetScope = CANONICAL_PREFIX_TO_SCOPE[prefix];
    if (!targetScope) return null;

    return {
        scope: targetScope,
        remainingQuery: rawInput.slice(spaceIndex + 1).trimStart()
    };
}

/**
 * Filters the registry items by active route visibility and specified scope.
 * @param {import('./spotrightRegistry.js').SpotrightItem[]} registry
 * @param {SpotrightScope} scope
 * @param {{ page: Exclude<import('./spotrightNavigator.js').SpotrightParent, 'global'>, activeTab: string | null }} routeCtx
 * @returns {import('./spotrightRegistry.js').SpotrightItem[]}
 */
function filterRegistryByScope(registry, scope, routeCtx) {
    if (!Array.isArray(registry)) return [];
    const visible = registry.filter(item => !isSelfTarget(item, routeCtx));
    if (!scope || scope === 'all') return visible;
    return visible.filter(item => Array.isArray(item.scopes) && item.scopes.includes(scope));
}

/**
 * Searches the pre-indexed registry and returns sorted top-K matches with inline autocomplete data.
 *
 * @param {string} rawQuery - Raw input string from search box.
 * @param {import('./spotrightRegistry.js').SpotrightItem[]} registry - Complete indexed items.
 * @param {SpotrightScope} [activeScope='all'] - Active category domain scope filter.
 * @param {number} [limit=7] - Maximum number of results to return.
 * @returns {{
 *   matches: import('./spotrightRegistry.js').SpotrightItem[],
 *   autocomplete: { completionText: string, fullTitle: string } | null
 * }}
 */
export function searchSpotright(rawQuery, registry, activeScope = 'all', limit = 7) {
    let scope = /** @type {SpotrightScope} */ (typeof activeScope === 'string' ? activeScope : 'all');
    const maxLimit = typeof activeScope === 'number' ? activeScope : (typeof limit === 'number' ? limit : 7);

    let query = (rawQuery || '').trim().toLowerCase();

    // Slash command suggestions & isolation: non-command items never appear when input begins with '/'
    if (query.startsWith('/')) {
        return {
            matches: rawQuery.includes(' ') ? [] : getScopeSuggestions(query),
            autocomplete: null
        };
    }

    // Normalize '@' mention prefix directly into the 'villages' scope pipeline
    const isAtMention = query.startsWith('@');
    if (isAtMention) {
        scope = 'villages';
        query = query.slice(1).trim();
    }

    const routeCtx = getCurrentRouteContext();
    const targetItems = filterRegistryByScope(registry, scope, routeCtx);

    if (!query) {
        if (scope === 'all') {
            const visibleRegistry = Array.isArray(registry) ? registry.filter(item => !isSelfTarget(item, routeCtx)) : [];
            const recentItems = resolveRecentItems(visibleRegistry);
            if (recentItems.length > 0) {
                return { matches: recentItems.slice(0, maxLimit), autocomplete: null };
            }
            const defaultTools = targetItems
                .filter(item => Array.isArray(item.scopes) && item.scopes.includes('tools'))
                .slice(0, maxLimit);
            return { matches: defaultTools, autocomplete: null };
        }
        if (scope === 'villages') {
            const sortedVillages = [...targetItems].sort((a, b) => (b.isVillage ? 1 : 0) - (a.isVillage ? 1 : 0));
            return { matches: sortedVillages, autocomplete: null };
        }
        if (scope === 'equipment') {
            if (routeCtx.page === 'damagecalc') {
                const prioritized = [...targetItems].sort((a, b) => {
                    const aOnDamage = a.parents?.includes('damagecalc') ? (a.rarity === 'epic' ? 2 : 1) : 0;
                    const bOnDamage = b.parents?.includes('damagecalc') ? (b.rarity === 'epic' ? 2 : 1) : 0;
                    return bOnDamage - aOnDamage;
                });
                return { matches: prioritized, autocomplete: null };
            }
            return { matches: targetItems, autocomplete: null };
        }
        return { matches: targetItems.slice(0, Math.max(15, maxLimit)), autocomplete: null };
    }

    /** @type {Array<{ item: import('./spotrightRegistry.js').SpotrightItem, score: number }>} */
    const scored = [];
    for (let i = 0; i < targetItems.length; i++) {
        const item = targetItems[i];
        const score = scoreSpotrightItem(query, item);
        if (score > 0) scored.push({ item, score });
    }

    scored.sort((a, b) => b.score - a.score);

    // Demotes active village to rank lowest among matched villages so user switches profiles
    const matchedVillages = scored.filter(entry => entry.item.isVillage);
    if (matchedVillages.length > 1) {
        const activeEntry = matchedVillages.find(entry => entry.item.isActiveVillage);
        if (activeEntry) {
            const inactiveVillages = matchedVillages.filter(entry => !entry.item.isActiveVillage);
            if (inactiveVillages.length > 0) {
                const lowestInactiveScore = Math.min(...inactiveVillages.map(e => e.score));
                activeEntry.score = Math.max(1, lowestInactiveScore - 0.5);
                scored.sort((a, b) => b.score - a.score);
            }
        }
    }

    // Direct Player Tag Synthesis: when query matches a valid Clash of Clans tag pattern
    if (scope === 'all' || scope === 'villages') {
        const cleanTagCandidate = query.startsWith('#') ? query.slice(1).toUpperCase() : query.toUpperCase();
        if (cleanTagCandidate.length >= 3 && cleanTagCandidate.length <= 12 && /^[0289CGJLOPQRUVY]+$/.test(cleanTagCandidate)) {
            const canonicalCandidate = cleanTagCandidate.replace(/O/g, '0');
            const exactSavedVillage = scored.find(entry =>
                entry.item.isVillage && (
                    entry.item.cleanTag === cleanTagCandidate ||
                    entry.item.cleanTag === canonicalCandidate
                )
            );

            if (!exactSavedVillage) {
                /** @type {import('./spotrightRegistry.js').SpotrightItem} */
                const directItem = {
                    id: `action-direct-tag-${cleanTagCandidate}`,
                    type: 'action',
                    scopes: ['villages'],
                    parent: 'global',
                    title: translate('views.spotright.loadVillageTag', { tag: cleanTagCandidate }),
                    normalizedTitle: query,
                    category: translate('player.tag') || 'Player Tag',
                    icon: 'user',
                    iconType: 'svg',
                    acronym: cleanTagCandidate.slice(0, 2).toLowerCase(),
                    priorityTier: 250,
                    isAsyncAction: true,
                    execute: () => loadAndSwitchPlayerTag(cleanTagCandidate)
                };

                const villageEntries = scored.filter(entry => entry.item.isVillage);
                if (villageEntries.length > 0) {
                    const lowestVillageScore = Math.min(...villageEntries.map(e => e.score));
                    scored.push({ item: directItem, score: Math.max(1, lowestVillageScore - 0.5) });
                    scored.sort((a, b) => b.score - a.score);
                } else {
                    scored.unshift({ item: directItem, score: 350 });
                }
            }
        }
    }

    const topMatches = scored.slice(0, maxLimit).map(entry => entry.item);

    let autocomplete = null;
    const topHit = topMatches[0];
    if (!isAtMention && topHit && query.length >= 2 && topHit.title.toLowerCase().startsWith(query)) {
        const nextScore = scored[1]?.score || 0;
        const topScore = scored[0].score;
        if (topScore > nextScore || !scored[1]?.item.title.toLowerCase().startsWith(query)) {
            autocomplete = {
                completionText: topHit.title.slice(query.length),
                fullTitle: topHit.title
            };
        }
    }

    return { matches: topMatches, autocomplete };
}
