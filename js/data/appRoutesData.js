/**
 * Canonical Application & Legal Route Catalog.
 * Defines the unified metadata descriptor table consumed by routing, navigation drawer,
 * brand dropdown, shell DOM synchronization, and localized footer links.
 * Tier 1: Domain Data (zero runtime dependencies).
 */

/**
 * Primary shell stylesheet retained permanently across soft navigations.
 * @type {string}
 */
export const APP_SHELL_STYLESHEET = '/css/main.css';

/**
 * Canonical DOM element IDs for persistent shell modal dialogs shared by every entrypoint.
 * @type {readonly string[]}
 */
export const APP_PERSISTENT_MODAL_IDS = Object.freeze([
    'add-player-modal',
    'changelog-modal',
    'commits-modal',
    'privacy-modal',
    'terms-modal',
    'licenses-modal',
    'notice-modal',
    'auth-modal',
    'update-available-modal',
    'bug-report-modal',
    'contact-modal',
    'running-costs-modal'
]);

/**
 * Canonical application shell routes ordered for navigation presentation.
 * @type {readonly AppRouteDescriptor[]}
 *
 * @typedef {Object} AppRouteDescriptor
 * @property {'hub' | 'ore-calculator' | 'hero-journey' | 'damage-calculator' | 'account' | 'app-management'} id
 * @property {string} path
 * @property {string} script
 * @property {string | null} bodyClass
 * @property {readonly string[]} stylesheets
 * @property {boolean} supportsTag
 * @property {boolean} requiresStandalone
 * @property {boolean} showInBrandMenu
 * @property {boolean} showInDrawerDock
 * @property {string} brandLabelKey
 * @property {string} brandDefaultLabel
 * @property {string} brandIcon
 * @property {string | null} dockLabelKey
 * @property {string | null} dockDefaultLabel
 * @property {string | null} dockIconActive
 * @property {string | null} dockIconInactive
 * @property {string} drawerSubtitleKey
 * @property {string} drawerDefaultSubtitle
 */
export const APP_ROUTES = Object.freeze([
    Object.freeze({
        id: 'hub',
        path: '/',
        script: '/js/landingApp.js',
        bodyClass: 'landing-page',
        stylesheets: Object.freeze(['/css/landing.css']),
        supportsTag: false,
        requiresStandalone: false,
        showInBrandMenu: true,
        showInDrawerDock: true,
        brandLabelKey: 'nav.dock.hub',
        brandDefaultLabel: 'Hub',
        brandIcon: 'home-filled',
        dockLabelKey: 'nav.dock.hub',
        dockDefaultLabel: 'Hub',
        dockIconActive: 'home-filled',
        dockIconInactive: 'home-outline',
        drawerSubtitleKey: 'views.landing.drawerSubtitle',
        drawerDefaultSubtitle: 'Clash of Clans Toolkit'
    }),
    Object.freeze({
        id: 'ore-calculator',
        path: '/ore-calculator/',
        script: '/js/app.js',
        bodyClass: null,
        stylesheets: Object.freeze([]),
        supportsTag: true,
        requiresStandalone: false,
        showInBrandMenu: true,
        showInDrawerDock: true,
        brandLabelKey: 'app.brandToolName',
        brandDefaultLabel: 'OreCalc',
        brandIcon: 'equipment-filled',
        dockLabelKey: 'app.brandToolName',
        dockDefaultLabel: 'OreCalc',
        dockIconActive: 'equipment-filled',
        dockIconInactive: 'equipment-outline',
        drawerSubtitleKey: 'app.title',
        drawerDefaultSubtitle: 'Ore Calculator'
    }),
    Object.freeze({
        id: 'hero-journey',
        path: '/hero-journey/',
        script: '/js/heroJourneyApp.js',
        bodyClass: 'hero-journey-page',
        stylesheets: Object.freeze(['/css/hero-journey.css']),
        supportsTag: true,
        requiresStandalone: false,
        showInBrandMenu: true,
        showInDrawerDock: true,
        brandLabelKey: 'views.heroJourney.widget.title',
        brandDefaultLabel: "Hero's Journey",
        brandIcon: 'timeline',
        dockLabelKey: 'nav.dock.heroJourney',
        dockDefaultLabel: 'Journey',
        dockIconActive: 'timeline',
        dockIconInactive: 'timeline',
        drawerSubtitleKey: 'views.heroJourney.widget.title',
        drawerDefaultSubtitle: "Hero's Journey"
    }),
    Object.freeze({
        id: 'damage-calculator',
        path: '/damage-calculator/',
        script: '/js/damageApp.js',
        bodyClass: 'damage-calc-page',
        stylesheets: Object.freeze(['/css/damage-calculator.css']),
        supportsTag: true,
        requiresStandalone: false,
        showInBrandMenu: true,
        showInDrawerDock: true,
        brandLabelKey: 'views.damageCalc.brandToolName',
        brandDefaultLabel: 'DamageCalc',
        brandIcon: 'swords-filled',
        dockLabelKey: 'entities.stats.damage',
        dockDefaultLabel: 'Damage',
        dockIconActive: 'swords-filled',
        dockIconInactive: 'swords-outline',
        drawerSubtitleKey: 'views.damageCalc.brandToolName',
        drawerDefaultSubtitle: 'DamageCalc'
    }),
    Object.freeze({
        id: 'account',
        path: '/account/',
        script: '/js/accountApp.js',
        bodyClass: 'account-page',
        stylesheets: Object.freeze(['/css/management.css', '/css/account.css']),
        supportsTag: false,
        requiresStandalone: false,
        showInBrandMenu: true,
        showInDrawerDock: false,
        brandLabelKey: 'auth.account',
        brandDefaultLabel: 'Account',
        brandIcon: 'user-filled',
        dockLabelKey: null,
        dockDefaultLabel: null,
        dockIconActive: null,
        dockIconInactive: null,
        drawerSubtitleKey: 'views.account.title',
        drawerDefaultSubtitle: 'Account & Security'
    }),
    Object.freeze({
        id: 'app-management',
        path: '/app-management/',
        script: '/js/appManagementApp.js',
        bodyClass: 'management-page',
        stylesheets: Object.freeze(['/css/management.css']),
        supportsTag: false,
        requiresStandalone: true,
        showInBrandMenu: true,
        showInDrawerDock: false,
        brandLabelKey: 'views.appManagement.title',
        brandDefaultLabel: 'App Management',
        brandIcon: 'devices',
        dockLabelKey: null,
        dockDefaultLabel: null,
        dockIconActive: null,
        dockIconInactive: null,
        drawerSubtitleKey: 'views.appManagement.title',
        drawerDefaultSubtitle: 'App Management'
    })
]);

/**
 * Canonical standalone legal routes built outside the persistent app shell.
 * @type {readonly AppLegalRouteDescriptor[]}
 *
 * @typedef {Object} AppLegalRouteDescriptor
 * @property {'privacy' | 'terms' | 'licenses'} id
 * @property {string} path
 * @property {readonly string[]} supportedLanguages
 * @property {string} modalId
 */
export const APP_LEGAL_ROUTES = Object.freeze([
    Object.freeze({
        id: 'privacy',
        path: '/privacy/',
        supportedLanguages: Object.freeze(['en', 'de']),
        modalId: 'privacy-modal'
    }),
    Object.freeze({
        id: 'terms',
        path: '/terms/',
        supportedLanguages: Object.freeze(['en', 'de']),
        modalId: 'terms-modal'
    }),
    Object.freeze({
        id: 'licenses',
        path: '/licenses/',
        supportedLanguages: Object.freeze(['en']),
        modalId: 'licenses-modal'
    })
]);
