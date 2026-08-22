/**
 * Safely parses a JSON string with fallback, preventing uncaught exceptions.
 *
 * @template T
 * @param {string|null|undefined} text - The JSON string to parse.
 * @param {T} [fallback=null] - Fallback value if parsing fails or input is invalid.
 * @returns {any|T} The parsed object or fallback.
 */
function safeJsonParse(text, fallback = null) {
    if (typeof text !== 'string' || !text.trim()) {
        return fallback;
    }
    try {
        return JSON.parse(text);
    } catch {
        return fallback;
    }
}

module.exports = { safeJsonParse };
