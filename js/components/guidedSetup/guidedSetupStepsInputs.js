import { STORAGE_LIMITS } from '../../core/constants.js';
import { CLAN_WAR_DEFAULTS } from '../../domain/income/clanWarIncome.js';
import { CWL_DEFAULTS } from '../../domain/income/cwlIncome.js';
import { adjustWarRates } from '../../utils/incomeUtils.js';
import { registerInputPopover } from '../../utils/inputPopoverProvider.js';
import { addValidation } from '../../utils/inputValidator.js';

import { guidedSetupState } from './guidedSetupState.js';
import { renderGuidedSetupShopOffers, toggleSubpanels } from './guidedSetupStepsDisplay.js';

const safeRaf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 0);

/**
 * Initializes Steps 2–6 quick settings event listeners (Stored ores, trader options, CW/CWL rates, shop offers).
 *
 * @param {HTMLElement} modal - The Guided Setup modal root element.
 */
export function initializeGuidedSetupStepsInputs(modal) {
    if (!modal) return;

    const storedShinyInput = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-stored-shiny'));
    const storedGlowyInput = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-stored-glowy'));
    const storedStarryInput = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-stored-starry'));
    const recommendationsSwitch = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-recommendations'));

    const raidMedalsBuySwitch = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-raid-medals-buy'));
    const gemsBuySwitch = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-gems-buy'));

    const clanWarsBuySwitch = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-clan-wars-buy'));
    const clanWarsCountInput = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-clan-wars-count'));
    const clanWarsWinrateInput = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-clan-wars-winrate'));
    const clanWarsDrawrateInput = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-clan-wars-drawrate'));

    const cwlBuySwitch = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-cwl-buy'));
    const cwlHitsInput = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-cwl-hits'));
    const cwlWinrateInput = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-cwl-winrate'));
    const cwlDrawrateInput = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-cwl-drawrate'));

    const eventPassBuySwitch = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-event-pass-buy'));
    const eventIncludeEquipmentSwitch = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-event-include-equipment'));
    const eventTraderBuySwitch = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-event-trader-buy'));

    const goldPassSwitch = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-gold-pass'));
    const shopOffersBuySwitch = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-shop-offers-buy'));
    const currencySelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('guided-setup-pref-currency'));

    /**
     * @param {Event | null} [e=null]
     */
    const handleSwitchChange = (e = null) => {
        guidedSetupState.tempStoredShiny = parseInt(storedShinyInput?.value || '0', 10) || 0;
        guidedSetupState.tempStoredGlowy = parseInt(storedGlowyInput?.value || '0', 10) || 0;
        guidedSetupState.tempStoredStarry = parseInt(storedStarryInput?.value || '0', 10) || 0;
        guidedSetupState.tempRecommendations = recommendationsSwitch?.checked ?? true;

        const isRaidBuy = raidMedalsBuySwitch?.checked || false;
        const wasRaidBuy = guidedSetupState.tempRaidMedalsBuy;
        if (!wasRaidBuy && isRaidBuy) {
            const starryEl = /** @type {HTMLSelectElement|null} */ (document.getElementById('guided-setup-pref-raid-medals-starry'));
            const glowyEl = /** @type {HTMLSelectElement|null} */ (document.getElementById('guided-setup-pref-raid-medals-glowy'));
            const currStarry = parseInt(starryEl?.value || '0', 10);
            const currGlowy = parseInt(glowyEl?.value || '0', 10);
            if (currStarry === 0 && currGlowy === 0) {
                if (starryEl) starryEl.value = '2';
                if (glowyEl) glowyEl.value = '2';
            }
        }

        guidedSetupState.tempRaidMedalsBuy = isRaidBuy;
        guidedSetupState.tempRaidMedalsStarry = parseInt((/** @type {HTMLSelectElement|null} */ (document.getElementById('guided-setup-pref-raid-medals-starry')))?.value || '0', 10) || 0;
        guidedSetupState.tempRaidMedalsGlowy = parseInt((/** @type {HTMLSelectElement|null} */ (document.getElementById('guided-setup-pref-raid-medals-glowy')))?.value || '0', 10) || 0;
        guidedSetupState.tempRaidMedalsShiny = parseInt((/** @type {HTMLSelectElement|null} */ (document.getElementById('guided-setup-pref-raid-medals-shiny')))?.value || '0', 10) || 0;

        const isGemsBuy = gemsBuySwitch?.checked || false;
        const wasGemsBuy = guidedSetupState.tempGemsBuy;
        if (!wasGemsBuy && isGemsBuy) {
            const starryEl = /** @type {HTMLSelectElement|null} */ (document.getElementById('guided-setup-pref-gems-starry'));
            const currStarry = parseInt(starryEl?.value || '0', 10);
            if (currStarry === 0 && starryEl) {
                starryEl.value = '2';
            }
        }

        guidedSetupState.tempGemsBuy = isGemsBuy;
        guidedSetupState.tempGemsStarry = parseInt((/** @type {HTMLSelectElement|null} */ (document.getElementById('guided-setup-pref-gems-starry')))?.value || '0', 10) || 0;
        guidedSetupState.tempGemsGlowy = parseInt((/** @type {HTMLSelectElement|null} */ (document.getElementById('guided-setup-pref-gems-glowy')))?.value || '0', 10) || 0;
        guidedSetupState.tempGemsShiny = parseInt((/** @type {HTMLSelectElement|null} */ (document.getElementById('guided-setup-pref-gems-shiny')))?.value || '0', 10) || 0;

        guidedSetupState.tempClanWars = clanWarsBuySwitch?.checked || false;
        guidedSetupState.tempClanWarsCount = parseInt(clanWarsCountInput?.value || '8', 10) || CLAN_WAR_DEFAULTS.WARS_PER_MONTH;
        guidedSetupState.tempClanWarsWinrate = parseInt(clanWarsWinrateInput?.value || '70', 10) || 70;
        guidedSetupState.tempClanWarsDrawrate = parseInt(clanWarsDrawrateInput?.value || '0', 10) || 0;

        guidedSetupState.tempCwl = cwlBuySwitch?.checked || false;
        guidedSetupState.tempCwlHits = parseInt(cwlHitsInput?.value || '7', 10) || CWL_DEFAULTS.HITS_PER_SEASON;
        guidedSetupState.tempCwlWinrate = parseInt(cwlWinrateInput?.value || '50', 10) || 50;
        guidedSetupState.tempCwlDrawrate = parseInt(cwlDrawrateInput?.value || '0', 10) || 0;

        guidedSetupState.tempEventPassBuy = eventPassBuySwitch?.checked || false;
        guidedSetupState.tempEventIncludeEquipment = eventIncludeEquipmentSwitch?.checked || false;

        const isEventTraderBuy = eventTraderBuySwitch?.checked || false;
        const wasEventTraderBuy = guidedSetupState.tempEventTraderBuy;
        if (!wasEventTraderBuy && isEventTraderBuy) {
            const starryEl = /** @type {HTMLSelectElement|null} */ (document.getElementById('guided-setup-pref-event-trader-starry'));
            const glowyEl = /** @type {HTMLSelectElement|null} */ (document.getElementById('guided-setup-pref-event-trader-glowy'));
            const currStarry = parseInt(starryEl?.value || '0', 10);
            const currGlowy = parseInt(glowyEl?.value || '0', 10);
            if (currStarry === 0 && currGlowy === 0) {
                if (starryEl) starryEl.value = '2';
                if (glowyEl) glowyEl.value = '2';
            }
        }

        guidedSetupState.tempEventTraderBuy = isEventTraderBuy;
        guidedSetupState.tempEventTraderShiny = parseInt((/** @type {HTMLSelectElement|null} */ (document.getElementById('guided-setup-pref-event-trader-shiny')))?.value || '0', 10) || 0;
        guidedSetupState.tempEventTraderGlowy = parseInt((/** @type {HTMLSelectElement|null} */ (document.getElementById('guided-setup-pref-event-trader-glowy')))?.value || '0', 10) || 0;
        guidedSetupState.tempEventTraderStarry = parseInt((/** @type {HTMLSelectElement|null} */ (document.getElementById('guided-setup-pref-event-trader-starry')))?.value || '0', 10) || 0;

        guidedSetupState.tempGoldPass = goldPassSwitch?.checked || false;
        guidedSetupState.tempShopOffersBuy = shopOffersBuySwitch?.checked || false;
        guidedSetupState.tempCurrencyCode = currencySelect?.value || 'USD';

        toggleSubpanels();

        if (e && e.target && /** @type {HTMLInputElement} */ (e.target).checked) {
            const targetEl = /** @type {HTMLElement} */ (e.target);
            const parentGroup = targetEl.closest('.group-content');
            if (parentGroup) {
                safeRaf(() => {
                    parentGroup.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                });
            }
        }
    };

    const handleClanWarsRateChange = (changedType) => {
        let win = parseInt(clanWarsWinrateInput?.value || '70', 10);
        if (isNaN(win)) win = 70;
        let draw = parseInt(clanWarsDrawrateInput?.value || '0', 10);
        if (isNaN(draw)) draw = 0;
        const adjusted = adjustWarRates(win, draw, changedType);
        if (clanWarsWinrateInput) clanWarsWinrateInput.value = String(adjusted.winRate);
        if (clanWarsDrawrateInput) clanWarsDrawrateInput.value = String(adjusted.drawRate);
        handleSwitchChange();
    };

    const handleCwlRateChange = (changedType) => {
        let win = parseInt(cwlWinrateInput?.value || '50', 10);
        if (isNaN(win)) win = 50;
        let draw = parseInt(cwlDrawrateInput?.value || '0', 10);
        if (isNaN(draw)) draw = 0;
        const adjusted = adjustWarRates(win, draw, changedType);
        if (cwlWinrateInput) cwlWinrateInput.value = String(adjusted.winRate);
        if (cwlDrawrateInput) cwlDrawrateInput.value = String(adjusted.drawRate);
        handleSwitchChange();
    };

    // Stored ores listeners & popovers
    [
        { input: storedShinyInput, max: STORAGE_LIMITS.shiny, step: 100 },
        { input: storedGlowyInput, max: STORAGE_LIMITS.glowy, step: 10 },
        { input: storedStarryInput, max: STORAGE_LIMITS.starry, step: 1 }
    ].forEach(({ input, max, step }) => {
        if (!input) return;
        addValidation(input, { min: 0, max });
        registerInputPopover(input, { min: 0, max, step, align: 'right' });
        input.addEventListener('input', handleSwitchChange);
    });

    if (recommendationsSwitch) {
        recommendationsSwitch.addEventListener('change', (e) => {
            const isChecked = /** @type {HTMLInputElement} */ (e.target).checked;
            guidedSetupState.tempRecommendations = isChecked;
            const body = document.getElementById('guided-setup-body');
            if (body) {
                body.classList.toggle('show-recommendations', isChecked);
            }
        });
    }

    // Switches & inputs listeners
    [raidMedalsBuySwitch, gemsBuySwitch, eventPassBuySwitch, eventIncludeEquipmentSwitch, eventTraderBuySwitch, goldPassSwitch, shopOffersBuySwitch].forEach(sw => {
        sw?.addEventListener('change', handleSwitchChange);
    });

    clanWarsBuySwitch?.addEventListener('change', handleSwitchChange);
    cwlBuySwitch?.addEventListener('change', handleSwitchChange);

    clanWarsCountInput?.addEventListener('input', handleSwitchChange);
    clanWarsWinrateInput?.addEventListener('input', () => handleClanWarsRateChange('win'));
    clanWarsDrawrateInput?.addEventListener('input', () => handleClanWarsRateChange('draw'));

    cwlHitsInput?.addEventListener('input', handleSwitchChange);
    cwlWinrateInput?.addEventListener('input', () => handleCwlRateChange('win'));
    cwlDrawrateInput?.addEventListener('input', () => handleCwlRateChange('draw'));

    currencySelect?.addEventListener('change', (e) => {
        guidedSetupState.tempCurrencyCode = /** @type {HTMLSelectElement} */ (e.target).value;
        const thLevel = guidedSetupState.selectedTH || 16;
        renderGuidedSetupShopOffers(thLevel, guidedSetupState.tempShopOffersPurchases);
    });

    // Delegated change listener for dynamic select dropdowns (Trader rows and Shop offers)
    modal.addEventListener('change', (e) => {
        const target = /** @type {HTMLElement|null} */ (e.target);
        if (!target || !(target instanceof HTMLSelectElement)) return;

        if (target.id.startsWith('guided-setup-pref-raid-medals-') ||
            target.id.startsWith('guided-setup-pref-gems-') ||
            target.id.startsWith('guided-setup-pref-event-trader-')) {
            handleSwitchChange();
        }

        if (target.classList.contains('guided-setup-select-input') && target.dataset.offerId) {
            const offerId = target.dataset.offerId;
            const count = parseInt(target.value, 10) || 0;
            guidedSetupState.tempShopOffersPurchases[offerId] = count;
        }
    });
}
