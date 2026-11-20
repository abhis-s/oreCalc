import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';
import { getSupercellEquipmentBlogUrl } from '../../data/languagesData.js';

/**
 * Updates the visibility and localized article link of the economy notice banner based on uiSettings.
 *
 * @param {Record<string, any>} [uiSettings]
 */
export function updateEquipmentEconomyNoticeDisplay(uiSettings = null) {
    const noticeEl = document.getElementById('eq-economy-notice');
    const reopenWrapper = document.getElementById('eq-economy-notice-reopen-wrapper');
    if (!noticeEl) return;

    const currentSettings = uiSettings || state.uiSettings;
    const isDismissed = Boolean(currentSettings?.dismissedEconomyNotice);

    noticeEl.hidden = isDismissed;
    if (reopenWrapper) {
        reopenWrapper.hidden = !isDismissed;
    }

    const articleLink = /** @type {HTMLAnchorElement | null} */ (document.getElementById('eq-economy-notice-article-link'));
    if (articleLink) {
        const activeLang = currentSettings?.language || 'en';
        articleLink.href = getSupercellEquipmentBlogUrl(activeLang);
    }
}

/**
 * Initializes the Equipment Tab Upcoming Ore Economy Changes announcement notice.
 * Binds dismiss and re-opening listeners and applies initial visibility.
 */
export function initializeEquipmentEconomyNotice() {
    const noticeEl = document.getElementById('eq-economy-notice');
    const dismissBtn = document.getElementById('eq-economy-notice-dismiss-btn');
    const reopenBtn = document.getElementById('eq-economy-notice-reopen-btn');

    if (!noticeEl) return;

    updateEquipmentEconomyNoticeDisplay(state.uiSettings);

    if (!noticeEl.dataset.langBound) {
        noticeEl.dataset.langBound = 'true';
        document.addEventListener('languageChanged', () => {
            updateEquipmentEconomyNoticeDisplay();
        });
    }

    if (dismissBtn && !dismissBtn.dataset.bound) {
        dismissBtn.dataset.bound = 'true';
        dismissBtn.addEventListener('click', () => {
            handleStateUpdate(() => {
                if (!state.uiSettings) {
                    state.uiSettings = {};
                }
                state.uiSettings.dismissedEconomyNotice = true;
            });
            updateEquipmentEconomyNoticeDisplay(state.uiSettings);
        });
    }

    if (reopenBtn && !reopenBtn.dataset.bound) {
        reopenBtn.dataset.bound = 'true';
        reopenBtn.addEventListener('click', () => {
            handleStateUpdate(() => {
                if (!state.uiSettings) {
                    state.uiSettings = {};
                }
                state.uiSettings.dismissedEconomyNotice = false;
            });
            updateEquipmentEconomyNoticeDisplay(state.uiSettings);
            noticeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    }
}
