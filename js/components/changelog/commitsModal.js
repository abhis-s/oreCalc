import { dom } from '../../dom/domElements.js';
import { translate } from '../../i18n/translator.js';

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
                modalTitle.textContent = translate('commits.milestoneTitle') || 'New Feature Released!';
            } else {
                modalTitle.textContent = translate('commits.title') || 'Minor Updates';
            }
        }

        let html = '<div class="commits-container">';

        // 1. Render Milestones if present
        if (milestones.length > 0) {
            html += `
                <div class="milestones-section">
                    <div class="milestones-title-group">
                        <orecalc-assets-svg name="star-shine" class="milestones-icon" height="20" width="20"></orecalc-assets-svg>
                        <span>${translate('commits.highlightsTitle') || 'Key Highlights'}</span>
                    </div>
                    <ul class="milestones-list">
            `;
            milestones.forEach(m => {
                const scopeHtml = m.scope ? `<span class="commit-scope">${m.scope.toUpperCase()}:</span> ` : '';
                html += `<li class="milestone-item">${scopeHtml}${m.text}</li>`;
            });
            html += '</ul></div>';
        }

        // 2. Render all commits (milestones and others)
        if (commits.length > 0) {
            const hasMilestones = milestones.length > 0;
            if (hasMilestones) {
                html += `
                    <details class="other-updates-details">
                        <summary class="other-updates-summary">
                            <span>${translate('commits.otherUpdatesTitle') || 'Other Updates'}</span>
                            <orecalc-assets-svg name="dropdown" class="summary-toggle-icon"></orecalc-assets-svg>
                        </summary>
                        <div class="other-updates-content">
                `;
            } else {
                html += `<h4 class="other-updates-heading">${translate('commits.otherUpdatesTitle') || 'Other Updates'}</h4>`;
            }

            html += '<ul class="commits-list">';
            commits.forEach(commit => {
                const match = commit.subject.match(conventionalCommitRegex);
                const milestoneMatch = commit.subject.match(milestoneRegex);
                let subjectHtml = '';
                let typeHtml = '';
                
                if (milestoneMatch) {
                    const scope = milestoneMatch[1] ? `<span class="commit-scope">${milestoneMatch[1]}:</span> ` : '';
                    typeHtml = `<span class="commit-type type-feat" style="background-color: rgba(234, 179, 8, 0.15); color: rgb(234, 179, 8); border: 1px solid rgba(234, 179, 8, 0.3);">milestone</span>`;
                    subjectHtml = `${scope}<span class="commit-msg-text">${milestoneMatch[2]}</span>`;
                } else if (match) {
                    const type = match[1].toLowerCase();
                    const scope = match[2] ? `<span class="commit-scope">${match[2]}:</span> ` : '';
                    const message = match[3];
                    if (type === 'milestone' || type === 'announcement') {
                        typeHtml = `<span class="commit-type type-feat" style="background-color: rgba(234, 179, 8, 0.15); color: rgb(234, 179, 8); border: 1px solid rgba(234, 179, 8, 0.3);">milestone</span>`;
                    } else {
                        typeHtml = `<span class="commit-type type-${type}">${type}</span>`;
                    }
                    subjectHtml = `${scope}<span class="commit-msg-text">${message}</span>`;
                } else {
                    subjectHtml = `<span class="commit-msg-text">${commit.subject}</span>`;
                }

                html += `
                    <li class="commit-item">
                        <div class="commit-meta">
                            ${typeHtml}
                            <code class="commit-hash">${commit.hash}</code>
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
