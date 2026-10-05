let _cache = null;
let _promise = null;

/**
 * Fires three parallel fetches for defence target JSON data.
 * Idempotent — safe to call multiple times. Call once at app boot.
 *
 * @returns {Promise<void>}
 */
export function preloadDefensesData() {
    if (_promise) return _promise;
    _promise = Promise.all([
        fetch('/js/data/targets/buildings.json').then(r => r.json()),
        fetch('/js/data/targets/heroes.json').then(r => r.json()),
        fetch('/js/data/targets/guardians.json').then(r => r.json()),
    ]).then(([buildings, heroes, guardians]) => {
        _cache = Object.freeze({ ...buildings, ...heroes, ...guardians });
    });
    return _promise;
}

/**
 * Returns the resolved defence targets map.
 * Always call after awaiting preloadDefensesData().
 *
 * @returns {Readonly<Object>}
 */
export function getDefensesData() {
    return _cache || {};
}
