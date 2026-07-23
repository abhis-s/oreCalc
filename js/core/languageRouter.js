import { state } from './state.js';

export const SUPPORTED_LANGUAGES = ['en', 'de', 'tr'];

/**
 * Extracts a supported language code from the URL path.
 * e.g., "/de/#home" -> "de", "/tr/planner" -> "tr", "/en" -> "en"
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
 */
export function detectLanguage() {
    // 1. Path-based language taking highest precedence
    const pathLang = getLanguageFromPath();
    if (pathLang) return pathLang;

    // 2. Saved preference in state or localStorage
    const savedLang = state.uiSettings?.language || localStorage.getItem('oreCalc_language');
    if (savedLang && SUPPORTED_LANGUAGES.includes(savedLang) && savedLang !== 'auto') {
        return savedLang;
    }

    // 3. Browser navigator language
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
 * Synchronizes browser URL to include /${lang}/ without triggering page reload.
 */
export function syncLanguageUrl(lang, replace = false) {
    if (!SUPPORTED_LANGUAGES.includes(lang)) return;

    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    // Remove existing language segment if present
    if (pathSegments.length > 0 && SUPPORTED_LANGUAGES.includes(pathSegments[0].toLowerCase())) {
        pathSegments.shift();
    }

    const currentHash = window.location.hash || '';
    const remainingPath = pathSegments.length > 0 ? pathSegments.join('/') + '/' : '';
    const newPathname = `/${lang}/${remainingPath}`;
    const newUrl = `${newPathname}${currentHash}`;

    if (window.location.pathname + window.location.hash !== newUrl) {
        if (replace) {
            history.replaceState(null, '', newUrl);
        } else {
            history.pushState(null, '', newUrl);
        }
    }

    document.documentElement.lang = lang;

    // Update canonical link element
    let canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
        canonical.href = `https://orecalc.tech/${lang}/`;
    }
}

/**
 * Validates whether a pathname is a valid application route or language route.
 */
export function isValidRoute(pathName) {
    if (!pathName || pathName === '/' || pathName === '/index.html' || pathName === '/404' || pathName === '/404.html') {
        return true;
    }
    const pathSegments = pathName.split('/').filter(Boolean);
    if (pathSegments.length === 0) return true;

    // Check if first segment is a supported language (e.g., /en, /de, /tr)
    if (SUPPORTED_LANGUAGES.includes(pathSegments[0].toLowerCase())) {
        if (pathSegments.length === 1) return true; // /de or /de/
        const subRoute = pathSegments[1].toLowerCase();
        const validSubRoutes = ['privacy', 'terms', 'licenses', 'planner', 'income', 'equipment', 'settings', 'home', '404'];
        if (validSubRoutes.includes(subRoute)) return true;
    }

    // Static root routes
    const validRootRoutes = ['privacy', 'terms', 'licenses'];
    if (pathSegments.length === 1 && validRootRoutes.includes(pathSegments[0].toLowerCase())) {
        return true;
    }

    return false;
}
