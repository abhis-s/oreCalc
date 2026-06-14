import { dom } from '../../dom/domElements.js';

export function initializeCommitsModal() {
    const modal = document.getElementById('commits-modal');
    const closeButton = document.getElementById('close-commits-modal-btn');
    const overlay = dom.overlay;

    if (modal && closeButton && overlay) {
        closeButton.addEventListener('click', () => {
            modal.classList.remove('show');
            overlay.classList.remove('show');
        });
    }
}

export function showCommitsModal(commits) {
    const modal = document.getElementById('commits-modal');
    const modalBody = document.getElementById('commits-modal-body');
    const overlay = dom.overlay;

    if (modal && modalBody && overlay) {
        const conventionalCommitRegex = /^([a-z-]+)(?:\(([^)]+)\))?:\s*(.*)$/i;

        let html = '<div class="commits-container"><ul class="commits-list">';
        commits.forEach(commit => {
            const match = commit.subject.match(conventionalCommitRegex);
            let subjectHtml = '';
            if (match) {
                const type = match[1].toLowerCase();
                const scope = match[2] ? `<span class="commit-scope">(${match[2]})</span>` : '';
                const message = match[3];
                subjectHtml = `<span class="commit-type type-${type}">${type}</span>${scope} <span class="commit-msg-text">${message}</span>`;
            } else {
                subjectHtml = `<span class="commit-msg-text">${commit.subject}</span>`;
            }

            html += `
                <li class="commit-item">
                    <code class="commit-hash">${commit.hash}</code>
                    <span class="commit-subject">${subjectHtml}</span>
                </li>
            `;
        });
        html += '</ul></div>';
        
        modalBody.innerHTML = html;
        modal.classList.add('show');
        overlay.classList.add('show');
    }
}
