import { dom } from '../../dom/domElements.js';

import { navigationRegistry } from '../../data/navigationRegistry.js';
import { translate } from '../../i18n/translator.js';

/**
 * Checks if an SVG symbol with the given ID exists in the DOM.
 * @param {string} id - The ID of the symbol (e.g., '#icon-home-filled').
 * @returns {boolean} - True if the symbol exists.
 */
function symbolExists(id) {
    if (!id) return false;
    const symbolId = id.startsWith('#') ? id.substring(1) : id;
    return !!document.getElementById(symbolId);
}

export function renderNavigation(activeTabId) {
    renderBottomNav(activeTabId);
    renderNavigationDrawer(activeTabId);

    // Dynamic import to avoid circular dependencies
    import('../modals/updateModal.js').then(module => {
        module.updateNavigationBadges();
    }).catch(err => console.error('Failed to update nav badges:', err));
}

function renderBottomNav(activeTabId) {
    const container = document.querySelector('.bottom-nav-bar');
    if (!container) return;

    container.innerHTML = '';
    navigationRegistry.forEach(tab => {
        const isActive = activeTabId === `${tab.id}-tab` || activeTabId === tab.id;
        const activeClass = isActive ? 'active' : '';

        // Mutual Fallback
        const hasOutline = symbolExists(tab.iconOutline);
        const hasFilled = symbolExists(tab.iconFilled);

        const iconOutline = hasOutline ? tab.iconOutline : tab.iconFilled;
        const iconFilled = hasFilled ? tab.iconFilled : tab.iconOutline;

        const nameOutline = iconOutline.startsWith('#icon-') ? iconOutline.substring(6) : iconOutline;
        const nameFilled = iconFilled.startsWith('#icon-') ? iconFilled.substring(6) : iconFilled;

        const button = document.createElement('button');
        button.className = `nav-button ${activeClass}`;
        button.dataset.tab = tab.id;

        button.innerHTML = `
            <div class="nav-item-content">
                <div class="nav-icon-wrapper">
                    <span class="icon-outline">
                        <orecalc-assets-svg name="${nameOutline}" fill="var(--text-secondary)"></orecalc-assets-svg>
                    </span>
                    <span class="icon-filled">
                        <orecalc-assets-svg name="${nameFilled}" fill="var(--accent-primary)"></orecalc-assets-svg>
                    </span>
                </div>
                <span data-i18n="${tab.i18nKey}">${translate(tab.i18nKey)}</span>
            </div>
        `;
        container.appendChild(button);
    });
}

function renderNavigationDrawer(activeTabId) {
    const container = document.querySelector('.navigation-drawer__tabs');
    if (!container) return;

    container.innerHTML = '';
    navigationRegistry.forEach(tab => {
        const isActive = activeTabId === `${tab.id}-tab` || activeTabId === tab.id;
        const activeClass = isActive ? 'active' : '';

        // Mutual Fallback
        const hasOutline = symbolExists(tab.iconOutline);
        const hasFilled = symbolExists(tab.iconFilled);

        const iconOutline = hasOutline ? tab.iconOutline : tab.iconFilled;
        const iconFilled = hasFilled ? tab.iconFilled : tab.iconOutline;

        const currentIcon = isActive ? iconFilled : iconOutline;
        const currentIconName = currentIcon.startsWith('#icon-') ? currentIcon.substring(6) : currentIcon;

        const button = document.createElement('button');
        button.className = `navigation-drawer__tab ${activeClass}`;
        button.dataset.tab = tab.id;

        button.innerHTML = `
            <orecalc-assets-svg name="${currentIconName}" fill="${isActive ? 'var(--accent-primary)' : 'var(--text-secondary)'}"></orecalc-assets-svg>
            <span data-i18n="${tab.i18nKey}">${translate(tab.i18nKey)}</span>
        `;
        container.appendChild(button);
    });

    // Secondary actions container (at the bottom)
    const secondaryContainer = document.querySelector('.navigation-drawer__secondary-actions');
    if (secondaryContainer) {
        secondaryContainer.innerHTML = '';
        
        const secondaryItems = [
            {
                id: 'changelog',
                icon: 'changelog',
                i18nKey: 'settings.changelog',
                action: () => {
                    Promise.all([
                        import('../changelog/changelogModal.js'),
                        import('../../services/changelogService.js')
                    ]).then(([modalModule, serviceModule]) => {
                        const content = serviceModule.getChangelogHtml();
                        modalModule.showChangelogModal(content);
                    }).catch(err => console.error(err));
                }
            },
            {
                id: 'github',
                icon: 'github',
                i18nKey: 'settings.github',
                url: 'https://github.com/abhis-s/oreCalc'
            },
            {
                id: 'support',
                icon: 'bmc',
                i18nKey: 'settings.buyMeACoffee',
                url: 'https://buymeacoffee.com/orecalc'
            }
        ];

        secondaryItems.forEach(item => {
            let el;
            if (item.url) {
                el = document.createElement('a');
                el.href = item.url;
                el.target = '_blank';
                el.rel = 'noopener noreferrer';
                el.addEventListener('click', () => {
                    // Close navigation drawer so that the confirmation notice modal is not covered
                    import('./navigation.js').then(module => {
                        const isOpen = document.querySelector('.navigation-drawer').classList.contains('open');
                        if (isOpen) {
                            const overlay = document.querySelector('.navigation-drawer__overlay');
                            document.querySelector('.navigation-drawer').classList.remove('open');
                            if (overlay) overlay.classList.remove('show');
                            document.body.classList.remove('open-drawer');
                        }
                    });
                });
            } else {
                el = document.createElement('button');
                if (item.action) {
                    el.addEventListener('click', () => {
                        import('./navigation.js').then(module => {
                            const isOpen = document.querySelector('.navigation-drawer').classList.contains('open');
                            if (isOpen) {
                                const overlay = document.querySelector('.navigation-drawer__overlay');
                                document.querySelector('.navigation-drawer').classList.remove('open');
                                if (overlay) overlay.classList.remove('show');
                                document.body.classList.remove('open-drawer');
                            }
                        });
                        item.action();
                    });
                }
            }
            el.className = 'navigation-drawer__tab secondary-tab';
            el.dataset.actionId = item.id;
            
            const openInIconHtml = item.url 
                ? `<orecalc-assets-svg name="open-in-new" class="open-in-icon" fill="var(--text-secondary)"></orecalc-assets-svg>`
                : '';

            el.innerHTML = `
                <orecalc-assets-svg name="${item.icon}" fill="var(--text-secondary)"></orecalc-assets-svg>
                <span class="tab-label" data-i18n="${item.i18nKey}">${translate(item.i18nKey)}</span>
                ${openInIconHtml}
            `;
            secondaryContainer.appendChild(el);
        });
    }

    // Update dynamic footer version
    const versionEl = document.querySelector('.navigation-drawer__app-version');
    if (versionEl) {
        const appVersion = (window.__ENV__?.APP_VERSION || '2.0.0').replace(/^v/, '');
        versionEl.textContent = `v${appVersion}`;
    }

    // Setup modal listeners for privacy policy and terms of use links
    const privacyLink = document.querySelector('.navigation-drawer__footer-links a[href="privacy.html"]');
    if (privacyLink) {
        privacyLink.addEventListener('click', (e) => {
            e.preventDefault();
            import('./navigation.js').then(module => {
                const isOpen = document.querySelector('.navigation-drawer').classList.contains('open');
                if (isOpen) {
                    const overlay = document.querySelector('.navigation-drawer__overlay');
                    document.querySelector('.navigation-drawer').classList.remove('open');
                    if (overlay) overlay.classList.remove('show');
                    document.body.classList.remove('open-drawer');
                }
            });
            import('../appSettings/appSettings.js').then(module => {
                module.openPrivacyModal();
            }).catch(err => console.error(err));
        });
    }

    const termsLink = document.querySelector('.navigation-drawer__footer-links a[href="terms.html"]');
    if (termsLink) {
        termsLink.addEventListener('click', (e) => {
            e.preventDefault();
            import('./navigation.js').then(module => {
                const isOpen = document.querySelector('.navigation-drawer').classList.contains('open');
                if (isOpen) {
                    const overlay = document.querySelector('.navigation-drawer__overlay');
                    document.querySelector('.navigation-drawer').classList.remove('open');
                    if (overlay) overlay.classList.remove('show');
                    document.body.classList.remove('open-drawer');
                }
            });
            import('../appSettings/appSettings.js').then(module => {
                module.openTermsOfUseModal();
            }).catch(err => console.error(err));
        });
    }
}

