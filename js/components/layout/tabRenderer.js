import { dom } from '../../dom/domElements.js';
import { requestResponsiveTextUpdate } from '../../utils/responsiveTextHandler.js';

/**
 * Toggles active visual states across tab content containers and header tab buttons.
 * @param {string} activeTabId - ID of active tab container (e.g. 'home-tab').
 */
export function renderTabs(activeTabId) {
    const tabButtons = dom.tabs?.buttons;
    const tabContents = dom.tabs?.contents;
    if (!tabButtons || !tabContents || !activeTabId) return;

    tabContents.forEach(content => {
        content.classList.toggle('active', content.id === activeTabId);
    });

    tabButtons.forEach(button => {
        const tabDataValue = activeTabId.replace('-tab', '');
        button.classList.toggle('active', button.dataset.tab === tabDataValue);
    });

    requestResponsiveTextUpdate();
}
