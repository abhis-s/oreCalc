import { shopOfferData } from '../../data/incomeSources/shopOffers.js';
import { translate } from '../../i18n/translator.js';

import {
    EFFECTIVE_DATE_PROFILE_ONBOARDING,
    getDefaultPlayerState,
    isProfileOnboarded,
    state
} from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { generateGuestPlayerData, initializeGuestHeroesState } from './welcomeGuestHeroState.js';
import { welcomeState } from './welcomeModalState.js';

/**
 * Returns a snapshot of the active wizard state object.
 * @returns {object} Active wizard state object.
 */
export function getWizardState() {
    return {
        activeWizardTag: welcomeState.activeWizardTag,
        currentWizardStepIndex: welcomeState.currentWizardStepIndex,
        wizardSteps: [...welcomeState.wizardSteps],
        selectedTH: welcomeState.selectedTH,
        selectedLeague: welcomeState.selectedLeague
    };
}

/**
 * Updates wizard state fields with specified property overrides.
 * @param {object} [updates={}] - Partial state updates to apply.
 */
export function setWizardState(updates = {}) {
    Object.assign(welcomeState, updates);
}

/**
 * Resets all temporary wizard settings, checklist buffers, and active player tags to defaults.
 */
export function resetWizardState() {
    welcomeState.activeWizardTag = null;
    welcomeState.currentWizardStepIndex = 0;
    welcomeState.wizardSteps = [];
    welcomeState.wasAlreadyOnboarded = false;
    welcomeState.tempStoredShiny = 0;
    welcomeState.tempStoredGlowy = 0;
    welcomeState.tempStoredStarry = 0;
    welcomeState.tempRaidMedalsBuy = false;
    welcomeState.tempRaidMedalsEarned = 1200;
    welcomeState.tempRaidMedalsStarry = 0;
    welcomeState.tempRaidMedalsGlowy = 0;
    welcomeState.tempRaidMedalsShiny = 0;
    welcomeState.tempGemsBuy = false;
    welcomeState.tempGemsStarry = 0;
    welcomeState.tempGemsGlowy = 0;
    welcomeState.tempGemsShiny = 0;
    welcomeState.tempShopOffersBuy = false;
    welcomeState.tempShopOffersPurchases = {};
    welcomeState.tempClanWars = false;
    welcomeState.tempClanWarsCount = 8;
    welcomeState.tempClanWarsWinrate = 70;
    welcomeState.tempClanWarsDrawrate = 0;
    welcomeState.tempCwl = false;
    welcomeState.tempCwlHits = 7;
    welcomeState.tempCwlWinrate = 50;
    welcomeState.tempCwlDrawrate = 0;
    welcomeState.tempGoldPass = false;
    welcomeState.tempCloudSync = true;
    welcomeState.tempEventPassBuy = false;
    welcomeState.tempEventIncludeEquipment = false;
    welcomeState.tempEventBonusMedals = 0;
    welcomeState.tempEventPurchasedMedals = 0;
    welcomeState.tempEventTraderBuy = false;
    welcomeState.tempEventTraderShiny = 0;
    welcomeState.tempEventTraderGlowy = 0;
    welcomeState.tempEventTraderStarry = 0;
    welcomeState.tempCurrencyCode = 'USD';
}

/**
 * Commits temporary wizard checklist configurations and stored ore quantities into a player profile.
 * @param {any} playerObj - Target player data object in allPlayersData.
 */
export function applyChecklistToProfile(playerObj) {
    if (!playerObj) return;

    if (!playerObj.storedOres) {
        playerObj.storedOres = { shiny: 0, glowy: 0, starry: 0 };
    }
    playerObj.storedOres.shiny = welcomeState.tempStoredShiny;
    playerObj.storedOres.glowy = welcomeState.tempStoredGlowy;
    playerObj.storedOres.starry = welcomeState.tempStoredStarry;

    if (!playerObj.income) {
        playerObj.income = {};
    }
    if (!playerObj.income.raidMedals) {
        playerObj.income.raidMedals = { enabled: false, earned: 1200, packs: { shiny: 0, glowy: 0, starry: 0 } };
    }
    if (!playerObj.income.raidMedals.packs) {
        playerObj.income.raidMedals.packs = { shiny: 0, glowy: 0, starry: 0 };
    }
    playerObj.income.raidMedals.enabled = welcomeState.tempRaidMedalsBuy;
    playerObj.income.raidMedals.earned = welcomeState.tempRaidMedalsBuy ? welcomeState.tempRaidMedalsEarned : 0;
    if (welcomeState.tempRaidMedalsBuy) {
        playerObj.income.raidMedals.packs.shiny = welcomeState.tempRaidMedalsShiny;
        playerObj.income.raidMedals.packs.glowy = welcomeState.tempRaidMedalsGlowy;
        playerObj.income.raidMedals.packs.starry = welcomeState.tempRaidMedalsStarry;
    } else {
        playerObj.income.raidMedals.packs.shiny = 0;
        playerObj.income.raidMedals.packs.glowy = 0;
        playerObj.income.raidMedals.packs.starry = 0;
    }

    if (!playerObj.income.gems) {
        playerObj.income.gems = { enabled: false, packs: { shiny: 0, glowy: 0, starry: 0 } };
    }
    if (!playerObj.income.gems.packs) {
        playerObj.income.gems.packs = { shiny: 0, glowy: 0, starry: 0 };
    }
    playerObj.income.gems.enabled = welcomeState.tempGemsBuy;
    if (welcomeState.tempGemsBuy) {
        playerObj.income.gems.packs.shiny = welcomeState.tempGemsShiny;
        playerObj.income.gems.packs.glowy = welcomeState.tempGemsGlowy;
        playerObj.income.gems.packs.starry = welcomeState.tempGemsStarry;
    } else {
        playerObj.income.gems.packs.shiny = 0;
        playerObj.income.gems.packs.glowy = 0;
        playerObj.income.gems.packs.starry = 0;
    }

    if (!playerObj.income.shopOffers) {
        playerObj.income.shopOffers = { enabled: false, selectedSet: "0", purchases: {} };
    }
    if (!playerObj.income.shopOffers.purchases) {
        playerObj.income.shopOffers.purchases = {};
    }
    playerObj.income.shopOffers.enabled = welcomeState.tempShopOffersBuy;
    if (welcomeState.tempShopOffersBuy) {
        const thLevel = playerObj?.playerProfile?.townHallLevel || 16;
        let bestMatchSet = "0";
        if (shopOfferData[thLevel]) {
            bestMatchSet = String(thLevel);
        } else {
            const availableTHs = Object.keys(shopOfferData).map(Number).filter(n => !isNaN(n)).sort((a, b) => b - a);
            const lowerTH = availableTHs.find(th => th <= thLevel);
            bestMatchSet = lowerTH ? String(lowerTH) : (availableTHs[availableTHs.length - 1] ? String(availableTHs[availableTHs.length - 1]) : "0");
        }
        playerObj.income.shopOffers.selectedSet = bestMatchSet;
        playerObj.income.shopOffers.purchases = structuredClone(welcomeState.tempShopOffersPurchases || {});
    } else {
        playerObj.income.shopOffers.selectedSet = "0";
        playerObj.income.shopOffers.purchases = {};
    }

    if (!playerObj.income.clanWar) {
        playerObj.income.clanWar = { enabled: false, warsPerMonth: 8, winRate: 70, drawRate: 0, oresPerAttack: { shiny: 0, glowy: 0, starry: 0 }, warPerformance: { thLevel: 16 } };
    }
    if (!playerObj.income.clanWar.oresPerAttack) {
        playerObj.income.clanWar.oresPerAttack = { shiny: 0, glowy: 0, starry: 0 };
    }
    playerObj.income.clanWar.enabled = welcomeState.tempClanWars;
    if (welcomeState.tempClanWars) {
        playerObj.income.clanWar.warsPerMonth = welcomeState.tempClanWarsCount;
        playerObj.income.clanWar.winRate = welcomeState.tempClanWarsWinrate;
        playerObj.income.clanWar.drawRate = welcomeState.tempClanWarsDrawrate;
        const thLevel = playerObj?.playerProfile?.townHallLevel || 16;
        playerObj.income.clanWar.warPerformance = { thLevel };
    }

    if (!playerObj.income.cwl) {
        playerObj.income.cwl = { enabled: false, hitsPerSeason: 7, attacksPerEvent: 7, winRate: 50, drawRate: 0, oresPerAttack: { shiny: 0, glowy: 0, starry: 0 } };
    }
    if (!playerObj.income.cwl.oresPerAttack) {
        playerObj.income.cwl.oresPerAttack = { shiny: 0, glowy: 0, starry: 0 };
    }
    playerObj.income.cwl.enabled = welcomeState.tempCwl;
    if (welcomeState.tempCwl) {
        playerObj.income.cwl.hitsPerSeason = welcomeState.tempCwlHits;
        playerObj.income.cwl.attacksPerEvent = welcomeState.tempCwlHits;
        playerObj.income.cwl.winRate = welcomeState.tempCwlWinrate;
        playerObj.income.cwl.drawRate = welcomeState.tempCwlDrawrate;
    }

    if (!playerObj.income.eventPass) {
        playerObj.income.eventPass = {
            enabled: false,
            eventPass: false,
            includeEquipment: false,
            bonusTrackMedals: 0,
            purchasedMedals: 0,
            trader: { enabled: false, packs: { shiny: 0, glowy: 0, starry: 0 } }
        };
    }
    if (!playerObj.income.eventPass.trader) {
        playerObj.income.eventPass.trader = { enabled: false, packs: { shiny: 0, glowy: 0, starry: 0 } };
    }
    if (!playerObj.income.eventPass.trader.packs) {
        playerObj.income.eventPass.trader.packs = { shiny: 0, glowy: 0, starry: 0 };
    }
    playerObj.income.eventPass.enabled = welcomeState.tempEventPassBuy;
    playerObj.income.eventPass.eventPass = welcomeState.tempEventPassBuy;
    playerObj.income.eventPass.includeEquipment = welcomeState.tempEventIncludeEquipment;
    playerObj.income.eventPass.bonusTrackMedals = welcomeState.tempEventBonusMedals;
    playerObj.income.eventPass.purchasedMedals = welcomeState.tempEventPurchasedMedals;
    playerObj.income.eventPass.trader.enabled = welcomeState.tempEventTraderBuy;
    if (welcomeState.tempEventTraderBuy) {
        playerObj.income.eventPass.trader.packs.shiny = welcomeState.tempEventTraderShiny;
        playerObj.income.eventPass.trader.packs.glowy = welcomeState.tempEventTraderGlowy;
        playerObj.income.eventPass.trader.packs.starry = welcomeState.tempEventTraderStarry;
    } else {
        playerObj.income.eventPass.trader.packs.shiny = 0;
        playerObj.income.eventPass.trader.packs.glowy = 0;
        playerObj.income.eventPass.trader.packs.starry = 0;
    }

    if (!playerObj.income.eventTrader) {
        playerObj.income.eventTrader = { enabled: false, packs: { shiny: 0, glowy: 0, starry: 0 } };
    }
    if (!playerObj.income.eventTrader.packs) {
        playerObj.income.eventTrader.packs = { shiny: 0, glowy: 0, starry: 0 };
    }
    playerObj.income.eventTrader.enabled = welcomeState.tempEventTraderBuy;
    if (welcomeState.tempEventTraderBuy) {
        playerObj.income.eventTrader.packs.shiny = welcomeState.tempEventTraderShiny;
        playerObj.income.eventTrader.packs.glowy = welcomeState.tempEventTraderGlowy;
        playerObj.income.eventTrader.packs.starry = welcomeState.tempEventTraderStarry;
    } else {
        playerObj.income.eventTrader.packs.shiny = 0;
        playerObj.income.eventTrader.packs.glowy = 0;
        playerObj.income.eventTrader.packs.starry = 0;
    }

    if (!playerObj.income.goldPass) {
        playerObj.income.goldPass = { enabled: false };
    }
    playerObj.income.goldPass.enabled = welcomeState.tempGoldPass;

    if (!playerObj.currency) {
        playerObj.currency = { code: welcomeState.tempCurrencyCode || 'USD' };
    } else {
        playerObj.currency.code = welcomeState.tempCurrencyCode || 'USD';
    }

    if (state.uiSettings) {
        if (!state.uiSettings.currency) {
            state.uiSettings.currency = { code: welcomeState.tempCurrencyCode || 'USD' };
        } else {
            state.uiSettings.currency.code = welcomeState.tempCurrencyCode || 'USD';
        }
        state.uiSettings.cloudSync = welcomeState.tempCloudSync;
    }
}

/**
 * Opens and initializes the Setup Wizard sequence for a selected player tag.
 * @param {string} tag - Player profile tag or 'DEFAULT0'.
 * @param {any} [callbacks={}] - Object containing UI update and render callbacks.
 */
export function openSetupWizard(tag, callbacks = {}) {
    welcomeState.activeWizardTag = tag;
    welcomeState.currentWizardStepIndex = 0;

    welcomeState.wasAlreadyOnboarded = isProfileOnboarded(state.allPlayersData[tag]);

    if (tag === 'DEFAULT0' && !state.allPlayersData['DEFAULT0']) {
        const guestPlayerData = generateGuestPlayerData(welcomeState.selectedTH, welcomeState.selectedLeague);
        const guestPlayerState = {
            ...getDefaultPlayerState(),
            playerProfile: guestPlayerData,
            onboardingTimestamp: null
        };
        initializeGuestHeroesState(guestPlayerState);
        state.allPlayersData['DEFAULT0'] = guestPlayerState;
    }

    const playerObj = state.allPlayersData[tag];
    if (!playerObj) return;

    const isGuest = (tag === 'DEFAULT0');
    if (isGuest) {
        const profile = playerObj.playerProfile || playerObj;
        welcomeState.selectedTH = profile.townHallLevel || 16;
        welcomeState.selectedLeague = profile.leagueTier?.id || 105000000;
        if (callbacks.onInitializeGuestSetup) callbacks.onInitializeGuestSetup();
    }

    if (isGuest) {
        welcomeState.wizardSteps = [1, 2, 3, 4, 5, 6];
    } else {
        welcomeState.wizardSteps = [2, 3, 4, 5, 6];
    }

    const thLevel = playerObj?.playerProfile?.townHallLevel || playerObj?.townHallLevel || 1;

    const nameEl = document.getElementById('welcome-wizard-profile-name');
    const tagEl = document.getElementById('welcome-wizard-profile-tag');
    const thImgEl = document.getElementById('welcome-wizard-th-img');

    if (nameEl) {
        nameEl.textContent = isGuest ? translate('player.guest') : (playerObj?.playerProfile?.name || playerObj?.playerData?.name || tag);
    }
    if (tagEl) {
        tagEl.textContent = isGuest ? translate('views.welcome.guestProfileTag') : `#${tag}`;
    }
    if (thImgEl) {
        thImgEl.src = `assets/th/th${thLevel}.png`;
        thImgEl.alt = `TH ${thLevel}`;
    }

    if (callbacks.onSyncQuickSettings) callbacks.onSyncQuickSettings(tag);

    const selectionView = document.getElementById('welcome-profiles-selection-view');
    const wizardView = document.getElementById('welcome-profile-setup-wizard-view');
    const loadingView = document.getElementById('welcome-profile-setup-loading-view');
    const mainActions = document.getElementById('welcome-main-actions');
    const welcomeDots = document.getElementById('welcome-dots');
    const carousel = document.getElementById('welcome-carousel');

    if (selectionView) selectionView.style.display = 'none';
    if (wizardView) wizardView.style.display = 'none';
    if (loadingView) loadingView.style.display = 'flex';
    if (mainActions) mainActions.style.display = 'flex';
    if (welcomeDots) welcomeDots.style.display = 'flex';
    if (carousel) carousel.classList.add('no-scroll');

    const continueBtn = document.getElementById('welcome-continue-btn');
    const backBtn = document.getElementById('welcome-back-btn');
    const guestBtn = document.getElementById('welcome-guest-btn');
    const submitBtn = document.getElementById('welcome-submit-btn');
    const syncDeviceStartBtn = document.getElementById('welcome-sync-device-start-btn');
    const wizardNextBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('welcome-wizard-next-btn'));
    const wizardBackBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('welcome-wizard-back-btn'));

    if (continueBtn) continueBtn.style.display = 'none';
    if (backBtn) backBtn.style.display = 'none';
    if (guestBtn) guestBtn.style.display = 'none';
    if (submitBtn) submitBtn.style.display = 'none';
    if (syncDeviceStartBtn) syncDeviceStartBtn.style.display = 'none';
    if (wizardNextBtn) {
        wizardNextBtn.style.display = 'inline-flex';
        wizardNextBtn.disabled = true;
    }
    if (wizardBackBtn) {
        wizardBackBtn.style.display = 'inline-flex';
        wizardBackBtn.disabled = true;
    }

    if (callbacks.onRenderWizardDots) callbacks.onRenderWizardDots();

    const headerSkipBtn = document.getElementById('welcome-header-skip-btn');
    if (headerSkipBtn) headerSkipBtn.style.display = 'none';

    setTimeout(() => {
        if (welcomeState.activeWizardTag !== tag) return;

        if (loadingView) loadingView.style.display = 'none';
        if (wizardView) wizardView.style.display = 'flex';
        if (wizardNextBtn) wizardNextBtn.disabled = false;
        if (wizardBackBtn) wizardBackBtn.disabled = false;

        if (callbacks.onUpdateWizardStepView) callbacks.onUpdateWizardStepView();
        if (callbacks.onUpdateHeaderSkip) callbacks.onUpdateHeaderSkip();
        if (callbacks.onSyncInertState) callbacks.onSyncInertState();
    }, 500);
}

/**
 * Advances the setup wizard to the next step, or finalizes wizard on the last step.
 * @param {any} [callbacks={}] - Callback bindings for UI update.
 */
export function goToNextWizardStep(callbacks = {}) {
    if (welcomeState.currentWizardStepIndex === welcomeState.wizardSteps.length - 1) {
        finishWizard(false, callbacks);
    } else {
        welcomeState.currentWizardStepIndex++;
        if (callbacks.onUpdateWizardStepView) callbacks.onUpdateWizardStepView();
    }
}

/**
 * Returns to the previous wizard step, or prompts to cancel and exits wizard if on step 0.
 * @param {any} [callbacks={}] - Callback bindings for UI update.
 */
export function goToPrevWizardStep(callbacks = {}) {
    if (welcomeState.currentWizardStepIndex === 0) {
        const tag = welcomeState.activeWizardTag;
        if (tag && !welcomeState.wasAlreadyOnboarded) {
            handleStateUpdate(() => {
                const playerObj = state.allPlayersData[tag];
                if (playerObj) {
                    playerObj.onboardingTimestamp = null;
                }
            }, true);
        }
        exitWizard(callbacks);
    } else {
        welcomeState.currentWizardStepIndex--;
        if (callbacks.onUpdateWizardStepView) callbacks.onUpdateWizardStepView();
    }
}

/**
 * Exits the setup wizard and restores Page 3 vertical profiles list view and navigation actions.
 * @param {any} [callbacks={}] - Callback bindings for UI update.
 */
export function exitWizard(callbacks = {}) {
    welcomeState.activeWizardTag = null;

    const selectionView = document.getElementById('welcome-profiles-selection-view');
    const wizardView = document.getElementById('welcome-profile-setup-wizard-view');
    const loadingView = document.getElementById('welcome-profile-setup-loading-view');
    const mainActions = document.getElementById('welcome-main-actions');

    if (selectionView) selectionView.style.display = 'flex';
    if (wizardView) wizardView.style.display = 'none';
    if (loadingView) loadingView.style.display = 'none';
    if (mainActions) mainActions.style.display = 'flex';

    const wizardNextBtn = document.getElementById('welcome-wizard-next-btn');
    const wizardBackBtn = document.getElementById('welcome-wizard-back-btn');
    const continueBtn = document.getElementById('welcome-continue-btn');
    const backBtn = document.getElementById('welcome-back-btn');
    const guestBtn = document.getElementById('welcome-guest-btn');
    const submitBtn = document.getElementById('welcome-submit-btn');
    const syncDeviceStartBtn = document.getElementById('welcome-sync-device-start-btn');

    if (wizardNextBtn) wizardNextBtn.style.display = 'none';
    if (wizardBackBtn) wizardBackBtn.style.display = 'none';
    if (continueBtn) continueBtn.style.display = 'inline-flex';
    if (backBtn) backBtn.style.display = 'inline-flex';
    if (guestBtn) guestBtn.style.display = 'none';
    if (submitBtn) submitBtn.style.display = 'none';
    if (syncDeviceStartBtn) syncDeviceStartBtn.style.display = 'none';

    const welcomeDots = document.getElementById('welcome-dots');
    if (welcomeDots) {
        welcomeDots.style.display = 'flex';
        welcomeDots.innerHTML = `
            <span class="welcome-dot" data-page="1"></span>
            <span class="welcome-dot" data-page="2"></span>
            <span class="welcome-dot active" data-page="3"></span>
            <span class="welcome-dot" data-page="4"></span>
        `;
    }

    const carousel = document.getElementById('welcome-carousel');
    if (carousel) carousel.classList.remove('no-scroll');

    document.dispatchEvent(new CustomEvent('welcome:profiles-updated'));

    if (callbacks.onRenderVerticalProfilesList) callbacks.onRenderVerticalProfilesList();
    if (callbacks.onUpdateWelcomeContinueButtonText) callbacks.onUpdateWelcomeContinueButtonText(3);
    if (callbacks.onUpdateHeaderSkipButtonVisibility) callbacks.onUpdateHeaderSkipButtonVisibility();
}

/**
 * Finalizes wizard configuration, marks profile onboarding timestamp, persists state, and exits wizard view.
 * @param {boolean} [isSkipped=false] - True if user opted to skip checklist configuration.
 * @param {any} [callbacks={}] - Callback bindings for UI update.
 */
export function finishWizard(isSkipped = false, callbacks = {}) {
    const activeTag = welcomeState.activeWizardTag;
    if (!activeTag) return;

    handleStateUpdate(() => {
        const playerObj = state.allPlayersData[activeTag];
        if (playerObj) {
            if (activeTag === 'DEFAULT0') {
                if (!playerObj.playerProfile) {
                    playerObj.playerProfile = {};
                }
                playerObj.playerProfile.tag = 'DEFAULT0';
                playerObj.playerProfile.townHallLevel = welcomeState.selectedTH;
                if (welcomeState.selectedLeague) {
                    playerObj.playerProfile.leagueTier = { id: welcomeState.selectedLeague };
                }
                if (!isSkipped) {
                    applyChecklistToProfile(playerObj);
                }
                playerObj.onboardingTimestamp = Math.max(Date.now(), EFFECTIVE_DATE_PROFILE_ONBOARDING + 1);

                state.heroes = playerObj.heroes;
                state.storedOres = playerObj.storedOres;
                state.income = playerObj.income;
                state.planner = playerObj.planner;
                state.playerProfile = playerObj.playerProfile;
            } else {
                if (!isSkipped) {
                    applyChecklistToProfile(playerObj);
                }
                playerObj.onboardingTimestamp = Math.max(Date.now(), EFFECTIVE_DATE_PROFILE_ONBOARDING + 1);
            }
        }
    }, false);

    exitWizard(callbacks);
}
