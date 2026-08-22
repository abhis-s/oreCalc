/**
 * Safe JSON parsing utility preventing uncaught exceptions on malformed or empty payloads.
 *
 * @template T
 * @param {string|null|undefined} rawString - The raw JSON string to parse.
 * @param {T} [fallback=null] - Default fallback value returned on parsing error or null input.
 * @returns {any|T} The parsed object or the provided fallback.
 */
export function safeJsonParse(rawString, fallback = null) {
    if (rawString === null || rawString === undefined || typeof rawString !== 'string') {
        return fallback;
    }
    const trimmed = rawString.trim();
    if (trimmed === '') {
        return fallback;
    }
    try {
        return JSON.parse(trimmed);
    } catch {
        return fallback;
    }
}
