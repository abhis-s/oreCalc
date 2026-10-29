/**
 * Brand Page Pill Tools Dropdown Controller.
 * Manages the interactive dropdown attached to the header brand pill for switching primary tools.
 * Tier 4: Common UI Component Controller.
 */

import { resolveAppRoute } from '../../core/appShellNavigator.js';
import { getLanguageFromPath } from '../../core/languageRouter.js';
import { getPlayerTagFromUrl } from '../../core/playerUrlRouter.js';
import { getSavedProfiles } from '../../core/playerStorage.js';
import { translate } from '../../i18n/translator.js';
import { escapeHTML } from '../../utils/stringUtils.js';

/**
 * @typedef {Object} BrandToolDescriptor
 * @property {'hub' | 'ore-calculator' | 'hero-journey' | 'damage-calculator' | 'account'} id
 * @property {string} path
 * @property {string} labelKey
 * @property {string} defaultLabel
 * @property {string} icon
 * @property {boolean} [supportsTag]
 */

/**
 * Canonical registry of primary tools accessible via the brand pill dropdown.
 * @type {BrandToolDescriptor[]}
 */
export const BRAND_TOOLS_REGISTRY = [
    {
        id: 'hub',
        path: '/',
        labelKey: 'nav.dock.hub',
        defaultLabel: 'Hub',
        icon: 'home-filled'
    },
    {
        id: 'ore-calculator',
        path: '/ore-calculator/',
        labelKey: 'app.brandToolName',
        defaultLabel: 'OreCalc',
        icon: 'equipment-filled',
        supportsTag: true
    },
    {
        id: 'hero-journey',
        path: '/hero-journey/',
        labelKey: 'views.heroJourney.widget.title',
        defaultLabel: "Hero's Journey",
        icon: 'timeline',
        supportsTag: true
    },
    {
        id: 'damage-calculator',
        path: '/damage-calculator/',
        labelKey: 'views.damageCalc.offense.equipmentDamageBadge',
        defaultLabel: 'Equipment Damage',
        icon: 'swords-filled',
        supportsTag: true
    },
    {
        id: 'account',
        path: '/account/',
        labelKey: 'auth.account',
        defaultLabel: 'Account',
        icon: 'user-filled'
    }
];

/**
 * Builds localized href destination with optional active player tag parameter.
 *
 * @param {BrandToolDescriptor} tool
 * @param {string} [currentLang='en']
 * @param {string} [playerTag='']
 * @returns {string}
 */
export function buildBrandToolHref(tool, currentLang = 'en', playerTag = '') {
    const langPrefix = currentLang === 'en' ? '' : `/${currentLang}`;
    const cleanTag = playerTag ? playerTag.replace(/^#/, '').trim() : '';
    const tagQuery = (tool.supportsTag && cleanTag) ? `?tag=${encodeURIComponent(cleanTag)}` : '';

    if (tool.path === '/') {
        return langPrefix ? `${langPrefix}/` : '/';
    }

    return `${langPrefix}${tool.path}${tagQuery}`;
}

/**
 * Renders dropdown item markup filtering out the active route.
 *
 * @param {HTMLElement} menuEl
 * @param {string | null} [currentRouteId=null]
 * @param {string} [playerTag='']
 * @param {string} [lang='en']
 */
export function renderBrandToolsDropdown(menuEl, currentRouteId = null, playerTag = '', lang = 'en') {
    if (!menuEl) return;

    const availableTools = BRAND_TOOLS_REGISTRY.filter(tool => tool.id !== currentRouteId);

    menuEl.innerHTML = availableTools.map(tool => {
        const href = buildBrandToolHref(tool, lang, playerTag);
        const translatedLabel = translate(tool.labelKey) || tool.defaultLabel;
        const safeLabel = escapeHTML(translatedLabel);
        const safeHref = escapeHTML(href);
        const safeIcon = escapeHTML(tool.icon);
        const safeId = escapeHTML(tool.id);

        return `<a href="${safeHref}" class="brand-tools-dropdown__item" role="menuitem" tabindex="0" data-tool-id="${safeId}">` +
            `<clashcalc-assets-svg name="${safeIcon}" class="brand-tools-dropdown__item-icon"></clashcalc-assets-svg>` +
            `<span class="brand-tools-dropdown__item-label">${safeLabel}</span>` +
        `</a>`;
    }).join('');
}

/**
 * Programmatically closes the brand tools dropdown menu.
 *
 * @param {HTMLElement} [wrapperEl]
 */
export function closeBrandToolsDropdown(wrapperEl) {
    const wrapper = wrapperEl || (typeof document !== 'undefined' ? document.querySelector('.brand-page-pill-wrapper') : null);
    if (!wrapper) return;

    const menuEl = wrapper.querySelector('#brand-tools-dropdown');
    const buttonEl = wrapper.querySelector('#brand-page-pill-btn, .brand-page-pill');

    if (menuEl) {
        menuEl.hidden = true;
        menuEl.classList.remove('is-open');
    }

    if (buttonEl) {
        buttonEl.setAttribute('aria-expanded', 'false');
        buttonEl.classList.remove('is-active');
    }
}

/**
 * Toggles visibility state of the brand tools dropdown menu.
 *
 * @param {HTMLElement} wrapper
 * @param {boolean} [forceState]
 */
export function toggleBrandToolsDropdown(wrapper, forceState) {
    if (!wrapper) return;

    const menuEl = /** @type {HTMLElement | null} */ (wrapper.querySelector('#brand-tools-dropdown'));
    const buttonEl = /** @type {HTMLElement | null} */ (wrapper.querySelector('#brand-page-pill-btn, .brand-page-pill'));
    if (!menuEl || !buttonEl) return;

    const isCurrentlyOpen = menuEl.classList.contains('is-open');
    const shouldOpen = typeof forceState === 'boolean' ? forceState : !isCurrentlyOpen;

    if (shouldOpen) {
        const pathname = typeof window !== 'undefined' ? window.location?.pathname || '/' : '/';
        const currentRoute = resolveAppRoute(pathname);
        const currentLang = getLanguageFromPath() || 'en';
        const urlTag = typeof window !== 'undefined' ? getPlayerTagFromUrl() : '';
        const savedProfiles = getSavedProfiles();
        const fallbackTag = (savedProfiles && savedProfiles.length > 0) ? savedProfiles[0].tag : '';
        const effectiveTag = urlTag || fallbackTag || '';

        renderBrandToolsDropdown(menuEl, currentRoute, effectiveTag, currentLang);

        menuEl.hidden = false;
        menuEl.classList.add('is-open');
        buttonEl.setAttribute('aria-expanded', 'true');
        buttonEl.classList.add('is-active');

        // Focus first menu item for keyboard accessibility
        const firstItem = /** @type {HTMLAnchorElement | null} */ (menuEl.querySelector('.brand-tools-dropdown__item'));
        firstItem?.focus();
    } else {
        closeBrandToolsDropdown(wrapper);
    }
}

/**
 * Initializes interactive behaviors for the brand tools dropdown menu.
 *
 * @param {Object} [options]
 * @param {HTMLElement | null} [options.container] - Header or wrapper container element.
 * @returns {() => void} Teardown cleanup function.
 */
export function initBrandToolsDropdown(options = {}) {
    if (typeof document === 'undefined') return () => {};

    const container = options.container || document;
    const wrapper = /** @type {HTMLElement | null} */ (container.querySelector('.brand-page-pill-wrapper'));
    const buttonEl = /** @type {HTMLElement | null} */ (container.querySelector('#brand-page-pill-btn, .brand-page-pill'));
    const menuEl = /** @type {HTMLElement | null} */ (container.querySelector('#brand-tools-dropdown'));

    if (!buttonEl || !menuEl || !wrapper) {
        return () => {};
    }

    // Guard against duplicate listener binding on the same DOM element
    if (buttonEl.dataset.dropdownInitialized === 'true') {
        return () => closeBrandToolsDropdown(wrapper);
    }
    buttonEl.dataset.dropdownInitialized = 'true';

    /**
     * @param {MouseEvent} event
     */
    const handleButtonClick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleBrandToolsDropdown(wrapper);
    };

    /**
     * @param {KeyboardEvent} event
     */
    const handleButtonKeyDown = (event) => {
        if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleBrandToolsDropdown(wrapper, true);
        } else if (event.key === 'Escape') {
            closeBrandToolsDropdown(wrapper);
        }
    };

    /**
     * @param {PointerEvent} event
     */
    const handleDocumentPointerDown = (event) => {
        const target = /** @type {Node | null} */ (event.target);
        if (target && !wrapper.contains(target)) {
            closeBrandToolsDropdown(wrapper);
        }
    };

    /**
     * @param {KeyboardEvent} event
     */
    const handleMenuKeyDown = (event) => {
        const items = Array.from(menuEl.querySelectorAll('.brand-tools-dropdown__item'));
        if (items.length === 0) return;

        const currentIndex = items.indexOf(/** @type {HTMLAnchorElement} */ (document.activeElement));

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            const nextIndex = (currentIndex + 1) % items.length;
            /** @type {HTMLAnchorElement} */ (items[nextIndex])?.focus();
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            const prevIndex = (currentIndex - 1 + items.length) % items.length;
            /** @type {HTMLAnchorElement} */ (items[prevIndex])?.focus();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            closeBrandToolsDropdown(wrapper);
            buttonEl.focus();
        } else if (event.key === 'Tab') {
            if (event.shiftKey) {
                if (currentIndex > 0) {
                    event.preventDefault();
                    /** @type {HTMLAnchorElement} */ (items[currentIndex - 1])?.focus();
                } else {
                    closeBrandToolsDropdown(wrapper);
                    buttonEl.focus();
                }
            } else {
                if (currentIndex >= 0 && currentIndex < items.length - 1) {
                    event.preventDefault();
                    /** @type {HTMLAnchorElement} */ (items[currentIndex + 1])?.focus();
                } else {
                    closeBrandToolsDropdown(wrapper);
                }
            }
        }
    };

    /**
     * @param {MouseEvent} event
     */
    const handleMenuClick = (event) => {
        const item = /** @type {HTMLElement | null} */ (event.target)?.closest('.brand-tools-dropdown__item');
        if (item) {
            closeBrandToolsDropdown(wrapper);
        }
    };

    buttonEl.addEventListener('click', handleButtonClick);
    buttonEl.addEventListener('keydown', handleButtonKeyDown);
    menuEl.addEventListener('keydown', handleMenuKeyDown);
    menuEl.addEventListener('click', handleMenuClick);
    document.addEventListener('pointerdown', handleDocumentPointerDown);

    return () => {
        delete buttonEl.dataset.dropdownInitialized;
        buttonEl.removeEventListener('click', handleButtonClick);
        buttonEl.removeEventListener('keydown', handleButtonKeyDown);
        menuEl.removeEventListener('keydown', handleMenuKeyDown);
        menuEl.removeEventListener('click', handleMenuClick);
        document.removeEventListener('pointerdown', handleDocumentPointerDown);
        closeBrandToolsDropdown(wrapper);
    };
}
