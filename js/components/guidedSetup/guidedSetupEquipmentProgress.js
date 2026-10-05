import { calculateEquipmentProgress as calculateDomainEquipmentProgress } from '../../domain/equipment/equipmentProgressDomain.js';

/**
 * Calculates percentage completion of Common and Epic equipment upgrades for a player.
 * Delegated to canonical domain calculator.
 *
 * @param {Object} playerData
 * @returns {import('../../domain/equipment/equipmentProgressDomain.js').EquipmentProgressResult}
 */
export function calculateEquipmentProgress(playerData) {
    return calculateDomainEquipmentProgress(playerData);
}
