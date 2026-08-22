/**
 * Deeply freezes an object to enforce immutability at runtime.
 *
 * @template T
 * @param {T} obj - The object to freeze.
 * @returns {Readonly<T>} The deeply frozen object.
 */
function deepFreeze(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    Object.freeze(obj);

    for (const key of Object.getOwnPropertyNames(obj)) {
        // @ts-ignore
        const val = obj[key];
        if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
            deepFreeze(val);
        }
    }

    return obj;
}

module.exports = { deepFreeze };
