import { hjState } from './heroJourneyState.js';
import {
    renderStandaloneDropdownMarkup,
    renderStandalonePlayerDropdown
} from '../player/standalonePlayerDropdownDisplay.js';

import { initAppHeader } from '../common/appHeader.js';

/**
 * Observes header dimensions and triggers dynamic compact transformations.
 * @returns {ReturnType<typeof initAppHeader>}
 */
export function initHeaderLayoutObserver() {
    return initAppHeader({
        headerElement: '.hero-journey-page__header',
        hasTabs: false,
        hasPlayerDropdown: true,
        hasPill: true
    });
}

/**
 * Renders the HTML markup for the hero journey player dropdown list.
 * @param {{ savedProfiles?: Array<any>, activeCleanTag?: string, isFiltering?: boolean, cleanQuery?: string }} [params={}]
 * @returns {string} HTML string.
 */
export function renderHeroJourneyDropdownMarkup(params = {}) {
    return renderStandaloneDropdownMarkup({
        ...params,
        idPrefix: 'hj-dropdown-item'
    });
}

/**
 * Renders the player dropdown button label and list items in Hero's Journey.
 * @param {string} [activeCleanTag=''] - Active normalized player tag.
 */
export function renderHeroJourneyPlayerDropdown(activeCleanTag = '') {
    renderStandalonePlayerDropdown(activeCleanTag || hjState.activeTag, {
        idPrefix: 'hj-dropdown-item',
        fallbackName: hjState.playerData?.name || hjState.playerData?.playerProfile?.name
    });
}
