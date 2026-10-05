import { constructTabUrl } from './tabs.js';
import { renderApp } from '../../core/renderer.js';
import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';
import { translate } from '../../i18n/translator.js';
import { showUpdateModal } from '../modals/updateModal.js';
import { dom } from '../../dom/domElements.js';
import { initNavigationDrawer } from '../common/navigationDrawer.js';

/** @type {ReturnType<typeof initNavigationDrawer> | null} */
let drawerInstance = null;

/**
 * Closes the mobile navigation drawer dialog, resets body scroll locks, and updates ARIA state.
 */
function closeNavigationDrawer() {
    if (drawerInstance) {
        drawerInstance.close();
        return;
    }
    const drawer = dom.drawer?.drawer;
    const overlay = dom.drawer?.overlay;
    if (!drawer) return;
    drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
    document.body?.classList.remove('open-drawer');
    if (typeof drawer.close === 'function' && drawer.open) {
        try { drawer.close(); } catch (e) {}
    }
    if (dom.drawer?.button) {
        dom.drawer.button.setAttribute('aria-expanded', 'false');
    }
}

/**
 * Handles tab, secondary action, and modal link selection inside the drawer.
 *
 * @param {MouseEvent | KeyboardEvent} event
 * @param {HTMLElement} target
 */
function handleDrawerItemClick(event, target) {
    const tab = target.closest('.navigation-drawer__tab');
    if (tab && !tab.classList.contains('secondary-tab')) {
        // If clicking on Settings with update pending, trigger the update modal
        if (tab.dataset.tab === 'settings' && tab.classList.contains('update-pending') && window.__WB__) {
            showUpdateModal(window.__WB__);
        }

        const tabId = `${tab.dataset.tab}-tab`;
        history.pushState(null, '', constructTabUrl(tab.dataset.tab));
        handleStateUpdate(() => {
            state.activeTab = tabId;
        });
        renderApp(state);
        closeNavigationDrawer();
        return;
    }
}

/**
 * Initializes navigation drawer event listeners, mobile swipe drawer interactions, and overlay bindings.
 */
export function initializeNavigation() {
    if (drawerInstance) {
        drawerInstance.destroy();
        drawerInstance = null;
    }

    const drawerEl = dom.drawer?.drawer || null;
    const overlayEl = dom.drawer?.overlay || null;
    const buttonEl = dom.drawer?.button || null;
    const closeEl = dom.drawer?.close || null;

    if (!buttonEl) {
        console.error('Hamburger element not found in dom.drawer!');
    }

    if (!drawerEl) {
        console.error('Navigation drawer element not found in dom.drawer!');
    }

    drawerInstance = initNavigationDrawer({
        drawerEl,
        overlayEl,
        buttonEl,
        closeEl,
        subtitle: translate('app.title') || 'Ore Calculator',
        onItemClick: (event, tab) => handleDrawerItemClick(event, tab)
    });
}
