import { SUPPORTED_LANGUAGES } from '../data/languagesData.js';
import { APP_ROUTES, APP_LEGAL_ROUTES } from '../data/appRoutesData.js';
import { normalizePlayerTag } from './storageKeys.js';
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

    const rawSettings = (typeof localStorage !== 'undefined')
        ? (localStorage.getItem('clashCalc_appSettings') || localStorage.getItem('oreCalc_appSettings'))
        : null;
    const settings = safeJsonParse(rawSettings, {});
    const stateLang = (state.uiSettings?.language && state.uiSettings.language !== 'auto')
        ? state.uiSettings.language
        : null;
    const storageLang = (settings?.language && settings.language !== 'auto')
        ? settings.language
        : null;
    const savedLang = stateLang || storageLang;
    if (savedLang && SUPPORTED_LANGUAGES.includes(savedLang)) {
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

    const normalizedSubPath = formattedPath ? `/${formattedPath}` : '/';
    const legalRoute = APP_LEGAL_ROUTES.find(route => route.path === normalizedSubPath);
    const effectiveLang = (legalRoute && !legalRoute.supportedLanguages.includes(lang))
        ? 'en'
        : lang;

    if (effectiveLang === 'en') {
        const newPathname = formattedPath ? `/${formattedPath}` : '/';
        return `${newPathname}${currentSearch}${currentHash}`;
    }

    const newPathname = formattedPath ? `/${effectiveLang}/${formattedPath}` : `/${effectiveLang}/`;
    return `${newPathname}${currentSearch}${currentHash}`;
}

/** @type {((pathAndSearch: string) => void) | null} */
let languageUrlSyncHandler = null;

/**
 * Registers a callback invoked whenever syncLanguageUrl updates the browser URL.
 * Keeps external navigators synchronized without circular module dependencies.
 *
 * @param {(pathAndSearch: string) => void} handler
 */
export function registerLanguageUrlSyncHandler(handler) {
    languageUrlSyncHandler = handler;
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
        : 'https://clashcalc.com';

    const canonicalHref = (lang === 'en')
        ? (formattedPath ? `${baseOrigin}/${formattedPath}` : `${baseOrigin}/`)
        : (formattedPath ? `${baseOrigin}/${lang}/${formattedPath}` : `${baseOrigin}/${lang}/`);

    if (window.location.pathname + window.location.search + window.location.hash !== newUrl) {
        const shouldReplace = replace || (typeof navigator !== 'undefined' && navigator.userActivation?.hasBeenActive === false);
        if (shouldReplace) {
            history.replaceState(null, '', newUrl);
        } else {
            history.pushState(null, '', newUrl);
        }
        languageUrlSyncHandler?.(window.location.pathname + window.location.search);
    }

    document.documentElement.lang = lang;

    /** @type {HTMLLinkElement | null} */
    let canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
        canonical.href = canonicalHref;
    }
}

/**
 * Normalizes a URL or path string into an unprefixed canonical pathname ending with '/'.
 * Strips protocol/origin, query string, hash fragment, trailing index.html, and language prefixes.
 *
 * @param {string} pathname
 * @returns {string}
 */
export function normalizeRoutePath(pathname) {
    if (typeof pathname !== 'string') return '/';

    let rawPath = pathname.trim();
    if (/^https?:\/\//i.test(rawPath)) {
        try {
            rawPath = new URL(rawPath).pathname;
        } catch {
            return '/';
        }
    }

    rawPath = rawPath.split(/[?#]/)[0] || '/';
    rawPath = rawPath.replace(/\/index\.html$/i, '') || '/';

    const segments = rawPath.split('/').filter(Boolean);
    if (segments.length > 0 && SUPPORTED_LANGUAGES.includes(segments[0].toLowerCase())) {
        segments.shift();
    }
    if (segments.length === 1 && segments[0].toLowerCase() === 'index.html') {
        segments.shift();
    }

    return segments.length === 0 ? '/' : `/${segments.join('/').toLowerCase()}/`;
}

/**
 * Finds the matching canonical application route descriptor for a given URL or pathname.
 *
 * @param {string | null | undefined} pathname
 * @returns {import('../data/appRoutesData.js').AppRouteDescriptor | null}
 */
export function findRouteByPath(pathname) {
    if (typeof pathname !== 'string') return null;
    const normalized = normalizeRoutePath(pathname);
    return APP_ROUTES.find(route => route.path === normalized) || null;
}

/**
 * Retrieves a canonical application route descriptor by route identifier.
 *
 * @param {string | null | undefined} routeId
 * @returns {import('../data/appRoutesData.js').AppRouteDescriptor | null}
 */
export function findRouteById(routeId) {
    if (typeof routeId !== 'string') return null;
    return APP_ROUTES.find(route => route.id === routeId) || null;
}

/**
 * Builds a clean localized route or legal href with optional player tag query attachment.
 *
 * @param {string} basePath
 * @param {{ lang?: string, playerTag?: string, preserveTag?: boolean }} [options]
 * @returns {string}
 */
export function buildLocalizedRouteHref(basePath, options = {}) {
    const normalizedPath = normalizeRoutePath(basePath);
    const requestedLang = (options.lang && SUPPORTED_LANGUAGES.includes(options.lang))
        ? options.lang
        : (getLanguageFromPath() || 'en');

    const legalRoute = APP_LEGAL_ROUTES.find(route => route.path === normalizedPath);
    const targetLang = (legalRoute && !legalRoute.supportedLanguages.includes(requestedLang))
        ? 'en'
        : requestedLang;

    const localizedPath = getLocalizedPath(targetLang, {
        pathname: normalizedPath,
        search: '',
        hash: ''
    });

    const routeDescriptor = findRouteByPath(normalizedPath);
    const shouldAttachTag = options.preserveTag === false
        ? false
        : Boolean(routeDescriptor?.supportsTag);

    if (!shouldAttachTag || !options.playerTag) {
        return localizedPath;
    }

    const cleanTag = normalizePlayerTag(options.playerTag);
    if (!cleanTag || cleanTag === 'DEFAULT0') {
        return localizedPath;
    }

    return `${localizedPath}?tag=${encodeURIComponent(cleanTag)}`;
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

    let lang = 'en';
    const firstSegment = pathSegments[0].toLowerCase();
    if (SUPPORTED_LANGUAGES.includes(firstSegment)) {
        lang = firstSegment;
        pathSegments.shift();
    }

    if (pathSegments.length === 0) return true;
    if (pathSegments.length === 1) {
        const subRoute = pathSegments[0].toLowerCase();
        if (subRoute === '404' || subRoute === '404.html') {
            return true;
        }
        const normalizedSubPath = `/${subRoute}/`;
        if (APP_ROUTES.some(route => route.path === normalizedSubPath)) {
            return true;
        }
        const legalMatch = APP_LEGAL_ROUTES.find(route => route.path === normalizedSubPath);
        if (legalMatch) {
            return legalMatch.supportedLanguages.includes(lang);
        }
    }

    return false;
}
