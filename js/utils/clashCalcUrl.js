/**
 * Builds the destination ClashCalc URL carrying active identity and tag parameters.
 *
 * @param {Object} params - Target calculation parameters.
 * @param {string} [params.currentPath='/'] - Current window pathname.
 * @param {string} [params.currentSearch=''] - Current window search string.
 * @param {string|null} [params.userId=null] - Active local or synced user ID.
 * @param {string|null} [params.activePlayerTag=null] - Active player tag.
 * @param {string} [params.targetOrigin='https://clashcalc.com'] - Destination ClashCalc origin.
 * @returns {string} Fully qualified destination URL with carryover parameters.
 */
export function buildClashCalcTargetUrl({
    currentPath = '/',
    currentSearch = '',
    userId = null,
    activePlayerTag = null,
    targetOrigin = 'https://clashcalc.com'
}) {
    const url = new URL(targetOrigin);

    const segments = currentPath.split('/').filter(Boolean);
    const knownLocales = ['de', 'tr', 'zh'];
    const hasLocale = segments.length > 0 && knownLocales.includes(segments[0].toLowerCase());
    const langPrefix = hasLocale ? `/${segments[0].toLowerCase()}` : '';
    const isHeroJourney = currentPath.includes('hero-journey');

    url.pathname = `${langPrefix}${isHeroJourney ? '/hero-journey/' : '/ore-calculator/'}`;

    const existingParams = new URLSearchParams(currentSearch);
    const paramsToExclude = new Set(['userId', 'tag', 'domainNotice', 'testDomainNotice']);
    existingParams.forEach((val, key) => {
        if (!paramsToExclude.has(key)) {
            url.searchParams.set(key, val);
        }
    });

    if (userId && typeof userId === 'string' && userId.trim()) {
        url.searchParams.set('userId', userId.trim());
    }

    const resolvedTag = activePlayerTag || existingParams.get('tag');
    if (resolvedTag && resolvedTag !== 'DEFAULT0' && resolvedTag.trim()) {
        url.searchParams.set('tag', resolvedTag.trim());
    }

    return url.toString();
}
