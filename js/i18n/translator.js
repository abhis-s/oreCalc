import { state } from '../core/state.js';
import { setNumberFormatterLocale } from '../utils/numberFormatter.js';

const translations = {};
const inFlightLoads = new Map();
const LOCALE_FETCH_TIMEOUT_MS = 4000;
const LOCALE_RETRY_DELAYS_MS = [150, 350];

/**
 * Waits briefly between transient fetch retries.
 * @param {number} ms - Delay duration in milliseconds.
 * @returns {Promise<void>}
 */
function waitRetryDelay(ms) {
    if (ms <= 0 || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
        return Promise.resolve();
    }
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches a locale dictionary with per-attempt timeout, transient retries, and CacheStorage fallback.
 * @param {string} lang - Canonical locale code.
 * @returns {Promise<object>} Parsed dictionary object.
 */
async function fetchLocaleDictionary(lang) {
    const url = `/js/i18n/${lang}.json`;
    let lastError = null;

    for (let attempt = 0; attempt <= LOCALE_RETRY_DELAYS_MS.length; attempt++) {
        if (attempt > 0) {
            await waitRetryDelay(LOCALE_RETRY_DELAYS_MS[attempt - 1]);
        }

        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), LOCALE_FETCH_TIMEOUT_MS) : null;

        try {
            const fetchOptions = attempt > 0
                ? { cache: 'no-store', ...(controller ? { signal: controller.signal } : {}) }
                : (controller ? { signal: controller.signal } : undefined);

            const response = fetchOptions !== undefined
                ? await fetch(url, /** @type {RequestInit} */ (fetchOptions))
                : await fetch(url);

            if (!response.ok) {
                const status = Number(response.status) || 0;
                const err = new Error(`Failed to load translation file for ${lang}`);
                if (status >= 400 && status < 500) {
                    lastError = err;
                    break;
                }
                throw err;
            }
            return await response.json();
        } catch (err) {
            lastError = err;
        } finally {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
            }
        }
    }

    if (typeof caches !== 'undefined' && typeof caches.match === 'function') {
        try {
            const cachedRes = await caches.match(url, { ignoreSearch: true });
            if (cachedRes && cachedRes.ok) {
                return await cachedRes.json();
            }
        } catch (_) {}
    }

    throw lastError || new Error(`Failed to load translation file for ${lang}`);
}

/**
 * Returns whether at least one locale dictionary has been loaded into memory.
 * @returns {boolean} True when any non-empty dictionary is available.
 */
export function hasAnyTranslations() {
    return Object.values(translations).some(
        (dict) => Boolean(dict && typeof dict === 'object' && Object.keys(dict).length > 0)
    );
}

/**
 * Loads a JSON translation dictionary for a specified locale and caches it.
 * @param {string} language - 2-letter language code (e.g. 'en', 'de').
 * @returns {Promise<void>}
 */
export async function loadTranslations(language) {
    const targetLanguage = (!language || language === 'auto') ? 'en' : language;
    setNumberFormatterLocale(targetLanguage);

    const loadLocale = (lang) => {
        if (inFlightLoads.has(lang)) {
            return inFlightLoads.get(lang);
        }

        const promise = (async () => {
            try {
                const dict = await fetchLocaleDictionary(lang);
                if (dict && typeof dict === 'object') {
                    translations[lang] = dict;
                }
            } catch (error) {
                console.error(error);
                if (lang !== 'en') {
                    await loadLocale('en');
                }
            } finally {
                inFlightLoads.delete(lang);
            }
        })();

        inFlightLoads.set(lang, promise);
        return promise;
    };

    const promises = [loadLocale(targetLanguage)];
    if (targetLanguage !== 'en' && !translations['en']) {
        promises.push(loadLocale('en'));
    }
    await Promise.all(promises);
}

function getNestedTranslation(language, key) {
    if (!translations[language] || typeof translations[language] !== 'object' || typeof key !== 'string') {
        return undefined;
    }

    const keyParts = key.split('.');
    let current = translations[language];
    for (const part of keyParts) {
        if (current === undefined || current === null || typeof current !== 'object') {
            return undefined;
        }
        if (!Object.hasOwn(current, part)) {
            return undefined;
        }
        current = current[part];
    }

    return current;
}

/**
 * Translates an i18n dot-notated key into localized copy with variable interpolations and fallbacks.
 * @param {string} key - Dot-notated translation path.
 * @param {...*} args - Optional key-value object of interpolation replacements.
 * @returns {string} Localized text string.
 */
export function translate(key, ...args) {
    if (state.uiSettings?.language === 'auto') {
        state.uiSettings.language = 'en';
    }
    const language = state.uiSettings?.language || 'en';

    if (typeof key === 'string' && key.startsWith('apiErrors.rateLimitedWithTime:')) {
        const rawSec = key.split(':')[1];
        const seconds = Number(rawSec) || 0;
        const minutes = Math.max(1, Math.ceil(seconds / 60));
        let translation;
        let isFallbackToEnglish = false;

        translation = getNestedTranslation(language, 'apiErrors.rateLimitedWithTimeMinutes');
        if (translation === undefined) {
            translation = getNestedTranslation('en', 'apiErrors.rateLimitedWithTimeMinutes') || "Too many requests. Please try again after {minutes} minutes.";
            isFallbackToEnglish = true;
        }
        translation = translation.replace('{minutes}', String(minutes));

        if (isFallbackToEnglish && language !== 'en') {
            return `[EN] ${translation}`;
        }
        return translation;
    }

    let translation = getNestedTranslation(language, key);

    let isFallbackToEnglish = false;
    if (translation === undefined) {
        translation = getNestedTranslation('en', key);
        if (translation !== undefined) {
            isFallbackToEnglish = true;
        } else {
            translation = key; // Fallback to key if English not found either
        }
    }

    if (typeof translation !== 'string') {
        translation = typeof key === 'string' ? key : '';
    }

    if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null) {
        const replacements = args[0];
        translation = translation.replace(/\{(\w+)\}/g, (placeholderWithBraces, placeholderKey) => {
            return Object.hasOwn(replacements, placeholderKey) ? replacements[placeholderKey] : placeholderWithBraces;
        });
    }

    if (isFallbackToEnglish && language !== 'en') { // Prepend [EN] if fallback to English and not already English
        return `[EN] ${translation}`;
    }

    return translation;
}

/**
 * Returns the currently active language translation dictionary object.
 * @returns {object} Dictionary mapping translation keys to strings.
 */
export function getTranslations() {
    const language = state.uiSettings?.language || 'en';
    return translations[language] || {};
}
