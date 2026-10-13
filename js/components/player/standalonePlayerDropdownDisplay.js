import {
    renderPlayerDropdown,
    renderStandaloneDropdownMarkup as renderMarkup
} from './playerDropdownDisplay.js';

/**
 * Renders HTML markup for standalone player dropdown list items.
 *
 * @param {Object} [params={}] - Markup render parameters.
 * @returns {string} Standardized HTML markup string.
 */
export function renderStandaloneDropdownMarkup(params = {}) {
    return renderMarkup(params);
}

/**
 * Renders the player dropdown button label and item container for standalone application headers.
 *
 * @param {string} [activeCleanTag=''] - Active normalized player tag.
 * @param {Object} [options={}] - Render configuration options.
 */
export function renderStandalonePlayerDropdown(activeCleanTag = '', options = {}) {
    renderPlayerDropdown(activeCleanTag, options);
}
