/**
 * Welcome Modal Controller Façade
 */
export {
    welcomeState,
    updateSavedProfilesSequentially
} from './welcomeModalState.js';

export {
    getWizardState,
    setWizardState,
    resetWizardState,
    applyChecklistToProfile,
    openSetupWizard,
    goToNextWizardStep,
    goToPrevWizardStep,
    exitWizard,
    finishWizard
} from './welcomeWizardState.js';

export {
    generateGuestPlayerData,
    initializeGuestHeroesState
} from './welcomeGuestHeroState.js';

export {
    getPageFromVisualIndex,
    getVisualIndexFromPage,
    measureHeaderHeight,
    updateHeaderMinimizedState,
    updatePagination,
    updateWelcomePage2Buttons,
    updateContinueButtonDisabledState,
    updateWelcomeContinueButtonText,
    updateHeaderSkipButtonVisibility,
    updateSubmitButtonText,
    updateLoadProfileButtonText
} from './welcomeCarouselDisplay.js';

export {
    formatClanRole,
    calculateEquipmentProgress
} from './welcomeEquipmentProgress.js';

export {
    renderProfilePreviewCard,
    updatePreviewArrowPosition
} from './welcomeProfileDisplay.js';

export {
    createCompactProfileCard,
    renderWelcomeProfilesList,
    renderVerticalProfilesList
} from './welcomeProfileCardRenderer.js';

export {
    getBestMatchShopOfferSet,
    renderWelcomeShopOffers,
    syncWelcomeQuickSettings,
    toggleSubpanels
} from './welcomeSettingsDisplay.js';

export {
    renderWizardDots,
    updateWizardStepView,
    updateGuestLeagueDropdown
} from './welcomeWizardDisplay.js';

export {
    renderWelcomeSyncQr
} from './welcomeSyncDisplay.js';

export {
    showWelcomeModal,
    initializeWelcomeModal
} from './welcomeModalInputs.js';

export {
    initializeGuestSetup
} from './welcomeWizardInputs.js';
