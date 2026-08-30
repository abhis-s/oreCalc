import { translate } from '../../i18n/translator.js';
import { resolveModifierRecommendation } from '../../domain/equipment/modifierCalculator.js';

/**
 * Renders recommendation badge with icon, target level, and localized tooltips.
 *
 * @param {HTMLElement | null} recBadge
 * @param {Object | null} data
 * @param {string} equipmentName
 * @param {Object | null} rec
 * @param {string} activeModifierTab
 * @param {number} userTH
 * @param {number} calculatedMaxLevel
 * @param {boolean} isEquipmentMaxed
 */
export function renderRecommendationBadge(recBadge, data, equipmentName, rec, activeModifierTab, userTH, calculatedMaxLevel, isEquipmentMaxed) {
    if (!recBadge) return;
    const { recStatus, targetRecLevel, isAutoMax } = resolveModifierRecommendation(rec, activeModifierTab, userTH, calculatedMaxLevel, Boolean(data?.isUnreleased));
    const isUnreleased = Boolean(data?.isUnreleased || (data?.id || equipmentName).toLowerCase().includes('coming_soon') || recStatus === 'unreleased');
    const isMustHave = recStatus === 'must_have';
    const isNotRecommended = recStatus === 'not_recommended';
    const isNiche = recStatus === 'niche';
    const isRecommended = recStatus === 'recommended';

    const showLevelInBadge = !isEquipmentMaxed;
    const lvlPrefix = translate('views.equipment.lvl');
    const formattedLevel = (showLevelInBadge && targetRecLevel) ? `${lvlPrefix} ${targetRecLevel}` : '';
    const levelDisplay = (showLevelInBadge && isAutoMax) ? `${translate('validation.max')} (${formattedLevel})` : formattedLevel;

    if (isUnreleased) {
        recBadge.style.display = 'inline-flex';
        recBadge.innerHTML = `<orecalc-assets-svg name="sparkles" class="badge-icon"></orecalc-assets-svg> <span>${translate('views.equipment.unreleased')}</span>`;
        recBadge.className = 'eq-badge badge-unreleased';
        recBadge.setAttribute('data-info', 'views.equipment.recUnreleasedHelp');
    } else if (isMustHave) {
        recBadge.style.display = 'inline-flex';
        const recText = levelDisplay ? `${translate('views.equipment.mustHave')}: ${levelDisplay}` : translate('views.equipment.mustHave');
        recBadge.innerHTML = `<orecalc-assets-svg name="thumbs-double" class="badge-icon"></orecalc-assets-svg> <span>${recText}</span>`;
        recBadge.className = 'eq-badge badge-must-have';
        recBadge.setAttribute('data-info', 'views.equipment.recMustHaveHelp');
    } else if (isNotRecommended) {
        recBadge.style.display = 'inline-flex';
        const notRecText = translate('views.equipment.notRecommended');
        recBadge.innerHTML = `<orecalc-assets-svg name="thumbs-down" class="badge-icon"></orecalc-assets-svg> <span>${notRecText}</span>`;
        recBadge.className = 'eq-badge badge-not-recommended';
        recBadge.setAttribute('data-info', 'views.equipment.recNotRecommendedHelp');
    } else if (isNiche) {
        recBadge.style.display = 'inline-flex';
        const recText = levelDisplay ? `${translate('views.equipment.niche')}: ${levelDisplay}` : translate('views.equipment.niche');
        recBadge.innerHTML = `<orecalc-assets-svg name="extension" class="badge-icon"></orecalc-assets-svg> <span>${recText}</span>`;
        recBadge.className = 'eq-badge badge-niche';
        recBadge.setAttribute('data-info', 'views.equipment.recNicheHelp');
    } else if (isRecommended) {
        recBadge.style.display = 'inline-flex';
        const recText = levelDisplay ? `${translate('views.equipment.recommended')}: ${levelDisplay}` : translate('views.equipment.recommended');
        recBadge.innerHTML = `<orecalc-assets-svg name="thumbs-up" class="badge-icon"></orecalc-assets-svg> <span>${recText}</span>`;
        recBadge.className = 'eq-badge badge-recommended';
        recBadge.setAttribute('data-info', 'views.equipment.recRecommendedHelp');
    } else {
        recBadge.style.display = 'none';
        recBadge.removeAttribute('data-info');
    }
}

/**
 * Renders dismissible strategy note banner.
 *
 * @param {HTMLElement | null} recBannerContainer
 * @param {HTMLElement | null} unhideNoteBtn
 * @param {string} equipId
 * @param {boolean} isUnreleased
 * @param {boolean} isEquipmentMaxed
 * @param {Object | null} rec
 * @param {string} activeModifierTab
 * @param {number} userTH
 * @param {number} calculatedMaxLevel
 * @param {boolean} isNoteHidden
 */
export function renderStrategyBanner(recBannerContainer, unhideNoteBtn, equipId, isUnreleased, isEquipmentMaxed, rec, activeModifierTab, userTH, calculatedMaxLevel, isNoteHidden) {
    const { recStatus } = resolveModifierRecommendation(rec, activeModifierTab, userTH, calculatedMaxLevel, isUnreleased);
    const isNotRecommended = recStatus === 'not_recommended';
    const isNiche = recStatus === 'niche';

    let noteText = null;
    let bannerType = 'recommended';
    if (isUnreleased) {
        bannerType = 'unreleased';
        noteText = translate('views.equipment.recUnreleasedHelp');
    } else if (isEquipmentMaxed) {
        noteText = null;
    } else {
        if (isNotRecommended) {
            bannerType = 'not_recommended';
            noteText = translate('views.equipment.recNotRecommendedHelp');
        } else if (isNiche) {
            bannerType = 'niche';
            noteText = translate('views.equipment.recNicheHelp');
        }
    }

    if (!noteText) {
        if (recBannerContainer) recBannerContainer.innerHTML = '';
        if (unhideNoteBtn) unhideNoteBtn.style.display = 'none';
    } else if (isNoteHidden) {
        if (recBannerContainer) recBannerContainer.innerHTML = '';
        if (unhideNoteBtn) {
            unhideNoteBtn.style.display = 'inline-flex';
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
        }
    }
}

/**
 * Renders key-value properties grid.
 *
 * @param {HTMLElement | null} propsGrid
 * @param {Object | null} data
 */
export function renderPropertiesGrid(propsGrid, data) {
    if (!propsGrid) return;
    if (data?.properties && data.properties.length > 0) {
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

/**
 * Renders static general stats section.
 *
 * @param {HTMLElement | null} staticStatsContent
 * @param {Object | null} data
 */
export function renderStaticStats(staticStatsContent, data) {
    if (!staticStatsContent) return;
    if (data?.staticStats && data.staticStats.length > 0) {
        const formatVal = (v, vUnit) => {
            if (v === undefined || v === null) return '-';
            if (vUnit === 'percentage' || vUnit === 'percent') return `${v}%`;
            if (vUnit === 'seconds') return `${v}${translate('time.secondsSuffix')}`;
            if (vUnit === 'tiles') return `${v} ${translate('views.equipment.tilesSuffix')}`;
            if (typeof v === 'number') return v.toLocaleString();
            return String(v);
        };

        const rowsHTML = data.staticStats.map(stat => {
            const label = translate(`entities.stats.${stat.key}`);
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
            <div class="eq-details-stats-progress-list">
                ${rowsHTML}
            </div>
        `;
        staticStatsContent.style.display = 'block';
    } else {
        staticStatsContent.innerHTML = '';
        staticStatsContent.style.display = 'none';
    }
}
