import { changelogData } from '../data/changelogData.js';
import { formatDate } from '../utils/dateFormatter.js';
import { translate } from '../i18n/translator.js';

export function getChangelogHtml() {
    let html = '<div class="changelog-container">';

    changelogData.forEach((release, index) => {
        const isLatest = index === 0;
        const releaseClass = isLatest ? 'changelog-release latest' : 'changelog-release';
        
        const dateObj = new Date(release.date);
        const formattedDate = formatDate(dateObj, { year: 'numeric', month: 'long', day: 'numeric' });

        html += `
            <div class="${releaseClass}">
                <div class="changelog-header">
                    <h3 class="changelog-version">${release.version}</h3>
                    <span class="changelog-date">${formattedDate}</span>
                    ${isLatest ? `<span class="changelog-badge-latest">${translate('app.latest') || 'Latest'}</span>` : ''}
                </div>
                <ul class="changelog-list">
        `;

        release.changes.forEach(change => {
            let changeClass = 'change-default';
            if (change.type === 'feature') {
                changeClass = 'change-feature';
            } else if (change.type === 'fix') {
                changeClass = 'change-fix';
            } else if (change.type === 'chore') {
                changeClass = 'change-chore';
            }

            html += `
                <li class="changelog-item ${changeClass}">
                    <span class="change-badge">${translate('changelog.type.' + change.type) || change.type}</span>
                    <span class="change-text">${change.text}</span>
                </li>
            `;
        });

        html += `
                </ul>
            </div>
        `;
    });

    html += '</div>';
    return html;
}
