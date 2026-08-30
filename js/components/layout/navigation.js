import { getLanguageFromPath } from '../../core/languageRouter.js';
import { renderApp } from '../../core/renderer.js';
import { state } from '../../core/state.js';

import { showUpdateModal } from '../modals/updateModal.js';
import { dom } from '../../dom/domElements.js';

function toggleNavigationDrawer() {
    const drawer = dom.drawer.drawer;
    const overlay = dom.drawer.overlay;
    if (!drawer) return;
    const isOpen = drawer.classList.toggle('open');
    if (overlay) overlay.classList.toggle('show');
    document.body.classList.toggle('open-drawer');
    if (typeof drawer.showModal === 'function' && typeof drawer.close === 'function') {
        if (isOpen && !drawer.open) {
            try { drawer.showModal(); } catch (e) {}
        } else if (!isOpen && drawer.open) {
            try { drawer.close(); } catch (e) {}
        }
    }
    if (dom.drawer.button) {
        dom.drawer.button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
    if (isOpen) {
        const firstTab = drawer.querySelector('.navigation-drawer__tab');
        if (firstTab) {
            setTimeout(() => {
                firstTab.focus();
            }, 50);
        }
    }
}

/**
 * Closes the mobile navigation drawer dialog, resets body scroll locks, and updates ARIA state.
 */
export function closeNavigationDrawer() {
    const drawer = dom.drawer.drawer;
    const overlay = dom.drawer.overlay;
    if (!drawer) return;
    drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
    document.body.classList.remove('open-drawer');
    if (typeof drawer.close === 'function' && drawer.open) {
        try { drawer.close(); } catch (e) {}
    }
    if (dom.drawer.button) {
        dom.drawer.button.setAttribute('aria-expanded', 'false');
    }
}

let swipeStartX = 0;
let swipeStartY = 0;
let currentDeltaX = 0;
let isSwipingDrawer = false;

function initDrawerSwipeGesture() {
    const drawer = dom.drawer.drawer;
    const overlay = dom.drawer.overlay;
    if (!drawer) return;

    const onTouchStart = (e) => {
        if (!drawer.classList.contains('open')) return;
        const touch = e.touches[0];
        swipeStartX = touch.clientX;
        swipeStartY = touch.clientY;
        currentDeltaX = 0;
        isSwipingDrawer = false;
    };

    const onTouchMove = (e) => {
        if (!drawer.classList.contains('open')) return;
        const touch = e.touches[0];
        const diffX = touch.clientX - swipeStartX;
        const diffY = touch.clientY - swipeStartY;

        if (!isSwipingDrawer) {
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 8 && diffX < 0) {
                isSwipingDrawer = true;
                drawer.style.transition = 'none';
                if (overlay) overlay.style.transition = 'none';
            }
        }

        if (isSwipingDrawer) {
            if (e.cancelable) e.preventDefault();
            currentDeltaX = Math.min(0, Math.max(-300, diffX));
            drawer.style.transform = `translateX(${currentDeltaX}px)`;

            if (overlay) {
                const opacityProgress = Math.max(0, 1 - (Math.abs(currentDeltaX) / 300));
                overlay.style.opacity = opacityProgress.toFixed(2);
            }
        }
    };

    const onTouchEnd = () => {
        if (!isSwipingDrawer) return;
        isSwipingDrawer = false;

        drawer.style.transition = '';
        if (overlay) overlay.style.transition = '';

        if (currentDeltaX < -60) {
            drawer.style.transform = '';
            if (overlay) overlay.style.opacity = '';
            closeNavigationDrawer();
        } else {
            drawer.style.transform = '';
            if (overlay) overlay.style.opacity = '';
        }
    };

    [drawer, overlay].forEach(el => {
        if (!el) return;
        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd, { passive: true });
        el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    });
}

/**
 * Initializes navigation drawer event listeners, mobile swipe drawer interactions, and overlay bindings.
 */
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
        dom.drawer.overlay.addEventListener('touchmove', (e) => {
            if (e.cancelable) e.preventDefault();
        }, { passive: false });
        dom.drawer.overlay.addEventListener('wheel', (e) => {
            if (e.cancelable) e.preventDefault();
        }, { passive: false });
    }

    if (dom.drawer.close) {
        dom.drawer.close.addEventListener('click', closeNavigationDrawer);
    }

    initDrawerSwipeGesture();

    if (dom.drawer.drawer) {
        dom.drawer.drawer.addEventListener('click', (event) => {
            const target = /** @type {HTMLElement | null} */ (event.target);
            if (!target) return;

            const tab = target.closest('.navigation-drawer__tab');
            if (tab && !tab.classList.contains('secondary-tab')) {
                // If clicking on Settings with update pending, trigger the update modal
                if (tab.dataset.tab === 'settings' && tab.classList.contains('update-pending') && window.__WB__) {
                    showUpdateModal(window.__WB__);
                }

                const tabId = `${tab.dataset.tab}-tab`;
                const currentLang = getLanguageFromPath() || state.uiSettings?.language || 'en';
                const hash = tab.dataset.tab === 'home' ? '' : `#${tab.dataset.tab}`;
                const pathPrefix = currentLang === 'en' ? '' : `/${currentLang}`;
                history.pushState(null, '', `${pathPrefix}/${hash}`);
                state.activeTab = tabId;
                renderApp(state);
                closeNavigationDrawer();
                return;
            }

            const secondaryTab = target.closest('.navigation-drawer__tab.secondary-tab');
            if (secondaryTab) {
                const actionId = /** @type {HTMLElement} */ (secondaryTab).dataset.actionId;
                if (actionId === 'changelog') {
                    closeNavigationDrawer();
                    Promise.all([
                        import('../changelog/changelogModal.js'),
                        import('../../services/changelogService.js')
                    ]).then(([modalModule, serviceModule]) => {
                        const content = serviceModule.getChangelogHtml();
                        modalModule.showChangelogModal(content);
                    }).catch(err => console.error(err));
                    return;
                }
                if (secondaryTab.tagName === 'A') {
                    closeNavigationDrawer();
                    return;
                }
            }

            const privacyLink = target.closest('.navigation-drawer__footer-links a[href*="privacy"]');
            if (privacyLink) {
                event.preventDefault();
                closeNavigationDrawer();
                import('../appSettings/settingsModals.js').then(module => {
                    module.openPrivacyModal();
                }).catch(err => console.error(err));
                return;
            }

            const termsLink = target.closest('.navigation-drawer__footer-links a[href*="terms"]');
            if (termsLink) {
                event.preventDefault();
                closeNavigationDrawer();
                import('../appSettings/settingsModals.js').then(module => {
                    module.openTermsOfUseModal();
                }).catch(err => console.error(err));
                return;
            }
        });

        dom.drawer.drawer.addEventListener('keydown', (event) => {
            if (event.key === 'Tab') {
                const tabElements = Array.from(dom.drawer.drawer.querySelectorAll('.navigation-drawer__tab'));
                if (tabElements.length === 0) return;

                const firstTab = tabElements[0];
                const lastTab = tabElements.at(-1);

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
