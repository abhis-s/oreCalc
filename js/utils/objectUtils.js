/**
 * Recursively freezes an object and all its nested properties to guarantee complete runtime immutability.
 *
 * @template T
 * @param {T} obj - The object to deep freeze.
 * @returns {Readonly<T>} The frozen object.
 */
export function deepFreeze(obj) {
    if (obj === null || typeof obj !== 'object' || Object.isFrozen(obj)) {
        return obj;
    }
    Object.freeze(obj);
    Object.keys(obj).forEach(key => deepFreeze(obj[key]));
    return obj;
}
