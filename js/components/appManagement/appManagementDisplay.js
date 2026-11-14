/**
 * App Management Display Controller.
 * Handles pure DOM presentation for the App Management route.
 * Tier 4: Presentation Module.
 */

import { translate } from '../../i18n/translator.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { STARTUP_ROUTE_OPTIONS } from '../../services/appManagementService.js';
import { state } from '../../core/state.js';

/**
 * Builds localized composite label for sub-views using canonical brand name.
 *
 * @param {string} subViewKey
 * @returns {string}
 */
export function formatStartupSubViewLabel(subViewKey) {
    const brandName = translate('app.brandToolName');
    const subView = translate(subViewKey);
    return translate('views.appManagement.startupViews.compositeLabel', {
        tool: brandName,
        subView
    });
}

/**
 * Returns localized label descriptor for each startup destination.
 *
 * @param {string} routeId
 * @returns {string}
 */
export function getStartupOptionLabel(routeId) {
    switch (routeId) {
        case 'hub':
            return translate('nav.dock.hub');
        case 'ore-calc':
            return translate('app.brandToolName');
        case 'ore-calc-equipment':
            return formatStartupSubViewLabel('nav.equipment');
        case 'ore-calc-income':
            return formatStartupSubViewLabel('nav.income');
        case 'ore-calc-planner':
            return formatStartupSubViewLabel('nav.planner');
        case 'damage-calc-zapquake':
            return translate('views.damageCalc.tabs.zapQuake');
        case 'damage-calc-cluster':
            return translate('views.damageCalc.tabs.clusterPlanner');
        case 'hero-journey':
            return translate('views.heroJourney.widget.title');
        default:
            return routeId;
    }
}

/**
 * Populates the startup view selection element.
 *
 * @param {HTMLSelectElement} selectEl
 * @param {string} currentRoute
 */
export function renderStartupOptions(selectEl, currentRoute) {
    if (!selectEl) return;

    selectEl.innerHTML = '';
    for (const opt of STARTUP_ROUTE_OPTIONS) {
        const optionEl = document.createElement('option');
        optionEl.value = opt.route;
        optionEl.textContent = getStartupOptionLabel(opt.id);
        if (opt.route === currentRoute) {
            optionEl.selected = true;
        }
        selectEl.appendChild(optionEl);
    }
}

/**
 * Renders the application storage footprint.
 *
 * @param {HTMLElement} targetEl
 * @param {string|null} formattedSize
 */
export function renderStorageUsage(targetEl, formattedSize) {
    if (!targetEl) return;
    if (formattedSize) {
        targetEl.textContent = translate('views.appManagement.storage.appUsage', { size: formattedSize });
    } else {
        targetEl.textContent = translate('views.appManagement.storage.unavailable');
    }
}

/**
 * Renders environment diagnostic data cleanly.
 *
 * @param {HTMLElement} containerEl
 * @param {Object} diagnostics
 */
export function renderDiagnostics(containerEl, diagnostics) {
    if (!containerEl || !diagnostics) return;

    const networkLabel = diagnostics.isOnline
        ? translate('status.online')
        : translate('status.offline');

    const viewportVal = diagnostics.viewport || 'Unknown';
    const displayModeLabel = (diagnostics.displayMode === 'standalone' || diagnostics.displayMode === 'window-controls-overlay')
        ? translate('views.appManagement.diagnostics.modeStandalone')
        : translate('views.appManagement.diagnostics.modeBrowser');

    const items = [
        { id: '', labelKey: 'views.appManagement.diagnostics.platform', value: diagnostics.platform },
        { id: '', labelKey: 'views.appManagement.diagnostics.engine', value: diagnostics.engine },
        { id: '', labelKey: 'views.appManagement.diagnostics.displayMode', value: displayModeLabel },
        { id: 'app-diag-viewport', labelKey: 'views.appManagement.diagnostics.viewport', value: viewportVal }
    ];

    const networkModifier = diagnostics.isOnline ? 'status-indicator--online' : 'status-indicator--offline';

    containerEl.innerHTML = items.map(item => `
        <div class="management-item-row">
            <div class="management-item-info">
                <span class="management-item-title" data-i18n="${item.labelKey}">${escapeHTML(translate(item.labelKey))}</span>
            </div>
            <div class="management-item-actions">
                <span class="management-item-value"${item.id ? ` id="${item.id}"` : ''}>${escapeHTML(item.value)}</span>
            </div>
        </div>
    `).join('') + `
        <div class="management-item-row">
            <div class="management-item-info">
                <span class="management-item-title" data-i18n="views.appManagement.diagnostics.network">${escapeHTML(translate('views.appManagement.diagnostics.network'))}</span>
            </div>
            <div class="management-item-actions">
                <span class="status-indicator ${networkModifier}" id="app-diag-network-status">${escapeHTML(networkLabel)}</span>
            </div>
        </div>
    `;
}

/**
 * Formats client diagnostics into a clean markdown report (excluding storage metrics).
 *
 * @param {Object} diagnostics
 * @param {string} version
 * @returns {string} Formatted markdown report
 */
export function formatDiagnosticsReport(diagnostics, version) {
    const lines = [
        '### ClashCalc Diagnostics Report',
        `- **App Version**: ${version || 'Unknown'}`,
        `- **Operating System**: ${diagnostics?.platform || 'Unknown'}`,
        `- **Browser Engine**: ${diagnostics?.engine || 'Unknown'}`,
        `- **Display Mode**: ${diagnostics?.displayMode || 'Unknown'}`,
        `- **Window Viewport**: ${diagnostics?.viewport || 'Unknown'}`,
        `- **Network Status**: ${diagnostics?.isOnline ? 'Online' : 'Offline'}`
    ];
    return lines.join('\n');
}

/**
 * Returns formatted application version string from build metadata or fallback.
 * @returns {string}
 */
export function getAppVersionString() {
    const envVersion = typeof window !== 'undefined' ? (window.__ENV__?.APP_VERSION || window.__BUILD_VERSION__) : null;
    const metaBuild = typeof document !== 'undefined' ? document.querySelector('meta[name="build-version"]')?.getAttribute('content') : null;
    const version = envVersion || metaBuild || state.appVersion || '3.1.0';
    return 'v' + String(version).replace(/^v/, '');
}

/**
 * @typedef {'idle' | 'checking' | 'downloading' | 'installing' | 'up-to-date' | 'installed'} UpdateLifecycleState
 */

/**
 * Renders the reactive Updates & Lifecycle card row.
 *
 * @param {HTMLElement} rowEl
 * @param {UpdateLifecycleState} [updateState='idle']
 * @param {boolean} [isStandalone=false]
 */
export function renderUpdateLifecycle(rowEl, updateState = 'idle', isStandalone = false) {
    if (!rowEl) return;

    const titleEl = /** @type {HTMLElement|null} */ (rowEl.querySelector('#app-lifecycle-title'));
    const descEl = /** @type {HTMLElement|null} */ (rowEl.querySelector('#app-lifecycle-desc'));
    const btnEl = /** @type {HTMLButtonElement|null} */ (rowEl.querySelector('#app-check-update-btn'));
    if (!titleEl || !descEl || !btnEl) return;

    const versionStr = getAppVersionString();
    const isInstalled = updateState === 'installed';

    rowEl.classList.toggle('management-item-row--update', isInstalled);

    if (isInstalled) {
        titleEl.textContent = translate('views.settings.bugReport.updateAvailableTitle');
        descEl.textContent = translate('views.settings.bugReport.updateAvailableDesc');
        btnEl.disabled = false;
        btnEl.className = 'btn btn--primary';
        btnEl.innerHTML = `
            <clashcalc-assets-svg name="update" width="16" height="16" aria-hidden="true"></clashcalc-assets-svg>
            <span id="app-check-update-btn-text">${escapeHTML(translate('views.settings.bugReport.updateNowLabel'))}</span>
        `;
        return;
    }

    titleEl.innerHTML = `${escapeHTML(translate('app.version'))} <code class="management-version-tag" id="app-lifecycle-version">${escapeHTML(versionStr)}</code>`;
    btnEl.className = 'btn btn--secondary';

    switch (updateState) {
        case 'checking':
            descEl.textContent = translate('status.checking');
            btnEl.disabled = true;
            btnEl.innerHTML = `<span id="app-check-update-btn-text">${escapeHTML(translate('status.checking'))}</span>`;
            break;
        case 'downloading':
            descEl.textContent = translate('status.downloading');
            btnEl.disabled = true;
            btnEl.innerHTML = `<span id="app-check-update-btn-text">${escapeHTML(translate('status.downloading'))}</span>`;
            break;
        case 'installing':
            descEl.textContent = translate('status.installing');
            btnEl.disabled = true;
            btnEl.innerHTML = `<span id="app-check-update-btn-text">${escapeHTML(translate('status.installing'))}</span>`;
            break;
        case 'idle':
            descEl.textContent = isStandalone
                ? translate('views.appManagement.lifecycle.standaloneDesc')
                : translate('views.appManagement.lifecycle.browserDesc');
            btnEl.disabled = false;
            btnEl.innerHTML = `<span id="app-check-update-btn-text">${escapeHTML(translate('actions.checkUpdates'))}</span>`;
            break;
        case 'up-to-date':
        default:
            descEl.textContent = translate('status.upToDate');
            btnEl.disabled = updateState === 'up-to-date';
            btnEl.innerHTML = `<span id="app-check-update-btn-text">${escapeHTML(
                updateState === 'up-to-date'
                    ? translate('status.upToDate')
                    : translate('actions.checkUpdates')
            )}</span>`;
            break;
    }
}

/**
 * Renders window viewport dimensions in the diagnostics card.
 * @param {HTMLElement|null} targetEl
 * @param {number} width
 * @param {number} height
 */
export function renderViewportDimensions(targetEl, width, height) {
    if (!targetEl) return;
    targetEl.textContent = `${width || 0} x ${height || 0}`;
}

/**
 * Renders online/offline status in the diagnostics card.
 * @param {HTMLElement|null} targetEl
 * @param {boolean} isOnline
 */
export function renderNetworkStatus(targetEl, isOnline) {
    if (!targetEl) return;
    targetEl.className = `status-indicator ${isOnline ? 'status-indicator--online' : 'status-indicator--offline'}`;
    targetEl.textContent = isOnline
        ? translate('status.online')
        : translate('status.offline');
}
