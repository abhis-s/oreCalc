const { COC_TAG_REGEX, USER_ID_REGEX, BILLING_MONTH_REGEX } = require('../constants.js');

/**
 * Validates a Clash of Clans player or clan tag.
 *
 * @param {any} tag - The tag to validate.
 * @returns {boolean} True if tag contains 3-14 valid Supercell characters.
 */
function isValidTag(tag) {
    if (!tag || typeof tag !== 'string') return false;
    const trimmed = tag.trim();
    const cleaned = trimmed.startsWith('#') ? trimmed.substring(1) : trimmed;
    return COC_TAG_REGEX.test(cleaned);
}

/**
 * Normalizes a Clash of Clans tag by stripping leading '#' and converting to uppercase.
 *
 * @param {any} tag - The tag to normalize.
 * @returns {string} Normalized uppercase tag without '#', or empty string if invalid.
 */
function normalizeTag(tag) {
    if (!tag || typeof tag !== 'string') return '';
    const trimmed = tag.trim();
    const cleaned = trimmed.startsWith('#') ? trimmed.substring(1) : trimmed;
    return cleaned.toUpperCase();
}

/**
 * Validates a user ID string token.
 *
 * @param {any} userId - The user ID to validate.
 * @returns {boolean} True if user ID is a 10-64 character alphanumeric/dash/underscore token.
 */
function isValidUserId(userId) {
    if (!userId || typeof userId !== 'string') return false;
    return USER_ID_REGEX.test(userId.trim());
}

/**
 * Validates a YYYY-MM billing month string.
 *
 * @param {any} monthStr - The month string to validate.
 * @returns {boolean} True if formatted as valid YYYY-MM.
 */
function isValidMonthStr(monthStr) {
    if (!monthStr || typeof monthStr !== 'string') return false;
    return BILLING_MONTH_REGEX.test(monthStr.trim());
}

/**
 * Semver version comparison utility.
 * Strips pre-release/build identifiers (e.g. +386e26f).
 * Returns 1 if v1 > v2, -1 if v1 < v2, and 0 if equal.
 *
 * @param {string} v1 - First version string.
 * @param {string} v2 - Second version string.
 * @returns {number} Comparison result (1, -1, or 0).
 */
function compareVersions(v1, v2) {
    if (typeof v1 !== 'string') v1 = String(v1 || '0.0.0');
    if (typeof v2 !== 'string') v2 = String(v2 || '0.0.0');
    const cleanV1 = v1.replace(/^v/i, '').split(/[+-]/)[0];
    const cleanV2 = v2.replace(/^v/i, '').split(/[+-]/)[0];
    const parts1 = cleanV1.split('.').map(Number);
    const parts2 = cleanV2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
    }
    return 0;
}

module.exports = {
    isValidTag,
    normalizeTag,
    isValidUserId,
    isValidMonthStr,
    compareVersions
};
