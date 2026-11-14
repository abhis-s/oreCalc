import { updateCalculatedValue } from '../../utils/numberFormatter.js';
import { dom } from '../../dom/domElements.js';
import { selectIsEquipmentMaxed } from '../../core/selectors.js';
import { state } from '../../core/state.js';
import { syncPostMaxGoalBanner } from '../common/storageControlsHelper.js';

/**
 * Renders required ore totals across Equipment tab and Home tab results cards.
 *
 * @param {Object} requiredOres
 * @param {number} [requiredOres.shiny]
 * @param {number} [requiredOres.glowy]
 * @param {number} [requiredOres.starry]
 */
export function renderRequiredOres(requiredOres) {
    const eqTabElements = dom.equipment?.results?.quantity;
    const homeTabElements = dom.income?.home?.results?.quantity;

    const shiny = Math.round(requiredOres?.shiny || 0);
    const glowy = Math.round(requiredOres?.glowy || 0);
    const starry = Math.round(requiredOres?.starry || 0);

    if (eqTabElements?.shiny) updateCalculatedValue(eqTabElements.shiny, shiny);
    if (eqTabElements?.glowy) updateCalculatedValue(eqTabElements.glowy, glowy);
    if (eqTabElements?.starry) updateCalculatedValue(eqTabElements.starry, starry);

    if (homeTabElements?.shiny) updateCalculatedValue(homeTabElements.shiny, shiny);
    if (homeTabElements?.glowy) updateCalculatedValue(homeTabElements.glowy, glowy);
    if (homeTabElements?.starry) updateCalculatedValue(homeTabElements.starry, starry);

    const isMaxed = selectIsEquipmentMaxed(state);
    const activeGoal = state.derived?.activeGoal;
    const allowOverflow = Boolean(state.storedOres?.allowOverflow);

    const eqGoalBarContainer = dom.equipment?.storageGoalBarContainer;
    if (eqGoalBarContainer) {
        syncPostMaxGoalBanner(eqGoalBarContainer, activeGoal, isMaxed, allowOverflow, 'eq', state.heroes);
    }

    if (typeof document !== 'undefined') {
        const homeGoalBarContainer = document.getElementById('home-storage-goal-bar-container');
        if (homeGoalBarContainer) {
            syncPostMaxGoalBanner(homeGoalBarContainer, activeGoal, isMaxed, allowOverflow, 'home', state.heroes);
        }
    }
}
