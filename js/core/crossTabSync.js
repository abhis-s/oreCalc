import { state } from './state.js';
import { handleStateUpdate } from './stateManager.js';
import { safeJsonParse } from '../utils/jsonUtils.js';
import { applyThemeSettings } from './themeManager.js';
import { loadTranslations } from '../i18n/translator.js';
import { syncLanguageUrl } from './languageRouter.js';

import { CANONICAL_PLAYER_PREFIX, LEGACY_PLAYER_PREFIX, STORAGE_KEY_MAP } from './constants.js';

const APP_SETTINGS_CANONICAL = STORAGE_KEY_MAP.appSettings.canonical;
const APP_SETTINGS_LEGACY = STORAGE_KEY_MAP.appSettings.legacy;
const PLAYER_TAGS_CANONICAL = STORAGE_KEY_MAP.playerTags.canonical;
const PLAYER_TAGS_LEGACY = STORAGE_KEY_MAP.playerTags.legacy;
const RECENT_SEARCHES_CANONICAL = STORAGE_KEY_MAP.recentSearches.canonical;
const RECENT_SEARCHES_LEGACY = STORAGE_KEY_MAP.recentSearches.legacy;
const ACCELERATED_KEY = 'oreCalc_isAccelerated';
const CANONICAL_ACCELERATED_KEY = 'clashCalc_isAccelerated';

let isCrossTabSyncInitialized = false;
let hasPendingActivePlayerSync = false;

/**
 * Resets initialization lock for testing.
 */
export function resetCrossTabSyncForTesting() {
    isCrossTabSyncInitialized = false;
}

/**
 * Initializes cross-tab/window storage synchronization for the Main App.
 */
export function initMainAppCrossTabSync() {
    if (typeof window === 'undefined' || isCrossTabSyncInitialized) return;
    isCrossTabSyncInitialized = true;

    // Deferred sync on visibility restoration
    if (typeof document?.addEventListener === 'function') {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                document.dispatchEvent(new CustomEvent('app:playerDropdownSync'));

                if (hasPendingActivePlayerSync) {
                    hasPendingActivePlayerSync = false;
                    const activeTag = state.savedPlayerTags?.[0];
                    if (activeTag && state.allPlayersData?.[activeTag]) {
                        const playerData = state.allPlayersData[activeTag];
                        handleStateUpdate(() => {
                            if (playerData.heroes) state.heroes = playerData.heroes;
                            if (playerData.storedOres) state.storedOres = playerData.storedOres;
                            if (playerData.income) state.income = playerData.income;
                            if (playerData.planner) state.planner = playerData.planner;
                            if (playerData.playerProfile) state.playerProfile = playerData.playerProfile;
                            if (playerData.heroJourney) state.heroJourney = playerData.heroJourney;
                            if (playerData.onboardingTimestamp !== undefined) state.onboardingTimestamp = playerData.onboardingTimestamp;
                        }, false, { skipSave: true });
                    }
                }
            }
        });
    }

    window.addEventListener('storage', async (event) => {
        if (!event.key || !event.newValue) return;

        // Partitioned per-player storage sync
        let matchedPrefix = null;
        if (event.key.startsWith(CANONICAL_PLAYER_PREFIX)) {
            matchedPrefix = CANONICAL_PLAYER_PREFIX;
        } else if (event.key.startsWith(LEGACY_PLAYER_PREFIX)) {
            matchedPrefix = LEGACY_PLAYER_PREFIX;
        }

        if (matchedPrefix) {
            const rawTag = event.key.slice(matchedPrefix.length);
            const tag = String(rawTag).replace(/^#+/, '').trim().toUpperCase();
            const playerData = safeJsonParse(event.newValue, null);
            if (!tag || !playerData || typeof playerData !== 'object') return;

            if (!state.allPlayersData) state.allPlayersData = {};
            state.allPlayersData[tag] = playerData;

            // Only trigger active re-calculation & render if this tab is currently viewing this exact player
            const activeTag = state.savedPlayerTags ? String(state.savedPlayerTags[0] || '').replace(/^#+/, '').trim().toUpperCase() : '';
            if (activeTag === tag) {
                if (typeof document !== 'undefined' && document.hidden) {
                    hasPendingActivePlayerSync = true;
                } else {
                    handleStateUpdate(() => {
                        if (playerData.heroes) state.heroes = playerData.heroes;
                        if (playerData.storedOres) state.storedOres = playerData.storedOres;
                        if (playerData.income) state.income = playerData.income;
                        if (playerData.planner) state.planner = playerData.planner;
                        if (playerData.playerProfile) state.playerProfile = playerData.playerProfile;
                        if (playerData.heroJourney) state.heroJourney = playerData.heroJourney;
                        if (playerData.onboardingTimestamp !== undefined) state.onboardingTimestamp = playerData.onboardingTimestamp;
                    }, false, { skipSave: true });
                }
            }
            return;
        }

        if (event.key === APP_SETTINGS_CANONICAL || event.key === APP_SETTINGS_LEGACY) {
            const newSettings = safeJsonParse(event.newValue, null);
            if (!newSettings || typeof newSettings !== 'object') return;

            let appearanceChanged = false;
            let themeToApply = state.uiSettings?.theme || 'dark';
            let accentToApply = state.uiSettings?.accentColor || 'blue';

            if (newSettings.theme && newSettings.theme !== state.uiSettings?.theme) {
                themeToApply = newSettings.theme;
                appearanceChanged = true;
            }

            if (newSettings.accentColor && newSettings.accentColor !== state.uiSettings?.accentColor) {
                accentToApply = newSettings.accentColor;
                appearanceChanged = true;
            }

            if (appearanceChanged) {
                handleStateUpdate(() => {
                    if (!state.uiSettings) state.uiSettings = {};
                    state.uiSettings.theme = themeToApply;
                    state.uiSettings.accentColor = accentToApply;
                }, true, { skipSave: true });

                applyThemeSettings(themeToApply, accentToApply, { isSwatchClick: false });

                const themeToggle = /** @type {HTMLInputElement|null} */ (document.getElementById('settings-theme-toggle'));
                if (themeToggle) {
                    themeToggle.checked = (themeToApply === 'light');
                    const themeLabel = document.querySelector('label[for="settings-theme-toggle"]');
                    if (themeLabel) {
                        const labelKey = (themeToApply === 'light') ? 'views.settings.options.themeDark' : 'views.settings.options.themeLight';
                        themeLabel.setAttribute('data-i18n', labelKey);
                    }
                }

                const welcomeThemeSwitch = document.querySelector('#welcome-modal .theme-switch');
                if (welcomeThemeSwitch) {
                    welcomeThemeSwitch.setAttribute('data-active-index', themeToApply === 'dark' ? '0' : '1');
                    welcomeThemeSwitch.querySelectorAll('.pref-btn').forEach(btn => {
                        btn.classList.toggle('active', btn.getAttribute('data-theme') === themeToApply);
                    });
                }

                const allSwatches = document.querySelectorAll('.accent-swatch, #welcome-accent-picker .accent-swatch, #mobile-accent-picker-modal .accent-swatch');
                allSwatches.forEach(s => {
                    s.classList.toggle('active', /** @type {HTMLElement} */ (s).dataset.color === accentToApply);
                });
            }

            if (newSettings.language && newSettings.language !== state.uiSettings?.language) {
                const newLang = newSettings.language;
                await loadTranslations(newLang);
                handleStateUpdate(() => {
                    if (!state.uiSettings) state.uiSettings = {};
                    state.uiSettings.language = newLang;
                    syncLanguageUrl(newLang, false);
                }, false, { skipSave: true });
                const langSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('settings-language-select'));
                if (langSelect) {
                    langSelect.value = newLang;
                }
                document.dispatchEvent(new CustomEvent('app:translate'));
                document.dispatchEvent(new Event('languageChanged'));
            }

            if (typeof newSettings.revealBeyondTH === 'boolean') {
                handleStateUpdate(() => {
                    if (!state.heroJourney) state.heroJourney = {};
                    state.heroJourney.revealBeyondTH = newSettings.revealBeyondTH;
                }, false, { skipSave: true });
            }
            return;
        }

        if (event.key === CANONICAL_ACCELERATED_KEY || event.key === ACCELERATED_KEY) {
            const isAccelerated = event.newValue === 'true';
            if (state.heroJourney?.isAccelerated !== isAccelerated) {
                handleStateUpdate(() => {
                    if (!state.heroJourney) state.heroJourney = {};
                    state.heroJourney.isAccelerated = isAccelerated;
                }, false, { skipSave: true });
            }
            return;
        }

        if (event.key === PLAYER_TAGS_CANONICAL || event.key === PLAYER_TAGS_LEGACY) {
            const newTags = safeJsonParse(event.newValue, null);
            if (Array.isArray(newTags)) {
                handleStateUpdate(() => {
                    const currentActiveTag = state.savedPlayerTags?.[0];
                    if (currentActiveTag && newTags.includes(currentActiveTag)) {
                        const remaining = newTags.filter(t => t !== currentActiveTag);
                        state.savedPlayerTags = [currentActiveTag, ...remaining];
                    } else {
                        state.savedPlayerTags = newTags;
                    }
                }, false, { skipSave: true });

                if (typeof document?.dispatchEvent === 'function') {
                    document.dispatchEvent(new CustomEvent('app:playerDropdownSync'));
                }
            }
            return;
        }

        if (event.key === RECENT_SEARCHES_CANONICAL || event.key === RECENT_SEARCHES_LEGACY) {
            if (typeof document?.dispatchEvent === 'function') {
                document.dispatchEvent(new CustomEvent('app:playerDropdownSync'));
            }
            return;
        }
    });
}
