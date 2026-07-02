import { dom } from '../../dom/domElements.js';
import { showCommitsModal } from './commitsModal.js';

export function initializeChangelogModal() {
    const modal = document.getElementById('changelog-modal');
    const closeButton = document.getElementById('close-changelog-modal-btn');
    const footerCloseButton = document.getElementById('changelog-close-btn');
    const commitsButton = document.getElementById('changelog-commits-btn');
    const overlay = dom.overlay;

    const closeModal = () => {
        if (modal) modal.classList.remove('show');
        if (overlay) overlay.classList.remove('show');
    };

    if (closeButton) {
        closeButton.addEventListener('click', closeModal);
    }

    if (footerCloseButton) {
        footerCloseButton.addEventListener('click', closeModal);
    }

    if (modal && commitsButton) {
        commitsButton.addEventListener('click', () => {
            const commits = window.__ENV__?.COMMITS_SINCE_TAG || [];
            if (commits.length > 0) {
                // Hide changelog modal first
                modal.classList.remove('show');
                // Show commits modal
                showCommitsModal(commits);
            }
        });
    }
}

function isInterruptionRestricted() {
    const welcomeModal = document.getElementById('welcome-modal');
    if (welcomeModal && welcomeModal.classList.contains('show')) {
        return true;
    }
    const consentBanner = document.getElementById('consent-banner');
    if (consentBanner && consentBanner.classList.contains('show')) {
        return true;
    }
    const consentModal = document.getElementById('consent-modal');
    if (consentModal && consentModal.classList.contains('show')) {
        return true;
    }
    const tourTooltip = document.querySelector('.tour-tooltip');
    if (tourTooltip && tourTooltip.style.display !== 'none' && tourTooltip.style.opacity !== '0') {
        return true;
    }
    return false;
}

export function showChangelogModal(content) {
    if (isInterruptionRestricted()) {
        return;
    }

    const modal = document.getElementById('changelog-modal');
    const modalBody = document.getElementById('changelog-modal-body');
    const commitsButton = document.getElementById('changelog-commits-btn');
    const overlay = dom.overlay;

    if (modal && modalBody && overlay) {
        modalBody.innerHTML = content;
        
        // Hide commits button if there are no commits since the tag, OR if the changelog modal content is empty
        if (commitsButton) {
            const commits = window.__ENV__?.COMMITS_SINCE_TAG || [];
            const isChangelogEmpty = !content || content.trim() === '' || content === '<div class="changelog-container"></div>';
            commitsButton.style.display = (commits.length > 0 && !isChangelogEmpty) ? 'inline-flex' : 'none';
        }

        modal.classList.add('show');
        overlay.classList.add('show');
    }
}
