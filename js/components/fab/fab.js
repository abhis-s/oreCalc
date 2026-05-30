import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { saveState } from '../../core/localStorageManager.js';
import { fetchPlayerData } from '../../services/apiService.js';
import { loadAndProcessPlayerData } from '../../services/serverResponseHandler.js';
import { translate } from '../../i18n/translator.js';
import { showAlert } from '../../ui/noticeModal.js';
import { escapeHTML } from '../../utils/stringUtils.js';

function toggleFabMenu() {
    const { main, menu } = dom.fab;
    const overlay = dom.overlay;

    if (!main || !menu || !overlay) return;
    const isActive = main.classList.toggle('active');
    menu.classList.toggle('show', isActive);
    overlay.classList.toggle('show', isActive);
}

export function initializeFab() {
    const { main, pills } = dom.fab;
    const overlay = dom.overlay;

    if (!main) return;

    main.addEventListener('click', toggleFabMenu);
    overlay.addEventListener('click', toggleFabMenu);

    pills.refresh?.addEventListener('click', async () => {
        const activeTag = state.savedPlayerTags[0];
        if (!activeTag) return;
        
        try {
            pills.refresh.classList.add('saving');
            const result = await loadAndProcessPlayerData(activeTag);
            
            pills.refresh.classList.remove('saving');
            if (result.success) {
                pills.refresh.classList.add('success');
                setTimeout(() => {
                    pills.refresh.classList.remove('success');
                    toggleFabMenu();
                }, 1500);
            } else {
                pills.refresh.classList.add('error');
                setTimeout(() => pills.refresh.classList.remove('error'), 3000);
                await showAlert(translate('alerts.refreshFailed', { error: result.message }));
            }
        } catch (error) {
            console.error("Refresh failed:", error);
            pills.refresh.classList.remove('saving');
            pills.refresh.classList.add('error');
            setTimeout(() => pills.refresh.classList.remove('error'), 3000);
        }
    });

    pills.saveData?.addEventListener('click', async () => {
        saveState(state);
        toggleFabMenu();
    });
}

export function renderFab(playerTag) {
    const isDisabled = !playerTag || (state.savedPlayerTags.length === 1 && state.savedPlayerTags[0] === 'DEFAULT0') || (!state.savedPlayerTags.includes(playerTag) && state.savedPlayerTags.length > 1);

    if (dom.fab.main) {
        dom.fab.main.disabled = isDisabled;
    }

    if (dom.controls.saveButton) {
        dom.controls.saveButton.disabled = isDisabled;
    }
}