import { dom } from '../../dom/domElements.js';
import { renderApp } from '../../core/renderer.js';
import { state } from '../../core/state.js';

import { navigationRegistry } from '../../data/navigationRegistry.js';

import { closeFabMenu } from '../fab/fab.js';
import { openStoredOresModal } from '../planner/priorityListModal.js';
import { setAnimateNextRender } from '../planner/calendar.js';

function checkPlannerTabStoredOres() {
    const storedOres = state.storedOres || {};
    const lastUpdated = storedOres.lastUpdated || 0;
    const timeDiff = Date.now() - lastUpdated;
    
    const isMoreThan48HoursOld = timeDiff > (48 * 60 * 60 * 1000);
    const isMoreThan12HoursOld = timeDiff > (12 * 60 * 60 * 1000);

    const shiny = storedOres.shiny !== undefined ? storedOres.shiny : 0;
    const glowy = storedOres.glowy !== undefined ? storedOres.glowy : 0;
    const starry = storedOres.starry !== undefined ? storedOres.starry : 0;
    const hasAtLeastOneZero = shiny === 0 || glowy === 0 || starry === 0;

    if (isMoreThan48HoursOld || (isMoreThan12HoursOld && hasAtLeastOneZero)) {
        openStoredOresModal();
    }
}

export function initializeTabs() {
    // Handle initial state if starting on planner tab
    const initialTab = window.location.hash ? `${window.location.hash.substring(1)}-tab` : 'home-tab';
    state.activeTab = initialTab;

    if (initialTab === 'planner-tab') {
        setTimeout(checkPlannerTabStoredOres, 100);
    }

    window.addEventListener('popstate', () => {
        const hash = window.location.hash;
        const tabId = hash ? `${hash.substring(1)}-tab` : 'home-tab';
        if (tabId === state.activeTab) return;

        const tabOrder = navigationRegistry.map(item => `${item.id}-tab`);
        if (!tabOrder.includes(tabId)) {
            window.location.href = '/404';
            return;
        }

        const currentIndex = tabOrder.indexOf(state.activeTab);
        const nextIndex = tabOrder.indexOf(tabId);
        const direction = nextIndex > currentIndex ? 'forward' : 'backward';

        const updateTab = () => {
            if (tabId === 'planner-tab' && state.activeTab !== 'planner-tab') {
                setAnimateNextRender('all');
                setTimeout(() => {
                    checkPlannerTabStoredOres();
                }, 100);
            }
            state.activeTab = tabId;
            renderApp(state);
        };

        if (document.startViewTransition) {
            document.documentElement.dataset.transitionType = 'tab-switch';
            document.documentElement.dataset.transitionDirection = direction;
            const transition = document.startViewTransition(updateTab);
            
            transition.ready.catch(() => {});
            transition.finished.catch(() => {}).finally(() => {
                delete document.documentElement.dataset.transitionType;
            });
        } else {
            document.documentElement.dataset.transitionDirection = direction;
            updateTab();
        }
    });

    document.body.addEventListener('click', (event) => {
        const button = event.target.closest('[data-tab]');
        if (!button) return;

        closeFabMenu();

        const tabId = `${button.dataset.tab}-tab`;
        if (tabId === state.activeTab) return;

        const tabOrder = navigationRegistry.map(item => `${item.id}-tab`);
        const currentIndex = tabOrder.indexOf(state.activeTab);
        const nextIndex = tabOrder.indexOf(tabId);
        const direction = nextIndex > currentIndex ? 'forward' : 'backward';

        const updateTab = () => {
            if (tabId === 'planner-tab' && state.activeTab !== 'planner-tab') {
                setAnimateNextRender('all');
                // Scroll calendar into view after render
                setTimeout(() => {
                    checkPlannerTabStoredOres();
                }, 100);
            }
            
            history.pushState(null, '', `#${button.dataset.tab}`);
            state.activeTab = tabId;
            renderApp(state);
        };

        if (document.startViewTransition) {
            document.documentElement.dataset.transitionType = 'tab-switch';
            document.documentElement.dataset.transitionDirection = direction;
            const transition = document.startViewTransition(updateTab);
            
            transition.ready.catch(() => {});
            transition.finished.catch(() => {}).finally(() => {
                delete document.documentElement.dataset.transitionType;
                
            });
        } else {
            document.documentElement.dataset.transitionDirection = direction;
            updateTab();
        }
    });
}

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
}