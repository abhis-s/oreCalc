import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';

export function initializeTabs() {
    document.body.addEventListener('click', (event) => {
        const button = event.target.closest('[data-tab]');
        if (!button) return;

        const tabId = `${button.dataset.tab}-tab`;
        handleStateUpdate(() => {
            state.activeTab = tabId;
        });
    });
}

export function renderTabs(activeTabId) {
    const tabButtons = dom.tabs?.buttons;
    const tabContents = dom.tabs?.contents;
    if (!tabButtons || !tabContents) return;

    tabContents.forEach(content => {
        content.classList.toggle('active', content.id === activeTabId);
    });

    tabButtons.forEach(button => {
        const tabDataValue = activeTabId.replace('-tab', '');
        button.classList.toggle('tab-button--active', button.dataset.tab === tabDataValue);
        button.classList.toggle('nav-button--active', button.dataset.tab === tabDataValue);
    });
}