import { MAX_TOWN_HALL } from '../../core/constants.js';

const MAX_TH_ICON_LEVEL = 19;

/**
 * Returns the predicted release year for a given Town Hall level.
 *
 * @param {number} thLevel - Town Hall level.
 * @returns {number} Release year.
 */
export function getTHReleaseDate(thLevel) {
    if (thLevel <= 17) return 2024;
    return 2024 + (thLevel - 17);
}

/**
 * Resolves the asset path for a Town Hall icon, clamping to the highest available sprite on disk.
 *
 * @param {number} [townHallLevel=MAX_TOWN_HALL] - Town Hall level.
 * @param {{ rootRelative?: boolean }} [options={}] - Path resolution options.
 * @returns {string} Path to Town Hall PNG icon.
 */
export function getTownHallIconUrl(townHallLevel = MAX_TOWN_HALL, { rootRelative = false } = {}) {
    const raw = townHallLevel == null || String(townHallLevel).trim() === ''
        ? MAX_TOWN_HALL
        : Number(townHallLevel);
    const parsed = Number.isFinite(raw) ? Math.floor(raw) : MAX_TOWN_HALL;
    const clamped = Math.max(1, Math.min(parsed, MAX_TH_ICON_LEVEL));
    return `${rootRelative ? '/' : ''}assets/th/th${clamped}.png`;
}
