import { translate } from '../../i18n/translator.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { getSVG } from '../../utils/svgManager.js';
import { formatDisplayTag, normalizePlayerTag } from '../../core/localStorageManager.js';

let cachedBrandTitleWidth = 0;
let cachedSeparatorWidth = 0;
let cachedPillWidth = 0;
let cachedActionsWidth = 0;

/**
 * Invalidates cached header dimension metrics when language or content changes.
 */
export function resetHeaderWidthCache() {
    cachedBrandTitleWidth = 0;
    cachedSeparatorWidth = 0;
    cachedPillWidth = 0;
    cachedActionsWidth = 0;
}

/**
 * Dynamically adjusts brand compact and stacked state based on exact mathematical geometry.
 */
export function updateHeaderLayout() {
    const headerInner = document.querySelector('.hero-journey-page__header-inner');
    const brand = document.querySelector('.hero-journey-page__brand');
    const brandTitle = brand?.querySelector('.brand-title-link');
    const separator = brand?.querySelector('.brand-separator');
    const pill = brand?.querySelector('.brand-page-pill');
    const actions = document.querySelector('.hero-journey-page__header-actions');
    const searchBtn = document.querySelector('.hj-track-btn');
    if (!headerInner || !brand || !actions) return;

    const containerWidth = headerInner.clientWidth;
    if (containerWidth <= 0) return;

    // Measure and cache element dimensions when visible
    if (brandTitle && brandTitle.offsetWidth > 0) {
        cachedBrandTitleWidth = brandTitle.offsetWidth;
    }
    if (separator && separator.offsetWidth > 0) {
        cachedSeparatorWidth = separator.offsetWidth;
    }
    if (pill && pill.offsetWidth > 0) {
        cachedPillWidth = pill.offsetWidth;
    }
    if (actions.offsetWidth > 0) {
        cachedActionsWidth = actions.offsetWidth;
    }

    const brandTitleWidth = cachedBrandTitleWidth || 75;
    const separatorWidth = cachedSeparatorWidth || 8;
    const pillWidth = cachedPillWidth || 105;
    const actionsWidth = cachedActionsWidth || 80;

    // Minimum comfortable width for search form in single-row layout
    const minSearchInputWidth = 145;
    const searchBtnWidth = (searchBtn && searchBtn.offsetWidth > 0 ? searchBtn.offsetWidth : 58);
    const searchExtra = 56;
    const minSearchWidth = minSearchInputWidth + searchBtnWidth + searchExtra;

    const gap = 16;
    const stackedGap = 16;

    // Brand full width (title + separator + pill + internal margins/gaps)
    const fullBrandWidth = brandTitleWidth + separatorWidth + pillWidth + 12;
    const compactBrandWidth = brandTitleWidth;

    // Width needed to fit all elements in a single row with full brand pill
    const singleRowFullWidth = fullBrandWidth + minSearchWidth + actionsWidth + (2 * gap);
    // Width needed to fit in a single row with compact brand (pill hidden)
    const singleRowCompactWidth = compactBrandWidth + minSearchWidth + actionsWidth + (2 * gap);

    let nextStacked = false;
    let nextCompact = false;

    if (containerWidth >= singleRowFullWidth) {
        nextStacked = false;
        nextCompact = false;
    } else if (containerWidth >= singleRowCompactWidth) {
        nextStacked = false;
        nextCompact = true;
    } else {
        // Single row cannot fit -> Stack into 2 rows (Row 1: Brand + Actions, Row 2: Search Form)
        nextStacked = true;
        const row1Needed = fullBrandWidth + actionsWidth + stackedGap;
        nextCompact = containerWidth < row1Needed;
    }

    headerInner.classList.toggle('is-stacked', nextStacked);
    brand.classList.toggle('is-compact', nextCompact);

    // Synchronize placeholder geometry in next animation frame to eliminate layout thrashing
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
            const header = /** @type {HTMLElement | null} */ (document.querySelector('.hero-journey-page__header'));
            const placeholder = /** @type {HTMLElement | null} */ (document.querySelector('.header-placeholder'));
            if (header && placeholder && !header.classList.contains('is-scrolled')) {
                const topOffset = parseFloat(window.getComputedStyle(header).top) || 8;
                const gap = 12;
                placeholder.style.height = `${Math.ceil(header.offsetHeight + topOffset + gap)}px`;
            }
        });
    }
}

/** @type {ResizeObserver | null} */
let headerResizeObserver = null;
let lastObservedHeaderWidth = 0;

/**
 * Sets up an IntersectionObserver scroll sentinel to toggle the floating header elevation.
 */
function initHeaderScrollObserver() {
    const header = document.querySelector('.hero-journey-page__header');
    if (!header || document.querySelector('.hj-header-scroll-sentinel')) return;

    const sentinel = document.createElement('div');
    sentinel.className = 'hj-header-scroll-sentinel';
    sentinel.style.cssText = 'position: absolute; top: 5px; left: 0; width: 1px; height: 1px; pointer-events: none; opacity: 0; z-index: -1;';
    document.body.prepend(sentinel);

    if (typeof IntersectionObserver !== 'undefined') {
        const observer = new IntersectionObserver(([entry]) => {
            header.classList.toggle('is-scrolled', !entry.isIntersecting);
        });
        observer.observe(sentinel);
    }
}

/**
 * Observes header dimensions and triggers dynamic compact transformations.
 */
export function initHeaderLayoutObserver() {
    const headerInner = document.querySelector('.hero-journey-page__header-inner');
    if (!headerInner) return;

    initHeaderScrollObserver();
    lastObservedHeaderWidth = headerInner.clientWidth;
    updateHeaderLayout();

    if (typeof ResizeObserver !== 'undefined') {
        if (headerResizeObserver) headerResizeObserver.disconnect();
        headerResizeObserver = new ResizeObserver((entries) => {
            const width = entries[0]?.contentRect?.width;
            if (typeof width === 'number' && Math.abs(width - lastObservedHeaderWidth) > 1) {
                lastObservedHeaderWidth = width;
                window.requestAnimationFrame(updateHeaderLayout);
            }
        });
        headerResizeObserver.observe(headerInner);
    }
}

/**
 * Renders the HTML markup for the hero journey player search dropdown.
 * @param {{ savedProfiles?: Array<any>, recentSearches?: Array<any>, activeCleanTag?: string, isFiltering?: boolean, cleanQuery?: string, activeDropdownIndex?: number, isJourneyRecentCollapsed?: boolean, hjState?: any }} [params={}]
 * @returns {string} HTML string.
 */
export function renderHeroJourneyDropdownMarkup({
    savedProfiles = [],
    recentSearches = [],
    activeCleanTag = '',
    isFiltering = false,
    cleanQuery = '',
    activeDropdownIndex = -1,
    isJourneyRecentCollapsed = false,
    hjState = {}
} = {}) {
    const isActiveSaved = savedProfiles.some(p => normalizePlayerTag(p.cleanTag || p.tag) === activeCleanTag);

    const filteredSaved = isFiltering
        ? savedProfiles.filter(p => {
            const cleanTag = normalizePlayerTag(p.cleanTag || p.tag);
            const cleanName = (p.name || '').toUpperCase();
            return cleanTag.includes(cleanQuery) || cleanName.includes(cleanQuery);
        })
        : savedProfiles;

    const filteredRecent = isFiltering
        ? recentSearches.filter(r => {
            const cleanTag = normalizePlayerTag(r.cleanTag || r.tag);
            const cleanName = (r.name || '').toUpperCase();
            return cleanTag.includes(cleanQuery) || cleanName.includes(cleanQuery);
        })
        : recentSearches;

    if (filteredSaved.length === 0 && filteredRecent.length === 0) {
        return `<div class="hj-dropdown-empty" data-i18n="views.heroJourneyPage.noSavedProfiles">${translate('views.heroJourneyPage.noSavedProfiles')}</div>`;
    }

    let html = '';
    let globalIndex = 0;

    const renderSavedItem = (p) => {
        const currentIndex = globalIndex;
        const cleanTag = normalizePlayerTag(p.cleanTag || p.tag);
        const displayTag = formatDisplayTag(cleanTag);
        const isActive = cleanTag === activeCleanTag;
        const isFocused = currentIndex === activeDropdownIndex;
        globalIndex++;
        const thLevel = Math.min(Math.max(Number(p.townHallLevel) || 1, 1), 18);
        const thImg = `assets/th/th${thLevel}.png`;
        return `
            <div id="hj-dropdown-item-${currentIndex}" class="hj-dropdown-item ${isActive ? 'is-active' : ''} ${isFocused ? 'is-focused' : ''}" data-tag="${escapeHTML(cleanTag)}" role="option" aria-selected="${isActive}" tabindex="0">
                <div class="hj-dropdown-left">
                    <div class="hj-dropdown-th-wrapper">
                        <orecalc-assets-image src="${thImg}" alt="TH ${thLevel}" class="hj-dropdown-th"></orecalc-assets-image>
                        <span class="hj-dropdown-th-badge">${thLevel}</span>
                    </div>
                    <div class="hj-dropdown-details">
                        <span class="hj-dropdown-name">${escapeHTML(p.name || displayTag)}</span>
                        <span class="hj-dropdown-tag">${escapeHTML(displayTag)}</span>
                    </div>
                </div>
            </div>
        `;
    };

    const renderRecentItem = (r, isTopActive = false) => {
        const currentIndex = globalIndex;
        const cleanTag = normalizePlayerTag(r.cleanTag || r.tag);
        const displayTag = formatDisplayTag(cleanTag);
        const isActive = isTopActive || (cleanTag === activeCleanTag);
        const isFocused = currentIndex === activeDropdownIndex;
        globalIndex++;
        const thLevel = Math.min(Math.max(Number(r.townHallLevel) || 1, 1), 18);
        const thImg = `assets/th/th${thLevel}.png`;
        return `
            <div id="hj-dropdown-item-${currentIndex}" class="hj-dropdown-item hj-dropdown-item--recent ${isActive ? 'is-active' : ''} ${isFocused ? 'is-focused' : ''}" data-tag="${escapeHTML(cleanTag)}" role="option" aria-selected="${isActive}" tabindex="0">
                <div class="hj-dropdown-left">
                    <div class="hj-dropdown-th-wrapper">
                        <orecalc-assets-image src="${thImg}" alt="TH ${thLevel}" class="hj-dropdown-th"></orecalc-assets-image>
                        <span class="hj-dropdown-th-badge">${thLevel}</span>
                    </div>
                    <div class="hj-dropdown-details">
                        <span class="hj-dropdown-name">${escapeHTML(r.name || displayTag)}</span>
                        <span class="hj-dropdown-tag">${escapeHTML(displayTag)}</span>
                    </div>
                </div>
                <button type="button" class="hj-dropdown-dismiss-btn" data-tag="${escapeHTML(cleanTag)}" tabindex="-1" aria-label="${escapeHTML(translate('views.heroJourneyPage.removeRecent'))}" title="${escapeHTML(translate('views.heroJourneyPage.removeRecent'))}">
                    ${getSVG('close', '', 14, 14, 'currentColor')}
                </button>
            </div>
        `;
    };

    const renderCollapsibleHeader = () => {
        const isFocused = globalIndex === activeDropdownIndex;
        globalIndex++;
        return `<div class="hj-dropdown-header hj-dropdown-header--recent hj-dropdown-header--collapsible ${isFocused ? 'is-focused' : ''}" data-i18n="views.heroJourneyPage.recentSearches" role="button" tabindex="0" aria-expanded="${!isJourneyRecentCollapsed}">
                    <span>${translate('views.heroJourneyPage.recentSearches')}</span>
                    <span class="section-header-chevron">${getSVG('chevron-down', '', 12, 12, 'currentColor')}</span>
                 </div>`;
    };

    if (isFiltering) {
        if (filteredSaved.length > 0) {
            html += `<div class="hj-dropdown-header" data-i18n="views.heroJourneyPage.savedProfiles">${translate('views.heroJourneyPage.savedProfiles')}</div>`;
            html += filteredSaved.map(renderSavedItem).join('');
        }
        if (filteredRecent.length > 0) {
            html += `<div class="hj-dropdown-header hj-dropdown-header--recent" data-i18n="views.heroJourneyPage.recentSearches">${translate('views.heroJourneyPage.recentSearches')}</div>`;
            html += filteredRecent.map(r => renderRecentItem(r, false)).join('');
        }
    } else if (isActiveSaved || !activeCleanTag) {
        if (savedProfiles.length > 0) {
            html += `<div class="hj-dropdown-header" data-i18n="views.heroJourneyPage.savedProfiles">${translate('views.heroJourneyPage.savedProfiles')}</div>`;
            html += savedProfiles.map(renderSavedItem).join('');
        }
        if (recentSearches.length > 0) {
            html += renderCollapsibleHeader();
            if (!isJourneyRecentCollapsed) {
                html += recentSearches.map(r => renderRecentItem(r, false)).join('');
            }
        }
    } else {
        const activeRecent = recentSearches.find(r => r.cleanTag === activeCleanTag) || {
            tag: formatDisplayTag(activeCleanTag),
            cleanTag: activeCleanTag,
            name: hjState.playerData?.name || hjState.playerData?.playerProfile?.name || translate('player.label'),
            townHallLevel: hjState.thLevel || hjState.playerData?.townHallLevel || 1,
            timestamp: Date.now()
        };
        const remainingRecents = recentSearches.filter(r => r.cleanTag !== activeCleanTag);

        html += `<div class="hj-dropdown-header" data-i18n="views.heroJourneyPage.recentSearches">${translate('views.heroJourneyPage.recentSearches')}</div>`;
        html += renderRecentItem(activeRecent, true);

        if (savedProfiles.length > 0) {
            html += `<div class="hj-dropdown-header" data-i18n="views.heroJourneyPage.savedProfiles">${translate('views.heroJourneyPage.savedProfiles')}</div>`;
            html += savedProfiles.map(renderSavedItem).join('');
        }

        if (remainingRecents.length > 0) {
            html += renderCollapsibleHeader();
            if (!isJourneyRecentCollapsed) {
                html += remainingRecents.map(r => renderRecentItem(r, false)).join('');
            }
        }
    }

    return html;
}
