/**
 * Income chips module façade re-exporting display and input controllers.
 */

export {
    calculateIncomeChips,
    getPlacedChipIds,
    renderUnplacedChips,
    renderIncomeChips,
    packIncomeChips,
    packLegendItems
} from './incomeChipsDisplay.js';

export {
    handleDragOverForChipContainer,
    handleDragLeaveForChipContainer,
    handleDropToChipContainer,
    handleChipDropOnContainer,
    initializeIncomeChipsEventListeners
} from './incomeChipsInputs.js';
