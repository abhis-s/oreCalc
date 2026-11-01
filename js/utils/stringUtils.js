/**
 * Converts a string with spaces or underscores into camelCase.
 * Example: "Giant Gauntlet" -> "giantGauntlet", "barbarian_puppet" -> "barbarianPuppet"
 * @param {string} str
 * @returns {string}
 */
export function toCamelCase(str) {
    if (!str) return '';
    const words = str.trim().toLowerCase().split(/[\s_]+/).filter(word => word.length > 0);
    if (words.length === 0) return '';
    return words[0] + words.slice(1).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}

/**
 * Converts a string with spaces, underscores, or camelCase boundaries into kebab-case.
 * Example: "giantGauntlet" -> "giant-gauntlet", "raid_starry" -> "raid-starry"
 * @param {string} str
 * @returns {string}
 */
export function toKebabCase(str) {
    if (!str) return '';
    return String(str)
        .trim()
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase();
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
