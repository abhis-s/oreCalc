/**
 * Spotright Smart Clipboard Player Tag Detector.
 * Safely inspects system clipboard strictly when permissions are pre-granted (zero browser prompts).
 * Tier 4: Search Component Subsystem.
 */

import { normalizePlayerTag } from '../../core/storageKeys.js';
import { getLanguageFromPath } from '../../core/languageRouter.js';
import { translate } from '../../i18n/translator.js';

/** Base32 character set used for official Supercell player tags */
const VALID_TAG_PATTERN = /^[0289CGJLOPQRUVY]{3,12}$/;

/**
 * Returns localized route prefix based on active URL path.
 * @returns {string}
 */
function getRoutePrefix() {
    if (typeof window === 'undefined') return '';
    const lang = getLanguageFromPath() || 'en';
    return lang === 'en' ? '' : `/${lang}`;
}

/**
 * Extracts and validates a Clash of Clans player tag from raw text or profile URL.
 *
 * @param {string} rawText
 * @returns {string | null} Normalized clean player tag (e.g. '8PJYGUJC') or null.
 */
export function extractPlayerTag(rawText) {
    if (!rawText || typeof rawText !== 'string') return null;

    let candidate = rawText.trim();
    if (!candidate) return null;

    // Detect and extract tag parameter from official Clash of Clans profile share URLs
    if (candidate.includes('link.clashofclans.com') || candidate.includes('tag=')) {
        try {
            const match = candidate.match(/[?&]tag=([^&#\s]+)/i);
            if (match && match[1]) {
                candidate = decodeURIComponent(match[1]);
            }
        } catch {
            return null;
        }
    }

    // Extract tag if embedded in text with a hash (e.g. "Tag: #8PJYGUJC")
    const hashMatch = candidate.match(/#([0289CGJLOPQRUVY]{3,12})\b/i);
    if (hashMatch && hashMatch[1]) {
        candidate = hashMatch[1];
    }

    const cleanTag = normalizePlayerTag(candidate);
    if (!cleanTag || cleanTag === 'DEFAULT0') return null;

    if (VALID_TAG_PATTERN.test(cleanTag)) {
        return cleanTag;
    }

    return null;
}

/**
 * Detects whether a valid player tag is present on the clipboard.
 * Guarded to execute ONLY if permission is already strictly granted, avoiding prompt dialogues.
 *
 * @returns {Promise<string | null>}
 */
export async function detectClipboardPlayerTag() {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
        return null;
    }

    try {
        // Defensive check: Query permission only if query API is available
        if (navigator.permissions?.query) {
            const permission = await navigator.permissions.query({ name: /** @type {any} */ ('clipboard-read') });
            if (permission?.state !== 'granted') {
                return null;
            }
        } else {
            // If permissions.query is unsupported, do not call readText to prevent browser prompt
            return null;
        }

        const clipboardContent = await navigator.clipboard.readText();
        return extractPlayerTag(clipboardContent);
    } catch {
        // Platform unsupported permission name (Safari/Firefox) or security denial
        return null;
    }
}

/**
 * Asynchronously loads a player tag using loadAndProcessPlayerData.
 * Updates in-memory state and route without a destructive page reload on tool pages.
 *
 * @param {string} cleanTag
 * @returns {Promise<{ success: boolean, message?: string, cleanTag?: string }>}
 */
export async function loadAndSwitchPlayerTag(cleanTag) {
    if (typeof window === 'undefined') {
        return { success: false, message: 'Window is undefined' };
    }
    const normalized = normalizePlayerTag(cleanTag);
    if (!normalized || normalized === 'DEFAULT0') {
        return { success: false, message: translate('apiErrors.invalidTag') };
    }

    try {
        const { loadAndProcessPlayerData } = await import('../../services/serverResponseHandler.js');
        const result = await loadAndProcessPlayerData(normalized);

        if (!result || !result.success) {
            return {
                success: false,
                message: result?.message || translate('apiErrors.notFound')
            };
        }

        const validTag = result.cleanTag || normalized;
        const prefix = getRoutePrefix();
        const path = window.location.pathname;

        // On landing portal without tool engines loaded, perform clean navigation
        if (path === '/' || path === `${prefix}` || path === `${prefix}/`) {
            window.location.href = `${prefix}/ore-calculator/?tag=${validTag}`;
            return { success: true, cleanTag: validTag };
        }

        // On active tool pages, sync player tag to URL without full-page reload
        const { syncPlayerTagToUrl } = await import('../../core/playerUrlRouter.js');
        syncPlayerTagToUrl(validTag);

        return { success: true, cleanTag: validTag };
    } catch (err) {
        return {
            success: false,
            message: err?.message ? translate(err.message) : translate('apiErrors.notFound')
        };
    }
}

/**
 * Switches the active player profile to an already saved village.
 * Uses in-memory state switching on Ore Calculator, or clean navigation on landing/other pages.
 *
 * @param {string} cleanTag
 */
export function switchSavedVillage(cleanTag) {
    if (typeof window === 'undefined') return;
    const normalized = normalizePlayerTag(cleanTag);
    if (!normalized) return;

    const prefix = getRoutePrefix();
    const path = window.location.pathname;

    if (path === '/' || path === `${prefix}` || path === `${prefix}/`) {
        window.location.href = `${prefix}/ore-calculator/?tag=${normalized}`;
        return;
    }

    if (path.includes('/damage-calculator')) {
        window.location.href = `${prefix}/damage-calculator/?tag=${normalized}`;
    } else if (path.includes('/hero-journey')) {
        window.location.href = `${prefix}/hero-journey/?tag=${normalized}`;
    } else {
        import('../../core/stateManager.js').then(({ switchActivePlayer }) => {
            import('../../core/playerStorage.js').then(({ updateSavedPlayerTags }) => {
                import('../../core/playerUrlRouter.js').then(({ syncPlayerTagToUrl }) => {
                    switchActivePlayer(normalized);
                    updateSavedPlayerTags(normalized);
                    syncPlayerTagToUrl(normalized);
                    import('../player/playerRefreshController.js').then(({ refreshActivePlayerData }) => {
                        void refreshActivePlayerData({ background: true, targetTag: normalized });
                    }).catch(() => {});
                });
            });
        }).catch(() => {
            window.location.href = `${prefix}/ore-calculator/?tag=${normalized}`;
        });
    }
}

/**
 * Navigates to or switches the active tool route with the selected player tag parameter.
 * Backward-compatible helper routing to switchSavedVillage.
 *
 * @param {string} cleanTag
 */
export function switchOrLoadPlayerTag(cleanTag) {
    switchSavedVillage(cleanTag);
}

/**
 * Constructs a Spotright search item for a detected clipboard player tag.
 *
 * @param {string} cleanTag
 * @returns {import('./spotrightRegistry.js').SpotrightItem}
 */
export function createClipboardSpotrightItem(cleanTag) {
    const rawTitle = translate('views.spotright.loadVillageTag', { tag: cleanTag });
    const title = (rawTitle && rawTitle !== 'views.spotright.loadVillageTag')
        ? rawTitle
        : `Load Village #${cleanTag}`;
    return {
        id: `clipboard-tag-${cleanTag}`,
        title,
        canonicalTitle: `load village #${cleanTag.toLowerCase()}`,
        canonicalTokens: 'load village player tag',
        normalizedTitle: `${title.toLowerCase()} ${cleanTag.toLowerCase()} dorf spieler`,
        category: translate('player.tag') || 'Player Tag',
        icon: 'copy',
        iconType: 'svg',
        acronym: cleanTag.slice(0, 2).toLowerCase(),
        entityType: 'nav',
        priorityTier: 100,
        isAsyncAction: true,
        execute: () => loadAndSwitchPlayerTag(cleanTag)
    };
}
