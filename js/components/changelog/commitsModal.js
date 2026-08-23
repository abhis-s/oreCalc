import { translate } from '../../i18n/translator.js';

import { closeModalAnimated } from '../../utils/modalHistoryManager.js';
import { escapeHTML } from '../../utils/stringUtils.js';

import { dom } from '../../dom/domElements.js';

/**
 * Initializes close button event listeners for the Git Commits / Release History modal.
 */
export function initializeCommitsModal() {
    const modal = document.getElementById('commits-modal');
    const closeButton = document.getElementById('close-commits-modal-btn');

    if (modal && closeButton) {
        closeButton.addEventListener('click', () => {
            closeModalAnimated(modal);
        });
    }
}

function isInterruptionRestricted() {
    if (window.isAppStartingUp) {
        return true;
    }
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
    if (window.isTourPending || window.isTourRunning) {
        return true;
    }
    return false;
}

/**
 * Parses and displays conventional commit logs and highlighted milestones in the Commits modal.
 * @param {Array<any>} commits - List of commit objects with hash, subject, and author.
 */
export function showCommitsModal(commits) {
    if (isInterruptionRestricted()) {
        return;
    }

    const modal = document.getElementById('commits-modal');
    const modalBody = document.getElementById('commits-modal-body');
    const overlay = dom.overlay;

    if (modal && modalBody && overlay) {
        const conventionalCommitRegex = /^([a-z-]+)(?:\(([^)]+)\))?:\s*(.*)$/i;
        const milestoneRegex = /^milestone(?:\(([^)]+)\))?:\s*(.*)$/i;

        const milestones = [];

        commits.forEach(commit => {
            const milestoneMatch = commit.subject.match(milestoneRegex);
            const convMatch = commit.subject.match(conventionalCommitRegex);

            if (milestoneMatch) {
                milestones.push({
                    hash: commit.hash,
                    scope: milestoneMatch[1] || '',
                    text: milestoneMatch[2]
                });
            } else if (convMatch && (convMatch[1].toLowerCase() === 'milestone' || convMatch[1].toLowerCase() === 'announcement')) {
                milestones.push({
                    hash: commit.hash,
                    scope: convMatch[2] || '',
                    text: convMatch[3]
                });
            }
        });

        // Dynamically update modal header title based on content type
        const modalTitle = modal.querySelector('.modal-header h2');
        if (modalTitle) {
            if (milestones.length > 0) {
                modalTitle.textContent = translate('views.commits.milestoneTitle');
                modalTitle.setAttribute('data-i18n', 'views.commits.milestoneTitle');
            } else {
                modalTitle.textContent = translate('views.commits.title');
                modalTitle.setAttribute('data-i18n', 'views.commits.title');
            }
        }

        let html = '<div class="commits-container">';

        if (milestones.length > 0) {
            html += `
                <div class="milestones-section">
                    <div class="milestones-title-group">
                        <orecalc-assets-svg name="star-shine" class="milestones-icon" height="20" width="20"></orecalc-assets-svg>
                        <span data-i18n="views.commits.highlightsTitle">${translate('views.commits.highlightsTitle')}</span>
                    </div>
                    <ul class="milestones-list">
            `;
            milestones.forEach(m => {
                const scopeHtml = m.scope ? `<span class="commit-scope">${escapeHTML(m.scope.toUpperCase())}:</span> ` : '';
                html += `<li class="milestone-item">${scopeHtml}${escapeHTML(m.text)}</li>`;
            });
            html += '</ul></div>';
        }

        if (commits.length > 0) {
            const hasMilestones = milestones.length > 0;
            if (hasMilestones) {
                html += `
                    <details class="other-updates-details">
                        <summary class="other-updates-summary">
                            <span data-i18n="views.commits.otherUpdatesTitle">${translate('views.commits.otherUpdatesTitle')}</span>
                            <orecalc-assets-svg name="dropdown" class="summary-toggle-icon"></orecalc-assets-svg>
                        </summary>
                        <div class="other-updates-content">
                `;
            } else {
                html += `<h3 class="other-updates-heading" data-i18n="views.commits.otherUpdatesTitle">${translate('views.commits.otherUpdatesTitle')}</h3>`;
            }

            html += '<ul class="commits-list">';
            commits.forEach(commit => {
                const match = commit.subject.match(conventionalCommitRegex);
                const milestoneMatch = commit.subject.match(milestoneRegex);
                let subjectHtml = '';
                let typeHtml = '';

                if (milestoneMatch) {
                    const scope = milestoneMatch[1] ? `<span class="commit-scope">${escapeHTML(milestoneMatch[1])}:</span> ` : '';
                    typeHtml = `<span class="commit-type type-feat" style="background-color: rgba(234, 179, 8, 0.15); color: rgb(234, 179, 8); border: 1px solid rgba(234, 179, 8, 0.3);">milestone</span>`;
                    subjectHtml = `${scope}<span class="commit-msg-text">${escapeHTML(milestoneMatch[2])}</span>`;
                } else if (match) {
                    const type = match[1].toLowerCase();
                    const scope = match[2] ? `<span class="commit-scope">${escapeHTML(match[2])}:</span> ` : '';
                    const message = match[3];
                    if (type === 'milestone' || type === 'announcement') {
                        typeHtml = `<span class="commit-type type-feat" style="background-color: rgba(234, 179, 8, 0.15); color: rgb(234, 179, 8); border: 1px solid rgba(234, 179, 8, 0.3);">milestone</span>`;
                    } else {
                        typeHtml = `<span class="commit-type type-${escapeHTML(type)}">${escapeHTML(type)}</span>`;
                    }
                    subjectHtml = `${scope}<span class="commit-msg-text">${escapeHTML(message)}</span>`;
                } else {
                    subjectHtml = `<span class="commit-msg-text">${escapeHTML(commit.subject)}</span>`;
                }

                html += `
                    <li class="commit-item">
                        <div class="commit-meta">
                            ${typeHtml}
                            <code class="commit-hash">${escapeHTML(commit.hash)}</code>
                        </div>
                        <span class="commit-subject">${subjectHtml}</span>
                    </li>
                `;
            });
            html += '</ul>';

            if (hasMilestones) {
                html += '</div></details>';
            }
        }

        html += '</div>';

        modalBody.innerHTML = html;
        modal.classList.add('show');
        overlay.classList.add('show');
    }
}
