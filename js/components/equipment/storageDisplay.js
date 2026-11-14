/**
 * Storage Inputs and Meter Capacity Display Controller.
 * Tier 4: Presentation / DOM Updates (Pure visual rendering, zero event listeners).
 */

import { selectIsEquipmentMaxed } from '../../core/selectors.js';
import { state } from '../../core/state.js';
import { dom } from '../../dom/domElements.js';
import { translate } from '../../i18n/translator.js';
import { formatNumber } from '../../utils/numberFormatter.js';
import { syncStoredOreInputBounds } from '../common/storageControlsHelper.js';

/**
 * Renders stored ores input values and capacity meters in equipment tab with DOM layout protection.
 *
 * @param {Object} storedOres - Stored ores state.
 * @param {import('../../core/types.js').StorageCapacityMetrics} [storageMetrics] - Optional precomputed metrics.
 */
export function renderStorageInputs(storedOres, storageMetrics = null) {
    const inputs = dom.equipment?.storage?.quantity;
    if (!inputs) return;

    if (inputs.shiny && inputs.shiny.value !== String(storedOres.shiny || 0)) inputs.shiny.value = storedOres.shiny || 0;
    if (inputs.glowy && inputs.glowy.value !== String(storedOres.glowy || 0)) inputs.glowy.value = storedOres.glowy || 0;
    if (inputs.starry && inputs.starry.value !== String(storedOres.starry || 0)) inputs.starry.value = storedOres.starry || 0;

    const isMaxed = selectIsEquipmentMaxed(state);
    syncStoredOreInputBounds(inputs, Boolean(storedOres?.allowOverflow));

    if (dom.equipment?.storageOverflowWrapper) {
        dom.equipment.storageOverflowWrapper.hidden = !isMaxed;
    }
    if (dom.equipment?.allowOverflowToggle) {
        dom.equipment.allowOverflowToggle.checked = Boolean(storedOres?.allowOverflow);
    }

    const metrics = storageMetrics || state.derived?.storageMetrics;
    const ores = /** @type {Array<'shiny' | 'glowy' | 'starry'>} */ (['shiny', 'glowy', 'starry']);
    ores.forEach(ore => {
        const meter = dom.equipment?.storageMeters?.[ore];
        if (!meter?.wrapper) return;

        if (!isMaxed || !metrics?.[ore]) {
            meter.wrapper.hidden = true;
            return;
        }

        meter.wrapper.hidden = false;
        const m = metrics[ore];
        if (meter.fill) {
            meter.fill.style.width = `${m.clampedPct}%`;
        }
        if (meter.tag) {
            if (m.isOverflowed) {
                meter.tag.textContent = `+${formatNumber(m.overflowAmount)}`;
                meter.tag.className = 'storage-meter-tag tag--overflow';
            } else if (m.isFull) {
                meter.tag.textContent = translate('views.equipment.storageFullShort');
                meter.tag.className = 'storage-meter-tag tag--full';
            } else {
                meter.tag.textContent = `${m.clampedPct}%`;
                meter.tag.className = 'storage-meter-tag';
            }
        }
    });
}
