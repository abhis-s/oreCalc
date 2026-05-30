import { dom } from '../../dom/domElements.js';

export function initializeChangelogModal() {
    const modal = document.getElementById('changelog-modal');
    const closeButton = document.getElementById('close-changelog-modal-btn');
    const overlay = dom.overlay;

    if (modal && closeButton && overlay) {
        closeButton.addEventListener('click', () => {
            modal.classList.remove('show');
            overlay.classList.remove('show');
        });
    }
}

export function showChangelogModal(content) {
    const modal = document.getElementById('changelog-modal');
    const modalBody = document.getElementById('changelog-modal-body');
    const overlay = dom.overlay;

    if (modal && modalBody && overlay) {
        modalBody.innerHTML = content;
        modal.classList.add('show');
        overlay.classList.add('show');
    }
}
