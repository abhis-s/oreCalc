/**
 * DOM Rendering Engine for Damage Calculator Offense Levels Editor Modal.
 * Tier 4: UI Presentation (Dedicated exclusively to modal dialog DOM rendering, 0 event listeners).
 */

import { spellsData } from '../../data/spellsData.js';
import { equipmentDamageData } from '../../data/equipmentDamageData.js';
import {
    getEffectiveEquipmentLevel
} from '../../domain/damage/damageFormulas.js';
import { translate } from '../../i18n/translator.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { formatNumber } from '../../utils/numberFormatter.js';
import { getActiveModifier } from './damageCalcState.js';
import {
    getEquipmentDisplayName
} from '../../utils/equipmentMetadata.js';
import {
    getLvlShort,
    getHpUnit
} from './damageCalcDisplay.js';
import { renderSteppedSliderHtml } from '../common/steppedSlider.js';

/**
 * Formats a single offense item's current level label and damage readout for the editor modal.
 *
 * @param {'spell'|'cc_spell'|'equipment'} type - The type of offense entity.
 * @param {string} id - The entity identifier (e.g. 'lightning', 'earthquake', 'spiky_ball').
 * @param {number} level - The level of the spell or equipment.
 * @param {Object} [options={}] - Options (e.g. modifier, leagueId).
 * @returns {string} Formatted label (e.g. "Lvl 13 (720 Damage)", "Lvl 18 (Effective: Lvl 15 · -3) (1350 Damage)").
 */
export function formatOffenseModalValue(type, id, level, options = {}) {
    const modifierKey = options.modifier || options.modifierKey || options.leagueId || 'standard';
    const lvlShort = getLvlShort();
    const hpUnit = getHpUnit();
    if (type === 'spell') {
        if (id === 'lightning') {
            const dmg = spellsData.spells.lightning?.levels?.[level]?.damage || 0;
            return `${lvlShort} ${level} (${formatNumber(dmg)} ${hpUnit})`;
        }
        if (id === 'earthquake') {
            const lvlData = spellsData.spells.earthquake?.levels?.[level];
            const eqPct = Math.round((lvlData?.damagePct || 0.29) * 1000) / 10;
            const troopPct = lvlData?.troopDamagePct ? Math.round(lvlData.troopDamagePct * 100) : 0;
            if (troopPct > 0) {
                const troopLabel = translate('views.damageCalc.popovers.statTroops');
                return `${lvlShort} ${level} (${eqPct}% · ${troopPct}% ${troopLabel})`;
            }
            return `${lvlShort} ${level} (${eqPct}%)`;
        }
    } else if (type === 'equipment') {
        const eqData = equipmentDamageData[id];
        if (!eqData) return `${lvlShort} ${level}`;
        const effectiveLevel = getEffectiveEquipmentLevel(id, level, modifierKey);
        const isDowngraded = effectiveLevel < level;
        const diff = level - effectiveLevel;
        const effectiveAnnotation = isDowngraded ? ` (${lvlShort} ${effectiveLevel} · -${diff})` : '';

        if (eqData.damageType === 'percentage') {
            const pct = Math.round((eqData.buildingDamagePctByLevel?.[effectiveLevel] || 0) * 100);
            return `${lvlShort} ${level}${effectiveAnnotation} (${pct}%)`;
        }
        const dmg = eqData.damageByLevel?.[effectiveLevel] || 0;
        return `${lvlShort} ${level}${effectiveAnnotation} (${formatNumber(dmg)} ${hpUnit})`;
    }
    return `${lvlShort} ${level}`;
}

/**
 * Renders the Offense Levels Editor Modal body.
 *
 * @param {Object} state - Damage calculator state.
 * @param {HTMLElement} container - Modal body container element.
 */
export function renderOffenseEditModal(state, container) {
    if (!container) return;

    const spells = state.offense?.spells || { lightning: 13, earthquake: 8 };
    const equipment = state.offense?.equipment || {};

    const zapLvl = spells.lightning || 13;
    const eqLvl = spells.earthquake || 8;

    const ccSpellsState = state.offense?.ccSpells || { lightning: 13, earthquake: 8 };
    const ccZapLvl = ccSpellsState.lightning || 13;
    const ccEqLvl = ccSpellsState.earthquake || 8;

    const activeModifier = getActiveModifier(state);

    const equipOrder = ['spiky_ball', 'giant_gauntlet', 'fireball', 'seeking_shield', 'rocket_spear'];
    const equipRowsHtml = equipOrder.map(eqId => {
        const eqData = equipmentDamageData[eqId];
        if (!eqData) return '';
        const eqMaxLvl = eqData.maxLevel || (eqData.rarity === 'epic' ? 27 : 18);
        const eqDefaultLvl = eqData.rarity === 'epic' ? 27 : 18;
        const eqLvl = equipment[eqId] || eqDefaultLvl;
        const equipName = getEquipmentDisplayName(eqId);

        return `
            <div class="calc-offense-modal-row" data-equipment-id="${eqId}">
                <div class="calc-offense-modal-row__header">
                    <div class="calc-offense-modal-row__identity">
                        <orecalc-assets-image
                            src="${eqData.icon}"
                            alt="${escapeHTML(equipName)}"
                            class="calc-offense-modal-row__thumb"
                            size="thumbnail">
                        </orecalc-assets-image>
                        <span class="calc-offense-modal-row__name">${escapeHTML(equipName)}</span>
                    </div>
                    <span class="calc-offense-modal-row__value" id="modal-val-${eqId}">${formatOffenseModalValue('equipment', eqId, eqLvl, { modifier: activeModifier })}</span>
                </div>
                <div class="calc-offense-modal-row__controls">
                    <div class="calc-stepper-track">
                        <button type="button" class="calc-stepper-btn calc-stepper-btn--step" data-action="decrement" data-type="equipment" data-id="${eqId}" ${eqLvl <= 1 ? 'disabled' : ''} aria-label="${escapeHTML(translate('actions.decrease'))} ${escapeHTML(equipName)} ${escapeHTML(translate('validation.level'))}">
                            <orecalc-assets-svg name="minus"></orecalc-assets-svg>
                        </button>
                        ${renderSteppedSliderHtml({
                            min: 1,
                            max: eqMaxLvl,
                            value: eqLvl,
                            className: 'offense-level-slider',
                            dataAttributes: {
                                type: 'equipment',
                                id: eqId
                            },
                            ariaLabel: `${equipName} ${translate('validation.level')}`,
                            withTicks: true
                        })}
                        <button type="button" class="calc-stepper-btn calc-stepper-btn--step" data-action="increment" data-type="equipment" data-id="${eqId}" ${eqLvl >= eqMaxLvl ? 'disabled' : ''} aria-label="${escapeHTML(translate('actions.increase'))} ${escapeHTML(equipName)} ${escapeHTML(translate('validation.level'))}">
                            <orecalc-assets-svg name="plus"></orecalc-assets-svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    const activeMod = getActiveModifier(state);
    const isEsports = activeMod === 'esports';
    const esportsNoticeText = translate('views.damageCalc.offense.esportsNotice');
    const syncNoticeText = translate('views.damageCalc.offense.offenseSyncNotice');

    container.innerHTML = `
        <div class="calc-offense-groups">
            <div class="calc-offense-modal-sync-notice">
                <orecalc-assets-svg name="sync" width="14" height="14"></orecalc-assets-svg>
                <span data-i18n="views.damageCalc.offense.offenseSyncNotice">${escapeHTML(syncNoticeText)}</span>
            </div>
            ${isEsports ? `
                <div class="calc-offense-modal-esports-notice">
                    <orecalc-assets-svg name="shield-filled" width="14" height="14"></orecalc-assets-svg>
                    <span data-i18n="views.damageCalc.offense.esportsNotice">${escapeHTML(esportsNoticeText)}</span>
                </div>
            ` : ''}
            <div class="calc-offense-modal-group">
                <h4 class="calc-offense-modal-group__title" data-i18n="views.damageCalc.offense.spellsTitle">${escapeHTML(translate('views.damageCalc.offense.spellsTitle'))}</h4>

                <div class="calc-offense-modal-row" data-spell-id="lightning">
                    <div class="calc-offense-modal-row__header">
                        <div class="calc-offense-modal-row__identity">
                            <orecalc-assets-image
                                src="/assets/spells/lightning.png"
                                alt="${escapeHTML(translate('views.damageCalc.offense.spellLightning'))}"
                                data-i18n-alt="views.damageCalc.offense.spellLightning"
                                class="calc-offense-modal-row__thumb"
                                size="thumbnail">
                            </orecalc-assets-image>
                            <span class="calc-offense-modal-row__name" data-i18n="views.damageCalc.offense.spellLightning">${escapeHTML(translate('views.damageCalc.offense.spellLightning'))}</span>
                        </div>
                        <span class="calc-offense-modal-row__value" id="modal-val-lightning">${formatOffenseModalValue('spell', 'lightning', zapLvl)}</span>
                    </div>
                    <div class="calc-offense-modal-row__controls">
                        <div class="calc-stepper-track">
                            <button type="button" class="calc-stepper-btn calc-stepper-btn--step" data-action="decrement" data-type="spell" data-id="lightning" ${zapLvl <= 1 ? 'disabled' : ''} aria-label="${escapeHTML(translate('actions.decrease'))} ${escapeHTML(translate('views.damageCalc.offense.spellLightning'))} ${escapeHTML(translate('validation.level'))}">
                                <orecalc-assets-svg name="minus"></orecalc-assets-svg>
                            </button>
                            ${renderSteppedSliderHtml({
                                min: 1,
                                max: 13,
                                value: zapLvl,
                                className: 'offense-level-slider',
                                dataAttributes: {
                                    type: 'spell',
                                    id: 'lightning'
                                },
                                ariaLabel: `${translate('views.damageCalc.offense.spellLightning')} ${translate('validation.level')}`,
                                withTicks: true
                            })}
                            <button type="button" class="calc-stepper-btn calc-stepper-btn--step" data-action="increment" data-type="spell" data-id="lightning" ${zapLvl >= 13 ? 'disabled' : ''} aria-label="${escapeHTML(translate('actions.increase'))} ${escapeHTML(translate('views.damageCalc.offense.spellLightning'))} ${escapeHTML(translate('validation.level'))}">
                                <orecalc-assets-svg name="plus"></orecalc-assets-svg>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="calc-offense-modal-row" data-spell-id="earthquake">
                    <div class="calc-offense-modal-row__header">
                        <div class="calc-offense-modal-row__identity">
                            <orecalc-assets-image
                                src="/assets/spells/earthquake.png"
                                alt="${escapeHTML(translate('views.damageCalc.offense.spellEarthquake'))}"
                                data-i18n-alt="views.damageCalc.offense.spellEarthquake"
                                class="calc-offense-modal-row__thumb"
                                size="thumbnail">
                            </orecalc-assets-image>
                            <span class="calc-offense-modal-row__name" data-i18n="views.damageCalc.offense.spellEarthquake">${escapeHTML(translate('views.damageCalc.offense.spellEarthquake'))}</span>
                        </div>
                        <span class="calc-offense-modal-row__value" id="modal-val-earthquake">${formatOffenseModalValue('spell', 'earthquake', eqLvl)}</span>
                    </div>
                    <div class="calc-offense-modal-row__controls">
                        <div class="calc-stepper-track">
                            <button type="button" class="calc-stepper-btn calc-stepper-btn--step" data-action="decrement" data-type="spell" data-id="earthquake" ${eqLvl <= 1 ? 'disabled' : ''} aria-label="${escapeHTML(translate('actions.decrease'))} ${escapeHTML(translate('views.damageCalc.offense.spellEarthquake'))} ${escapeHTML(translate('validation.level'))}">
                                <orecalc-assets-svg name="minus"></orecalc-assets-svg>
                            </button>
                            ${renderSteppedSliderHtml({
                                min: 1,
                                max: 8,
                                value: eqLvl,
                                className: 'offense-level-slider',
                                dataAttributes: {
                                    type: 'spell',
                                    id: 'earthquake'
                                },
                                ariaLabel: `${translate('views.damageCalc.offense.spellEarthquake')} ${translate('validation.level')}`,
                                withTicks: true
                            })}
                            <button type="button" class="calc-stepper-btn calc-stepper-btn--step" data-action="increment" data-type="spell" data-id="earthquake" ${eqLvl >= 8 ? 'disabled' : ''} aria-label="${escapeHTML(translate('actions.increase'))} ${escapeHTML(translate('views.damageCalc.offense.spellEarthquake'))} ${escapeHTML(translate('validation.level'))}">
                                <orecalc-assets-svg name="plus"></orecalc-assets-svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="calc-offense-modal-group">
                <h4 class="calc-offense-modal-group__title" data-i18n="views.damageCalc.offense.clanCastleDonatedSpellsTitle">${escapeHTML(translate('views.damageCalc.offense.clanCastleDonatedSpellsTitle'))}</h4>

                <div class="calc-offense-modal-row" data-cc-spell-id="lightning">
                    <div class="calc-offense-modal-row__header">
                        <div class="calc-offense-modal-row__identity">
                            <orecalc-assets-image
                                src="/assets/buildings/clan_castle/level_14.png"
                                alt="${escapeHTML(translate('entities.defenses.clanCastle'))}"
                                data-i18n-alt="entities.defenses.clanCastle"
                                class="calc-offense-modal-row__thumb"
                                size="thumbnail">
                            </orecalc-assets-image>
                            <orecalc-assets-image
                                src="/assets/spells/lightning.png"
                                alt="${escapeHTML(translate('views.damageCalc.offense.donatedLightningLabel'))}"
                                data-i18n-alt="views.damageCalc.offense.donatedLightningLabel"
                                class="calc-offense-modal-row__thumb"
                                size="thumbnail">
                            </orecalc-assets-image>
                            <span class="calc-offense-modal-row__name" data-i18n="views.damageCalc.offense.donatedLightningLabel">${escapeHTML(translate('views.damageCalc.offense.donatedLightningLabel'))}</span>
                        </div>
                        <span class="calc-offense-modal-row__value" id="modal-val-cc-lightning">${formatOffenseModalValue('spell', 'lightning', ccZapLvl)}</span>
                    </div>
                    <div class="calc-offense-modal-row__controls">
                        <div class="calc-stepper-track">
                            <button type="button" class="calc-stepper-btn calc-stepper-btn--step" data-action="decrement" data-type="cc_spell" data-id="lightning" ${ccZapLvl <= 1 ? 'disabled' : ''} aria-label="${escapeHTML(translate('actions.decrease'))} ${escapeHTML(translate('views.damageCalc.offense.donatedLightningLabel'))} ${escapeHTML(translate('validation.level'))}">
                                <orecalc-assets-svg name="minus"></orecalc-assets-svg>
                            </button>
                            ${renderSteppedSliderHtml({
                                min: 1,
                                max: 13,
                                value: ccZapLvl,
                                className: 'offense-level-slider',
                                dataAttributes: {
                                    type: 'cc_spell',
                                    id: 'lightning'
                                },
                                ariaLabel: `${translate('views.damageCalc.offense.donatedLightningLabel')} ${translate('validation.level')}`,
                                withTicks: true
                            })}
                            <button type="button" class="calc-stepper-btn calc-stepper-btn--step" data-action="increment" data-type="cc_spell" data-id="lightning" ${ccZapLvl >= 13 ? 'disabled' : ''} aria-label="${escapeHTML(translate('actions.increase'))} ${escapeHTML(translate('views.damageCalc.offense.donatedLightningLabel'))} ${escapeHTML(translate('validation.level'))}">
                                <orecalc-assets-svg name="plus"></orecalc-assets-svg>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="calc-offense-modal-row" data-cc-spell-id="earthquake">
                    <div class="calc-offense-modal-row__header">
                        <div class="calc-offense-modal-row__identity">
                            <orecalc-assets-image
                                src="/assets/buildings/clan_castle/level_14.png"
                                alt="${escapeHTML(translate('entities.defenses.clanCastle'))}"
                                data-i18n-alt="entities.defenses.clanCastle"
                                class="calc-offense-modal-row__thumb"
                                size="thumbnail">
                            </orecalc-assets-image>
                            <orecalc-assets-image
                                src="/assets/spells/earthquake.png"
                                alt="${escapeHTML(translate('views.damageCalc.offense.donatedEarthquakeLabel'))}"
                                data-i18n-alt="views.damageCalc.offense.donatedEarthquakeLabel"
                                class="calc-offense-modal-row__thumb"
                                size="thumbnail">
                            </orecalc-assets-image>
                            <span class="calc-offense-modal-row__name" data-i18n="views.damageCalc.offense.donatedEarthquakeLabel">${escapeHTML(translate('views.damageCalc.offense.donatedEarthquakeLabel'))}</span>
                        </div>
                        <span class="calc-offense-modal-row__value" id="modal-val-cc-earthquake">${formatOffenseModalValue('spell', 'earthquake', ccEqLvl)}</span>
                    </div>
                    <div class="calc-offense-modal-row__controls">
                        <div class="calc-stepper-track">
                            <button type="button" class="calc-stepper-btn calc-stepper-btn--step" data-action="decrement" data-type="cc_spell" data-id="earthquake" ${ccEqLvl <= 1 ? 'disabled' : ''} aria-label="${escapeHTML(translate('actions.decrease'))} ${escapeHTML(translate('views.damageCalc.offense.donatedEarthquakeLabel'))} ${escapeHTML(translate('validation.level'))}">
                                <orecalc-assets-svg name="minus"></orecalc-assets-svg>
                            </button>
                            ${renderSteppedSliderHtml({
                                min: 1,
                                max: 8,
                                value: ccEqLvl,
                                className: 'offense-level-slider',
                                dataAttributes: {
                                    type: 'cc_spell',
                                    id: 'earthquake'
                                },
                                ariaLabel: `${translate('views.damageCalc.offense.donatedEarthquakeLabel')} ${translate('validation.level')}`,
                                withTicks: true
                            })}
                            <button type="button" class="calc-stepper-btn calc-stepper-btn--step" data-action="increment" data-type="cc_spell" data-id="earthquake" ${ccEqLvl >= 8 ? 'disabled' : ''} aria-label="${escapeHTML(translate('actions.increase'))} ${escapeHTML(translate('views.damageCalc.offense.donatedEarthquakeLabel'))} ${escapeHTML(translate('validation.level'))}">
                                <orecalc-assets-svg name="plus"></orecalc-assets-svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="calc-offense-modal-group">
                <h4 class="calc-offense-modal-group__title" data-i18n="views.equipment.heroEquipment">${escapeHTML(translate('views.equipment.heroEquipment'))}</h4>
                ${equipRowsHtml}
            </div>
        </div>
    `;
}
