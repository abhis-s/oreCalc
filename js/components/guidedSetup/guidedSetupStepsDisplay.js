import { shopOfferData, SHOP_OFFER_ORDER, resolveBestMatchShopOfferSet } from '../../data/incomeSources/shopOffers.js';
import { eventTraderData, gemTraderData, raidMedalTraderData } from '../../data/incomeSources/traders.js';
import { currencyData } from '../../data/pricingData.js';
import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';
import { getCurrencySymbol, getPriceForTier } from '../../utils/incomeUtils.js';
import { formatNumber, formatCurrency } from '../../utils/numberFormatter.js';

import { guidedSetupState } from './guidedSetupState.js';

const safeRaf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 0);

/**
 * Declaratively renders Trader subpanel rows (Raid Medals, Gems, Event Trader) from trader domain datasets.
 *
 * @param {string} containerId - Target container ID in Guided Setup HTML.
 * @param {Array<Object> | ReadonlyArray<Object>} offers - Trader offers dataset.
 * @param {string} idPrefix - Prefix for select elements.
 * @param {string} currencyImg - Resource asset filename without extension.
 * @param {string} currencyAlt - Localized or descriptive text for currency.
 * @param {Object<string, string>} [badgeMap={}] - Mapping of ore type to badge icon name.
 */
export function renderGuidedSetupTraderRows(containerId, offers, idPrefix, currencyImg, currencyAlt, badgeMap = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    offers.forEach(offer => {
        const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : 'starry';
        const oreValue = offer.shiny || offer.glowy || offer.starry;
        const oreName = translate(`entities.ores.${oreType}`) || oreType;
        const badgeType = badgeMap[oreType];

        const row = document.createElement('div');
        row.dataset.oreType = oreType;
        row.className = 'guided-setup-trader-row';

        // Col 1: Cost display
        const costDisplay = document.createElement('div');
        costDisplay.className = 'guided-setup-trader-row__cost';
        costDisplay.title = `${currencyAlt} Cost`;

        const costImg = document.createElement('orecalc-assets-image');
        costImg.setAttribute('src', `assets/resources/${currencyImg}.png`);
        costImg.setAttribute('alt', currencyAlt);
        costImg.setAttribute('class', 'cost-icon');
        costDisplay.appendChild(costImg);

        const costSpan = document.createElement('span');
        costSpan.className = 'cost-value';
        costSpan.textContent = formatNumber(offer.cost);
        costDisplay.appendChild(costSpan);
        row.appendChild(costDisplay);

        // Col 2: Ore Amount display
        const oreDisplay = document.createElement('div');
        oreDisplay.className = 'guided-setup-trader-row__ore';
        oreDisplay.title = `${oreName} Amount`;

        const oreInner = document.createElement('div');
        oreInner.className = 'ore-inner';

        const amountSpan = document.createElement('span');
        amountSpan.className = 'ore-count';
        amountSpan.textContent = formatNumber(oreValue);

        const oreImg = document.createElement('orecalc-assets-image');
        oreImg.setAttribute('src', `assets/${oreType}_ore.png`);
        oreImg.setAttribute('alt', oreName);
        oreImg.setAttribute('class', 'ore-icon');
        oreImg.setAttribute('size', 'thumbnail');

        oreInner.appendChild(amountSpan);
        oreInner.appendChild(oreImg);
        oreDisplay.appendChild(oreInner);
        row.appendChild(oreDisplay);

        // Col 3: Badge column (only visible when recommendations active)
        const badgeDisplay = document.createElement('div');
        badgeDisplay.className = 'guided-setup-trader-row__badge';
        if (badgeType) {
            const badgeSpan = document.createElement('span');
            badgeSpan.className = 'recommended-badge ore-row-badge';
            badgeSpan.innerHTML = `<orecalc-assets-svg name="${badgeType}" height="12" width="12" fill="currentColor"></orecalc-assets-svg>`;
            badgeDisplay.appendChild(badgeSpan);
        }
        row.appendChild(badgeDisplay);

        // Col 3: Select dropdown
        const select = document.createElement('select');
        select.id = `${idPrefix}-${oreType}`;
        select.className = 'guided-setup-select-input guided-setup-select-input--compact';

        for (let i = 0; i <= offer.maxPacks; i++) {
            const opt = document.createElement('option');
            opt.value = String(i);
            opt.textContent = String(i);
            select.appendChild(opt);
        }

        row.appendChild(select);
        container.appendChild(row);
    });
}

/**
 * Renders all Trader offer rows (Raid Medals, Gems, Event Trader).
 */
export function renderAllGuidedSetupTraderOffers() {
    renderGuidedSetupTraderRows(
        'guided-setup-raid-trader-rows-container',
        raidMedalTraderData,
        'guided-setup-pref-raid-medals',
        'raidMedal',
        'Raid Medals',
        { starry: 'thumbs-double', glowy: 'thumbs-double' }
    );
    renderGuidedSetupTraderRows(
        'guided-setup-gem-trader-rows-container',
        gemTraderData,
        'guided-setup-pref-gems',
        'gem',
        'Gems',
        { starry: 'thumbs-up' }
    );
    renderGuidedSetupTraderRows(
        'guided-setup-event-trader-rows-container',
        eventTraderData,
        'guided-setup-pref-event-trader',
        'eventMedal',
        'Event Medals',
        { starry: 'thumbs-double', glowy: 'thumbs-up' }
    );
}

/**
 * Resolves the closest matching Town Hall Shop Offer set identifier for a given TH level.
 * @param {number} [thLevel] - Town Hall level.
 * @returns {string} Town Hall set key in shopOfferData.
 */
export function getBestMatchShopOfferSet(thLevel) {
    return resolveBestMatchShopOfferSet(thLevel);
}

/**
 * Renders the Shop Offer pack configuration list inside the Guided Setup settings subpanel.
 * @param {number} thLevel - Active player Town Hall level.
 * @param {Record<string, number>} [purchasedOffers={}] - Map of offer IDs to purchased pack counts.
 */
export function renderGuidedSetupShopOffers(thLevel, purchasedOffers = {}) {
    const container = document.getElementById('guided-setup-shop-offers-inputs-container');
    if (!container) return;
    container.innerHTML = '';

    const safePurchases = structuredClone(purchasedOffers);
    const bestSet = getBestMatchShopOfferSet(thLevel);
    const offers = shopOfferData[bestSet];
    if (!offers) return;

    const currentCurrency = guidedSetupState.tempCurrencyCode || state.uiSettings?.currency?.code || 'USD';

    Object.entries(offers)
        .filter(([id]) => id !== 'townHallLevel' && id !== 'disabled' && id !== 'name')
        .sort(([idA], [idB]) => (SHOP_OFFER_ORDER[idA] || 99) - (SHOP_OFFER_ORDER[idB] || 99))
        .forEach(([id, data]) => {
            const oreType = data.shiny ? 'shiny' : data.glowy ? 'glowy' : 'starry';
            const oreValue = data.shiny || data.glowy || data.starry;

            const row = document.createElement('div');
            row.className = 'guided-setup-shop-offer-item guided-setup-trader-row';
            row.dataset.offerId = id;

            // Column 1: Cost display
            const costDisplay = document.createElement('div');
            costDisplay.className = 'guided-setup-trader-row__cost';
            costDisplay.title = translate('views.income.shopOffers.offerPrice') || 'Offer Price';

            const priceSpan = document.createElement('span');
            priceSpan.className = 'cost-value';

            const price = getPriceForTier(data.priceTier, currentCurrency);
            const symbol = getCurrencySymbol(currentCurrency);
            priceSpan.textContent = `${symbol}${formatCurrency(price)}`;
            costDisplay.appendChild(priceSpan);
            row.appendChild(costDisplay);

            // Column 2: Ore display
            const oreDisplay = document.createElement('div');
            oreDisplay.className = 'guided-setup-trader-row__ore';
            oreDisplay.title = `${translate('entities.ores.' + oreType) || oreType} Amount`;

            const oreInner = document.createElement('div');
            oreInner.className = 'ore-inner';

            const countSpan = document.createElement('span');
            countSpan.className = 'ore-count';
            countSpan.textContent = formatNumber(oreValue);

            const oreImg = document.createElement('orecalc-assets-image');
            oreImg.setAttribute('src', `assets/${oreType}_ore.png`);
            oreImg.setAttribute('alt', translate('entities.ores.' + oreType) || oreType);
            oreImg.setAttribute('class', 'ore-icon');
            oreImg.setAttribute('size', 'thumbnail');

            oreInner.appendChild(countSpan);
            oreInner.appendChild(oreImg);
            oreDisplay.appendChild(oreInner);
            row.appendChild(oreDisplay);

            // Column 3: Badge display
            const badgeDisplay = document.createElement('div');
            badgeDisplay.className = 'guided-setup-trader-row__badge';
            if (oreType === 'starry') {
                const badge = document.createElement('span');
                badge.className = 'recommended-badge ore-row-badge';
                badge.innerHTML = '<orecalc-assets-svg name="thumbs-up" height="12" width="12" fill="currentColor"></orecalc-assets-svg>';
                badgeDisplay.appendChild(badge);
            }
            row.appendChild(badgeDisplay);

            // Column 3: Select dropdown
            const select = document.createElement('select');
            select.id = `guided-setup-shop-offer-${id}`;
            select.className = 'guided-setup-select-input guided-setup-select-input--compact';
            select.dataset.offerId = id;

            for (let i = 0; i <= data.maxPacks; i++) {
                const opt = document.createElement('option');
                opt.value = i.toString();
                opt.textContent = i.toString();
                select.appendChild(opt);
            }
            select.value = (safePurchases && safePurchases[id] !== undefined ? safePurchases[id] : 0).toString();

            row.appendChild(select);
            container.appendChild(row);
        });
}

/**
 * Updates step visibility, step indicator label, navigation buttons, and header skip button.
 * @param {number} stepNumber - Step index (1 to 6).
 */
export function updateGuidedSetupStepView(stepNumber) {
    guidedSetupState.currentStep = stepNumber;

    if (document.activeElement && typeof /** @type {HTMLElement} */ (document.activeElement).blur === 'function') {
        /** @type {HTMLElement} */ (document.activeElement).blur();
    }
    const openPopovers = document.querySelectorAll('.input-feature-popover.show');
    openPopovers.forEach((pop) => {
        pop.classList.remove('show');
        /** @type {HTMLElement} */ (pop).style.opacity = '0';
        /** @type {HTMLElement} */ (pop).style.pointerEvents = 'none';
    });

    for (let s = 1; s <= 6; s++) {
        const stepEl = document.getElementById(`guided-setup-step-${s}`);
        if (stepEl) {
            stepEl.hidden = s !== stepNumber;
            stepEl.style.display = s === stepNumber ? 'flex' : 'none';
        }
    }

    const stepIndicator = document.getElementById('guided-setup-step-indicator');
    const skipBtn = document.getElementById('guided-setup-skip-btn');
    const nextBtn = document.getElementById('guided-setup-next-btn');
    const backBtn = document.getElementById('guided-setup-back-btn');
    const cancelBtn = document.getElementById('guided-setup-cancel-btn');

    if (stepIndicator) {
        if (stepNumber > 1) {
            stepIndicator.hidden = false;
            stepIndicator.style.display = 'block';
            stepIndicator.textContent = translate('views.tour.step', { current: stepNumber - 1, total: 5 }) || `Step ${stepNumber - 1} of 5`;
        } else {
            stepIndicator.hidden = true;
            stepIndicator.style.display = 'none';
        }
    }

    if (skipBtn) {
        const isSkipVisible = stepNumber >= 2 && stepNumber <= 5;
        skipBtn.hidden = !isSkipVisible;
        skipBtn.style.display = isSkipVisible ? 'inline-flex' : 'none';
    }

    if (backBtn) {
        const isBackVisible = stepNumber > 1;
        backBtn.hidden = !isBackVisible;
        backBtn.style.display = isBackVisible ? 'inline-flex' : 'none';
    }

    if (cancelBtn) {
        const isCancelVisible = stepNumber === 1;
        cancelBtn.hidden = !isCancelVisible;
        cancelBtn.style.display = isCancelVisible ? 'inline-flex' : 'none';
    }

    if (nextBtn) {
        if (stepNumber === 1) {
            const isReady = guidedSetupState.isProfileLoaded && Boolean(guidedSetupState.activeTag);
            nextBtn.hidden = !isReady;
            nextBtn.style.display = isReady ? 'inline-flex' : 'none';
        } else {
            nextBtn.hidden = false;
            nextBtn.style.display = 'inline-flex';
        }

        if (stepNumber === 6) {
            nextBtn.textContent = translate('actions.done') || 'Done';
            nextBtn.setAttribute('data-i18n', 'actions.done');
        } else {
            nextBtn.textContent = translate('actions.next') || 'Next';
            nextBtn.setAttribute('data-i18n', 'actions.next');
        }
    }

    safeRaf(() => {
        const currentStepEl = document.getElementById(`guided-setup-step-${stepNumber}`);
        if (!currentStepEl) return;
        const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';
        const firstControl = currentStepEl.querySelector(selector);
        if (firstControl && typeof firstControl.focus === 'function' && !firstControl.closest('[inert]')) {
            firstControl.focus();
        }
    });
}

/**
 * Synchronizes Guided Setup settings inputs and temporary state buffers with the active player profile.
 * @param {string} tag - Player profile tag.
 */
export function syncGuidedSetupQuickSettings(tag) {
    const playerObj = tag ? state.allPlayersData?.[tag] : null;
    const currentTH = playerObj?.playerProfile?.townHallLevel || playerObj?.townHallLevel || guidedSetupState.selectedTH || 16;

    guidedSetupState.tempStoredShiny = playerObj?.storedOres?.shiny || 0;
    guidedSetupState.tempStoredGlowy = playerObj?.storedOres?.glowy || 0;
    guidedSetupState.tempStoredStarry = playerObj?.storedOres?.starry || 0;

    const storedShinyInput = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-stored-shiny'));
    const storedGlowyInput = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-stored-glowy'));
    const storedStarryInput = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-stored-starry'));

    if (storedShinyInput) storedShinyInput.value = String(guidedSetupState.tempStoredShiny);
    if (storedGlowyInput) storedGlowyInput.value = String(guidedSetupState.tempStoredGlowy);
    if (storedStarryInput) storedStarryInput.value = String(guidedSetupState.tempStoredStarry);

    const recommendationsSwitch = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-recommendations'));
    if (recommendationsSwitch) {
        recommendationsSwitch.checked = guidedSetupState.tempRecommendations ?? true;
    }
    const body = document.getElementById('guided-setup-body');
    if (body) {
        body.classList.toggle('show-recommendations', guidedSetupState.tempRecommendations ?? true);
    }

    renderAllGuidedSetupTraderOffers();

    const raidMedalsBuySwitch = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-raid-medals-buy'));
    const raidPacks = playerObj?.income?.raidMedals?.packs || {};
    guidedSetupState.tempRaidMedalsBuy = playerObj?.income?.raidMedals?.enabled !== undefined
        ? playerObj.income.raidMedals.enabled
        : (raidPacks.shiny > 0 || raidPacks.glowy > 0 || raidPacks.starry > 0);
    guidedSetupState.tempRaidMedalsEarned = playerObj?.income?.raidMedals?.earned || 1200;
    guidedSetupState.tempRaidMedalsStarry = raidPacks.starry || 0;
    guidedSetupState.tempRaidMedalsGlowy = raidPacks.glowy || 0;
    guidedSetupState.tempRaidMedalsShiny = raidPacks.shiny || 0;

    if (raidMedalsBuySwitch) raidMedalsBuySwitch.checked = guidedSetupState.tempRaidMedalsBuy;

    const gemsBuySwitch = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-gems-buy'));
    const gemPacks = playerObj?.income?.gems?.packs || {};
    guidedSetupState.tempGemsBuy = playerObj?.income?.gems?.enabled !== undefined
        ? playerObj.income.gems.enabled
        : (gemPacks.shiny > 0 || gemPacks.glowy > 0 || gemPacks.starry > 0);
    guidedSetupState.tempGemsStarry = gemPacks.starry || 0;
    guidedSetupState.tempGemsGlowy = gemPacks.glowy || 0;
    guidedSetupState.tempGemsShiny = gemPacks.shiny || 0;

    if (gemsBuySwitch) gemsBuySwitch.checked = guidedSetupState.tempGemsBuy;

    const clanWarsBuySwitch = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-clan-wars-buy'));
    const clanWarsCountInput = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-clan-wars-count'));
    const clanWarsWinrateInput = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-clan-wars-winrate'));
    const clanWarsDrawrateInput = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-clan-wars-drawrate'));

    guidedSetupState.tempClanWars = playerObj?.income?.clanWar?.enabled !== undefined ? playerObj.income.clanWar.enabled : true;
    guidedSetupState.tempClanWarsCount = playerObj?.income?.clanWar?.warsPerMonth ?? 8;
    guidedSetupState.tempClanWarsWinrate = playerObj?.income?.clanWar?.winRate ?? 70;
    guidedSetupState.tempClanWarsDrawrate = playerObj?.income?.clanWar?.drawRate ?? 0;

    if (clanWarsBuySwitch) clanWarsBuySwitch.checked = guidedSetupState.tempClanWars;
    if (clanWarsCountInput) clanWarsCountInput.value = String(guidedSetupState.tempClanWarsCount);
    if (clanWarsWinrateInput) clanWarsWinrateInput.value = String(guidedSetupState.tempClanWarsWinrate);
    if (clanWarsDrawrateInput) clanWarsDrawrateInput.value = String(guidedSetupState.tempClanWarsDrawrate);

    const cwlBuySwitch = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-cwl-buy'));
    const cwlHitsInput = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-cwl-hits'));
    const cwlWinrateInput = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-cwl-winrate'));
    const cwlDrawrateInput = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-cwl-drawrate'));

    guidedSetupState.tempCwl = playerObj?.income?.cwl?.enabled !== undefined ? playerObj.income.cwl.enabled : true;
    guidedSetupState.tempCwlHits = playerObj?.income?.cwl?.hitsPerSeason ?? 7;
    guidedSetupState.tempCwlWinrate = playerObj?.income?.cwl?.winRate ?? 50;
    guidedSetupState.tempCwlDrawrate = playerObj?.income?.cwl?.drawRate ?? 0;

    if (cwlBuySwitch) cwlBuySwitch.checked = guidedSetupState.tempCwl;
    if (cwlHitsInput) cwlHitsInput.value = String(guidedSetupState.tempCwlHits);
    if (cwlWinrateInput) cwlWinrateInput.value = String(guidedSetupState.tempCwlWinrate);
    if (cwlDrawrateInput) cwlDrawrateInput.value = String(guidedSetupState.tempCwlDrawrate);

    const eventPassBuySwitch = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-event-pass-buy'));
    const eventIncludeEquipSwitch = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-event-include-equipment'));
    const eventTraderBuySwitch = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-event-trader-buy'));

    guidedSetupState.tempEventPassBuy = playerObj?.income?.eventPass?.eventPass !== undefined ? playerObj.income.eventPass.eventPass : true;
    guidedSetupState.tempEventIncludeEquipment = playerObj?.income?.eventPass?.includeEquipment !== undefined ? playerObj.income.eventPass.includeEquipment : true;
    const eventPacks = playerObj?.income?.eventPass?.trader?.packs || playerObj?.income?.eventTrader?.packs || {};
    guidedSetupState.tempEventTraderBuy = playerObj?.income?.eventPass?.trader?.enabled !== undefined
        ? playerObj.income.eventPass.trader.enabled
        : (eventPacks.shiny > 0 || eventPacks.glowy > 0 || eventPacks.starry > 0);
    guidedSetupState.tempEventTraderShiny = eventPacks.shiny || 0;
    guidedSetupState.tempEventTraderGlowy = eventPacks.glowy || 0;
    guidedSetupState.tempEventTraderStarry = eventPacks.starry || 0;

    if (eventPassBuySwitch) eventPassBuySwitch.checked = guidedSetupState.tempEventPassBuy;
    if (eventIncludeEquipSwitch) eventIncludeEquipSwitch.checked = guidedSetupState.tempEventIncludeEquipment;
    if (eventTraderBuySwitch) eventTraderBuySwitch.checked = guidedSetupState.tempEventTraderBuy;

    const goldPassSwitch = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-gold-pass'));
    if (goldPassSwitch) goldPassSwitch.checked = Boolean(guidedSetupState.tempGoldPass);

    const currencySelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('guided-setup-pref-currency'));
    if (currencySelect) {
        currencySelect.innerHTML = '';
        Object.entries(currencyData).forEach(([code, data]) => {
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = `${code} (${data.symbol || ''})`;
            if (code === guidedSetupState.tempCurrencyCode) opt.selected = true;
            currencySelect.appendChild(opt);
        });
        currencySelect.value = guidedSetupState.tempCurrencyCode;
    }

    const shopOffersBuySwitch = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-pref-shop-offers-buy'));
    if (shopOffersBuySwitch) shopOffersBuySwitch.checked = Boolean(guidedSetupState.tempShopOffersBuy);

    renderGuidedSetupShopOffers(currentTH, guidedSetupState.tempShopOffersPurchases || {});

    // Hydrate trader pack select dropdown values in DOM
    const raidStarrySelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('guided-setup-pref-raid-medals-starry'));
    const raidGlowySelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('guided-setup-pref-raid-medals-glowy'));
    const raidShinySelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('guided-setup-pref-raid-medals-shiny'));
    if (raidStarrySelect) raidStarrySelect.value = String(guidedSetupState.tempRaidMedalsStarry);
    if (raidGlowySelect) raidGlowySelect.value = String(guidedSetupState.tempRaidMedalsGlowy);
    if (raidShinySelect) raidShinySelect.value = String(guidedSetupState.tempRaidMedalsShiny);

    const gemsStarrySelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('guided-setup-pref-gems-starry'));
    const gemsGlowySelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('guided-setup-pref-gems-glowy'));
    const gemsShinySelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('guided-setup-pref-gems-shiny'));
    if (gemsStarrySelect) gemsStarrySelect.value = String(guidedSetupState.tempGemsStarry);
    if (gemsGlowySelect) gemsGlowySelect.value = String(guidedSetupState.tempGemsGlowy);
    if (gemsShinySelect) gemsShinySelect.value = String(guidedSetupState.tempGemsShiny);

    const eventStarrySelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('guided-setup-pref-event-trader-starry'));
    const eventGlowySelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('guided-setup-pref-event-trader-glowy'));
    const eventShinySelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('guided-setup-pref-event-trader-shiny'));
    if (eventStarrySelect) eventStarrySelect.value = String(guidedSetupState.tempEventTraderStarry);
    if (eventGlowySelect) eventGlowySelect.value = String(guidedSetupState.tempEventTraderGlowy);
    if (eventShinySelect) eventShinySelect.value = String(guidedSetupState.tempEventTraderShiny);

    toggleSubpanels();
}

/**
 * Toggles visibility of setting subpanels based on their parent switch toggle state.
 */
export function toggleSubpanels() {
    const panels = [
        { switchId: 'guided-setup-pref-clan-wars-buy', panelId: 'guided-setup-pref-clan-wars-panel' },
        { switchId: 'guided-setup-pref-cwl-buy', panelId: 'guided-setup-pref-cwl-panel' },
        { switchId: 'guided-setup-pref-raid-medals-buy', panelId: 'guided-setup-pref-raid-medals-panel' },
        { switchId: 'guided-setup-pref-gems-buy', panelId: 'guided-setup-pref-gems-panel' },
        { switchId: 'guided-setup-pref-event-trader-buy', panelId: 'guided-setup-pref-event-trader-panel' },
        { switchId: 'guided-setup-pref-shop-offers-buy', panelId: 'guided-setup-pref-shop-offers-panel' }
    ];

    panels.forEach(({ switchId, panelId }) => {
        const sw = /** @type {HTMLInputElement|null} */ (document.getElementById(switchId));
        const panel = document.getElementById(panelId);
        if (sw && panel) {
            panel.hidden = !sw.checked;
            panel.style.display = sw.checked ? 'flex' : 'none';
        }
    });
}
