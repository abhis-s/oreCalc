import { EQUIPMENT_STATS_LAST_UPDATED, getEquipmentMaxLevel } from '../../data/equipmentCommonData.js';
import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';

import { formatRegionalDate } from '../../domain/equipment/modifierCalculator.js';
import { toCamelCase } from '../../utils/stringUtils.js';

const MODIFIER_KEYS = ['standard', 'legend3', 'legend2', 'legend1', 'esports'];

/**
 * Updates sliding modifier tab pill indicator position.
 *
 * @param {HTMLElement | null} modifierTabsContainer
 * @param {string} [activeModifierTab]
 * @param {boolean} [isInstant=false]
 */
export function updateTabIndicator(modifierTabsContainer, activeModifierTab = null, isInstant = false) {
    if (!modifierTabsContainer || typeof modifierTabsContainer.querySelector !== 'function') return;
    const indicator = modifierTabsContainer.querySelector('.mod-tab-indicator');
    if (!indicator) return;

    if (activeModifierTab && modifierTabsContainer.dataset) {
        modifierTabsContainer.dataset.activeKey = activeModifierTab;
    }

    const keyToFind = activeModifierTab || modifierTabsContainer.dataset?.activeKey;
    const activeBtn = keyToFind
        ? /** @type {HTMLElement | null} */ (modifierTabsContainer.querySelector(`.mod-tab-btn[data-mod-key="${keyToFind}"]`))
        : /** @type {HTMLElement | null} */ (modifierTabsContainer.querySelector('.mod-tab-btn.active'));

    if (activeBtn) {
        const left = activeBtn.offsetLeft;
        const width = activeBtn.offsetWidth;

        if (width === 0) {
            requestAnimationFrame(() => {
                updateTabIndicator(modifierTabsContainer, keyToFind, isInstant);
            });
            return;
        }

        if (isInstant) {
            /** @type {HTMLElement} */ (indicator).style.transition = 'none';
            /** @type {HTMLElement} */ (indicator).style.transform = `translateX(${left}px)`;
            /** @type {HTMLElement} */ (indicator).style.width = `${width}px`;
            void indicator.offsetHeight;
            /** @type {HTMLElement} */ (indicator).style.transition = '';
        } else {
            /** @type {HTMLElement} */ (indicator).style.transform = `translateX(${left}px)`;
            /** @type {HTMLElement} */ (indicator).style.width = `${width}px`;
        }
    }
}

/**
 * Renders the modifier tab bar and hooks resize observation.
 *
 * @param {HTMLElement | null} modifierTabsContainer
 * @param {boolean} hasValidLevels
 * @param {boolean} hasStatsMeta
 * @param {string} activeModifierTab
 * @param {(modKey: string) => void} onTabSelect
 */
export function renderModifierTabs(modifierTabsContainer, hasValidLevels, hasStatsMeta, activeModifierTab, onTabSelect) {
    if (!modifierTabsContainer) return;
    if (!hasValidLevels || !hasStatsMeta) {
        modifierTabsContainer.style.display = 'none';
        modifierTabsContainer.innerHTML = '';
        return;
    }

    modifierTabsContainer.style.display = 'inline-flex';
    modifierTabsContainer.dataset.activeKey = activeModifierTab;
    let html = '<div class="mod-tab-indicator"></div>';
    for (const mKey of MODIFIER_KEYS) {
        const label = translate(`views.equipment.modifiers.${mKey}`);
        const activeClass = mKey === activeModifierTab ? 'active' : '';
        html += `<button type="button" class="mod-tab-btn ${activeClass}" data-mod-key="${mKey}" data-i18n="views.equipment.modifiers.${mKey}">${label}</button>`;
    }
    modifierTabsContainer.innerHTML = html;

    if (/** @type {any} */ (modifierTabsContainer).__windowResizeHandler) {
        window.removeEventListener('resize', /** @type {any} */ (modifierTabsContainer).__windowResizeHandler);
        /** @type {any} */ (modifierTabsContainer).__windowResizeHandler = null;
    }
    if (/** @type {any} */ (modifierTabsContainer).__resizeObserver) {
        /** @type {any} */ (modifierTabsContainer).__resizeObserver.disconnect();
        /** @type {any} */ (modifierTabsContainer).__resizeObserver = null;
    }

    const handleResize = () => {
        requestAnimationFrame(() => updateTabIndicator(modifierTabsContainer, null, false));
    };

    if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => handleResize());
        ro.observe(modifierTabsContainer);
        /** @type {any} */ (modifierTabsContainer).__resizeObserver = ro;
    } else {
        /** @type {any} */ (modifierTabsContainer).__windowResizeHandler = handleResize;
        window.addEventListener('resize', handleResize);
    }

    requestAnimationFrame(() => {
        updateTabIndicator(modifierTabsContainer, activeModifierTab, true);
        const activeBtn = modifierTabsContainer.querySelector('.mod-tab-btn.active');
        if (activeBtn) {
            activeBtn.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
        }
    });

    modifierTabsContainer.querySelectorAll('.mod-tab-btn').forEach(btn => {
        /** @type {HTMLElement} */ (btn).onclick = () => {
            const newKey = /** @type {HTMLElement} */ (btn).dataset.modKey;
            if (newKey) onTabSelect(newKey);
        };
    });
}

/**
 * Renders modal header elements (hero emblem, item image, title, badges).
 *
 * @param {HTMLElement} modal
 * @param {Object | null} data
 * @param {string} equipmentName
 * @param {Object | null} heroInfo
 * @param {Object | null} equipInfo
 * @param {string} equipmentRarity
 * @param {string} equipmentType
 */
export function renderModalHeader(modal, data, equipmentName, heroInfo, equipInfo, equipmentRarity, equipmentType) {
    const heroEmblem = /** @type {HTMLImageElement | null} */ (document.getElementById('eq-details-hero-emblem'));
    const itemImg = /** @type {HTMLImageElement | null} */ (document.getElementById('eq-details-item-img'));
    const titleEl = document.getElementById('eq-details-title');
    const descEl = document.getElementById('eq-details-desc');
    const typeBadge = document.getElementById('eq-details-type-badge');
    const rarityBadge = document.getElementById('eq-details-rarity-badge');

    const heroImageSrc = (heroInfo && heroInfo.emblem) ? heroInfo.emblem : (data?.heroImage || (heroInfo ? heroInfo.image : ''));
    const equipImageSrc = data?.equipmentImage || (equipInfo ? equipInfo.image : '');
    const effectiveRarity = data?.rarity || equipmentRarity || 'Common';
    const effectiveType = data?.type || equipmentType || 'Active';

    const translatedTitle = translate(`entities.equipment.${toCamelCase(data?.id || equipmentName)}`);
    const translatedRarity = translate(`views.equipment.${effectiveRarity.toLowerCase()}`);
    const translatedType = translate(`views.equipment.${effectiveType.toLowerCase()}`);
    const heroEquipFallbackText = translate('views.equipment.heroEquipment');

    if (heroEmblem && heroImageSrc) heroEmblem.src = heroImageSrc;
    if (itemImg && equipImageSrc) itemImg.src = equipImageSrc;
    if (titleEl) titleEl.textContent = translatedTitle;
    if (descEl) descEl.textContent = heroEquipFallbackText;

    if (typeBadge) {
        if (data?.type) {
            typeBadge.style.display = '';
            typeBadge.textContent = translatedType;
            typeBadge.className = `eq-badge badge-${effectiveType.toLowerCase()}`;
            typeBadge.setAttribute('data-info', effectiveType.toLowerCase() === 'active' ? 'views.equipment.badgeActiveHelp' : 'views.equipment.badgePassiveHelp');
        } else {
            typeBadge.style.display = 'none';
        }
    }
    if (rarityBadge) {
        rarityBadge.style.display = '';
        rarityBadge.textContent = translatedRarity;
        rarityBadge.className = `eq-badge badge-${effectiveRarity.toLowerCase()}`;
        rarityBadge.setAttribute('data-info', 'views.equipment.badgeRarityHelp');
        rarityBadge.setAttribute('data-info-rarity', translatedRarity);
    }
}

/**
 * Renders modal footer metadata (last updated, bug reporting, attribution).
 *
 * @param {HTMLElement | null} footerMetaElem
 */
export function renderFooterMeta(footerMetaElem) {
    if (!footerMetaElem) return;
    footerMetaElem.style.display = '';
    const formattedDate = formatRegionalDate(EQUIPMENT_STATS_LAST_UPDATED, state.uiSettings?.language);
    const dateText = translate('views.equipment.statsLastUpdated', { date: formattedDate });
    const reportText = translate('views.equipment.reportInaccuracies');
    const attributionText = translate('views.equipment.detailsAttribution');
    footerMetaElem.innerHTML = `
        <div class="eq-details-footer-top-row">
            <span class="eq-details-report-inaccuracies">${reportText}</span>
            <span class="eq-details-last-updated">${dateText}</span>
        </div>
        <div class="eq-details-attribution-row">${attributionText}</div>
    `;
}

/**
 * Renders empty or data-unavailable fallback state in modal.
 *
 * @param {HTMLElement} modal
 * @param {string} equipmentName
 * @param {string} equipmentRarity
 * @param {string} equipmentType
 * @param {number} currentLevel
 * @param {Object | null} [data]
 */
export function renderEmptyState(modal, equipmentName, equipmentRarity, equipmentType, currentLevel, data = null) {
    const itemImg = document.getElementById('eq-details-item-img');
    const titleEl = document.getElementById('eq-details-title');
    const descEl = document.getElementById('eq-details-desc');
    const typeBadge = document.getElementById('eq-details-type-badge');
    const rarityBadge = document.getElementById('eq-details-rarity-badge');
    const emptyStateContainer = document.getElementById('eq-details-empty-state-container');
    const contentWrapper = document.getElementById('eq-details-content-wrapper');
    const modifierTabsContainer = document.getElementById('eq-details-modifier-tabs');
    const propsGrid = document.getElementById('eq-details-props-grid');
    const recBannerContainer = document.getElementById('eq-details-rec-banner-container');
    const staticStatsContent = document.getElementById('eq-details-static-stats-content');
    const unitStatsContent = document.getElementById('eq-details-unit-stats-content');
    const unitStatsToggleBtn = document.getElementById('eq-unit-stats-toggle-btn');
    const boxesRow = /** @type {HTMLElement | null} */ (modal.querySelector('.eq-details-boxes-row'));
    const staticBox = document.getElementById('eq-details-static-box');
    const currentLvlBox = /** @type {HTMLElement | null} */ (modal.querySelector('.eq-details-current-level-box'));
    const lvlHeaderLabel = document.getElementById('eq-details-lvl-header-label');
    const currentLvlText = document.getElementById('eq-details-current-lvl-text');
    const maxLvlText = document.getElementById('eq-details-max-lvl-text');
    const progressList = document.getElementById('eq-details-stats-progress-list');
    const tableWrapper = /** @type {HTMLElement | null} */ (modal.querySelector('.eq-details-table-wrapper'));
    const footerMetaElem = /** @type {HTMLElement | null} */ (modal.querySelector('#eq-details-footer-meta'));

    if (itemImg) itemImg.classList.add('is-data-unavailable');
    const fallbackTitle = translate(`entities.equipment.${toCamelCase(equipmentName)}`);
    const dataNotAvailableTitle = translate('views.equipment.dataNotAvailable');
    const dataNotAvailableDesc = translate('views.equipment.detailsNotAvailableDesc');
    const contributeText = translate('views.equipment.contributeMissingData');
    const translatedRarity = translate(`views.equipment.${equipmentRarity.toLowerCase()}`);

    if (titleEl) titleEl.textContent = fallbackTitle;
    if (descEl) descEl.textContent = translate('views.equipment.heroEquipment');
    if (typeBadge) typeBadge.style.display = 'none';

    if (rarityBadge) {
        rarityBadge.style.display = '';
        rarityBadge.textContent = translatedRarity;
        rarityBadge.className = `eq-badge badge-${equipmentRarity.toLowerCase()}`;
        rarityBadge.setAttribute('data-info', 'views.equipment.badgeRarityHelp');
        rarityBadge.setAttribute('data-info-rarity', translatedRarity);
    }

    const recBadge = document.getElementById('eq-details-rec-badge');
    if (recBadge) {
        recBadge.style.display = 'inline-flex';
        recBadge.className = 'eq-badge badge-unreleased';
        recBadge.innerHTML = `<orecalc-assets-svg name="sparkles" class="badge-icon"></orecalc-assets-svg> <span>${translate('views.equipment.unreleased')}</span>`;
        recBadge.setAttribute('data-info', 'views.equipment.recUnreleasedHelp');
    }

    if (contentWrapper) contentWrapper.style.display = '';
    if (propsGrid) propsGrid.style.display = 'none';
    if (recBannerContainer) recBannerContainer.innerHTML = '';
    if (modifierTabsContainer) {
        modifierTabsContainer.style.display = 'none';
        modifierTabsContainer.innerHTML = '';
    }
    if (staticStatsContent) {
        staticStatsContent.style.display = 'none';
        staticStatsContent.innerHTML = '';
    }
    if (unitStatsContent) {
        unitStatsContent.style.display = 'none';
        unitStatsContent.innerHTML = '';
    }
    if (unitStatsToggleBtn) unitStatsToggleBtn.style.display = 'none';
    if (boxesRow) boxesRow.style.display = 'flex';
    if (staticBox) staticBox.style.display = 'block';
    if (currentLvlBox) currentLvlBox.style.display = 'block';

    const calculatedMaxLevel = getEquipmentMaxLevel(equipmentRarity);
    if (lvlHeaderLabel) {
        lvlHeaderLabel.textContent = translate('validation.level');
        lvlHeaderLabel.dataset.i18n = 'validation.level';
    }
    if (currentLvlText) {
        currentLvlText.textContent = String((currentLevel && currentLevel > 1) ? currentLevel : '-');
    }
    if (maxLvlText) {
        const prefix = translate('views.equipment.maxLevel');
        maxLvlText.innerHTML = `<span data-i18n="views.equipment.maxLevel">${prefix}</span> <strong>${calculatedMaxLevel}</strong>`;
    }

    if (progressList) {
        const metaList = (data && data.statsMeta && data.statsMeta.length > 0) ? data.statsMeta : null;
        let barsHTML = '';
        if (metaList) {
            barsHTML = metaList.map(meta => {
                const statLabel = translate(`entities.stats.${meta.key}`);
                return `
                    <div class="stat-progress-row">
                        <div class="stat-label-line">
                            <span class="stat-name" title="${statLabel}"><span class="stat-name-text" data-i18n="entities.stats.${meta.key}">${statLabel}</span></span>
                            <span class="stat-val"><span class="stat-val-number">-</span></span>
                        </div>
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill" style="width: 0%;"></div>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            const notAvailableLabel = translate('views.equipment.dataNotAvailable');
            for (let i = 0; i < 3; i++) {
                barsHTML += `
                    <div class="stat-progress-row">
                        <div class="stat-label-line">
                            <span class="stat-name" title="${notAvailableLabel}"><span class="stat-name-text" data-i18n="views.equipment.dataNotAvailable">${notAvailableLabel}</span></span>
                            <span class="stat-val"><span class="stat-val-number">-</span></span>
                        </div>
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill" style="width: 0%;"></div>
                        </div>
                    </div>
                `;
            }
        }
        progressList.innerHTML = barsHTML;
    }

    if (tableWrapper) tableWrapper.style.display = 'none';

    if (emptyStateContainer) {
        emptyStateContainer.style.display = 'block';
        emptyStateContainer.innerHTML = `
            <div class="eq-details-empty-state">
                <div class="empty-state-icon">
                    <orecalc-assets-svg name="close"></orecalc-assets-svg>
                </div>
                <h3 data-i18n="views.equipment.dataNotAvailable">${dataNotAvailableTitle}</h3>
                <p data-i18n="views.equipment.detailsNotAvailableDesc">${dataNotAvailableDesc}</p>
                <p class="empty-state-contribute"><em data-i18n="views.equipment.contributeMissingData">${contributeText}</em></p>
            </div>
        `;
    }

    if (footerMetaElem) renderFooterMeta(footerMetaElem);
    modal.classList.add('show');
}
