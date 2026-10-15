/**
 * Spotright High-Performance Scoring & Zero-Allocation Matcher.
 * Tier 4: Search Matcher Engine.
 */

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

    // 1. Composite Multi-Token Exact Acronym Match (e.g. 'rc eb' -> Electro Boots)
    if (item.compositeAcronym && query === item.compositeAcronym) {
        return 240 + priority;
    }
    if (item.compactComposite && query === item.compactComposite) {
        return 230 + priority;
    }

    // 2. Multi-Token Composite Words (e.g. 'rc boots', 'aq arrow', 'king boots')
    if (query.includes(' ') && item.compositeTitle) {
        const tokens = query.split(/\s+/);
        let allTokensMatch = true;
        for (const token of tokens) {
            if (!token) continue;
            const matchesHero = item.heroAcronym === token || (item.heroName && item.heroName.toLowerCase().includes(token));
            const matchesEquip = item.acronym === token || item.normalizedTitle.includes(token);
            if (!matchesHero && !matchesEquip && !item.compositeTitle.includes(token)) {
                allTokensMatch = false;
                break;
            }
        }
        if (allTokensMatch) {
            return 180 + priority;
        }
    }

    // 3. Exact Title Match
    if (item.normalizedTitle === query) {
        return 150 + priority;
    }

    // 4. Exact Title Prefix Match (e.g. 'gia' -> 'Giant Arrow')
    if (item.normalizedTitle.startsWith(query)) {
        const lengthProportion = (query.length / item.normalizedTitle.length) * 15;
        return 120 + lengthProportion + priority;
    }

    // 5. Exact 2-Letter Acronym Match (e.g. 'sb', 'eb', 'fb', 'mp', 'ga')
    if (item.acronym === query) {
        return 100 + priority;
    }

    // 6. Hero Scoped Expansion (e.g. searching 'aq' ranks Archer Queen first, then her equipment)
    if (item.heroAcronym && (query === item.heroAcronym || (item.heroName && item.heroName.toLowerCase().startsWith(query)))) {
        return 65 + priority;
    }

    // 7. Word Boundary Match (e.g. 'arrow' in 'giant arrow')
    if (item.normalizedTitle.includes(' ' + query)) {
        return 55 + priority;
    }

    // 8. Substring Match
    if (item.normalizedTitle.includes(query)) {
        return 40 + priority;
    }

    // 9. In-Order Fuzzy Subsequence (e.g. 'spk' -> 'spiky ball')
    if (query.length >= 2 && isSubsequence(query, item.normalizedTitle)) {
        return 20 + priority;
    }

    return 0;
}

/**
 * Scope identifier types.
 * @typedef {'all' | 'equipment' | 'hero' | 'tools' | 'settings'} SpotrightScope
 */

/** @type {Record<string, SpotrightScope>} */
const PREFIX_TO_SCOPE = {
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
    const targetScope = PREFIX_TO_SCOPE[prefix];
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
        case 'equipment':
            return registry.filter(item => item.entityType === 'epic' || item.entityType === 'common');
        case 'hero':
            return registry.filter(item => item.entityType === 'hero');
        case 'tools':
            return registry.filter(item => item.entityType === 'nav');
        case 'settings':
            return registry.filter(item => item.entityType === 'modal');
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
 *     fullTitle: string,
 *     actionCue: string
 *   } | null
 * }}
 */
export function searchSpotright(rawQuery, registry, activeScope = 'all', limit = 7) {
    let scope = /** @type {SpotrightScope} */ (typeof activeScope === 'string' ? activeScope : 'all');
    let maxLimit = typeof activeScope === 'number' ? activeScope : (typeof limit === 'number' ? limit : 7);

    const query = (rawQuery || '').trim().toLowerCase();
    const targetItems = filterRegistryByScope(registry, scope);

    // Empty state: return top tool navigation items or scoped collection
    if (!query) {
        if (scope === 'all') {
            const defaultTools = targetItems
                .filter(item => item.entityType === 'nav')
                .slice(0, maxLimit);
            return {
                matches: defaultTools,
                autocomplete: null
            };
        }
        return {
            matches: targetItems.slice(0, Math.max(15, maxLimit)),
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

    const topMatches = scored.slice(0, maxLimit).map(entry => entry.item);

    // Determine inline autocomplete eligibility
    let autocomplete = null;
    const topHit = topMatches[0];

    if (topHit && query.length >= 2 && topHit.normalizedTitle.startsWith(query)) {
        // Disambiguation check: ensure next item does not tie with identical score
        const nextScore = scored[1]?.score || 0;
        const topScore = scored[0].score;

        if (topScore > nextScore || !scored[1]?.item.normalizedTitle.startsWith(query)) {
            const completionText = topHit.title.slice(query.length);
            autocomplete = {
                completionText,
                fullTitle: topHit.title,
                actionCue: topHit.actionCue
            };
        }
    }

    return {
        matches: topMatches,
        autocomplete
    };
}
