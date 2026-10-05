/**
 * Navigation Drawer Template Rendering, Metrics Calculation & Content Population.
 * Tier 4: UI Renderer (Pure DOM generation).
 */

import { translate } from '../../i18n/translator.js';
import { getLanguageFromPath } from '../../core/languageRouter.js';
import { navigationRegistry } from '../../data/navigationRegistry.js';
import { getSavedProfiles, resolvePlayerSummaryStats } from '../../core/playerStorage.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { symbolExists } from '../../utils/svgManager.js';
import { initAppFooter } from './appFooter.js';
import { closeDrawerInternal } from './navigationDrawer.js';
import { initializeChangelogModal, showChangelogModal } from '../changelog/changelogModal.js';
import { openBugReportModal, openContactModal } from '../appSettings/settingsSupportModals.js';
import { getChangelogHtml } from '../../services/changelogService.js';
import { formatNumber } from '../../utils/numberFormatter.js';

const escapeHtml = escapeHTML;

/**
 * Resolves drawer profile summary and progression metrics from cached player state or explicit overrides.
 *
 * @param {string} [cleanTag=''] - Sanitized player tag without # prefix.
 * @param {import('./navigationDrawer.js').DrawerProfileData | null} [explicitProfile=null] - Optional explicit profile data.
 * @returns {ReturnType<typeof resolvePlayerSummaryStats>}
 */
function resolveDrawerProfileStats(cleanTag = '', explicitProfile = null) {
    return resolvePlayerSummaryStats(cleanTag, explicitProfile);
}

/**
 * Builds HTML markup for declarative context card metrics with responsive left/right layouts and dividers.
 * @param {import('./navigationDrawer.js').DrawerStatDescriptor[] | null | undefined} statsList
 * @param {ReturnType<typeof resolveDrawerProfileStats>} profileSummary
 * @returns {string}
 */
function buildDrawerMetricsHtml(statsList, profileSummary) {
    const effectiveStats = (Array.isArray(statsList) && statsList.length > 0)
        ? statsList
        : [{ type: 'equipment' }, { type: 'hero-journey' }];

    return effectiveStats.map((stat, index) => {
        let label = '';
        let value = '';
        let iconName = '';
        let iconType = 'svg';
        let iconSrc = '';

        if (stat.type === 'equipment') {
            label = translate('nav.equipment') || 'Equipment';
            value = profileSummary.oresDoneText;
            iconType = 'image';
            iconSrc = 'assets/shiny_ore.png';
        } else if (stat.type === 'hero-journey') {
            label = translate('nav.context.heroJourney') || 'Hero Journey';
            value = profileSummary.nextNodeText;
            iconType = 'svg';
            iconName = 'timeline';
        } else if (stat.type === 'trophies') {
            label = translate('views.guidedSetup.trophies') || 'Trophies';
            value = profileSummary.trophies > 0 ? formatNumber(profileSummary.trophies) : '--';
            iconType = 'svg';
            iconName = 'trophy';
        } else if (stat.type === 'townhall') {
            label = translate('entities.defenses.townHall') || 'Town Hall';
            value = `TH${profileSummary.thLevel}`;
            iconType = 'image';
            iconSrc = `assets/th/th${profileSummary.thLevel}.png`;
        } else {
            label = stat.label || '';
            value = stat.value || '';
            iconType = stat.iconType || 'svg';
            iconName = stat.icon || '';
            iconSrc = stat.iconSrc || stat.icon || '';
        }

        const positionClass = index === 0 ? 'navigation-drawer__context-metric--left' : 'navigation-drawer__context-metric--right';

        const iconHtml = iconType === 'image'
            ? `<orecalc-assets-image class="navigation-drawer__context-metric-icon" src="${escapeHtml(iconSrc)}" alt="${escapeHtml(label)}" size="thumbnail"></orecalc-assets-image>`
            : `<orecalc-assets-svg name="${escapeHtml(iconName)}" class="navigation-drawer__context-metric-icon"></orecalc-assets-svg>`;

        const metricMarkup = `
            <div class="navigation-drawer__context-metric ${positionClass}">
                <span class="navigation-drawer__context-metric-label">${escapeHtml(label)}</span>
                <div class="navigation-drawer__context-metric-value">
                    ${iconHtml}
                    <span class="navigation-drawer__context-metric-text">${escapeHtml(value)}</span>
                </div>
            </div>
        `;

        if (index < effectiveStats.length - 1) {
            return `${metricMarkup}<div class="navigation-drawer__context-metric-divider" aria-hidden="true"></div>`;
        }
        return metricMarkup;
    }).join('');
}

/**
 * Renders the modular Option 2 Navigation Drawer content:
 * 1. 4-Segment Tool Dock (Hub, OreCalc, Journey, Damage Calculator [Soon])
 * 2. Active Tool Context Card (village summary & progression status)
 * 3. Contextual Sub-Navigation Views
 * 4. Secondary Action Links (Changelog, GitHub, Support)
 *
 * @param {import('./navigationDrawer.js').DrawerContentOptions} [options]
 */
export function renderNavigationDrawerContent(options = {}) {
    const drawer = options.drawerEl || document.getElementById('navigation-drawer') || document.querySelector('.navigation-drawer');
    if (!drawer) return;

    let activeTool = options.activeTool;
    if (!activeTool) {
        const path = typeof window !== 'undefined' ? window.location.pathname : '';
        if (path.includes('/damage-calculator')) activeTool = 'damage-calculator';
        else if (path.includes('/hero-journey')) activeTool = 'hero-journey';
        else if (path.includes('/ore-calculator')) activeTool = 'ore-calculator';
        else if (path === '/' || /^\/[a-z-]+\/?$/.test(path)) activeTool = 'hub';
        else activeTool = 'ore-calculator';
    }
    const activeView = options.activeView || '';
    const currentLang = getLanguageFromPath() || 'en';
    const langPrefix = currentLang === 'en' ? '' : `/${currentLang}`;
    const cleanTag = options.playerTag ? options.playerTag.replace(/^#/, '').trim() : '';
    const tagQuery = cleanTag ? `?tag=${encodeURIComponent(cleanTag)}` : '';

    // Render pinned tool dock
    const dockContainer = drawer.querySelector('.navigation-drawer__dock');
    if (dockContainer) {
        dockContainer.innerHTML = '';

        const dockItems = [
            {
                id: 'hub',
                href: `${langPrefix}/`,
                iconActive: 'home-filled',
                iconInactive: 'home-outline',
                label: translate('nav.dock.hub') || 'Hub',
                isActive: activeTool === 'hub'
            },
            {
                id: 'ore-calculator',
                href: `${langPrefix}/ore-calculator/${tagQuery}`,
                iconActive: 'equipment-filled',
                iconInactive: 'equipment-outline',
                label: translate('app.brandToolName') || 'OreCalc',
                isActive: activeTool === 'ore-calculator'
            },
            {
                id: 'hero-journey',
                href: `${langPrefix}/hero-journey/${tagQuery}`,
                iconActive: 'timeline',
                iconInactive: 'timeline',
                label: translate('nav.dock.heroJourney') || 'Journey',
                isActive: activeTool === 'hero-journey'
            },
            {
                id: 'damage-calculator',
                href: `${langPrefix}/damage-calculator/${tagQuery}`,
                iconActive: 'swords-filled',
                iconInactive: 'swords-outline',
                label: translate('entities.stats.damage') || 'Damage',
                isActive: activeTool === 'damage-calculator'
            }
        ];

        dockItems.forEach(item => {
            if (item.isSoon) {
                const soonBtn = document.createElement('div');
                soonBtn.className = 'navigation-drawer__dock-btn navigation-drawer__dock-btn--soon';
                soonBtn.setAttribute('aria-disabled', 'true');
                soonBtn.setAttribute('tabindex', '-1');
                soonBtn.dataset.tool = item.id;
                soonBtn.innerHTML = `
                    <span class="navigation-drawer__dock-badge-soon">${escapeHtml(translate('views.settings.badges.comingSoon') || 'Soon')}</span>
                    <orecalc-assets-svg name="${item.iconActive}"></orecalc-assets-svg>
                    <span>${escapeHtml(item.label)}</span>
                `;
                dockContainer.appendChild(soonBtn);
            } else {
                const btn = document.createElement('a');
                btn.href = item.href || '#';
                btn.className = `navigation-drawer__dock-btn ${item.isActive ? 'active' : ''}`;
                btn.dataset.tool = item.id;
                if (item.isActive) {
                    btn.setAttribute('aria-current', 'page');
                }
                const iconName = item.isActive ? item.iconActive : item.iconInactive;
                btn.innerHTML = `
                    <orecalc-assets-svg name="${iconName}"></orecalc-assets-svg>
                    <span>${escapeHtml(item.label)}</span>
                `;
                dockContainer.appendChild(btn);
            }
        });
    }

    // Render active tool context card
    const contextCard = drawer.querySelector('.navigation-drawer__context-card');
    if (contextCard) {
        contextCard.innerHTML = '';

        const summary = resolveDrawerProfileStats(cleanTag, options.profileData);

        if (!summary.hasProfile) {
            contextCard.className = 'navigation-drawer__context-card navigation-drawer__context-card--guest';
            contextCard.innerHTML = `
                <div class="navigation-drawer__context-guest-left">
                    <div class="navigation-drawer__context-guest-icon-wrapper">
                        <orecalc-assets-svg name="search"></orecalc-assets-svg>
                    </div>
                    <div class="navigation-drawer__context-guest-info">
                        <div class="navigation-drawer__context-guest-title">${escapeHtml(translate('nav.context.noVillage') || 'No Village Loaded')}</div>
                        <div class="navigation-drawer__context-guest-desc">${escapeHtml(translate('nav.context.loadPrompt') || 'Enter player tag to track progress')}</div>
                    </div>
                </div>
                <button type="button" class="navigation-drawer__context-guest-btn">${escapeHtml(translate('actions.load') || 'Load')}</button>
            `;

            const guestBtn = contextCard.querySelector('.navigation-drawer__context-guest-btn');
            if (guestBtn) {
                guestBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    closeDrawerInternal(drawer);
                    if (typeof options.onGuestLoad === 'function') {
                        options.onGuestLoad();
                    } else if (activeTool === 'hub') {
                        const searchInput = document.getElementById('landing-search-input');
                        const searchSection = document.getElementById('landing-search-form');
                        searchSection?.scrollIntoView({ behavior: 'smooth' });
                        searchInput?.focus();
                    } else if (activeTool === 'hero-journey') {
                        const searchInput = document.getElementById('hj-search-input');
                        searchInput?.focus();
                    } else {
                        const playerBtn = document.getElementById('player-dropdown-button');
                        if (playerBtn) playerBtn.click();
                    }
                });
            }
        } else {
            contextCard.className = 'navigation-drawer__context-card';

            const savedProfiles = getSavedProfiles();
            const hasMultipleAccounts = savedProfiles.length > 1;

            contextCard.innerHTML = `
                <div class="navigation-drawer__context-header">
                    <div class="navigation-drawer__context-identity">
                        <div class="navigation-drawer__context-th-wrapper">
                            <orecalc-assets-image class="navigation-drawer__context-th" src="assets/th/th${summary.thLevel}.png" alt="Town Hall ${summary.thLevel}" size="standard"></orecalc-assets-image>
                        </div>
                        <div class="navigation-drawer__context-player-info">
                            <div class="navigation-drawer__context-name-row">
                                <span class="navigation-drawer__context-name">${escapeHtml(summary.profileName)}</span>
                            </div>
                            <div class="navigation-drawer__context-meta-row">
                                <span class="navigation-drawer__context-tag">${escapeHtml(summary.displayTag)}</span>
                                ${summary.leagueIcon ? `
                                    <span class="navigation-drawer__context-meta-bullet" aria-hidden="true">&bull;</span>
                                    <span class="navigation-drawer__context-trophies" title="${escapeHtml(summary.leagueName)}">
                                        <orecalc-assets-image class="navigation-drawer__context-league-icon" src="${escapeHtml(summary.leagueIcon)}" alt="${escapeHtml(summary.leagueName)}" size="thumbnail"></orecalc-assets-image>
                                        ${summary.trophies > 0 ? `${escapeHtml(formatNumber(summary.trophies))}` : ''}
                                    </span>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    ${hasMultipleAccounts ? `
                        <button type="button" class="navigation-drawer__context-switch-btn" aria-label="${escapeHtml(translate('nav.context.switchVillage') || 'Switch Village')}" aria-expanded="false" title="${escapeHtml(translate('nav.context.switchVillage') || 'Switch Village')}">
                            <orecalc-assets-svg name="chevron-down"></orecalc-assets-svg>
                        </button>
                    ` : ''}
                </div>
                ${hasMultipleAccounts ? `
                    <div class="navigation-drawer__context-switcher-menu" hidden>
                        ${savedProfiles.map(p => {
                            const isCurrent = p.cleanTag === cleanTag;
                            const pTh = Math.max(1, Math.min(18, Number(p.townHallLevel) || 18));
                            return `
                                <button type="button" class="navigation-drawer__context-switcher-item ${isCurrent ? 'is-active' : ''}" data-tag="${escapeHtml(p.cleanTag)}">
                                    <div class="navigation-drawer__context-switcher-item-left">
                                        <orecalc-assets-image class="navigation-drawer__context-switcher-th" src="assets/th/th${pTh}.png" alt="TH${pTh}" size="thumbnail"></orecalc-assets-image>
                                        <span class="navigation-drawer__context-switcher-name">${escapeHtml(p.name)}</span>
                                    </div>
                                    <span class="navigation-drawer__context-switcher-tag">${escapeHtml(p.tag)}</span>
                                </button>
                            `;
                        }).join('')}
                    </div>
                ` : ''}
                <div class="navigation-drawer__context-metrics">
                    ${buildDrawerMetricsHtml(options.stats, summary)}
                </div>
            `;

            if (hasMultipleAccounts) {
                const switchBtn = contextCard.querySelector('.navigation-drawer__context-switch-btn');
                const switcherMenu = contextCard.querySelector('.navigation-drawer__context-switcher-menu');
                if (switchBtn) {
                    switchBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const isExpanded = switchBtn.getAttribute('aria-expanded') === 'true';
                        switchBtn.setAttribute('aria-expanded', String(!isExpanded));
                        switchBtn.classList.toggle('is-expanded', !isExpanded);
                        if (switcherMenu) {
                            switcherMenu.hidden = isExpanded;
                        }
                    });

                    contextCard.querySelectorAll('.navigation-drawer__context-switcher-item').forEach(item => {
                        item.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const targetTag = item.getAttribute('data-tag');
                            if (!targetTag || targetTag === cleanTag) {
                                switchBtn.setAttribute('aria-expanded', 'false');
                                switchBtn.classList.remove('is-expanded');
                                if (switcherMenu) switcherMenu.hidden = true;
                                return;
                            }
                            closeDrawerInternal(drawer);
                            if (typeof options.onAccountSwitch === 'function') {
                                options.onAccountSwitch(targetTag);
                            } else {
                                const url = new URL(window.location.href);
                                url.searchParams.set('tag', targetTag);
                                window.location.href = url.toString();
                            }
                        });
                    });
                }
            }
        }
    }

    // Render sub-navigation views
    const tabsContainer = drawer.querySelector('.navigation-drawer__tabs');
    if (tabsContainer) {
        tabsContainer.innerHTML = '';

        const subMenus = Array.isArray(options.subMenus) && options.subMenus.length > 0
            ? options.subMenus
            : (Array.isArray(options.views) && options.views.length > 0 ? options.views : null);

        if (subMenus) {
            subMenus.forEach(item => {
                const isExplicitActive = typeof item.isActive === 'boolean' ? item.isActive : null;
                const isActive = isExplicitActive !== null
                    ? isExplicitActive
                    : (activeView === item.id || activeView === `${item.id}-tab`);

                const isOutlineExists = symbolExists(item.icon);
                const isFilledExists = symbolExists(item.iconFilled);
                const iconOutline = isOutlineExists ? item.icon : (item.iconFilled || item.icon);
                const iconFilled = isFilledExists ? item.iconFilled : (item.icon || item.iconFilled);
                const currentIcon = (isActive && iconFilled) ? iconFilled : (iconOutline || item.icon);
                const currentIconName = currentIcon?.startsWith('#icon-') ? currentIcon.substring(6) : (currentIcon || item.icon);

                const labelText = item.label || (item.labelKey ? translate(item.labelKey) : (item.i18nKey ? translate(item.i18nKey) : item.id));

                const isLink = Boolean(item.href);
                const el = document.createElement(isLink ? 'a' : 'button');
                if (isLink) {
                    el.href = item.href;
                } else {
                    el.type = 'button';
                }

                el.className = `navigation-drawer__tab ${isActive ? 'active' : ''}`;
                el.dataset.tab = item.id;
                el.dataset.view = item.id;
                if (isActive) {
                    el.setAttribute('aria-current', 'page');
                }

                el.innerHTML = `
                    <orecalc-assets-svg name="${escapeHtml(currentIconName)}" fill="${isActive ? 'var(--accent-primary)' : 'var(--text-secondary)'}"></orecalc-assets-svg>
                    <span ${item.labelKey ? `data-i18n="${item.labelKey}"` : (item.i18nKey ? `data-i18n="${item.i18nKey}"` : '')}>${escapeHtml(labelText)}</span>
                    ${item.badge ? `<span class="navigation-drawer__tab-badge">${escapeHtml(item.badge)}</span>` : ''}
                `;

                el.addEventListener('click', (e) => {
                    closeDrawerInternal(drawer);
                    if (typeof item.onSelect === 'function') {
                        item.onSelect(item.id, e);
                    } else if (typeof options.onViewSelect === 'function') {
                        options.onViewSelect(item.id, e);
                    }
                });

                tabsContainer.appendChild(el);
            });
        } else if (activeTool === 'ore-calculator') {
            navigationRegistry.forEach(tab => {
                const isActive = activeView === `${tab.id}-tab` || activeView === tab.id;
                const activeClass = isActive ? 'active' : '';

                const hasOutline = symbolExists(tab.iconOutline);
                const hasFilled = symbolExists(tab.iconFilled);
                const iconOutline = hasOutline ? tab.iconOutline : tab.iconFilled;
                const iconFilled = hasFilled ? tab.iconFilled : tab.iconOutline;
                const currentIcon = isActive ? iconFilled : iconOutline;
                const currentIconName = currentIcon.startsWith('#icon-') ? currentIcon.substring(6) : currentIcon;

                const button = document.createElement('button');
                button.type = 'button';
                button.className = `navigation-drawer__tab ${activeClass}`;
                button.dataset.tab = tab.id;
                if (isActive) {
                    button.setAttribute('aria-current', 'page');
                }

                button.innerHTML = `
                    <orecalc-assets-svg name="${currentIconName}" fill="${isActive ? 'var(--accent-primary)' : 'var(--text-secondary)'}"></orecalc-assets-svg>
                    <span data-i18n="${tab.i18nKey}">${escapeHtml(translate(tab.i18nKey))}</span>
                `;

                button.addEventListener('click', (e) => {
                    closeDrawerInternal(drawer);
                    if (typeof options.onViewSelect === 'function') {
                        options.onViewSelect(tab.id, e);
                    }
                });

                tabsContainer.appendChild(button);
            });
        } else if (activeTool === 'damage-calculator') {
            const damageViews = [
                {
                    id: 'zapquake',
                    iconActive: 'zap-filled',
                    iconInactive: 'zap-outline',
                    title: translate('views.damageCalc.tabs.zapQuake') || 'ZapQuake Solver'
                },
                {
                    id: 'cluster_planner',
                    iconActive: 'shield-filled',
                    iconInactive: 'shield-outline',
                    title: translate('views.damageCalc.tabs.clusterPlanner') || 'Cluster Planner'
                }
            ];

            damageViews.forEach(view => {
                const isActive = activeView === view.id || (!activeView && view.id === 'zapquake');
                const currentIcon = isActive ? view.iconActive : view.iconInactive;
                const button = document.createElement('button');
                button.type = 'button';
                button.className = `navigation-drawer__tab ${isActive ? 'active' : ''}`;
                button.dataset.view = view.id;
                if (isActive) {
                    button.setAttribute('aria-current', 'page');
                }

                button.innerHTML = `
                    <orecalc-assets-svg name="${currentIcon}" fill="${isActive ? 'var(--accent-primary)' : 'var(--text-secondary)'}"></orecalc-assets-svg>
                    <span>${escapeHtml(view.title)}</span>
                `;

                button.addEventListener('click', (e) => {
                    closeDrawerInternal(drawer);
                    if (typeof options.onViewSelect === 'function') {
                        options.onViewSelect(view.id, e);
                    } else {
                        const tabBtn = document.getElementById(`tab-btn-${view.id}`);
                        if (tabBtn) tabBtn.click();
                    }
                });

                tabsContainer.appendChild(button);
            });
        }
    }

    // Render secondary actions (Bug Report & Contact side-by-side, Changelog, Crowdin, GitHub, Support)
    const secondaryContainer = drawer.querySelector('.navigation-drawer__secondary-actions');
    if (secondaryContainer) {
        secondaryContainer.innerHTML = '';

        const createSecondaryTab = (item) => {
            const isModal = Boolean(item.action);
            const el = document.createElement(isModal ? 'button' : 'a');
            if (isModal) {
                el.type = 'button';
            } else {
                el.href = item.url || '#';
                el.target = '_blank';
                el.rel = 'noopener noreferrer';
            }
            el.className = `navigation-drawer__tab secondary-tab${item.isHalf ? ' secondary-tab--half' : ''}`;
            el.dataset.actionId = item.id;

            el.innerHTML = `
                <orecalc-assets-svg name="${item.icon}" fill="var(--text-secondary)"></orecalc-assets-svg>
                <span class="tab-label">${escapeHtml(item.title)}</span>
                ${isModal ? '' : '<orecalc-assets-svg name="open-in-new" class="open-in-icon" fill="var(--text-secondary)"></orecalc-assets-svg>'}
            `;

            if (isModal) {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    closeDrawerInternal(drawer);
                    if (item.action === 'changelog') {
                        try {
                            initializeChangelogModal();
                            const content = getChangelogHtml();
                            showChangelogModal(content);
                        } catch (err) {
                            console.error('Failed to open in-app changelog modal:', err);
                        }
                    } else if (item.action === 'bug-report') {
                        try {
                            openBugReportModal();
                        } catch (err) {
                            console.error('Failed to open in-app bug report modal:', err);
                        }
                    } else if (item.action === 'contact') {
                        try {
                            openContactModal();
                        } catch (err) {
                            console.error('Failed to open in-app contact modal:', err);
                        }
                    }
                });
            } else {
                el.addEventListener('click', () => {
                    closeDrawerInternal(drawer);
                });
            }

            return el;
        };

        const pairedRows = [
            [
                { id: 'bug-report', icon: 'bug', title: translate('views.settings.bugReport.title') || 'Bug Report', action: 'bug-report', isHalf: true },
                { id: 'contact', icon: 'mail', title: translate('views.settings.about.contact') || 'Contact', action: 'contact', isHalf: true }
            ],
            [
                { id: 'changelog', icon: 'changelog', title: translate('views.settings.about.changelog') || 'Changelog', action: 'changelog', isHalf: true },
                { id: 'github', icon: 'github', title: translate('views.settings.about.github') || 'GitHub', url: 'https://github.com/abhis-s/oreCalc', isHalf: true }
            ]
        ];

        pairedRows.forEach(rowItems => {
            const rowEl = document.createElement('div');
            rowEl.className = 'navigation-drawer__secondary-row';
            rowItems.forEach(item => rowEl.appendChild(createSecondaryTab(item)));
            secondaryContainer.appendChild(rowEl);
        });

        const fullWidthItems = [
            { id: 'crowdin', icon: 'translate', title: translate('views.settings.about.crowdin') || 'Help Us Translate', url: 'https://crowdin.com/project/orecalc' },
            { id: 'support', icon: 'bmc', title: translate('views.settings.about.buyMeACoffee') || 'Buy Me A Coffee', url: 'https://buymeacoffee.com/orecalc' }
        ];

        fullWidthItems.forEach(item => {
            secondaryContainer.appendChild(createSecondaryTab(item));
        });
    }

    // Update drawer subtitle
    const subtitleEl = drawer.querySelector('.navigation-drawer__subtitle') || drawer.querySelector('[data-drawer-subtitle]');
    if (subtitleEl) {
        if (options.subtitle) {
            subtitleEl.textContent = options.subtitle;
        } else if (activeTool === 'ore-calculator') {
            subtitleEl.textContent = translate('app.title') || 'Ore Calculator';
        } else if (activeTool === 'hero-journey') {
            subtitleEl.textContent = translate('views.heroJourney.widget.title') || "Hero's Journey";
        } else if (activeTool === 'damage-calculator') {
            subtitleEl.textContent = translate('views.damageCalc.offense.equipmentDamageBadge') || 'Equipment Damage';
        } else {
            subtitleEl.textContent = translate('views.landing.drawerSubtitle') || 'Clash of Clans Toolkit';
        }
    }

    // Centralized footer links interceptor, dynamic copyright & app version
    initAppFooter();
}
