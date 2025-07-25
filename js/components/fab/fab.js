import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { saveState } from '../../core/localStorageManager.js';
import { fetchPlayerData } from '../../services/apiService.js';
import { loadAndProcessPlayerData } from '../../services/serverResponseHandler.js';

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
        if (!state.lastPlayerTag) return;
        try {
            await loadAndProcessPlayerData(state.lastPlayerTag);
        } catch (error) {
            alert(`Failed to refresh player data: ${error.message}`);
        }
        toggleFabMenu();
    });

    pills.saveData?.addEventListener('click', () => {
        saveState(state);
        alert('Your progress has been saved!');
        toggleFabMenu();
    });
}

export function renderFab(playerTag) {
    const isDisabled = !playerTag || !state.savedPlayerTags.includes(playerTag);

    if (dom.fab.main) {
        dom.fab.main.disabled = isDisabled;
    }

    if (dom.controls.saveButton) {
        dom.controls.saveButton.disabled = isDisabled;
    }
}