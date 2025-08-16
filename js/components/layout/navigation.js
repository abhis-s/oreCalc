import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';

function toggleNavigationDrawer() {
    dom.drawer.drawer.classList.toggle('open');
    dom.drawer.overlay.classList.toggle('open');
    document.body.classList.toggle('open-drawer');
}

function closeNavigationDrawer() {
    dom.drawer.drawer.classList.remove('open');
    dom.drawer.overlay.classList.remove('open');
    document.body.classList.remove('open-drawer');
}

export function initializeNavigation() {

    if (dom.drawer.button) {
        dom.drawer.button.addEventListener('click', toggleNavigationDrawer);
    } else {
        console.error('Hamburger element not found in dom.drawer!');
    }

    if (dom.drawer.overlay) {
        dom.drawer.overlay.addEventListener('click', closeNavigationDrawer);
    }

    if (dom.drawer.drawer) {
        dom.drawer.drawer.addEventListener('click', (event) => {
            event.stopPropagation();

            const tab = event.target.closest('.navigation-drawer__tab');
            if (tab) {
                const tabId = `${tab.dataset.tab}-tab`;
                handleStateUpdate(() => {
                    state.activeTab = tabId;
                });
                closeNavigationDrawer();
            }
        });
    } else {
        console.error('Navigation drawer element not found in dom.drawer!');
    }
}