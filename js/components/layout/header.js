import { dom } from '../../dom/domElements.js';
import { initAppHeader } from '../common/appHeader.js';

/**
 * Sets up header scroll sentinel and space-constrained layout observer.
 * @returns {ReturnType<typeof initAppHeader>}
 */
export function initializeHeader() {
    return initAppHeader({
        headerElement: dom.header?.container || '.header-container',
        hasTabs: true,
        hasPlayerDropdown: true,
        hasPill: true
    });
}
