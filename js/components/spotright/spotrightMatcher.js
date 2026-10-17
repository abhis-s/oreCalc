/**
 * Spotright High-Performance Scoring & Zero-Allocation Matcher.
 * Tier 4: Search Matcher Engine.
 */

import { loadAndSwitchPlayerTag } from './spotrightClipboard.js';
import { resolveRecentItems } from './spotrightRecents.js';
import { translate } from '../../i18n/translator.js';
import { state } from '../../core/state.js';

/**
 * Checks whether sub sequence characters appear in target string in order.
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
        if (sub.charCodeAt(subIdx) === target.charCodeAt(targetIdx)) {
            subIdx++;
        }
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
    const priority = item.priorityTier || 0;
    const activeLang = state?.uiSettings?.language || 'en';
    const isNonEnglish = activeLang !== 'en' && activeLang !== 'auto';

    // 1. Composite Multi-Token Exact Acronym Match (e.g. 'rc eb' -> Electro Boots)
    if (item.compositeAcronym && query === item.compositeAcronym) {
        return 240 + priority;
    }
    if (item.compactComposite && query === item.compactComposite) {
        return 230 + priority;
    }

    // 2. Multi-Token Composite Words (e.g. 'rc boots', 'aq arrow', 'king boots')
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
                const lengthProportion = (matchedLength / cleanTagLower.length) * 15;
                return 120 + lengthProportion + priority;
            }
            if (rawTagQuery.length >= 2 && (cleanTagLower.includes(rawTagQuery) || (tagQueryWithZero && cleanTagLower.includes(tagQueryWithZero)))) {
                return 55 + priority;
            }
        }
    }

    // 3. Exact Title Match
    const isLocalizedExact = (item.title && item.title.toLowerCase() === query) || item.normalizedTitle === query;
    if (isLocalizedExact) {
        return 150 + priority;
    }
    const isCanonicalExact = Boolean(item.canonicalTitle && item.canonicalTitle === query);
    if (isCanonicalExact) {
        return (isNonEnglish ? 135 : 150) + priority;
    }

    // 4. Exact Title Prefix Match (e.g. 'gia' -> 'Giant Arrow')
    if (item.title && item.title.toLowerCase().startsWith(query)) {
        const lengthProportion = (query.length / item.title.length) * 15;
        return 120 + lengthProportion + priority;
    }
    if (item.normalizedTitle && item.normalizedTitle.startsWith(query)) {
        const lengthProportion = (query.length / item.normalizedTitle.length) * 15;
        return 120 + lengthProportion + priority;
    }
    if (item.canonicalTitle && item.canonicalTitle.startsWith(query)) {
        const lengthProportion = (query.length / item.canonicalTitle.length) * 15;
        return (isNonEnglish ? 105 : 120) + lengthProportion + priority;
    }

    // 5. Exact 2-Letter Acronym Match (e.g. 'sb', 'eb', 'fb', 'mp', 'ga')
    if (item.acronym === query) {
        return 100 + priority;
    }

    // 6. Hero Scoped Expansion (e.g. searching 'aq' ranks Archer Queen first, then her equipment)
    if (item.heroAcronym && (query === item.heroAcronym || (item.heroName && item.heroName.toLowerCase().startsWith(query)))) {
        return 65 + priority;
    }

    // 7. Word Boundary / Keywords Match (e.g. 'arrow' in 'giant arrow')
    if (item.normalizedTitle.includes(' ' + query)) {
        return 55 + priority;
    }
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

    // 8. Substring Match
    if (item.normalizedTitle.includes(query)) {
        return 40 + priority;
    }
    if (
        (item.canonicalTitle && item.canonicalTitle.includes(query)) ||
        (item.canonicalTokens && item.canonicalTokens.includes(query))
    ) {
        return (isNonEnglish ? 28 : 40) + priority;
    }

    // 9. In-Order Fuzzy Subsequence (e.g. 'spk' -> 'spiky ball')
    if (query.length >= 2) {
        if (isSubsequence(query, item.normalizedTitle)) {
            return 20 + priority;
        }
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
    '/v': 'villages',
    '/village': 'villages',
    '/villages': 'villages',
    '/e': 'equipment',
    '/equip': 'equipment',
    '/equipment': 'equipment',
    '/h': 'hero',
    '/hero': 'hero',
    '/heroes': 'hero',
    '/t': 'tools',
    '/tool': 'tools',
    '/tools': 'tools',
    '/s': 'settings',
    '/setting': 'settings',
    '/settings': 'settings'
};

/**
 * Scope definitions for command suggestions when typing '/'.
 * Follows the exact visual order of filter chips in #spotright-filter-track:
 * villages -> equipment -> hero -> tools -> settings
 *
 * @type {Array<{
 *   scope: SpotrightScope,
 *   command: string,
 *   titleKey: string,
 *   icon: string,
 *   canonicalAliases: string[],
 *   fallbackTitle: string
 * }>}
 */
const SCOPE_DEFINITIONS = [
    {
        scope: 'villages',
        command: '/villages',
        titleKey: 'nav.views.hub.villages',
        fallbackTitle: 'Saved Villages',
        icon: 'user',
        canonicalAliases: ['villages', 'village', 'v']
    },
    {
        scope: 'equipment',
        command: '/equipment',
        titleKey: 'nav.equipment',
        fallbackTitle: 'Equipment',
        icon: 'equipment-filled',
        canonicalAliases: ['equipment', 'equip', 'e']
    },
    {
        scope: 'hero',
        command: '/heroes',
        titleKey: 'views.damageCalc.filters.filterHeroes',
        fallbackTitle: 'Heroes',
        icon: 'shield-filled',
        canonicalAliases: ['heroes', 'hero', 'h']
    },
    {
        scope: 'tools',
        command: '/tools',
        titleKey: 'nav.drawerTitle',
        fallbackTitle: 'Tabs & Tools',
        icon: 'sliders',
        canonicalAliases: ['tools', 'tool', 't']
    },
    {
        scope: 'settings',
        command: '/settings',
        titleKey: 'nav.settings',
        fallbackTitle: 'Settings',
        icon: 'settings-filled',
        canonicalAliases: ['settings', 'setting', 's']
    }
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
        return SCOPE_DEFINITIONS.map((def, idx) => {
            const title = resolveScopeTitle(def);
            return {
                id: `scope-suggestion-${def.scope}`,
                title,
                category: heading,
                command: def.command,
                icon: def.icon,
                iconType: /** @type {'svg'} */ ('svg'),
                acronym: def.command.slice(1, 3),
                entityType: /** @type {'nav'} */ ('nav'),
                isScopeSuggestion: true,
                targetScope: def.scope,
                priorityTier: 100 - idx * 5,
                normalizedTitle: `${def.command} ${title.toLowerCase()}`,
                execute: () => {}
            };
        });
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

        // 1. Exact single-letter shortcut match (e.g. /v, /e, /h, /t, /s)
        if (query === shortcut) {
            score = Math.max(score, 110);
        }

        // 2. Exact command or canonical alias match (e.g. /hero, /heroes, /equip, /equipment)
        if (def.canonicalAliases.some(alias => alias === query)) {
            score = Math.max(score, 105);
        }

        // 3. Localized title starts with query (e.g. German /aus -> Ausrüstung, /he -> Helden)
        if (
            lowerTitle.startsWith(query) ||
            normalizedTitle.startsWith(normalizedQuery) ||
            germanDeUmlautTitle.startsWith(query)
        ) {
            score = Math.max(score, 100);
        }

        // 4. Command or canonical alias starts with query (e.g. /to -> tools, /vil -> villages)
        if (cmd.startsWith(query) || def.canonicalAliases.some(alias => alias.startsWith(query))) {
            score = Math.max(score, 95);
        }

        // 5. Word boundary match in localized title (e.g. German /dorf -> Gespeicherte Dörfer, English /tools -> Tabs & Tools)
        if (
            tokens.some(t => t.startsWith(query)) ||
            normalizedTokens.some(t => t.startsWith(normalizedQuery)) ||
            germanTokens.some(t => t.startsWith(query))
        ) {
            score = Math.max(score, 90);
        }

        // 6. Substring match in localized title (only for queries >= 3 characters)
        if (
            query.length >= 3 && (
                lowerTitle.includes(query) ||
                normalizedTitle.includes(normalizedQuery) ||
                germanDeUmlautTitle.includes(query)
            )
        ) {
            score = Math.max(score, 60);
        }

        if (score > 0) {
            results.push({
                item: {
                    id: `scope-suggestion-${def.scope}`,
                    title,
                    category: heading,
                    command: def.command,
                    icon: def.icon,
                    iconType: /** @type {'svg'} */ ('svg'),
                    acronym: def.command.slice(1, 3),
                    entityType: /** @type {'nav'} */ ('nav'),
                    isScopeSuggestion: true,
                    targetScope: def.scope,
                    priorityTier: score,
                    normalizedTitle: `${def.command} ${lowerTitle}`,
                    execute: () => {}
                },
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
 * Filters the registry items by the specified active scope.
 * @param {import('./spotrightRegistry.js').SpotrightItem[]} registry
 * @param {SpotrightScope} scope
 * @returns {import('./spotrightRegistry.js').SpotrightItem[]}
 */
function filterRegistryByScope(registry, scope) {
    if (!scope || scope === 'all') return registry;

    switch (scope) {
        case 'villages': {
            const villages = registry.filter(item => item.isVillage);
            const addAction = registry.filter(item => item.id === 'action-add-player');
            return [...villages, ...addAction];
        }
        case 'equipment':
            return registry.filter(item => item.entityType === 'epic' || item.entityType === 'common');
        case 'hero':
            return registry.filter(item => item.entityType === 'hero');
        case 'tools':
            return registry.filter(item => item.entityType === 'nav');
        case 'settings':
            return registry.filter(item => item.entityType === 'modal' && !item.isVillage && item.id !== 'action-add-player');
        default:
            return registry;
    }
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
 *   autocomplete: {
 *     completionText: string,
 *     fullTitle: string
 *   } | null
 * }}
 */
export function searchSpotright(rawQuery, registry, activeScope = 'all', limit = 7) {
    let scope = /** @type {SpotrightScope} */ (typeof activeScope === 'string' ? activeScope : 'all');
    let maxLimit = typeof activeScope === 'number' ? activeScope : (typeof limit === 'number' ? limit : 7);

    const query = (rawQuery || '').trim().toLowerCase();

    // 1. Slash command suggestions & isolation: non-command items never appear when input begins with '/'
    if (query.startsWith('/')) {
        if (!rawQuery.includes(' ')) {
            return {
                matches: getScopeSuggestions(query),
                autocomplete: null
            };
        }
        return {
            matches: [],
            autocomplete: null
        };
    }

    // 2. Instant Village / Account Switcher trigger when input starts with '@'
    if (query.startsWith('@')) {
        const villageQuery = query.slice(1).trim();
        const villageItems = filterRegistryByScope(registry, 'villages');

        if (!villageQuery) {
            return {
                matches: villageItems,
                autocomplete: null
            };
        }

        /** @type {Array<{ item: import('./spotrightRegistry.js').SpotrightItem, score: number }>} */
        const scored = [];

        for (let i = 0; i < villageItems.length; i++) {
            const item = villageItems[i];
            const score = scoreSpotrightItem(villageQuery, item);
            if (score > 0) {
                scored.push({ item, score });
            }
        }

        scored.sort((a, b) => b.score - a.score);

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

        const cleanTagCandidate = villageQuery.startsWith('#') ? villageQuery.slice(1).toUpperCase() : villageQuery.toUpperCase();
        if (cleanTagCandidate.length >= 3 && cleanTagCandidate.length <= 12 && /^[0289CGJLOPQRUVY]+$/.test(cleanTagCandidate)) {
            const canonicalCandidate = cleanTagCandidate.replace(/O/g, '0');
            const exactSavedVillage = scored.find(entry =>
                entry.item.isVillage && (
                    entry.item.cleanTag === cleanTagCandidate ||
                    entry.item.cleanTag === canonicalCandidate
                )
            );

            if (!exactSavedVillage) {
                const directItem = {
                    id: `direct-tag-${cleanTagCandidate}`,
                    title: translate('views.spotright.loadVillageTag', { tag: cleanTagCandidate }),
                    normalizedTitle: villageQuery,
                    category: translate('player.tag') || 'Player Tag',
                    icon: 'user',
                    iconType: /** @type {'svg'} */ ('svg'),
                    acronym: cleanTagCandidate.slice(0, 2).toLowerCase(),
                    entityType: /** @type {'nav'} */ ('nav'),
                    priorityTier: 250,
                    isAsyncAction: true,
                    execute: () => loadAndSwitchPlayerTag(cleanTagCandidate)
                };

                const vEntries = scored.filter(entry => entry.item.isVillage);
                if (vEntries.length > 0) {
                    const lowestVillageScore = Math.min(...vEntries.map(e => e.score));
                    scored.push({ item: directItem, score: Math.max(1, lowestVillageScore - 0.5) });
                    scored.sort((a, b) => b.score - a.score);
                } else {
                    scored.unshift({ item: directItem, score: 350 });
                }
            }
        }

        return {
            matches: scored.slice(0, maxLimit).map(entry => entry.item),
            autocomplete: null
        };
    }

    const targetItems = filterRegistryByScope(registry, scope);

    // Empty state: return top tool navigation items or scoped collection
    if (!query) {
        if (scope === 'all') {
            const recentItems = resolveRecentItems(registry);
            if (recentItems.length > 0) {
                return {
                    matches: recentItems.slice(0, maxLimit),
                    autocomplete: null
                };
            }
            const defaultTools = targetItems
                .filter(item => item.entityType === 'nav')
                .slice(0, maxLimit);
            return {
                matches: defaultTools,
                autocomplete: null
            };
        }
        if (scope === 'villages') {
            return {
                matches: targetItems,
                autocomplete: null
            };
        }
        return {
            matches: scope === 'equipment' ? targetItems : targetItems.slice(0, Math.max(15, maxLimit)),
            autocomplete: null
        };
    }

    /** @type {Array<{ item: import('./spotrightRegistry.js').SpotrightItem, score: number }>} */
    const scored = [];

    for (let i = 0; i < targetItems.length; i++) {
        const item = targetItems[i];
        const score = scoreSpotrightItem(query, item);
        if (score > 0) {
            scored.push({ item, score });
        }
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
            const directItem = {
                id: `direct-tag-${cleanTagCandidate}`,
                title: translate('views.spotright.loadVillageTag', { tag: cleanTagCandidate }),
                normalizedTitle: query,
                category: translate('player.tag') || 'Player Tag',
                icon: 'user',
                iconType: /** @type {'svg'} */ ('svg'),
                acronym: cleanTagCandidate.slice(0, 2).toLowerCase(),
                entityType: /** @type {'nav'} */ ('nav'),
                priorityTier: 250,
                isAsyncAction: true,
                execute: () => loadAndSwitchPlayerTag(cleanTagCandidate)
            };

            const villageEntries = scored.filter(entry => entry.item.isVillage);
            if (villageEntries.length > 0) {
                // Ranks direct action lower than all saved villages so Return switches profiles
                const lowestVillageScore = Math.min(...villageEntries.map(e => e.score));
                scored.push({ item: directItem, score: Math.max(1, lowestVillageScore - 0.5) });
                scored.sort((a, b) => b.score - a.score);
            } else {
                scored.unshift({ item: directItem, score: 350 });
            }
        }
    }

    const topMatches = scored.slice(0, maxLimit).map(entry => entry.item);

    // Determine inline autocomplete eligibility
    let autocomplete = null;
    const topHit = topMatches[0];

    if (topHit && query.length >= 2 && topHit.title.toLowerCase().startsWith(query)) {
        // Disambiguation check: ensure next item does not tie with identical score
        const nextScore = scored[1]?.score || 0;
        const topScore = scored[0].score;

        if (topScore > nextScore || !scored[1]?.item.title.toLowerCase().startsWith(query)) {
            const completionText = topHit.title.slice(query.length);
            autocomplete = {
                completionText,
                fullTitle: topHit.title
            };
        }
    }

    return {
        matches: topMatches,
        autocomplete
    };
}
