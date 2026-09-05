import { loadTranslations } from './i18n/translator.js';
import { updateUIWithTranslations } from './i18n/uiTranslator.js';

import { bootstrapUIComponents, handlePreloaderTeardown } from './core/appBootstrapper.js';
import {
    initializeGlobalInterceptors,
    isInterruptionRestricted,
    registerGlobalErrorBoundaries,
    triggerPendingModals
} from './core/appEventInterceptors.js';
import { recalculateAll } from './core/calculator.js';
import { detectLanguage, getLanguageFromPath, isValidRoute, syncLanguageUrl } from './core/languageRouter.js';
import { getStorageItem, isClashCalcHost, loadPlayerData, loadState, resetState, saveState, setResettingState, updateSavedPlayerTags } from './core/localStorageManager.js';
import { renderApp } from './core/renderer.js';
import { EFFECTIVE_DATE_PRIVACY, EFFECTIVE_DATE_TERMS, initializeState, state } from './core/state.js';
import { migrateFullState } from './core/stateCleanup.js';
import { compareVersions } from './utils/versionUtils.js';
import { registerStateUpdateCallback, switchActivePlayer } from './core/stateManager.js';
import { loadAndProcessPlayerData } from './services/serverResponseHandler.js';
import {
    THEME_PALETTE,
    animatePreloaderBackground,
    applyTheme,
    availableAccents,
    setThemeRenderCallback
} from './core/themeManager.js';
import { initMainAppCrossTabSync } from './core/crossTabSync.js';
import { getPlayerTagFromUrl, syncPlayerTagToUrl } from './core/playerUrlRouter.js';
import { safeJsonParse } from './utils/jsonUtils.js';
import { logger } from './utils/logger.js';
import './utils/imageManager.js';
import './utils/svgManager.js';

import { showChangelogModal } from './components/changelog/changelogModal.js';
import { showCommitsModal } from './components/changelog/commitsModal.js';
import { dom, initializeDOMElements } from './dom/domElements.js';
import { getChangelogHtml } from './services/changelogService.js';
import { checkLegalConsent, refreshConsentModalStatus } from './services/consentManager.js';
import { initializePwaService } from './services/pwaService.js';
import './console.js';

setThemeRenderCallback(renderApp);
registerGlobalErrorBoundaries();

if (!window.__DOM_CONTENT_LOADED_REGISTERED__) {
    window.__DOM_CONTENT_LOADED_REGISTERED__ = true;
    document.addEventListener('DOMContentLoaded', async () => {
        const urlParams = new URLSearchParams(window.location.search);
        let userIdFromUrl = urlParams.get('userId');
        let tagFromUrl = urlParams.get('tag');

        if (userIdFromUrl) {
            const playerTagsStr = getStorageItem('clashCalc_playerTags', 'oreCalc_playerTags');
            const legacyStateStr = localStorage.getItem('oreCalculatorState') || localStorage.getItem('OreCalculatorState');
            const currentUserId = getStorageItem('clashCalc_userId', 'oreCalc_userId');

            let hasRealLocalData = false;
            if (playerTagsStr) {
                const tags = safeJsonParse(playerTagsStr, []);
                if (Array.isArray(tags) && tags.length > 0) {
                    hasRealLocalData = true;
                }
            } else if (legacyStateStr) {
                const legacy = safeJsonParse(legacyStateStr, null);
                if (legacy && legacy.savedPlayerTags && legacy.savedPlayerTags.length > 0 && legacy.savedPlayerTags[0] !== 'DEFAULT0') {
                    hasRealLocalData = true;
                }
            }

            const isDifferentUser = currentUserId && currentUserId !== userIdFromUrl;
            const targetSearch = (tagFromUrl && tagFromUrl !== 'DEFAULT0')
                ? `?tag=${encodeURIComponent(tagFromUrl)}`
                : '';

            if (hasRealLocalData && isDifferentUser) {
                sessionStorage.setItem('clashCalc_pendingQrUserId', userIdFromUrl);
                sessionStorage.setItem('oreCalc_pendingQrUserId', userIdFromUrl);
                window.history.replaceState({}, document.title, window.location.pathname + targetSearch);
            } else {
                const targetUserIdKey = isClashCalcHost() ? 'clashCalc_userId' : 'oreCalc_userId';
                localStorage.setItem(targetUserIdKey, userIdFromUrl);
                localStorage.setItem('oreCalc_userId', userIdFromUrl);
                sessionStorage.setItem('clashCalc_justSyncedFromQr', 'true');
                sessionStorage.setItem('oreCalc_justSyncedFromQr', 'true');
                window.history.replaceState({}, document.title, window.location.pathname + targetSearch);
                location.reload();
                return;
            }
        }

        const checkMigrationLock = () => {
            const appSettingsStr = getStorageItem('clashCalc_appSettings', 'oreCalc_appSettings');
            const legacyStateStr = localStorage.getItem('oreCalculatorState') || localStorage.getItem('OreCalculatorState');

            let needsMigration = false;
            if (!appSettingsStr && legacyStateStr) {
                needsMigration = true;
            } else if (appSettingsStr) {
                const settings = safeJsonParse(appSettingsStr, {}) || {};
                const version = settings.appVersion || '1.0.0';
                if (version.startsWith('1.') || compareVersions(version, '2.0.0') < 0) {
                    needsMigration = true;
                }
            }

            if (needsMigration) {
                console.log('Migration Lock Active: Running monolithic state migration to 2.0.0...');
                let legacyState = null;
                if (legacyStateStr) {
                    legacyState = safeJsonParse(legacyStateStr, null);
                }
                try {
                    migrateFullState(legacyState);
                    console.log('Migration completed successfully. Reloading page...');
                    window.location.reload();
                } catch (err) {
                    console.error('CRITICAL ERROR DURING MIGRATION:', err);
                    const fallbackSettingsStr = getStorageItem('clashCalc_appSettings', 'oreCalc_appSettings');
                    const cleanAppSettings = (fallbackSettingsStr ? safeJsonParse(fallbackSettingsStr, {}) : {}) || {};
                    cleanAppSettings.appVersion = '2.0.0';
                    const targetSettingsKey = isClashCalcHost() ? 'clashCalc_appSettings' : 'oreCalc_appSettings';
                    localStorage.setItem(targetSettingsKey, JSON.stringify(cleanAppSettings));
                    localStorage.setItem('oreCalc_appSettings', JSON.stringify(cleanAppSettings));
                    localStorage.removeItem('oreCalculatorState');
                    localStorage.removeItem('OreCalculatorState');
                    window.location.reload();
                }
                return true;
            }
            return false;
        };

        if (checkMigrationLock()) {
            return;
        }

        let savedState = null;
        try {
            savedState = loadState();
        } catch (e) {
            console.error('Failed to load partitioned state:', e);
            savedState = null;
        }
        let originalVersion = savedState?.appVersion || '1.0.0';

        const showChangelogFlag = sessionStorage.getItem('clashCalc_showChangelog') === 'true' ||
                                  sessionStorage.getItem('oreCalc_showChangelog') === 'true';
        const migratedFrom = sessionStorage.getItem('clashCalc_showChangelogFromVersion') ||
                             sessionStorage.getItem('oreCalc_showChangelogFromVersion');
        if (showChangelogFlag && migratedFrom) {
            originalVersion = migratedFrom;
        }

        initializeState(savedState);
        if (savedState && (state.appVersion !== originalVersion || showChangelogFlag)) {
            logger.log(`Upgraded localStorage state version from ${originalVersion} to ${state.appVersion}`);
            saveState(state, true);
            if (compareVersions(originalVersion, state.appVersion) < 0 || showChangelogFlag) {
                setTimeout(async () => {
                    const currentLang = state.uiSettings?.language || 'en';
                    await loadTranslations('en');
                    if (currentLang !== 'en') {
                        await loadTranslations(currentLang);
                    }
                    const content = getChangelogHtml();
                    if (isInterruptionRestricted()) {
                        window.pendingChangelogContent = content;
                    } else {
                        showChangelogModal(content);
                        sessionStorage.removeItem('clashCalc_showChangelog');
                        sessionStorage.removeItem('oreCalc_showChangelog');
                        sessionStorage.removeItem('clashCalc_showChangelogFromVersion');
                        sessionStorage.removeItem('oreCalc_showChangelogFromVersion');
                    }
                }, 1200);
            } else {
                const rawCommits = window.__ENV__?.COMMITS_SINCE_TAG;
                const commits = Array.isArray(rawCommits) ? rawCommits : [];
                if (commits.length > 0) {
                    setTimeout(async () => {
                        const currentLang = state.uiSettings?.language || 'en';
                        await loadTranslations('en');
                        if (currentLang !== 'en') {
                            await loadTranslations(currentLang);
                        }
                        if (isInterruptionRestricted()) {
                            window.pendingCommits = commits;
                        } else {
                            showCommitsModal(commits);
                        }
                    }, 1200);
                }
            }
        }

        const pathName = window.location.pathname;
        if (!isValidRoute(pathName)) {
            try {
                const res = await fetch('/404.html');
                if (res.ok) {
                    const html = await res.text();
                    document.open();
                    document.write(html);
                    document.close();
                    return;
                }
            } catch (_) {}
            const currentLang = getLanguageFromPath() || 'en';
            window.location.href = currentLang === 'en' ? '/404' : `/${currentLang}/404`;
            return;
        }

        if (window.location.hash) {
            const initialTab = `${window.location.hash.substring(1)}-tab`;
            const validTabs = ['home-tab', 'planner-tab', 'equipment-tab', 'income-tab', 'settings-tab'];
            if (validTabs.includes(initialTab)) {
                state.activeTab = initialTab;
            } else {
                history.replaceState(null, '', window.location.pathname);
                state.activeTab = 'home-tab';
            }
        }

        const urlTag = getPlayerTagFromUrl();
        if (urlTag) {
            if (!state.allPlayersData[urlTag] || !state.allPlayersData[urlTag].heroes) {
                const cached = loadPlayerData(urlTag);
                if (cached && cached.heroes) {
                    state.allPlayersData[urlTag] = cached;
                }
            }

            if (state.allPlayersData[urlTag]?.heroes) {
                updateSavedPlayerTags(urlTag);
                switchActivePlayer(urlTag);
                syncPlayerTagToUrl(urlTag);
            } else {
                await loadAndProcessPlayerData(urlTag);
                syncPlayerTagToUrl(urlTag);
            }
        } else if (state.savedPlayerTags?.[0] && state.savedPlayerTags[0] !== 'DEFAULT0') {
            syncPlayerTagToUrl(state.savedPlayerTags[0]);
        }

        let renderFrameId = null;

        registerStateUpdateCallback(async (state, silent) => {
            if (state.planner?.calendar && !state.planner.calendar.isHydrated) {
                const { getMinDate, getMaxDate } = await import('./utils/dateUtils.js');
                const { autoPlaceIncomeChipsForRange } = await import('./utils/autoPlaceChips.js');
                const { month: MIN_MONTH, year: MIN_YEAR } = getMinDate();
                const { month: MAX_MONTH, year: MAX_YEAR } = getMaxDate();
                autoPlaceIncomeChipsForRange(MIN_MONTH, MIN_YEAR, MAX_MONTH, MAX_YEAR, true);
                state.planner.calendar.isHydrated = true;
            }
            if (!silent) {
                const doRender = () => {
                    const activeEl = /** @type {HTMLInputElement|HTMLTextAreaElement|null} */ (document.activeElement);
                    const activeId = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') ? activeEl.id : null;
                    const selStart = activeId ? activeEl.selectionStart : null;
                    const selEnd = activeId ? activeEl.selectionEnd : null;

                    recalculateAll(state);
                    renderApp(state);

                    if (activeId && document.activeElement?.id !== activeId) {
                        const restoredEl = /** @type {HTMLInputElement|HTMLTextAreaElement|null} */ (document.getElementById(activeId));
                        if (restoredEl) {
                            restoredEl.focus();
                            if (selStart !== null && selEnd !== null && typeof restoredEl.setSelectionRange === 'function') {
                                restoredEl.setSelectionRange(selStart, selEnd);
                            }
                        }
                    }
                };

                if (window.__FORCE_SYNC_RENDER__) {
                    if (renderFrameId) {
                        cancelAnimationFrame(renderFrameId);
                        renderFrameId = null;
                    }
                    doRender();
                } else {
                    if (renderFrameId) {
                        cancelAnimationFrame(renderFrameId);
                    }
                    renderFrameId = requestAnimationFrame(() => {
                        doRender();
                        renderFrameId = null;
                    });
                }
            }
        });

        document.addEventListener('app:theme-change', (e) => {
            const customEvent = /** @type {CustomEvent} */ (e);
            applyTheme(customEvent.detail.theme, customEvent.detail.origin);
        });

        document.addEventListener('app:translate', () => {
            updateUIWithTranslations();
        });

        document.addEventListener('welcome:close', () => {
            const tourTimestamp = state.uiSettings?.uiTimestamps?.tour;
            const privacyTimestamp = state.uiSettings?.uiTimestamps?.privacy;
            const tosTimestamp = state.uiSettings?.uiTimestamps?.tos;

            const needsPrivacy = !privacyTimestamp || privacyTimestamp < EFFECTIVE_DATE_PRIVACY;
            const needsTerms = !tosTimestamp || tosTimestamp < EFFECTIVE_DATE_TERMS;
            const hasPendingConsent = needsPrivacy || needsTerms;

            if (!tourTimestamp && !hasPendingConsent) {
                window.isTourPending = true;
                setTimeout(() => {
                    import('./components/tour/appTour.js').then(module => {
                        module.startTour().then(started => {
                            window.isAppStartingUp = false;
                            if (!started) {
                                window.isTourPending = false;
                                triggerPendingModals();
                            }
                        });
                    });
                }, 300);
            } else {
                setTimeout(() => {
                    triggerPendingModals();
                }, 150);
            }
        });

        document.addEventListener('tour:close', () => {
            triggerPendingModals();
        });

        initializeDOMElements();
        initMainAppCrossTabSync();

        const preloader = dom.preloader;
        if (preloader) {
            let effectivePreloaderAccent = preloader.getAttribute('data-accent');
            if (!effectivePreloaderAccent) {
                effectivePreloaderAccent = state.uiSettings.accentColor || 'random';
                if (effectivePreloaderAccent === 'random') {
                    if (!window.sessionRandomAccent) {
                        window.sessionRandomAccent = availableAccents[Math.floor(Math.random() * availableAccents.length)];
                    }
                    effectivePreloaderAccent = window.sessionRandomAccent;
                }
                preloader.dataset.accent = effectivePreloaderAccent;
            }

            const theme = state.uiSettings?.theme || preloader.getAttribute('data-theme') || 'dark';
            const themePalette = THEME_PALETTE[effectivePreloaderAccent] || THEME_PALETTE.blue;
            const targetColors = theme === 'light' ? themePalette.light : themePalette.dark;

            setTimeout(() => {
                animatePreloaderBackground(targetColors.bgApp, 1100);
            }, 650);
        }

        if (!state.uiSettings) state.uiSettings = {};
        const initialLang = detectLanguage();
        state.uiSettings.language = initialLang;
        syncLanguageUrl(initialLang, true);

        loadTranslations('en').then(() => {
            if (initialLang !== 'en') {
                return loadTranslations(initialLang);
            }
        }).catch(err => logger.warn('Preloading translations failed:', err));

        setTimeout(async () => {
            await bootstrapUIComponents(initialLang);
        }, 1900);

        handlePreloaderTeardown(preloader);
        initializePwaService();

        setTimeout(async () => {
            try {
                const pendingQrUserId = sessionStorage.getItem('clashCalc_pendingQrUserId') ||
                                        sessionStorage.getItem('oreCalc_pendingQrUserId') ||
                                        localStorage.getItem('clashCalc_pendingQrUserId') ||
                                        localStorage.getItem('oreCalc_pendingQrUserId');
                if (pendingQrUserId) {
                    sessionStorage.removeItem('clashCalc_pendingQrUserId');
                    sessionStorage.removeItem('oreCalc_pendingQrUserId');
                    try {
                        localStorage.removeItem('clashCalc_pendingQrUserId');
                        localStorage.removeItem('oreCalc_pendingQrUserId');
                    } catch (e) {}
                    const { importUserData } = await import('./services/cloudSaveService.js');
                    await importUserData(pendingQrUserId);
                    return;
                }

                const { initializeAppData } = await import('./services/cloudSaveService.js');
                const syncedState = await initializeAppData();
                if (syncedState) {
                    const originalVersion = syncedState.appVersion || '1.0.0';
                    initializeState(syncedState);
                    if (state.planner?.calendar) {
                        const { getMinDate, getMaxDate } = await import('./utils/dateUtils.js');
                        const { autoPlaceIncomeChipsForRange } = await import('./utils/autoPlaceChips.js');
                        const { month: MIN_MONTH, year: MIN_YEAR } = getMinDate();
                        const { month: MAX_MONTH, year: MAX_YEAR } = getMaxDate();
                        autoPlaceIncomeChipsForRange(MIN_MONTH, MIN_YEAR, MAX_MONTH, MAX_YEAR, true);
                        state.planner.calendar.isHydrated = true;
                    }
                    if (state.appVersion !== originalVersion) {
                        logger.log(`Upgraded synced state version from ${originalVersion} to ${state.appVersion}`);
                        saveState(state, true);
                    } else {
                        saveState(state);
                    }
                    const appVersionDisplay = document.getElementById('app-version-display');
                    if (appVersionDisplay) {
                        appVersionDisplay.textContent = '| v' + (window.__ENV__?.APP_VERSION || state.appVersion || '2.2.0').replace(/^v/, '');
                    }
                    recalculateAll(state);
                    renderApp(state);
                }
                const justSynced = sessionStorage.getItem('clashCalc_justSyncedFromQr') === 'true' ||
                                   sessionStorage.getItem('oreCalc_justSyncedFromQr') === 'true';
                if (justSynced) {
                    if (!state.uiSettings) state.uiSettings = {};
                    if (!state.uiSettings.uiTimestamps) state.uiSettings.uiTimestamps = {};
                    const now = Date.now();
                    state.uiSettings.uiTimestamps.welcome = now;
                    state.uiSettings.uiTimestamps.privacy = now;
                    state.uiSettings.uiTimestamps.tos = now;
                    saveState(state);

                    sessionStorage.removeItem('clashCalc_justSyncedFromQr');
                    sessionStorage.removeItem('oreCalc_justSyncedFromQr');
                    checkLegalConsent();
                }
            } catch (error) {
                if (window.handleChunkError && window.handleChunkError(error)) return;
                console.error('Error initializing app data:', error);
                const justSynced = sessionStorage.getItem('clashCalc_justSyncedFromQr') === 'true' ||
                                   sessionStorage.getItem('oreCalc_justSyncedFromQr') === 'true';
                if (justSynced) {
                    if (!state.uiSettings) state.uiSettings = {};
                    if (!state.uiSettings.uiTimestamps) state.uiSettings.uiTimestamps = {};
                    const now = Date.now();
                    state.uiSettings.uiTimestamps.welcome = now;
                    state.uiSettings.uiTimestamps.privacy = now;
                    state.uiSettings.uiTimestamps.tos = now;
                    saveState(state);

                    sessionStorage.removeItem('clashCalc_justSyncedFromQr');
                    sessionStorage.removeItem('oreCalc_justSyncedFromQr');
                    checkLegalConsent();
                }
            }
        }, 2000);

        initializeGlobalInterceptors();
    });
}

window.resetApplication = () => {
    setResettingState(true);
    resetState();
    if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname);
    }
    window.location.href = window.location.origin + window.location.pathname;
};

window.refreshConsentModalStatus = refreshConsentModalStatus;
