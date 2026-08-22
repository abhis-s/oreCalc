import { navigationRegistry } from '../../data/navigationRegistry.js';

import { getLanguageFromPath } from '../../core/languageRouter.js';
import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { closeFabMenu } from '../fab/fab.js';
import { showUpdateModal } from '../modals/updateModal.js';
import { setAnimateNextRender } from '../planner/calendar.js';
import { openStoredOresModal } from '../planner/priorityListModal.js';
import { dom } from '../../dom/domElements.js';

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

/**
 * Initializes hash routing, tab switching click listeners, popstate listeners, and scroll state preservation.
 */
export function initializeTabs() {
    const validTabs = ['home-tab', 'planner-tab', 'equipment-tab', 'income-tab', 'settings-tab'];
    let initialTab = window.location.hash ? `${window.location.hash.substring(1)}-tab` : 'home-tab';

    if (!validTabs.includes(initialTab)) {
        const currentLang = getLanguageFromPath() || state.uiSettings?.language || 'en';
        const pathPrefix = currentLang === 'en' ? '' : `/${currentLang}`;
        history.replaceState(null, '', `${pathPrefix}/`);
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
            const pathPrefix = currentLang === 'en' ? '' : `/${currentLang}`;
            history.replaceState(null, '', `${pathPrefix}/`);
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
            handleStateUpdate(() => {
                state.activeTab = tabId;
            });
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
                setTimeout(() => {
                    checkPlannerTabStoredOres();
                }, 100);
            }

            const currentLang = getLanguageFromPath() || state.uiSettings?.language || 'en';
            const hash = button.dataset.tab === 'home' ? '' : `#${button.dataset.tab}`;
            const pathPrefix = currentLang === 'en' ? '' : `/${currentLang}`;
            const targetUrl = `${pathPrefix}/${hash}`;
            history.pushState(null, '', targetUrl);
            handleStateUpdate(() => {
                state.activeTab = tabId;
            });
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

/**
 * Resets the cached scroll position for a tab.
 * @param {string} [tabId='home-tab']
 */
export function resetTabScrollPosition(tabId = 'home-tab') {
    if (tabScrollPositions[tabId] !== undefined) {
        tabScrollPositions[tabId] = 0;
    }
}

/**
 * Programmatically navigates to a tab with optional scroll reset.
 * @param {string} tabName
 * @param {Object} [options={}]
 * @param {boolean} [options.resetScroll=false]
 */
export function navigateToTab(tabName, { resetScroll = false } = {}) {
    const tabId = `${tabName}-tab`;
    if (resetScroll) {
        resetTabScrollPosition(tabId);
    }
    const button = document.querySelector(`.tab-button[data-tab="${tabName}"], .nav-button[data-tab="${tabName}"]`);
    if (button) {
        button.click();
    }
}
