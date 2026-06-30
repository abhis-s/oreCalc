import { dom } from '../../dom/domElements.js';
import { renderApp } from '../../core/renderer.js';
import { state } from '../../core/state.js';

function toggleNavigationDrawer() {
    const isOpen = dom.drawer.drawer.classList.toggle('open');
    dom.drawer.overlay.classList.toggle('show');
    document.body.classList.toggle('open-drawer');
    if (dom.drawer.button) {
        dom.drawer.button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
    if (isOpen) {
        const firstTab = dom.drawer.drawer.querySelector('.navigation-drawer__tab');
        if (firstTab) {
            setTimeout(() => {
                firstTab.focus();
            }, 50);
        }
    }
}

function closeNavigationDrawer() {
    dom.drawer.drawer.classList.remove('open');
    dom.drawer.overlay.classList.remove('show');
    document.body.classList.remove('open-drawer');
    if (dom.drawer.button) {
        dom.drawer.button.setAttribute('aria-expanded', 'false');
    }
}

export function initializeNavigation() {

    if (dom.drawer.button) {
        dom.drawer.button.addEventListener('click', toggleNavigationDrawer);
        dom.drawer.button.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleNavigationDrawer();
            }
        });
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
                // If clicking on Settings with update pending, trigger the update modal
                if (tab.dataset.tab === 'settings' && tab.classList.contains('update-pending') && window.__WB__) {
                    import('../modals/updateModal.js').then(module => {
                        module.showUpdateModal(window.__WB__);
                    }).catch(err => console.error('Failed to show update modal:', err));
                }

                const tabId = `${tab.dataset.tab}-tab`;
                history.pushState(null, '', `#${tab.dataset.tab}`);
                state.activeTab = tabId;
                renderApp(state);
                closeNavigationDrawer();
            }
        });

        dom.drawer.drawer.addEventListener('keydown', (event) => {
            if (event.key === 'Tab') {
                const tabElements = Array.from(dom.drawer.drawer.querySelectorAll('.navigation-drawer__tab'));
                if (tabElements.length === 0) return;

                const firstTab = tabElements[0];
                const lastTab = tabElements[tabElements.length - 1];

                if (event.target === lastTab && !event.shiftKey) {
                    event.preventDefault();
                    closeNavigationDrawer();
                    if (dom.drawer.button) {
                        dom.drawer.button.focus();
                    }
                } else if (event.target === firstTab && event.shiftKey) {
                    event.preventDefault();
                    closeNavigationDrawer();
                    if (dom.drawer.button) {
                        dom.drawer.button.focus();
                    }
                }
            }
        });
    } else {
        console.error('Navigation drawer element not found in dom.drawer!');
    }
}