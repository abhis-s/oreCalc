import { loadTranslations } from '../i18n/translator.js';
import { updateUIWithTranslations } from '../i18n/uiTranslator.js';

import { registerGlobalErrorBoundaries } from './appEventInterceptors.js';
import { initAppShellNavigator, registerAppRoute } from './appShellNavigator.js';
import { getLanguageFromPath, syncLanguageUrl } from './languageRouter.js';
import { loadState } from './localStorageManager.js';
import { getSavedProfiles } from './playerStorage.js';
import { initializeState, state } from './state.js';
import { consolidateLocalStorageKeys } from './storageMigrations.js';

import { initializeModalHistoryManager } from '../utils/modalHistoryManager.js';

import { initializeSettingsAccount } from '../components/appSettings/settingsAccountInputs.js';
import { initializeAuthModal } from '../components/auth/authModalInputs.js';
import { initializeChangelogModal } from '../components/changelog/changelogModal.js';
import { initializeCommitsModal } from '../components/changelog/commitsModal.js';
import { initAppFooter } from '../components/common/appFooter.js';
import { initAppHeader } from '../components/common/appHeader.js';
import { getAppSettings, initAppSettings, persistAppSettings } from '../components/common/appSettings.js';
import { setupNavigatorUiHooks } from '../components/common/appShellNavigatorHooks.js';
import { initDomainNotice } from '../components/common/domainNotice.js';
import { initExternalLinkCatcher } from '../components/common/externalLinkCatcher.js';
import { initNavigationDrawer } from '../components/common/navigationDrawer.js';
import { initializePlayerModal } from '../components/player/playerModal.js';
import { initShortcutsModalListener } from '../components/shortcuts/shortcutsModal.js';
import { initSpotright } from '../components/spotright/spotrightController.js';
import { initializePwaService } from '../services/pwaService.js';

/**
 * Bootstraps global error boundaries, storage key migrations, language routing,
 * state/uiSettings hydration, and initial i18n dictionary loading.
 * @param {Object} [options={}]
 * @param {boolean} [options.hydrateState=false] - Whether to load and initialize full partitioned state.
 * @param {Promise<any> | null} [options.preloadPromise=null] - Optional promise to await in parallel with translations.
 * @returns {Promise<{ targetLang: string, appSettings: ReturnType<typeof getAppSettings> }>}
 */
export async function bootstrapShellLanguageAndStorage(options = {}) {
    registerGlobalErrorBoundaries();
    consolidateLocalStorageKeys();

    const pathLang = getLanguageFromPath();
    const appSettings = getAppSettings();
    const targetLang = pathLang || (appSettings.language && appSettings.language !== 'auto' ? appSettings.language : 'en');

    if (options.hydrateState) {
        let savedState = null;
        try {
            savedState = loadState();
        } catch (err) {
            console.error('Failed to load saved state:', err);
        }
        const savedProfiles = getSavedProfiles();
        const savedTags = Array.isArray(savedProfiles) && savedProfiles.length > 0
            ? savedProfiles.map(p => p.cleanTag)
            : (savedState?.savedPlayerTags || []);

        initializeState({
            ...savedState,
            savedPlayerTags: savedTags,
            uiSettings: {
                ...(savedState?.uiSettings || {}),
                language: targetLang,
                theme: appSettings.theme,
                accentColor: appSettings.accentColor
            }
        });
    } else {
        state.uiSettings = {
            ...(state.uiSettings || {}),
            language: targetLang,
            theme: appSettings.theme,
            accentColor: appSettings.accentColor
        };
    }

    if (pathLang) {
        persistAppSettings({ language: pathLang });
    } else if (targetLang !== 'en') {
        syncLanguageUrl(targetLang, true);
    }

    if (options.preloadPromise) {
        await Promise.all([loadTranslations(targetLang), options.preloadPromise]);
    } else {
        await loadTranslations(targetLang);
    }
    updateUIWithTranslations(true);

    return { targetLang, appSettings };
}

/**
 * Initializes shared shell chrome, header, footer, and global modals across standalone routes.
 * @param {Object} [options={}]
 * @param {import('../components/common/appHeader.js').AppHeaderOptions | null} [options.headerOptions=null]
 * @param {boolean} [options.domainNotice=true]
 * @param {Object} [options.domainNoticeOptions]
 * @param {Object} [options.accountOptions]
 * @param {boolean} [options.includePlayerModal=false]
 * @param {Object} [options.footerOptions]
 */
export function initSharedShellChrome(options = {}) {
    if (options.domainNotice !== false) {
        initDomainNotice(options.domainNoticeOptions);
    }
    if (options.headerOptions) {
        initAppHeader(options.headerOptions);
    }

    initAppSettings();
    initializePwaService();
    initializeModalHistoryManager();
    initializeCommitsModal();
    initializeChangelogModal();
    initSpotright();
    initShortcutsModalListener();
    initializeAuthModal();
    initializeSettingsAccount(options.accountOptions);
    if (options.includePlayerModal) {
        initializePlayerModal();
    }
    initExternalLinkCatcher();
    initAppFooter(options.footerOptions);
}

/**
 * Binds the standalone mobile navigation drawer to the header hamburger trigger.
 * @param {() => void} [onBeforeInit] - Optional callback to render initial drawer content before binding.
 * @returns {ReturnType<typeof initNavigationDrawer> | null}
 */
export function bindStandaloneNavigationDrawer(onBeforeInit) {
    const drawerEl = document.getElementById('navigation-drawer');
    const overlayEl = document.querySelector('.navigation-drawer__overlay');
    const buttonEl = document.getElementById('hamburger-button') || document.querySelector('.app-header__hamburger, .hamburger');
    const closeEl = drawerEl?.querySelector('.navigation-drawer__close') || null;

    if (!drawerEl || !buttonEl) return null;

    onBeforeInit?.();

    const instance = initNavigationDrawer({
        drawerEl,
        overlayEl,
        buttonEl,
        closeEl,
        onItemClick: () => {
            instance?.close();
        }
    });
    return instance;
}

/**
 * Wires navigator UI hooks, registers the route controller, and announces startup completion.
 * @param {import('./appShellNavigator.js').AppRouteId} routeKey
 * @param {{ mount: (options?: Object) => Promise<void>, destroy: () => void, isStandalone?: boolean }} config
 */
export function finalizeRouteMount(routeKey, { mount, destroy, isStandalone = true }) {
    setupNavigatorUiHooks();
    initAppShellNavigator();
    registerAppRoute(routeKey, { mount, destroy });

    if (isStandalone && typeof window !== 'undefined') {
        if (typeof window.__APP_LOADED__ === 'function') {
            window.__APP_LOADED__();
        }
        window.isAppStartingUp = false;
    }
}

/**
 * Automatically invokes a route's mount function once the DOM is ready.
 * @param {() => Promise<void>} mountFn
 */
export function mountWhenReady(mountFn) {
    if (typeof document === 'undefined') return;
    const run = () => {
        mountFn().catch((err) => {
            console.error('Error bootstrapping route:', err);
        });
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }
}
