import { getDynamicTranslationArgs } from './i18nParams.js';
import { hasAnyTranslations, translate } from './translator.js';

import { state } from '../core/state.js';
import { applyThemeSettings } from '../core/themeManager.js';

import { safeJsonParse } from '../utils/jsonUtils.js';
import { setDefaultDateLocale, getAppLastUpdatedDateFormatted } from '../utils/dateUtils.js';
import { sanitizeHTML } from '../utils/stringUtils.js';

/**
 * Traverses DOM data-i18n attributes and updates element text/attributes with translated strings.
 * @param {boolean} [isInitialLoad=false]
 */
export function updateUIWithTranslations(isInitialLoad = false) {
    const currentLang = state.uiSettings?.language || 'en';
    setDefaultDateLocale(currentLang);

    if (!hasAnyTranslations()) {
        if (!isInitialLoad && state.uiSettings) {
            applyThemeSettings(state.uiSettings.theme || 'dark', state.uiSettings.accentColor || 'blue');
        }
        document.documentElement.lang = state.uiSettings?.language || 'auto';
        return;
    }

    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (!key) return;

        const argsAttr = element.getAttribute('data-i18n-args');
        let args = argsAttr ? (safeJsonParse(argsAttr, {}) || {}) : {};

        if (key === 'views.settings.bugReport.desc') {
            const formattedDate = getAppLastUpdatedDateFormatted(currentLang);
            args.date = formattedDate;
            element.setAttribute('data-i18n-args', JSON.stringify(args));
        }

        const dynamicArgs = getDynamicTranslationArgs(key, currentLang, translate);
        const mergedArgs = { ...args, ...dynamicArgs };

        let translatedName = translate(key, mergedArgs);

        const allowsHtml = element.getAttribute('data-i18n-html') === 'true';
        if (allowsHtml) {
            element.innerHTML = sanitizeHTML(translatedName);
            return;
        }

        let targetTextNode = null;
        if (element.childNodes) {
            for (const child of element.childNodes) {
                if (child.nodeType === Node.TEXT_NODE && child.textContent && child.textContent.trim().length > 0) {
                    targetTextNode = child;
                    break;
                }
            }
        }

        if (targetTextNode) {
            targetTextNode.textContent = translatedName;
        } else if (!element.children || element.children.length === 0) {
            element.textContent = translatedName;
        } else {
            const lastChild = element.lastChild;
            if (lastChild && lastChild.nodeType === Node.TEXT_NODE) {
                lastChild.textContent = ' ' + translatedName;
            } else if (typeof document !== 'undefined' && typeof document.createTextNode === 'function') {
                element.appendChild(document.createTextNode(' ' + translatedName));
            } else {
                element.textContent = translatedName;
            }
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
    const metaDescKey = metaDescription?.getAttribute('data-i18n-content') || 'app.description';
    const translatedDesc = translate(metaDescKey);
    if (metaDescription) metaDescription.setAttribute('content', translatedDesc);

    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) ogDescription.setAttribute('content', translatedDesc);

    const titleEl = document.querySelector('title[data-i18n]');
    const pageTitleKey = titleEl?.getAttribute('data-i18n') || 'app.title';
    const translatedTitle = translate(pageTitleKey);

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', translatedTitle);

    if (!isInitialLoad && state.uiSettings) {
        applyThemeSettings(state.uiSettings.theme || 'dark', state.uiSettings.accentColor || 'blue');
    }

    document.documentElement.lang = state.uiSettings?.language || 'auto';
    if (!isInitialLoad) {
        document.dispatchEvent(new CustomEvent('languageChanged'));
    }
}
