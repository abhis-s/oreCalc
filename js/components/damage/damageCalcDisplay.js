/**
 * DOM Rendering Engine for Equipment Damage & ZapQuake Calculator.
 * Tier 4: UI Presentation (Dedicated exclusively to DOM rendering, 0 event listeners).
 */

import { getDefensesData } from '../../data/defenseTargetsData.js';
import { translate } from '../../i18n/translator.js';

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
 * Uses canonical <clashcalc-assets-image> custom elements.
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
            <clashcalc-assets-image
                src="${src}"
                alt="${altText}"
                size="thumbnail"
                class="calc-supercharge-pip ${isCharged ? 'is-charged' : 'is-uncharged'}">
            </clashcalc-assets-image>
        `;
    }

    return `<span class="calc-supercharge-pips calc-supercharge-pips--${variant} ${className}">${pipsHtml}</span>`;
}
