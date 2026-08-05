import { state } from '../../core/state.js';
import { heroData } from '../../data/heroData.js';
import { getEquipmentUpgradeCost, getRequiredTownHall, getEquipmentMaxLevel, townHallCapsMap, EQUIPMENT_STATS_LAST_UPDATED } from '../../data/equipmentCommonData.js';
import { translate } from '../../i18n/translator.js';
import { toCamelCase } from '../../utils/stringUtils.js';
import { animateValue, formatNumber } from '../../utils/numberFormatter.js';

const equipmentDataCache = new Map();
const dismissedNotes = new Set();
let recommendationsCache = null;
let activeEquipmentName = null;

let sessionActiveModifierTab = null;
let sessionViewModePreference = 'overview';
let sessionRecommendationHidden = true;
let sessionTableExpanded = false;

export function resetModalSessionState() {
    sessionActiveModifierTab = null;
    sessionViewModePreference = 'overview';
    sessionRecommendationHidden = true;
    sessionTableExpanded = false;
}

async function hasEquipmentData(equipmentName) {
    if (!equipmentName) return false;
    const slug = equipmentName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (equipmentDataCache.has(slug)) {
        return Boolean(equipmentDataCache.get(slug));
    }
    try {
        const response = await fetch(`js/data/equipment/${slug}.json`);
        const contentType = response.headers.get('content-type');
        if (response.ok && contentType && contentType.includes('application/json')) {
            const data = await response.json();
            equipmentDataCache.set(slug, data);
            return true;
        } else {
            equipmentDataCache.set(slug, null);
            return false;
        }
    } catch (e) {
        equipmentDataCache.set(slug, null);
        return false;
    }
}

async function findValidEquipmentIndex(list, currentIdx, direction) {
    if (direction === 'next') {
        for (let i = currentIdx + 1; i < list.length; i++) {
            if (await hasEquipmentData(list[i].name)) return i;
        }
    } else if (direction === 'prev') {
        for (let i = currentIdx - 1; i >= 0; i--) {
            if (await hasEquipmentData(list[i].name)) return i;
        }
    }
    return -1;
}

async function getRecommendationsData() {
    if (recommendationsCache) return recommendationsCache;
    try {
        const response = await fetch('js/data/equipmentRecommendations.json');
        if (response.ok) {
            recommendationsCache = await response.json();
        }
    } catch (e) {
        console.warn('Could not load equipment recommendations dataset:', e);
        recommendationsCache = {};
    }
    return recommendationsCache || {};
}


export function getRecommendedLevelForTownHall(recommendation, userTH) {
    if (!recommendation || !recommendation.recommendedLevels) return null;
    const { default: defaultLevel, byTownHall } = recommendation.recommendedLevels;
    if (!byTownHall) return defaultLevel || null;

    if (userTH) {
        const availableTHs = Object.keys(byTownHall)
            .map(Number)
            .filter(th => !isNaN(th) && th <= userTH)
            .sort((a, b) => b - a);

        if (availableTHs.length > 0) {
            return byTownHall[availableTHs[0]];
        }
    }

    return defaultLevel || null;
}

export const ESPORTS_COMMON_DOWNGRADE = 3;
export const ESPORTS_EPIC_DOWNGRADE = 6;

export const MODIFIER_HERO_BOOST_MULTIPLIERS = {
    standard: 1.00,
    legend3: 0.95,
    legend2: 0.90,
    legend1: 0.80,
    esports: 0.80
};

export function isStatModifiable(meta) {
    if (!meta) return false;
    if (meta.isModifiable !== undefined) {
        return Boolean(meta.isModifiable);
    }
    // Fallback if isModifiable property is absent on statsMeta item:
    return meta.category === 'heroBoost' && [
        'dpsIncrease',
        'damagePerSecondIncrease',
        'damagePerShotIncrease',
        'hitpointIncrease',
        'hpIncrease',
        'maxHealthIncrease',
        'selfHealingPerSecond',
        'healthRecovery'
    ].includes(meta.key);
}

export function computeEffectiveLevels(currentLevel, calculatedMaxLevel, rarity = 'Common', modifierKey = 'standard') {
    const isEpic = rarity.toLowerCase() === 'epic';
    const validCurrentLevel = Math.max(1, Math.min(calculatedMaxLevel, Number(currentLevel) || 1));
    if (modifierKey === 'esports') {
        const downgrade = isEpic ? ESPORTS_EPIC_DOWNGRADE : ESPORTS_COMMON_DOWNGRADE;
        const esportsMaxLevel = calculatedMaxLevel - downgrade;
        const effectiveLevel = Math.max(1, Math.min(esportsMaxLevel, validCurrentLevel - downgrade));
        const effectiveMaxLevel = esportsMaxLevel;
        return {
            effectiveLevel,
            effectiveMaxLevel,
            trueMaxLevel: calculatedMaxLevel,
            isDowngraded: true,
            downgrade
        };
    }
    return {
        effectiveLevel: validCurrentLevel,
        effectiveMaxLevel: calculatedMaxLevel,
        trueMaxLevel: calculatedMaxLevel,
        isDowngraded: false,
        downgrade: 0
    };
}

export function formatRegionalDate(isoDateStr) {
    if (!isoDateStr) return '';
    try {
        const parts = isoDateStr.split('-');
        if (parts.length !== 3) return isoDateStr;
        const [year, month, day] = parts.map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        const lang = state.uiSettings?.language || 'en';
        return new Intl.DateTimeFormat(lang, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC'
        }).format(date);
    } catch (e) {
        return isoDateStr;
    }
}

export function formatDiffVal(diffVal, vUnit) {
    if (typeof diffVal !== 'number' || isNaN(diffVal) || diffVal === 0) return '0';
    const isPositive = diffVal > 0;
    const absVal = Math.abs(diffVal);
    let formattedNum = '';

    if (vUnit === 'seconds' || vUnit === 'tiles') {
        const num = Math.round(absVal * 10) / 10;
        formattedNum = `${formatNumber(num)}${vUnit === 'seconds' ? 's' : ' tiles'}`;
    } else if (vUnit === 'percentage' || vUnit === 'percent') {
        const num = Number.isInteger(absVal) ? Math.round(absVal) : (Math.round(absVal * 10) / 10);
        formattedNum = `${formatNumber(num)}%`;
    } else {
        const isInt = Number.isInteger(absVal);
        const num = isInt ? Math.round(absVal) : (Math.round(absVal * 10) / 10);
        formattedNum = formatNumber(num);
    }

    return isPositive ? `+${formattedNum}` : `-${formattedNum}`;
}

export function resolveModifierRecommendation(rec, modifierKey = 'standard', userTH = 16, calculatedMaxLevel = 18, isUnreleasedEquipment = false) {
    if (isUnreleasedEquipment) {
        return { recStatus: 'unreleased', targetRecLevel: null, isAutoMax: false };
    }
    if (!rec) return { recStatus: null, targetRecLevel: null, isAutoMax: false };

    let effectiveObj = rec;
    if (modifierKey !== 'standard' && rec.modifiers) {
        const modSpecific = rec.modifiers[modifierKey];
        const modDefault = rec.modifiers.default;
        if (modSpecific) {
            effectiveObj = {
                ...rec,
                ...modSpecific
            };
        } else if (modDefault) {
            effectiveObj = {
                ...rec,
                ...modDefault
            };
        }
    }

    const recStatus = (effectiveObj.isUnreleased || isUnreleasedEquipment)
        ? 'unreleased'
        : (effectiveObj.recStatus || (effectiveObj.isRecommended === false ? 'not_recommended' : (effectiveObj.isRecommended === true ? 'recommended' : effectiveObj.status || 'recommended')));

    let targetRecLevel = null;
    let isAutoMax = false;

    if (recStatus === 'unreleased') {
        return { recStatus: 'unreleased', targetRecLevel: null, isAutoMax: false };
    }

    // Recommended level support ONLY for non-modifier / standard mode
    if (modifierKey === 'standard') {
        targetRecLevel = getRecommendedLevelForTownHall(effectiveObj, userTH);
    }

    return {
        recStatus,
        targetRecLevel,
        isAutoMax
    };
}

export function getDefaultModifierKeyFromState() {
    const leagueId = parseInt(state.income?.starBonus?.league || state.playerProfile?.leagueTier?.id || 0, 10);
    const leagueName = (state.playerProfile?.leagueTier?.name || '').toLowerCase();

    if (leagueId === 105000036 || (leagueName.includes('legend i') && !leagueName.includes('legend ii') && !leagueName.includes('legend iii'))) {
        return 'legend1';
    }
    if (leagueId === 105000035 || (leagueName.includes('legend ii') && !leagueName.includes('legend iii'))) {
        return 'legend2';
    }
    if (leagueId === 105000034 || leagueName.includes('legend iii')) {
        return 'legend3';
    }

    return 'standard';
}

function computeStatDelta(currentVal, prevVal, deltaType, valueUnit = 'number', category = 'ability') {
    if (prevVal === undefined || prevVal === null || prevVal === 0 || currentVal === undefined || currentVal === null) {
        return '';
    }
    const rawDiff = currentVal - prevVal;
    if (rawDiff <= 0) return '';

    // Clean floating point precision issues (e.g. 0.20000000000000018 -> 0.2)
    const diff = Math.round(rawDiff * 1000) / 1000;

    // Resolve effective deltaType: heroBoost category ALWAYS uses percentage increase unless deltaType is explicitly set to 'flat'
    let effectiveDeltaType = deltaType;
    if (!effectiveDeltaType) {
        effectiveDeltaType = category === 'heroBoost' ? 'percent' : 'flat';
    }

    if (effectiveDeltaType === 'flat') {
        return `+${diff}`;
    } else {
        const pct = Math.round((rawDiff / prevVal) * 100);
        if (pct > 99) {
            return `+${diff}`;
        }
        return `+${pct}%`;
    }
}

export async function openEquipmentDetailsModal(equipmentName, currentLevel = 1) {
    const modal = document.getElementById('equipment-details-modal');
    if (!modal) return;

    activeEquipmentName = equipmentName;

    const modalBody = modal.querySelector('.modal-body');
    const slug = equipmentName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

    let data = equipmentDataCache.get(slug);

    if (!data) {
        try {
            const response = await fetch(`js/data/equipment/${slug}.json`);
            const contentType = response.headers.get('content-type');
            if (response.ok && contentType && contentType.includes('application/json')) {
                data = await response.json();
                equipmentDataCache.set(slug, data);
            }
        } catch (e) {
            console.warn(`Could not load details for ${equipmentName}:`, e);
        }
    }

    const heroEmblem = document.getElementById('eq-details-hero-emblem');
    const itemImg = document.getElementById('eq-details-item-img');
    const titleEl = document.getElementById('eq-details-title');
    const descEl = document.getElementById('eq-details-desc');
    const typeBadge = document.getElementById('eq-details-type-badge');
    const rarityBadge = document.getElementById('eq-details-rarity-badge');
    const prevBtn = document.getElementById('eq-details-prev-btn');
    const nextBtn = document.getElementById('eq-details-next-btn');

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

    for (const hKey in heroData) {
        const equip = heroData[hKey].equipment.find(e => e.name.toLowerCase() === equipmentName.toLowerCase());
        if (equip) {
            heroKey = hKey;
            heroInfo = heroData[hKey];
            equipInfo = equip;
            break;
        }
    }

    const heroImageSrc = (heroInfo && heroInfo.emblem) ? heroInfo.emblem : (data?.heroImage || (heroInfo ? heroInfo.image : ''));
    const equipImageSrc = data?.equipmentImage || (equipInfo ? equipInfo.image : '');
    const equipmentType = data?.type || (equipInfo ? equipInfo.type : 'Common');
    const equipmentRarity = data?.rarity || (equipInfo ? equipInfo.type : 'Common');

    const heroEquipFallbackText = translate('equipment.heroEquipment');
    const emptyStateContainer = document.getElementById('eq-details-empty-state-container');
    const contentWrapper = document.getElementById('eq-details-content-wrapper');
    const modifierTabsContainer = document.getElementById('eq-details-modifier-tabs');

    if (heroEmblem && heroImageSrc) heroEmblem.src = heroImageSrc;
    if (itemImg && equipImageSrc) itemImg.src = equipImageSrc;

    if (!data) {
        // Render Empty / Unavailable State
        if (itemImg) itemImg.classList.add('is-data-unavailable');
        const fallbackTitle = translate(`equipment.${toCamelCase(equipmentName)}`);
        const dataNotAvailableTitle = translate('equipment.dataNotAvailable');
        const dataNotAvailableDesc = translate('equipment.detailsNotAvailableDesc');
        const contributeText = translate('equipment.contributeMissingData');
        const translatedRarity = translate(`equipment.${equipmentRarity.toLowerCase()}`);
        const translatedType = translate(`equipment.${equipmentType.toLowerCase()}`);

        if (titleEl) titleEl.textContent = fallbackTitle;
        if (descEl) descEl.textContent = heroEquipFallbackText;

        if (typeBadge) {
            typeBadge.style.display = 'none';
        }
        if (rarityBadge) {
            rarityBadge.style.display = '';
            rarityBadge.textContent = translatedRarity;
            rarityBadge.className = `eq-badge badge-${equipmentRarity.toLowerCase()}`;
            rarityBadge.setAttribute('data-info', 'equipment.badgeRarityHelp');
            rarityBadge.setAttribute('data-info-rarity', translatedRarity);
        }

        // Recommendation badge: show "Unreleased" for coming_soon / unreleased equipment
        const recBadge = document.getElementById('eq-details-rec-badge');
        if (recBadge) {
            recBadge.style.display = 'inline-flex';
            recBadge.className = 'eq-badge badge-unreleased';
            recBadge.innerHTML = `<orecalc-assets-svg name="sparkles" class="badge-icon"></orecalc-assets-svg> <span>${translate('equipment.unreleased')}</span>`;
            recBadge.setAttribute('data-info', 'equipment.recUnreleasedHelp');
        }

        // Show Content Wrapper & Top Cards Row
        if (contentWrapper) contentWrapper.style.display = '';

        const propsGrid = document.getElementById('eq-details-props-grid');
        if (propsGrid) propsGrid.style.display = 'none';

        const recBannerContainer = document.getElementById('eq-details-rec-banner-container');
        if (recBannerContainer) recBannerContainer.innerHTML = '';

        const modifierTabsContainer = document.getElementById('eq-details-modifier-tabs');
        if (modifierTabsContainer) {
            modifierTabsContainer.style.display = 'none';
            modifierTabsContainer.innerHTML = '';
        }

        const staticStatsContent = document.getElementById('eq-details-static-stats-content');
        if (staticStatsContent) {
            staticStatsContent.style.display = 'none';
            staticStatsContent.innerHTML = '';
        }

        const unitStatsContent = document.getElementById('eq-details-unit-stats-content');
        if (unitStatsContent) {
            unitStatsContent.style.display = 'none';
            unitStatsContent.innerHTML = '';
        }

        const unitStatsToggleBtn = document.getElementById('eq-unit-stats-toggle-btn');
        if (unitStatsToggleBtn) {
            unitStatsToggleBtn.style.display = 'none';
        }

        const boxesRow = modal.querySelector('.eq-details-boxes-row');
        if (boxesRow) boxesRow.style.display = 'flex';

        const staticBox = document.getElementById('eq-details-static-box');
        if (staticBox) staticBox.style.display = 'block';

        const currentLvlBox = modal.querySelector('.eq-details-current-level-box');
        if (currentLvlBox) currentLvlBox.style.display = 'block';

        // Level Header: Level - / Max Level 18 or 27
        const lvlHeaderLabel = document.getElementById('eq-details-lvl-header-label');
        const currentLvlText = document.getElementById('eq-details-current-lvl-text');
        const maxLvlText = document.getElementById('eq-details-max-lvl-text');
        const calculatedMaxLevel = getEquipmentMaxLevel(equipmentRarity);

        if (lvlHeaderLabel) {
            lvlHeaderLabel.textContent = translate('validation.level');
            lvlHeaderLabel.dataset.i18n = 'validation.level';
        }
        if (currentLvlText) {
            currentLvlText.textContent = (currentLevel && currentLevel > 1) ? currentLevel : '-';
        }
        if (maxLvlText) {
            const prefix = translate('equipment.maxLevel');
            maxLvlText.innerHTML = `${prefix} <strong>${calculatedMaxLevel}</strong>`;
        }

        // Render progress bars in right box: if statsMeta present, list stat names with - values; else 3 Data Not Available rows
        const progressList = document.getElementById('eq-details-stats-progress-list');
        if (progressList) {
            const metaList = (data && data.statsMeta && data.statsMeta.length > 0) ? data.statsMeta : null;
            let barsHTML = '';
            if (metaList) {
                barsHTML = metaList.map(meta => {
                    const statLabel = translate(`equipment.stats.${meta.key}`) || translate(`equipment.${meta.key}`) || meta.key;
                    return `
                        <div class="stat-progress-row">
                            <div class="stat-label-line">
                                <span class="stat-name" title="${statLabel}"><span class="stat-name-text">${statLabel}</span></span>
                                <span class="stat-val"><span class="stat-val-number">-</span></span>
                            </div>
                            <div class="progress-bar-bg">
                                <div class="progress-bar-fill" style="width: 0%;"></div>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                const notAvailableLabel = translate('equipment.dataNotAvailable');
                for (let i = 0; i < 3; i++) {
                    barsHTML += `
                        <div class="stat-progress-row">
                            <div class="stat-label-line">
                                <span class="stat-name" title="${notAvailableLabel}"><span class="stat-name-text">${notAvailableLabel}</span></span>
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

        // Hide Table Wrapper and Show Empty State Container in its place
        const tableWrapper = modal.querySelector('.eq-details-table-wrapper');
        if (tableWrapper) tableWrapper.style.display = 'none';

        if (emptyStateContainer) {
            emptyStateContainer.style.display = 'block';
            emptyStateContainer.innerHTML = `
                <div class="eq-details-empty-state">
                    <div class="empty-state-icon">
                        <orecalc-assets-svg name="close"></orecalc-assets-svg>
                    </div>
                    <h3>${dataNotAvailableTitle}</h3>
                    <p>${dataNotAvailableDesc}</p>
                    <p class="empty-state-contribute"><em>${contributeText}</em></p>
                </div>
            `;
        }

        // Show Footer Meta at modal bottom
        const footerMetaElem = modal.querySelector('#eq-details-footer-meta');
        if (footerMetaElem) {
            footerMetaElem.style.display = '';
            const formattedDate = formatRegionalDate(EQUIPMENT_STATS_LAST_UPDATED);
            const dateText = translate('equipment.statsLastUpdated', { date: formattedDate });
            const reportText = translate('equipment.reportInaccuracies');
            const attributionText = translate('equipment.detailsAttribution');
            footerMetaElem.innerHTML = `
                <div class="eq-details-footer-top-row">
                    <span class="eq-details-report-inaccuracies">${reportText}</span>
                    <span class="eq-details-last-updated">${dateText}</span>
                </div>
                <div class="eq-details-attribution-row">${attributionText}</div>
            `;
        }

        modal.classList.add('show');
        return;
    }

    const allRecs = await getRecommendationsData();
    const camelKey = toCamelCase(data.id || equipmentName);
    const isEquipUnreleased = Boolean(data?.isUnreleased || (data?.id || equipmentName).toLowerCase().includes('coming_soon'));
    data.recommendation = allRecs[camelKey] || allRecs[slug] || (isEquipUnreleased ? { recStatus: 'unreleased' } : null);

    // Restore full modal content wrapper if previously showing empty state
    if (itemImg) itemImg.classList.remove('is-data-unavailable');
    const footerMetaElem = modal.querySelector('#eq-details-footer-meta');
    const tableWrapper = modal.querySelector('.eq-details-table-wrapper');
    if (emptyStateContainer) {
        emptyStateContainer.style.display = 'none';
        emptyStateContainer.innerHTML = '';
    }
    if (contentWrapper) {
        contentWrapper.style.display = '';
    }
    if (tableWrapper) {
        tableWrapper.style.display = '';
    }
    if (footerMetaElem) {
        footerMetaElem.style.display = '';
    }

    // Normalize levels format (supports both Object Map {"1": {...}} and Array [{...}])
    const levelsArray = Array.isArray(data.levels)
        ? data.levels
        : (data.levels ? Object.keys(data.levels).sort((a, b) => Number(a) - Number(b)).map(k => data.levels[k]) : []);

    const hasValidLevels = levelsArray.length > 0;
    if (!hasValidLevels) {
        if (tableWrapper) tableWrapper.style.display = 'none';
        if (modifierTabsContainer) modifierTabsContainer.style.display = 'none';
        if (emptyStateContainer) {
            emptyStateContainer.style.display = 'block';
            emptyStateContainer.innerHTML = `
                <div class="eq-details-empty-state">
                    <div class="empty-state-icon">
                        <orecalc-assets-svg name="close"></orecalc-assets-svg>
                    </div>
                    <h3>${translate('equipment.dataNotAvailable')}</h3>
                    <p>${translate('equipment.detailsNotAvailableDesc')}</p>
                    <p class="empty-state-contribute"><em>${translate('equipment.contributeMissingData')}</em></p>
                </div>
            `;
        }
        if (itemImg) itemImg.classList.add('is-data-unavailable');
    } else {
        if (tableWrapper) tableWrapper.style.display = '';
        if (emptyStateContainer) {
            emptyStateContainer.style.display = 'none';
            emptyStateContainer.innerHTML = '';
        }
        if (itemImg) itemImg.classList.remove('is-data-unavailable');
    }

    // Populate Header with Automatic i18n Translation & Dynamic Hero Data
    const effectiveRarity = data.rarity || equipmentRarity || 'Common';
    const effectiveType = data.type || equipmentType || 'Active';

    const translatedTitle = translate(`equipment.${toCamelCase(data.id || equipmentName)}`);
    const translatedRarity = translate(`equipment.${effectiveRarity.toLowerCase()}`);
    const translatedType = translate(`equipment.${effectiveType.toLowerCase()}`);

    if (heroEmblem) heroEmblem.src = heroImageSrc;
    if (itemImg) itemImg.src = equipImageSrc;
    if (titleEl) titleEl.textContent = translatedTitle;
    if (descEl) descEl.textContent = heroEquipFallbackText;

    if (typeBadge) {
        if (data.type) {
            typeBadge.style.display = '';
            typeBadge.textContent = translatedType;
            typeBadge.className = `eq-badge badge-${effectiveType.toLowerCase()}`;
            typeBadge.setAttribute('data-info', effectiveType.toLowerCase() === 'active' ? 'equipment.badgeActiveHelp' : 'equipment.badgePassiveHelp');
        } else {
            typeBadge.style.display = 'none';
        }
    }
    if (rarityBadge) {
        rarityBadge.style.display = '';
        rarityBadge.textContent = translatedRarity;
        rarityBadge.className = `eq-badge badge-${effectiveRarity.toLowerCase()}`;
        rarityBadge.setAttribute('data-info', 'equipment.badgeRarityHelp');
        rarityBadge.setAttribute('data-info-rarity', translatedRarity);
    }

    // Get User TownHall from state for recommendation target resolution
    const recBadge = document.getElementById('eq-details-rec-badge');
    const recBannerContainer = document.getElementById('eq-details-rec-banner-container');
    const rec = data.recommendation;

    // Resolve TownHall accurately from playerProfile or allPlayersData
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

    const modifierKeys = ['standard', 'legend3', 'legend2', 'legend1', 'esports'];
    let activeModifierTab = sessionActiveModifierTab || state.uiSettings?.leagueModifier || getDefaultModifierKeyFromState();
    sessionActiveModifierTab = activeModifierTab;
    const equipId = data.id || equipmentName;

    const hasUnitStatsView = Boolean(data.hasSpawnedUnits && data.spawnedUnits);
    let renderUnitStatsView = null;

    // Helper to render modifier tab bar
    const updateTabIndicator = (isInstant = false) => {
        if (!modifierTabsContainer) return;
        let indicator = modifierTabsContainer.querySelector('.mod-tab-indicator');
        if (!indicator) return;
        const activeBtn = modifierTabsContainer.querySelector(`.mod-tab-btn[data-mod-key="${activeModifierTab}"]`);
        if (activeBtn) {
            const containerRect = modifierTabsContainer.getBoundingClientRect();
            const btnRect = activeBtn.getBoundingClientRect();
            const left = btnRect.left - containerRect.left + modifierTabsContainer.scrollLeft;
            const width = btnRect.width;

            if (isInstant) {
                indicator.style.transition = 'none';
                indicator.style.transform = `translateX(${left}px)`;
                indicator.style.width = `${width}px`;
                void indicator.offsetHeight;
                indicator.style.transition = '';
            } else {
                indicator.style.transform = `translateX(${left}px)`;
                indicator.style.width = `${width}px`;
            }
        }
    };

    const renderModifierTabs = () => {
        if (!modifierTabsContainer) return;
        if (!hasValidLevels || !data.statsMeta) {
            modifierTabsContainer.style.display = 'none';
            modifierTabsContainer.innerHTML = '';
            return;
        }

        modifierTabsContainer.style.display = 'inline-flex';
        let html = '<div class="mod-tab-indicator"></div>';
        for (const mKey of modifierKeys) {
            const label = translate(`equipment.modifiers.${mKey}`);
            const activeClass = mKey === activeModifierTab ? 'active' : '';
            html += `<button type="button" class="mod-tab-btn ${activeClass}" data-mod-key="${mKey}">${label}</button>`;
        }
        modifierTabsContainer.innerHTML = html;

        modifierTabsContainer.onscroll = () => {
            updateTabIndicator(true);
        };

        if (modifierTabsContainer.__resizeObserver) {
            modifierTabsContainer.__resizeObserver.disconnect();
        }

        const handleResize = () => {
            requestAnimationFrame(() => updateTabIndicator(false));
        };

        if (window.ResizeObserver) {
            const ro = new ResizeObserver(() => {
                handleResize();
            });
            ro.observe(modifierTabsContainer);
            modifierTabsContainer.__resizeObserver = ro;
        }

        window.addEventListener('resize', handleResize);

        requestAnimationFrame(() => {
            updateTabIndicator(true);
            const activeBtn = modifierTabsContainer.querySelector('.mod-tab-btn.active');
            if (activeBtn) {
                activeBtn.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
            }
        });

        modifierTabsContainer.querySelectorAll('.mod-tab-btn').forEach(btn => {
            btn.onclick = () => {
                const newKey = btn.dataset.modKey;
                if (newKey !== activeModifierTab) {
                    const prevModeMap = getCurrentStatsStateMap();
                    const prevUnitMap = (typeof getCurrentUnitStatsStateMap === 'function') ? getCurrentUnitStatsStateMap() : null;
                    activeModifierTab = newKey;
                    sessionActiveModifierTab = newKey;
                    modifierTabsContainer.querySelectorAll('.mod-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.modKey === activeModifierTab));
                    btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    updateTabIndicator(false);
                    updateModifierView(prevModeMap, prevUnitMap);
                }
            };
        });
    };

    const getCurrentStatsStateMap = () => {
        const map = {};
        if (data.statsMeta && levelsArray.length > 0) {
            const effective = computeEffectiveLevels(currentLevel, calculatedMaxLevel, data.rarity || equipmentRarity, activeModifierTab);
            const activeLevelObj = levelsArray[effective.effectiveLevel - 1] || levelsArray[0];
            const maxLevelObj = levelsArray[effective.effectiveMaxLevel - 1] || levelsArray[levelsArray.length - 1];

            data.statsMeta.forEach((meta, idx) => {
                const getStatValue = (obj) => {
                    if (!obj) return 0;
                    if (Array.isArray(obj)) return obj[idx];
                    const raw = obj.stats ? obj.stats[meta.key] : obj[meta.key];
                    return typeof raw === 'object' ? raw.value : raw;
                };

                const rawNumVal = getStatValue(activeLevelObj);
                const rawMaxVal = getStatValue(maxLevelObj) || rawNumVal || 1;
                const isMod = isStatModifiable(meta);
                const multiplier = isMod ? (MODIFIER_HERO_BOOST_MULTIPLIERS[activeModifierTab] || 1.00) : 1.00;
                const baseNumVal = (typeof rawNumVal === 'number') ? Math.round(rawNumVal * multiplier * 100) / 100 : rawNumVal;
                const maxVal = (typeof rawMaxVal === 'number') ? Math.round(rawMaxVal * multiplier * 100) / 100 : rawMaxVal;
                const basePct = Math.min(100, Math.max(0, Math.round(((baseNumVal || 0) / (maxVal || 1)) * 100)));
                map[meta.key] = { numVal: baseNumVal, pct: basePct };
            });
        }
        return map;
    };

    // Helper to update recommendation badge, strategy banner, and level headers for active tab
    const updateModifierView = (previousModeMap = null, previousUnitMap = null) => {
        const { recStatus, targetRecLevel, isAutoMax } = resolveModifierRecommendation(rec, activeModifierTab, userTH, calculatedMaxLevel, Boolean(data?.isUnreleased));
        const effective = computeEffectiveLevels(currentLevel, calculatedMaxLevel, data.rarity || equipmentRarity, activeModifierTab);

        // Expose currentModalContext for all elements in modal to consume
        data.modalModifierContext = {
            activeModifier: activeModifierTab,
            effectiveLevel: effective.effectiveLevel,
            effectiveMaxLevel: effective.effectiveMaxLevel,
            isDowngraded: effective.isDowngraded,
            recStatus,
            targetRecLevel
        };

        const isUnreleased = Boolean(data?.isUnreleased || (data?.id || equipmentName).toLowerCase().includes('coming_soon') || recStatus === 'unreleased');
        const isMustHave = recStatus === 'must_have';
        const isNotRecommended = recStatus === 'not_recommended';
        const isNiche = recStatus === 'niche';
        const isRecommended = recStatus === 'recommended';

        // Update Level Header (Level / Effective Level & Max Level / Effective Max Level)
        const lvlHeaderLabel = document.getElementById('eq-details-lvl-header-label');
        const currentLvlText = document.getElementById('eq-details-current-lvl-text');
        const maxLvlText = document.getElementById('eq-details-max-lvl-text');

        const isEsports = activeModifierTab === 'esports';
        const isEffectiveModified = isEsports || effective.isDowngraded;

        if (lvlHeaderLabel) {
            const key = isEffectiveModified ? 'equipment.modifiers.effectiveLevel' : 'validation.level';
            lvlHeaderLabel.textContent = translate(key);
            lvlHeaderLabel.dataset.i18n = key;
        }

        if (currentLvlText) {
            currentLvlText.textContent = effective.effectiveLevel;
        }

        if (maxLvlText) {
            const prefixKey = isEffectiveModified ? 'equipment.modifiers.effectiveMaxLevel' : 'equipment.maxLevel';
            const prefix = translate(prefixKey);
            maxLvlText.innerHTML = `${prefix} <strong>${effective.effectiveMaxLevel}</strong>`;
            delete maxLvlText.dataset.i18n;
        }

        // Update Tabs Active Class
        if (modifierTabsContainer) {
            modifierTabsContainer.querySelectorAll('.mod-tab-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.modKey === activeModifierTab);
            });
        }

        // Update Recommendation Badge
        if (recBadge) {
            const showLevelInBadge = !isEquipmentMaxed;
            const lvlPrefix = translate('equipment.lvl');
            const formattedLevel = (showLevelInBadge && targetRecLevel) ? `${lvlPrefix} ${targetRecLevel}` : '';
            const levelDisplay = (showLevelInBadge && isAutoMax) ? `${translate('validation.max')} (${formattedLevel})` : formattedLevel;
            if (isUnreleased) {
                recBadge.style.display = 'inline-flex';
                recBadge.innerHTML = `<orecalc-assets-svg name="sparkles" class="badge-icon"></orecalc-assets-svg> <span>${translate('equipment.unreleased')}</span>`;
                recBadge.className = 'eq-badge badge-unreleased';
                recBadge.setAttribute('data-info', 'equipment.recUnreleasedHelp');
            } else if (isMustHave) {
                recBadge.style.display = 'inline-flex';
                const recText = levelDisplay ? `${translate('equipment.mustHave')}: ${levelDisplay}` : translate('equipment.mustHave');
                recBadge.innerHTML = `<orecalc-assets-svg name="thumbs-double" class="badge-icon"></orecalc-assets-svg> <span>${recText}</span>`;
                recBadge.className = 'eq-badge badge-must-have';
                recBadge.setAttribute('data-info', 'equipment.recMustHaveHelp');
            } else if (isNotRecommended) {
                recBadge.style.display = 'inline-flex';
                const notRecText = translate('equipment.notRecommended');
                recBadge.innerHTML = `<orecalc-assets-svg name="thumbs-down" class="badge-icon"></orecalc-assets-svg> <span>${notRecText}</span>`;
                recBadge.className = 'eq-badge badge-not-recommended';
                recBadge.setAttribute('data-info', 'equipment.recNotRecommendedHelp');
            } else if (isNiche) {
                recBadge.style.display = 'inline-flex';
                const recText = levelDisplay ? `${translate('equipment.niche')}: ${levelDisplay}` : translate('equipment.niche');
                recBadge.innerHTML = `<orecalc-assets-svg name="extension" class="badge-icon"></orecalc-assets-svg> <span>${recText}</span>`;
                recBadge.className = 'eq-badge badge-niche';
                recBadge.setAttribute('data-info', 'equipment.recNicheHelp');
            } else if (isRecommended) {
                recBadge.style.display = 'inline-flex';
                const recText = levelDisplay ? `${translate('equipment.recommended')}: ${levelDisplay}` : translate('equipment.recommended');
                recBadge.innerHTML = `<orecalc-assets-svg name="thumbs-up" class="badge-icon"></orecalc-assets-svg> <span>${recText}</span>`;
                recBadge.className = 'eq-badge badge-recommended';
                recBadge.setAttribute('data-info', 'equipment.recRecommendedHelp');
            } else {
                recBadge.style.display = 'none';
                recBadge.removeAttribute('data-info');
            }
        }

        // Update Banner Text (Banner notes only shown for unreleased, not_recommended, and niche equipment)
        const unhideNoteBtn = document.getElementById('unhide-eq-note-btn');
        let noteText = null;
        let bannerType = 'recommended';
        if (isUnreleased) {
            bannerType = 'unreleased';
            noteText = translate('equipment.recUnreleasedHelp');
        } else if (!isEquipmentMaxed && rec) {
            if (isNotRecommended) {
                bannerType = 'not_recommended';
                noteText = translate('equipment.recNotRecommendedHelp');
            } else if (isNiche) {
                bannerType = 'niche';
                noteText = translate('equipment.recNicheHelp');
            }
        }

        const isTableExpanded = Boolean(sessionTableExpanded || (modal && modal.classList.contains('has-expanded-table')));
        const isExplicitlyDismissed = sessionRecommendationHidden !== null ? sessionRecommendationHidden : dismissedNotes.has(equipId);
        const isNoteHidden = isTableExpanded || isExplicitlyDismissed;

        if (!noteText) {
            if (recBannerContainer) recBannerContainer.innerHTML = '';
            if (unhideNoteBtn) unhideNoteBtn.style.display = 'none';
        } else if (isNoteHidden) {
            if (recBannerContainer) recBannerContainer.innerHTML = '';
            if (unhideNoteBtn) {
                unhideNoteBtn.style.display = 'inline-flex';
                unhideNoteBtn.onclick = () => {
                    dismissedNotes.delete(equipId);
                    sessionRecommendationHidden = false;
                    sessionTableExpanded = false;
                    const tableWrapper = modal ? modal.querySelector('.eq-details-table-wrapper') : null;
                    const expandBtn = modal ? modal.querySelector('#expand-eq-table-btn') : null;
                    if (tableWrapper) tableWrapper.classList.remove('table-expanded');
                    if (modal) modal.classList.remove('has-expanded-table');
                    if (expandBtn) {
                        const iconSvg = expandBtn.querySelector('orecalc-assets-svg');
                        if (iconSvg) iconSvg.setAttribute('name', 'expand');
                        expandBtn.setAttribute('title', translate('actions.expandTable'));
                    }
                    updateModifierView();
                };
            }
        } else {
            if (unhideNoteBtn) unhideNoteBtn.style.display = 'none';
            if (recBannerContainer) {
                let bannerThemeClass = 'banner-recommended';
                let bannerIconName = 'thumbs-up';
                if (bannerType === 'unreleased') {
                    bannerThemeClass = 'banner-unreleased';
                    bannerIconName = 'sparkles';
                } else if (bannerType === 'must_have') {
                    bannerThemeClass = 'banner-must-have';
                    bannerIconName = 'thumbs-double';
                } else if (bannerType === 'not_recommended') {
                    bannerThemeClass = 'banner-not-recommended';
                    bannerIconName = 'thumbs-down';
                } else if (bannerType === 'niche') {
                    bannerThemeClass = 'banner-niche';
                    bannerIconName = 'suggestion';
                }
                const hideLabel = translate('actions.hide');
                recBannerContainer.innerHTML = `
                    <div class="eq-details-desc-banner rec-banner-card app-message-box ${bannerThemeClass}">
                        <div class="banner-messages-wrapper app-message-box-content">
                            <div class="banner-message app-message-box-item">
                                <orecalc-assets-svg name="${bannerIconName}" class="banner-icon"></orecalc-assets-svg>
                                <span class="banner-text">${noteText}</span>
                            </div>
                        </div>
                        <button type="button" class="hide-suggestion-btn dismiss-banner-btn app-message-box-btn">${hideLabel}</button>
                    </div>
                `;
                const dismissBtn = recBannerContainer.querySelector('.dismiss-banner-btn');
                if (dismissBtn) {
                    dismissBtn.onclick = () => {
                        dismissedNotes.add(equipId);
                        sessionRecommendationHidden = true;
                        updateModifierView();
                    };
                }
            }
        }
        if (hasUnitStatsView && renderUnitStatsView) {
            renderUnitStatsView(effective.effectiveLevel, false, previousUnitMap);
        }
        if (renderStatsProgressListFn) {
            renderStatsProgressListFn(false, previousModeMap);
        }
        if (renderTableBodyFn) {
            renderTableBodyFn();
        }

        requestAnimationFrame(() => {
            const activeRow = modal.querySelector('.active-level-row, .active-max-level-row');
            const tableHead = modal.querySelector('#eq-details-table-head');
            const tableContainer = modal.querySelector('.eq-details-table-container');
            if (activeRow && tableContainer) {
                const headerHeight = tableHead ? tableHead.offsetHeight : 0;
                const targetScrollTop = Math.max(0, activeRow.offsetTop - headerHeight);
                tableContainer.scrollTop = targetScrollTop;
            }
        });
    };

    let updateStatsProgressHover = null;
    let renderStatsProgressListFn = null;
    let renderTableBodyFn = null;
    renderModifierTabs();
    updateModifierView();

    // Populate Properties Grid (hide if empty)
    const propsGrid = document.getElementById('eq-details-props-grid');
    if (propsGrid) {
        if (data.properties && data.properties.length > 0) {
            propsGrid.style.display = 'grid';
            propsGrid.innerHTML = data.properties.map(p => `
                <div class="prop-item">
                    <span class="prop-label">${p.labelKey ? translate(p.labelKey) : p.label}</span>
                    <span class="prop-value">${p.valueKey ? translate(p.valueKey) : p.value}</span>
                </div>
            `).join('');
        } else {
            propsGrid.style.display = 'none';
        }
    }

    const levelLabel = translate('validation.level');
    const maxLevelLabel = translate('equipment.maxLevel');

    // Render Static Stats Content if present
    const staticStatsContent = document.getElementById('eq-details-static-stats-content');
    if (staticStatsContent) {
        if (data.staticStats && data.staticStats.length > 0) {
            const staticTitleText = translate('equipment.generalStats');
            const formatVal = (v, vUnit) => {
                if (v === undefined || v === null) return '-';
                if (vUnit === 'percentage' || vUnit === 'percent') return `${v}%`;
                if (vUnit === 'seconds') {
                    const sSuffix = translate('time.secondsSuffix');
                    return `${v}${sSuffix}`;
                }
                if (vUnit === 'tiles') {
                    const tilesSuffix = translate('equipment.tilesSuffix');
                    return `${v} ${tilesSuffix}`;
                }
                if (typeof v === 'number') return v.toLocaleString();
                return String(v);
            };

            const rowsHTML = data.staticStats.map(stat => {
                const label = translate(`equipment.stats.${stat.key}`);
                const formattedVal = formatVal(stat.value, stat.valueUnit);
                return `
                    <div class="stat-progress-row">
                        <div class="stat-label-line">
                            <span class="stat-name">${label}</span>
                            <span class="stat-val">${formattedVal}</span>
                        </div>
                    </div>
                `;
            }).join('');

            staticStatsContent.innerHTML = `
                <div class="eq-details-stats-progress-list" style="margin-top: 12px;">
                    ${rowsHTML}
                </div>
            `;
            staticStatsContent.style.display = 'block';
        } else {
            staticStatsContent.innerHTML = '';
            staticStatsContent.style.display = 'none';
        }
    }

    // Render Unit Stats Toggle View for Equipment-Scaled Spawners
    const toggleBtn = document.getElementById('eq-unit-stats-toggle-btn');
    const staticBox = document.getElementById('eq-details-static-box');
    const unitStatsContent = document.getElementById('eq-details-unit-stats-content');
    const overviewElements = staticBox ? staticBox.querySelectorAll('.eq-details-header-row, .eq-details-avatars, .eq-details-badges, #eq-details-static-stats-content') : [];

    let currentViewMode = 'overview';

    const getCurrentUnitStatsStateMap = () => {
        const map = {};
        if (data.hasSpawnedUnits && data.spawnedUnits) {
            const sp = data.spawnedUnits;
            const effective = computeEffectiveLevels(currentLevel, calculatedMaxLevel, data.rarity || equipmentRarity, activeModifierTab);
            const targetLevel = effective.effectiveLevel;
            let unitLevel = targetLevel;

            if (sp.scalingType === 'laboratoryLevel') {
                const labTroops = state.playerProfile?.labTroops || {};
                const val = labTroops[sp.unitType];
                if (typeof val === 'number') unitLevel = val;
                else if (val && val.level) unitLevel = val.level;
                else {
                    const availableLevels = Object.keys(sp.levels || {}).map(Number).sort((a, b) => a - b);
                    unitLevel = availableLevels.length > 0 ? availableLevels[availableLevels.length - 1] : 1;
                }
            } else {
                let summonedLevelIdx = -1;
                if (data.statsMeta) summonedLevelIdx = data.statsMeta.findIndex(m => m.key === 'summonedUnitsLevel');
                const levelObj = levelsArray[targetLevel - 1] || levelsArray[0];
                if (summonedLevelIdx !== -1 && Array.isArray(levelObj)) {
                    unitLevel = levelObj[summonedLevelIdx] || targetLevel;
                } else if (levelObj && typeof levelObj === 'object') {
                    unitLevel = levelObj.summonedUnitsLevel || targetLevel;
                }
            }

            const spLevelsMap = sp.levels || {};
            const unitStatValues = spLevelsMap[String(unitLevel)] || spLevelsMap[unitLevel] || [];
            const allSpLevels = Object.keys(spLevelsMap).map(Number).sort((a, b) => a - b);
            const maxSpLevel = allSpLevels.length > 0 ? allSpLevels[allSpLevels.length - 1] : unitLevel;
            const maxUnitStatValues = spLevelsMap[String(maxSpLevel)] || unitStatValues;

            (sp.statsMeta || []).forEach((meta, idx) => {
                const numVal = Array.isArray(unitStatValues) ? unitStatValues[idx] : unitStatValues[meta.key];
                const maxVal = Array.isArray(maxUnitStatValues) ? maxUnitStatValues[idx] : maxUnitStatValues[meta.key];
                const safeNum = typeof numVal === 'number' ? numVal : 0;
                const safeMax = typeof maxVal === 'number' && maxVal > 0 ? maxVal : safeNum || 1;
                const pct = Math.min(100, Math.round((safeNum / safeMax) * 100));
                map[meta.key] = { numVal: safeNum, pct };
            });
        }
        return map;
    };

    const updateUnitStatsHover = (hoverLevel = null) => {
        if (!unitStatsContent || !data.spawnedUnits) return;
        const sp = data.spawnedUnits;
        if (!unitStatsContent.__lastHoveredUnitValues) {
            unitStatsContent.__lastHoveredUnitValues = {};
        }

        const effective = computeEffectiveLevels(currentLevel, calculatedMaxLevel, data.rarity || equipmentRarity, activeModifierTab);
        const activeLevel = effective.effectiveLevel;

        const activeLevelObj = levelsArray[activeLevel - 1] || levelsArray[0];

        let hoverLevelObj = null;
        if (hoverLevel !== null && hoverLevel >= 1 && hoverLevel <= levelsArray.length) {
            const clampedHoverLevel = Math.min(hoverLevel, effective.effectiveMaxLevel);
            hoverLevelObj = levelsArray[clampedHoverLevel - 1] || activeLevelObj;
        } else {
            unitStatsContent.__lastHoveredUnitValues = {};
        }

        const getUnitLevelFromEquipmentLevel = (eqLvl) => {
            if (sp.scalingType === 'laboratoryLevel') {
                const labTroops = state.playerProfile?.labTroops || {};
                const val = labTroops[sp.unitType];
                if (typeof val === 'number') return val;
                if (val && val.level) return val.level;
                const availableLevels = Object.keys(sp.levels || {}).map(Number).sort((a, b) => a - b);
                return availableLevels.length > 0 ? availableLevels[availableLevels.length - 1] : 1;
            }
            let summonedLevelIdx = -1;
            if (data.statsMeta) summonedLevelIdx = data.statsMeta.findIndex(m => m.key === 'summonedUnitsLevel');
            const levelObj = levelsArray[eqLvl - 1] || levelsArray[0];
            if (summonedLevelIdx !== -1 && Array.isArray(levelObj)) {
                return levelObj[summonedLevelIdx] || eqLvl;
            } else if (levelObj && typeof levelObj === 'object') {
                return levelObj.summonedUnitsLevel || eqLvl;
            }
            return eqLvl;
        };

        const activeUnitLevel = getUnitLevelFromEquipmentLevel(activeLevel);
        const targetUnitLevel = hoverLevelObj ? getUnitLevelFromEquipmentLevel(hoverLevelObj === activeLevelObj ? activeLevel : (levelsArray.indexOf(hoverLevelObj) + 1)) : activeUnitLevel;

        const badgeEl = unitStatsContent.querySelector('.unit-level-badge');
        const isEquipmentScaled = sp.scalingType !== 'laboratoryLevel';
        const isUnitLvlModified = isEquipmentScaled && (activeModifierTab === 'esports' || effective.isDowngraded);
        if (badgeEl) {
            const levelLabelText = translate('validation.level');
            badgeEl.classList.toggle('stat-val-modified', isUnitLvlModified);
            badgeEl.textContent = `${levelLabelText} ${targetUnitLevel}`;
        }

        const spLevelsMap = sp.levels || {};
        const baseUnitStatValues = spLevelsMap[String(activeUnitLevel)] || spLevelsMap[activeUnitLevel] || [];
        const hoverUnitStatValues = spLevelsMap[String(targetUnitLevel)] || spLevelsMap[targetUnitLevel] || [];

        const allSpLevels = Object.keys(spLevelsMap).map(Number).sort((a, b) => a - b);
        const maxSpLevel = allSpLevels.length > 0 ? allSpLevels[allSpLevels.length - 1] : activeUnitLevel;
        const maxUnitStatValues = spLevelsMap[String(maxSpLevel)] || baseUnitStatValues;

        const formatVal = (v, vUnit) => {
            if (v === undefined || v === null) return '-';
            if (typeof v !== 'number') return String(v);
            if (vUnit === 'seconds' || vUnit === 'tiles') {
                const num = Math.round(v * 10) / 10;
                return `${num.toLocaleString()}${vUnit === 'seconds' ? 's' : ' tiles'}`;
            }
            const isInt = Number.isInteger(v);
            const numStr = isInt ? Math.round(v).toLocaleString() : (Math.round(v * 10) / 10).toLocaleString();
            if (vUnit === 'percentage' || vUnit === 'percent') return `${numStr}%`;
            return numStr;
        };

        const rowElements = unitStatsContent.querySelectorAll('.stat-progress-row');

        (sp.statsMeta || []).forEach((meta, idx) => {
            const rowEl = rowElements[idx];
            if (!rowEl) return;

            const baseNumVal = Array.isArray(baseUnitStatValues) ? baseUnitStatValues[idx] : baseUnitStatValues[meta.key];
            const hoverNumVal = Array.isArray(hoverUnitStatValues) ? hoverUnitStatValues[idx] : hoverUnitStatValues[meta.key];
            const maxVal = Array.isArray(maxUnitStatValues) ? maxUnitStatValues[idx] : maxUnitStatValues[meta.key];

            const safeBase = typeof baseNumVal === 'number' ? baseNumVal : 0;
            const safeHover = typeof hoverNumVal === 'number' ? hoverNumVal : safeBase;
            const safeMax = typeof maxVal === 'number' && maxVal > 0 ? maxVal : safeBase || 1;

            const isLowerBetter = meta.deltaType === 'decrease' || meta.lowerIsBetter === true || meta.key.toLowerCase().includes('cooldown');
            const basePct = Math.min(100, Math.max(0, Math.round((safeBase / safeMax) * 100)));
            const hoverPct = Math.min(100, Math.max(0, Math.round((safeHover / safeMax) * 100)));

            let mainWidth = basePct;
            let increaseWidth = basePct;
            let decreaseWidth = basePct;
            let isComparing = false;

            if (hoverLevelObj && hoverLevelObj !== activeLevelObj) {
                const diff = Math.round((safeHover - safeBase) * 100) / 100;
                const isSame = diff === 0;
                const isGain = isLowerBetter ? diff < 0 : diff > 0;

                isComparing = true;

                if (isSame) {
                    mainWidth = basePct;
                    increaseWidth = basePct;
                    decreaseWidth = basePct;
                } else if (isGain) {
                    if (isLowerBetter) {
                        mainWidth = hoverPct;
                        increaseWidth = hoverPct;
                        decreaseWidth = basePct;
                    } else {
                        mainWidth = basePct;
                        increaseWidth = hoverPct;
                        decreaseWidth = basePct;
                    }
                } else {
                    if (isLowerBetter) {
                        mainWidth = basePct;
                        increaseWidth = hoverPct;
                        decreaseWidth = hoverPct;
                    } else {
                        mainWidth = hoverPct;
                        increaseWidth = hoverPct;
                        decreaseWidth = basePct;
                    }
                }

                const diffSign = formatDiffVal(diff, meta.valueUnit);
                const formattedBase = formatVal(safeBase, meta.valueUnit);
                const formattedHover = formatVal(safeHover, meta.valueUnit);
                const deltaTextClass = isGain ? 'val-increase' : (isSame ? '' : 'val-decrease');

                const prevHoverVal = unitStatsContent.__lastHoveredUnitValues[meta.key];
                const startVal = (prevHoverVal !== undefined && typeof prevHoverVal === 'number') ? prevHoverVal : safeBase;
                unitStatsContent.__lastHoveredUnitValues[meta.key] = safeHover;

                rowEl.classList.toggle('is-comparing', isComparing);
                const valEl = rowEl.querySelector('.stat-val');
                if (valEl) {
                    const existingCompare = valEl.querySelector('.stat-val-compare');
                    const existingHoverSpan = valEl.querySelector('.stat-val-hover');

                    const isIntStat = Number.isInteger(startVal) && Number.isInteger(safeHover);
                    const formatAnimVal = (v, vUnit) => {
                        if (v === undefined || v === null) return '-';
                        if (typeof v !== 'number') return String(v);

                        if (vUnit === 'seconds' || vUnit === 'tiles') {
                            const num = Math.round(v * 10) / 10;
                            return `${num.toLocaleString()}${vUnit === 'seconds' ? 's' : ' tiles'}`;
                        }

                        const isInt = isIntStat || Number.isInteger(v);
                        const num = isInt ? Math.round(v) : (Math.round(v * 10) / 10);
                        if (vUnit === 'percentage' || vUnit === 'percent') return `${num.toLocaleString()}%`;
                        return num.toLocaleString();
                    };

                    const isMod = isStatModifiable(meta);
                    const isModified = isUnitLvlModified || (isMod && activeModifierTab !== 'standard');
                    const modClass = isModified ? 'stat-val-modified' : '';

                    if (!isSame) {
                        if (!existingCompare) {
                            valEl.innerHTML = `
                                <span class="stat-val-compare">
                                    <span class="stat-val-base ${modClass}">${formattedBase}</span>
                                    <span class="stat-val-arrow">→</span>
                                    <span class="stat-val-hover ${deltaTextClass}">${formattedHover} (${diffSign})</span>
                                </span>
                            `;
                            const newHoverSpan = valEl.querySelector('.stat-val-hover');
                            if (newHoverSpan && startVal !== safeHover) {
                                const stepDelta = Math.abs(safeHover - startVal);
                                const animDuration = Math.min(450, Math.max(150, Math.round(Math.log10(stepDelta + 1) * 160)));
                                animateValue(newHoverSpan, startVal, safeHover, animDuration, (v) => {
                                    return `${formatAnimVal(v, meta.valueUnit)} (${diffSign})`;
                                });
                            }
                        } else if (existingHoverSpan) {
                            existingHoverSpan.className = `stat-val-hover ${deltaTextClass}`;
                            if (startVal !== safeHover) {
                                const stepDelta = Math.abs(safeHover - startVal);
                                const animDuration = Math.min(450, Math.max(150, Math.round(Math.log10(stepDelta + 1) * 160)));
                                animateValue(existingHoverSpan, startVal, safeHover, animDuration, (v) => {
                                    return `${formatAnimVal(v, meta.valueUnit)} (${diffSign})`;
                                });
                            }
                        }
                    } else {
                        valEl.innerHTML = `<span class="unit-stat-val-number ${modClass}">${formatVal(safeBase, meta.valueUnit)}</span>`;
                    }
                }
            } else {
                rowEl.classList.remove('is-comparing');
                const valEl = rowEl.querySelector('.stat-val');
                if (valEl) {
                    const isMod = isStatModifiable(meta);
                    const isModified = isUnitLvlModified || (isMod && activeModifierTab !== 'standard');
                    const modClass = isModified ? 'stat-val-modified' : '';
                    valEl.innerHTML = `<span class="unit-stat-val-number ${modClass}">${formatVal(safeBase, meta.valueUnit)}</span>`;
                }
            }

            const fillEl = rowEl.querySelector('.progress-bar-fill');
            const incEl = rowEl.querySelector('.progress-bar-increase');
            const decEl = rowEl.querySelector('.progress-bar-decrease');

            if (fillEl) fillEl.style.width = `${mainWidth}%`;
            if (incEl) incEl.style.width = `${increaseWidth}%`;
            if (decEl) decEl.style.width = `${decreaseWidth}%`;
        });
    };

    renderUnitStatsView = (targetLevel, animateEntry = false, previousUnitMap = null) => {
        if (!unitStatsContent || !data.spawnedUnits) return;

        const effective = computeEffectiveLevels(currentLevel, calculatedMaxLevel, data.rarity || equipmentRarity, activeModifierTab);
        const sp = data.spawnedUnits;
        const unitTypeKey = sp.unitType;
        const translatedUnitName = translate(`equipment.unitTypes.${unitTypeKey}`);

        let unitLevel = targetLevel;

        if (sp.scalingType === 'laboratoryLevel') {
            const labTroops = state.playerProfile?.labTroops || {};
            const val = labTroops[unitTypeKey];
            if (typeof val === 'number') {
                unitLevel = val;
            } else if (val && typeof val === 'object' && val.level) {
                unitLevel = val.level;
            } else {
                const availableLevels = Object.keys(sp.levels || {}).map(Number).sort((a, b) => a - b);
                unitLevel = availableLevels.length > 0 ? availableLevels[availableLevels.length - 1] : 1;
            }
        } else {
            let summonedLevelIdx = -1;
            if (data.statsMeta) {
                summonedLevelIdx = data.statsMeta.findIndex(m => m.key === 'summonedUnitsLevel');
            }

            const levelObj = levelsArray[targetLevel - 1] || levelsArray[0];

            if (summonedLevelIdx !== -1 && Array.isArray(levelObj)) {
                unitLevel = levelObj[summonedLevelIdx] || targetLevel;
            } else if (levelObj && typeof levelObj === 'object') {
                unitLevel = levelObj.summonedUnitsLevel || targetLevel;
            }
        }

        const spLevelsMap = sp.levels || {};
        const unitStatValues = spLevelsMap[String(unitLevel)] || spLevelsMap[unitLevel] || [];

        const allSpLevels = Object.keys(spLevelsMap).map(Number).sort((a, b) => a - b);
        const maxSpLevel = allSpLevels.length > 0 ? allSpLevels[allSpLevels.length - 1] : unitLevel;
        const maxUnitStatValues = spLevelsMap[String(maxSpLevel)] || unitStatValues;

        const levelLabelText = translate('validation.level');

        const formatVal = (v, vUnit) => {
            if (v === undefined || v === null) return '-';
            if (typeof v !== 'number') return String(v);
            if (vUnit === 'seconds' || vUnit === 'tiles') {
                const num = Math.round(v * 10) / 10;
                return `${num.toLocaleString()}${vUnit === 'seconds' ? 's' : ' tiles'}`;
            }
            const isInt = Number.isInteger(v);
            const numStr = isInt ? Math.round(v).toLocaleString() : (Math.round(v * 10) / 10).toLocaleString();
            if (vUnit === 'percentage' || vUnit === 'percent') return `${numStr}%`;
            return numStr;
        };

        const rowsHTML = (sp.statsMeta || []).map((meta, idx) => {
            const numVal = Array.isArray(unitStatValues) ? unitStatValues[idx] : unitStatValues[meta.key];
            const maxVal = Array.isArray(maxUnitStatValues) ? maxUnitStatValues[idx] : maxUnitStatValues[meta.key];
            const safeNum = typeof numVal === 'number' ? numVal : 0;
            const safeMax = typeof maxVal === 'number' && maxVal > 0 ? maxVal : safeNum || 1;

            const pct = Math.min(100, Math.round((safeNum / safeMax) * 100));
            const statLabel = translate(`equipment.stats.${meta.key}`) || translate(`equipment.${meta.key}`) || meta.key;

            const prevUnitData = previousUnitMap ? previousUnitMap[meta.key] : null;
            const isModeAnim = prevUnitData && typeof prevUnitData.numVal === 'number';

            const startVal = isModeAnim ? prevUnitData.numVal : (animateEntry ? 0 : safeNum);
            const startPct = isModeAnim ? prevUnitData.pct : (animateEntry ? 0 : pct);

            const initialWidth = (animateEntry || isModeAnim) ? startPct : pct;
            const initialValDisplay = (animateEntry || isModeAnim) ? formatVal(startVal, meta.valueUnit) : formatVal(safeNum, meta.valueUnit);

            const isEquipmentScaled = sp.scalingType !== 'laboratoryLevel';
            const isMod = isStatModifiable(meta);
            const isModified = (isEquipmentScaled && (activeModifierTab === 'esports' || effective.isDowngraded)) || (isMod && activeModifierTab !== 'standard');
            const modClass = isModified ? 'stat-val-modified' : '';

            return `
                <div class="stat-progress-row" data-unit-stat-idx="${idx}">
                    <div class="stat-label-line">
                        <span class="stat-name">${statLabel}</span>
                        <span class="stat-val"><span class="unit-stat-val-number ${modClass}" data-start-val="${startVal}" data-target-val="${safeNum}">${initialValDisplay}</span></span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill ${(animateEntry || isModeAnim) ? 'is-initial-animating' : ''}" data-target-width="${pct}" style="width: ${initialWidth}%;"></div>
                        <div class="progress-bar-increase ${(animateEntry || isModeAnim) ? 'is-initial-animating' : ''}" data-target-width="${pct}" style="width: ${initialWidth}%;"></div>
                        <div class="progress-bar-decrease ${(animateEntry || isModeAnim) ? 'is-initial-animating' : ''}" data-target-width="${pct}" style="width: ${initialWidth}%;"></div>
                    </div>
                </div>
            `;
        }).join('');

        const isEquipmentScaled = sp.scalingType !== 'laboratoryLevel';
        const isUnitLvlModified = isEquipmentScaled && (activeModifierTab === 'esports' || effective.isDowngraded);
        const badgeClass = isUnitLvlModified ? 'unit-level-badge stat-val-modified' : 'unit-level-badge';

        unitStatsContent.innerHTML = `
            <div class="unit-stats-card-box">
                <div class="unit-stats-header">
                    <div class="unit-stats-title-group">
                        <span class="unit-title">${translatedUnitName}</span>
                        <span class="${badgeClass}">${levelLabelText} ${unitLevel}</span>
                    </div>
                </div>
                <div class="eq-details-stats-progress-list unit-stats-list">
                    ${rowsHTML}
                </div>
            </div>
        `;

        if (animateEntry || previousUnitMap) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    unitStatsContent.querySelectorAll('.progress-bar-fill, .progress-bar-increase, .progress-bar-decrease').forEach((bar) => {
                        const targetWidth = bar.getAttribute('data-target-width');
                        if (targetWidth !== null) {
                            bar.style.width = `${targetWidth}%`;
                        }
                    });

                    unitStatsContent.querySelectorAll('.stat-progress-row').forEach((row, idx) => {
                        const meta = (sp.statsMeta || [])[idx];
                        if (!meta) return;
                        const numSpan = row.querySelector('.unit-stat-val-number');
                        if (numSpan) {
                            const startVal = parseFloat(numSpan.getAttribute('data-start-val'));
                            const targetVal = parseFloat(numSpan.getAttribute('data-target-val'));
                            if (!isNaN(startVal) && !isNaN(targetVal) && startVal !== targetVal) {
                                const isIntStat = Number.isInteger(startVal) && Number.isInteger(targetVal);
                                const formatAnimValue = (v, vUnit) => {
                                    if (v === undefined || v === null) return '-';
                                    if (typeof v !== 'number') return String(v);

                                    if (vUnit === 'seconds' || vUnit === 'tiles') {
                                        const num = Math.round(v * 10) / 10;
                                        return `${num.toLocaleString()}${vUnit === 'seconds' ? 's' : ' tiles'}`;
                                    }

                                    const isInt = isIntStat || Number.isInteger(v);
                                    const num = isInt ? Math.round(v) : (Math.round(v * 10) / 10);
                                    if (vUnit === 'percentage' || vUnit === 'percent') return `${num.toLocaleString()}%`;
                                    return num.toLocaleString();
                                };
                                const delta = Math.abs(targetVal - startVal);
                                const animDuration = Math.min(450, Math.max(150, Math.round(Math.log10(delta + 1) * 160)));
                                animateValue(numSpan, startVal, targetVal, animDuration, (v) => formatAnimValue(v, meta.valueUnit));
                            }
                        }
                    });
                });
            });
        }
    };

    if (toggleBtn) {
        if (hasUnitStatsView) {
            const unitStatsBtnLabel = translate('equipment.unitStats');
            const overviewBtnLabel = translate('equipment.overview');

            toggleBtn.style.display = 'inline-flex';

            if (sessionViewModePreference === 'unitStats') {
                currentViewMode = 'unitStats';
                toggleBtn.innerHTML = `<orecalc-assets-svg name="group" class="toggle-btn-icon"></orecalc-assets-svg> <span>${overviewBtnLabel}</span>`;
                overviewElements.forEach(el => el.style.display = 'none');
                const effective = computeEffectiveLevels(currentLevel, calculatedMaxLevel, data.rarity || equipmentRarity, activeModifierTab);
                renderUnitStatsView(effective.effectiveLevel, false);
                if (unitStatsContent) unitStatsContent.style.display = 'block';
            } else {
                currentViewMode = 'overview';
                toggleBtn.innerHTML = `<orecalc-assets-svg name="group" class="toggle-btn-icon"></orecalc-assets-svg> <span>${unitStatsBtnLabel}</span>`;
                if (unitStatsContent) unitStatsContent.style.display = 'none';
                overviewElements.forEach(el => el.style.display = '');
            }

            toggleBtn.onclick = () => {
                const modifierTabs = document.getElementById('eq-details-modifier-tabs');
                const firstRect = modifierTabs ? modifierTabs.getBoundingClientRect() : null;

                if (currentViewMode === 'overview') {
                    currentViewMode = 'unitStats';
                    sessionViewModePreference = 'unitStats';
                    toggleBtn.innerHTML = `<orecalc-assets-svg name="group" class="toggle-btn-icon"></orecalc-assets-svg> <span>${overviewBtnLabel}</span>`;
                    overviewElements.forEach(el => el.style.display = 'none');
                    const effective = computeEffectiveLevels(currentLevel, calculatedMaxLevel, data.rarity || equipmentRarity, activeModifierTab);
                    renderUnitStatsView(effective.effectiveLevel, true);
                    if (unitStatsContent) unitStatsContent.style.display = 'block';
                } else {
                    currentViewMode = 'overview';
                    sessionViewModePreference = 'overview';
                    toggleBtn.innerHTML = `<orecalc-assets-svg name="group" class="toggle-btn-icon"></orecalc-assets-svg> <span>${unitStatsBtnLabel}</span>`;
                    if (unitStatsContent) unitStatsContent.style.display = 'none';
                    overviewElements.forEach(el => el.style.display = '');
                }

                if (modifierTabs && firstRect) {
                    const lastRect = modifierTabs.getBoundingClientRect();
                    const deltaY = firstRect.top - lastRect.top;
                    if (Math.abs(deltaY) > 2) {
                        modifierTabs.style.transition = 'none';
                        modifierTabs.style.transform = `translateY(${deltaY}px)`;
                        // Force reflow
                        void modifierTabs.offsetHeight;
                        requestAnimationFrame(() => {
                            modifierTabs.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.8, 0.25, 1)';
                            modifierTabs.style.transform = 'translateY(0)';
                        });
                    }
                }
            };
        } else {
            currentViewMode = 'overview';
            toggleBtn.style.display = 'none';
            if (unitStatsContent) unitStatsContent.style.display = 'none';
            overviewElements.forEach(el => el.style.display = '');
        }
    }

    // Render Stats Progress List Structure (rendered once or on tab change)
    renderStatsProgressListFn = (animateEntry = false, previousModeMap = null) => {
        const statsProgressList = document.getElementById('eq-details-stats-progress-list');
        if (statsProgressList && (!data.statsMeta || levelsArray.length === 0)) {
            const metaList = (data.statsMeta && data.statsMeta.length > 0) ? data.statsMeta : null;
            let barsHTML = '';
            if (metaList) {
                barsHTML = metaList.map(meta => {
                    const statLabel = translate(`equipment.stats.${meta.key}`) || translate(`equipment.${meta.key}`) || meta.key;
                    return `
                        <div class="stat-progress-row">
                            <div class="stat-label-line">
                                <span class="stat-name" title="${statLabel}"><span class="stat-name-text">${statLabel}</span></span>
                                <span class="stat-val"><span class="stat-val-number">-</span></span>
                            </div>
                            <div class="progress-bar-bg">
                                <div class="progress-bar-fill" style="width: 0%;"></div>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                const notAvailableLabel = translate('equipment.dataNotAvailable');
                for (let i = 0; i < 3; i++) {
                    barsHTML += `
                        <div class="stat-progress-row">
                            <div class="stat-label-line">
                                <span class="stat-name" title="${notAvailableLabel}"><span class="stat-name-text">${notAvailableLabel}</span></span>
                                <span class="stat-val"><span class="stat-val-number">-</span></span>
                            </div>
                            <div class="progress-bar-bg">
                                <div class="progress-bar-fill" style="width: 0%;"></div>
                            </div>
                        </div>
                    `;
                }
            }
            statsProgressList.innerHTML = barsHTML;
            return;
        }

        if (statsProgressList && data.statsMeta && levelsArray.length > 0) {
            const effective = computeEffectiveLevels(currentLevel, calculatedMaxLevel, data.rarity || equipmentRarity, activeModifierTab);
            const activeLevelObj = levelsArray[effective.effectiveLevel - 1] || levelsArray[0];
            const maxLevelObj = levelsArray[effective.effectiveMaxLevel - 1] || levelsArray[levelsArray.length - 1];

            statsProgressList.innerHTML = data.statsMeta.map((meta, idx) => {
                const getStatValue = (obj) => {
                    if (!obj) return 0;
                    if (Array.isArray(obj)) return obj[idx];
                    const raw = obj.stats ? obj.stats[meta.key] : obj[meta.key];
                    return typeof raw === 'object' ? raw.value : raw;
                };

                const rawNumVal = getStatValue(activeLevelObj);
                const rawMaxVal = getStatValue(maxLevelObj) || rawNumVal || 1;

                const isMod = isStatModifiable(meta);
                const multiplier = isMod ? (MODIFIER_HERO_BOOST_MULTIPLIERS[activeModifierTab] || 1.00) : 1.00;

                const baseNumVal = (typeof rawNumVal === 'number') ? Math.round(rawNumVal * multiplier * 100) / 100 : rawNumVal;
                const maxVal = (typeof rawMaxVal === 'number') ? Math.round(rawMaxVal * multiplier * 100) / 100 : rawMaxVal;

                const statLabel = translate(`equipment.stats.${meta.key}`) || translate(`equipment.${meta.key}`) || meta.key;
                const formatVal = (v, vUnit) => {
                    if (v === undefined || v === null) return '-';
                    if (typeof v !== 'number') return String(v);
                    const isInt = Number.isInteger(v);
                    const numStr = isInt ? Math.round(v).toLocaleString() : (Math.round(v * 100) / 100).toLocaleString();
                    if (vUnit === 'percentage' || vUnit === 'percent') return `${numStr}%`;
                    if (vUnit === 'seconds') return `${numStr}s`;
                    if (vUnit === 'tiles') return `${numStr} tiles`;
                    return numStr;
                };

                const basePct = Math.min(100, Math.max(0, Math.round(((baseNumVal || 0) / (maxVal || 1)) * 100)));
                const prevModeData = previousModeMap ? previousModeMap[meta.key] : null;
                const isModeAnim = prevModeData && typeof prevModeData.numVal === 'number';

                const startVal = isModeAnim ? prevModeData.numVal : (animateEntry ? 0 : baseNumVal);
                const startPct = isModeAnim ? prevModeData.pct : (animateEntry ? 0 : basePct);

                const initialWidth = (animateEntry || isModeAnim) ? startPct : basePct;
                const initialValDisplay = (animateEntry || isModeAnim) ? formatVal(startVal, meta.valueUnit) : formatVal(baseNumVal, meta.valueUnit);

                const isSummonedLvlModified = meta.key === 'summonedUnitsLevel' && (activeModifierTab === 'esports' || effective.isDowngraded);
                const isModified = (isMod && activeModifierTab !== 'standard') || isSummonedLvlModified;
                const modifiedClass = isModified ? 'stat-val-modified' : '';

                return `
                    <div class="stat-progress-row" data-stat-idx="${idx}">
                        <div class="stat-label-line">
                            <span class="stat-name" title="${statLabel}"><span class="stat-name-text">${statLabel}</span></span>
                            <span class="stat-val"><span class="stat-val-number ${modifiedClass}" data-start-val="${startVal}" data-target-val="${baseNumVal}">${initialValDisplay}</span></span>
                        </div>
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill ${(animateEntry || isModeAnim) ? 'is-initial-animating' : ''}" data-target-width="${basePct}" style="width: ${initialWidth}%;"></div>
                            <div class="progress-bar-increase ${(animateEntry || isModeAnim) ? 'is-initial-animating' : ''}" data-target-width="${basePct}" style="width: ${initialWidth}%;"></div>
                            <div class="progress-bar-decrease ${(animateEntry || isModeAnim) ? 'is-initial-animating' : ''}" data-target-width="${basePct}" style="width: ${initialWidth}%;"></div>
                        </div>
                    </div>
                `;
            }).join('');

            if (animateEntry || previousModeMap) {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        statsProgressList.querySelectorAll('.progress-bar-fill, .progress-bar-increase, .progress-bar-decrease').forEach((bar) => {
                            const targetWidth = bar.getAttribute('data-target-width');
                            if (targetWidth !== null) {
                                bar.style.width = `${targetWidth}%`;
                            }
                        });

                        statsProgressList.querySelectorAll('.stat-progress-row').forEach((row, idx) => {
                            const meta = data.statsMeta[idx];
                            if (!meta) return;
                            const numSpan = row.querySelector('.stat-val-number');
                            if (numSpan) {
                                const startVal = parseFloat(numSpan.getAttribute('data-start-val'));
                                const targetVal = parseFloat(numSpan.getAttribute('data-target-val'));
                                if (!isNaN(startVal) && !isNaN(targetVal) && startVal !== targetVal) {
                                    const isIntStat = Number.isInteger(startVal) && Number.isInteger(targetVal);
                                    const formatAnimValue = (v, vUnit) => {
                                        if (v === undefined || v === null) return '-';
                                        if (typeof v !== 'number') return String(v);

                                        if (vUnit === 'seconds' || vUnit === 'tiles') {
                                            const num = Math.round(v * 10) / 10;
                                            return `${num.toLocaleString()}${vUnit === 'seconds' ? 's' : ' tiles'}`;
                                        }

                                        const isInt = isIntStat || Number.isInteger(v);
                                        const num = isInt ? Math.round(v) : (Math.round(v * 10) / 10);
                                        if (vUnit === 'percentage' || vUnit === 'percent') return `${num.toLocaleString()}%`;
                                        return num.toLocaleString();
                                    };
                                    const delta = Math.abs(targetVal - startVal);
                                    const animDuration = Math.min(450, Math.max(150, Math.round(Math.log10(delta + 1) * 160)));
                                    animateValue(numSpan, startVal, targetVal, animDuration, (v) => formatAnimValue(v, meta.valueUnit));
                                }
                            }
                        });
                    });
                });
            }
        }
    };

    updateStatsProgressHover = (hoverLevel = null) => {
        if (currentViewMode === 'unitStats') {
            updateUnitStatsHover(hoverLevel);
        }
        const statsProgressList = document.getElementById('eq-details-stats-progress-list');
        if (statsProgressList && data.statsMeta && levelsArray.length > 0) {
            if (!statsProgressList.__lastHoveredValues) {
                statsProgressList.__lastHoveredValues = {};
            }

            const effective = computeEffectiveLevels(currentLevel, calculatedMaxLevel, data.rarity || equipmentRarity, activeModifierTab);
            const activeLevelObj = levelsArray[effective.effectiveLevel - 1] || levelsArray[0];
            const maxLevelObj = levelsArray[effective.effectiveMaxLevel - 1] || levelsArray[levelsArray.length - 1];

            let hoverLevelObj = null;
            if (hoverLevel !== null && hoverLevel >= 1 && hoverLevel <= levelsArray.length) {
                const clampedHoverLevel = Math.min(hoverLevel, effective.effectiveMaxLevel);
                hoverLevelObj = levelsArray[clampedHoverLevel - 1] || activeLevelObj;
            } else {
                statsProgressList.__lastHoveredValues = {};
            }

            const rowElements = statsProgressList.querySelectorAll('.stat-progress-row');

            data.statsMeta.forEach((meta, idx) => {
                const rowEl = rowElements[idx];
                if (!rowEl) return;

                const getStatValue = (obj) => {
                    if (!obj) return 0;
                    if (Array.isArray(obj)) return obj[idx];
                    const raw = obj.stats ? obj.stats[meta.key] : obj[meta.key];
                    return typeof raw === 'object' ? raw.value : raw;
                };

                const rawNumVal = getStatValue(activeLevelObj);
                const rawMaxVal = getStatValue(maxLevelObj) || rawNumVal || 1;

                const isMod = isStatModifiable(meta);
                const multiplier = isMod ? (MODIFIER_HERO_BOOST_MULTIPLIERS[activeModifierTab] || 1.00) : 1.00;

                const baseNumVal = (typeof rawNumVal === 'number') ? Math.round(rawNumVal * multiplier * 100) / 100 : rawNumVal;
                const maxVal = (typeof rawMaxVal === 'number') ? Math.round(rawMaxVal * multiplier * 100) / 100 : rawMaxVal;

                const formatVal = (v, vUnit) => {
                    if (v === undefined || v === null) return '-';
                    if (typeof v !== 'number') return String(v);
                    if (vUnit === 'seconds' || vUnit === 'tiles') {
                        const num = Math.round(v * 10) / 10;
                        return `${num.toLocaleString()}${vUnit === 'seconds' ? 's' : ' tiles'}`;
                    }
                    const isInt = Number.isInteger(v);
                    const numStr = isInt ? Math.round(v).toLocaleString() : (Math.round(v * 10) / 10).toLocaleString();
                    if (vUnit === 'percentage' || vUnit === 'percent') return `${numStr}%`;
                    return numStr;
                };

                const isLowerBetter = meta.deltaType === 'decrease' || meta.lowerIsBetter === true || meta.key.toLowerCase().includes('cooldown');
                const basePct = Math.min(100, Math.max(0, Math.round(((baseNumVal || 0) / (maxVal || 1)) * 100)));

                let mainWidth = basePct;
                let increaseWidth = basePct;
                let decreaseWidth = basePct;
                let isComparing = false;
                let valDisplayHTML = `<span>${formatVal(baseNumVal, meta.valueUnit)}</span>`;

                if (hoverLevelObj && hoverLevelObj !== activeLevelObj) {
                    const rawHoverVal = getStatValue(hoverLevelObj);
                    const hoverNumVal = (typeof rawHoverVal === 'number') ? Math.round(rawHoverVal * multiplier * 100) / 100 : rawHoverVal;

                    if (typeof baseNumVal === 'number' && typeof hoverNumVal === 'number' && typeof maxVal === 'number' && maxVal > 0) {
                        const diff = Math.round((hoverNumVal - baseNumVal) * 100) / 100;
                        const isSame = diff === 0;
                        const isGain = isLowerBetter ? diff < 0 : diff > 0;
                        const hoverPct = Math.min(100, Math.max(0, Math.round((hoverNumVal / maxVal) * 100)));

                        isComparing = true;

                        if (isSame) {
                            mainWidth = basePct;
                            increaseWidth = basePct;
                            decreaseWidth = basePct;
                        } else if (isGain) {
                            if (isLowerBetter) {
                                mainWidth = hoverPct;
                                increaseWidth = hoverPct;
                                decreaseWidth = basePct;
                            } else {
                                mainWidth = basePct;
                                increaseWidth = hoverPct;
                                decreaseWidth = basePct;
                            }
                        } else {
                            if (isLowerBetter) {
                                mainWidth = basePct;
                                increaseWidth = hoverPct;
                                decreaseWidth = hoverPct;
                            } else {
                                mainWidth = hoverPct;
                                increaseWidth = hoverPct;
                                decreaseWidth = basePct;
                            }
                        }

                        const diffSign = formatDiffVal(diff, meta.valueUnit);
                        const formattedBase = formatVal(baseNumVal, meta.valueUnit);
                        const formattedHover = formatVal(hoverNumVal, meta.valueUnit);
                        const deltaTextClass = isGain ? 'val-increase' : (isSame ? '' : 'val-decrease');

                        if (!isSame) {
                            valDisplayHTML = `
                                <span class="stat-val-compare">
                                    <span class="stat-val-base">${formattedBase}</span>
                                    <span class="stat-val-arrow">→</span>
                                    <span class="stat-val-hover ${deltaTextClass}">${formattedHover} (${diffSign})</span>
                                </span>
                            `;
                        }
                    }
                }

                rowEl.classList.toggle('is-comparing', isComparing);
                const valEl = rowEl.querySelector('.stat-val');
                if (valEl) {
                    if (isComparing && typeof baseNumVal === 'number' && hoverLevelObj) {
                        const rawHoverVal = getStatValue(hoverLevelObj);
                        const hoverNumVal = (typeof rawHoverVal === 'number') ? Math.round(rawHoverVal * multiplier * 100) / 100 : rawHoverVal;
                        const diff = Math.round((hoverNumVal - baseNumVal) * 100) / 100;
                        const diffSign = formatDiffVal(diff, meta.valueUnit);
                        const formattedBase = formatVal(baseNumVal, meta.valueUnit);
                        const formattedHover = formatVal(hoverNumVal, meta.valueUnit);

                        const isSame = diff === 0;
                        const isGain = isLowerBetter ? diff < 0 : diff > 0;
                        const deltaTextClass = isGain ? 'val-increase' : (isSame ? '' : 'val-decrease');

                        const prevHoverVal = statsProgressList.__lastHoveredValues[meta.key];
                        const startVal = (prevHoverVal !== undefined && typeof prevHoverVal === 'number') ? prevHoverVal : baseNumVal;
                        statsProgressList.__lastHoveredValues[meta.key] = hoverNumVal;

                        const existingCompare = valEl.querySelector('.stat-val-compare');
                        const existingHoverSpan = valEl.querySelector('.stat-val-hover');

                        const isIntStat = Number.isInteger(startVal) && Number.isInteger(hoverNumVal);
                        const formatAnimVal = (v, vUnit) => {
                            if (v === undefined || v === null) return '-';
                            if (typeof v !== 'number') return String(v);

                            if (vUnit === 'seconds' || vUnit === 'tiles') {
                                const num = Math.round(v * 10) / 10;
                                return `${num.toLocaleString()}${vUnit === 'seconds' ? 's' : ' tiles'}`;
                            }

                            const isInt = isIntStat || Number.isInteger(v);
                            const num = isInt ? Math.round(v) : (Math.round(v * 10) / 10);
                            if (vUnit === 'percentage' || vUnit === 'percent') return `${num.toLocaleString()}%`;
                            return num.toLocaleString();
                        };

                        const isMod = isStatModifiable(meta);
                        const isSummonedLvlModified = meta.key === 'summonedUnitsLevel' && (activeModifierTab === 'esports' || effective.isDowngraded);
                        const isModified = (isMod && activeModifierTab !== 'standard') || isSummonedLvlModified;
                        const modClass = isModified ? 'stat-val-modified' : '';

                        if (!existingCompare) {
                            valEl.innerHTML = `
                                <span class="stat-val-compare">
                                    <span class="stat-val-base ${modClass}">${formattedBase}</span>
                                    <span class="stat-val-arrow">→</span>
                                    <span class="stat-val-hover ${deltaTextClass}">${formattedHover} (${diffSign})</span>
                                </span>
                            `;
                            const newHoverSpan = valEl.querySelector('.stat-val-hover');
                            if (newHoverSpan && startVal !== hoverNumVal) {
                                const stepDelta = Math.abs(hoverNumVal - startVal);
                                const animDuration = Math.min(450, Math.max(150, Math.round(Math.log10(stepDelta + 1) * 160)));
                                animateValue(newHoverSpan, startVal, hoverNumVal, animDuration, (v) => {
                                    return `${formatAnimVal(v, meta.valueUnit)} (${diffSign})`;
                                });
                            }
                        } else if (existingHoverSpan) {
                            existingHoverSpan.className = `stat-val-hover ${deltaTextClass}`;
                            if (startVal !== hoverNumVal) {
                                const stepDelta = Math.abs(hoverNumVal - startVal);
                                const animDuration = Math.min(450, Math.max(150, Math.round(Math.log10(stepDelta + 1) * 160)));
                                animateValue(existingHoverSpan, startVal, hoverNumVal, animDuration, (v) => {
                                    return `${formatAnimVal(v, meta.valueUnit)} (${diffSign})`;
                                });
                            }
                        }
                    } else {
                        const isMod = isStatModifiable(meta);
                        const isSummonedLvlModified = meta.key === 'summonedUnitsLevel' && (activeModifierTab === 'esports' || effective.isDowngraded);
                        const isModified = (isMod && activeModifierTab !== 'standard') || isSummonedLvlModified;
                        const modClass = isModified ? 'stat-val-modified' : '';
                        valEl.innerHTML = `<span class="stat-val-number ${modClass}">${formatVal(baseNumVal, meta.valueUnit)}</span>`;
                    }
                }

                const fillEl = rowEl.querySelector('.progress-bar-fill');
                const incEl = rowEl.querySelector('.progress-bar-increase');
                const decEl = rowEl.querySelector('.progress-bar-decrease');

                if (fillEl) fillEl.style.width = `${mainWidth}%`;
                if (incEl) incEl.style.width = `${increaseWidth}%`;
                if (decEl) decEl.style.width = `${decreaseWidth}%`;
            });
        };
    };
    renderStatsProgressListFn(true);

    // Populate Level Table
    const tableHead = document.getElementById('eq-details-table-head');
    const tableBody = document.getElementById('eq-details-table-body');
    const isEpic = (data.rarity || equipmentRarity || '').toLowerCase() === 'epic';

    if (tableHead && tableBody) {
        const shinyText = translate('ores.shiny');
        const glowyText = translate('ores.glowy');
        const starryText = translate('ores.starry');
        const reqTHText = translate('equipment.requiredTownHall');

        // Calculate category spans for statsMeta
        const categoryGroups = [];
        (data.statsMeta || []).forEach(meta => {
            const catKey = meta.category || 'ability';
            const lastGroup = categoryGroups[categoryGroups.length - 1];
            if (lastGroup && lastGroup.category === catKey) {
                lastGroup.count += 1;
            } else {
                categoryGroups.push({ category: catKey, count: 1 });
            }
        });

        const categorySuperHeadersHTML = categoryGroups.map(group => {
            const title = translate(`equipment.${group.category}`);
            return `<th colspan="${group.count}" class="category-header category-${group.category}">${title}</th>`;
        }).join('');

        const oreCostCount = isEpic ? 3 : 2;
        const costTitle = translate('equipment.cost');
        const costSuperHeaderHTML = `<th colspan="${oreCostCount}" class="category-header category-cost">${costTitle}</th>`;

        const subHeadersStatHTML = (data.statsMeta || []).map(meta => `<th><span class="stat-name">${translate(`equipment.stats.${meta.key}`) || translate(`equipment.${meta.key}`) || meta.key}</span></th>`).join('');
        const subHeadersOreHTML = `
            <th>${shinyText}</th>
            <th>${glowyText}</th>
            ${isEpic ? `<th>${starryText}</th>` : ''}
        `;

        tableHead.innerHTML = `
            <tr class="super-header-row">
                <th rowspan="2">${levelLabel}</th>
                ${categorySuperHeadersHTML}
                ${costSuperHeaderHTML}
                <th rowspan="2">${reqTHText}</th>
            </tr>
            <tr class="sub-header-row">
                ${subHeadersStatHTML}
                ${subHeadersOreHTML}
            </tr>
        `;

        requestAnimationFrame(() => {
            if (window.innerWidth <= 779) return;
            const categoryCell = tableHead.querySelector('.super-header-row th.category-header') || tableHead.querySelector('.super-header-row th:not([rowspan])');
            if (categoryCell) {
                const row1Height = categoryCell.getBoundingClientRect().height;
                if (row1Height > 0) {
                    tableHead.querySelectorAll('.sub-header-row th').forEach(cell => {
                        cell.style.top = `${row1Height}px`;
                    });
                }
            }
        });

        renderTableBodyFn = () => {
            const effective = computeEffectiveLevels(currentLevel, calculatedMaxLevel, data.rarity || equipmentRarity, activeModifierTab);
            const activeCurrentLevel = effective.effectiveLevel;
            const activeMaxLevel = effective.effectiveMaxLevel;

            const totalRows = calculatedMaxLevel;
            const rowNumbers = Array.from({ length: totalRows }, (_, i) => i + 1);

            const levelRowsHTML = rowNumbers.map(levelNumber => {
                const index = levelNumber - 1;
                const lvlObj = levelsArray[index] || null;
                const prevLvlObj = index > 0 ? (levelsArray[index - 1] || null) : null;
                const isUnavailableInEsports = activeModifierTab === 'esports' && levelNumber > activeMaxLevel;
                const isPast = levelNumber < activeCurrentLevel || isUnavailableInEsports;
                const isActive = !isUnavailableInEsports && levelNumber === activeCurrentLevel;
                const cost = getEquipmentUpgradeCost(levelNumber);
                const reqTH = getRequiredTownHall(levelNumber, data.rarity || equipmentRarity, heroKey);
                const isUnreachableTH = activeModifierTab === 'standard' && userTH && reqTH > userTH;

                const isMaxLevel = !isUnavailableInEsports && levelNumber === activeMaxLevel;
                const isFuture = !isUnavailableInEsports && levelNumber > activeCurrentLevel;
                const isStepLevel = levelNumber % 3 === 0;

                const isStarryStep = isEpic && cost.starry > 0;
                const isGlowyStep = cost.glowy > 0 && !isStarryStep;

                let rowClass = '';
                if (isUnavailableInEsports) {
                    rowClass = 'past-level-row unavailable-esports-row';
                } else if (isActive && isMaxLevel) {
                    rowClass = 'active-max-level-row';
                } else if (isActive) {
                    rowClass = 'active-level-row';
                } else if (isPast || isUnreachableTH) {
                    rowClass = 'past-level-row';
                } else if (isMaxLevel) {
                    rowClass = 'max-level-step-row';
                } else if (isFuture && isStepLevel) {
                    rowClass = 'step-level-row';
                }

                const rowClassAttr = rowClass ? `class="${rowClass}"` : '';

                const statCellsHTML = (data.statsMeta || []).map((meta, metaIdx) => {
                    const getStatVal = (obj) => {
                        if (!obj) return undefined;
                        if (Array.isArray(obj)) return obj[metaIdx];
                        const raw = obj.stats ? obj.stats[meta.key] : obj[meta.key];
                        return typeof raw === 'object' ? raw.value : raw;
                    };

                    const rawVal = getStatVal(lvlObj);
                    const rawPrevVal = getStatVal(prevLvlObj);

                    const isMod = isStatModifiable(meta);
                    const multiplier = isMod ? (MODIFIER_HERO_BOOST_MULTIPLIERS[activeModifierTab] || 1.00) : 1.00;

                    const val = (rawVal !== undefined && rawVal !== null && typeof rawVal === 'number')
                        ? Math.round(rawVal * multiplier * 100) / 100
                        : rawVal;

                    const prevVal = (rawPrevVal !== undefined && rawPrevVal !== null && typeof rawPrevVal === 'number')
                        ? Math.round(rawPrevVal * multiplier * 100) / 100
                        : rawPrevVal;

                    const deltaText = computeStatDelta(val, prevVal, meta.deltaType, meta.valueUnit || 'number', meta.category || 'ability');
                    const isMainStat = meta.category === 'ability';
                    const deltaClass = isMainStat ? 'delta-tag delta-tag-main' : 'delta-tag';
                    const deltaHTML = deltaText ? `<span class="${deltaClass}">(${deltaText})</span>` : '';
                    const formatStatValue = (v, vUnit) => {
                        if (v === undefined || v === null) return '-';
                        if (typeof v !== 'number') return String(v);
                        if (vUnit === 'seconds' || vUnit === 'tiles') {
                            const num = Math.round(v * 10) / 10;
                            return `${formatNumber(num)}${vUnit === 'seconds' ? 's' : ' tiles'}`;
                        }
                        const isInt = Number.isInteger(v);
                        const numStr = isInt ? Math.round(v) : (Math.round(v * 10) / 10);
                        if (vUnit === 'percentage' || vUnit === 'percent') return `${formatNumber(numStr)}%`;
                        return formatNumber(numStr);
                    };

                    const displayVal = formatStatValue(val, meta.valueUnit);
                    const isSummonedLvlModified = meta.key === 'summonedUnitsLevel' && (activeModifierTab === 'esports' || effective.isDowngraded);
                    const isModified = (isMod && activeModifierTab !== 'standard') || isSummonedLvlModified;
                    const cellValHTML = isModified ? `<span class="stat-val-modified">${displayVal}</span>` : `<span>${displayVal}</span>`;

                    return `<td><span class="stat-cell-wrapper">${cellValHTML}${deltaHTML}</span></td>`;
                }).join('');

                const shinyDisplay = cost.shiny > 0
                    ? `<span class="shiny-cost-highlight">${formatNumber(cost.shiny)}</span>`
                    : '-';

                const glowyDisplay = cost.glowy > 0
                    ? `<span class="glowy-cost-highlight">${formatNumber(cost.glowy)}</span>`
                    : '-';

                const starryDisplay = cost.starry > 0
                    ? `<span class="starry-cost-highlight">${formatNumber(cost.starry)}</span>`
                    : '-';

                const starryCellHTML = isEpic ? `<td><div class="ore-cost-cell">${starryDisplay}</div></td>` : '';

                const activeRecRes = resolveModifierRecommendation(rec, activeModifierTab, userTH, calculatedMaxLevel);
                const activeTargetLevel = activeRecRes.targetRecLevel;
                const isRecTarget = !isEquipmentMaxed && activeTargetLevel && levelNumber === activeTargetLevel;
                const recTargetIcon = isRecTarget ? `<orecalc-assets-svg name="thumbs-up" class="rec-level-icon" title="Target Level"></orecalc-assets-svg>` : '';

                const thText = translate('equipment.thShort', { level: reqTH }) || `TH ${reqTH}`;

                return `
                <tr ${rowClassAttr}>
                    <td><div class="level-cell-content">${recTargetIcon}<span>${levelNumber}</span></div></td>
                    ${statCellsHTML}
                    <td><div class="ore-cost-cell">${shinyDisplay}</div></td>
                    <td><div class="ore-cost-cell">${glowyDisplay}</div></td>
                    ${starryCellHTML}
                    <td>
                        <div class="th-req-cell">
                            <orecalc-assets-image src="assets/th/th${reqTH}.png" alt="${thText}" class="th-cell-img"></orecalc-assets-image>
                            <span>${thText}</span>
                        </div>
                    </td>
                </tr>
            `;
            }).join('');

            const isAtLeast2BelowMax = (calculatedMaxLevel - currentLevel) >= 2;
            let totalCostRowHTML = '';
            if (isAtLeast2BelowMax) {
                let totalShiny = 0;
                let totalGlowy = 0;
                let totalStarry = 0;

                levelsArray.forEach((lvlObj, index) => {
                    const levelNumber = index + 1;
                    if (levelNumber > currentLevel && levelNumber <= activeMaxLevel) {
                        const cost = getEquipmentUpgradeCost(levelNumber);
                        totalShiny += (cost.shiny || 0);
                        totalGlowy += (cost.glowy || 0);
                        if (isEpic) {
                            totalStarry += (cost.starry || 0);
                        }
                    }
                });

                const totalShinyDisplay = totalShiny > 0 ? `<span class="shiny-cost-highlight">${formatNumber(totalShiny)}</span>` : '-';
                const totalGlowyDisplay = totalGlowy > 0 ? `<span class="glowy-cost-highlight">${formatNumber(totalGlowy)}</span>` : '-';
                const totalStarryDisplay = totalStarry > 0 ? `<span class="starry-cost-highlight">${formatNumber(totalStarry)}</span>` : '-';
                const totalStarryCellHTML = isEpic ? `<td><div class="ore-cost-cell">${totalStarryDisplay}</div></td>` : '';
                const totalLabel = translate('equipment.totalCost');

                const statsCount = data.statsMeta ? data.statsMeta.length : 0;
                let levelCellHTML = '<td></td>';
                let totalStatCellsHTML = '';

                if (statsCount === 0) {
                    levelCellHTML = `<td><div class="level-cell-content"><span class="total-cost-label">${totalLabel}</span></div></td>`;
                } else {
                    totalStatCellsHTML = (data.statsMeta || []).map((_, idx) => {
                        if (idx === statsCount - 1) {
                            return `<td class="total-cost-label-cell"><span class="total-cost-label">${totalLabel}</span></td>`;
                        }
                        return '<td></td>';
                    }).join('');
                }

                totalCostRowHTML = `
                    <tr class="total-cost-row">
                        ${levelCellHTML}
                        ${totalStatCellsHTML}
                        <td><div class="ore-cost-cell">${totalShinyDisplay}</div></td>
                        <td><div class="ore-cost-cell">${totalGlowyDisplay}</div></td>
                        ${totalStarryCellHTML}
                        <td></td>
                    </tr>
                `;
            }

            tableBody.innerHTML = levelRowsHTML + totalCostRowHTML;

            let hoverResetTimer = null;

            tableBody.querySelectorAll('tr:not(.total-cost-row)').forEach((row, idx) => {
                const levelNum = idx + 1;
                row.addEventListener('mouseenter', () => {
                    if (hoverResetTimer !== null) {
                        cancelAnimationFrame(hoverResetTimer);
                        hoverResetTimer = null;
                    }
                    if (updateStatsProgressHover) {
                        updateStatsProgressHover(levelNum);
                    }
                });
                row.addEventListener('mouseleave', () => {
                    if (hoverResetTimer !== null) {
                        cancelAnimationFrame(hoverResetTimer);
                    }
                    hoverResetTimer = requestAnimationFrame(() => {
                        hoverResetTimer = null;
                        if (updateStatsProgressHover) {
                            updateStatsProgressHover(null);
                        }
                    });
                });
            });
        };

        renderTableBodyFn();

        const footerMetaElem = modal.querySelector('#eq-details-footer-meta');
        if (footerMetaElem) {
            const formattedDate = formatRegionalDate(EQUIPMENT_STATS_LAST_UPDATED);
            const dateText = translate('equipment.statsLastUpdated', { date: formattedDate });
            const reportText = translate('equipment.reportInaccuracies');
            const attributionText = translate('equipment.detailsAttribution');
            footerMetaElem.innerHTML = `
                <div class="eq-details-footer-top-row">
                    <span class="eq-details-report-inaccuracies">${reportText}</span>
                    <span class="eq-details-last-updated">${dateText}</span>
                </div>
                <div class="eq-details-attribution-row">${attributionText}</div>
            `;
        }

        modal.classList.add('show');

        // Setup Expand Table button toggle
        const expandBtn = modal.querySelector('#expand-eq-table-btn');
        const tableWrapper = modal.querySelector('.eq-details-table-wrapper');
        const tableContainer = modal.querySelector('.eq-details-table-container');

        if (expandBtn && tableWrapper) {
            tableWrapper.classList.toggle('table-expanded', sessionTableExpanded);
            modal.classList.toggle('has-expanded-table', sessionTableExpanded);
            const iconSvg = expandBtn.querySelector('orecalc-assets-svg');
            if (iconSvg) iconSvg.setAttribute('name', sessionTableExpanded ? 'compress' : 'expand');
            expandBtn.setAttribute(
                'title',
                sessionTableExpanded ? translate('actions.compressTable') : translate('actions.expandTable')
            );

            expandBtn.onclick = () => {
                const isExpanded = tableWrapper.classList.toggle('table-expanded');
                modal.classList.toggle('has-expanded-table', isExpanded);
                sessionTableExpanded = isExpanded;
                if (iconSvg) {
                    iconSvg.setAttribute('name', isExpanded ? 'compress' : 'expand');
                }
                expandBtn.setAttribute(
                    'title',
                    isExpanded ? translate('actions.compressTable') : translate('actions.expandTable')
                );

                updateModifierView();

                requestAnimationFrame(() => {
                    const activeRow = modal.querySelector('.active-level-row, .active-max-level-row');
                    const tableHead = modal.querySelector('#eq-details-table-head');
                    if (activeRow && tableContainer) {
                        const headerHeight = tableHead ? tableHead.offsetHeight : 0;
                        const targetScrollTop = Math.max(0, activeRow.offsetTop - headerHeight);
                        tableContainer.scrollTo({
                            top: targetScrollTop,
                            behavior: 'smooth'
                        });
                    }
                });
            };
        }

        // Always scroll the current level row directly below the sticky header instantly on modal open
        requestAnimationFrame(() => {
            const activeRow = modal.querySelector('.active-level-row, .active-max-level-row');
            const tableHead = modal.querySelector('#eq-details-table-head');
            if (activeRow && tableContainer) {
                const headerHeight = tableHead ? tableHead.offsetHeight : 0;
                const targetScrollTop = Math.max(0, activeRow.offsetTop - headerHeight);
                tableContainer.scrollTop = targetScrollTop;
            }
        });
    }
}

export function getFlatEquipmentsList() {
    const list = [];
    for (const hKey in heroData) {
        const heroName = heroData[hKey].name || hKey;
        const equips = heroData[hKey].equipment || heroData[hKey].equipments || [];
        equips.forEach(eq => {
            list.push({
                name: eq.name,
                id: eq.id || toCamelCase(eq.name),
                heroKey: hKey,
                heroName: heroName
            });
        });
    }
    return list;
}

function getEquipLevel(equipName, heroName = null, heroKey = null) {
    if (state && state.heroes) {
        const keysToTry = [heroName, heroKey].filter(Boolean);
        for (const k of keysToTry) {
            const level = state.heroes[k]?.equipment?.[equipName]?.level;
            if (typeof level === 'number') return level;
        }

        for (const h in state.heroes) {
            const eqMap = state.heroes[h]?.equipment;
            if (eqMap) {
                if (typeof eqMap[equipName]?.level === 'number') {
                    return eqMap[equipName].level;
                }
                for (const eqKey in eqMap) {
                    if (eqKey.toLowerCase() === equipName.toLowerCase() && typeof eqMap[eqKey]?.level === 'number') {
                        return eqMap[eqKey].level;
                    }
                }
            }
        }
    }
    const slug = equipName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const camel = toCamelCase(slug);
    const userLevels = (state && state.equipmentLevels) || {};
    return userLevels[camel] || userLevels[slug] || userLevels[equipName] || 1;
}

export function initializeEquipmentDetailsModal() {
    const modal = document.getElementById('equipment-details-modal');
    const closeBtn = document.getElementById('close-eq-details-modal-btn');
    const prevBtn = document.getElementById('eq-details-prev-btn');
    const nextBtn = document.getElementById('eq-details-next-btn');

    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
            resetModalSessionState();
            modal.classList.remove('show');
        });
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                resetModalSessionState();
                modal.classList.remove('show');
            }
        });
    }

    const navigateEquipment = async (direction) => {
        if (!activeEquipmentName) return;
        const prevBtn = document.getElementById('eq-details-prev-btn');
        const nextBtn = document.getElementById('eq-details-next-btn');

        if (direction === 'prev' && prevBtn && (prevBtn.disabled || prevBtn.classList.contains('disabled'))) return;
        if (direction === 'next' && nextBtn && (nextBtn.disabled || nextBtn.classList.contains('disabled'))) return;

        const list = getFlatEquipmentsList();
        if (list.length === 0) return;
        const currentIdx = list.findIndex(e => e.name.toLowerCase() === activeEquipmentName.toLowerCase());
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
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;

        if (e.key === 'Escape') {
            resetModalSessionState();
            modal.classList.remove('show');
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
