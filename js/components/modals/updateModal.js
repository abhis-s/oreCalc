import { dom } from '../../dom/domElements.js';

export function showUpdateModal(wb) {
    const modal = document.getElementById('update-available-modal');
    const laterBtn = document.getElementById('update-later-button');
    const reloadBtn = document.getElementById('update-reload-button');
    const overlay = dom.overlay;

    if (!modal) return;

    if (laterBtn) {
        laterBtn.onclick = () => {
            modal.classList.remove('show');
            if (overlay) overlay.classList.remove('show');
        };
    }

    if (reloadBtn) {
        reloadBtn.onclick = () => {
            wb.addEventListener('controlling', () => {
                window.location.reload();
            });
            wb.messageSkipWaiting();
        };
    }

    modal.classList.add('show');
    if (overlay) overlay.classList.add('show');
}
