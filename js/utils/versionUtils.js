/**
 * Semver version comparison utility.
 * Returns 1 if v1 > v2, -1 if v1 < v2, and 0 if equal.
 *
 * @param {string} v1 - First version string.
 * @param {string} v2 - Second version string.
 * @returns {number} Comparison result (1, -1, or 0).
 */
export function compareVersions(v1, v2) {
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
