/**
 * Calculates the current maximum Town Hall level based on the date.
 * Supercell releases a new TH every 12 months in November.
 * Nov 2024: TH 17
 * Nov 2025: TH 18
 * Nov 2026: TH 19
 *
 * @param {Date} [date=new Date()] - Date to evaluate.
 * @returns {number} Maximum Town Hall level.
 */
export function getMaxTownHall(date = new Date()) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1; // 1-12
    let maxTH = 17 + (year - 2024);
    if (month < 11) maxTH -= 1;
    return maxTH;
}

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
