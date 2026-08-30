import { normalizePlayerTag } from './localStorageManager.js';

/**
 * Extracts and sanitizes player tag from URL query parameters.
 * @returns {string | null} Clean tag (e.g. '8PJYGUJC') or null if absent.
 */
export function getPlayerTagFromUrl() {
    if (typeof window === 'undefined' || !window.location) return null;
    try {
        const params = new URLSearchParams(window.location.search);
        const raw = params.get('tag') || params.get('p') || params.get('player');
        if (!raw) return null;
        const clean = normalizePlayerTag(raw);
        if (!clean || clean === 'DEFAULT0') return null;
        return clean;
    } catch {
        return null;
    }
}

/**
 * Synchronizes the active player tag to the browser URL search parameters without reloading.
 * @param {string | null} tag - Active player tag (e.g. '8PJYGUJC' or '#8PJYGUJC') or null.
 */
export function syncPlayerTagToUrl(tag) {
    if (typeof window === 'undefined' || !window.location || !window.history?.replaceState) return;
    try {
        const clean = normalizePlayerTag(tag);
        const url = new URL(window.location.href);
        if (!url.pathname.endsWith('/') && !url.pathname.includes('.')) {
            url.pathname = `${url.pathname}/`;
        }
        if (clean && clean !== 'DEFAULT0') {
            url.searchParams.set('tag', clean);
        } else {
            url.searchParams.delete('tag');
            url.searchParams.delete('p');
            url.searchParams.delete('player');
        }
        const newRelativeUrl = url.pathname + (url.search ? url.search : '') + url.hash;
        const currentRelativeUrl = window.location.pathname + window.location.search + window.location.hash;
        if (currentRelativeUrl !== newRelativeUrl) {
            window.history.replaceState(null, '', newRelativeUrl);
        }
    } catch {}
}
