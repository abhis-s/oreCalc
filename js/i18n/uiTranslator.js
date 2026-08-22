import { getDynamicTranslationArgs } from './i18nParams.js';
import { translate } from './translator.js';

import { state } from '../core/state.js';
import { applyThemeSettings } from '../core/themeManager.js';

import { safeJsonParse } from '../utils/jsonUtils.js';

import { getAppLastUpdatedDateFormatted } from '../components/appSettings/appSettingsDisplay.js';

/**
 * Traverses DOM data-i18n attributes and updates element text/attributes with translated strings.
 * @param {boolean} [isInitialLoad=false]
 */
export function updateUIWithTranslations(isInitialLoad = false) {
    const currentLang = state.uiSettings?.language || 'en';

    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (!key) return;

        const argsAttr = element.getAttribute('data-i18n-args');
        let args = argsAttr ? (safeJsonParse(argsAttr, {}) || {}) : {};

        if (key === 'views.settings.bugReportDesc') {
            const formattedDate = getAppLastUpdatedDateFormatted(currentLang);
            args.date = formattedDate;
            element.setAttribute('data-i18n-args', JSON.stringify(args));
        }

        const dynamicArgs = getDynamicTranslationArgs(key, currentLang, translate);
        const mergedArgs = { ...args, ...dynamicArgs };

        let translatedName = translate(key, mergedArgs);

        if (translatedName.includes('<') && translatedName.includes('>')) {
            element.innerHTML = translatedName;
            return;
        }

        let updated = false;
        for (const child of element.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                child.textContent = translatedName;
                updated = true;
                break;
            }
        }

        if (!updated) {
            element.textContent = translatedName;
        }
    });

    document.querySelectorAll('[data-i18n-alt]').forEach(element => {
        const key = element.getAttribute('data-i18n-alt');
        if (!key) return;
        const argsAttr = element.getAttribute('data-i18n-alt-args');
        const args = argsAttr ? (safeJsonParse(argsAttr, {}) || {}) : {};
        element.setAttribute('alt', translate(key, args));
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (!key) return;
        const argsAttr = element.getAttribute('data-i18n-placeholder-args');
        const args = argsAttr ? (safeJsonParse(argsAttr, {}) || {}) : {};
        element.setAttribute('placeholder', translate(key, args));
    });

    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        const key = element.getAttribute('data-i18n-title');
        if (!key) return;
        const argsAttr = element.getAttribute('data-i18n-title-args');
        const args = argsAttr ? (safeJsonParse(argsAttr, {}) || {}) : {};
        element.setAttribute('title', translate(key, args));
    });

    document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
        const key = element.getAttribute('data-i18n-aria-label');
        if (!key) return;
        const argsAttr = element.getAttribute('data-i18n-aria-label-args');
        const args = argsAttr ? (safeJsonParse(argsAttr, {}) || {}) : {};
        element.setAttribute('aria-label', translate(key, args));
    });

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) metaDescription.setAttribute('content', translate('app.description'));

    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) ogDescription.setAttribute('content', translate('app.description'));

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', translate('app.title'));

    if (!isInitialLoad) {
        applyThemeSettings(state.uiSettings.theme || 'dark', state.uiSettings.accentColor || 'random');
    }

    document.documentElement.lang = state.uiSettings.language || 'auto';
    document.dispatchEvent(new CustomEvent('languageChanged'));
}
