/**
 * Generates a cryptographically random RFC 4122 version 4 UUID string.
 * @returns {string} Generated UUID v4 string.
 */
export function generateUUID() {
    return crypto.randomUUID();
}

/**
 * Validates whether a string matches RFC 4122 version 4 UUID format.
 * @param {string} uuid - Input string to validate.
 * @returns {boolean} True if string is a valid UUID v4.
 */
export function isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}
