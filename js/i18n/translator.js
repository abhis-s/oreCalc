import { state } from '../core/state.js';

const translations = {};

export async function loadTranslations(language) {
    if (state.uiSettings?.language === 'auto') {
        state.uiSettings.language = 'en';
    }
    try {
        const response = await fetch(`js/i18n/${language}.json`);
        if (!response.ok) {
            throw new Error(`Failed to load translation file for ${language}`);
        }
        translations[language] = await response.json();
    } catch (error) {
        console.error(error);
        // Fallback to English if the selected language fails to load
        if (language !== 'en') {
            await loadTranslations('en');
        }
    }
}

function getNestedTranslation(language, key) {
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

export function translate(key, ...args) {
    if (state.uiSettings?.language === 'auto') {
        state.uiSettings.language = 'en';
    }
    const language = state.uiSettings?.language || 'en';
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

    if (args.length > 0 && typeof args[0] === 'object') {
        const replacements = args[0];
        translation = translation.replace(/\{(\w+)\}/g, (placeholderWithBraces, placeholderKey) => {
            return replacements.hasOwnProperty(placeholderKey) ? replacements[placeholderKey] : placeholderWithBraces;
        });
    }

    if (isFallbackToEnglish && language !== 'en') { // Prepend [EN] if fallback to English and not already English
        return `[EN] ${translation}`;
    }

    return translation;
}

export function getTranslations() {
    const language = state.uiSettings?.language || 'en';
    return translations[language] || {};
}