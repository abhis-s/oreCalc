import { state } from '../core/state.js';

const translations = {};

/**
 * Loads a JSON translation dictionary for a specified locale and caches it.
 * @param {string} language - 2-letter language code (e.g. 'en', 'de').
 * @returns {Promise<void>}
 */
export async function loadTranslations(language) {
    if (state.uiSettings?.language === 'auto') {
        state.uiSettings.language = 'en';
    }

    const loadLocale = async (lang) => {
        try {
            const response = await fetch(`/js/i18n/${lang}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load translation file for ${lang}`);
            }
            translations[lang] = await response.json();
        } catch (error) {
            console.error(error);
            if (lang !== 'en') {
                await loadLocale('en');
            }
        }
    };

    const promises = [loadLocale(language)];
    if (language !== 'en' && !translations['en']) {
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
        if (current === undefined || typeof current !== 'object') {
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
        const seconds = parseInt(key.split(':')[1], 10);
        const minutes = Math.ceil(seconds / 60);
        let translation;
        let isFallbackToEnglish = false;

        translation = getNestedTranslation(language, 'apiErrors.rateLimitedWithTimeMinutes');
        if (translation === undefined) {
            translation = getNestedTranslation('en', 'apiErrors.rateLimitedWithTimeMinutes') || "Too many requests. Please try again after {minutes} minutes.";
            isFallbackToEnglish = true;
        }
        translation = translation.replace('{minutes}', minutes);

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
