import { loadTranslations, translate } from '../../i18n/translator.js';

import { syncLanguageUrl } from '../../core/languageRouter.js';
import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { closeModalAnimated, openModal } from '../../utils/modalHistoryManager.js';

import { dom } from '../../dom/domElements.js';
import { applyCardLayout } from '../../ui/cardLayoutManager.js';

/**
 * Initializes appearance-related settings: theme, accent colors, language, and card layout.
 */
export function initializeSettingsAppearance() {
    const languageSelect = dom.appSettings?.languageSelect;
    const accentColorSwatches = dom.appSettings?.accentColorSwatches;
    const mobileAccentPickerBtn = dom.appSettings?.mobileAccentPickerBtn;
    const accentPickerModal = dom.appSettings?.accentPickerModal;
    const mobileAccentSwatches = dom.appSettings?.mobileAccentSwatches;
    const closeAccentPickerBtn = dom.appSettings?.closeAccentPickerBtn;

    if (languageSelect) {
        languageSelect.addEventListener('change', async (e) => {
            const newLanguage = /** @type {HTMLSelectElement} */ (e.target).value;
            await loadTranslations(newLanguage);

            handleStateUpdate(() => {
                state.uiSettings.language = newLanguage;
                syncLanguageUrl(newLanguage, false);
            }, false, { preferencesOnly: true });

            document.dispatchEvent(new CustomEvent('app:translate'));

            const event = new Event('languageChanged');
            document.dispatchEvent(event);
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

    const cozyQuiltToggle = /** @type {HTMLInputElement|null} */ (document.getElementById('settings-cozy-quilt-switch'));
    const layoutBtns = document.querySelectorAll('.layout-segmented-control .segmented-btn');

    if (cozyQuiltToggle) {
        const updateLayoutLabel = () => {
            const isCompact = state.uiSettings.cardLayout === 'compact0' || state.uiSettings.cardLayout === 'compact1';
            layoutBtns.forEach(btn => {
                const isQuilt = /** @type {HTMLElement} */ (btn).dataset.layout === 'quilt';
                const isActive = isQuilt === isCompact;
                btn.classList.toggle('is-active', isActive);
                btn.classList.toggle('active', isActive);
            });
            cozyQuiltToggle.checked = isCompact;
        };
        updateLayoutLabel();

        cozyQuiltToggle.addEventListener('change', (e) => {
            const layout = /** @type {HTMLInputElement} */ (e.target).checked ? 'compact0' : 'cozy';
            handleStateUpdate(() => {
                state.uiSettings.cardLayout = layout;
            }, true, { preferencesOnly: true });
            applyCardLayout(layout);
            updateLayoutLabel();
        });

        layoutBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const layout = /** @type {HTMLElement} */ (btn).dataset.layout;
                const targetLayout = layout === 'quilt' ? 'compact0' : 'cozy';
                if (state.uiSettings.cardLayout !== targetLayout) {
                    handleStateUpdate(() => {
                        state.uiSettings.cardLayout = targetLayout;
                    }, true, { preferencesOnly: true });
                    applyCardLayout(targetLayout);
                    updateLayoutLabel();
                }
            });
        });
    }

    const handleAccentChange = (color, element) => {
        const rect = element.getBoundingClientRect();
        const origin = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            isSwatchClick: true
        };

        handleStateUpdate(() => {
            state.uiSettings.accentColor = color;
        }, true, { preferencesOnly: true });

        if (accentColorSwatches) {
            accentColorSwatches.forEach(s => {
                const matches = s.dataset.color === color;
                s.classList.toggle('is-active', matches);
                s.classList.toggle('active', matches);
            });
        }
        if (mobileAccentSwatches) {
            mobileAccentSwatches.forEach(s => {
                const matches = s.dataset.color === color;
                s.classList.toggle('is-active', matches);
                s.classList.toggle('active', matches);
            });
        }

        document.dispatchEvent(new CustomEvent('app:theme-change', { detail: { theme: state.uiSettings.theme, origin } }));
    };

    if (mobileAccentPickerBtn && accentPickerModal) {
        mobileAccentPickerBtn.addEventListener('click', () => {
            openModal(accentPickerModal);
        });

        const closeMobilePicker = () => {
            closeModalAnimated(accentPickerModal);
        };

        closeAccentPickerBtn?.addEventListener('click', closeMobilePicker);

        if (mobileAccentSwatches) {
            mobileAccentSwatches.forEach(swatch => {
                swatch.addEventListener('click', (e) => {
                    const target = /** @type {HTMLElement} */ (e.target);
                    const color = target.dataset.color;
                    if (color) {
                        handleAccentChange(color, target);
                    }
                    closeMobilePicker();
                });
            });
        }
    }

    if (accentColorSwatches) {
        accentColorSwatches.forEach(swatch => {
            swatch.addEventListener('click', (e) => {
                const target = /** @type {HTMLElement} */ (e.target);
                const color = target.dataset.color;
                if (color) {
                    handleAccentChange(color, target);
                }
            });
        });
    }
}
