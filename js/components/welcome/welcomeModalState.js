import { state } from '../../core/state.js';
import { loadAndProcessPlayerData } from '../../services/serverResponseHandler.js';

// Central wizard and onboarding state
export const welcomeState = {
    currentPage: 1,
    cameFromSyncStartBtn: false,
    entrySource: 'onboarding',
    scrollTargetPage: null,
    isProfileLoaded: false,
    isInputProfileLoading: false,
    welcomeProfilesOrder: [],
    selectedTH: 16,
    selectedLeague: 105000000,
    updatingProfiles: {},
    errorProfiles: {},
    successProfiles: {},
    activeWizardTag: null,
    wasAlreadyOnboarded: false,
    currentWizardStepIndex: 0,
    wizardSteps: [],

    // Temporary staged settings
    tempStoredShiny: 0,
    tempStoredGlowy: 0,
    tempStoredStarry: 0,
    tempRaidMedalsBuy: false,
    tempRaidMedalsEarned: 1200,
    tempRaidMedalsStarry: 0,
    tempRaidMedalsGlowy: 0,
    tempRaidMedalsShiny: 0,
    tempGemsBuy: false,
    tempGemsStarry: 0,
    tempGemsGlowy: 0,
    tempGemsShiny: 0,
    tempShopOffersBuy: false,
    tempShopOffersPurchases: {},
    tempClanWars: false,
    tempClanWarsCount: 8,
    tempClanWarsWinrate: 70,
    tempClanWarsDrawrate: 0,
    tempCwl: false,
    tempCwlHits: 7,
    tempCwlWinrate: 50,
    tempCwlDrawrate: 0,
    tempGoldPass: false,
    tempCloudSync: true,
    tempEventPassBuy: false,
    tempEventIncludeEquipment: false,
    tempEventBonusMedals: 0,
    tempEventPurchasedMedals: 0,
    tempEventTraderBuy: false,
    tempEventTraderShiny: 0,
    tempEventTraderGlowy: 0,
    tempEventTraderStarry: 0,
    tempCurrencyCode: 'USD'
};

/**
 * Iterates through all saved player profiles sequentially and refreshes their data from the API.
 * Dispatches `welcome:profiles-updated` events for reactive UI loading states.
 * @returns {Promise<void>}
 */
export async function updateSavedProfilesSequentially() {
    const savedTags = state.savedPlayerTags.filter(tag => tag !== 'DEFAULT0');
    if (savedTags.length === 0) return;

    for (const tag of savedTags) {
        welcomeState.updatingProfiles[tag] = true;
        welcomeState.errorProfiles[tag] = false;
        welcomeState.successProfiles[tag] = false;

        document.dispatchEvent(new CustomEvent('welcome:profiles-updated'));

        try {
            const result = await loadAndProcessPlayerData(tag, { updateOrder: false });
            welcomeState.updatingProfiles[tag] = false;
            if (result && result.success) {
                welcomeState.successProfiles[tag] = true;
            } else {
                welcomeState.errorProfiles[tag] = true;
            }
        } catch (e) {
            welcomeState.updatingProfiles[tag] = false;
            welcomeState.errorProfiles[tag] = true;
        }

        document.dispatchEvent(new CustomEvent('welcome:profiles-updated'));
    }
}
