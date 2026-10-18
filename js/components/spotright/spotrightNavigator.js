/**
 * Spotright Route Topology, URL Builder, and Context-Aware Action Dispatcher.
 * Tier 4: Search Component Navigation Engine.
 */

import { getLanguageFromPath } from '../../core/languageRouter.js';
import { getSavedProfiles } from '../../core/playerStorage.js';
import { normalizePlayerTag } from '../../core/storageKeys.js';
import { heroData } from '../../data/heroData.js';
import { toCamelCase } from '../../utils/stringUtils.js';

/**
 * @typedef {'global' | 'hub' | 'orecalc' | 'hero-journey' | 'damagecalc'} SpotrightParent
 */

/**
 * @typedef {'page' | 'tab' | 'section' | 'modal' | 'action' | 'hero' | 'equipment' | 'village' | 'scope'} SpotrightItemType
 */

/** @type {Readonly<Record<Exclude<SpotrightParent, 'global'>, string>>} */
const PARENT_ROUTE_MAP = Object.freeze({
    hub: '/',
    orecalc: '/ore-calculator/',
    'hero-journey': '/hero-journey/',
    damagecalc: '/damage-calculator/'
});

/**
 * Returns localized route prefix based on active URL path.
 * @returns {string}
 */
export function getRoutePrefix() {
    if (typeof window === 'undefined') return '';
    const lang = getLanguageFromPath() || 'en';
    return lang === 'en' ? '' : `/${lang}`;
}

/**
 * Resolves active player tag from URL parameters.
 * @returns {string}
 */
export function getActiveUrlTag() {
    if (typeof window === 'undefined') return '';
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const tagFromUrl = urlParams.get('tag');
        if (tagFromUrl) return normalizePlayerTag(tagFromUrl);
    } catch {}
    return '';
}

/**
 * Resolves the current page parent identifier and active sub-tab from URL and DOM state.
 * @returns {{ page: Exclude<SpotrightParent, 'global'>, activeTab: string | null }}
 */
export function getCurrentRouteContext() {
    const currentPath = (typeof window !== 'undefined' && window.location?.pathname)
        ? window.location.pathname
        : '/';
    const cleanPath = currentPath.replace(/^\/(de|tr|zh)(\/|$)/, '/').replace(/\/+$/, '') || '/';

    /** @type {Exclude<SpotrightParent, 'global'>} */
    let page = 'hub';
    if (cleanPath.startsWith('/ore-calculator')) page = 'orecalc';
    else if (cleanPath.startsWith('/hero-journey')) page = 'hero-journey';
    else if (cleanPath.startsWith('/damage-calculator')) page = 'damagecalc';

    const rawHash = (typeof window !== 'undefined' && window.location?.hash)
        ? window.location.hash.replace(/^#/, '')
        : '';

    if (page === 'orecalc') {
        if (typeof document !== 'undefined' && typeof document.querySelector === 'function') {
            const activeBtn = document.querySelector('.tab-button.active[data-tab], .nav-button.active[data-tab]');
            const domTab = activeBtn?.getAttribute?.('data-tab') || /** @type {HTMLElement | null} */ (activeBtn)?.dataset?.tab;
            if (domTab) return { page, activeTab: domTab.replace(/-tab$/, '') };
        }
        if (['planner', 'income', 'equipment', 'home', 'settings'].includes(rawHash)) {
            return { page, activeTab: rawHash };
        }
        return { page, activeTab: 'home' };
    }

    if (page === 'damagecalc') {
        if (typeof document !== 'undefined' && typeof document.querySelector === 'function') {
            const activeBtn = document.querySelector('[data-tab].active, [data-tab].is-active');
            const domTab = activeBtn?.getAttribute?.('data-tab') || /** @type {HTMLElement | null} */ (activeBtn)?.dataset?.tab;
            if (domTab) return { page, activeTab: domTab };
        }
        if (rawHash === 'cluster_planner' || rawHash === 'zapquake') {
            return { page, activeTab: rawHash };
        }
        return { page, activeTab: 'zapquake' };
    }

    return { page, activeTab: null };
}

/**
 * Determines whether a Spotright item should be hidden in the given route context
 * because the user is already on that exact page/tab or outside a parent-only scope.
 *
 * @param {{
 *   type?: SpotrightItemType,
 *   parent?: SpotrightParent,
 *   defaultTab?: string,
 *   defaultTabs?: string[],
 *   tabId?: string,
 *   visibility?: 'always' | 'parent-only'
 * } | null | undefined} item
 * @param {{ page: Exclude<SpotrightParent, 'global'>, activeTab: string | null }} [ctx]
 * @returns {boolean}
 */
export function isSelfTarget(item, ctx = getCurrentRouteContext()) {
    if (!item) return false;
    if (item.visibility === 'parent-only' && item.parent && item.parent !== 'global') {
        return ctx.page !== item.parent;
    }
    if (item.type === 'page') {
        if (ctx.page !== item.parent) return false;
        if (Array.isArray(item.defaultTabs) && item.defaultTabs.length > 0) {
            return !ctx.activeTab || item.defaultTabs.includes(ctx.activeTab);
        }
        if (item.defaultTab) {
            return !ctx.activeTab || ctx.activeTab === item.defaultTab;
        }
        return true;
    }
    if (item.type === 'tab') {
        return ctx.page === item.parent && Boolean(item.tabId) && ctx.activeTab === item.tabId;
    }
    return false;
}

/**
 * Builds a localized, player-tag-preserving URL for any parent page, tab, or deep-link hash.
 *
 * @param {Exclude<SpotrightParent, 'global'>} targetParent
 * @param {{ tag?: string | null, hash?: string, preserveTag?: boolean }} [options]
 * @returns {string}
 */
export function buildSpotrightUrl(targetParent, options = {}) {
    const prefix = getRoutePrefix();
    const baseRoute = PARENT_ROUTE_MAP[targetParent] || '/';
    const resolvedTag = options.tag !== undefined
        ? options.tag
        : (options.preserveTag !== false ? getActiveUrlTag() : '');
    const query = resolvedTag ? `?tag=${encodeURIComponent(resolvedTag)}` : '';
    const cleanHash = options.hash ? `#${options.hash.replace(/^#/, '')}` : '';
    return `${prefix}${baseRoute}${query}${cleanHash}`;
}

/**
 * Smooth-scrolls an element into view and applies a temporary highlight pulse class.
 *
 * @param {Element | null | undefined} element
 * @param {{ pulseClass?: string, durationMs?: number, block?: ScrollLogicalPosition }} [options]
 * @returns {boolean}
 */
export function focusAndHighlightTarget(element, options = {}) {
    if (!element || typeof window === 'undefined') return false;
    const pulseClass = options.pulseClass || 'spotright-target-pulse';
    const durationMs = options.durationMs || 2000;
    const block = options.block || 'center';
    const raf = typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame.bind(window)
        : (cb) => cb();

    if (typeof element.scrollIntoView === 'function') {
        element.scrollIntoView({ behavior: 'smooth', block });
    }
    element.classList?.remove?.(pulseClass);
    raf(() => element.classList?.add?.(pulseClass));
    setTimeout(() => element.classList?.remove?.(pulseClass), durationMs);
    return true;
}

/**
 * Polls via requestAnimationFrame up to maxAttempts until findTarget returns a truthy element.
 * @param {() => Element | null | undefined} findTarget
 * @param {(el: Element) => void} onFound
 * @param {number} [maxAttempts=20]
 */
function pollDomTarget(findTarget, onFound, maxAttempts = 20) {
    const raf = (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function')
        ? window.requestAnimationFrame.bind(window)
        : (cb) => cb();
    let attempts = 0;
    const step = () => {
        const el = findTarget();
        if (!el && attempts < maxAttempts) {
            attempts++;
            raf(step);
            return;
        }
        if (el) onFound(el);
    };
    raf(step);
}

/**
 * Navigates to a page, sub-tab, or section using in-page tab switching when on the same parent page
 * or tag-preserving cross-page URL routing when on another page.
 *
 * @param {{
 *   parent: Exclude<SpotrightParent, 'global'>,
 *   defaultTab?: string,
 *   tabId?: string,
 *   sectionId?: string
 * }} target
 */
export function navigateToTarget(target) {
    if (typeof window === 'undefined') return;
    const ctx = getCurrentRouteContext();

    if (ctx.page === target.parent && typeof document !== 'undefined') {
        if (target.sectionId) {
            const sectionEl = document.getElementById(target.sectionId);
            if (sectionEl && typeof sectionEl.scrollIntoView === 'function') {
                sectionEl.scrollIntoView({ behavior: 'smooth' });
            } else {
                window.location.hash = `#${target.sectionId}`;
            }
            return;
        }

        const desiredTab = target.tabId || target.defaultTab;
        if (target.parent === 'orecalc' && desiredTab) {
            const selector = desiredTab === 'home'
                ? '.tab-button[data-tab="home"], .nav-button[data-tab="home"], .tab-button[data-tab="equipment"], .nav-button[data-tab="equipment"]'
                : `.tab-button[data-tab="${desiredTab}"], .nav-button[data-tab="${desiredTab}"]`;
            const btn = /** @type {HTMLElement | null} */ (document.querySelector(selector));
            if (btn && typeof btn.click === 'function') {
                btn.click();
                return;
            }
        }

        if (target.parent === 'damagecalc' && desiredTab) {
            const btn = /** @type {HTMLElement | null} */ (document.querySelector(`[data-tab="${desiredTab}"]`));
            if (btn && typeof btn.click === 'function') {
                btn.click();
                return;
            }
        }
    }

    const hash = target.sectionId || (target.tabId && target.tabId !== target.defaultTab ? target.tabId : '');
    window.location.href = buildSpotrightUrl(target.parent, { hash });
}

/**
 * Enables and highlights an equipment source in the Damage Calculator Offense Modal.
 * @param {string} snakeKey - Equipment snake_case key (e.g. 'fireball', 'giant_arrow').
 */
export async function openDamageCalcEquipment(snakeKey) {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    try {
        const { damageCalcState, persistState } = await import('../damage/damageCalcState.js');
        if (damageCalcState.offense?.enabledSources) {
            /** @type {Record<string, any>} */ (damageCalcState.offense.enabledSources)[snakeKey] = true;
        }
        damageCalcState.modalActiveTab = 'offense';
        if (typeof persistState === 'function') persistState();

        const editBtn = document.getElementById('calc-edit-offense-btn');
        if (editBtn && typeof editBtn.click === 'function') {
            editBtn.click();
        } else {
            const modal = document.getElementById('calc-offense-modal');
            const modalBody = document.getElementById('calc-offense-modal-body');
            if (modal && modalBody) {
                const { renderEditLevelsModal } = await import('../damage/damageCalcModalsDisplay.js');
                const { attachEditLevelsModalListeners } = await import('../damage/damageCalcModalsInputs.js');
                const { openModal } = await import('../../utils/modalHistoryManager.js');

                modalBody.dataset.isDirty = 'false';
                renderEditLevelsModal(damageCalcState, modalBody);
                attachEditLevelsModalListeners(damageCalcState, modalBody, () => {});
                openModal(modal);
            }
        }

        const offenseTabBtn = /** @type {HTMLElement | null} */ (document.querySelector('.segmented-btn[data-modal-tab="offense"]'));
        if (offenseTabBtn && !offenseTabBtn.classList.contains('active') && typeof offenseTabBtn.click === 'function') {
            offenseTabBtn.click();
        }

        pollDomTarget(
            () => document.querySelector(`.calc-offense-modal-row[data-equipment-id="${snakeKey}"]`),
            (row) => {
                focusAndHighlightTarget(row);
                const input = /** @type {HTMLElement | null} */ (row.querySelector('input[type="number"], .calc-stepper-value'));
                if (input && typeof input.focus === 'function') input.focus();
            }
        );
    } catch (err) {
        console.error('Failed to open damage calculator equipment modal:', err);
    }
}

/**
 * Handles smooth scrolling and temporary pulsing highlight on an OreCalc equipment card.
 * @param {string} heroName
 * @param {string} equipName
 * @param {string} equipKey
 */
export function navigateToEquipment(heroName, equipName, equipKey) {
    if (typeof window === 'undefined') return;
    if (getCurrentRouteContext().page === 'orecalc') {
        const equipTabBtn = /** @type {HTMLElement | null} */ (document.querySelector('.tab-button[data-tab="equipment"], .nav-button[data-tab="equipment"]'));
        if (equipTabBtn && typeof equipTabBtn.click === 'function' && !equipTabBtn.classList?.contains('active')) {
            equipTabBtn.click();
        }

        pollDomTarget(
            () => {
                const heroCard = document.querySelector(`[data-hero-name="${heroName}"]`);
                return heroCard?.querySelector(`[data-equip-name="${equipName}"]`) || heroCard;
            },
            (targetEl) => {
                const heroCard = document.querySelector(`[data-hero-name="${heroName}"]`);
                const equipRow = heroCard?.querySelector(`[data-equip-name="${equipName}"]`);
                if (heroCard?.classList?.contains?.('hero-hidden')) {
                    heroCard.classList.remove('hero-hidden');
                }
                if (equipRow?.classList?.contains?.('eq-hidden')) {
                    equipRow.classList.remove('eq-hidden');
                    import('../equipment/heroCard.js').then(({ revealEquipmentTemporarily }) => {
                        revealEquipmentTemporarily(heroName, equipName);
                    }).catch(() => {});
                }
                focusAndHighlightTarget(targetEl);
                const raf = typeof window.requestAnimationFrame === 'function' ? window.requestAnimationFrame.bind(window) : (cb) => cb();
                raf(() => {
                    const input = /** @type {HTMLInputElement | null} */ (equipRow?.querySelector('input[type="number"]'));
                    if (input && typeof input.focus === 'function' && input.offsetParent !== null) {
                        input.focus();
                        if (typeof input.select === 'function') input.select();
                    }
                });
            }
        );
        return;
    }

    window.location.href = buildSpotrightUrl('orecalc', { hash: `equip-${equipKey}` });
}

/**
 * Dispatches equipment activation across multiple registered parent contexts.
 * @param {{
 *   heroName: string,
 *   equipName: string,
 *   equipKey: string,
 *   damageEquipKey?: string,
 *   parents: SpotrightParent[]
 * }} config
 */
export function dispatchEquipmentAction(config) {
    const ctx = getCurrentRouteContext();
    if (ctx.page === 'damagecalc' && config.parents.includes('damagecalc') && config.damageEquipKey) {
        openDamageCalcEquipment(config.damageEquipKey);
        return;
    }
    navigateToEquipment(config.heroName, config.equipName, config.equipKey);
}

/**
 * Handles smooth scrolling to target hero card on OreCalc or deep-links from other pages.
 * @param {string} heroName
 * @param {string} heroKey
 */
export function navigateToHero(heroName, heroKey) {
    if (typeof window === 'undefined') return;
    if (getCurrentRouteContext().page === 'orecalc') {
        const equipTabBtn = /** @type {HTMLElement | null} */ (document.querySelector('.tab-button[data-tab="equipment"], .nav-button[data-tab="equipment"]'));
        if (equipTabBtn && typeof equipTabBtn.click === 'function' && !equipTabBtn.classList?.contains('active')) {
            equipTabBtn.click();
        }

        pollDomTarget(
            () => document.querySelector(`[data-hero-name="${heroName}"]`),
            (heroCard) => {
                if (heroCard.classList?.contains?.('hero-hidden')) {
                    heroCard.classList.remove('hero-hidden');
                }
                focusAndHighlightTarget(heroCard);
            }
        );
        return;
    }

    window.location.href = buildSpotrightUrl('orecalc', { hash: `hero-${heroKey}` });
}

/**
 * Resolves incoming Spotright deep-link hash on page load.
 */
export function handleSpotrightDeepLink() {
    if (typeof window === 'undefined' || !window.location.hash) return;
    const hash = window.location.hash;

    if (hash.startsWith('#equip-')) {
        const targetKey = hash.substring(7);
        for (const heroKey in heroData) {
            const hero = heroData[heroKey];
            const equip = hero.equipment.find(e => toCamelCase(e.name) === targetKey || e.key === targetKey);
            if (equip) {
                navigateToEquipment(hero.name, equip.name, targetKey);
                break;
            }
        }
    } else if (hash.startsWith('#hero-')) {
        const targetHeroKey = hash.substring(6);
        const hero = heroData[targetHeroKey];
        if (hero) navigateToHero(hero.name, targetHeroKey);
    }
}

/**
 * Opens the header settings popover across all pages.
 */
export function executeSettingsAction() {
    if (typeof document === 'undefined') return;
    const headerAccountBtn = document.getElementById('header-account-btn') || document.getElementById('app-settings-btn');
    if (headerAccountBtn && typeof headerAccountBtn.click === 'function') {
        const popover = document.getElementById('app-account-popover');
        if (!popover?.classList?.contains?.('is-open')) {
            headerAccountBtn.click();
        }
        const prefsDetails = /** @type {HTMLDetailsElement | null} */ (document.getElementById('account-popover-prefs-details'));
        if (prefsDetails) prefsDetails.open = true;
        return;
    }
    import('../common/appSettings.js').then(({ toggleSettingsPopover }) => {
        toggleSettingsPopover(true);
    }).catch(() => {});
}

/**
 * Opens the header account popover when signed in, or the Sign-In modal when logged out.
 */
export async function executeAccountSyncAction() {
    if (typeof document === 'undefined') return;
    const headerAccountBtn = document.getElementById('header-account-btn');
    const { isAuthenticated } = await import('../../services/authClientService.js');
    const signedIn = isAuthenticated() || Boolean(headerAccountBtn?.classList?.contains?.('is-authenticated'));

    if (signedIn && headerAccountBtn && typeof headerAccountBtn.click === 'function') {
        const popover = document.getElementById('app-account-popover');
        if (!popover?.classList?.contains?.('is-open')) {
            headerAccountBtn.click();
        }
        const prefsDetails = /** @type {HTMLDetailsElement | null} */ (document.getElementById('account-popover-prefs-details'));
        if (prefsDetails) prefsDetails.open = false;
        return;
    }

    const { openAuthModal } = await import('../auth/authModalInputs.js');
    openAuthModal();
}

/**
 * Opens the village management UI appropriate for the active page context.
 */
export async function executeManageVillagesAction() {
    if (typeof document === 'undefined') return;
    const ctx = getCurrentRouteContext();
    if (ctx.page === 'hub') {
        const manageBtn = document.getElementById('landing-manage-accounts-btn');
        const accountsList = document.getElementById('landing-accounts-list') || document.getElementById('landing-accounts-section');
        if (manageBtn && typeof manageBtn.click === 'function') manageBtn.click();
        if (accountsList && typeof accountsList.scrollIntoView === 'function') {
            accountsList.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }
    const playerDropdownBtn = document.getElementById('player-dropdown-button');
    if (playerDropdownBtn && typeof playerDropdownBtn.click === 'function') {
        playerDropdownBtn.click();
        return;
    }
    const addPlayerBtn = /** @type {HTMLElement | null} */ (document.getElementById('add-player-button') || document.querySelector('[data-action="add-player"]'));
    if (addPlayerBtn && typeof addPlayerBtn.click === 'function') {
        addPlayerBtn.click();
        return;
    }
    if (ctx.page === 'orecalc') {
        const { showAddPlayerModal } = await import('../player/playerModal.js');
        showAddPlayerModal();
    } else {
        window.location.href = buildSpotrightUrl('orecalc', { hash: 'player', preserveTag: false });
    }
}

/**
 * Opens the Add Player input/modal appropriate for the active page context.
 */
export async function executeAddPlayerAction() {
    if (typeof document === 'undefined') return;
    const ctx = getCurrentRouteContext();
    if (ctx.page === 'hub') {
        const searchInput = /** @type {HTMLInputElement | null} */ (document.getElementById('landing-search-input'));
        const addBtn = document.getElementById('landing-toggle-add-btn');
        if (addBtn && typeof addBtn.click === 'function') addBtn.click();
        if (searchInput) {
            if (typeof searchInput.scrollIntoView === 'function') searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (typeof searchInput.focus === 'function') searchInput.focus();
        }
        return;
    }
    const addPlayerBtn = /** @type {HTMLElement | null} */ (document.getElementById('add-player-button') || document.querySelector('[data-action="add-player"]'));
    if (addPlayerBtn && typeof addPlayerBtn.click === 'function') {
        addPlayerBtn.click();
        return;
    }
    const modal = /** @type {HTMLDialogElement | null} */ (document.getElementById('add-player-modal'));
    if (modal && typeof modal.showModal === 'function') {
        const { openModal } = await import('../../utils/modalHistoryManager.js');
        openModal(modal);
        return;
    }
    window.location.href = buildSpotrightUrl('orecalc', { hash: 'player', preserveTag: false });
}

/**
 * Triggers a cross-page player data refresh for the active or primary saved village.
 */
export async function executeRefreshVillageAction() {
    const targetTag = getActiveUrlTag() || (getSavedProfiles()[0]?.cleanTag) || null;
    const { refreshActivePlayerData } = await import('../player/playerRefreshController.js');
    await refreshActivePlayerData({ force: true, background: false, targetTag });
}
