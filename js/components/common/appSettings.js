import { enabledLanguages, SUPPORTED_LANGUAGES } from '../../data/languagesData.js';
import { getLanguageFromPath, syncLanguageUrl } from '../../core/languageRouter.js';
import { loadTranslations, translate } from '../../i18n/translator.js';
import { updateUIWithTranslations } from '../../i18n/uiTranslator.js';
import { safeJsonParse } from '../../utils/jsonUtils.js';
import { isClashCalcHost } from '../../core/storageKeys.js';
import { STORAGE_KEY_MAP } from '../../core/constants.js';
import { applyThemeSettings } from '../../core/themeManager.js';
import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';
import { setDefaultDateLocale } from '../../utils/dateUtils.js';

let isGlobalListenersInitialized = false;

/**
 * Reads settings from localStorage with defensive fallbacks.
 * @returns {{ theme: 'dark' | 'light', accentColor: string, language: string, hideProfileStats: boolean }}
 */
export function getAppSettings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_MAP.appSettings.canonical) || localStorage.getItem(STORAGE_KEY_MAP.appSettings.legacy);
        const settings = safeJsonParse(raw, {}) || {};
        const pathLang = getLanguageFromPath();
        const savedLang = pathLang || settings.language || 'en';
        return {
            theme: settings.theme === 'light' ? 'light' : 'dark',
            accentColor: settings.accentColor || 'blue',
            language: savedLang,
            hideProfileStats: Boolean(settings.hideProfileStats)
        };
    } catch {
        return { theme: 'dark', accentColor: 'blue', language: 'en', hideProfileStats: false };
    }
}

/**
 * Persists updated settings to localStorage under the active target key.
 * @param {Partial<{ theme: string, accentColor: string, language: string, hideProfileStats: boolean }>} patch
 */
export function persistAppSettings(patch) {
    try {
        const targetSettingsKey = isClashCalcHost()
            ? STORAGE_KEY_MAP.appSettings.canonical
            : STORAGE_KEY_MAP.appSettings.legacy;
        const raw = localStorage.getItem(targetSettingsKey);
        const settings = safeJsonParse(raw, {}) || {};
        delete settings.saveError;
        Object.assign(settings, patch);
        delete settings.saveError;
        localStorage.setItem(targetSettingsKey, JSON.stringify(settings));
        localStorage.removeItem('oreCalc_language');

        if (isClashCalcHost()) {
            localStorage.removeItem(STORAGE_KEY_MAP.appSettings.legacy);
        }
    } catch {}
}

/**
 * Applies theme and accent color to document and synchronizes settings popover controls.
 * @param {'dark' | 'light'} theme
 * @param {string} accentColor
 * @param {boolean} [isInteraction=false]
 * @param {boolean} [isSwatchClick=false]
 */
function applyAppTheme(theme, accentColor, isInteraction = false, isSwatchClick = false) {
    handleStateUpdate(() => {
        if (!state.uiSettings) {
            state.uiSettings = {};
        }
        state.uiSettings.theme = theme;
        state.uiSettings.accentColor = accentColor;
        if (!state.uiSettings.language) {
            const stored = getAppSettings();
            state.uiSettings.language = stored.language && stored.language !== 'auto' ? stored.language : 'en';
        }
    }, true, { preferencesOnly: true });

    const origin = isInteraction ? { isSwatchClick } : null;
    applyThemeSettings(theme, accentColor, origin);
    document.documentElement.setAttribute('data-accent', accentColor);

    const isLight = theme === 'light';
    const appThemeToggle = /** @type {HTMLInputElement|null} */ (document.getElementById('app-theme-toggle'));
    if (appThemeToggle) {
        appThemeToggle.checked = isLight;
    }
    const settingsThemeToggle = /** @type {HTMLInputElement|null} */ (document.getElementById('settings-theme-toggle'));
    if (settingsThemeToggle) {
        settingsThemeToggle.checked = isLight;
    }

    const labelKey = isLight ? 'views.settings.options.themeDark' : 'views.settings.options.themeLight';
    const translatedText = translate(labelKey);
    const appThemeLabel = document.getElementById('app-theme-label');
    if (appThemeLabel) {
        appThemeLabel.textContent = translatedText;
        appThemeLabel.setAttribute('data-i18n', labelKey);
    }
    const settingsThemeLabel = document.querySelector('label[for="settings-theme-toggle"]');
    if (settingsThemeLabel) {
        settingsThemeLabel.textContent = translatedText;
        settingsThemeLabel.setAttribute('data-i18n', labelKey);
    }

    document.querySelectorAll('#app-accent-picker .accent-swatch').forEach(swatch => {
        const swatchColor = swatch.getAttribute('data-color');
        swatch.classList.toggle('active', swatchColor === accentColor);
    });

    persistAppSettings({ theme, accentColor });
}

/**
 * Toggles application theme between dark and light modes immediately.
 * @returns {'dark' | 'light'} The newly applied theme.
 */
export function toggleAppTheme() {
    const current = getAppSettings();
    const targetTheme = current.theme === 'light' ? 'dark' : 'light';
    applyAppTheme(targetTheme, current.accentColor, true, false);
    if (typeof document !== 'undefined') {
        document.dispatchEvent(new CustomEvent('app:theme-change', {
            detail: { theme: targetTheme, origin: null }
        }));
    }
    return targetTheme;
}

/**
 * Applies language setting dynamically across state, storage, router, and DOM without reloading.
 * @param {string} targetLang - 2-letter language code ('en', 'de', 'tr', 'zh').
 * @param {boolean} [replaceUrl=false] - Whether to replace browser history state instead of pushing.
 * @returns {Promise<void>}
 */
export async function applyAppLanguage(targetLang, replaceUrl = false) {
    if (!targetLang || !SUPPORTED_LANGUAGES.includes(targetLang)) return;
    const currentLang = state.uiSettings?.language || getAppSettings().language;
    if (targetLang === currentLang && document.documentElement?.lang === targetLang) return;

    await loadTranslations(targetLang);

    handleStateUpdate(() => {
        if (!state.uiSettings) {
            state.uiSettings = {};
        }
        state.uiSettings.language = targetLang;
    }, true, { preferencesOnly: true });
    setDefaultDateLocale(targetLang);
    persistAppSettings({ language: targetLang });
    syncLanguageUrl(targetLang, replaceUrl);

    const langSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('app-language-select'));
    if (langSelect && langSelect.value !== targetLang) {
        langSelect.value = targetLang;
    }
    const settingsLangSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('settings-language-select'));
    if (settingsLangSelect && settingsLangSelect.value !== targetLang) {
        settingsLangSelect.value = targetLang;
    }

    updateUIWithTranslations();
    document.dispatchEvent(new CustomEvent('app:translate', { detail: { language: targetLang } }));
    document.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: targetLang } }));
}

/**
 * Resets global listeners flag for test suite isolation.
 */
export function resetAppSettingsListenersForTesting() {
    isGlobalListenersInitialized = false;
}

/**
 * Populates language dropdown with all enabled languages and marks the active language.
 * @param {HTMLSelectElement} selectEl
 * @param {string} currentLang
 */
function populateLanguageDropdown(selectEl, currentLang) {
    selectEl.innerHTML = '';
    for (const lang of enabledLanguages) {
        const opt = document.createElement('option');
        opt.value = lang.code;
        const name = lang.nativeName || lang.fallbackName;
        const flag = lang.flag ? `${lang.flag} ` : '';
        opt.textContent = `${flag}${name}`;
        if (lang.code === currentLang) {
            opt.selected = true;
        }
        selectEl.appendChild(opt);
    }
}

/**
 * Initializes settings button, popover bindings, preferences, and cross-tab sync.
 */
export function initAppSettings() {
    const settings = getAppSettings();
    applyAppTheme(settings.theme, settings.accentColor);

    const appThemeToggle = /** @type {HTMLInputElement|null} */ (document.getElementById('app-theme-toggle'));
    if (appThemeToggle) {
        appThemeToggle.checked = settings.theme === 'light';
        appThemeToggle.addEventListener('change', (e) => {
            const target = /** @type {HTMLInputElement} */ (e.target);
            const targetTheme = target.checked ? 'light' : 'dark';
            const current = getAppSettings();
            applyAppTheme(targetTheme, current.accentColor, true, false);
            document.dispatchEvent(new CustomEvent('app:theme-change', {
                detail: { theme: targetTheme, origin: null }
            }));
        });
    }

    document.querySelectorAll('#app-accent-picker .accent-swatch').forEach(swatch => {
        swatch.addEventListener('click', () => {
            const targetColor = swatch.getAttribute('data-color');
            if (targetColor) {
                const current = getAppSettings();
                applyAppTheme(current.theme, targetColor, true, true);
            }
        });
    });

    const langSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('app-language-select'));
    if (langSelect && typeof langSelect.addEventListener === 'function') {
        populateLanguageDropdown(langSelect, settings.language);
        langSelect.addEventListener('change', async () => {
            const targetLang = langSelect.value;
            await applyAppLanguage(targetLang, false);
        });
    }

    if (!isGlobalListenersInitialized) {
        isGlobalListenersInitialized = true;

        window.addEventListener('storage', async (event) => {
            if (!event.key || !event.newValue) return;
            if (event.key === STORAGE_KEY_MAP.appSettings.canonical || event.key === STORAGE_KEY_MAP.appSettings.legacy) {
                const newSettings = safeJsonParse(event.newValue, null);
                if (!newSettings || typeof newSettings !== 'object') return;

                const current = getAppSettings();
                const themeToApply = newSettings.theme === 'light' ? 'light' : 'dark';
                const accentToApply = newSettings.accentColor || current.accentColor;

                if (themeToApply !== current.theme || accentToApply !== current.accentColor) {
                    applyAppTheme(themeToApply, accentToApply, true, false);
                }

                if (newSettings.language && newSettings.language !== current.language) {
                    await applyAppLanguage(newSettings.language, false);
                }
            }
        });

        window.addEventListener('popstate', async () => {
            const pathLang = getLanguageFromPath() || 'en';
            const currentLang = state.uiSettings?.language || getAppSettings().language;
            if (pathLang !== currentLang) {
                await applyAppLanguage(pathLang, true);
            }
        });

        if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
            document.addEventListener('app:theme-change', (e) => {
                const customEvent = /** @type {CustomEvent} */ (e);
                const eventTheme = customEvent.detail?.theme;
                if (eventTheme === 'light' || eventTheme === 'dark') {
                    const isLight = eventTheme === 'light';
                    const appThemeToggleEl = /** @type {HTMLInputElement|null} */ (document.getElementById('app-theme-toggle'));
                    if (appThemeToggleEl && appThemeToggleEl.checked !== isLight) {
                        appThemeToggleEl.checked = isLight;
                    }
                    const labelKey = isLight ? 'views.settings.options.themeDark' : 'views.settings.options.themeLight';
                    const appThemeLabelEl = document.getElementById('app-theme-label');
                    if (appThemeLabelEl) {
                        appThemeLabelEl.textContent = translate(labelKey);
                        appThemeLabelEl.setAttribute('data-i18n', labelKey);
                    }
                }
            });

            document.addEventListener('app:translate', () => {
                const current = getAppSettings();
                const isLight = current.theme === 'light';
                const labelKey = isLight ? 'views.settings.options.themeDark' : 'views.settings.options.themeLight';
                const appThemeLabelEl = document.getElementById('app-theme-label');
                if (appThemeLabelEl) {
                    appThemeLabelEl.textContent = translate(labelKey);
                    appThemeLabelEl.setAttribute('data-i18n', labelKey);
                }
            });
        }
    }
}

/**
 * Injects custom HTML into the app settings popover.
 * @param {string} htmlString Raw HTML string to inject.
 */
export function injectSettingsContent(htmlString) {
    const container = document.getElementById('app-settings-injections');
    if (container) {
        container.insertAdjacentHTML('beforeend', htmlString);
    }
}
