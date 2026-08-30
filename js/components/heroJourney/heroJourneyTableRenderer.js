import { translate } from '../../i18n/translator.js';
import { formatNumber } from '../../utils/numberFormatter.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { getSVG } from '../../utils/svgManager.js';
import { getNodeTownHallLevel } from '../../domain/income/heroJourneyLevels.js';
import { getEffectiveQuestNodeTH, getQuestChestReward } from '../../domain/income/heroJourneyIncome.js';
import { getResolvedEquipmentReward, resolveHeroJourneyTrack } from '../../domain/income/heroJourneyResolution.js';
import { getTranslatedEquipmentName, getResourceKey } from '../home/heroJourneyPopovers.js';
import { hjState, buildStateFromPlayerData } from './heroJourneyState.js';
import { getFilteredNodes, syncClaimSwitchPill } from './heroJourneyTrackRenderer.js';

/**
 * Resolves node display metadata for table rows without artificial badges.
 * @param {Object} node - Hero journey node.
 * @param {Record<number, any> | null} [trackResolution=null] - Precalculated track resolution.
 * @param {any} [state=null] - State object.
 * @returns {{ name: string, nameHtml?: string | null, icon: string, yieldHtml: string }}
 */
function getTableNodeDetails(node, trackResolution = null, state = null) {
    let name = translate('views.heroJourneyPage.milestoneReward') || 'Milestone Reward';
    let icon = (node.icon || 'assets/shiny_ore.png').replace(/^\//, '');
    let yieldHtml = '—';

    const activeState = state || buildStateFromPlayerData(hjState.playerData, hjState);
    const nodeTH = getNodeTownHallLevel(node.level);
    const effectiveTH = getEffectiveQuestNodeTH(node, activeState);
    const mode = hjState.isAccelerated ? 'accelerated' : 'normal';
    const chest = getQuestChestReward(effectiveTH, mode);

    let boostIcon = '';
    if (mode === 'accelerated') {
        boostIcon = getSVG('chevron-double-up', 'ore-accel-arrow-icon', 13, 13);
    } else if (effectiveTH > nodeTH) {
        boostIcon = getSVG('chevron-up', 'ore-th-boost-icon', 13, 13);
    }

    if (node.type === 'quest') {
        const questTargetName = node.equipmentKey
            ? translate(`entities.equipment.${node.equipmentKey}`)
            : (node.hero ? translate(`entities.heroes.${node.hero}`) : translate('views.home.heroJourney.heroFallback'));
        name = translate('views.home.heroJourney.questTitleFormat', { name: questTargetName });
        icon = 'assets/heroJourney/chest_ore.png';
        const shinyLabel = escapeHTML(translate('entities.ores.shiny'));
        const glowyLabel = escapeHTML(translate('entities.ores.glowy'));
        const starryLabel = escapeHTML(translate('entities.ores.starry'));
        yieldHtml = `
            <div class="table-ore-yield-group">
                <span class="table-ore-item" title="${formatNumber(chest.shiny)} ${shinyLabel}">
                    <span class="ore-boost-icon-slot">${boostIcon}</span>
                    <span class="table-ore-amount">${formatNumber(chest.shiny)}</span>
                    <orecalc-assets-image src="assets/shiny_ore.png" alt="${shinyLabel}" class="table-ore-icon" size="thumbnail"></orecalc-assets-image>
                </span>
                <span class="table-ore-item" title="${formatNumber(chest.glowy)} ${glowyLabel}">
                    <span class="ore-boost-icon-slot">${boostIcon}</span>
                    <span class="table-ore-amount">${formatNumber(chest.glowy)}</span>
                    <orecalc-assets-image src="assets/glowy_ore.png" alt="${glowyLabel}" class="table-ore-icon" size="thumbnail"></orecalc-assets-image>
                </span>
                <span class="table-ore-item" title="${formatNumber(chest.starry)} ${starryLabel}">
                    <span class="ore-boost-icon-slot">${boostIcon}</span>
                    <span class="table-ore-amount">${formatNumber(chest.starry)}</span>
                    <orecalc-assets-image src="assets/starry_ore.png" alt="${starryLabel}" class="table-ore-icon" size="thumbnail"></orecalc-assets-image>
                </span>
            </div>
        `.trim();
    } else if (node.type === 'ore') {
        const oreName = translate(`entities.ores.${node.resourceType}`) || `${node.resourceType} Ore`;
        name = `${formatNumber(node.amount)} ${oreName}`;
        const nameHtml = `${formatNumber(node.amount)} <span class="ore-text-${node.resourceType}">${escapeHTML(oreName)}</span>`;
        icon = (node.icon || `assets/${node.resourceType}_ore.png`).replace(/^\//, '');
        yieldHtml = '—';
        return { name, nameHtml, icon, yieldHtml };
    } else if (node.type === 'equipment') {
        const resolvedNode = trackResolution?.[node.level] || getResolvedEquipmentReward(node, activeState);
        name = resolvedNode.isFallbackStarry
            ? `${resolvedNode.fallbackStarry || 50} ${translate('entities.ores.starry')}`
            : getTranslatedEquipmentName(resolvedNode.resolvedKey || resolvedNode.resolvedName);
        icon = (resolvedNode.resolvedIcon || node.icon || 'assets/heroes/emblemBarbarianKing.png').replace(/^\//, '');
        if (resolvedNode.isFallbackStarry) {
            const starryLabel = escapeHTML(translate('entities.ores.starry'));
            const fallbackLabel = escapeHTML(translate('views.home.heroJourney.fallbackLabel'));
            yieldHtml = `
                <div class="table-ore-yield-group">
                    <span class="table-ore-item" title="${node.fallbackStarry || 50} ${starryLabel}">
                        <span class="table-ore-amount">${node.fallbackStarry || 50}</span>
                        <orecalc-assets-image src="assets/starry_ore.png" alt="${starryLabel}" class="table-ore-icon" size="thumbnail"></orecalc-assets-image>
                    </span>
                    <span class="table-fallback-label">(${fallbackLabel})</span>
                </div>
            `.trim();
            const nameHtml = `${resolvedNode.fallbackStarry || 50} <span class="ore-text-starry">${starryLabel}</span>`;
            return { name, nameHtml, icon, yieldHtml };
        } else {
            yieldHtml = escapeHTML(translate('views.heroJourneyPage.tableYieldUnlockLevel', { level: resolvedNode.equipmentLevel || 1 }));
            const nameHtml = `<span class="equipment-text-epic">${escapeHTML(name)}</span>`;
            return { name, nameHtml, icon, yieldHtml };
        }
    } else if (node.type === 'magicItem') {
        const itemName = translate(`entities.magicItems.${node.itemKey}`) || node.itemKey;
        name = `${node.amount || 1}x ${itemName}`;
        icon = (node.icon || 'assets/magicItems/heroPotion.png').replace(/^\//, '');
        yieldHtml = '—';
    } else if (node.type === 'resource') {
        const resName = translate(`entities.resources.${getResourceKey(node.resourceType)}`) || node.resourceType;
        name = `${formatNumber(node.amount)} ${resName}`;
        icon = (node.icon || 'assets/dark_elixir.png').replace(/^\//, '');
        yieldHtml = '—';
    } else if (node.type === 'skin') {
        const rawSkinName = translate(`entities.skins.${node.skinKey}`) || translate('views.heroJourneyPage.skinFallback') || 'Hero Skin';
        const skinWords = rawSkinName.split(' ');
        const nameHtml = skinWords.length > 1
            ? `<span class="accent-text">${escapeHTML(skinWords[0])}</span> ${escapeHTML(skinWords.slice(1).join(' '))}`
            : escapeHTML(rawSkinName);
        name = rawSkinName;
        icon = (node.icon || 'assets/skins/default.png').replace(/^\//, '');
        yieldHtml = '—';
        return { name, nameHtml, icon, yieldHtml };
    }

    return { name, nameHtml: null, icon, yieldHtml };
}

/**
 * Renders the Data Table view.
 */
export function renderTableView() {
    const tableBody = document.getElementById('hj-table-body');
    const tableWrapper = document.getElementById('hj-table-wrapper');
    if (!tableBody) return;

    const filtered = getFilteredNodes();
    if (filtered.length === 0) {
        tableWrapper?.classList.add('is-empty');
        tableBody.innerHTML = `
            <tr>
                <td colspan="3" class="table-empty-cell">
                    <div class="hero-journey-empty-filter-card">
                        <orecalc-assets-svg name="sliders" class="empty-filter-icon"></orecalc-assets-svg>
                        <div class="empty-filter-title">${translate('views.home.heroJourney.emptyFilterTitle')}</div>
                        <div class="empty-filter-desc">${translate('views.home.heroJourney.emptyFilterDesc')}</div>
                        <button type="button" class="th-limit-reveal-btn hero-journey-empty-filter-btn" id="hj-table-clear-filters-btn">${translate('views.home.heroJourney.clearFilter')}</button>
                    </div>
                </td>
            </tr>
        `;
        syncTableTheadHeight();
        return;
    }

    tableWrapper?.classList.remove('is-empty');

    const trackResolution = hjState.playerData ? resolveHeroJourneyTrack(buildStateFromPlayerData(hjState.playerData, hjState)) : null;
    const state = buildStateFromPlayerData(hjState.playerData, hjState);

    let rowsHtml = '';
    let currentTH = null;

    for (const node of filtered) {
        const nodeTH = getNodeTownHallLevel(node.level);
        if (nodeTH !== currentTH) {
            currentTH = nodeTH;
            rowsHtml += `
                <tr class="th-header-row">
                    <td colspan="3">
                        <div class="th-header-cell">
                            <orecalc-assets-image src="assets/th/th${nodeTH}.png" alt="TH ${nodeTH}" class="th-header-img" size="thumbnail"></orecalc-assets-image>
                            <span data-i18n="views.heroJourneyPage.thMilestonesHeader" data-i18n-th="${nodeTH}">${translate('views.heroJourneyPage.thMilestonesHeader', { th: nodeTH })}</span>
                        </div>
                    </td>
                </tr>
            `;
        }

        const isClaimed = hjState.playerData && hjState.cumulativeLevel >= node.level;
        const details = getTableNodeDetails(node, trackResolution, state);
        const resolvedNode = trackResolution?.[node.level] || (node.type === 'equipment' ? getResolvedEquipmentReward(node, state) : node);
        const isUnownedEquipment = isClaimed && node.type === 'equipment' && !resolvedNode.isOwned && !resolvedNode.isFallbackStarry;

        const claimedBadgeHtml = isClaimed
            ? (isUnownedEquipment
                ? `<span class="table-claimed-badge table-unowned-badge" title="${escapeHTML(translate('views.home.heroJourney.unownedClaimedTitle'))}" aria-label="${escapeHTML(translate('views.home.heroJourney.unownedClaimedTitle'))}"><orecalc-assets-svg name="close" width="11" height="11"></orecalc-assets-svg></span>`
                : `<span class="table-claimed-badge" title="${escapeHTML(translate('views.home.heroJourney.claimed'))}" aria-label="${escapeHTML(translate('views.home.heroJourney.claimed'))}"><orecalc-assets-svg name="check" width="11" height="11"></orecalc-assets-svg></span>`)
            : '';

        rowsHtml += `
            <tr class="${isClaimed ? (isUnownedEquipment ? 'claimed unowned' : 'claimed') : ''}">
                <td class="hero-journey-page__level-cell">
                    <div class="level-cell-content">
                        <strong><span class="table-level-prefix">${translate('views.equipment.lvl')} </span>${node.level}</strong>
                        ${claimedBadgeHtml}
                    </div>
                </td>
                <td>
                    <div class="hero-journey-page__reward-cell">
                        <orecalc-assets-image src="${escapeHTML(details.icon)}" alt="${escapeHTML(details.name)}" class="reward-icon" size="thumbnail"></orecalc-assets-image>
                        <span class="reward-name">${details.nameHtml || escapeHTML(details.name)}</span>
                    </div>
                </td>
                <td class="hero-journey-page__details-cell">
                    <div class="details-cell-content">
                        <div class="reward-yield-text">${details.yieldHtml}</div>
                        <button type="button" class="info-btn hj-table-info-btn" data-level="${node.level}" data-is-claimed="${isClaimed}" data-i18n-aria-label="actions.showInfo" title="${translate('actions.showInfo')}">
                            <orecalc-assets-svg name="info" class="info-icon" height="14" width="14"></orecalc-assets-svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    tableBody.innerHTML = rowsHtml;
    syncTableTheadHeight();

    updateTableFilterRowLayout();
    requestAnimationFrame(() => {
        updateTableFilterRowLayout();
    });
}

/**
 * Synchronizes the sticky thead height CSS variable for accurate sub-header stacking.
 */
export function syncTableTheadHeight() {
    const thead = document.querySelector('.hero-journey-page__table thead');
    if (thead) {
        const theadHeight = /** @type {HTMLElement} */ (thead).offsetHeight;
        if (theadHeight > 0) {
            document.documentElement.style.setProperty('--hj-table-thead-height', `${theadHeight}px`);
        }
    }
}

let cachedTableClaimWidth = 0;
let cachedTableButtonsWidth = 0;
let cachedTableSelectWidth = 0;
let cachedTableToggleBtnWidth = 0;

/**
 * Adjusts layout classes for the standalone Table View toggle bar according to available container width.
 */
export function updateTableFilterRowLayout() {
    syncTableTheadHeight();
    const viewToggleBar = document.querySelector('.hero-journey-page__view-toggle-bar');
    const claimSwitch = document.getElementById('hj-table-claim-switch');
    const typeFilters = document.getElementById('hj-table-type-filters');
    const typeButtons = typeFilters?.querySelector('.hj-type-buttons');
    const typeSelect = document.getElementById('hj-table-type-select');
    const toggleActionBtn = document.getElementById('hj-btn-toggle-table') || document.querySelector('.hero-journey-page__table-toggle-action');

    if (!viewToggleBar || !claimSwitch || !typeFilters || !typeButtons || !typeSelect || !toggleActionBtn) return;

    const isClaimSwitchHidden = claimSwitch.offsetParent === null || window.getComputedStyle(claimSwitch).display === 'none';

    let claimWidth = 0;
    if (!isClaimSwitchHidden) {
        if (viewToggleBar.classList.contains('table-filter-stage-3') || claimSwitch.offsetWidth > 250) {
            claimWidth = cachedTableClaimWidth || 160;
        } else {
            claimWidth = (claimSwitch.offsetWidth > 0 ? claimSwitch.offsetWidth : cachedTableClaimWidth) || 160;
            if (claimSwitch.offsetWidth > 0 && claimSwitch.offsetWidth <= 250) {
                cachedTableClaimWidth = claimSwitch.offsetWidth;
            }
        }
    }

    let buttonsWidth = 0;
    const btns = typeButtons.querySelectorAll('.hj-type-btn');
    btns.forEach(btn => {
        if (btn.offsetWidth > 0 && btn.offsetWidth <= 200) {
            buttonsWidth += btn.offsetWidth + 6;
        }
    });
    if (buttonsWidth > 0 && buttonsWidth <= 600) {
        cachedTableButtonsWidth = buttonsWidth;
    } else {
        buttonsWidth = cachedTableButtonsWidth || 340;
    }

    let selectWidth = 0;
    const isSelectStretched = viewToggleBar.classList.contains('table-filter-stage-3') || typeSelect.offsetWidth > 240;
    if (isSelectStretched || typeSelect.offsetWidth === 0) {
        selectWidth = cachedTableSelectWidth || 140;
    } else {
        selectWidth = (typeSelect.offsetWidth > 0 ? typeSelect.offsetWidth : cachedTableSelectWidth) || 140;
        if (typeSelect.offsetWidth > 0 && typeSelect.offsetWidth <= 240) {
            cachedTableSelectWidth = typeSelect.offsetWidth;
        }
    }

    let toggleBtnWidth = 0;
    const isStage3 = viewToggleBar.classList.contains('table-filter-stage-3');
    if (!isStage3 && toggleActionBtn.offsetWidth > 0 && toggleActionBtn.offsetWidth <= 250) {
        toggleBtnWidth = toggleActionBtn.offsetWidth;
        cachedTableToggleBtnWidth = toggleBtnWidth;
    } else {
        toggleBtnWidth = cachedTableToggleBtnWidth || 140;
    }

    const main = document.querySelector('.hero-journey-page__main') || viewToggleBar.parentElement;
    let containerWidth = 0;
    if (main) {
        const mainStyle = window.getComputedStyle(main);
        const paddingHorizontal = (parseFloat(mainStyle.paddingLeft) || 0) + (parseFloat(mainStyle.paddingRight) || 0);
        containerWidth = main.clientWidth - paddingHorizontal;
    }
    if (!containerWidth || containerWidth <= 0) {
        containerWidth = viewToggleBar.clientWidth || window.innerWidth;
    }

    let targetStage = 'table-filter-stage-3';
    if (isClaimSwitchHidden) {
        const stage1Needed = buttonsWidth + toggleBtnWidth + 36;
        if (containerWidth >= stage1Needed) {
            targetStage = 'table-filter-stage-1';
        } else {
            targetStage = 'table-filter-stage-2';
        }
    } else {
        const stage1Needed = claimWidth + buttonsWidth + toggleBtnWidth + 48;
        const stage2Needed = claimWidth + selectWidth + toggleBtnWidth + 40;

        if (containerWidth >= stage1Needed) {
            targetStage = 'table-filter-stage-1';
        } else if (containerWidth >= stage2Needed) {
            targetStage = 'table-filter-stage-2';
        } else {
            targetStage = 'table-filter-stage-3';
        }
    }

    viewToggleBar.classList.toggle('no-claim-switch', isClaimSwitchHidden);
    viewToggleBar.classList.remove('table-filter-stage-1', 'table-filter-stage-2', 'table-filter-stage-3');
    viewToggleBar.classList.add(targetStage);

    syncClaimSwitchPill();
}
