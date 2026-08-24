import { changelogData } from '../data/changelogData.js';
import { state } from '../core/state.js';
import { translate } from '../i18n/translator.js';
import { formatDate } from '../utils/dateUtils.js';

/**
 * Builds the localized HTML markup for the modal changelog history.
 *
 * @returns {string} Formatted changelog HTML snippet.
 */
export function getChangelogHtml() {
    let html = '<div class="changelog-container">';
    const currentLang = state.uiSettings?.language || 'en';

    changelogData.forEach((release, index) => {
        const isLatest = index === 0;
        const releaseClass = isLatest ? 'changelog-release latest' : 'changelog-release';

        const dateObj = new Date(release.date + 'T00:00:00Z');
        const formattedDate = formatDate(dateObj, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }, currentLang);

        html += `
            <div class="${releaseClass}">
                <div class="changelog-header">
                    <h3 class="changelog-version">${release.version}</h3>
                    <span class="changelog-date">${formattedDate}</span>
                    ${isLatest ? `<span class="changelog-badge-latest" data-i18n="app.latest">${translate('app.latest')}</span>` : ''}
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

            const typeKey = `views.changelog.type.${change.type}`;
            const translatedBadge = translate(typeKey);
            const badgeLabel = (translatedBadge && translatedBadge !== typeKey)
                ? translatedBadge
                : (change.type.charAt(0).toUpperCase() + change.type.slice(1));

            html += `
                <li class="changelog-item ${changeClass}">
                    <span class="change-badge" data-i18n="${typeKey}">${badgeLabel}</span>
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
