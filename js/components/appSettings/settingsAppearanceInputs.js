import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';
import { applyAppLanguage } from '../common/appSettingsManager.js';

import { dom } from '../../dom/domElements.js';
import { applyCardLayout } from '../../ui/cardLayoutManager.js';

/**
 * Initializes appearance-related settings: theme, language, and card layout.
 */
export function initializeSettingsAppearance() {
    const languageSelect = dom.appSettings?.languageSelect;

    if (languageSelect) {
        languageSelect.addEventListener('change', async (e) => {
            const newLanguage = /** @type {HTMLSelectElement} */ (e.target).value;
            await applyAppLanguage(newLanguage, false);
        });
    }

    const themeToggle = /** @type {HTMLInputElement|null} */ (document.getElementById('settings-theme-switch'));

    if (themeToggle) {
        const themeLabel = document.querySelector('label[for="settings-theme-switch"]');
        const updateThemeLabel = () => {
            if (themeLabel) {
                const labelKey = themeToggle.checked ? 'views.settings.options.themeDark' : 'views.settings.options.themeLight';
                themeLabel.textContent = translate(labelKey);
                themeLabel.setAttribute('data-i18n', labelKey);
            }
        };
        themeToggle.checked = state.uiSettings.theme === 'light';
        updateThemeLabel();

        themeToggle.addEventListener('change', (e) => {
            const target = /** @type {HTMLInputElement} */ (e.target);
            const newTheme = target.checked ? 'light' : 'dark';

            const rect = target.closest('.switch')?.getBoundingClientRect() || { left: 0, top: 0, width: 0, height: 0 };
            const origin = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };

            handleStateUpdate(() => {
                state.uiSettings.theme = newTheme;
            }, true, { preferencesOnly: true });
            document.dispatchEvent(new CustomEvent('app:theme-change', { detail: { theme: newTheme, origin } }));
            updateThemeLabel();
        });
    }

    const cozyQuiltToggle = /** @type {HTMLInputElement|null} */ (document.getElementById('app-card-layout-switch') || document.getElementById('settings-cozy-quilt-switch'));

    if (cozyQuiltToggle) {
        cozyQuiltToggle.checked = state.uiSettings.cardLayout === 'compact0' || state.uiSettings.cardLayout === 'compact1' || state.uiSettings.cardLayout === 'quilt';

        cozyQuiltToggle.addEventListener('change', (e) => {
            const layout = /** @type {HTMLInputElement} */ (e.target).checked ? 'compact0' : 'cozy';
            handleStateUpdate(() => {
                state.uiSettings.cardLayout = layout;
            }, true, { preferencesOnly: true });
            applyCardLayout(layout);
        });
    }
}
