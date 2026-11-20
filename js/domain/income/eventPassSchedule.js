/**
 * Event Pass Schedule Domain Model.
 * Tier 2: Pure Domain Math & Schedule Resolution (Zero DOM dependencies, zero side effects).
 */

/**
 * Resolves effective Event Pass available months by filtering out any month
 * where a Craft Pass is registered.
 *
 * @param {Record<string, number[]>} [baseMonths={}] - Base schedule months map (1-indexed months).
 * @param {Record<string, number[]>} [craftPassMonths={}] - Craft Pass schedule months map (1-indexed months).
 * @returns {Record<string, number[]>} Resolved schedule with Craft Pass months skipped.
 */
export function resolveEventPassAvailableMonths(baseMonths = {}, craftPassMonths = {}) {
    const resolved = {};
    for (const year in baseMonths) {
        if (!Object.hasOwn(baseMonths, year)) continue;
        const craftMonthsInYear = new Set(craftPassMonths[year] || []);
        resolved[year] = (baseMonths[year] || []).filter(month => !craftMonthsInYear.has(month));
    }
    return resolved;
}
