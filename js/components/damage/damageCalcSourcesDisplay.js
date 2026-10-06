/**
 * DOM Rendering Engine for Damage Sources Bar and Global Sources Card.
 * Tier 4: UI Presentation (Dedicated exclusively to DOM rendering, 0 event listeners).
 */

import { equipmentDamageData } from '../../data/equipmentDamageData.js';
import {
    getEffectiveEquipmentLevel
} from '../../domain/damage/damageFormulas.js';
import {
    getMaxSuperchargeTierForTownHall
} from '../../domain/damage/defenseProgressionDomain.js';
import { translate } from '../../i18n/translator.js';
import { getBattleModifierSwitcherMarkup } from '../common/battleModifierSwitcher.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { getActiveModifier, getShownTownHall, getGlobalSuperchargeTier } from './damageCalcState.js';
import { getEquipmentDisplayName } from '../../utils/equipmentMetadata.js';
import {
    getLvlShort
} from './damageCalcDisplay.js';

/**
 * Generates the HTML markup for the damage sources toggle buttons, CC section, and supercharge selector.
 *
 * @param {Object} state - Damage calculator state.
 * @returns {string} HTML markup for the inner .calc-damage-sources-grid.
 */
export function getDamageSourcesGridHtml(state) {
    const zq = state.zapQuake || {};
    const spells = state.offense?.spells || { lightning: 13, earthquake: 8 };
    const zapLvl = spells.lightning || zq.lightningLevel || 13;
    const eqLvl = spells.earthquake || zq.earthquakeLevel || 8;
    const enabledSources = state.offense?.enabledSources || {};
    const leagueId = getActiveModifier(state);

    const equipKeys = [
        'spiky_ball',
        'giant_arrow',
        'fireball',
        'seeking_shield',
        'flame_blower',
        'rocket_backpack'
    ];
    const equipSources = equipKeys.map(key => {
        const equip = equipmentDamageData[key];
        const defaultLvl = equip?.rarity === 'epic' ? 27 : 18;
        const rawLvl = state.offense?.equipment?.[key] || defaultLvl;
        const effectiveLvl = getEffectiveEquipmentLevel(key, rawLvl, leagueId);
        return {
            key,
            name: getEquipmentDisplayName(key),
            type: 'equipment',
            icon: equip?.icon || '',
            level: effectiveLvl,
            rawLevel: rawLvl
        };
    });

    const zapName = translate('views.damageCalc.offense.spellLightning') || 'Lightning';
    const eqName = translate('views.damageCalc.offense.spellEarthquake') || 'Earthquake';

    const sourcesConfig = [
        { key: 'lightning', name: zapName, type: 'spell', icon: '/assets/spells/lightning.png', level: zapLvl, rawLevel: zapLvl },
        { key: 'earthquake', name: eqName, type: 'spell', icon: '/assets/spells/earthquake.png', level: eqLvl, rawLevel: eqLvl },
        ...equipSources
    ];

    let sourcesHtml = '';
    const lvlShort = getLvlShort();
    for (const src of sourcesConfig) {
        const isEnabled = enabledSources[src.key] !== false;
        const isDowngraded = src.rawLevel != null && src.level < src.rawLevel;
        const downgradeDiff = isDowngraded ? (src.rawLevel - src.level) : 0;
        const ariaLabel = isDowngraded
            ? `${escapeHTML(src.name)} (${lvlShort} ${src.level} · -${downgradeDiff})`
            : `${escapeHTML(src.name)} (${lvlShort} ${src.level})`;

        sourcesHtml += `
            <button type="button"
                class="calc-source-toggle-btn ${isEnabled ? 'is-active' : 'is-inactive'} ${isDowngraded ? 'is-downgraded' : ''}"
                data-source-key="${src.key}"
                data-source-info="${src.key}"
                data-source-type="${src.type}"
                data-source-level="${src.level}"
                data-source-raw-level="${src.rawLevel || src.level}"
                aria-label="${ariaLabel}"
                aria-pressed="${isEnabled}">
                <orecalc-assets-image
                    src="${src.icon}"
                    alt="${escapeHTML(src.name)}"
                    size="thumbnail"
                    class="calc-source-toggle-btn__icon">
                </orecalc-assets-image>
                <span class="calc-source-toggle-btn__lvl ${isDowngraded ? 'calc-source-toggle-btn__lvl--downgraded' : ''}">${src.level}</span>
            </button>
        `;
    }

    const ccSpells = state.offense?.ccSpells || { lightning: 13, earthquake: 8 };
    const ccZapLvl = ccSpells.lightning || 13;
    const ccEqLvl = ccSpells.earthquake || 8;
    const isCcZapEnabled = enabledSources.cc_lightning !== false;
    const isCcEqEnabled = enabledSources.cc_earthquake !== false;
    const ccZapName = translate('views.damageCalc.offense.donatedLightningLabel');
    const ccEqName = translate('views.damageCalc.offense.donatedEarthquakeLabel');
    const ccSpellsTitle = translate('views.damageCalc.offense.clanCastleDonatedSpellsTitle');

    sourcesHtml += `
        <div class="calc-sources-divider" role="separator" aria-orientation="vertical"></div>
        <div class="calc-sources-cc-group">
            <button type="button"
                id="calc-source-cc-hint"
                class="calc-source-cc-pill ${(!isCcZapEnabled && !isCcEqEnabled) ? 'is-inactive' : ''}"
                title="${escapeHTML(ccSpellsTitle)}: ${escapeHTML(ccZapName)} ${lvlShort} ${ccZapLvl}, ${escapeHTML(ccEqName)} ${lvlShort} ${ccEqLvl}"
                data-calc-info="cc_spells"
                aria-label="${escapeHTML(translate('views.damageCalc.offense.clanCastleAbbr'))}: ${escapeHTML(ccSpellsTitle)}">
                <orecalc-assets-image
                    src="/assets/buildings/clan_castle/level_14.png"
                    alt="Clan Castle"
                    size="thumbnail"
                    class="calc-source-toggle-btn__icon">
                </orecalc-assets-image>
                <span class="calc-source-cc-badge">${escapeHTML(translate('views.damageCalc.offense.clanCastleAbbr'))}</span>
            </button>
            <button type="button"
                class="calc-source-toggle-btn ${isCcZapEnabled ? 'is-active' : 'is-inactive'}"
                data-source-key="cc_lightning"
                data-source-info="cc_lightning"
                data-source-type="cc_spell"
                data-source-level="${ccZapLvl}"
                aria-label="${escapeHTML(ccZapName)} (${lvlShort} ${ccZapLvl})"
                aria-pressed="${isCcZapEnabled}">
                <orecalc-assets-image
                    src="/assets/spells/lightning.png"
                    alt="${escapeHTML(ccZapName)}"
                    size="thumbnail"
                    class="calc-source-toggle-btn__icon">
                </orecalc-assets-image>
                <span class="calc-source-toggle-btn__lvl">${ccZapLvl}</span>
            </button>
            <button type="button"
                class="calc-source-toggle-btn ${isCcEqEnabled ? 'is-active' : 'is-inactive'}"
                data-source-key="cc_earthquake"
                data-source-info="cc_earthquake"
                data-source-type="cc_spell"
                data-source-level="${ccEqLvl}"
                aria-label="${escapeHTML(ccEqName)} (${lvlShort} ${ccEqLvl})"
                aria-pressed="${isCcEqEnabled}">
                <orecalc-assets-image
                    src="/assets/spells/earthquake.png"
                    alt="${escapeHTML(ccEqName)}"
                    size="thumbnail"
                    class="calc-source-toggle-btn__icon">
                </orecalc-assets-image>
                <span class="calc-source-toggle-btn__lvl">${ccEqLvl}</span>
            </button>
        </div>
    `;

    const currentTH = getShownTownHall(state);
    const maxThTiers = getMaxSuperchargeTierForTownHall(currentTH);
    let superchargeWrapperHtml = '';
    if (maxThTiers > 0) {
        const zapSuperchargeTier = getGlobalSuperchargeTier(state);
        let zapPillsHtml = '';
        for (let tier = 0; tier <= maxThTiers; tier++) {
            const label = tier === 0 ? translate('app.none') : translate('views.damageCalc.zapQuake.tierLabel', { tier });
            const isActive = zapSuperchargeTier === tier;
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
            zapPillsHtml += `
                    <button type="button" class="calc-supercharge-pill ${isActive ? 'is-active active' : ''}" data-prefix="zq_combo" data-tier="${tier}" role="radio" aria-checked="${isActive}" title="${escapeHTML(label)}" aria-label="${escapeHTML(label)}">
                        <span class="calc-supercharge-pips calc-supercharge-pips--compact">${pipsHtml}</span>
                    </button>`;
        }

        superchargeWrapperHtml = `
            <div class="calc-supercharge-wrapper calc-supercharge-wrapper--sources" title="${escapeHTML(translate('views.damageCalc.offense.superchargeLabel'))}">
                <button type="button" class="calc-info-btn" data-calc-info="supercharge" aria-label="${escapeHTML(translate('actions.showInfo'))}" data-i18n-aria-label="actions.showInfo">
                    <orecalc-assets-svg name="info" width="13" height="13"></orecalc-assets-svg>
                </button>
                <div class="calc-supercharge-pills" role="radiogroup" aria-label="${escapeHTML(translate('views.damageCalc.offense.superchargeLabel'))}">
                    ${zapPillsHtml}
                </div>
            </div>
        `;
    }

    const thDropdownHtml = renderTownHallDropdownHtml(currentTH, {
        dropdownId: 'calc-sources-th-dropdown',
        triggerId: 'calc-sources-th-dropdown-trigger',
        menuId: 'calc-sources-th-dropdown-menu',
        selectId: 'calc-sources-th-select'
    });

    sourcesHtml += `
        <div class="calc-sources-divider" role="separator" aria-orientation="vertical"></div>
        <div class="calc-th-preset-group calc-th-preset-group--sources">
            ${thDropdownHtml}
            ${superchargeWrapperHtml}
        </div>
    `;

    return sourcesHtml;
}

/**
 * Renders the custom Town Hall dropdown markup.
 *
 * @param {number} currentTH - Currently active Town Hall level.
 * @param {Object} [options] - Configuration options for element IDs.
 * @param {string} [options.dropdownId='calc-th-dropdown'] - ID for the dropdown container.
 * @param {string} [options.triggerId='calc-th-dropdown-trigger'] - ID for the trigger button.
 * @param {string} [options.menuId='calc-th-dropdown-menu'] - ID for the dropdown menu listbox.
 * @param {string} [options.selectId='calc-building-th-select'] - ID for the hidden fallback select.
 * @param {boolean} [options.includeHiddenSelect=true] - Whether to render the hidden select element.
 * @returns {string} HTML markup for the Town Hall dropdown.
 */
export function renderTownHallDropdownHtml(currentTH, {
    dropdownId = 'calc-th-dropdown',
    triggerId = 'calc-th-dropdown-trigger',
    menuId = 'calc-th-dropdown-menu',
    selectId = 'calc-building-th-select',
    includeHiddenSelect = true
} = {}) {
    const safeTH = Math.max(9, Math.min(18, Number(currentTH) || 18));
    let thOptionsHtml = '';
    let customThItemsHtml = '';
    for (let th = 18; th >= 9; th--) {
        const isSelected = th === safeTH;
        const thLabel = escapeHTML(translate('views.equipment.thShort', { level: th }));
        if (includeHiddenSelect) {
            thOptionsHtml += `<option value="${th}" ${isSelected ? 'selected' : ''}>${thLabel}</option>`;
        }
        customThItemsHtml += `
            <button type="button" class="calc-th-dropdown-item ${isSelected ? 'is-selected' : ''}" role="option" aria-selected="${isSelected}" data-th="${th}">
                <orecalc-assets-image src="/assets/buildings/town_hall/level_${th}.png" alt="${thLabel}" data-i18n-alt="views.equipment.thShort" data-i18n-alt-args='{"level":${th}}' class="calc-th-dropdown-item-icon" size="thumbnail"></orecalc-assets-image>
                <span class="calc-th-dropdown-item-label" data-i18n="views.equipment.thShort" data-i18n-args='{"level":${th}}'>${thLabel}</span>
            </button>
        `;
    }

    const selectHtml = includeHiddenSelect
        ? `<select id="${selectId}" class="calc-th-preset-select-hidden" aria-hidden="true" tabindex="-1">
            ${thOptionsHtml}
        </select>`
        : '';

    const safeThLabel = escapeHTML(translate('views.equipment.thShort', { level: safeTH }));
    return `
        <div class="calc-th-dropdown" id="${dropdownId}">
            <button type="button" class="calc-th-dropdown-trigger" id="${triggerId}" aria-haspopup="listbox" aria-expanded="false" aria-label="${escapeHTML(translate('entities.defenses.townHall'))}: ${safeThLabel}">
                <orecalc-assets-image src="/assets/buildings/town_hall/level_${safeTH}.png" alt="${safeThLabel}" data-i18n-alt="views.equipment.thShort" data-i18n-alt-args='{"level":${safeTH}}' class="calc-th-dropdown-icon" size="thumbnail"></orecalc-assets-image>
                <span data-i18n="views.equipment.thShort" data-i18n-args='{"level":${safeTH}}' class="calc-th-dropdown-value">${safeThLabel}</span>
                <orecalc-assets-svg name="chevron-down" class="calc-th-dropdown-arrow"></orecalc-assets-svg>
            </button>
            <div class="calc-th-dropdown-menu" id="${menuId}" role="listbox" aria-label="${escapeHTML(translate('entities.defenses.townHall'))}" hidden>
                ${customThItemsHtml}
            </div>
            ${selectHtml}
        </div>
    `;
}

/**
 * Generates the full standalone Damage Sources and Battle Modifiers card markup.
 *
 * @param {Object} state - Damage calculator state.
 * @returns {string} HTML markup for the .calc-sources-section card.
 */
export function getDamageSourcesCardMarkup(state) {
    const modifierSwitcherMarkup = getBattleModifierSwitcherMarkup(getActiveModifier(state), {
        includePercentages: true,
        customClass: 'calc-modifier-tabs'
    });
    const sourcesGridHtml = getDamageSourcesGridHtml(state);

    return `
        <div class="calc-sources-section">
            <div class="calc-sources-section__modifier-row" id="calc-modifier-bar" aria-label="${escapeHTML(translate('views.damageCalc.offense.battleModifier') || 'Battle Modifiers')}">
                <div class="calc-modifier-bar__inner">
                    <div class="calc-modifier-bar__label-group">
                        <span class="calc-modifier-bar__label" data-i18n="views.damageCalc.offense.battleModifier">${escapeHTML(translate('views.damageCalc.offense.battleModifier') || 'Modifier:')}</span>
                        <button type="button" class="calc-info-btn" data-calc-info="modifier" aria-label="${escapeHTML(translate('actions.showInfo'))}" data-i18n-aria-label="actions.showInfo">
                            <orecalc-assets-svg name="info" width="13" height="13"></orecalc-assets-svg>
                        </button>
                    </div>
                    <div class="calc-modifier-bar__tabs-container">
                        ${modifierSwitcherMarkup}
                    </div>
                </div>
            </div>
            <div class="calc-sources-section__divider"></div>
            <div class="calc-sources-section__header">
                <div class="calc-sources-section__title-group">
                    <span class="calc-sources-section__title" data-i18n="views.damageCalc.offense.damageSources">${escapeHTML(translate('views.damageCalc.offense.damageSources') || 'Damage Sources')}</span>
                    <span class="calc-sources-section__hint" data-i18n="views.damageCalc.offense.damageSourcesHint">${escapeHTML(translate('views.damageCalc.offense.damageSourcesHint') || 'Toggle spells & equipment to compute combos')}</span>
                </div>
                <button type="button" id="calc-edit-offense-btn" class="btn-secondary calc-sources-section__edit-btn" aria-haspopup="dialog" aria-controls="calc-offense-modal">
                    <orecalc-assets-svg name="sliders" width="14" height="14"></orecalc-assets-svg>
                    <span data-i18n="views.damageCalc.offense.editLevels">${escapeHTML(translate('views.damageCalc.offense.editLevels') || 'Edit Levels')}</span>
                </button>
            </div>
            <div class="calc-damage-sources-grid">
                ${sourcesGridHtml}
            </div>
        </div>
    `;
}
