import {
    EFFECTIVE_DATE_PROFILE_ONBOARDING,
    state
} from '../../core/state.js';
import { handleStateUpdate, switchActivePlayer } from '../../core/stateManager.js';
import { updateSavedPlayerTags } from '../../core/playerStorage.js';
import { autoPlaceIncomeChipsForRange } from '../../utils/autoPlaceChips.js';
import { navigateToTab } from '../layout/tabs.js';
import { getMaxDate, getMinDate } from '../../utils/dateUtils.js';
import { showConfirm } from '../../ui/noticeModal.js';
import { translate } from '../../i18n/translator.js';

import { guidedSetupState, applyPreferencesToProfile } from './guidedSetupState.js';
import { updateGuidedSetupStepView } from './guidedSetupStepsDisplay.js';

/**
 * Moves directly to the specified Guided Setup step index (1 through 6).
 * @param {number} stepNumber - Target step number (1 to 6).
 */
export function goToStep(stepNumber) {
    if (stepNumber < 1 || stepNumber > 6) return;
    updateGuidedSetupStepView(stepNumber);
}

/**
 * Advances to the next step or finalizes setup if already on the last step.
 * @param {() => void} onClose - Callback to close modal dialog upon completion.
 */
export function goToNextStep(onClose) {
    const current = guidedSetupState.currentStep;

    if (current === 1) {
        if (!guidedSetupState.isProfileLoaded || !guidedSetupState.activeTag) {
            return;
        }
        goToStep(2);
        return;
    }

    if (current < 6) {
        goToStep(current + 1);
        return;
    }

    if (current === 6) {
        finishSetup(false, onClose);
    }
}

/**
 * Steps backward to the previous step in Guided Setup.
 */
export function goToPrevStep() {
    const current = guidedSetupState.currentStep;
    if (current > 1) {
        goToStep(current - 1);
    }
}

/**
 * Skips remaining setup steps and completes onboarding with recommended defaults.
 * @param {() => void} onClose - Callback to close modal dialog upon completion.
 */
export async function skipSetup(onClose) {
    const confirmed = await showConfirm(
        translate('confirms.skipSetup') || 'Skip setup and apply recommended defaults?',
        'actions.confirm',
        'actions.skipAnyway',
        'actions.cancel'
    );
    if (!confirmed) return;

    finishSetup(true, onClose);
}

/**
 * Commits preferences to profile, stamps timestamps, persists state, hydrates planner, and closes modal.
 * @param {boolean} [isSkipped=false] - Whether remaining configuration was skipped.
 * @param {() => void} [onClose] - Callback to close modal dialog.
 */
export function finishSetup(isSkipped = false, onClose = () => {}) {
    const activeTag = guidedSetupState.activeTag;
    if (!activeTag) return;

    handleStateUpdate(() => {
        const now = Date.now();
        const playerObj = state.allPlayersData[activeTag];
        if (playerObj) {
            if (isSkipped) {
                guidedSetupState.tempClanWars = true;
                guidedSetupState.tempClanWarsCount = 8;
                guidedSetupState.tempClanWarsWinrate = 70;
                guidedSetupState.tempClanWarsDrawrate = 0;
                guidedSetupState.tempCwl = true;
                guidedSetupState.tempCwlHits = 7;
                guidedSetupState.tempCwlWinrate = 50;
                guidedSetupState.tempCwlDrawrate = 0;
                guidedSetupState.tempRaidMedalsBuy = true;
                guidedSetupState.tempRaidMedalsStarry = 2;
                guidedSetupState.tempRaidMedalsGlowy = 2;
                guidedSetupState.tempRaidMedalsShiny = 0;
                guidedSetupState.tempEventPassBuy = true;
                guidedSetupState.tempEventIncludeEquipment = true;
                applyPreferencesToProfile(playerObj);
            } else {
                applyPreferencesToProfile(playerObj);
            }

            playerObj.onboardingTimestamp = Math.max(now, EFFECTIVE_DATE_PROFILE_ONBOARDING + 1);

            state.heroes = playerObj.heroes;
            state.storedOres = playerObj.storedOres;
            state.income = playerObj.income;
            state.playerProfile = playerObj.playerProfile;
        }
    }, true);

    switchActivePlayer(activeTag);
    updateSavedPlayerTags(activeTag);

    // Hydrate planner income chips
    const { month: MIN_MONTH, year: MIN_YEAR } = getMinDate();
    const { month: MAX_MONTH, year: MAX_YEAR } = getMaxDate();
    autoPlaceIncomeChipsForRange(MIN_MONTH, MIN_YEAR, MAX_MONTH, MAX_YEAR, true);

    if (typeof onClose === 'function') {
        onClose();
    }

    navigateToTab('home', { resetScroll: true });

    if (typeof document.dispatchEvent === 'function') {
        document.dispatchEvent(new CustomEvent('guided-setup:complete', { detail: { tag: activeTag } }));
    }
}
