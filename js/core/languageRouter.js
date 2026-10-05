import { SUPPORTED_LANGUAGES } from '../data/languagesData.js';
import { safeJsonParse } from '../utils/jsonUtils.js';
import { state } from './state.js';

/**
 * Extracts a supported language code from the URL path.
 * e.g., "/de/#home" -> "de", "/tr/planner" -> "tr", "/en" -> "en"
 *
 * @returns {string | null} 2-letter language code or null.
 */
export function getLanguageFromPath() {
    if (typeof window === 'undefined' || !window.location?.pathname) {
        return null;
    }
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

    const rawSettings = (typeof localStorage !== 'undefined') ? localStorage.getItem('oreCalc_appSettings') : null;
    const settings = safeJsonParse(rawSettings, {});
    const savedLang = state.uiSettings?.language || settings?.language;
    if (savedLang && SUPPORTED_LANGUAGES.includes(savedLang) && savedLang !== 'auto') {
        return savedLang;
    }

    const userLangs = (typeof navigator !== 'undefined') ? (navigator.languages || [navigator.language || 'en']) : ['en'];
    for (const l of userLangs) {
        const prefix = l.toLowerCase().substring(0, 2);
        if (SUPPORTED_LANGUAGES.includes(prefix)) {
            return prefix;
        }
    }

    return 'en';
}

/**
 * Constructs a localized path preserving current sub-route, query parameters, and hash.
 * e.g., on "/damage-calculator/?_t=123", getLocalizedPath('de') -> "/de/damage-calculator/?_t=123"
 * e.g., on "/de/hero-journey/?player=TAG", getLocalizedPath('en') -> "/hero-journey/?player=TAG"
 * e.g., on "/", getLocalizedPath('de') -> "/de/"
 *
 * @param {string} lang - Target language code ('en', 'de', 'tr', 'zh').
 * @param {Location | { pathname: string, search?: string, hash?: string } | null} [loc]
 * @returns {string} Fully localized path with query and hash.
 */
export function getLocalizedPath(lang, loc = (typeof window !== 'undefined' ? window.location : null)) {
    if (!loc || !loc.pathname) {
        return lang === 'en' ? '/' : `/${lang}/`;
    }

    const pathSegments = loc.pathname.split('/').filter(Boolean);
    const hasLangPrefix = pathSegments.length > 0 && SUPPORTED_LANGUAGES.includes(pathSegments[0].toLowerCase());

    if (hasLangPrefix) {
        pathSegments.shift();
    }

    const currentSearch = loc.search || '';
    const currentHash = loc.hash || '';
    let formattedPath = pathSegments.join('/');
    if (formattedPath && !formattedPath.endsWith('/') && !formattedPath.includes('.')) {
        formattedPath = `${formattedPath}/`;
    }

    if (lang === 'en') {
        const newPathname = formattedPath ? `/${formattedPath}` : '/';
        return `${newPathname}${currentSearch}${currentHash}`;
    }

    const newPathname = formattedPath ? `/${lang}/${formattedPath}` : `/${lang}/`;
    return `${newPathname}${currentSearch}${currentHash}`;
}

/**
 * Synchronizes browser URL to include /${lang}/ (or root / for 'en') without triggering page reload.
 * @param {string} lang - Language code to sync into URL path.
 * @param {boolean} [replace=false] - Whether to use history.replaceState instead of pushState.
 */
export function syncLanguageUrl(lang, replace = false) {
    if (!SUPPORTED_LANGUAGES.includes(lang)) return;

    const newUrl = getLocalizedPath(lang);

    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    const hasLangPrefix = pathSegments.length > 0 && SUPPORTED_LANGUAGES.includes(pathSegments[0].toLowerCase());

    if (hasLangPrefix) {
        pathSegments.shift();
    }

    let formattedPath = pathSegments.join('/');
    if (formattedPath && !formattedPath.endsWith('/') && !formattedPath.includes('.')) {
        formattedPath = `${formattedPath}/`;
    }

    const baseOrigin = (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null')
        ? window.location.origin
        : 'https://orecalc.tech';

    const canonicalHref = (lang === 'en')
        ? (formattedPath ? `${baseOrigin}/${formattedPath}` : `${baseOrigin}/`)
        : (formattedPath ? `${baseOrigin}/${lang}/${formattedPath}` : `${baseOrigin}/${lang}/`);

    if (window.location.pathname + window.location.search + window.location.hash !== newUrl) {
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

    const firstSegment = pathSegments[0].toLowerCase();

    // Check language prefix routes (e.g. /de/, /tr/, /zh/)
    if (SUPPORTED_LANGUAGES.includes(firstSegment)) {
        if (pathSegments.length === 1) return true;
        if (pathSegments.length === 2) {
            const subRoute = pathSegments[1].toLowerCase();
            const validLocalizedSubRoutes = ['ore-calculator', 'hero-journey', 'damage-calculator', 'privacy', 'terms', '404'];
            if (validLocalizedSubRoutes.includes(subRoute)) return true;
        }
        return false;
    }

    const validRootRoutes = ['ore-calculator', 'hero-journey', 'damage-calculator', 'privacy', 'terms', 'licenses', '404'];
    if (pathSegments.length === 1 && validRootRoutes.includes(firstSegment)) {
        return true;
    }

    return false;
}
