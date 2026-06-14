import { dom } from '../../dom/domElements.js';
import { showCommitsModal } from './commitsModal.js';

export function initializeChangelogModal() {
    const modal = document.getElementById('changelog-modal');
    const closeButton = document.getElementById('close-changelog-modal-btn');
    const commitsButton = document.getElementById('changelog-commits-btn');
    const overlay = dom.overlay;

    if (modal && closeButton && overlay) {
        closeButton.addEventListener('click', () => {
            modal.classList.remove('show');
            overlay.classList.remove('show');
        });
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

export function showChangelogModal(content) {
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
