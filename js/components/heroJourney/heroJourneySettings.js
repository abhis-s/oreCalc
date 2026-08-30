import { safeJsonParse } from '../../utils/jsonUtils.js';
import { loadTranslations, translate } from '../../i18n/translator.js';
import { updateUIWithTranslations } from '../../i18n/uiTranslator.js';
import { enabledLanguages } from '../../data/languagesData.js';
import { applyThemeSettings } from '../../core/themeManager.js';
import { getLanguageFromPath, syncLanguageUrl } from '../../core/languageRouter.js';
import { state } from '../../core/state.js';
import { hjState } from './heroJourneyState.js';
import { resetHeaderWidthCache, updateHeaderLayout } from './heroJourneyHeaderDisplay.js';

const APP_SETTINGS_KEY = 'oreCalc_appSettings';

let activePopoverDismissListener = null;
let activeEscapeListener = null;
let activeResizeListener = null;
let currentLanguageChangeHandler = null;

/**
 * Clamps the settings popover horizontally so it stays within viewport bounds.
 * @param {HTMLElement} popover
 * @param {HTMLElement} btn
 */
function positionSettingsPopover(popover, btn) {
    if (!popover || !btn) return;
    const btnRect = btn.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const popoverWidth = popoverRect.width || popover.offsetWidth || 320;
    const naturalLeft = btnRect.right - popoverWidth;

    if (naturalLeft < 12) {
        const overflow = 12 - naturalLeft;
        popover.style.right = `${-overflow}px`;
    } else {
        popover.style.right = '0';
    }
}

/**
 * Reads settings from localStorage with defensive fallbacks, prioritizing URL language path.
 * @returns {{ theme: 'dark' | 'light', accentColor: string, language: string }}
 */
export function getCurrentSettings() {
    try {
        if (typeof localStorage === 'undefined') {
            return { theme: 'dark', accentColor: 'blue', language: 'en' };
        }
        const raw = localStorage.getItem(APP_SETTINGS_KEY);
        const settings = safeJsonParse(raw, {}) || {};
        const pathLang = (typeof window !== 'undefined') ? getLanguageFromPath() : null;
        const savedLang = pathLang || settings.language || 'en';
        return {
            theme: settings.theme === 'light' ? 'light' : 'dark',
            accentColor: settings.accentColor || 'blue',
            language: savedLang
        };
    } catch {
        return { theme: 'dark', accentColor: 'blue', language: 'en' };
    }
}

/**
 * Persists settings object updates to localStorage.
 * @param {Partial<{ theme: string, accentColor: string, language: string }>} patch
 */
function persistSettings(patch) {
    try {
        if (typeof localStorage === 'undefined') return;
        const raw = localStorage.getItem(APP_SETTINGS_KEY);
        const settings = safeJsonParse(raw, {}) || {};
        Object.assign(settings, patch);
        localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(settings));
        localStorage.removeItem('oreCalc_language');
    } catch {}
}

/**
 * Applies theme and accent color CSS custom properties to document with smooth transitions.
 * @param {string} theme - 'dark' | 'light'
 * @param {string} accentColor - 'blue' | 'gold' | 'purple' | 'green' | 'red' | 'random'
 * @param {boolean} [isInteraction=false] - Whether triggered by user interaction (enables smooth transition)
 * @param {boolean} [isSwatchClick=false] - Whether user explicitly clicked a swatch
 */
function applyHjTheme(theme, accentColor, isInteraction = false, isSwatchClick = false) {
    if (typeof document === 'undefined') return;

    if (!state.uiSettings) {
        state.uiSettings = {};
    }
    state.uiSettings.theme = theme;
    state.uiSettings.accentColor = accentColor;

    const origin = isInteraction ? { isSwatchClick } : null;
    applyThemeSettings(theme, accentColor, origin);

    document.documentElement.setAttribute('data-accent', accentColor);

    const popover = document.getElementById('hj-settings-popover');
    if (popover) {
        const themeSwitch = popover.querySelector('.theme-switch');
        if (themeSwitch) {
            themeSwitch.setAttribute('data-active-index', theme === 'dark' ? '0' : '1');
        }
        popover.querySelectorAll('.theme-switch .pref-btn').forEach(btn => {
            const btnTheme = btn.getAttribute('data-theme');
            btn.classList.toggle('active', btnTheme === theme);
        });

        popover.querySelectorAll('#hj-accent-picker .accent-swatch').forEach(swatch => {
            const swatchColor = swatch.getAttribute('data-color');
            swatch.classList.toggle('active', swatchColor === accentColor);
        });
    }

    persistSettings({ theme, accentColor });
}

/**
 * Toggles or sets open state of the settings dropdown popover.
 * @param {boolean} [forceState] - Explicit open/close state.
 */
function toggleSettingsPopover(forceState) {
    if (typeof document === 'undefined') return;

    const popover = document.getElementById('hj-settings-popover');
    const btn = document.getElementById('hj-settings-btn');
    if (!popover || !btn) return;

    const isOpen = forceState !== undefined ? forceState : !popover.classList.contains('is-open');

    if (isOpen) {
        popover.style.display = 'flex';
        // Force reflow for smooth transition
        void popover.offsetHeight;
        positionSettingsPopover(popover, btn);
        popover.classList.add('is-open');
        btn.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');

        if (!activePopoverDismissListener) {
            activePopoverDismissListener = (e) => {
                const target = /** @type {HTMLElement} */ (e.target);
                if (!popover.contains(target) && !btn.contains(target)) {
                    toggleSettingsPopover(false);
                }
            };
            document.addEventListener('pointerdown', activePopoverDismissListener, { passive: true });
        }

        if (!activeEscapeListener) {
            activeEscapeListener = (e) => {
                if (e.key === 'Escape') {
                    toggleSettingsPopover(false);
                    btn.focus();
                }
            };
            document.addEventListener('keydown', activeEscapeListener);
        }

        if (!activeResizeListener) {
            activeResizeListener = () => positionSettingsPopover(popover, btn);
            window.addEventListener('resize', activeResizeListener, { passive: true });
        }
    } else {
        popover.classList.remove('is-open');
        btn.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');

        // Delay hiding display until exit transition completes
        setTimeout(() => {
            if (!popover.classList.contains('is-open')) {
                popover.style.display = 'none';
            }
        }, 150);

        if (activePopoverDismissListener) {
            document.removeEventListener('pointerdown', activePopoverDismissListener);
            activePopoverDismissListener = null;
        }
        if (activeEscapeListener) {
            document.removeEventListener('keydown', activeEscapeListener);
            activeEscapeListener = null;
        }
        if (activeResizeListener) {
            window.removeEventListener('resize', activeResizeListener);
            activeResizeListener = null;
        }
    }
}

/**
 * Populates language dropdown with all enabled languages.
 * @param {HTMLSelectElement} selectEl
 * @param {string} currentLang
 */
function populateLanguageDropdown(selectEl, currentLang) {
    selectEl.innerHTML = '';
    enabledLanguages.forEach(lang => {
        const option = document.createElement('option');
        option.value = lang.code;
        const name = lang.nativeName || lang.fallbackName;
        const flag = lang.flag ? `${lang.flag} ` : '';
        option.textContent = `${flag}${name}`;
        if (lang.code === currentLang) {
            option.selected = true;
        }
        selectEl.appendChild(option);
    });
}

/**
 * Changes active application language, updates translations, and re-renders UI.
 * @param {string} newLang
 */
async function changeLanguage(newLang) {
    if (!newLang) return;
    if (!state.uiSettings) {
        state.uiSettings = {};
    }
    state.uiSettings.language = newLang;
    await loadTranslations(newLang);
    persistSettings({ language: newLang });

    if (typeof document !== 'undefined') {
        syncLanguageUrl(newLang, false);
        document.documentElement.lang = newLang;
        updateUIWithTranslations();
        resetHeaderWidthCache();
        updateHeaderLayout();
    }

    if (currentLanguageChangeHandler) {
        currentLanguageChangeHandler(newLang);
    }
}

/**
 * Initializes settings popover DOM bindings, event listeners, and saved preferences.
 * @param {((lang: string) => void)|null} [onLanguageChanged=null] - Callback invoked when language changes.
 */
export function initSettings(onLanguageChanged = null) {
    currentLanguageChangeHandler = onLanguageChanged;
    const settings = getCurrentSettings();

    if (!state.uiSettings) {
        state.uiSettings = {};
    }
    state.uiSettings.language = settings.language;
    state.uiSettings.theme = settings.theme;
    state.uiSettings.accentColor = settings.accentColor;

    applyHjTheme(settings.theme, settings.accentColor);

    if (typeof document === 'undefined') return;

    updateUIWithTranslations();

    const settingsBtn = document.getElementById('hj-settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSettingsPopover();
        });
    }

    const popover = document.getElementById('hj-settings-popover');
    if (popover) {
        popover.querySelectorAll('.theme-switch .pref-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTheme = btn.getAttribute('data-theme');
                if (targetTheme === 'light' || targetTheme === 'dark') {
                    const current = getCurrentSettings();
                    applyHjTheme(targetTheme, current.accentColor, true, false);
                }
            });
        });

        popover.querySelectorAll('#hj-accent-picker .accent-swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {
                const targetColor = swatch.getAttribute('data-color');
                if (targetColor) {
                    const current = getCurrentSettings();
                    applyHjTheme(current.theme, targetColor, true, true);
                }
            });
        });

        const langSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('hj-language-select'));
        if (langSelect) {
            populateLanguageDropdown(langSelect, settings.language);
            langSelect.addEventListener('change', async (e) => {
                const selected = /** @type {HTMLSelectElement} */ (e.target).value;
                await changeLanguage(selected);
            });
        }
    }
}

let isHjCrossTabSyncInitialized = false;

/**
 * Initializes cross-tab/window storage synchronization for the Standalone Hero's Journey page.
 * @param {() => void} [onStateChange] - Callback invoked when shared data/settings change.
 */
export function initHjCrossTabSync(onStateChange) {
    if (typeof window === 'undefined' || isHjCrossTabSyncInitialized) return;
    isHjCrossTabSyncInitialized = true;

    window.addEventListener('storage', async (event) => {
        if (!event.key || !event.newValue) return;

        if (event.key === APP_SETTINGS_KEY) {
            const newSettings = safeJsonParse(event.newValue, null);
            if (!newSettings || typeof newSettings !== 'object') return;

            const current = getCurrentSettings();
            const themeToApply = newSettings.theme || current.theme;
            const accentToApply = newSettings.accentColor || current.accentColor;

            if (newSettings.theme !== current.theme || newSettings.accentColor !== current.accentColor) {
                applyHjTheme(themeToApply, accentToApply, true, false);
            }

            if (newSettings.language && newSettings.language !== current.language) {
                const langSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('hj-language-select'));
                if (langSelect) langSelect.value = newSettings.language;
                await changeLanguage(newSettings.language);
            }

            if (typeof newSettings.revealBeyondTH === 'boolean') {
                state.heroJourney = state.heroJourney || {};
                state.heroJourney.revealBeyondTH = newSettings.revealBeyondTH;
                if (onStateChange) onStateChange();
            }
        }

        if (event.key === 'oreCalc_isAccelerated') {
            const isAccelerated = event.newValue === 'true';
            hjState.isAccelerated = isAccelerated;
            const toggle = /** @type {HTMLInputElement|null} */ (document.getElementById('home-hj-accelerated-switch'));
            if (toggle) toggle.checked = isAccelerated;
            if (onStateChange) onStateChange();
        }

        if (event.key === 'oreCalc_playerTags' || event.key.startsWith('oreCalc_player_')) {
            if (onStateChange) onStateChange();
        }
    });
}
