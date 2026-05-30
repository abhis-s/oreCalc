/**
 * Converts a string with spaces into camelCase.
 * Example: "Giant Gauntlet" -> "giantGauntlet"
 * @param {string} str 
 * @returns {string}
 */
export function toCamelCase(str) {
    if (!str) return '';
    const words = str.trim().toLowerCase().split(/\s+/).filter(word => word.length > 0);
    if (words.length === 0) return '';
    return words[0] + words.slice(1).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}

/**
 * Escapes HTML special characters in a string.
 * @param {string} str 
 * @returns {string}
 */
export function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

