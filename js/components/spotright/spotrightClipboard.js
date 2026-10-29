/**
 * Spotright Smart Clipboard Player Tag Detector.
 * Safely inspects system clipboard strictly when permissions are pre-granted (zero browser prompts).
 * Tier 4: Search Component Subsystem.
 */

import { normalizePlayerTag } from '../../core/storageKeys.js';
import { translate } from '../../i18n/translator.js';
import { setActivePlayerTag, updateSavedPlayerTags } from '../../core/playerStorage.js';
import { extractPlayerTag } from '../../utils/playerTagValidator.js';
import { syncPlayerTagToUrl } from '../../core/playerUrlRouter.js';
import {
    buildSpotrightUrl,
    focusAndHighlightTarget,
    getCurrentRouteContext
} from './spotrightNavigator.js';

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
        const ctx = getCurrentRouteContext();

        // On landing portal without tool engines loaded, perform clean navigation
        if (ctx.page === 'hub') {
            window.location.href = buildSpotrightUrl('orecalc', { tag: validTag });
            return { success: true, cleanTag: validTag };
        }

        // On active tool pages, sync player tag to URL without full-page reload
        syncPlayerTagToUrl(validTag);
        if (typeof document !== 'undefined') {
            document.dispatchEvent(new CustomEvent('app:playerDropdownSync'));
        }

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
 * Smoothly activates and highlights on the Hub (landing page), or navigates to the Hub from other pages.
 *
 * @param {string} cleanTag
 */
export function switchSavedVillage(cleanTag) {
    if (typeof window === 'undefined') return;
    const normalized = normalizePlayerTag(cleanTag);
    if (!normalized) return;

    const ctx = getCurrentRouteContext();

    try {
        setActivePlayerTag(normalized);
        updateSavedPlayerTags(normalized);
    } catch {}

    if (ctx.page === 'hub') {
        if (typeof document !== 'undefined') {
            const card = /** @type {HTMLElement | null} */ (document.querySelector(`.landing-account-card[data-tag="${normalized}"]`));
            if (card) {
                if (typeof card.click === 'function') {
                    card.click();
                }
                focusAndHighlightTarget(card, { pulseClass: 'is-pulse', durationMs: 1500 });
            }
        }
        return;
    }

    window.location.href = buildSpotrightUrl('hub', { tag: normalized });
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
        id: `action-clipboard-tag-${cleanTag}`,
        type: 'action',
        scopes: ['villages'],
        parent: 'global',
        title,
        canonicalTitle: `load village #${cleanTag.toLowerCase()}`,
        canonicalTokens: 'load village player tag',
        normalizedTitle: `${title.toLowerCase()} ${cleanTag.toLowerCase()} dorf spieler`,
        category: translate('player.tag') || 'Player Tag',
        icon: 'copy',
        iconType: 'svg',
        acronym: cleanTag.slice(0, 2).toLowerCase(),
        priorityTier: 100,
        isAsyncAction: true,
        execute: () => loadAndSwitchPlayerTag(cleanTag)
    };
}
