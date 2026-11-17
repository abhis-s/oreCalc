import { enabledLanguages, SUPPORTED_LANGUAGES } from '../../data/languagesData.js';
import { getLanguageFromPath, syncLanguageUrl } from '../../core/languageRouter.js';
import { loadTranslations, translate } from '../../i18n/translator.js';
import { updateUIWithTranslations } from '../../i18n/uiTranslator.js';
import { applyThemeSettings } from '../../core/themeManager.js';
import { initMainAppCrossTabSync } from '../../core/crossTabSync.js';
import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';
import { setDefaultDateLocale } from '../../utils/dateUtils.js';
import { loadStoredAppSettings, persistStoredAppSettings } from '../../core/localStorageManager.js';

/**
 * Coordinates persistent header settings controls (theme, accent, language) and global
 * storage/popstate/translation synchronization idempotently across soft navigations.
 */
class AppSettingsController {
    /** @type {boolean} */
    isGlobalListenersInitialized = false;

    /** @type {WeakSet<Element>} */
    #boundThemeToggles = new WeakSet();

    /** @type {WeakSet<Element>} */
    #boundAccentSwatches = new WeakSet();

    /** @type {WeakSet<Element>} */
    #boundLanguageSelects = new WeakSet();

    /**
     * Resets global listener registration tracking for test suite isolation.
     */
    resetForTesting() {
        this.isGlobalListenersInitialized = false;
    }

    /**
     * Populates the header language dropdown only when options are missing or out of sync.
     *
     * @param {HTMLSelectElement} selectEl
     * @param {string} currentLang
     */
    populateLanguageDropdown(selectEl, currentLang) {
        const existingOptions = Array.from(selectEl.options || []);
        const alreadyPopulated = existingOptions.length === enabledLanguages.length
            && enabledLanguages.every((lang, index) => existingOptions[index]?.value === lang.code);

        if (alreadyPopulated) {
            selectEl.value = currentLang;
            existingOptions.forEach(opt => {
                opt.selected = opt.value === currentLang;
            });
            return;
        }

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
        selectEl.value = currentLang;
    }

    /**
     * Binds header settings popover controls once per DOM element and attaches global listeners once.
     */
    init() {
        const settings = getAppSettings();
        applyAppTheme(settings.theme, settings.accentColor);

        const appThemeToggle = /** @type {HTMLInputElement|null} */ (document.getElementById('app-theme-switch'));
        if (appThemeToggle) {
            appThemeToggle.checked = settings.theme === 'light';
            if (!this.#boundThemeToggles.has(appThemeToggle) && typeof appThemeToggle.addEventListener === 'function') {
                this.#boundThemeToggles.add(appThemeToggle);
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
        }

        document.querySelectorAll?.('#app-accent-picker .accent-swatch').forEach(swatch => {
            if (this.#boundAccentSwatches.has(swatch) || typeof swatch.addEventListener !== 'function') return;
            this.#boundAccentSwatches.add(swatch);
            swatch.addEventListener('click', () => {
                const targetColor = swatch.getAttribute('data-color');
                if (targetColor) {
                    const current = getAppSettings();
                    applyAppTheme(current.theme, targetColor, true, true);
                }
            });
        });

        const langSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('app-language-select'));
        if (langSelect) {
            const activeLang = getLanguageFromPath() || (state.uiSettings?.language && state.uiSettings.language !== 'auto' ? state.uiSettings.language : null) || settings.language || 'en';
            this.populateLanguageDropdown(langSelect, activeLang);
            if (!this.#boundLanguageSelects.has(langSelect) && typeof langSelect.addEventListener === 'function') {
                this.#boundLanguageSelects.add(langSelect);
                langSelect.addEventListener('change', async () => {
                    const targetLang = langSelect.value;
                    await applyAppLanguage(targetLang, false);
                });
            }
        }

        if (!this.isGlobalListenersInitialized) {
            this.isGlobalListenersInitialized = true;
            this.#attachGlobalListeners();
        }
    }

    /**
     * Registers browser history popstate and document theme/translation listeners.
     */
    #attachGlobalListeners() {
        initMainAppCrossTabSync();

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
                    const appThemeToggleEl = /** @type {HTMLInputElement|null} */ (document.getElementById('app-theme-switch'));
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
                const langSelectEl = /** @type {HTMLSelectElement | null} */ (document.getElementById('app-language-select'));
                if (langSelectEl) {
                    const effectiveLang = getLanguageFromPath() || (state.uiSettings?.language && state.uiSettings.language !== 'auto' ? state.uiSettings.language : null) || current.language || 'en';
                    if (langSelectEl.value !== effectiveLang) {
                        langSelectEl.value = effectiveLang;
                    }
                }
            });
        }
    }
}

const appSettingsController = new AppSettingsController();

/**
 * Reads settings from localStorage with defensive fallbacks.
 * @returns {{ theme: 'dark' | 'light', accentColor: string, language: string, hideProfileStats: boolean, startupRoute: string, screenWakeLock: boolean, hapticsEnabled: boolean }}
 */
export function getAppSettings() {
    try {
        const settings = loadStoredAppSettings();
        const pathLang = getLanguageFromPath();
        const savedLang = pathLang || (state.uiSettings?.language && state.uiSettings.language !== 'auto' ? state.uiSettings.language : null) || settings.language || 'en';
        return {
            theme: settings.theme === 'light' ? 'light' : 'dark',
            accentColor: settings.accentColor || 'blue',
            language: savedLang,
            hideProfileStats: Boolean(settings.hideProfileStats),
            startupRoute: settings.startupRoute || '/',
            screenWakeLock: Boolean(settings.screenWakeLock),
            hapticsEnabled: settings.hapticsEnabled !== false
        };
    } catch {
        return { theme: 'dark', accentColor: 'blue', language: 'en', hideProfileStats: false, startupRoute: '/', screenWakeLock: false, hapticsEnabled: true };
    }
}

/**
 * Persists updated settings to localStorage under the active target key.
 * @param {Partial<{ theme: string, accentColor: string, language: string, hideProfileStats: boolean, startupRoute: string, screenWakeLock: boolean, hapticsEnabled: boolean }>} patch
 */
export function persistAppSettings(patch) {
    try {
        persistStoredAppSettings(patch);
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('oreCalc_language');
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
    const appThemeToggle = /** @type {HTMLInputElement|null} */ (document.getElementById('app-theme-switch'));
    if (appThemeToggle) {
        appThemeToggle.checked = isLight;
    }
    const settingsThemeToggle = /** @type {HTMLInputElement|null} */ (document.getElementById('settings-theme-switch'));
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
    const settingsThemeLabel = document.querySelector('label[for="settings-theme-switch"]');
    if (settingsThemeLabel) {
        settingsThemeLabel.textContent = translatedText;
        settingsThemeLabel.setAttribute('data-i18n', labelKey);
    }

    document.querySelectorAll('#app-accent-picker .accent-swatch').forEach(swatch => {
        const swatchColor = swatch.getAttribute('data-color');
        swatch.classList.toggle('is-active', swatchColor === accentColor);
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
    setDefaultDateLocale(targetLang);

    handleStateUpdate(() => {
        if (!state.uiSettings) {
            state.uiSettings = {};
        }
        state.uiSettings.language = targetLang;
    }, false, { preferencesOnly: true });
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
    appSettingsController.resetForTesting();
}

/**
 * Initializes settings button, popover bindings, preferences, and cross-tab sync.
 */
export function initAppSettings() {
    appSettingsController.init();
}
