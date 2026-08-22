/**
 * @fileoverview Centralized dynamic translation parameter resolver.
 * Provides declarative resolution for i18n placeholders ({url}, {displayUrl}, {link})
 * across build scripts, dev server, and client-side rendering.
 */

import { getFanContentPolicyUrl } from '../data/languagesData.js';

/**
 * Registry of dynamic parameter resolver functions for specific i18n translation keys.
 * @type {Record<string, (lang: string, getTranslation: (key: string) => string) => Record<string, string>>}
 */
export const I18N_DYNAMIC_PARAMS = {
    'app.supercellDisclaimer': (lang) => {
        const url = getFanContentPolicyUrl(lang);
        return {
            url,
            displayUrl: url.replace(/^https?:\/\//, '')
        };
    },
    'views.settings.bugReportInfo': () => ({
        link: '<a href="https://github.com/abhis-s/oreCalc/issues" target="_blank" rel="noopener noreferrer" class="theme-link">GitHub Issues</a>'
    }),
    'views.settings.bugReportPrivacyInfo': (lang, getTranslation) => {
        const privacyText = (typeof getTranslation === 'function' ? getTranslation('views.settings.privacyPolicyText') : '') || 'Privacy Policy';
        return {
            link: `<a href="#" id="bug-report-privacy-link" class="theme-link">${privacyText}</a>`
        };
    }
};

/**
 * Resolves dynamic translation arguments for a given i18n key and language.
 *
 * @param {string} key - The dot-notated i18n translation key.
 * @param {string} [lang='en'] - The active language code (e.g. 'en', 'de', 'tr', 'zh').
 * @param {(key: string) => string} [getTranslation] - Function to retrieve another translation string.
 * @returns {Record<string, string>} Resolved replacement parameters object.
 */
export function getDynamicTranslationArgs(key, lang = 'en', getTranslation = () => '') {
    const resolver = I18N_DYNAMIC_PARAMS[key];
    return resolver ? resolver(lang, getTranslation) : {};
}
