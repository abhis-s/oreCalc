/**
 * Event Listeners & User Input Controller for Damage Calculator Building Level Editor Modal.
 * Tier 4: User Inputs (Dedicated exclusively to event listener attachments inside modal dialogs).
 */

import {
    persistState,
    pruneDefenseOverrides,
    getShownTownHall
} from './damageCalcState.js';
import { getDefensesData } from '../../data/defenseTargetsData.js';
import { getBuildingAssetUrl } from '../../core/buildingAssetHelper.js';
import { formatNumber } from '../../utils/numberFormatter.js';
import { translate } from '../../i18n/translator.js';
import {
    getHpUnit,
    getLvlShort
} from './damageCalcDisplay.js';
import {
    getMaxDefenseLevelForTownHall,
    getDefenseMaxHp,
    getMaxSuperchargeTier,
    getDefaultSuperchargeTier,
    snapDefenseLevel,
    getPrevDefenseLevel,
    getNextDefenseLevel,
    getMinDefenseLevel
} from '../../domain/damage/defenseProgressionDomain.js';
import { attachBuildingEditorToolbarListeners } from './damageCalcBuildingEditorToolbarInputs.js';

/**
 * In-memory session cache for building level editor supercharge selections across level scrubbing.
 * Preserves the user's supercharge tier when scrubbing to non-max levels,
 * reinstating it if they scrub back to max level within the same modal session.
 * Dropped whenever the modal is closed.
 * @type {Map<string, number>}
 */
const buildingEditSuperchargeMemory = new Map();

/**
 * Resets the in-memory session cache for the building level editor.
 */
export function resetBuildingEditorSuperchargeMemory() {
    buildingEditSuperchargeMemory.clear();
}

/**
 * Attaches event listeners for the Building Level Editor tab inside the Edit Levels modal.
 *
 * @param {Object} state - Damage calculator state.
 * @param {HTMLElement} modalBody - Modal body DOM container.
 * @param {() => void} onStateChange - Re-render callback.
 * @param {(state: Object, modalBody: HTMLElement, onStateChange: () => void) => void} [onReattach] - Optional callback to reattach modal listeners upon full rebuild.
 */
export function attachBuildingEditorModalListeners(state, modalBody, onStateChange, onReattach = attachBuildingEditorModalListeners) {
    if (!modalBody) return;

    // Attach toolbar, preset, group toggles, and search listeners
    attachBuildingEditorToolbarListeners(state, modalBody, onStateChange, onReattach, buildingEditSuperchargeMemory);

    // Helper: update a single building row DOM and state
    const updateBuildingRow = (buildingKey, targetLevel) => {
        const def = getDefensesData()[buildingKey];
        if (!def) return;

        const maxLvl = def.maxLevel || 1;
        const currentTH = getShownTownHall(state);
        const info = getMaxDefenseLevelForTownHall(buildingKey, currentTH);
        const maxAllowedLevel = (info?.status === 'available' && info.level > 0) ? info.level : maxLvl;
        const clampedLvl = snapDefenseLevel(buildingKey, targetLevel, maxAllowedLevel);

        if (!state.defenseLevelOverrides) state.defenseLevelOverrides = {};
        const defaultLvlForTH = info?.level || maxLvl;

        if (clampedLvl === defaultLvlForTH) {
            delete state.defenseLevelOverrides[buildingKey];
        } else {
            state.defenseLevelOverrides[buildingKey] = clampedLvl;
        }

        const maxSc = getMaxSuperchargeTier(buildingKey, clampedLvl);
        const isScDisabled = clampedLvl < maxLvl || maxSc === 0;

        if (isScDisabled) {
            // Scrubbing to non-max level: preserve active supercharge in memory if not already stored
            if (state.defenseSuperchargeOverrides?.[buildingKey] !== undefined) {
                buildingEditSuperchargeMemory.set(buildingKey, state.defenseSuperchargeOverrides[buildingKey]);
                delete state.defenseSuperchargeOverrides[buildingKey];
            } else if (!buildingEditSuperchargeMemory.has(buildingKey)) {
                const defaultSc = currentTH >= 18 ? getDefaultSuperchargeTier(buildingKey, maxLvl, currentTH) : 0;
                buildingEditSuperchargeMemory.set(buildingKey, defaultSc);
            }
        } else {
            // Scrubbing back to max level: reinstate supercharge from in-memory session cache if available
            const rememberedTier = buildingEditSuperchargeMemory.get(buildingKey);
            if (rememberedTier !== undefined && rememberedTier <= maxSc) {
                if (!state.defenseSuperchargeOverrides) state.defenseSuperchargeOverrides = {};
                state.defenseSuperchargeOverrides[buildingKey] = rememberedTier;
            }
        }

        const currentSc = isScDisabled
            ? 0
            : (state.defenseSuperchargeOverrides?.[buildingKey] !== undefined
                ? state.defenseSuperchargeOverrides[buildingKey]
                : (currentTH >= 18 ? getDefaultSuperchargeTier(buildingKey, clampedLvl, currentTH) : 0));

        const row = modalBody.querySelector(`.calc-building-modal-row[data-building-key="${buildingKey}"]`);
        if (row) {
            const slider = /** @type {HTMLInputElement | null} */ (row.querySelector('.building-level-slider'));
            if (slider && Number(slider.value) !== clampedLvl) {
                slider.value = String(clampedLvl);
            }

            const lvlBadge = row.querySelector(`#modal-bldg-lvl-${buildingKey}`);
            if (lvlBadge) {
                lvlBadge.textContent = `${getLvlShort(buildingKey)} ${clampedLvl} / ${maxLvl}`;
            }

            const currentHp = getDefenseMaxHp(buildingKey, clampedLvl, { superchargeTier: currentSc });
            const hpBadge = row.querySelector(`#modal-bldg-hp-${buildingKey}`);
            if (hpBadge) {
                hpBadge.textContent = `${formatNumber(currentHp)} ${getHpUnit()}`;
            }

            const thumbImg = row.querySelector('.calc-building-modal-row__thumb');
            if (thumbImg) {
                const targetSrc = getBuildingAssetUrl(buildingKey, clampedLvl);
                if (thumbImg.getAttribute('src') !== targetSrc) {
                    thumbImg.setAttribute('src', targetSrc);
                }
            }

            const isUnavailable = info?.status === 'locked' || info?.status === 'sunset';
            const decBtn = /** @type {HTMLButtonElement | null} */ (row.querySelector('.calc-stepper-btn[data-action="decrement"]'));
            const incBtn = /** @type {HTMLButtonElement | null} */ (row.querySelector('.calc-stepper-btn[data-action="increment"]'));
            if (decBtn) decBtn.disabled = isUnavailable || clampedLvl <= getMinDefenseLevel(buildingKey);
            if (incBtn) incBtn.disabled = isUnavailable || clampedLvl >= maxAllowedLevel;

            // Display TH cap status tag when level reaches Town Hall maximum
            const metaContainer = row.querySelector('.calc-building-modal-row__meta');
            let statusTag = row.querySelector('.calc-building-status-tag[data-status-tag="th-cap"]');
            if (currentTH < 18 && maxAllowedLevel < maxLvl) {
                const isAtMax = clampedLvl >= maxAllowedLevel;
                if (isAtMax) {
                    if (!statusTag && metaContainer) {
                        statusTag = document.createElement('span');
                        statusTag.setAttribute('data-status-tag', 'th-cap');
                        metaContainer.appendChild(statusTag);
                    }
                    if (statusTag) {
                        statusTag.className = 'calc-building-status-tag is-th-max';
                        statusTag.textContent = translate('views.damageCalc.offense.thMaxTag', { th: currentTH }) || `TH ${currentTH} Max`;
                    }
                } else if (statusTag) {
                    statusTag.remove();
                }
            } else if (statusTag) {
                statusTag.remove();
            }

            // Disable/enable supercharge controls on non-max levels
            const scWrap = row.querySelector(`#modal-bldg-sc-wrap-${buildingKey}`);
            if (scWrap) {
                scWrap.classList.toggle('is-disabled', isScDisabled);
                scWrap.querySelectorAll('.calc-supercharge-pill').forEach(p => {
                    const btn = /** @type {HTMLButtonElement} */ (p);
                    btn.disabled = isScDisabled;
                    const tier = Number(p.getAttribute('data-tier')) || 0;
                    const isMatch = isScDisabled ? tier === 0 : tier === currentSc;
                    p.classList.toggle('active', isMatch);
                    p.classList.toggle('is-active', isMatch);
                    p.setAttribute('aria-checked', String(isMatch));
                });
            }
        }

        modalBody.dataset.isDirty = 'true';
        const totalOverrides = pruneDefenseOverrides(state);
        const badge = modalBody.querySelector('#calc-building-overrides-badge');
        if (badge) {
            badge.textContent = translate('views.damageCalc.clusterPlanner.overridesCount', { count: totalOverrides });
            badge.classList.toggle('is-active', totalOverrides > 0);
        }
        const resetBtnEl = /** @type {HTMLButtonElement | null} */ (modalBody.querySelector('#calc-building-reset-btn'));
        if (resetBtnEl) resetBtnEl.disabled = totalOverrides === 0;
    };

    // Range Sliders
    const sliders = modalBody.querySelectorAll('.building-level-slider');
    sliders.forEach(slider => {
        slider.addEventListener('input', (e) => {
            const input = /** @type {HTMLInputElement} */ (e.target);
            const key = input.getAttribute('data-building-key');
            if (!key) return;
            const currentTH = getShownTownHall(state);
            const info = getMaxDefenseLevelForTownHall(key, currentTH);
            const def = getDefensesData()[key];
            const maxAllowedLevel = (info?.status === 'available' && info.level > 0) ? info.level : (def?.maxLevel || 1);
            const rawVal = Number(input.value) || 1;
            const snappedVal = snapDefenseLevel(key, rawVal, maxAllowedLevel);
            input.value = String(snappedVal);
            updateBuildingRow(key, snappedVal);
            persistState();
        });

        slider.addEventListener('change', () => {
            persistState();
            onStateChange();
        });
    });

    // Stepper Buttons (+ / -)
    const stepperBtns = modalBody.querySelectorAll('.calc-stepper-btn[data-action]');
    stepperBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const button = /** @type {HTMLButtonElement} */ (btn);
            if (button.disabled) return;
            const key = btn.getAttribute('data-building-key');
            const action = btn.getAttribute('data-action');
            if (!key || !action) return;

            const def = getDefensesData()[key];
            if (!def) return;
            const currentTH = getShownTownHall(state);
            const info = getMaxDefenseLevelForTownHall(key, currentTH);
            const maxLvl = def.maxLevel || 1;
            const maxAllowedLevel = (info?.status === 'available' && info.level > 0) ? info.level : maxLvl;
            const currentLvl = state.defenseLevelOverrides?.[key] !== undefined
                ? state.defenseLevelOverrides[key]
                : (info?.level || maxLvl);

            if (action === 'increment' && currentLvl >= maxAllowedLevel) return;
            if (action === 'decrement' && currentLvl <= getMinDefenseLevel(key)) return;

            const nextLvl = action === 'increment'
                ? getNextDefenseLevel(key, currentLvl, maxAllowedLevel)
                : getPrevDefenseLevel(key, currentLvl);
            updateBuildingRow(key, nextLvl);
            persistState();
            onStateChange();
        });
    });

    // Supercharge Pills
    const scPills = modalBody.querySelectorAll('.calc-supercharge-pill[data-building-key]');
    scPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const btn = /** @type {HTMLButtonElement} */ (pill);
            if (btn.disabled) return;
            const key = pill.getAttribute('data-building-key');
            const tier = Number(pill.getAttribute('data-tier')) || 0;
            if (!key) return;

            // Explicit user interaction immediately updates the in-memory cache
            buildingEditSuperchargeMemory.set(key, tier);

            const currentTH = getShownTownHall(state);
            const def = getDefensesData()[key];
            const maxLvl = def?.maxLevel || 1;
            const currentLvl = state.defenseLevelOverrides?.[key] !== undefined
                ? state.defenseLevelOverrides[key]
                : (getMaxDefenseLevelForTownHall(key, currentTH)?.level || maxLvl);
            const defaultSc = (currentTH >= 18 && currentLvl >= maxLvl)
                ? getDefaultSuperchargeTier(key, currentLvl, currentTH)
                : 0;

            if (tier === defaultSc) {
                if (state.defenseSuperchargeOverrides) {
                    delete state.defenseSuperchargeOverrides[key];
                }
            } else {
                if (!state.defenseSuperchargeOverrides) state.defenseSuperchargeOverrides = {};
                state.defenseSuperchargeOverrides[key] = tier;
            }

            const pillsWrap = pill.closest('.calc-supercharge-pills');
            pillsWrap?.querySelectorAll('.calc-supercharge-pill').forEach(p => {
                const isMatch = p === pill;
                p.classList.toggle('active', isMatch);
                p.classList.toggle('is-active', isMatch);
                p.setAttribute('aria-checked', String(isMatch));
            });

            const currentHp = getDefenseMaxHp(key, currentLvl, { superchargeTier: tier });
            const hpBadge = modalBody.querySelector(`#modal-bldg-hp-${key}`);
            if (hpBadge) {
                hpBadge.textContent = `${formatNumber(currentHp)} ${getHpUnit()}`;
            }

            const totalOverrides = pruneDefenseOverrides(state);
            const badge = modalBody.querySelector('#calc-building-overrides-badge');
            if (badge) {
                badge.textContent = translate('views.damageCalc.clusterPlanner.overridesCount', { count: totalOverrides });
                badge.classList.toggle('is-active', totalOverrides > 0);
            }
            const resetBtnEl = /** @type {HTMLButtonElement | null} */ (modalBody.querySelector('#calc-building-reset-btn'));
            if (resetBtnEl) resetBtnEl.disabled = totalOverrides === 0;

            persistState();
            onStateChange();
        });
    });
}
