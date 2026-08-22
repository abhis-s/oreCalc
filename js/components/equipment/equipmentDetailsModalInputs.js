import { getEquipmentMaxLevel } from '../../data/equipmentCommonData.js';
import { heroData } from '../../data/heroData.js';
import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';

import { computeEffectiveLevels, getDefaultModifierKey, resolveModifierRecommendation } from '../../domain/equipment/modifierCalculator.js';
import { closeModalAnimated } from '../../utils/modalHistoryManager.js';
import { toCamelCase } from '../../utils/stringUtils.js';

import { renderEmptyState, renderFooterMeta, renderModalHeader, renderModifierTabs, updateTabIndicator } from './equipmentDetailsHeaderDisplay.js';
import { dismissNote, fetchEquipmentData, findValidEquipmentIndex, getEquipLevel, getFlatEquipmentsList, getModalSessionState, getRecommendationsData, isNoteDismissed, resetModalSessionState, setModalSessionState, undismissNote } from './equipmentDetailsModalData.js';
import { getCurrentStatsStateMap, renderStatsProgressList, updateStatsProgressHover } from './equipmentDetailsStatsDisplay.js';
import { renderPropertiesGrid, renderRecommendationBadge, renderStaticStats, renderStrategyBanner } from './equipmentDetailsStrategyDisplay.js';
import { renderLevelTable } from './equipmentDetailsTableDisplay.js';
import { getCurrentUnitStatsStateMap, renderUnitStatsView, updateUnitStatsHover } from './equipmentDetailsUnitStatsDisplay.js';

let isEquipmentDetailsInitialized = false;

/**
 * Initializes global event handlers and keyboard listeners for equipment details modal.
 */
export function initializeEquipmentDetailsModal() {
    if (isEquipmentDetailsInitialized) return;
    isEquipmentDetailsInitialized = true;

    const modal = document.getElementById('equipment-details-modal');
    const closeBtn = document.getElementById('close-eq-details-modal-btn');
    const prevBtn = document.getElementById('eq-details-prev-btn');
    const nextBtn = document.getElementById('eq-details-next-btn');

    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
            closeModalAnimated(modal, () => resetModalSessionState());
        });
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModalAnimated(modal, () => resetModalSessionState());
            }
        });
    }

    const navigateEquipment = async (direction) => {
        const session = getModalSessionState();
        if (!session.activeEquipmentName) return;
        const pBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('eq-details-prev-btn'));
        const nBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('eq-details-next-btn'));

        if (direction === 'prev' && pBtn && (pBtn.disabled || pBtn.classList.contains('disabled'))) return;
        if (direction === 'next' && nBtn && (nBtn.disabled || nBtn.classList.contains('disabled'))) return;

        const list = getFlatEquipmentsList();
        if (list.length === 0) return;
        const currentIdx = list.findIndex(e => e.name.toLowerCase() === session.activeEquipmentName.toLowerCase());
        if (currentIdx === -1) return;

        const targetIdx = await findValidEquipmentIndex(list, currentIdx, direction);
        if (targetIdx !== -1) {
            const targetEquip = list[targetIdx];
            const targetLevel = getEquipLevel(targetEquip.name, targetEquip.heroName, targetEquip.heroKey);
            openEquipmentDetailsModal(targetEquip.name, targetLevel);
        }
    };

    if (prevBtn) {
        prevBtn.onclick = (e) => {
            e.stopPropagation();
            navigateEquipment('prev');
        };
    }

    if (nextBtn) {
        nextBtn.onclick = (e) => {
            e.stopPropagation();
            navigateEquipment('next');
        };
    }

    document.addEventListener('keydown', (e) => {
        if (!modal || !modal.classList.contains('show')) return;
        const target = /** @type {HTMLElement | null} */ (e.target);
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

        if (e.key === 'Escape') {
            closeModalAnimated(modal, () => resetModalSessionState());
            return;
        }

        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            navigateEquipment('prev');
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            navigateEquipment('next');
        }
    });
}

/**
 * Opens and renders the equipment details modal for a given equipment name and level.
 *
 * @param {string} equipmentName
 * @param {number} [currentLevel=1]
 */
export async function openEquipmentDetailsModal(equipmentName, currentLevel = 1) {
    const modal = document.getElementById('equipment-details-modal');
    if (!modal) return;

    setModalSessionState({ activeEquipmentName: equipmentName });

    const data = await fetchEquipmentData(equipmentName);

    const prevBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('eq-details-prev-btn'));
    const nextBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('eq-details-next-btn'));

    const equipList = getFlatEquipmentsList();
    const currentEquipIdx = equipList.findIndex(e => e.name.toLowerCase() === equipmentName.toLowerCase());

    const setBtnState = (btn, isEnabled) => {
        if (!btn) return;
        btn.disabled = !isEnabled;
        btn.classList.toggle('disabled', !isEnabled);
        btn.style.display = '';
    };

    if (prevBtn) {
        setBtnState(prevBtn, false);
        if (currentEquipIdx > 0) {
            findValidEquipmentIndex(equipList, currentEquipIdx, 'prev').then(prevIdx => {
                setBtnState(prevBtn, prevIdx !== -1);
            });
        }
    }
    if (nextBtn) {
        setBtnState(nextBtn, false);
        if (currentEquipIdx !== -1 && currentEquipIdx < equipList.length - 1) {
            findValidEquipmentIndex(equipList, currentEquipIdx, 'next').then(nextIdx => {
                setBtnState(nextBtn, nextIdx !== -1);
            });
        }
    }

    // Dynamic lookup from heroData
    let heroKey = null;
    let heroInfo = null;
    let equipInfo = null;

    const targetEqKey = toCamelCase(equipmentName);
    for (const hKey in heroData) {
        const equip = heroData[hKey].equipment.find(e => e.key === targetEqKey || (e.key && e.key.toLowerCase() === targetEqKey.toLowerCase()));
        if (equip) {
            heroKey = hKey;
            heroInfo = heroData[hKey];
            equipInfo = equip;
            break;
        }
    }

    const equipmentType = data?.type || (equipInfo ? equipInfo.type : 'Common');
    const equipmentRarity = data?.rarity || (equipInfo ? equipInfo.type : 'Common');

    if (!data) {
        renderEmptyState(modal, equipmentName, equipmentRarity, equipmentType, currentLevel, null);
        return;
    }

    const allRecs = await getRecommendationsData();
    const camelKey = toCamelCase(data.id || equipmentName);
    const slug = data.id || equipmentName;
    const isEquipUnreleased = Boolean(data?.isUnreleased || (data?.id || equipmentName).toLowerCase().includes('coming_soon'));
    data.recommendation = allRecs[camelKey] || allRecs[slug] || (isEquipUnreleased ? { recStatus: 'unreleased' } : null);

    const itemImg = document.getElementById('eq-details-item-img');
    const emptyStateContainer = document.getElementById('eq-details-empty-state-container');
    const contentWrapper = document.getElementById('eq-details-content-wrapper');
    const tableWrapper = /** @type {HTMLElement | null} */ (modal.querySelector('.eq-details-table-wrapper'));
    const footerMetaElem = /** @type {HTMLElement | null} */ (modal.querySelector('#eq-details-footer-meta'));
    const modifierTabsContainer = document.getElementById('eq-details-modifier-tabs');
    const propsGrid = document.getElementById('eq-details-props-grid');
    const staticStatsContent = document.getElementById('eq-details-static-stats-content');
    const unitStatsContent = document.getElementById('eq-details-unit-stats-content');
    const unitStatsToggleBtn = document.getElementById('eq-unit-stats-toggle-btn');
    const recBadge = document.getElementById('eq-details-rec-badge');
    const recBannerContainer = document.getElementById('eq-details-rec-banner-container');
    const unhideNoteBtn = document.getElementById('unhide-eq-note-btn');
    const statsProgressList = document.getElementById('eq-details-stats-progress-list');
    const tableHead = document.getElementById('eq-details-table-head');
    const tableBody = document.getElementById('eq-details-table-body');
    const expandBtn = /** @type {HTMLButtonElement | null} */ (modal.querySelector('#expand-eq-table-btn'));
    const tableContainer = modal.querySelector('.eq-details-table-container');

    if (itemImg) itemImg.classList.remove('is-data-unavailable');
    if (emptyStateContainer) {
        emptyStateContainer.style.display = 'none';
        emptyStateContainer.innerHTML = '';
    }
    if (contentWrapper) contentWrapper.style.display = '';
    if (tableWrapper) tableWrapper.style.display = '';
    if (footerMetaElem) footerMetaElem.style.display = '';

    const levelsArray = Array.isArray(data.levels)
        ? data.levels
        : (data.levels ? Object.keys(data.levels).sort((a, b) => Number(a) - Number(b)).map(k => data.levels[k]) : []);

    const hasValidLevels = levelsArray.length > 0;
    if (!hasValidLevels) {
        renderEmptyState(modal, equipmentName, equipmentRarity, equipmentType, currentLevel, data);
        return;
    }

    renderModalHeader(modal, data, equipmentName, heroInfo, equipInfo, equipmentRarity, equipmentType);

    const activeTag = state.savedPlayerTags?.[0] || 'DEFAULT0';
    const playerData = state.allPlayersData?.[activeTag];
    const userTH = Number(
        state.playerProfile?.townHallLevel ||
        state.playerProfile?.townHall ||
        playerData?.playerProfile?.townHallLevel ||
        playerData?.playerProfile?.townHall ||
        playerData?.townHallLevel ||
        playerData?.townHall ||
        16
    );
    const calculatedMaxLevel = getEquipmentMaxLevel(data.rarity || equipmentRarity);
    const isEquipmentMaxed = currentLevel >= calculatedMaxLevel;

    const currentLeagueId = state.income?.starBonus?.league || state.playerProfile?.leagueTier?.id || 0;
    const currentLeagueName = state.playerProfile?.leagueTier?.name || '';
    const session = getModalSessionState();
    let activeModifierTab = session.activeModifierTab || state.uiSettings?.leagueModifier || getDefaultModifierKey(currentLeagueId, currentLeagueName);
    setModalSessionState({ activeModifierTab });

    const equipId = data.id || equipmentName;
    const rec = data.recommendation;
    const hasUnitStatsView = Boolean(data.hasSpawnedUnits && data.spawnedUnits);
    let currentViewMode = session.viewModePreference || 'overview';

    const staticBox = document.getElementById('eq-details-static-box');
    const overviewElements = staticBox ? staticBox.querySelectorAll('.eq-details-header-row, .eq-details-avatars, .eq-details-badges, #eq-details-static-stats-content') : [];

    const updateAllViewsForModifier = (previousModeMap = null, previousUnitMap = null) => {
        const effective = computeEffectiveLevels(currentLevel, calculatedMaxLevel, data.rarity || equipmentRarity, activeModifierTab);

        data.modalModifierContext = {
            activeModifier: activeModifierTab,
            effectiveLevel: effective.effectiveLevel,
            effectiveMaxLevel: effective.effectiveMaxLevel,
            isDowngraded: effective.isDowngraded,
            recStatus: resolveModifierRecommendation(rec, activeModifierTab, userTH, calculatedMaxLevel, Boolean(data?.isUnreleased)).recStatus,
            targetRecLevel: resolveModifierRecommendation(rec, activeModifierTab, userTH, calculatedMaxLevel, Boolean(data?.isUnreleased)).targetRecLevel
        };

        const lvlHeaderLabel = document.getElementById('eq-details-lvl-header-label');
        const currentLvlText = document.getElementById('eq-details-current-lvl-text');
        const maxLvlText = document.getElementById('eq-details-max-lvl-text');
        const isEsports = activeModifierTab === 'esports';
        const isEffectiveModified = isEsports || effective.isDowngraded;

        if (lvlHeaderLabel) {
            const key = isEffectiveModified ? 'views.equipment.modifiers.effectiveLevel' : 'validation.level';
            lvlHeaderLabel.textContent = translate(key);
            lvlHeaderLabel.dataset.i18n = key;
        }

        if (currentLvlText) {
            currentLvlText.textContent = String(effective.effectiveLevel);
        }

        if (maxLvlText) {
            const prefixKey = isEffectiveModified ? 'views.equipment.modifiers.effectiveMaxLevel' : 'views.equipment.maxLevel';
            const prefix = translate(prefixKey);
            maxLvlText.innerHTML = `${prefix} <strong>${effective.effectiveMaxLevel}</strong>`;
            delete maxLvlText.dataset.i18n;
        }

        if (modifierTabsContainer) {
            modifierTabsContainer.dataset.activeKey = activeModifierTab;
            modifierTabsContainer.querySelectorAll('.mod-tab-btn').forEach(btn => {
                btn.classList.toggle('active', /** @type {HTMLElement} */ (btn).dataset.modKey === activeModifierTab);
            });
            updateTabIndicator(modifierTabsContainer, activeModifierTab, false);
        }

        renderRecommendationBadge(recBadge, data, equipmentName, rec, activeModifierTab, userTH, calculatedMaxLevel, isEquipmentMaxed);

        const currentSession = getModalSessionState();
        const isTableExpanded = Boolean(currentSession.tableExpanded || (modal && modal.classList.contains('has-expanded-table')));
        const isExplicitlyDismissed = currentSession.recommendationHidden !== null ? currentSession.recommendationHidden : isNoteDismissed(equipId);
        const isNoteHidden = isTableExpanded || isExplicitlyDismissed;

        renderStrategyBanner(
            recBannerContainer,
            unhideNoteBtn,
            equipId,
            Boolean(data?.isUnreleased),
            isEquipmentMaxed,
            rec,
            activeModifierTab,
            userTH,
            calculatedMaxLevel,
            isNoteHidden,
            () => {
                dismissNote(equipId);
                setModalSessionState({ recommendationHidden: true });
                updateAllViewsForModifier();
            },
            () => {
                undismissNote(equipId);
                setModalSessionState({ recommendationHidden: false, tableExpanded: false });
                if (tableWrapper) tableWrapper.classList.remove('table-expanded');
                if (modal) modal.classList.remove('has-expanded-table');
                if (expandBtn) {
                    const iconSvg = expandBtn.querySelector('orecalc-assets-svg');
                    if (iconSvg) iconSvg.setAttribute('name', 'expand');
                    expandBtn.setAttribute('title', translate('actions.expandTable'));
                }
                updateAllViewsForModifier();
            }
        );

        if (hasUnitStatsView && unitStatsContent) {
            renderUnitStatsView(unitStatsContent, data, levelsArray, currentLevel, calculatedMaxLevel, equipmentRarity, activeModifierTab, effective.effectiveLevel, false, previousUnitMap);
        }

        renderStatsProgressList(statsProgressList, data, levelsArray, currentLevel, calculatedMaxLevel, equipmentRarity, activeModifierTab, false, previousModeMap);

        renderLevelTable(
            tableHead,
            tableBody,
            data,
            levelsArray,
            currentLevel,
            calculatedMaxLevel,
            equipmentRarity,
            heroKey,
            userTH,
            activeModifierTab,
            rec,
            (hoverLvl) => {
                updateStatsProgressHover(statsProgressList, data, levelsArray, currentLevel, calculatedMaxLevel, equipmentRarity, activeModifierTab, hoverLvl);
                if (hasUnitStatsView) {
                    updateUnitStatsHover(unitStatsContent, data, levelsArray, currentLevel, calculatedMaxLevel, equipmentRarity, activeModifierTab, hoverLvl);
                }
            },
            () => {
                updateStatsProgressHover(statsProgressList, data, levelsArray, currentLevel, calculatedMaxLevel, equipmentRarity, activeModifierTab, null);
                if (hasUnitStatsView) {
                    updateUnitStatsHover(unitStatsContent, data, levelsArray, currentLevel, calculatedMaxLevel, equipmentRarity, activeModifierTab, null);
                }
            }
        );

        requestAnimationFrame(() => {
            const activeRow = /** @type {HTMLElement | null} */ (modal.querySelector('.active-level-row, .active-max-level-row'));
            const thead = modal.querySelector('#eq-details-table-head');
            const tContainer = modal.querySelector('.eq-details-table-container');
            if (activeRow && tContainer) {
                const headerHeight = thead ? thead.clientHeight : 0;
                const targetScrollTop = Math.max(0, activeRow.offsetTop - headerHeight);
                tContainer.scrollTop = targetScrollTop;
            }
        });
    };

    renderModifierTabs(modifierTabsContainer, hasValidLevels, Boolean(data.statsMeta), activeModifierTab, (newKey) => {
        if (newKey !== activeModifierTab) {
            const prevModeMap = getCurrentStatsStateMap(data, levelsArray, currentLevel, calculatedMaxLevel, equipmentRarity, activeModifierTab);
            const prevUnitMap = getCurrentUnitStatsStateMap(data, levelsArray, currentLevel, calculatedMaxLevel, equipmentRarity, activeModifierTab);
            activeModifierTab = newKey;
            setModalSessionState({ activeModifierTab: newKey });
            if (modifierTabsContainer) {
                modifierTabsContainer.querySelectorAll('.mod-tab-btn').forEach(b => b.classList.toggle('active', /** @type {HTMLElement} */ (b).dataset.modKey === activeModifierTab));
                const activeBtn = modifierTabsContainer.querySelector(`.mod-tab-btn[data-mod-key="${activeModifierTab}"]`);
                if (activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                updateTabIndicator(modifierTabsContainer, activeModifierTab, false);
            }
            updateAllViewsForModifier(prevModeMap, prevUnitMap);
        }
    });

    renderPropertiesGrid(propsGrid, data);
    renderStaticStats(staticStatsContent, data);

    if (unitStatsToggleBtn) {
        if (hasUnitStatsView) {
            const unitStatsBtnLabel = translate('views.equipment.unitStats');
            const overviewBtnLabel = translate('views.equipment.overview');

            unitStatsToggleBtn.style.display = 'inline-flex';

            if (currentViewMode === 'unitStats') {
                unitStatsToggleBtn.innerHTML = `<orecalc-assets-svg name="group" class="toggle-btn-icon"></orecalc-assets-svg> <span>${overviewBtnLabel}</span>`;
                overviewElements.forEach(el => /** @type {HTMLElement} */ (el).style.display = 'none');
                const effective = computeEffectiveLevels(currentLevel, calculatedMaxLevel, data.rarity || equipmentRarity, activeModifierTab);
                renderUnitStatsView(unitStatsContent, data, levelsArray, currentLevel, calculatedMaxLevel, equipmentRarity, activeModifierTab, effective.effectiveLevel, false);
                if (unitStatsContent) unitStatsContent.style.display = 'block';
            } else {
                currentViewMode = 'overview';
                unitStatsToggleBtn.innerHTML = `<orecalc-assets-svg name="group" class="toggle-btn-icon"></orecalc-assets-svg> <span>${unitStatsBtnLabel}</span>`;
                if (unitStatsContent) unitStatsContent.style.display = 'none';
                overviewElements.forEach(el => /** @type {HTMLElement} */ (el).style.display = '');
            }

            unitStatsToggleBtn.onclick = () => {
                const modTabs = document.getElementById('eq-details-modifier-tabs');
                const firstRect = modTabs ? modTabs.getBoundingClientRect() : null;

                if (currentViewMode === 'overview') {
                    currentViewMode = 'unitStats';
                    setModalSessionState({ viewModePreference: 'unitStats' });
                    unitStatsToggleBtn.innerHTML = `<orecalc-assets-svg name="group" class="toggle-btn-icon"></orecalc-assets-svg> <span>${overviewBtnLabel}</span>`;
                    overviewElements.forEach(el => /** @type {HTMLElement} */ (el).style.display = 'none');
                    const effective = computeEffectiveLevels(currentLevel, calculatedMaxLevel, data.rarity || equipmentRarity, activeModifierTab);
                    renderUnitStatsView(unitStatsContent, data, levelsArray, currentLevel, calculatedMaxLevel, equipmentRarity, activeModifierTab, effective.effectiveLevel, true);
                    if (unitStatsContent) unitStatsContent.style.display = 'block';
                } else {
                    currentViewMode = 'overview';
                    setModalSessionState({ viewModePreference: 'overview' });
                    unitStatsToggleBtn.innerHTML = `<orecalc-assets-svg name="group" class="toggle-btn-icon"></orecalc-assets-svg> <span>${unitStatsBtnLabel}</span>`;
                    if (unitStatsContent) unitStatsContent.style.display = 'none';
                    overviewElements.forEach(el => /** @type {HTMLElement} */ (el).style.display = '');
                }

                if (modTabs && firstRect) {
                    const lastRect = modTabs.getBoundingClientRect();
                    const deltaY = firstRect.top - lastRect.top;
                    if (Math.abs(deltaY) > 2) {
                        modTabs.style.transition = 'none';
                        modTabs.style.transform = `translateY(${deltaY}px)`;
                        void modTabs.offsetHeight;
                        requestAnimationFrame(() => {
                            modTabs.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.8, 0.25, 1)';
                            modTabs.style.transform = 'translateY(0)';
                        });
                    }
                }
            };
        } else {
            currentViewMode = 'overview';
            unitStatsToggleBtn.style.display = 'none';
            if (unitStatsContent) unitStatsContent.style.display = 'none';
            overviewElements.forEach(el => /** @type {HTMLElement} */ (el).style.display = '');
        }
    }

    renderStatsProgressList(statsProgressList, data, levelsArray, currentLevel, calculatedMaxLevel, equipmentRarity, activeModifierTab, true);
    updateAllViewsForModifier();

    if (expandBtn && tableWrapper) {
        const isCurrentlyExpanded = Boolean(getModalSessionState().tableExpanded);
        tableWrapper.classList.toggle('table-expanded', isCurrentlyExpanded);
        modal.classList.toggle('has-expanded-table', isCurrentlyExpanded);
        const iconSvg = expandBtn.querySelector('orecalc-assets-svg');
        if (iconSvg) iconSvg.setAttribute('name', isCurrentlyExpanded ? 'compress' : 'expand');
        expandBtn.setAttribute(
            'title',
            isCurrentlyExpanded ? translate('actions.compressTable') : translate('actions.expandTable')
        );

        expandBtn.onclick = () => {
            const isExpanded = tableWrapper.classList.toggle('table-expanded');
            modal.classList.toggle('has-expanded-table', isExpanded);
            setModalSessionState({ tableExpanded: isExpanded });
            if (iconSvg) iconSvg.setAttribute('name', isExpanded ? 'compress' : 'expand');
            expandBtn.setAttribute(
                'title',
                isExpanded ? translate('actions.compressTable') : translate('actions.expandTable')
            );

            updateAllViewsForModifier();

            requestAnimationFrame(() => {
                const activeRow = /** @type {HTMLElement | null} */ (modal.querySelector('.active-level-row, .active-max-level-row'));
                const thead = modal.querySelector('#eq-details-table-head');
                if (activeRow && tableContainer) {
                    const headerHeight = thead ? thead.clientHeight : 0;
                    const targetScrollTop = Math.max(0, activeRow.offsetTop - headerHeight);
                    tableContainer.scrollTo({
                        top: targetScrollTop,
                        behavior: 'smooth'
                    });
                }
            });
        };
    }

    if (footerMetaElem) renderFooterMeta(footerMetaElem);

    modal.classList.add('show');

    requestAnimationFrame(() => {
        const activeRow = /** @type {HTMLElement | null} */ (modal.querySelector('.active-level-row, .active-max-level-row'));
        const thead = modal.querySelector('#eq-details-table-head');
        if (activeRow && tableContainer) {
            const headerHeight = thead ? thead.clientHeight : 0;
            const targetScrollTop = Math.max(0, activeRow.offsetTop - headerHeight);
            tableContainer.scrollTop = targetScrollTop;
        }
    });
}
