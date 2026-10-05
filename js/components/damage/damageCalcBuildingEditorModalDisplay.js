/**
 * DOM Rendering Engine for Damage Calculator Building Level Editor Modal.
 * Tier 4: UI Presentation (Dedicated exclusively to modal dialog DOM rendering, 0 event listeners).
 */

import { getBuildingAssetUrl } from '../../core/buildingAssetHelper.js';
import {
    getDefenseMaxHp,
    getMaxSuperchargeTier,
    getDefaultSuperchargeTier,
    snapDefenseLevel,
    getValidDefenseLevels,
    isHeroDefense,
    partitionDefensesForModal,
    getMinDefenseLevel
} from '../../domain/damage/defenseProgressionDomain.js';
import { translate } from '../../i18n/translator.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { formatNumber } from '../../utils/numberFormatter.js';
import { pruneDefenseOverrides, getBuildingGroupSessionPreferences, isBuildingGroupEnabled, getShownTownHall } from './damageCalcState.js';
import {
    getDefenseDisplayName
} from '../../utils/equipmentMetadata.js';
import {
    getLvlShort,
    getHpUnit
} from './damageCalcDisplay.js';
import { renderSteppedSliderHtml } from '../common/steppedSlider.js';
import { renderTownHallDropdownHtml } from './damageCalcSourcesDisplay.js';

/**
 * Renders the Building Level Editor tab content inside the Edit Levels modal.
 *
 * @param {Object} state - Damage calculator state.
 * @param {HTMLElement} container - Target DOM container.
 * @param {HTMLElement | null} [controlsContainer] - Optional target container for sticky toolbar & search controls.
 * @param {Date|string|number} [referenceDate=new Date()] - Reference date for seasonal filtering.
 */
export function renderBuildingEditModal(state, container, controlsContainer = null, referenceDate = new Date()) {
    if (!container) return;

    const currentTH = getShownTownHall(state);
    const activeOverridesCount = pruneDefenseOverrides(state);
    const overrides = state.defenseLevelOverrides || {};
    const scOverrides = state.defenseSuperchargeOverrides || {};
    const hpUnit = getHpUnit();

    const partitionedGroups = partitionDefensesForModal(currentTH, referenceDate);
    const groupPrefs = getBuildingGroupSessionPreferences();

    const renderBuildingRow = ({ key, def, info }, groupId) => {
        const defDisplayName = getDefenseDisplayName(key);
        const isLocked = info?.status === 'locked';
        const isSunset = info?.status === 'sunset';
        const isUnavailable = isLocked || isSunset;
        const isGroupEnabled = isBuildingGroupEnabled(state, groupId);
        const isLevelSettingRestricted = isUnavailable || !isGroupEnabled;

        const maxLvl = def.maxLevel || 1;
        const maxAllowedLevel = (info?.status === 'available' && info.level > 0) ? info.level : maxLvl;
        const minLvl = getMinDefenseLevel(key);
        const currentLvl = overrides[key] !== undefined
            ? overrides[key]
            : (info?.level || maxLvl);
        const clampedLvl = snapDefenseLevel(key, currentLvl, maxAllowedLevel);

        const currentSupercharge = scOverrides[key] !== undefined
            ? scOverrides[key]
            : (clampedLvl >= maxLvl && currentTH >= 18 ? getDefaultSuperchargeTier(key, clampedLvl, currentTH) : 0);

        const maxSupercharge = getMaxSuperchargeTier(key, maxLvl);
        const currentHp = getDefenseMaxHp(key, clampedLvl, { superchargeTier: currentSupercharge });
        const assetSrc = getBuildingAssetUrl(key, clampedLvl);

        let statusBadge = '';
        if (isSunset) {
            statusBadge = `<span class="calc-building-status-tag is-sunset" data-i18n="views.damageCalc.offense.sunsetTag" data-i18n-args='{"th":${currentTH}}'>${escapeHTML(translate('views.damageCalc.offense.sunsetTag', { th: currentTH }))}</span>`;
        } else if (isLocked) {
            statusBadge = `<span class="calc-building-status-tag is-locked">${escapeHTML(translate('views.home.profile.locked'))}</span>`;
        } else if (currentTH < 18 && maxAllowedLevel < maxLvl) {
            const isAtMax = clampedLvl >= maxAllowedLevel;
            if (isAtMax) {
                const tagText = translate('views.damageCalc.offense.thMaxTag', { th: currentTH }) || `TH ${currentTH} Max`;
                statusBadge = `<span class="calc-building-status-tag is-th-max" data-status-tag="th-cap">${escapeHTML(tagText)}</span>`;
            }
        }

        let superchargeHtml = '';
        if (maxSupercharge > 0) {
            let scPills = '';
            const isScDisabled = isLevelSettingRestricted || currentLvl < maxLvl;
            for (let tier = 0; tier <= maxSupercharge; tier++) {
                const isSelected = tier === currentSupercharge;
                const tierLabel = tier === 0
                    ? `${translate('views.damageCalc.offense.superchargeLabel')}: ${translate('app.none')}`
                    : translate('views.damageCalc.zapQuake.tierLabel', { tier });

                const pipsHtml = tier === 0
                    ? `<orecalc-assets-image
                        src="/assets/supercharge/supercharge_uncharged.png"
                        alt="${escapeHTML(tierLabel)}"
                        size="thumbnail"
                        class="calc-supercharge-pip is-uncharged">
                    </orecalc-assets-image>`
                    : Array.from({ length: tier }, () => `
                        <orecalc-assets-image
                            src="/assets/supercharge/supercharge_bolt.png"
                            alt="${escapeHTML(tierLabel)}"
                            size="thumbnail"
                            class="calc-supercharge-pip is-charged">
                        </orecalc-assets-image>
                    `).join('');

                scPills += `
                    <button type="button"
                        class="calc-supercharge-pill ${isSelected && !isScDisabled ? 'active is-active' : ''} ${isScDisabled && tier === 0 ? 'active is-active' : ''}"
                        data-building-key="${key}"
                        data-tier="${tier}"
                        role="radio"
                        aria-checked="${isSelected}"
                        ${isScDisabled ? 'disabled' : ''}
                        title="${escapeHTML(tierLabel)}"
                        aria-label="${escapeHTML(tierLabel)}">
                        <span class="calc-supercharge-pips calc-supercharge-pips--compact">${pipsHtml}</span>
                    </button>
                `;
            }
            superchargeHtml = `
                <div class="calc-building-supercharge-wrap ${isScDisabled ? 'is-disabled' : ''}" id="modal-bldg-sc-wrap-${key}">
                    <div class="calc-supercharge-pills" role="radiogroup" aria-label="${escapeHTML(defDisplayName)} ${escapeHTML(translate('views.damageCalc.offense.superchargeLabel'))}">
                        ${scPills}
                    </div>
                </div>
            `;
        }

        const isHero = isHeroDefense(key);
        const heroTickValues = isHero ? getValidDefenseLevels(key, maxLvl) : null;

        return `
            <div class="calc-building-modal-row ${isUnavailable ? 'is-unavailable' : ''} ${isLevelSettingRestricted ? 'is-restricted' : ''}" data-building-key="${key}" data-building-name="${escapeHTML(defDisplayName.toLowerCase())}">
                <div class="calc-building-modal-row__header">
                    <div class="calc-building-modal-row__identity">
                        <orecalc-assets-image
                            src="${assetSrc}"
                            alt="${escapeHTML(defDisplayName)}"
                            class="calc-building-modal-row__thumb"
                            size="thumbnail">
                        </orecalc-assets-image>
                        <div class="calc-building-modal-row__meta">
                            <span class="calc-building-modal-row__name">${escapeHTML(defDisplayName)}</span>
                            ${statusBadge}
                        </div>
                    </div>
                    <div class="calc-building-modal-row__stats calc-building-stats">
                        <span class="calc-building-stat calc-building-stat--lvl" id="modal-bldg-lvl-${key}">${getLvlShort(key)} ${clampedLvl} / ${maxLvl}</span>
                        <span class="calc-building-stat-sep" aria-hidden="true">&middot;</span>
                        <span class="calc-building-stat calc-building-stat--hp" id="modal-bldg-hp-${key}">${formatNumber(currentHp)} ${hpUnit}</span>
                    </div>
                </div>
                <div class="calc-building-modal-row__controls">
                    <div class="calc-stepper-track">
                        <button type="button" class="calc-stepper-btn calc-stepper-btn--step" data-action="decrement" data-building-key="${key}" ${isLevelSettingRestricted || clampedLvl <= minLvl ? 'disabled' : ''} aria-label="${escapeHTML(translate('actions.decrease'))} ${escapeHTML(defDisplayName)} ${escapeHTML(translate('validation.level'))}">
                            <orecalc-assets-svg name="minus"></orecalc-assets-svg>
                        </button>
                        ${renderSteppedSliderHtml({
                            min: minLvl,
                            max: maxLvl,
                            maxAllowed: maxAllowedLevel,
                            value: clampedLvl,
                            className: 'building-level-slider',
                            dataAttributes: {
                                buildingKey: key,
                                maxAllowed: maxAllowedLevel
                            },
                            disabled: isLevelSettingRestricted,
                            ariaLabel: `${defDisplayName} ${translate('validation.level')}`,
                            withTicks: true,
                            tickValues: heroTickValues
                        })}
                        <button type="button" class="calc-stepper-btn calc-stepper-btn--step" data-action="increment" data-building-key="${key}" ${isLevelSettingRestricted || isUnavailable || clampedLvl >= maxAllowedLevel ? 'disabled' : ''} aria-label="${escapeHTML(translate('actions.increase'))} ${escapeHTML(defDisplayName)} ${escapeHTML(translate('validation.level'))}">
                            <orecalc-assets-svg name="plus"></orecalc-assets-svg>
                        </button>
                    </div>
                    ${superchargeHtml}
                </div>
            </div>
        `;
    };

    const groupDefinitions = [
        { id: 'defenses', titleKey: 'views.damageCalc.filters.filterDefenses' },
        { id: 'heroes', titleKey: 'views.damageCalc.filters.filterHeroes' },
        { id: 'guardians', titleKey: 'views.damageCalc.filters.filterGuardians' },
        { id: 'other', titleKey: 'views.damageCalc.filters.filterOther' },
        { id: 'unavailable', titleKey: 'views.damageCalc.filters.filterUnavailable' }
    ];

    let buildingGroupsHtml = '';
    for (const grp of groupDefinitions) {
        const items = partitionedGroups[grp.id] || [];
        if (items.length === 0) continue;

        const isExpanded = Boolean(groupPrefs[grp.id]);
        const groupRowsHtml = items.map(item => renderBuildingRow(item, grp.id)).join('');

        let toggleHtml = '';
        if (grp.id !== 'defenses') {
            const isGroupEnabled = isBuildingGroupEnabled(state, grp.id);
            const toggleLabel = escapeHTML(translate('views.damageCalc.zapQuake.showInPage'));
            toggleHtml = `
                <button type="button"
                    class="calc-building-group-switch ${isGroupEnabled ? 'is-active' : ''}"
                    data-group-switch="${grp.id}"
                    role="switch"
                    aria-checked="${isGroupEnabled}"
                    aria-label="${escapeHTML(translate(grp.titleKey))}: ${toggleLabel}">
                    <span class="calc-building-group-switch__label">${toggleLabel}</span>
                    <span class="calc-building-group-switch__track">
                        <span class="calc-building-group-switch__thumb"></span>
                    </span>
                </button>
            `;
        }

        buildingGroupsHtml += `
            <details class="calc-building-group" data-group-id="${grp.id}" ${isExpanded ? 'open' : ''}>
                <summary class="calc-building-group__summary">
                    <span class="calc-building-group__title">
                        <span data-i18n="${grp.titleKey}">${escapeHTML(translate(grp.titleKey))}</span>
                        <span class="calc-building-group__count">(${items.length})</span>
                    </span>
                    <div class="calc-building-group__summary-actions">
                        ${toggleHtml}
                        ${toggleHtml ? '<span class="calc-building-group__divider" aria-hidden="true"></span>' : ''}
                        <orecalc-assets-svg name="chevron-down" width="14" height="14" class="calc-building-group__chevron"></orecalc-assets-svg>
                    </div>
                </summary>
                <div class="calc-building-group__content">
                    ${groupRowsHtml}
                </div>
            </details>
        `;
    }

    let superchargeToolbarHtml = '';
    if (currentTH >= 18) {
        const activeGlobalSc = state.globalSuperchargeTier ?? (currentTH >= 18 ? 2 : 0);
        let scPillsHtml = '';
        for (let tier = 0; tier <= 2; tier++) {
            const isActive = activeGlobalSc === tier;
            const tierLabel = tier === 0
                ? `${translate('views.damageCalc.offense.superchargeLabel')}: ${translate('app.none')}`
                : translate('views.damageCalc.zapQuake.tierLabel', { tier });

            const pipsHtml = tier === 0
                ? `<orecalc-assets-image
                    src="/assets/supercharge/supercharge_uncharged.png"
                    alt="${escapeHTML(tierLabel)}"
                    size="thumbnail"
                    class="calc-supercharge-pip is-uncharged">
                </orecalc-assets-image>`
                : Array.from({ length: tier }, () => `
                    <orecalc-assets-image
                        src="/assets/supercharge/supercharge_bolt.png"
                        alt="${escapeHTML(tierLabel)}"
                        size="thumbnail"
                        class="calc-supercharge-pip is-charged">
                    </orecalc-assets-image>
                `).join('');

            scPillsHtml += `
                <button type="button"
                    class="calc-supercharge-pill ${isActive ? 'active is-active' : ''}"
                    data-toolbar-supercharge="${tier}"
                    role="radio"
                    aria-checked="${isActive}"
                    title="${escapeHTML(tierLabel)}"
                    aria-label="${escapeHTML(tierLabel)}">
                    <span class="calc-supercharge-pips calc-supercharge-pips--compact">${pipsHtml}</span>
                </button>
            `;
        }

        superchargeToolbarHtml = `
            <div class="calc-toolbar-supercharge" role="radiogroup" aria-label="${escapeHTML(translate('views.damageCalc.offense.superchargeLabel'))}">
                <div class="calc-supercharge-pills">
                    ${scPillsHtml}
                </div>
            </div>
        `;
    }

    const overridesBadgeText = translate('views.damageCalc.clusterPlanner.overridesCount', { count: activeOverridesCount });

    const toolbarHtml = `
        <div class="calc-building-toolbar">
            <div class="calc-th-preset-group">
                ${renderTownHallDropdownHtml(currentTH)}
                ${superchargeToolbarHtml}
            </div>
            <div class="calc-building-toolbar-actions">
                <button type="button" id="calc-building-apply-th-btn" class="calc-toolbar-btn" data-i18n="views.damageCalc.offense.setToThMax">
                    ${escapeHTML(translate('views.damageCalc.offense.setToThMax'))}
                </button>
                <button type="button" id="calc-building-reset-btn" class="calc-toolbar-btn" ${activeOverridesCount === 0 ? 'disabled' : ''} data-i18n="views.damageCalc.clusterPlanner.resetAllOverrides">
                    ${escapeHTML(translate('views.damageCalc.clusterPlanner.resetAllOverrides'))}
                </button>
            </div>
            <div class="calc-building-overrides-badge ${activeOverridesCount > 0 ? 'is-active' : ''}" id="calc-building-overrides-badge">
                ${escapeHTML(overridesBadgeText)}
            </div>
        </div>
        <div class="calc-building-search-wrap">
            <orecalc-assets-svg name="search" class="calc-search-icon" width="14" height="14" aria-hidden="true"></orecalc-assets-svg>
            <input type="search" id="calc-building-search" class="calc-building-search-input" placeholder="${escapeHTML(translate('views.damageCalc.filters.searchDefensesPlaceholder'))}" aria-label="${escapeHTML(translate('views.damageCalc.filters.searchDefensesPlaceholder'))}" autocomplete="off">
            <button type="button" class="calc-search-clear-btn is-hidden" id="calc-building-search-clear-btn" data-action="clear-defense-search-input" aria-label="${escapeHTML(translate('views.heroJourney.page.clearSearch'))}">
                <orecalc-assets-svg name="close" width="12" height="12"></orecalc-assets-svg>
            </button>
        </div>
    `;

    const listHtml = `
        <div class="calc-building-list" id="calc-building-list">
            ${buildingGroupsHtml}
        </div>
        <div class="calc-building-empty-search is-hidden" id="calc-building-empty-search">
            <span data-i18n="views.damageCalc.filters.noDefensesFound">${escapeHTML(translate('views.damageCalc.filters.noDefensesFound'))}</span>
            <button type="button" class="btn-secondary calc-empty-notice__btn" id="calc-building-clear-search-btn" data-action="clear-defense-search">
                <orecalc-assets-svg name="close" width="12" height="12"></orecalc-assets-svg>
                <span data-i18n="views.heroJourney.page.clearSearch">${escapeHTML(translate('views.heroJourney.page.clearSearch'))}</span>
            </button>
        </div>
    `;

    if (controlsContainer) {
        controlsContainer.innerHTML = toolbarHtml;
        container.innerHTML = `
            <div class="calc-building-editor">
                ${listHtml}
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="calc-building-editor">
                ${toolbarHtml}
                ${listHtml}
            </div>
        `;
    }
}
