/**
 * Event Listeners & User Input Controller for Target Combinations Modal.
 * Tier 4: User Inputs (Dedicated exclusively to event listener attachments inside the target combos modal).
 */

import {
    persistState,
    getShownTownHall
} from './damageCalcState.js';
import { getDefensesData } from '../../data/defenseTargetsData.js';
import { getBuildingAssetUrl } from '../../core/buildingAssetHelper.js';
import { formatNumber } from '../../utils/numberFormatter.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { renderTargetCombosListHtml } from './damageCalcTargetCombosModalDisplay.js';
import { translate } from '../../i18n/translator.js';
import {
    getHpUnit,
    getLvlShort,
    renderSuperchargePipsHtml
} from './damageCalcDisplay.js';
import {
    getMaxDefenseLevelForTownHall,
    getMaxSuperchargeTier,
    snapDefenseLevel,
    getPrevDefenseLevel,
    getNextDefenseLevel,
    getMinDefenseLevel
} from '../../domain/damage/defenseProgressionDomain.js';

/**
 * In-memory session cache for target combinations modal supercharge selections across level scrubbing.
 * Preserves the user's supercharge tier when scrubbing to non-max levels,
 * reinstating it if they scrub back to max level within the same modal session.
 * Dropped whenever the modal is closed.
 * @type {Map<string, number>}
 */
const targetCombosSuperchargeMemory = new Map();

/**
 * Resets the in-memory session cache for the target combinations modal.
 */
export function resetTargetCombosSuperchargeMemory() {
    targetCombosSuperchargeMemory.clear();
}

/**
 * Attaches event listeners inside the Target Combinations modal.
 *
 * @param {Object} state - Damage calculator state.
 * @param {HTMLElement} modalBody - Modal body container.
 * @param {() => void} onStateChange - Re-render callback.
 */
export function attachTargetCombosModalListeners(state, modalBody, onStateChange) {
    if (!modalBody) return;

    const sheet = /** @type {HTMLElement | null} */ (modalBody.querySelector('.calc-target-combos-sheet'));
    if (!sheet) return;

    const defenseKey = sheet.getAttribute('data-defense-key');
    if (!defenseKey) return;
    const def = getDefensesData()[defenseKey];
    if (!def) return;

    // Seed the in-memory cache with the active supercharge tier when entering the modal session
    const initialSc = Number(sheet.getAttribute('data-active-supercharge')) || 0;
    if (!targetCombosSuperchargeMemory.has(defenseKey) || targetCombosSuperchargeMemory.get(defenseKey) === undefined) {
        targetCombosSuperchargeMemory.set(defenseKey, initialSc);
    }

    const bindSelectButtons = () => {
        const selectBtns = modalBody.querySelectorAll('[data-action="select-target-combo"]');
        selectBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const bldgKey = btn.getAttribute('data-defense-key') || defenseKey;
                const comboSig = btn.getAttribute('data-combo-sig');
                if (!bldgKey || !comboSig) return;

                if (!state.zapQuake) state.zapQuake = {};
                if (!state.zapQuake.selectedCombos) state.zapQuake.selectedCombos = {};
                state.zapQuake.selectedCombos[bldgKey] = comboSig;

                const slider = /** @type {HTMLInputElement | null} */ (modalBody.querySelector('#calc-target-modal-level-slider'));
                const curLvl = slider ? (Number(slider.value) || 1) : 1;
                const curSc = Number(sheet.getAttribute('data-active-supercharge')) || 0;

                if (!state.defenseLevelOverrides) state.defenseLevelOverrides = {};
                state.defenseLevelOverrides[bldgKey] = curLvl;

                if (!state.defenseSuperchargeOverrides) state.defenseSuperchargeOverrides = {};
                state.defenseSuperchargeOverrides[bldgKey] = curSc;

                persistState();
                onStateChange();
                refreshSubtree();
            });
        });
    };

    const bindResetButton = () => {
        const resetBtn = modalBody.querySelector('[data-action="reset-to-optimal"]');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                const bldgKey = resetBtn.getAttribute('data-defense-key') || defenseKey;
                if (!bldgKey) return;

                if (state.zapQuake?.selectedCombos) {
                    delete state.zapQuake.selectedCombos[bldgKey];
                }

                persistState();
                onStateChange();
                refreshSubtree();
            });
        }
    };

    const refreshSubtree = () => {
        const slider = /** @type {HTMLInputElement | null} */ (modalBody.querySelector('#calc-target-modal-level-slider'));
        const curLvl = slider ? (Number(slider.value) || 1) : 1;
        const currentTH = getShownTownHall(state);
        const thInfo = getMaxDefenseLevelForTownHall(defenseKey, currentTH);
        const maxAllowedLevel = (thInfo?.status === 'available' && thInfo.level > 0) ? thInfo.level : (def.maxLevel || 1);
        const maxSc = getMaxSuperchargeTier(defenseKey, curLvl);
        const isScDisabled = curLvl < (def.maxLevel || 1) || currentTH < 18 || maxSc === 0;
        const rawSc = Number(sheet.getAttribute('data-active-supercharge')) || 0;
        const activeSc = isScDisabled ? 0 : rawSc;

        const levelLabel = modalBody.querySelector('#calc-target-modal-level-label');
        if (levelLabel) {
            const pipsHtml = activeSc > 0
                ? ` <span class="calc-target-combos-overview__supercharge" title="${escapeHTML(translate('views.damageCalc.offense.superchargeLabel'))} &middot; ${escapeHTML(translate('views.damageCalc.zapQuake.tierLabel', { tier: activeSc }))}">${renderSuperchargePipsHtml(activeSc, maxSc, { variant: 'compact' })}</span>`
                : '';
            levelLabel.innerHTML = `${getLvlShort(defenseKey)} ${curLvl}${pipsHtml}`;
        }

        const thMaxEl = modalBody.querySelector('#calc-target-modal-th-max');
        const hpRow = modalBody.querySelector('.calc-target-combos-overview__hp-row');
        const isAtMax = curLvl >= maxAllowedLevel;
        if (currentTH < 18 && isAtMax) {
            if (!thMaxEl && hpRow) {
                const newTag = document.createElement('span');
                newTag.className = 'calc-target-combos-overview__th-max';
                newTag.id = 'calc-target-modal-th-max';
                newTag.textContent = translate('views.damageCalc.offense.thMaxTag', { th: currentTH }) || `TH ${currentTH} Max`;
                hpRow.appendChild(newTag);
            } else if (thMaxEl) {
                thMaxEl.textContent = translate('views.damageCalc.offense.thMaxTag', { th: currentTH }) || `TH ${currentTH} Max`;
            }
        } else if (thMaxEl) {
            thMaxEl.remove();
        }

        const decBtn = /** @type {HTMLButtonElement | null} */ (modalBody.querySelector('[data-action="target-level-dec"]'));
        if (decBtn) {
            decBtn.disabled = curLvl <= getMinDefenseLevel(defenseKey);
        }
        const incBtn = /** @type {HTMLButtonElement | null} */ (modalBody.querySelector('[data-action="target-level-inc"]'));
        if (incBtn) {
            incBtn.disabled = curLvl >= maxAllowedLevel;
        }

        const thumb = modalBody.querySelector('#calc-target-modal-thumb');
        if (thumb) {
            thumb.setAttribute('src', getBuildingAssetUrl(defenseKey, curLvl));
        }

        const scWrap = modalBody.querySelector('#calc-target-modal-supercharge-wrap');
        if (scWrap) {
            scWrap.classList.toggle('is-disabled', isScDisabled);
            const pills = scWrap.querySelectorAll('.calc-supercharge-pill');
            pills.forEach(pill => {
                const tier = Number(pill.getAttribute('data-tier')) || 0;
                const btn = /** @type {HTMLButtonElement} */ (pill);
                btn.disabled = isScDisabled;
                const isMatch = isScDisabled ? tier === 0 : tier === activeSc;
                btn.classList.toggle('active', isMatch);
                btn.classList.toggle('is-active', isMatch);
                btn.setAttribute('aria-checked', String(isMatch));
            });
        }

        const listResult = renderTargetCombosListHtml(state, defenseKey, curLvl, activeSc);
        const listWrapper = modalBody.querySelector('#calc-target-combos-list-wrapper');
        if (listWrapper) {
            listWrapper.innerHTML = listResult.listHtml;
        }

        const hpEl = modalBody.querySelector('#calc-target-modal-hp');
        if (hpEl) {
            hpEl.textContent = `${formatNumber(listResult.targetHp)} ${getHpUnit()}`;
        }

        const resetWrap = modalBody.querySelector('#calc-target-modal-reset-wrap');
        if (resetWrap) {
            const hasCustomOverride = Boolean(listResult.selectedSig && listResult.selectedSig !== listResult.optimalSig);
            resetWrap.innerHTML = hasCustomOverride ? `
                <button type="button" class="calc-target-combos-overview__reset-btn" data-action="reset-to-optimal" data-defense-key="${defenseKey}">
                    <orecalc-assets-svg name="undo" width="12" height="12"></orecalc-assets-svg>
                    <span data-i18n="actions.reset">${translate('actions.reset')}</span>
                </button>
            ` : '';
            bindResetButton();
        }

        bindSelectButtons();
    };

    const levelSlider = /** @type {HTMLInputElement | null} */ (modalBody.querySelector('#calc-target-modal-level-slider, [data-action="target-level-slider"]'));
    if (levelSlider) {
        levelSlider.addEventListener('input', () => {
            const currentTH = getShownTownHall(state);
            const thInfo = getMaxDefenseLevelForTownHall(defenseKey, currentTH);
            const maxAllowedLevel = (thInfo?.status === 'available' && thInfo.level > 0) ? thInfo.level : (def.maxLevel || 1);
            const rawVal = Number(levelSlider.value) || 1;
            const newLvl = snapDefenseLevel(defenseKey, rawVal, maxAllowedLevel);
            levelSlider.value = String(newLvl);

            if (!state.defenseLevelOverrides) state.defenseLevelOverrides = {};
            state.defenseLevelOverrides[defenseKey] = newLvl;

            const maxSc = getMaxSuperchargeTier(defenseKey, newLvl);
            const isScDisabled = newLvl < (def.maxLevel || 1) || currentTH < 18 || maxSc === 0;

            if (isScDisabled) {
                // Keep active supercharge in memory before setting active tier to 0
                if (state.defenseSuperchargeOverrides?.[defenseKey] !== undefined) {
                    targetCombosSuperchargeMemory.set(defenseKey, state.defenseSuperchargeOverrides[defenseKey]);
                    delete state.defenseSuperchargeOverrides[defenseKey];
                } else if (!targetCombosSuperchargeMemory.has(defenseKey)) {
                    const currentActiveSc = Number(sheet.getAttribute('data-active-supercharge')) || 0;
                    targetCombosSuperchargeMemory.set(defenseKey, currentActiveSc);
                }
                sheet.setAttribute('data-active-supercharge', '0');
            } else {
                // Reinstate supercharge from in-memory cache if available
                const rememberedSc = targetCombosSuperchargeMemory.get(defenseKey);
                if (rememberedSc !== undefined && rememberedSc <= maxSc) {
                    sheet.setAttribute('data-active-supercharge', String(rememberedSc));
                    if (!state.defenseSuperchargeOverrides) state.defenseSuperchargeOverrides = {};
                    state.defenseSuperchargeOverrides[defenseKey] = rememberedSc;
                }
            }

            persistState();
            onStateChange();
            refreshSubtree();
        });

        levelSlider.addEventListener('change', () => {
            const currentTH = getShownTownHall(state);
            const thInfo = getMaxDefenseLevelForTownHall(defenseKey, currentTH);
            const maxAllowedLevel = (thInfo?.status === 'available' && thInfo.level > 0) ? thInfo.level : (def.maxLevel || 1);
            const rawVal = Number(levelSlider.value) || 1;
            const newLvl = snapDefenseLevel(defenseKey, rawVal, maxAllowedLevel);
            if (Number(levelSlider.value) !== newLvl) {
                levelSlider.value = String(newLvl);
                levelSlider.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
    }

    const decBtn = /** @type {HTMLButtonElement | null} */ (modalBody.querySelector('[data-action="target-level-dec"]'));
    if (decBtn && levelSlider) {
        decBtn.addEventListener('click', () => {
            const minLvl = getMinDefenseLevel(defenseKey);
            if (decBtn.disabled) return;
            const cur = Number(levelSlider.value) || minLvl;
            if (cur <= minLvl) return;
            const prev = getPrevDefenseLevel(defenseKey, cur);
            if (prev !== cur) {
                levelSlider.value = String(prev);
                levelSlider.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
    }

    const incBtn = /** @type {HTMLButtonElement | null} */ (modalBody.querySelector('[data-action="target-level-inc"]'));
    if (incBtn && levelSlider) {
        incBtn.addEventListener('click', () => {
            if (incBtn.disabled) return;
            const currentTH = getShownTownHall(state);
            const thInfo = getMaxDefenseLevelForTownHall(defenseKey, currentTH);
            const maxAllowedLevel = (thInfo?.status === 'available' && thInfo.level > 0) ? thInfo.level : (def.maxLevel || 1);
            const cur = Number(levelSlider.value) || 1;
            const next = getNextDefenseLevel(defenseKey, cur, maxAllowedLevel);
            if (next !== cur) {
                levelSlider.value = String(next);
                levelSlider.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
    }

    const scPills = modalBody.querySelectorAll('#calc-target-modal-supercharge-wrap .calc-supercharge-pill');
    scPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const btn = /** @type {HTMLButtonElement} */ (pill);
            if (btn.disabled) return;
            const tier = Number(pill.getAttribute('data-tier')) || 0;
            sheet.setAttribute('data-active-supercharge', String(tier));

            // Explicit user interaction immediately updates in-memory cache
            targetCombosSuperchargeMemory.set(defenseKey, tier);

            if (!state.defenseSuperchargeOverrides) state.defenseSuperchargeOverrides = {};
            state.defenseSuperchargeOverrides[defenseKey] = tier;

            persistState();
            onStateChange();
            refreshSubtree();
        });
    });

    bindResetButton();
    bindSelectButtons();
}
