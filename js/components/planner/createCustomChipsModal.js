/**
 * Custom chips creation modal façade re-exporting display and input controllers.
 */

export {
    oreTypes,
    oreLimits,
    prospectorUIState,
    getNextUpgradeProspectorRecommendations,
    getNextUpgradeProspectorRecommendation,
    updatePerChipRewardsPreview,
    updateProspectorInputLimits,
    updateModalProspectorDropdowns,
    prefillModalInputs,
    openCreateCustomChipsModal,
    closeCreateCustomChipsModal
} from './createCustomChipsModalDisplay.js';

export {
    initializeModalCustomDropdown
} from './customChipPopoversManager.js';

export {
    syncProspectorUI,
    initializeCreateCustomChipsModalListeners
} from './createCustomChipsModalInputs.js';
