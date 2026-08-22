import { SUPPORTED_LANGUAGES } from '../data/languagesData.js';
import { state } from './state.js';

/**
 * Extracts a supported language code from the URL path.
 * e.g., "/de/#home" -> "de", "/tr/planner" -> "tr", "/en" -> "en"
 *
 * @returns {string | null} 2-letter language code or null.
 */
export function getLanguageFromPath() {
    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    if (pathSegments.length > 0 && SUPPORTED_LANGUAGES.includes(pathSegments[0].toLowerCase())) {
        return pathSegments[0].toLowerCase();
    }
    return null;
}

/**
 * Determines initial language based on:
 * 1. URL Path (/en, /de, /tr)
 * 2. Saved State / LocalStorage
 * 3. Browser Navigator languages
 * 4. Fallback 'en'
 *
 * @returns {string} Detected 2-letter language code.
 */
export function detectLanguage() {
    const pathLang = getLanguageFromPath();
    if (pathLang) return pathLang;

    const savedLang = state.uiSettings?.language || localStorage.getItem('oreCalc_language');
    if (savedLang && SUPPORTED_LANGUAGES.includes(savedLang) && savedLang !== 'auto') {
        return savedLang;
    }

    const userLangs = navigator.languages || [navigator.language || 'en'];
    for (const l of userLangs) {
        const prefix = l.toLowerCase().substring(0, 2);
        if (SUPPORTED_LANGUAGES.includes(prefix)) {
            return prefix;
        }
    }

    return 'en';
}

/**
 * Synchronizes browser URL to include /${lang}/ (or root / for 'en') without triggering page reload.
 * @param {string} lang - Language code to sync into URL path.
 * @param {boolean} [replace=false] - Whether to use history.replaceState instead of pushState.
 */
export function syncLanguageUrl(lang, replace = false) {
    if (!SUPPORTED_LANGUAGES.includes(lang)) return;

    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    const hasLangPrefix = pathSegments.length > 0 && SUPPORTED_LANGUAGES.includes(pathSegments[0].toLowerCase());

    if (hasLangPrefix) {
        pathSegments.shift();
    }

    const currentHash = window.location.hash || '';
    const remainingPath = pathSegments.join('/');

    let newPathname;
    let canonicalHref;

    if (lang === 'en') {
        newPathname = remainingPath ? `/${remainingPath}` : '/';
        canonicalHref = remainingPath ? `https://orecalc.tech/${remainingPath}` : 'https://orecalc.tech/';
    } else {
        newPathname = remainingPath ? `/${lang}/${remainingPath}` : `/${lang}/`;
        canonicalHref = remainingPath ? `https://orecalc.tech/${lang}/${remainingPath}` : `https://orecalc.tech/${lang}/`;
    }

    const newUrl = `${newPathname}${currentHash}`;

    if (window.location.pathname + window.location.hash !== newUrl) {
        if (replace) {
            history.replaceState(null, '', newUrl);
        } else {
            history.pushState(null, '', newUrl);
        }
    }

    document.documentElement.lang = lang;

    /** @type {HTMLLinkElement | null} */
    let canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
        canonical.href = canonicalHref;
    }
}

/**
 * Validates whether a pathname is a valid application route or language route.
 *
 * @param {string} pathName - Path string to evaluate.
 * @returns {boolean} Whether route is recognized.
 */
export function isValidRoute(pathName) {
    if (!pathName || pathName === '/' || pathName === '/index.html' || pathName === '/404' || pathName === '/404.html') {
        return true;
    }
    const pathSegments = pathName.split('/').filter(Boolean);
    if (pathSegments.length === 0) return true;

    if (SUPPORTED_LANGUAGES.includes(pathSegments[0].toLowerCase())) {
        if (pathSegments.length === 1) return true; // /de or /de/
        const subRoute = pathSegments[1].toLowerCase();
        const validSubRoutes = ['privacy', 'terms', 'licenses', 'planner', 'income', 'equipment', 'settings', 'home', '404'];
        if (validSubRoutes.includes(subRoute)) return true;
    }

    const validRootRoutes = ['privacy', 'terms', 'licenses'];
    if (pathSegments.length === 1 && validRootRoutes.includes(pathSegments[0].toLowerCase())) {
        return true;
    }

    return false;
}
