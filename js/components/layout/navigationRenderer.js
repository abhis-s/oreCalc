import { dom } from '../../dom/domElements.js';

import { navigationRegistry } from '../../data/navigationRegistry.js';
import { translate } from '../../i18n/translator.js';

/**
 * Checks if an SVG symbol with the given ID exists in the DOM.
 * @param {string} id - The ID of the symbol (e.g., '#icon-home-filled').
 * @returns {boolean} - True if the symbol exists.
 */
function symbolExists(id) {
    if (!id) return false;
    const symbolId = id.startsWith('#') ? id.substring(1) : id;
    return !!document.getElementById(symbolId);
}

export function renderNavigation(activeTabId) {
    renderBottomNav(activeTabId);
    renderNavigationDrawer(activeTabId);
}

function renderBottomNav(activeTabId) {
    const container = document.querySelector('.bottom-nav-bar');
    if (!container) return;

    container.innerHTML = '';
    navigationRegistry.forEach(tab => {
        const isActive = activeTabId === `${tab.id}-tab` || activeTabId === tab.id;
        const activeClass = isActive ? 'active' : '';

        // Mutual Fallback
        const hasOutline = symbolExists(tab.iconOutline);
        const hasFilled = symbolExists(tab.iconFilled);

        const iconOutline = hasOutline ? tab.iconOutline : tab.iconFilled;
        const iconFilled = hasFilled ? tab.iconFilled : tab.iconOutline;

        const nameOutline = iconOutline.startsWith('#icon-') ? iconOutline.substring(6) : iconOutline;
        const nameFilled = iconFilled.startsWith('#icon-') ? iconFilled.substring(6) : iconFilled;

        const button = document.createElement('button');
        button.className = `nav-button ${activeClass}`;
        button.dataset.tab = tab.id;

        button.innerHTML = `
            <div class="nav-item-content">
                <div class="nav-icon-wrapper">
                    <span class="icon-outline">
                        <orecalc-assets-svg name="${nameOutline}" fill="var(--text-secondary)"></orecalc-assets-svg>
                    </span>
                    <span class="icon-filled">
                        <orecalc-assets-svg name="${nameFilled}" fill="var(--accent-primary)"></orecalc-assets-svg>
                    </span>
                </div>
                <span data-i18n="${tab.i18nKey}">${translate(tab.i18nKey)}</span>
            </div>
        `;
        container.appendChild(button);
    });
}

function renderNavigationDrawer(activeTabId) {
    const container = document.querySelector('.navigation-drawer__tabs');
    if (!container) return;

    container.innerHTML = '';
    navigationRegistry.forEach(tab => {
        const isActive = activeTabId === `${tab.id}-tab` || activeTabId === tab.id;
        const activeClass = isActive ? 'active' : '';

        // Mutual Fallback
        const hasOutline = symbolExists(tab.iconOutline);
        const hasFilled = symbolExists(tab.iconFilled);

        const iconOutline = hasOutline ? tab.iconOutline : tab.iconFilled;
        const iconFilled = hasFilled ? tab.iconFilled : tab.iconOutline;

        const currentIcon = isActive ? iconFilled : iconOutline;
        const currentIconName = currentIcon.startsWith('#icon-') ? currentIcon.substring(6) : currentIcon;

        const button = document.createElement('button');
        button.className = `navigation-drawer__tab ${activeClass}`;
        button.dataset.tab = tab.id;

        button.innerHTML = `
            <orecalc-assets-svg name="${currentIconName}" fill="${isActive ? 'var(--accent-primary)' : 'var(--text-secondary)'}"></orecalc-assets-svg>
            <span data-i18n="${tab.i18nKey}">${translate(tab.i18nKey)}</span>
        `;
        container.appendChild(button);
    });
}

