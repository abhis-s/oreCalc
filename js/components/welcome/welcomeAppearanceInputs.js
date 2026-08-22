import { loadTranslations } from '../../i18n/translator.js';

import { syncLanguageUrl } from '../../core/languageRouter.js';
import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

/**
 * Initializes Page 1 appearance event listeners (Theme switcher, language selection, accent color swatches).
 *
 * @param {HTMLElement} modal - The Welcome modal root element.
 * @param {HTMLElement|null} carousel - The Welcome modal carousel element.
 */
export function initializeWelcomeAppearanceInputs(modal, carousel) {
    if (!modal) return;

    const welcomeLangSelect = modal.querySelector('#welcome-language-select');
    if (welcomeLangSelect) {
        welcomeLangSelect.addEventListener('change', async (e) => {
            const newLang = e.target.value;
            if (state.uiSettings.language === newLang) return;

            const header = modal.querySelector('.welcome-header');
            if (header) header.classList.add('translating-header');
            if (carousel) carousel.classList.add('translating');

            await new Promise(resolve => setTimeout(resolve, 150));

            await loadTranslations(newLang);

            handleStateUpdate(() => {
                state.uiSettings.language = newLang;
                syncLanguageUrl(newLang, false);
            });

            document.dispatchEvent(new CustomEvent('app:translate'));

            const event = new Event('languageChanged');
            document.dispatchEvent(event);

            if (header) header.classList.remove('translating-header');
            if (carousel) carousel.classList.remove('translating');
        });
    }

    modal.querySelectorAll('.theme-switch .pref-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const newTheme = btn.getAttribute('data-theme');
            if (state.uiSettings.theme === newTheme) return;

            const themeSwitch = modal.querySelector('.theme-switch');
            if (themeSwitch) {
                themeSwitch.setAttribute('data-active-index', newTheme === 'dark' ? '0' : '1');
            }

            modal.querySelectorAll('.theme-switch .pref-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            handleStateUpdate(() => {
                state.uiSettings.theme = newTheme;
            }, true);

            const rect = btn.getBoundingClientRect();
            const origin = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };

            document.dispatchEvent(new CustomEvent('app:theme-change', { detail: { theme: newTheme, origin } }));
        });
    });

    modal.querySelectorAll('#welcome-accent-picker .accent-swatch').forEach(swatch => {
        swatch.addEventListener('click', () => {
            const newAccent = swatch.dataset.color;
            modal.querySelectorAll('#welcome-accent-picker .accent-swatch').forEach(s => {
                s.classList.toggle('active', s.dataset.color === newAccent);
            });

            handleStateUpdate(() => {
                state.uiSettings.accentColor = newAccent;
            }, true);

            const rect = swatch.getBoundingClientRect();
            const origin = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
                isSwatchClick: true
            };
            document.dispatchEvent(new CustomEvent('app:theme-change', { detail: { theme: state.uiSettings.theme, origin } }));
        });
    });

    const randomLabel = modal.querySelector('.random-label');
    if (randomLabel) {
        randomLabel.addEventListener('click', () => {
            const swatch = randomLabel.previousElementSibling;
            if (swatch) swatch.click();
        });
    }
}
