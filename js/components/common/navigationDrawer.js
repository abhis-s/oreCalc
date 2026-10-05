const SWIPE_DISMISS_THRESHOLD = -60;
const SWIPE_MAX_DRAG = -300;
const SWIPE_LOCK_MIN_PX = 8;

/**
 * @typedef {Object} NavigationDrawerOptions
 * @property {Element | null} [drawerEl] - The drawer dialog element.
 * @property {Element | null} [overlayEl] - The fallback overlay element.
 * @property {Element | null} [buttonEl] - The trigger hamburger button element.
 * @property {Element | null} [closeEl] - The close button element.
 * @property {string} [subtitle] - Optional subtitle text for the drawer header.
 * @property {() => void} [onOpen] - Optional callback triggered on open.
 * @property {() => void} [onClose] - Optional callback triggered on close.
 * @property {(event: MouseEvent | KeyboardEvent, itemEl: HTMLElement) => void} [onItemClick] - Optional callback when a drawer tab is clicked.
 */

/** @type {WeakMap<object, () => void>} */
const boundDrawerCleanups = new WeakMap();

/**
 * Initializes and binds a universal navigation drawer instance.
 *
 * @param {NavigationDrawerOptions} [options]
 * @returns {{
 *   open: () => void,
 *   close: () => void,
 *   toggle: () => void,
 *   isOpen: () => boolean,
 *   destroy: () => void
 * }}
 */
export function initNavigationDrawer(options = {}) {
    const drawer = options.drawerEl || document.getElementById('navigation-drawer') || document.querySelector('.navigation-drawer');
    const overlay = options.overlayEl || document.querySelector('.navigation-drawer__overlay');
    const button = options.buttonEl || document.querySelector('.hamburger');
    const closeBtn = options.closeEl || drawer?.querySelector('.navigation-drawer__close') || null;

    if (button && boundDrawerCleanups.has(button)) {
        boundDrawerCleanups.get(button)?.();
    }
    if (drawer && boundDrawerCleanups.has(drawer)) {
        boundDrawerCleanups.get(drawer)?.();
    }

    if (options.subtitle && drawer) {
        const subtitleEl = drawer.querySelector('.navigation-drawer__subtitle') || drawer.querySelector('[data-drawer-subtitle]');
        if (subtitleEl) {
            subtitleEl.textContent = options.subtitle;
        }
    }

    let swipeStartX = 0;
    let swipeStartY = 0;
    let currentDeltaX = 0;
    let isSwiping = false;

    const isOpen = () => {
        if (!drawer) return false;
        return drawer.classList.contains('open') || (/** @type {HTMLDialogElement} */ (drawer).open === true);
    };

    const open = () => {
        if (!drawer) return;
        drawer.classList.add('open');
        if (overlay) {
            overlay.classList.add('show');
            overlay.classList.remove('closing');
        }
        document.body?.classList.add('open-drawer');

        const dialog = /** @type {HTMLDialogElement} */ (drawer);
        if (typeof dialog.showModal === 'function' && !dialog.open) {
            try { dialog.showModal(); } catch (e) {}
        }

        if (button) {
            button.setAttribute('aria-expanded', 'true');
        }

        if (typeof options.onOpen === 'function') {
            options.onOpen();
        }

        const firstInteractive = drawer.querySelector('.navigation-drawer__tab, .navigation-drawer__close');
        if (firstInteractive instanceof HTMLElement) {
            setTimeout(() => {
                firstInteractive.focus();
            }, 50);
        }
    };

    const close = () => {
        if (!drawer) return;
        drawer.classList.remove('open');
        if (overlay) {
            overlay.classList.remove('show');
            overlay.classList.remove('closing');
        }
        document.body?.classList.remove('open-drawer');

        const dialog = /** @type {HTMLDialogElement} */ (drawer);
        if (typeof dialog.close === 'function' && dialog.open) {
            try { dialog.close(); } catch (e) {}
        }

        if (button) {
            button.setAttribute('aria-expanded', 'false');
        }

        if (typeof options.onClose === 'function') {
            options.onClose();
        }
    };

    const toggle = () => {
        if (isOpen()) {
            close();
        } else {
            open();
        }
    };

    const onTouchStart = (e) => {
        if (!isOpen()) return;
        const touch = e.touches[0];
        if (!touch) return;
        swipeStartX = touch.clientX;
        swipeStartY = touch.clientY;
        currentDeltaX = 0;
        isSwiping = false;
    };

    const onTouchMove = (e) => {
        if (!isOpen()) return;
        const touch = e.touches[0];
        if (!touch) return;

        const diffX = touch.clientX - swipeStartX;
        const diffY = touch.clientY - swipeStartY;

        if (!isSwiping) {
            // Direction locking: engage swipe only on intentional leftward horizontal gestures
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > SWIPE_LOCK_MIN_PX && diffX < 0) {
                isSwiping = true;
                drawer.style.transition = 'none';
                if (overlay) overlay.style.transition = 'none';
            }
        }

        if (isSwiping) {
            if (e.cancelable) e.preventDefault();
            currentDeltaX = Math.min(0, Math.max(SWIPE_MAX_DRAG, diffX));
            drawer.style.transform = `translateX(${currentDeltaX}px)`;

            if (overlay) {
                const opacityProgress = Math.max(0, 1 - (Math.abs(currentDeltaX) / Math.abs(SWIPE_MAX_DRAG)));
                overlay.style.opacity = opacityProgress.toFixed(2);
            }
        }
    };

    const onTouchEnd = () => {
        if (!isSwiping) return;
        isSwiping = false;

        drawer.style.transition = '';
        if (overlay) overlay.style.transition = '';

        if (currentDeltaX < SWIPE_DISMISS_THRESHOLD) {
            drawer.style.transform = '';
            if (overlay) overlay.style.opacity = '';
            close();
        } else {
            drawer.style.transform = '';
            if (overlay) overlay.style.opacity = '';
        }
    };

    const onTriggerClick = (e) => {
        e?.preventDefault?.();
        toggle();
    };

    const onTriggerKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e?.preventDefault?.();
            toggle();
        }
    };

    const onCloseBtnClick = (e) => {
        e?.preventDefault?.();
        close();
    };

    const onOverlayClick = (e) => {
        e?.preventDefault?.();
        close();
    };

    const onDrawerClick = (e) => {
        const target = /** @type {HTMLElement | null} */ (e.target);
        if (!target) return;

        // Backdrop click detection: clicks directly on dialog bounds outside content area
        if (target === drawer && typeof drawer.getBoundingClientRect === 'function') {
            const rect = drawer.getBoundingClientRect();
            const isInDialog = (
                rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
                rect.left <= e.clientX && e.clientX <= rect.left + rect.width
            );
            if (!isInDialog) {
                close();
                return;
            }
        }

        const tab = target.closest('.navigation-drawer__tab');
        if (tab instanceof HTMLElement) {
            if (typeof options.onItemClick === 'function') {
                options.onItemClick(e, tab);
            }
        }
    };

    const onDrawerKeyDown = (e) => {
        if (e.key === 'Escape') {
            e?.preventDefault?.();
            close();
            if (button instanceof HTMLElement) {
                button.focus();
            }
            return;
        }

        if (e.key === 'Tab') {
            const focusable = Array.from(drawer.querySelectorAll(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )).filter(el => el instanceof HTMLElement && el.offsetParent !== null || el.classList.contains('navigation-drawer__close') || el.classList.contains('navigation-drawer__tab'));

            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable.at(-1);

            if (e.shiftKey && e.target === first) {
                e?.preventDefault?.();
                if (last instanceof HTMLElement) last.focus();
            } else if (!e.shiftKey && e.target === last) {
                e?.preventDefault?.();
                if (first instanceof HTMLElement) first.focus();
            }
        }
    };

    const onCancel = (e) => {
        e?.preventDefault?.();
        close();
    };

    if (button) {
        button.addEventListener('click', onTriggerClick);
        button.addEventListener('keydown', onTriggerKeyDown);
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', onCloseBtnClick);
    }

    if (overlay) {
        overlay.addEventListener('click', onOverlayClick);
    }

    if (drawer) {
        drawer.addEventListener('click', onDrawerClick);
        drawer.addEventListener('keydown', onDrawerKeyDown);
        drawer.addEventListener('cancel', onCancel);

        drawer.addEventListener('touchstart', onTouchStart, { passive: true });
        drawer.addEventListener('touchmove', onTouchMove, { passive: false });
        drawer.addEventListener('touchend', onTouchEnd, { passive: true });
        drawer.addEventListener('touchcancel', onTouchEnd, { passive: true });
    }

    if (overlay) {
        overlay.addEventListener('touchstart', onTouchStart, { passive: true });
        overlay.addEventListener('touchmove', onTouchMove, { passive: false });
        overlay.addEventListener('touchend', onTouchEnd, { passive: true });
        overlay.addEventListener('touchcancel', onTouchEnd, { passive: true });
    }

    const destroy = () => {
        if (button && boundDrawerCleanups.get(button) === destroy) {
            boundDrawerCleanups.delete(button);
        }
        if (drawer && boundDrawerCleanups.get(drawer) === destroy) {
            boundDrawerCleanups.delete(drawer);
        }
        if (button) {
            button.removeEventListener('click', onTriggerClick);
            button.removeEventListener('keydown', onTriggerKeyDown);
        }
        if (closeBtn) {
            closeBtn.removeEventListener('click', onCloseBtnClick);
        }
        if (overlay) {
            overlay.removeEventListener('click', onOverlayClick);
            overlay.removeEventListener('touchstart', onTouchStart);
            overlay.removeEventListener('touchmove', onTouchMove);
            overlay.removeEventListener('touchend', onTouchEnd);
            overlay.removeEventListener('touchcancel', onTouchEnd);
        }
        if (drawer) {
            drawer.removeEventListener('click', onDrawerClick);
            drawer.removeEventListener('keydown', onDrawerKeyDown);
            drawer.removeEventListener('cancel', onCancel);
            drawer.removeEventListener('touchstart', onTouchStart);
            drawer.removeEventListener('touchmove', onTouchMove);
            drawer.removeEventListener('touchend', onTouchEnd);
            drawer.removeEventListener('touchcancel', onTouchEnd);
        }
    };

    if (button) {
        boundDrawerCleanups.set(button, destroy);
    }
    if (drawer) {
        boundDrawerCleanups.set(drawer, destroy);
    }

    return {
        open,
        close,
        toggle,
        isOpen,
        destroy
    };
}

/**
 * @typedef {Object} DrawerSubMenuItem
 * @property {string} id - Unique identifier for the sub-menu item
 * @property {string} [label] - Explicit display text
 * @property {string} [labelKey] - i18n translation key
 * @property {string} [i18nKey] - Alternative i18n translation key
 * @property {string} icon - SVG icon name or symbol ID
 * @property {string} [iconFilled] - Optional active filled SVG icon name
 * @property {string} [href] - Optional URL or hash link
 * @property {string} [badge] - Optional badge label/count
 * @property {boolean} [isActive] - Explicit active state override
 * @property {(id: string, event: MouseEvent | Event) => void} [onSelect] - Selection callback
 */

/**
 * @typedef {Object} DrawerStatDescriptor
 * @property {'equipment' | 'hero-journey' | 'trophies' | 'townhall' | 'custom'} [type] - Canonical stat preset or 'custom'
 * @property {string} [label] - Custom label text
 * @property {string} [value] - Custom formatted value
 * @property {string} [icon] - SVG icon name
 * @property {'svg' | 'image'} [iconType] - Icon rendering type ('svg' | 'image')
 * @property {string} [iconSrc] - Image source path if iconType is 'image'
 */

/**
 * @typedef {Object} DrawerProfileData
 * @property {string} [name] - Village name
 * @property {string} [tag] - Village tag (e.g. #8PJYGUJC)
 * @property {number} [townHallLevel] - Town hall level
 * @property {number} [trophies] - Current trophies
 * @property {any} [leagueTier] - League tier object
 * @property {any} [league] - League object
 * @property {string} [leagueIcon] - League icon URL
 * @property {string} [leagueName] - League name
 * @property {number} [heroLevel] - Total cumulative hero level
 * @property {number} [oreProgressPct] - Completion percentage of ores
 * @property {number} [progressPct] - Legacy fallback completion percentage
 * @property {{ cumulativeHeroLevel?: number }} [heroJourney] - Hero journey progress
 * @property {any} [cachedData] - Raw or cached player API profile
 */

/**
 * @typedef {Object} DrawerContentOptions
 * @property {Element | null} [drawerEl] - The drawer dialog element.
 * @property {'hub' | 'ore-calculator' | 'hero-journey' | string} [activeTool='ore-calculator'] - Active platform tool.
 * @property {string} [activeView] - ID of the active view/tab within the tool.
 * @property {string} [subtitle] - Optional subtitle text for the drawer header.
 * @property {string} [playerTag] - Active player tag (with or without #).
 * @property {DrawerProfileData | null} [profileData] - Cached active village data.
 * @property {DrawerSubMenuItem[]} [subMenus] - Declarative list of sub-navigation items.
 * @property {DrawerSubMenuItem[]} [views] - Alias for subMenus.
 * @property {DrawerStatDescriptor[]} [stats] - Declarative list of context card stats.
 * @property {(viewId: string, event: Event) => void} [onViewSelect] - Callback when a view is clicked.
 * @property {(cleanTag: string) => void} [onAccountSwitch] - Callback when an account is switched.
 * @property {() => void} [onGuestLoad] - Callback when guest load CTA is clicked.
 */

/**
 * Gracefully closes the drawer dialog, backdrop overlay, and body locks.
 * @param {Element | null} drawer
 */
export function closeDrawerInternal(drawer) {
    if (!drawer) return;
    drawer.classList.remove('open');
    const overlay = drawer.parentElement?.querySelector('.navigation-drawer__overlay') || document.querySelector('.navigation-drawer__overlay');
    if (overlay) {
        overlay.classList.remove('show');
        overlay.classList.remove('closing');
    }
    document.body?.classList.remove('open-drawer');
    const dialog = /** @type {HTMLDialogElement} */ (drawer);
    if (typeof dialog.close === 'function' && dialog.open) {
        try { dialog.close(); } catch (_) {}
    }
    const btn = document.querySelector('.hamburger, #hj-hamburger-btn, #landing-hamburger-btn, .app-header__hamburger');
    if (btn) {
        btn.setAttribute('aria-expanded', 'false');
    }
}
