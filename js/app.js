import { loadTranslations, translate } from './i18n/translator.js';
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
import { loadState, resetState, saveState, setResettingState } from './core/localStorageManager.js';
import { getStorageItem, isClashCalcHost, normalizePlayerTag } from './core/storageKeys.js';
import { loadPlayerData, updateSavedPlayerTags } from './core/playerStorage.js';
import { renderApp } from './core/renderer.js';
import { initializeState, state } from './core/state.js';
import { autoPlaceIncomeChipsForRange } from './utils/autoPlaceChips.js';
import { getMaxDate, getMinDate } from './utils/dateUtils.js';
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
import { showApiErrorToast, showToast } from './ui/toast.js';
import { safeJsonParse } from './utils/jsonUtils.js';
import { initAppFooter } from './components/common/appFooter.js';
import { logger } from './utils/logger.js';
import './utils/imageManager.js';
import './utils/svgManager.js';
import './ui/savingIndicator.js';

import { showChangelogModal } from './components/changelog/changelogModal.js';
import { showCommitsModal } from './components/changelog/commitsModal.js';
import { dom, initializeDOMElements } from './dom/domElements.js';
import { getChangelogHtml } from './services/changelogService.js';
import { initializePwaService } from './services/pwaService.js';
import { setJustSyncedFromQr, importUserData, initializeAppData, isJustSyncedFromQr } from './services/cloudSaveService.js';
import { showAddPlayerModal } from './components/player/playerModalInputs.js';
import './console.js';

setThemeRenderCallback(renderApp);
registerGlobalErrorBoundaries();

if (!window.__DOM_CONTENT_LOADED_REGISTERED__) {
    window.__DOM_CONTENT_LOADED_REGISTERED__ = true;
    document.addEventListener('DOMContentLoaded', async () => {
        const urlParams = new URLSearchParams(window.location.search);
        let userIdFromUrl = urlParams.get('userId');
        let tagFromUrl = urlParams.get('tag');
        let pendingQrUserId = null;

        if (userIdFromUrl) {
            const playerTagsStr = getStorageItem('clashCalc_playerTags', 'oreCalc_playerTags');
            const legacyStateStr = localStorage.getItem('oreCalculatorState') || localStorage.getItem('OreCalculatorState');
            const currentUserId = getStorageItem('clashCalc_userId', 'oreCalc_userId');

            let hasRealLocalData = false;
            if (playerTagsStr) {
                const tags = safeJsonParse(playerTagsStr, []);
                if (Array.isArray(tags) && tags.length > 0 && tags.some(t => t && t !== 'DEFAULT0')) {
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
                pendingQrUserId = userIdFromUrl;
                window.history.replaceState({}, document.title, window.location.pathname + targetSearch);
            } else {
                const targetUserIdKey = isClashCalcHost() ? 'clashCalc_userId' : 'oreCalc_userId';
                localStorage.setItem(targetUserIdKey, userIdFromUrl);
                if (!isClashCalcHost()) {
                    localStorage.setItem('oreCalc_userId', userIdFromUrl);
                }
                setJustSyncedFromQr(true);
                window.history.replaceState({}, document.title, window.location.pathname + targetSearch);
            }
        }

        const checkMigrationLock = () => {
            const legacyStateStr = localStorage.getItem('oreCalculatorState') || localStorage.getItem('OreCalculatorState');
            const appSettingsStr = getStorageItem('clashCalc_appSettings', 'oreCalc_appSettings');

            // If monolithic legacy state does not exist, no monolithic migration is needed.
            if (!legacyStateStr) {
                if (appSettingsStr) {
                    const settings = safeJsonParse(appSettingsStr, {}) || {};
                    if (!settings.appVersion || compareVersions(settings.appVersion, '2.0.0') < 0) {
                        settings.appVersion = window.__ENV__?.APP_VERSION || '3.0.0';
                        const targetKey = isClashCalcHost() ? 'clashCalc_appSettings' : 'oreCalc_appSettings';
                        try {
                            localStorage.setItem(targetKey, JSON.stringify(settings));
                        } catch {}
                    }
                }
                return false;
            }

            console.log('Legacy monolithic state detected: resetting to baseline 3.0.0...');
            let legacyState = safeJsonParse(legacyStateStr, null);
            try {
                let extractedTags = [];
                if (legacyState?.savedPlayerTags && Array.isArray(legacyState.savedPlayerTags)) {
                    extractedTags = legacyState.savedPlayerTags.map(normalizePlayerTag).filter(t => t && t !== 'DEFAULT0');
                } else if (legacyState?.lastPlayerTag) {
                    const clean = normalizePlayerTag(legacyState.lastPlayerTag);
                    if (clean && clean !== 'DEFAULT0') extractedTags.push(clean);
                }
                const safeTags = extractedTags.length > 0 ? extractedTags : ['DEFAULT0'];
                const targetTagsKey = isClashCalcHost() ? 'clashCalc_playerTags' : 'oreCalc_playerTags';
                localStorage.setItem(targetTagsKey, JSON.stringify(safeTags));

                const fallbackSettingsStr = getStorageItem('clashCalc_appSettings', 'oreCalc_appSettings');
                const cleanAppSettings = (fallbackSettingsStr ? safeJsonParse(fallbackSettingsStr, {}) : {}) || {};
                cleanAppSettings.appVersion = '3.0.0';
                const targetSettingsKey = isClashCalcHost() ? 'clashCalc_appSettings' : 'oreCalc_appSettings';
                localStorage.setItem(targetSettingsKey, JSON.stringify(cleanAppSettings));
                if (isClashCalcHost()) {
                    localStorage.removeItem('oreCalc_appSettings');
                }
                localStorage.removeItem('oreCalculatorState');
                localStorage.removeItem('OreCalculatorState');
                console.log('Reset to 3.0.0 completed successfully. Reloading page...');
                window.location.reload();
            } catch (err) {
                console.error('CRITICAL ERROR DURING LEGACY STATE RESET:', err);
                localStorage.removeItem('oreCalculatorState');
                localStorage.removeItem('OreCalculatorState');
                window.location.reload();
            }
            return true;
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
        const originalVersion = savedState?.appVersion || '1.0.0';

        initializeState(savedState);
        if (savedState && state.appVersion !== originalVersion) {
            logger.log(`Upgraded localStorage state version from ${originalVersion} to ${state.appVersion}`);
            saveState(state, true);
            if (compareVersions(originalVersion, state.appVersion) < 0) {
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
                history.replaceState(null, '', `${window.location.pathname}${window.location.search || ''}`);
                state.activeTab = 'home-tab';
            }
        }

        if (!state.uiSettings) state.uiSettings = {};
        const initialLang = detectLanguage();
        state.uiSettings.language = initialLang;
        syncLanguageUrl(initialLang, true);
        try {
            await loadTranslations('en');
            if (initialLang !== 'en') {
                await loadTranslations(initialLang);
            }
        } catch (err) {
            logger.warn('Preloading translations failed:', err);
        }

        const hasUrlTagParam = urlParams.has('tag') || urlParams.has('p') || urlParams.has('player');
        const urlTag = getPlayerTagFromUrl();
        if (urlTag) {
            if (!state.allPlayersData[urlTag] || !state.allPlayersData[urlTag].heroes) {
                const cached = loadPlayerData(urlTag);
                if (cached && cached.heroes) {
                    state.allPlayersData[urlTag] = cached;
                }
            }

            if (state.allPlayersData[urlTag]?.heroes) {
                switchActivePlayer(urlTag);
                updateSavedPlayerTags(urlTag);
                syncPlayerTagToUrl(urlTag);
            } else {
                const result = await loadAndProcessPlayerData(urlTag);
                if (result?.success) {
                    syncPlayerTagToUrl(urlTag);
                } else {
                    showApiErrorToast(result || 'apiErrors.notFound');
                    if (state.savedPlayerTags?.[0] && state.savedPlayerTags[0] !== 'DEFAULT0') {
                        syncPlayerTagToUrl(state.savedPlayerTags[0]);
                    } else {
                        syncPlayerTagToUrl(null);
                    }
                }
            }
        } else if (hasUrlTagParam) {
            showToast(translate('apiErrors.invalidTag'), 'error');
        } else if (state.savedPlayerTags?.[0] && state.savedPlayerTags[0] !== 'DEFAULT0') {
            syncPlayerTagToUrl(state.savedPlayerTags[0]);
        }

        let renderFrameId = null;

        registerStateUpdateCallback(async (state, silent) => {
            if (state.planner?.calendar && !state.planner.calendar.isHydrated) {
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

        document.addEventListener('tour:close', () => {
            triggerPendingModals();
        });

        initializeDOMElements();
        initMainAppCrossTabSync();

        const preloader = dom.preloader;
        const isPreloaderEnabled = false; // Preloader disabled in place; set to true to re-enable

        if (isPreloaderEnabled && preloader) {
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

        const bootstrapDelay = isPreloaderEnabled ? 1900 : 0;
        setTimeout(async () => {
            await bootstrapUIComponents(initialLang);
        }, bootstrapDelay);

        handlePreloaderTeardown(isPreloaderEnabled ? preloader : null);
        initializePwaService();

        setTimeout(async () => {
            try {
                if (pendingQrUserId) {
                    await importUserData(pendingQrUserId);
                    return;
                }

                const syncedState = await initializeAppData();
                if (syncedState) {
                    const originalVersion = syncedState.appVersion || '1.0.0';
                    initializeState(syncedState);
                    if (state.planner?.calendar) {
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
                    initAppFooter({ version: state.appVersion });
                    recalculateAll(state);
                    renderApp(state);
                }
                if (isJustSyncedFromQr()) {
                    setJustSyncedFromQr(false);
                }
            } catch (error) {
                if (window.handleChunkError && window.handleChunkError(error)) return;
                console.error('Error initializing app data:', error);
                if (isJustSyncedFromQr()) {
                    setJustSyncedFromQr(false);
                }
            }
        }, 2000);

        initializeGlobalInterceptors();

        document.addEventListener('app:accountSynced', async () => {
            recalculateAll(state);
            renderApp(state);

            const hasRealTags = Boolean(state.savedPlayerTags?.some(t => t && normalizePlayerTag(t) !== 'DEFAULT0'));
            if (!hasRealTags) {
                showAddPlayerModal();
            }
        });
    });
}

window.resetApplication = () => {
    setResettingState(true);
    syncPlayerTagToUrl(null);
    resetState();
    if (window.location.hash || window.location.search) {
        history.replaceState(null, '', window.location.pathname);
    }
    window.location.href = window.location.origin + window.location.pathname;
};
