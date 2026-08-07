import { dom } from '../../dom/domElements.js';
import { renderApp } from '../../core/renderer.js';
import { state } from '../../core/state.js';

import { navigationRegistry } from '../../data/navigationRegistry.js';
import { getLanguageFromPath } from '../../core/languageRouter.js';

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

let activeTransition = null;

const tabScrollPositions = {
    'home-tab': 0,
    'equipment-tab': 0,
    'income-tab': 0,
    'planner-tab': 0,
    'settings-tab': 0
};

export function initializeTabs() {
    const validTabs = ['home-tab', 'planner-tab', 'equipment-tab', 'income-tab', 'settings-tab'];
    let initialTab = window.location.hash ? `${window.location.hash.substring(1)}-tab` : 'home-tab';
    
    if (!validTabs.includes(initialTab)) {
        const currentLang = getLanguageFromPath() || state.uiSettings?.language || 'en';
        history.replaceState(null, '', `/${currentLang}/`);
        initialTab = 'home-tab';
    }
    state.activeTab = initialTab;

    if (initialTab === 'planner-tab') {
        setTimeout(checkPlannerTabStoredOres, 100);
    }

    window.addEventListener('popstate', () => {
        const hash = window.location.hash;
        let tabId = hash ? `${hash.substring(1)}-tab` : 'home-tab';
        if (tabId === state.activeTab) return;

        const tabOrder = navigationRegistry.map(item => `${item.id}-tab`);
        if (!tabOrder.includes(tabId)) {
            const currentLang = getLanguageFromPath() || state.uiSettings?.language || 'en';
            history.replaceState(null, '', `/${currentLang}/`);
            tabId = 'home-tab';
        }

        // Save scroll position of current tab
        if (state.activeTab) {
            tabScrollPositions[state.activeTab] = window.scrollY;
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
            window.scrollTo({ top: tabScrollPositions[tabId] || 0, behavior: 'instant' });
        };

        if (document.startViewTransition && !activeTransition) {
            document.documentElement.dataset.transitionType = 'tab-switch';
            document.documentElement.dataset.transitionDirection = direction;
            activeTransition = document.startViewTransition(updateTab);
            
            activeTransition.ready.catch(() => {});
            activeTransition.finished.catch(() => {}).finally(() => {
                delete document.documentElement.dataset.transitionType;
                activeTransition = null;
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

        // If clicking on Settings with update pending, trigger the update modal
        if (button.dataset.tab === 'settings' && button.classList.contains('update-pending') && window.__WB__) {
            showUpdateModal(window.__WB__);
        }

        const tabId = `${button.dataset.tab}-tab`;
        if (tabId === state.activeTab) {
            // Re-tapping active tab smoothly scrolls to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
            tabScrollPositions[tabId] = 0;
            return;
        }

        // Save scroll position of current tab before switching
        if (state.activeTab) {
            tabScrollPositions[state.activeTab] = window.scrollY;
        }

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
            
            const currentLang = getLanguageFromPath() || state.uiSettings?.language || 'en';
            const targetUrl = button.dataset.tab === 'home' ? `/${currentLang}/` : `/${currentLang}/#${button.dataset.tab}`;
            history.pushState(null, '', targetUrl);
            state.activeTab = tabId;
            renderApp(state);
            window.scrollTo({ top: tabScrollPositions[tabId] || 0, behavior: 'instant' });
        };

        if (document.startViewTransition && !activeTransition) {
            document.documentElement.dataset.transitionType = 'tab-switch';
            document.documentElement.dataset.transitionDirection = direction;
            activeTransition = document.startViewTransition(updateTab);
            
            activeTransition.ready.catch(() => {});
            activeTransition.finished.catch(() => {}).finally(() => {
                delete document.documentElement.dataset.transitionType;
                activeTransition = null;
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

    // On tab change, repack compact layout (disabled for now)
    // if (activeTabId === 'income-tab') {
    //     repackCards();
    // }
}