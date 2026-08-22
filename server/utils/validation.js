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

module.exports = {
    isValidTag,
    normalizeTag,
    isValidUserId,
    isValidMonthStr
};
