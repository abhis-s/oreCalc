import { escapeHTML } from '../../utils/stringUtils.js';

/**
 * js/components/common/profileStatsRenderer.js
 * Single source of truth for rendering the collapsible progress bars and ore stat boxes
 * within .home-profile-stats-container across OreCalc and Hero Journey profile cards.
 */

/**
 * @typedef {Object} ProfileOverallStatConfig
 * @property {string} label - Display label for overall progress.
 * @property {string} [labelKey] - Optional i18n key for the label.
 * @property {string} icon - Path to the overall icon asset.
 * @property {string} [alt] - Alt text for the overall icon.
 * @property {number} percentage - Overall progress percentage (0-100).
 * @property {string} [percentageText] - Optional formatted percentage string override.
 * @property {string} [gradient] - Optional inline background gradient style.
 * @property {string} [style] - Optional CSS style string override.
 * @property {boolean} [isMaxed=false] - Whether the overall progress has reached max capacity.
 */

/**
 * @typedef {Object} ProfileOreStatItem
 * @property {'shiny'|'glowy'|'starry'|string} type - Identifier for the ore type.
 * @property {string} label - Display label for the ore stat box.
 * @property {string} [labelKey] - Optional i18n key for the label.
 * @property {string} icon - Path to the ore icon asset.
 * @property {string} [alt] - Alt text for the ore icon.
 * @property {number} percentage - Progress percentage (0-100).
 * @property {string} [percentageText] - Optional formatted percentage string override.
 * @property {number} [storagePct] - Optional storage fullness percentage for overlay bar.
 * @property {string} [subtextHtml] - Optional HTML markup rendered at the bottom of the stat box.
 */

/**
 * @typedef {Object} ProfileStatsConfig
 * @property {ProfileOverallStatConfig} [overall] - Configuration for the primary overall bar.
 * @property {ProfileOreStatItem[]} [ores=[]] - Array of sub-ore box configurations.
 * @property {string} [footerHtml=''] - Optional HTML markup appended inside .home-profile-stats-container.
 */

const ORE_FILL_CLASSES = {
    shiny: 'shiny-fill',
    glowy: 'glowy-fill',
    starry: 'starry-fill'
};

/**
 * Renders the standardized .home-profile-stats-container markup containing the overall progress
 * bar and individual ore stat boxes.
 *
 * @param {ProfileStatsConfig} config - Structured data configuration for the stats section.
 * @returns {string} Rendered HTML string.
 */
export function renderProfileStatsHtml({
    overall = {
        label: '',
        labelKey: '',
        icon: '',
        alt: '',
        percentage: 0,
        percentageText: '',
        gradient: '',
        isMaxed: false
    },
    ores = [],
    footerHtml = ''
} = {}) {
    const isMaxed = Boolean(overall.isMaxed || overall.percentage >= 100);
    const overallPct = Math.max(0, Math.min(100, Number(overall.percentage) || 0));
    const overallValueText = overall.percentageText || `${overallPct}%`;
    const overallLabelAttr = overall.labelKey ? ` data-i18n="${escapeHTML(overall.labelKey)}"` : '';
    const overallAlt = escapeHTML(overall.alt || overall.label || 'Progress');

    const overallBarStyle = overall.gradient
        ? `background: ${overall.gradient}`
        : (overall.style || '');

    const oreBoxesHtml = (!isMaxed && Array.isArray(ores) && ores.length > 0)
        ? `
            <div class="home-profile-stats-row">
                ${ores.map(ore => {
                    const oreType = escapeHTML(ore.type || 'shiny');
                    const orePct = Math.max(0, Math.min(100, Number(ore.percentage) || 0));
                    const oreValueText = ore.percentageText || `${orePct}%`;
                    const oreLabelAttr = ore.labelKey ? ` data-i18n="${escapeHTML(ore.labelKey)}"` : '';
                    const oreAlt = escapeHTML(ore.alt || ore.label || oreType);
                    const isOreMaxed = orePct >= 100;

                    const storageBarHtml = (typeof ore.storagePct === 'number' && ore.storagePct > 0)
                        ? `<div class="progress-bar-storage" style="width: ${Math.min(100, ore.storagePct)}%"></div>`
                        : '';

                    const fillClass = ORE_FILL_CLASSES[ore.type] || `${oreType}-fill`;

                    return `
                        <div class="profile-stat-box progress-box">
                            <div class="stat-box-header">
                                <span class="stat-box-label-wrapper">
                                    <clashcalc-assets-image class="ore-icon-mini" src="${escapeHTML(ore.icon)}" alt="${oreAlt}"></clashcalc-assets-image>
                                    <span class="stat-box-label"${oreLabelAttr}>${escapeHTML(ore.label)}</span>
                                </span>
                                <span class="stat-box-value" data-ore-value="${oreType}">${escapeHTML(oreValueText)}</span>
                            </div>
                            <div class="progress-bar-mini" data-ore="${oreType}">
                                ${storageBarHtml}
                                <div class="progress-bar-fill ${fillClass}${isOreMaxed ? ' maxed-fill' : ''}" data-bar-width="${orePct}%"></div>
                            </div>
                            ${ore.subtextHtml || ''}
                        </div>
                    `.trim();
                }).join('')}
            </div>
        `.trim()
        : '';

    return `
        <div class="home-profile-stats-container">
            <div class="home-profile-overall-progress${isMaxed ? ' fully-maxed' : ''}">
                <div class="overall-progress-header">
                    <span class="overall-progress-label-wrapper">
                        <clashcalc-assets-image class="ore-icon-overall" src="${escapeHTML(overall.icon)}" alt="${overallAlt}"></clashcalc-assets-image>
                        <span class="overall-progress-label"${overallLabelAttr}>${escapeHTML(overall.label)}</span>
                    </span>
                    <span class="overall-progress-value" data-ore-value="overall">${escapeHTML(overallValueText)}</span>
                </div>
                <div class="progress-bar-overall" data-ore="overall">
                    <div class="progress-bar-fill overall-fill${isMaxed ? ' maxed-fill' : ''}" data-bar-width="${overallPct}%"${overallBarStyle ? ` style="${overallBarStyle}"` : ''}></div>
                </div>
            </div>

            ${oreBoxesHtml}
            ${footerHtml || ''}
        </div>
    `.trim();
}
