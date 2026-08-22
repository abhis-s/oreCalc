import { translate } from '../../i18n/translator.js';

import { STORAGE_LIMITS } from '../../core/constants.js';
import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { CLAN_WAR_DEFAULTS } from '../../domain/income/clanWarIncome.js';
import { CWL_DEFAULTS } from '../../domain/income/cwlIncome.js';
import { adjustWarRates } from '../../utils/incomeUtils.js';
import { registerInputPopover } from '../../utils/inputPopoverProvider.js';
import { addValidation } from '../../utils/inputValidator.js';
import { closeModalAnimated } from '../../utils/modalHistoryManager.js';

import { openBugReportModal, openPrivacyModal, openTermsOfUseModal } from '../appSettings/settingsModals.js';
import { welcomeState } from './welcomeModalState.js';
import { renderWelcomeShopOffers, toggleSubpanels } from './welcomeSettingsDisplay.js';
import { applyChecklistToProfile } from './welcomeWizardState.js';

/**
 * Initializes Page 3 quick settings event listeners (Stored ores, trader options, CW/CWL rates, shop offers, terms/privacy links).
 *
 * @param {HTMLElement} modal - The Welcome modal root element.
 */
export function initializeWelcomeSettingsInputs(modal) {
    if (!modal) return;

    const termsLink = document.getElementById('welcome-terms-link');
    const privacyLink = document.getElementById('welcome-privacy-link');

    if (termsLink) {
        termsLink.addEventListener('click', (e) => {
            e.preventDefault();
            closeModalAnimated(modal, () => {
                openTermsOfUseModal();
            });
        });
    }

    if (privacyLink) {
        privacyLink.addEventListener('click', (e) => {
            e.preventDefault();
            closeModalAnimated(modal, () => {
                openPrivacyModal();
            });
        });
    }

    const reportIssueLinks = modal.querySelectorAll('.welcome-report-issue-link');
    reportIssueLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            openBugReportModal();
        });
    });

    const storedShinyInput = document.getElementById('welcome-stored-shiny');
    const storedGlowyInput = document.getElementById('welcome-stored-glowy');
    const storedStarryInput = document.getElementById('welcome-stored-starry');
    const raidMedalsBuySwitch = document.getElementById('welcome-pref-raid-medals-buy');
    const raidMedalsEarnedInput = document.getElementById('welcome-pref-raid-medals-earned');
    const raidMedalsStarryInput = document.getElementById('welcome-pref-raid-medals-starry');
    const raidMedalsGlowyInput = document.getElementById('welcome-pref-raid-medals-glowy');
    const raidMedalsShinyInput = document.getElementById('welcome-pref-raid-medals-shiny');
    const gemsBuySwitch = document.getElementById('welcome-pref-gems-buy');
    const gemsStarryInput = document.getElementById('welcome-pref-gems-starry');
    const gemsGlowyInput = document.getElementById('welcome-pref-gems-glowy');
    const gemsShinyInput = document.getElementById('welcome-pref-gems-shiny');
    const shopOffersBuySwitch = document.getElementById('welcome-pref-shop-offers-buy');
    const clanWarsBuySwitch = document.getElementById('welcome-pref-clan-wars-buy');
    const clanWarsCountInput = document.getElementById('welcome-pref-clan-wars-count');
    const clanWarsWinrateInput = document.getElementById('welcome-pref-clan-wars-winrate');
    const clanWarsDrawrateInput = document.getElementById('welcome-pref-clan-wars-drawrate');
    const cwlBuySwitch = document.getElementById('welcome-pref-cwl-buy');
    const cwlHitsInput = document.getElementById('welcome-pref-cwl-hits');
    const cwlWinrateInput = document.getElementById('welcome-pref-cwl-winrate');
    const cwlDrawrateInput = document.getElementById('welcome-pref-cwl-drawrate');
    const goldPassSwitch = document.getElementById('welcome-pref-gold-pass');
    const cloudSyncSwitch = document.getElementById('welcome-pref-cloud-sync');

    const eventPassBuySwitch = document.getElementById('welcome-pref-event-pass-buy');
    const eventIncludeEquipmentSwitch = document.getElementById('welcome-pref-event-include-equipment');
    const eventBonusMedalsInput = document.getElementById('welcome-pref-event-bonus-medals');
    const eventPurchasedMedalsInput = document.getElementById('welcome-pref-event-purchased-medals');
    const eventTraderBuySwitch = document.getElementById('welcome-pref-event-trader-buy');
    const eventTraderShinySelect = document.getElementById('welcome-pref-event-trader-shiny');
    const eventTraderGlowySelect = document.getElementById('welcome-pref-event-trader-glowy');
    const eventTraderStarrySelect = document.getElementById('welcome-pref-event-trader-starry');
    const currencySelect = document.getElementById('welcome-pref-currency');

    const handleSwitchChange = () => {
        const activeTag = welcomeState.activeWizardTag || state.savedPlayerTags[0];

        welcomeState.tempStoredShiny = parseInt(storedShinyInput?.value, 10) || 0;
        welcomeState.tempStoredGlowy = parseInt(storedGlowyInput?.value, 10) || 0;
        welcomeState.tempStoredStarry = parseInt(storedStarryInput?.value, 10) || 0;

        welcomeState.tempRaidMedalsBuy = raidMedalsBuySwitch?.checked || false;
        welcomeState.tempRaidMedalsEarned = parseInt(raidMedalsEarnedInput?.value, 10) || 1200;
        welcomeState.tempRaidMedalsStarry = parseInt(document.getElementById('welcome-pref-raid-medals-starry')?.value, 10) || 0;
        welcomeState.tempRaidMedalsGlowy = parseInt(document.getElementById('welcome-pref-raid-medals-glowy')?.value, 10) || 0;
        welcomeState.tempRaidMedalsShiny = parseInt(document.getElementById('welcome-pref-raid-medals-shiny')?.value, 10) || 0;
        welcomeState.tempGemsBuy = gemsBuySwitch?.checked || false;
        welcomeState.tempGemsStarry = parseInt(document.getElementById('welcome-pref-gems-starry')?.value, 10) || 0;
        welcomeState.tempGemsGlowy = parseInt(document.getElementById('welcome-pref-gems-glowy')?.value, 10) || 0;
        welcomeState.tempGemsShiny = parseInt(document.getElementById('welcome-pref-gems-shiny')?.value, 10) || 0;

        welcomeState.tempShopOffersBuy = shopOffersBuySwitch?.checked || false;
        welcomeState.tempClanWars = clanWarsBuySwitch?.checked || false;
        welcomeState.tempClanWarsCount = parseInt(clanWarsCountInput?.value, 10) || CLAN_WAR_DEFAULTS.WARS_PER_MONTH;
        welcomeState.tempClanWarsWinrate = parseInt(clanWarsWinrateInput?.value, 10) || 70;
        welcomeState.tempClanWarsDrawrate = parseInt(clanWarsDrawrateInput?.value, 10) || 0;
        welcomeState.tempCwl = cwlBuySwitch?.checked || false;
        welcomeState.tempCwlHits = parseInt(cwlHitsInput?.value, 10) || CWL_DEFAULTS.HITS_PER_SEASON;
        welcomeState.tempCwlWinrate = parseInt(cwlWinrateInput?.value, 10) || 50;
        welcomeState.tempCwlDrawrate = parseInt(cwlDrawrateInput?.value, 10) || 0;
        welcomeState.tempGoldPass = goldPassSwitch?.checked || false;
        welcomeState.tempCloudSync = cloudSyncSwitch?.checked || false;

        welcomeState.tempEventPassBuy = eventPassBuySwitch?.checked || false;
        welcomeState.tempEventIncludeEquipment = eventIncludeEquipmentSwitch?.checked || false;
        welcomeState.tempEventBonusMedals = parseInt(eventBonusMedalsInput?.value, 10) || 0;
        welcomeState.tempEventPurchasedMedals = parseInt(eventPurchasedMedalsInput?.value, 10) || 0;
        welcomeState.tempEventTraderBuy = eventTraderBuySwitch?.checked || false;
        welcomeState.tempEventTraderShiny = parseInt(document.getElementById('welcome-pref-event-trader-shiny')?.value, 10) || 0;
        welcomeState.tempEventTraderGlowy = parseInt(document.getElementById('welcome-pref-event-trader-glowy')?.value, 10) || 0;
        welcomeState.tempEventTraderStarry = parseInt(document.getElementById('welcome-pref-event-trader-starry')?.value, 10) || 0;
        welcomeState.tempCurrencyCode = currencySelect?.value || 'USD';

        toggleSubpanels();

        if (activeTag) {
            handleStateUpdate(() => {
                const playerObj = state.allPlayersData[activeTag];
                if (playerObj) {
                    applyChecklistToProfile(playerObj);
                }
            }, true);

            let thLevel = welcomeState.selectedTH || 16;
            if (activeTag && activeTag !== 'DEFAULT0') {
                const playerObj = state.allPlayersData[activeTag];
                if (playerObj) {
                    const th = playerObj.playerProfile?.townHallLevel || playerObj.townHallLevel || 16;
                    thLevel = parseInt(th, 10);
                }
            }
            renderWelcomeShopOffers(thLevel, welcomeState.tempShopOffersPurchases);
        }
    };

    const handleClanWarsRateChange = (changedType) => {
        let win = parseInt(clanWarsWinrateInput?.value, 10);
        if (isNaN(win)) win = 70;
        let draw = parseInt(clanWarsDrawrateInput?.value, 10);
        if (isNaN(draw)) draw = 0;
        const adjusted = adjustWarRates(win, draw, changedType);
        if (clanWarsWinrateInput) clanWarsWinrateInput.value = adjusted.winRate;
        if (clanWarsDrawrateInput) clanWarsDrawrateInput.value = adjusted.drawRate;
        handleSwitchChange();
    };

    const handleCwlRateChange = (changedType) => {
        let win = parseInt(cwlWinrateInput?.value, 10);
        if (isNaN(win)) win = 50;
        let draw = parseInt(cwlDrawrateInput?.value, 10);
        if (isNaN(draw)) draw = 0;
        const adjusted = adjustWarRates(win, draw, changedType);
        if (cwlWinrateInput) cwlWinrateInput.value = adjusted.winRate;
        if (cwlDrawrateInput) cwlDrawrateInput.value = adjusted.drawRate;
        handleSwitchChange();
    };

    storedShinyInput?.addEventListener('validated-input', handleSwitchChange);
    storedGlowyInput?.addEventListener('validated-input', handleSwitchChange);
    storedStarryInput?.addEventListener('validated-input', handleSwitchChange);

    raidMedalsBuySwitch?.addEventListener('change', handleSwitchChange);
    raidMedalsEarnedInput?.addEventListener('validated-input', handleSwitchChange);
    document.getElementById('welcome-raid-trader-rows-container')?.addEventListener('change', handleSwitchChange);
    if (raidMedalsStarryInput) {
        const ev = raidMedalsStarryInput.tagName === 'SELECT' ? 'change' : 'validated-input';
        raidMedalsStarryInput.addEventListener(ev, handleSwitchChange);
    }
    if (raidMedalsGlowyInput) {
        const ev = raidMedalsGlowyInput.tagName === 'SELECT' ? 'change' : 'validated-input';
        raidMedalsGlowyInput.addEventListener(ev, handleSwitchChange);
    }
    if (raidMedalsShinyInput) {
        const ev = raidMedalsShinyInput.tagName === 'SELECT' ? 'change' : 'validated-input';
        raidMedalsShinyInput.addEventListener(ev, handleSwitchChange);
    }
    gemsBuySwitch?.addEventListener('change', handleSwitchChange);
    document.getElementById('welcome-gem-trader-rows-container')?.addEventListener('change', handleSwitchChange);
    if (gemsStarryInput) {
        const ev = gemsStarryInput.tagName === 'SELECT' ? 'change' : 'validated-input';
        gemsStarryInput.addEventListener(ev, handleSwitchChange);
    }
    if (gemsGlowyInput) {
        const ev = gemsGlowyInput.tagName === 'SELECT' ? 'change' : 'validated-input';
        gemsGlowyInput.addEventListener(ev, handleSwitchChange);
    }
    if (gemsShinyInput) {
        const ev = gemsShinyInput.tagName === 'SELECT' ? 'change' : 'validated-input';
        gemsShinyInput.addEventListener(ev, handleSwitchChange);
    }

    shopOffersBuySwitch?.addEventListener('change', handleSwitchChange);
    clanWarsBuySwitch?.addEventListener('change', handleSwitchChange);
    clanWarsCountInput?.addEventListener('validated-input', handleSwitchChange);
    clanWarsWinrateInput?.addEventListener('validated-input', () => handleClanWarsRateChange('win'));
    clanWarsDrawrateInput?.addEventListener('validated-input', () => handleClanWarsRateChange('draw'));
    cwlBuySwitch?.addEventListener('change', handleSwitchChange);
    cwlHitsInput?.addEventListener('validated-input', handleSwitchChange);
    cwlWinrateInput?.addEventListener('validated-input', () => handleCwlRateChange('win'));
    cwlDrawrateInput?.addEventListener('validated-input', () => handleCwlRateChange('draw'));
    goldPassSwitch?.addEventListener('change', handleSwitchChange);
    cloudSyncSwitch?.addEventListener('change', handleSwitchChange);

    eventPassBuySwitch?.addEventListener('change', handleSwitchChange);
    eventIncludeEquipmentSwitch?.addEventListener('change', handleSwitchChange);
    eventBonusMedalsInput?.addEventListener('validated-input', handleSwitchChange);
    eventPurchasedMedalsInput?.addEventListener('validated-input', handleSwitchChange);
    eventTraderBuySwitch?.addEventListener('change', handleSwitchChange);
    document.getElementById('welcome-event-trader-rows-container')?.addEventListener('change', handleSwitchChange);
    if (eventTraderShinySelect) eventTraderShinySelect.addEventListener('change', handleSwitchChange);
    if (eventTraderGlowySelect) eventTraderGlowySelect.addEventListener('change', handleSwitchChange);
    if (eventTraderStarrySelect) eventTraderStarrySelect.addEventListener('change', handleSwitchChange);
    currencySelect?.addEventListener('change', (e) => {
        welcomeState.tempCurrencyCode = e.target.value;
        handleSwitchChange();
    });

    const shopOffersInputsContainer = document.getElementById('welcome-shop-offers-inputs-container');
    shopOffersInputsContainer?.addEventListener('change', (e) => {
        if (e.target && e.target.tagName === 'SELECT' && e.target.dataset.offerId) {
            const offerId = e.target.dataset.offerId;
            const count = parseInt(e.target.value, 10) || 0;
            welcomeState.tempShopOffersPurchases[offerId] = count;
            handleSwitchChange();
        }
    });

    if (storedShinyInput) {
        addValidation(storedShinyInput, { inputName: translate('entities.ores.shiny') });
        registerInputPopover(storedShinyInput, {
            title: () => translate('entities.ores.shiny'),
            min: 0,
            max: STORAGE_LIMITS.shiny,
            clickToFill: { max: true }
        });
    }
    if (storedGlowyInput) {
        addValidation(storedGlowyInput, { inputName: translate('entities.ores.glowy') });
        registerInputPopover(storedGlowyInput, {
            title: () => translate('entities.ores.glowy'),
            min: 0,
            max: STORAGE_LIMITS.glowy,
            clickToFill: { max: true }
        });
    }
    if (storedStarryInput) {
        addValidation(storedStarryInput, { inputName: translate('entities.ores.starry') });
        registerInputPopover(storedStarryInput, {
            title: () => translate('entities.ores.starry'),
            min: 0,
            max: STORAGE_LIMITS.starry,
            clickToFill: { max: true }
        });
    }
    if (raidMedalsEarnedInput) {
        addValidation(raidMedalsEarnedInput, { inputName: translate('views.income.ores.raidMedal') });
        registerInputPopover(raidMedalsEarnedInput, {
            title: () => translate('views.income.ores.raidMedal'),
            min: 0,
            max: 1970,
            showRange: true,
            showRecommended: true,
            recommended: 1200,
            clickToFill: { min: true, max: true, recommended: true }
        });
    }
    if (raidMedalsShinyInput && raidMedalsShinyInput.tagName === 'INPUT') {
        addValidation(raidMedalsShinyInput, { inputName: `${translate('entities.ores.shiny')} ${translate('views.income.shopOffers.packs')}` });
        registerInputPopover(raidMedalsShinyInput, {
            title: () => `${translate('entities.ores.shiny')} ${translate('views.income.shopOffers.packs')}`,
            min: 0,
            max: 2,
            showRange: true,
            showRecommended: true,
            recommended: 0,
            clickToFill: { min: true, max: true, recommended: true }
        });
    }
    if (raidMedalsGlowyInput && raidMedalsGlowyInput.tagName === 'INPUT') {
        addValidation(raidMedalsGlowyInput, { inputName: `${translate('entities.ores.glowy')} ${translate('views.income.shopOffers.packs')}` });
        registerInputPopover(raidMedalsGlowyInput, {
            title: () => `${translate('entities.ores.glowy')} ${translate('views.income.shopOffers.packs')}`,
            min: 0,
            max: 2,
            showRange: true,
            showRecommended: true,
            recommended: 0,
            clickToFill: { min: true, max: true, recommended: true }
        });
    }
    if (raidMedalsStarryInput && raidMedalsStarryInput.tagName === 'INPUT') {
        addValidation(raidMedalsStarryInput, { inputName: `${translate('entities.ores.starry')} ${translate('views.income.shopOffers.packs')}` });
        registerInputPopover(raidMedalsStarryInput, {
            title: () => `${translate('entities.ores.starry')} ${translate('views.income.shopOffers.packs')}`,
            min: 0,
            max: 2,
            showRange: true,
            showRecommended: true,
            recommended: 0,
            clickToFill: { min: true, max: true, recommended: true }
        });
    }
    if (clanWarsCountInput) {
        addValidation(clanWarsCountInput, { inputName: translate('views.income.clanWar.warsPerMonth') });
        registerInputPopover(clanWarsCountInput, {
            title: () => translate('views.income.clanWar.warsPerMonth'),
            min: CLAN_WAR_DEFAULTS.MIN_WARS,
            max: CLAN_WAR_DEFAULTS.MAX_WARS,
            showRange: true,
            showRecommended: true,
            recommended: CLAN_WAR_DEFAULTS.WARS_PER_MONTH,
            clickToFill: { min: true, max: true, recommended: true }
        });
    }
    if (clanWarsWinrateInput) {
        addValidation(clanWarsWinrateInput, { inputName: translate('views.income.winRate') });
        registerInputPopover(clanWarsWinrateInput, {
            title: () => translate('views.income.winRate'),
            min: 0,
            max: 100,
            showRange: true,
            showRecommended: true,
            recommended: 70,
            clickToFill: { min: true, max: true, recommended: true }
        });
    }
    if (cwlHitsInput) {
        addValidation(cwlHitsInput, { inputName: translate('views.welcome.quickSettings.cwlHits') });
        registerInputPopover(cwlHitsInput, {
            title: () => translate('views.welcome.quickSettings.cwlHits'),
            min: CWL_DEFAULTS.MIN_HITS,
            max: CWL_DEFAULTS.MAX_HITS,
            showRange: true,
            showRecommended: true,
            recommended: CWL_DEFAULTS.HITS_PER_SEASON,
            clickToFill: { min: true, max: true, recommended: true }
        });
    }
    if (cwlWinrateInput) {
        addValidation(cwlWinrateInput, { inputName: translate('views.income.winRate') });
        registerInputPopover(cwlWinrateInput, {
            title: () => translate('views.income.winRate'),
            min: 0,
            max: 100,
            showRange: true,
            showRecommended: true,
            recommended: 50,
            clickToFill: { min: true, max: true, recommended: true }
        });
    }
    if (clanWarsDrawrateInput) {
        addValidation(clanWarsDrawrateInput, { inputName: translate('views.welcome.quickSettings.drawRate') });
        registerInputPopover(clanWarsDrawrateInput, {
            title: () => translate('views.welcome.quickSettings.drawRate'),
            min: 0,
            max: 100,
            showRange: true,
            showRecommended: true,
            recommended: 0,
            clickToFill: { min: true, max: true, recommended: true }
        });
    }
    if (cwlDrawrateInput) {
        addValidation(cwlDrawrateInput, { inputName: translate('views.welcome.quickSettings.drawRate') });
        registerInputPopover(cwlDrawrateInput, {
            title: () => translate('views.welcome.quickSettings.drawRate'),
            min: 0,
            max: 100,
            showRange: true,
            showRecommended: true,
            recommended: 0,
            clickToFill: { min: true, max: true, recommended: true }
        });
    }

    if (eventBonusMedalsInput) {
        addValidation(eventBonusMedalsInput, { inputName: translate('views.income.eventPass.bonusTrackMedals') });
        registerInputPopover(eventBonusMedalsInput, {
            title: () => translate('views.income.eventPass.bonusTrackMedals'),
            min: 0,
            max: 2000,
            showRange: true,
            showRecommended: true,
            recommended: 0,
            clickToFill: { min: true, max: true, recommended: true }
        });
    }
    if (eventPurchasedMedalsInput) {
        addValidation(eventPurchasedMedalsInput, { inputName: translate('views.income.eventPass.purchasedMedals') });
        registerInputPopover(eventPurchasedMedalsInput, {
            title: () => translate('views.income.eventPass.purchasedMedals'),
            min: 0,
            max: 30000,
            showRange: true,
            showRecommended: true,
            recommended: 0,
            clickToFill: { min: true, max: true, recommended: true }
        });
    }
}
