import { closeModalAnimated, openModal } from '../../utils/modalHistoryManager.js';

import { showCommitsModal } from './commitsModal.js';

/**
 * Initializes close button event listeners and commits modal toggle triggers for the Changelog modal.
 */
export function initializeChangelogModal() {
    const modal = document.getElementById('changelog-modal');
    if (!modal || modal.dataset?.changelogInitialized === 'true') {
        return;
    }
    if (modal.dataset) {
        modal.dataset.changelogInitialized = 'true';
    }

    const closeButton = document.getElementById('close-changelog-modal-btn');
    const footerCloseButton = document.getElementById('changelog-close-btn');
    const commitsButton = document.getElementById('changelog-commits-btn');

    const closeModal = () => {
        if (modal) closeModalAnimated(modal);
    };

    if (closeButton && typeof closeButton.addEventListener === 'function') {
        closeButton.addEventListener('click', closeModal);
    }

    if (footerCloseButton && typeof footerCloseButton.addEventListener === 'function') {
        footerCloseButton.addEventListener('click', closeModal);
    }

    if (modal && commitsButton && typeof commitsButton.addEventListener === 'function') {
        commitsButton.addEventListener('click', () => {
            const rawCommits = window.__ENV__?.COMMITS_SINCE_TAG;
            const commits = Array.isArray(rawCommits) ? rawCommits : [];
            if (commits.length > 0) {
                closeModalAnimated(modal, () => {
                    showCommitsModal(commits);
                });
            }
        });
    }
}

function isInterruptionRestricted() {
    if (window.isAppStartingUp) {
        return true;
    }
    const guidedSetupModal = document.getElementById('guided-setup-modal');
    if (guidedSetupModal && (guidedSetupModal.classList.contains('show') || /** @type {HTMLDialogElement} */ (guidedSetupModal).open)) {
        return true;
    }
    const tourTooltip = document.querySelector('.tour-tooltip');
    if (tourTooltip && tourTooltip.style.display !== 'none' && tourTooltip.style.opacity !== '0') {
        return true;
    }
    if (window.isTourPending || window.isTourRunning) {
        return true;
    }
    return false;
}

/**
 * Displays the Changelog modal dialog with parsed release notes HTML markup.
 * @param {string} content - HTML string of release changelog notes.
 */
export function showChangelogModal(content) {
    if (isInterruptionRestricted()) {
        return;
    }

    const modal = document.getElementById('changelog-modal');
    const modalBody = document.getElementById('changelog-modal-body');
    const commitsButton = document.getElementById('changelog-commits-btn');

    if (modal && modalBody) {
        modalBody.innerHTML = content;

        if (commitsButton) {
            const rawCommits = window.__ENV__?.COMMITS_SINCE_TAG;
            const commits = Array.isArray(rawCommits) ? rawCommits : [];
            const isChangelogEmpty = !content || content.trim() === '' || content === '<div class="changelog-container"></div>';
            commitsButton.style.display = (commits.length > 0 && !isChangelogEmpty) ? 'inline-flex' : 'none';
        }

        initializeChangelogModal();
        openModal(modal);
    }
}
