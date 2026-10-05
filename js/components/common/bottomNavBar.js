import { translate } from '../../i18n/translator.js';
import { symbolExists } from '../../utils/svgManager.js';
import { escapeHTML } from '../../utils/stringUtils.js';

/**
 * @typedef {Object} BottomNavItem
 * @property {string} id - Unique tab identifier (e.g. 'home', 'zapquake')
 * @property {string} [label] - Static fallback text label
 * @property {string} [i18nKey] - Optional translation key for text label
 * @property {string} iconOutline - SVG symbol name or ID for outline state
 * @property {string} iconFilled - SVG symbol name or ID for filled active state
 * @property {string} [badge] - Optional badge text
 */

/**
 * Universally renders a floating bottom navigation bar into the given container.
 *
 * @param {Object} options
 * @param {Element | null} options.container - DOM container element (.bottom-nav-bar)
 * @param {BottomNavItem[]} options.items - Array of navigation tab descriptors
 * @param {string} options.activeTabId - Current active tab identifier
 * @param {(tabId: string, event: MouseEvent) => void} [options.onTabSelect] - Optional click callback
 */
export function renderBottomNavBar({
    container,
    items,
    activeTabId,
    onTabSelect
}) {
    if (!container || !Array.isArray(items)) return;

    container.innerHTML = '';

    items.forEach(tab => {
        const isActive = activeTabId === `${tab.id}-tab` || activeTabId === tab.id;
        const activeClass = isActive ? 'active' : '';

        // Mutual icon fallback
        const hasOutline = symbolExists(tab.iconOutline);
        const hasFilled = symbolExists(tab.iconFilled);

        const iconOutline = hasOutline ? tab.iconOutline : (tab.iconFilled || tab.iconOutline);
        const iconFilled = hasFilled ? tab.iconFilled : (tab.iconOutline || tab.iconFilled);

        const nameOutline = iconOutline.startsWith('#icon-')
            ? iconOutline.substring(6)
            : (iconOutline.startsWith('icon-') ? iconOutline.substring(5) : iconOutline);

        const nameFilled = iconFilled.startsWith('#icon-')
            ? iconFilled.substring(6)
            : (iconFilled.startsWith('icon-') ? iconFilled.substring(5) : iconFilled);

        const labelText = tab.i18nKey ? translate(tab.i18nKey) : (tab.label || tab.id);

        const button = document.createElement('button');
        button.type = 'button';
        button.className = `nav-button ${activeClass}`;
        button.dataset.tab = tab.id;
        button.setAttribute('data-tab', tab.id);
        button.setAttribute('title', labelText);
        if (isActive) {
            button.setAttribute('aria-current', 'page');
        }

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
                <span ${tab.i18nKey ? `data-i18n="${tab.i18nKey}"` : ''} title="${escapeHTML(labelText)}">${labelText}</span>
            </div>
        `;

        if (typeof onTabSelect === 'function') {
            button.addEventListener('click', (e) => {
                onTabSelect(tab.id, e);
            });
        }

        container.appendChild(button);
    });
}
