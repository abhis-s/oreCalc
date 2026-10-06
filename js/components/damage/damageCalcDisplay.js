/**
 * DOM Rendering Engine for Equipment Damage & ZapQuake Calculator.
 * Tier 4: UI Presentation (Dedicated exclusively to DOM rendering, 0 event listeners).
 */

import { getDefensesData } from '../../data/defenseTargetsData.js';
import { getBuildingAssetUrl } from '../../core/buildingAssetHelper.js';
import {
    getDefenseMaxHp,
    getMaxSuperchargeTier,
    isHeroDefense,
    getValidDefenseLevels,
    getMinDefenseLevel
} from '../../domain/damage/defenseProgressionDomain.js';
import { translate } from '../../i18n/translator.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { formatNumber } from '../../utils/numberFormatter.js';
import { renderSteppedSliderHtml } from '../common/steppedSlider.js';
import { getDefenseDisplayName } from '../../utils/equipmentMetadata.js';

/**
 * Resolves localized short level prefix (e.g. 'Lvl' or 'HP Lvl').
 * If a defense key or defense data object is provided and it represents a crafted defense,
 * returns the crafted level prefix (e.g. 'HP Lvl').
 *
 * @param {string|Object} [defenseOrKey=null] - Optional defense key or defense data object.
 * @returns {string} Localized level prefix.
 */
export function getLvlShort(defenseOrKey = null) {
    if (defenseOrKey) {
        const isCrafted = typeof defenseOrKey === 'object'
            ? defenseOrKey?.subCategory === 'crafted'
            : getDefensesData()?.[defenseOrKey]?.subCategory === 'crafted';
        if (isCrafted) {
            const rawCrafted = translate('views.damageCalc.filters.craftedHpLvlShort');
            return (rawCrafted && !rawCrafted.startsWith('views.')) ? rawCrafted.replace(/^\[EN\]\s*/, '') : 'HP Lvl';
        }
    }
    const raw = translate('views.equipment.lvl');
    return (raw && !raw.startsWith('views.')) ? raw.replace(/^\[EN\]\s*/, '') : 'Lvl';
}

/**
 * Resolves localized HP unit label (e.g. 'HP' or 'TP').
 * @returns {string} Localized HP unit.
 */
export function getHpUnit() {
    const raw = translate('entities.stats.hp');
    return (raw && !raw.startsWith('entities.')) ? raw.replace(/^\[EN\]\s*/, '') : 'HP';
}

/**
 * Renders HTML markup for Supercharge level pips (charged blue bolts and uncharged dark pips).
 * Uses canonical <orecalc-assets-image> custom elements per Rule 17.
 *
 * @param {number} currentTier - Currently active supercharge tier (0, 1, 2).
 * @param {number} [maxTiers=2] - Maximum available supercharge tiers for this structure.
 * @param {Object} [options={}] - Rendering options.
 * @param {string} [options.className=''] - Additional CSS class name for the wrapper.
 * @param {'compact'|'standard'|'badge'} [options.variant='standard'] - Visual sizing variant.
 * @returns {string} Safe HTML string for supercharge pips.
 */
export function renderSuperchargePipsHtml(currentTier, maxTiers = 2, options = {}) {
    const { className = '', variant = 'standard' } = options;
    const chargedSrc = '/assets/supercharge/supercharge_bolt.png';
    const unchargedSrc = '/assets/supercharge/supercharge_uncharged.png';

    let pipsHtml = '';
    for (let i = 1; i <= maxTiers; i++) {
        const isCharged = i <= currentTier;
        const src = isCharged ? chargedSrc : unchargedSrc;
        const altText = isCharged ? `${translate('views.damageCalc.offense.superchargeLabel')} · ${translate('views.damageCalc.zapQuake.tierLabel', { tier: i })}` : `${translate('views.damageCalc.offense.superchargeLabel')} (${translate('app.none')})`;
        pipsHtml += `
            <orecalc-assets-image
                src="${src}"
                alt="${altText}"
                size="thumbnail"
                class="calc-supercharge-pip ${isCharged ? 'is-charged' : 'is-uncharged'}">
            </orecalc-assets-image>
        `;
    }

    return `<span class="calc-supercharge-pips calc-supercharge-pips--${variant} ${className}">${pipsHtml}</span>`;
}

/**
 * Renders the Level Adjustment & Stats Toolbar for the selected target defense.
 *
 * @param {Object} options
 * @param {string} options.activeKey - Active building key.
 * @param {number} options.activeLevel - Active building level.
 * @param {number} [options.superchargeTier=2] - Supercharge tier.
 * @param {string} [options.prefix='zq'] - Control ID prefix.
 * @returns {string} HTML string.
 */
export function renderTargetLevelToolbar({
    activeKey,
    activeLevel,
    superchargeTier = 2,
    prefix = 'zq'
}) {
    const currentDefense = getDefensesData()[activeKey] || getDefensesData().air_defense;
    const defDisplayName = getDefenseDisplayName(activeKey);
    const maxLvl = currentDefense.maxLevel || 1;
    const minLvl = getMinDefenseLevel(activeKey);
    const currentLvl = Math.max(minLvl, Math.min(activeLevel || maxLvl, maxLvl));
    const targetHp = getDefenseMaxHp(activeKey, currentLvl, { superchargeTier });
    const hpUnit = getHpUnit();

    const maxSuperchargeTiers = getMaxSuperchargeTier(activeKey, currentLvl);
    const hasSupercharge = maxSuperchargeTiers > 0;

    let superchargeHtml = '';
    if (hasSupercharge) {
        let pillsHtml = '';
        let optionsHtml = '';
        for (let tier = 0; tier <= maxSuperchargeTiers; tier++) {
            const label = tier === 0 ? translate('app.none') : translate('views.damageCalc.zapQuake.tierLabel', { tier });
            const isActive = superchargeTier === tier;
            const pipsHtml = tier === 0
                ? `<orecalc-assets-image
                    src="/assets/supercharge/supercharge_uncharged.png"
                    alt="${escapeHTML(label)}"
                    size="thumbnail"
                    class="calc-supercharge-pip is-uncharged">
                </orecalc-assets-image>`
                : Array.from({ length: tier }, () => `
                    <orecalc-assets-image
                        src="/assets/supercharge/supercharge_bolt.png"
                        alt="${escapeHTML(label)}"
                        size="thumbnail"
                        class="calc-supercharge-pip is-charged">
                    </orecalc-assets-image>
                `).join('');

            pillsHtml += `
                    <button type="button" class="calc-supercharge-pill ${isActive ? 'is-active active' : ''}" data-prefix="${prefix}" data-tier="${tier}" role="radio" aria-checked="${isActive}" title="${escapeHTML(label)}" aria-label="${escapeHTML(label)}">
                        <span class="calc-supercharge-pips calc-supercharge-pips--compact">${pipsHtml}</span>
                    </button>
            `;
            optionsHtml += `
                    <option value="${tier}" ${isActive ? 'selected' : ''}>${label}</option>
            `;
        }

        superchargeHtml = `
            <div class="calc-supercharge-wrapper">
                <button type="button" class="calc-info-btn" data-calc-info="supercharge" aria-label="${escapeHTML(translate('actions.showInfo'))}" data-i18n-aria-label="actions.showInfo">
                    <orecalc-assets-svg name="info" width="13" height="13"></orecalc-assets-svg>
                </button>
                <div class="calc-supercharge-pills" role="radiogroup" aria-label="${escapeHTML(translate('views.damageCalc.offense.superchargeLabel'))}">
                    ${pillsHtml}
                </div>
                <select id="${prefix}-supercharge-select" class="calc-select" data-prefix="${prefix}" hidden aria-hidden="true" tabindex="-1">
                    ${optionsHtml}
                </select>
            </div>
        `;
    }

    return `
        <div class="calc-target-toolbar">
            <div class="calc-target-toolbar__info">
                <div class="calc-target-toolbar__thumb-frame">
                    <orecalc-assets-image
                        src="${getBuildingAssetUrl(activeKey, currentLvl)}"
                        alt="${escapeHTML(defDisplayName)}"
                        class="calc-target-toolbar__thumb"
                        size="thumbnail">
                    </orecalc-assets-image>
                </div>
                <div class="calc-target-toolbar__meta">
                    <div class="calc-target-toolbar__title-row">
                        <h3 class="calc-target-toolbar__title">${escapeHTML(defDisplayName)}</h3>
                        ${currentDefense.subCategory === 'crafted' ? `
                            <span class="calc-crafted-pill" title="${escapeHTML(translate('views.damageCalc.filters.craftedDefenseTooltip'))}">
                                <orecalc-assets-svg name="timer" width="12" height="12"></orecalc-assets-svg>
                                <span>${escapeHTML(translate('views.damageCalc.filters.craftedBadge'))}</span>
                            </span>
                        ` : ''}
                    </div>
                    <div class="calc-target-toolbar__badges">
                        <span class="calc-target-toolbar__hp-badge">${formatNumber(targetHp)} ${hpUnit}</span>
                        ${superchargeTier > 0 ? `
                            <span class="calc-supercharge-active-badge" title="${escapeHTML(translate('views.damageCalc.offense.superchargeLabel'))} &middot; ${escapeHTML(translate('views.damageCalc.zapQuake.tierLabel', { tier: superchargeTier }))}">
                                ${renderSuperchargePipsHtml(superchargeTier, maxSuperchargeTiers, { variant: 'badge' })}
                                <span>${escapeHTML(translate('views.damageCalc.zapQuake.tierLabel', { tier: superchargeTier }))}</span>
                            </span>
                        ` : ''}
                    </div>
                </div>
            </div>

            <div class="calc-target-toolbar__controls">
                <div class="calc-level-control-group">
                    <div class="calc-level-header">
                        <span class="calc-level-label">${currentDefense.subCategory === 'crafted' ? escapeHTML(translate('views.damageCalc.filters.craftedHpModule')) : escapeHTML(translate('validation.level'))}</span>
                        <span class="calc-level-value">${currentLvl} <span class="calc-level-max">/ ${maxLvl}${currentDefense.subCategory === 'crafted' ? ' (Total Lvl 30)' : ''}</span></span>
                    </div>
                    <div class="calc-stepper-track">
                        <button type="button" class="calc-stepper-btn calc-stepper-btn--min" id="${prefix}-level-min" data-prefix="${prefix}" data-i18n="validation.min" ${currentLvl <= minLvl ? 'disabled' : ''}>${escapeHTML(translate('validation.min') || 'Min')}</button>
                        <button type="button" class="calc-stepper-btn calc-stepper-btn--step" id="${prefix}-level-dec" data-prefix="${prefix}" ${currentLvl <= minLvl ? 'disabled' : ''} aria-label="${escapeHTML(translate('actions.decrease'))} ${escapeHTML(translate('validation.level'))}">
                            <orecalc-assets-svg name="minus" width="14" height="14"></orecalc-assets-svg>
                        </button>
                        ${renderSteppedSliderHtml({
                            min: minLvl,
                            max: maxLvl,
                            value: currentLvl,
                            id: `${prefix}-level-slider`,
                            wrapClassName: 'calc-slider-input-wrapper',
                            dataAttributes: {
                                prefix: prefix
                            },
                            ariaLabel: `${defDisplayName} ${translate('validation.level')}`,
                            withTicks: true,
                            tickValues: isHeroDefense(activeKey) ? getValidDefenseLevels(activeKey, maxLvl) : null
                        })}
                        <button type="button" class="calc-stepper-btn calc-stepper-btn--step" id="${prefix}-level-inc" data-prefix="${prefix}" ${currentLvl >= maxLvl ? 'disabled' : ''} aria-label="${escapeHTML(translate('actions.increase'))} ${escapeHTML(translate('validation.level'))}">
                            <orecalc-assets-svg name="plus" width="14" height="14"></orecalc-assets-svg>
                        </button>
                        <button type="button" class="calc-stepper-btn calc-stepper-btn--max" id="${prefix}-level-max" data-prefix="${prefix}" data-i18n="validation.max" ${currentLvl >= maxLvl ? 'disabled' : ''}>${escapeHTML(translate('validation.max') || 'Max')}</button>
                    </div>
                </div>
                ${superchargeHtml}
            </div>
        </div>
    `;
}
