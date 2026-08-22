import { shopOfferData } from '../../data/incomeSources/shopOffers.js';
import { eventTraderData, gemTraderData, raidMedalTraderData } from '../../data/incomeSources/traders.js';
import { currencyData } from '../../data/pricingData.js';
import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';

import { getCurrencySymbol, getPriceForTier } from '../../utils/incomeUtils.js';
import { formatNumber } from '../../utils/numberFormatter.js';

import { welcomeState } from './welcomeModalState.js';

/**
 * Declaratively renders Trader subpanel rows (Raid Medals, Gems, Event Trader) from trader domain datasets.
 *
 * @param {string} containerId - Target container ID in Welcome Modal HTML.
 * @param {Array<Object> | ReadonlyArray<Object>} offers - Trader offers dataset (raidMedalTraderData, gemTraderData, eventTraderData).
 * @param {string} idPrefix - Prefix for select elements (e.g. 'welcome-pref-raid-medals', 'welcome-pref-gems', 'welcome-pref-event-trader').
 * @param {string} currencyImg - Resource asset filename without extension (e.g. 'raidMedal', 'gem', 'eventMedal').
 * @param {string} currencyAlt - Localized or descriptive text for currency.
 * @param {Object<string, string>} [badgeMap={}] - Mapping of ore type to badge icon name ('thumbs-double' | 'thumbs-up').
 */
export function renderWelcomeTraderRows(containerId, offers, idPrefix, currencyImg, currencyAlt, badgeMap = {}) {
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
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '2fr 1fr 1fr';
        row.style.alignItems = 'center';
        row.style.gap = '12px';
        row.style.background = 'color-mix(in srgb, var(--bg-surface-primary) 15%, transparent)';
        row.style.padding = '6px 10px';
        row.style.borderRadius = '8px';
        row.style.border = '1px solid color-mix(in srgb, var(--border-primary) 30%, transparent)';

        // Col 1: Cost display
        const costDisplay = document.createElement('div');
        costDisplay.style.display = 'flex';
        costDisplay.style.alignItems = 'center';
        costDisplay.style.justifyContent = 'center';
        costDisplay.style.gap = '6px';
        costDisplay.title = `${currencyAlt} Cost`;

        const costImg = document.createElement('orecalc-assets-image');
        costImg.setAttribute('src', `assets/resources/${currencyImg}.png`);
        costImg.setAttribute('alt', currencyAlt);
        costImg.style.width = '16px';
        costImg.style.height = '16px';
        costImg.style.objectFit = 'contain';
        costDisplay.appendChild(costImg);

        const costSpan = document.createElement('span');
        costSpan.style.fontSize = '12px';
        costSpan.style.color = 'var(--text-secondary)';
        costSpan.style.fontWeight = '500';
        costSpan.textContent = formatNumber(offer.cost);
        costDisplay.appendChild(costSpan);

        if (badgeType) {
            const badgeSpan = document.createElement('span');
            badgeSpan.className = 'recommended-badge ore-row-badge';
            badgeSpan.innerHTML = `<orecalc-assets-svg name="${badgeType}" height="12" width="12" fill="currentColor"></orecalc-assets-svg>`;
            costDisplay.appendChild(badgeSpan);
        }
        row.appendChild(costDisplay);

        // Col 2: Ore Amount display
        const oreDisplay = document.createElement('div');
        oreDisplay.style.display = 'flex';
        oreDisplay.style.alignItems = 'center';
        oreDisplay.style.justifyContent = 'center';
        oreDisplay.title = `${oreName} Amount`;

        const oreInner = document.createElement('div');
        oreInner.style.display = 'flex';
        oreInner.style.alignItems = 'center';
        oreInner.style.justifyContent = 'flex-end';
        oreInner.style.gap = '6px';
        oreInner.style.width = '75px';

        const amountSpan = document.createElement('span');
        amountSpan.style.fontSize = '12px';
        amountSpan.style.color = 'var(--text-primary)';
        amountSpan.style.fontWeight = '600';
        amountSpan.textContent = formatNumber(oreValue);
        oreInner.appendChild(amountSpan);

        const oreImg = document.createElement('orecalc-assets-image');
        oreImg.setAttribute('src', `assets/${oreType}_ore.png`);
        oreImg.setAttribute('alt', oreName);
        oreImg.setAttribute('class', 'ore-image');
        oreImg.setAttribute('size', 'thumbnail');
        oreImg.style.width = '16px';
        oreImg.style.height = '16px';
        oreImg.style.objectFit = 'contain';
        oreInner.appendChild(oreImg);

        oreDisplay.appendChild(oreInner);
        row.appendChild(oreDisplay);

        // Col 3: Select dropdown
        const select = document.createElement('select');
        select.id = `${idPrefix}-${oreType}`;
        select.className = 'welcome-select-input';
        select.style.width = '100%';
        select.style.height = '28px';
        select.style.padding = '2px 6px';
        select.style.borderRadius = '6px';
        select.style.boxSizing = 'border-box';
        select.style.backgroundColor = 'var(--bg-surface-primary)';
        select.style.color = 'var(--text-primary)';
        select.style.fontSize = '12px';
        select.style.outline = 'none';
        select.style.cursor = 'pointer';

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

function renderAllWelcomeTraderOffers() {
    renderWelcomeTraderRows(
        'welcome-raid-trader-rows-container',
        raidMedalTraderData,
        'welcome-pref-raid-medals',
        'raidMedal',
        'Raid Medals',
        { starry: 'thumbs-double', glowy: 'thumbs-double' }
    );
    renderWelcomeTraderRows(
        'welcome-gem-trader-rows-container',
        gemTraderData,
        'welcome-pref-gems',
        'gem',
        'Gems',
        { starry: 'thumbs-up' }
    );
    renderWelcomeTraderRows(
        'welcome-event-trader-rows-container',
        eventTraderData,
        'welcome-pref-event-trader',
        'eventMedal',
        'Event Medals',
        { starry: 'thumbs-double', glowy: 'thumbs-up' }
    );
}

/**
 * Resolves the closest matching Town Hall Shop Offer set identifier for a given TH level.
 * @param {number} thLevel - Town Hall level.
 * @returns {string} Town Hall set key in shopOfferData.
 */
export function getBestMatchShopOfferSet(thLevel) {
    if (shopOfferData[thLevel]) return String(thLevel);
    const availableTHs = Object.keys(shopOfferData).map(Number).filter(n => !isNaN(n)).sort((a, b) => b - a);
    const lowerTH = availableTHs.find(th => th <= thLevel);
    return lowerTH ? String(lowerTH) : (availableTHs[availableTHs.length - 1] ? String(availableTHs[availableTHs.length - 1]) : "0");
}

/**
 * Renders the Shop Offer pack configuration list inside the Welcome Modal settings subpanel.
 * @param {number} thLevel - Active player Town Hall level.
 * @param {object} purchasedOffers - Map of offer IDs to purchased pack counts.
 */
export function renderWelcomeShopOffers(thLevel, purchasedOffers) {
    const container = document.getElementById('welcome-shop-offers-inputs-container');
    if (!container) return;
    container.innerHTML = '';

    const bestSetKey = getBestMatchShopOfferSet(thLevel);
    const setOffers = shopOfferData[bestSetKey];
    if (!setOffers || bestSetKey === '0') {
        const noOffersMsg = document.createElement('div');
        noOffersMsg.style.fontSize = '12px';
        noOffersMsg.style.color = 'var(--text-secondary)';
        noOffersMsg.textContent = translate('views.income.shopOffers.noOffers') || 'No offers available for this Town Hall level.';
        container.appendChild(noOffersMsg);
        return;
    }

    const order = { 'shiny_large': 1, 'starry': 2, 'glowy': 3, 'shiny_small': 4, 'shiny': 4 };
    const currentCurrency = welcomeState.tempCurrencyCode || 'USD';

    Object.entries(setOffers)
        .filter(([id]) => id !== 'townHallLevel')
        .sort(([idA], [idB]) => (order[idA] || 99) - (order[idB] || 99))
        .forEach(([id, data]) => {
            const row = document.createElement('div');
            row.className = 'subpanel-row';
            row.dataset.offerId = id;
            row.dataset.oreType = id;
            row.style.display = 'grid';
            row.style.gridTemplateColumns = '2fr 1fr 1fr';
            row.style.alignItems = 'center';
            row.style.gap = '12px';
            row.style.background = 'color-mix(in srgb, var(--bg-surface-primary) 15%, transparent)';
            row.style.padding = '6px 10px';
            row.style.borderRadius = '8px';
            row.style.border = '1px solid color-mix(in srgb, var(--border-primary) 30%, transparent)';

            const oreType = data.shiny ? 'shiny' : data.glowy ? 'glowy' : 'starry';
            const oreValue = data.shiny || data.glowy || data.starry;

            // Column 1: Cost display
            const costDisplay = document.createElement('div');
            costDisplay.style.display = 'flex';
            costDisplay.style.alignItems = 'center';
            costDisplay.style.justifyContent = 'center';
            costDisplay.style.gap = '6px';
            costDisplay.title = 'Offer Price';

            const priceSpan = document.createElement('span');
            priceSpan.style.fontSize = '12px';
            priceSpan.style.color = 'var(--text-secondary)';
            priceSpan.style.fontWeight = '500';

            const price = getPriceForTier(data.priceTier, currentCurrency);
            const symbol = getCurrencySymbol(currentCurrency);
            priceSpan.textContent = `${symbol}${price.toFixed(2)}`;

            costDisplay.appendChild(priceSpan);

            if (oreType === 'starry') {
                const badge = document.createElement('span');
                badge.className = 'recommended-badge ore-row-badge';
                badge.innerHTML = '<orecalc-assets-svg name="thumbs-up" height="12" width="12" fill="currentColor"></orecalc-assets-svg>';
                costDisplay.appendChild(badge);
            }

            row.appendChild(costDisplay);

            // Column 2: Ore display
            const oreDisplay = document.createElement('div');
            oreDisplay.style.display = 'flex';
            oreDisplay.style.alignItems = 'center';
            oreDisplay.style.justifyContent = 'center';
            oreDisplay.title = `${translate('entities.ores.' + oreType) || oreType} Amount`;

            const oreInner = document.createElement('div');
            oreInner.style.display = 'flex';
            oreInner.style.alignItems = 'center';
            oreInner.style.justifyContent = 'flex-end';
            oreInner.style.gap = '6px';
            oreInner.style.width = '75px';

            const countSpan = document.createElement('span');
            countSpan.style.fontSize = '12px';
            countSpan.style.fontWeight = '600';
            countSpan.style.color = 'var(--text-primary)';
            countSpan.textContent = formatNumber(oreValue);

            const oreImg = document.createElement('orecalc-assets-image');
            oreImg.setAttribute('src', `assets/${oreType}_ore.png`);
            oreImg.setAttribute('alt', translate('entities.ores.' + oreType) || oreType);
            oreImg.setAttribute('class', 'ore-image');
            oreImg.setAttribute('size', 'thumbnail');
            oreImg.style.width = '16px';
            oreImg.style.height = '16px';
            oreImg.style.objectFit = 'contain';

            oreInner.appendChild(countSpan);
            oreInner.appendChild(oreImg);
            oreDisplay.appendChild(oreInner);
            row.appendChild(oreDisplay);

            // Column 3: Select dropdown
            const select = document.createElement('select');
            select.id = `welcome-shop-offer-${id}`;
            select.className = 'welcome-select-input';
            select.dataset.offerId = id;
            select.style.width = '100%';
            select.style.height = '28px';
            select.style.padding = '2px 6px';
            select.style.borderRadius = '6px';
            select.style.boxSizing = 'border-box';
            select.style.backgroundColor = 'var(--bg-surface-primary)';
            select.style.color = 'var(--text-primary)';
            select.style.fontSize = '12px';
            select.style.outline = 'none';
            select.style.cursor = 'pointer';

            for (let i = 0; i <= data.maxPacks; i++) {
                const opt = document.createElement('option');
                opt.value = i.toString();
                opt.textContent = i.toString();
                select.appendChild(opt);
            }
            select.value = (purchasedOffers && purchasedOffers[id] !== undefined ? purchasedOffers[id] : 0).toString();

            row.appendChild(select);
            container.appendChild(row);
        });
}

/**
 * Synchronizes Welcome Modal settings inputs and temporary state buffers with the active player profile.
 * @param {string} tag - Player profile tag or 'DEFAULT0'.
 */
export function syncWelcomeQuickSettings(tag) {
    const isGuest = (tag === 'DEFAULT0');
    const playerObj = tag ? state.allPlayersData[tag] : null;
    const currentTH = isGuest ? (welcomeState.selectedTH || 16) : (playerObj?.playerProfile?.townHallLevel || playerObj?.townHallLevel || welcomeState.selectedTH || 16);

    welcomeState.tempStoredShiny = playerObj?.storedOres?.shiny || 0;
    welcomeState.tempStoredGlowy = playerObj?.storedOres?.glowy || 0;
    welcomeState.tempStoredStarry = playerObj?.storedOres?.starry || 0;

    const storedShinyInput = document.getElementById('welcome-stored-shiny');
    const storedGlowyInput = document.getElementById('welcome-stored-glowy');
    const storedStarryInput = document.getElementById('welcome-stored-starry');

    if (storedShinyInput) storedShinyInput.value = welcomeState.tempStoredShiny;
    if (storedGlowyInput) storedGlowyInput.value = welcomeState.tempStoredGlowy;
    if (storedStarryInput) storedStarryInput.value = welcomeState.tempStoredStarry;

    renderAllWelcomeTraderOffers();

    const raidMedalsBuySwitch = document.getElementById('welcome-pref-raid-medals-buy');
    const raidMedalsEarnedInput = document.getElementById('welcome-pref-raid-medals-earned');
    const raidMedalsStarryInput = document.getElementById('welcome-pref-raid-medals-starry');
    const raidMedalsGlowyInput = document.getElementById('welcome-pref-raid-medals-glowy');
    const raidMedalsShinyInput = document.getElementById('welcome-pref-raid-medals-shiny');

    const raidPacks = playerObj?.income?.raidMedals?.packs || {};
    welcomeState.tempRaidMedalsBuy = playerObj?.income?.raidMedals?.enabled !== undefined
        ? playerObj.income.raidMedals.enabled
        : (raidPacks.shiny > 0 || raidPacks.glowy > 0 || raidPacks.starry > 0);
    welcomeState.tempRaidMedalsEarned = playerObj?.income?.raidMedals?.earned || 1200;
    welcomeState.tempRaidMedalsStarry = raidPacks.starry || 0;
    welcomeState.tempRaidMedalsGlowy = raidPacks.glowy || 0;
    welcomeState.tempRaidMedalsShiny = raidPacks.shiny || 0;

    if (raidMedalsBuySwitch) raidMedalsBuySwitch.checked = welcomeState.tempRaidMedalsBuy;
    if (raidMedalsEarnedInput) raidMedalsEarnedInput.value = welcomeState.tempRaidMedalsEarned;
    if (raidMedalsStarryInput) raidMedalsStarryInput.value = String(welcomeState.tempRaidMedalsStarry);
    if (raidMedalsGlowyInput) raidMedalsGlowyInput.value = String(welcomeState.tempRaidMedalsGlowy);
    if (raidMedalsShinyInput) raidMedalsShinyInput.value = String(welcomeState.tempRaidMedalsShiny);

    const gemsBuySwitch = document.getElementById('welcome-pref-gems-buy');
    const gemsStarryInput = document.getElementById('welcome-pref-gems-starry');
    const gemsGlowyInput = document.getElementById('welcome-pref-gems-glowy');
    const gemsShinyInput = document.getElementById('welcome-pref-gems-shiny');

    const gemPacks = playerObj?.income?.gems?.packs || {};
    welcomeState.tempGemsBuy = playerObj?.income?.gems?.enabled !== undefined
        ? playerObj.income.gems.enabled
        : (gemPacks.shiny > 0 || gemPacks.glowy > 0 || gemPacks.starry > 0);
    welcomeState.tempGemsStarry = gemPacks.starry || 0;
    welcomeState.tempGemsGlowy = gemPacks.glowy || 0;
    welcomeState.tempGemsShiny = gemPacks.shiny || 0;

    if (gemsBuySwitch) gemsBuySwitch.checked = welcomeState.tempGemsBuy;
    if (gemsStarryInput) gemsStarryInput.value = String(welcomeState.tempGemsStarry);
    if (gemsGlowyInput) gemsGlowyInput.value = String(welcomeState.tempGemsGlowy);
    if (gemsShinyInput) gemsShinyInput.value = String(welcomeState.tempGemsShiny);

    const shopOffersBuySwitch = document.getElementById('welcome-pref-shop-offers-buy');
    const shopOffersState = playerObj?.income?.shopOffers || {};
    const bestSetKey = getBestMatchShopOfferSet(currentTH);
    const bestSetNum = parseInt(bestSetKey, 10);
    const selectedSet = (shopOffersState.selectedSet !== undefined && shopOffersState.selectedSet !== null) ? shopOffersState.selectedSet : bestSetNum;
    const purchasedOffers = (shopOffersState.purchases ? shopOffersState.purchases : shopOffersState[selectedSet]) || {};

    welcomeState.tempShopOffersBuy = shopOffersState.enabled !== undefined
        ? shopOffersState.enabled
        : Object.values(purchasedOffers).some(c => c > 0);
    welcomeState.tempShopOffersPurchases = structuredClone(purchasedOffers);

    if (shopOffersBuySwitch) shopOffersBuySwitch.checked = welcomeState.tempShopOffersBuy;

    const currencySelect = document.getElementById('welcome-pref-currency');
    if (currencySelect) {
        currencySelect.innerHTML = '';
        Object.keys(currencyData).forEach(code => {
            const currency = currencyData[code];
            if (currency.enabled) {
                const option = document.createElement('option');
                option.value = code;
                option.textContent = `${currency.symbol} ${code}`;
                currencySelect.appendChild(option);
            }
        });
        welcomeState.tempCurrencyCode = playerObj?.currency?.code || state.uiSettings?.currency?.code || 'USD';
        currencySelect.value = welcomeState.tempCurrencyCode;
    }

    renderWelcomeShopOffers(currentTH, welcomeState.tempShopOffersPurchases);

    const clanWarsSwitch = document.getElementById('welcome-pref-clan-wars-buy');
    const clanWarsCountInput = document.getElementById('welcome-pref-clan-wars-count');
    const clanWarsWinrateInput = document.getElementById('welcome-pref-clan-wars-winrate');
    const clanWarsDrawrateInput = document.getElementById('welcome-pref-clan-wars-drawrate');

    const clanWarState = playerObj?.income?.clanWar || playerObj?.income?.clanWars || {};
    welcomeState.tempClanWars = clanWarState.enabled !== undefined ? clanWarState.enabled : true;
    welcomeState.tempClanWarsCount = clanWarState.warsPerMonth !== undefined ? clanWarState.warsPerMonth : 8;
    welcomeState.tempClanWarsWinrate = clanWarState.winRate !== undefined ? clanWarState.winRate : 70;
    welcomeState.tempClanWarsDrawrate = clanWarState.drawRate !== undefined ? clanWarState.drawRate : 0;

    if (clanWarsSwitch) clanWarsSwitch.checked = welcomeState.tempClanWars;
    if (clanWarsCountInput) clanWarsCountInput.value = welcomeState.tempClanWarsCount;
    if (clanWarsWinrateInput) clanWarsWinrateInput.value = welcomeState.tempClanWarsWinrate;
    if (clanWarsDrawrateInput) clanWarsDrawrateInput.value = welcomeState.tempClanWarsDrawrate;

    const cwlSwitch = document.getElementById('welcome-pref-cwl-buy');
    const cwlHitsInput = document.getElementById('welcome-pref-cwl-hits');
    const cwlWinrateInput = document.getElementById('welcome-pref-cwl-winrate');
    const cwlDrawrateInput = document.getElementById('welcome-pref-cwl-drawrate');

    const cwlState = playerObj?.income?.cwl || {};
    welcomeState.tempCwl = cwlState.enabled !== undefined ? cwlState.enabled : true;
    welcomeState.tempCwlHits = cwlState.hitsPerSeason !== undefined
        ? cwlState.hitsPerSeason
        : (cwlState.attacksPerEvent !== undefined ? cwlState.attacksPerEvent : 7);
    welcomeState.tempCwlWinrate = cwlState.winRate !== undefined ? cwlState.winRate : 50;
    welcomeState.tempCwlDrawrate = cwlState.drawRate !== undefined ? cwlState.drawRate : 0;

    if (cwlSwitch) cwlSwitch.checked = welcomeState.tempCwl;
    if (cwlHitsInput) cwlHitsInput.value = welcomeState.tempCwlHits;
    if (cwlWinrateInput) cwlWinrateInput.value = welcomeState.tempCwlWinrate;
    if (cwlDrawrateInput) cwlDrawrateInput.value = welcomeState.tempCwlDrawrate;

    const eventPassBuySwitch = document.getElementById('welcome-pref-event-pass-buy');
    const eventIncludeEquipmentSwitch = document.getElementById('welcome-pref-event-include-equipment');
    const eventBonusMedalsInput = document.getElementById('welcome-pref-event-bonus-medals');
    const eventPurchasedMedalsInput = document.getElementById('welcome-pref-event-purchased-medals');
    const eventTraderBuySwitch = document.getElementById('welcome-pref-event-trader-buy');
    const eventTraderShinyInput = document.getElementById('welcome-pref-event-trader-shiny');
    const eventTraderGlowyInput = document.getElementById('welcome-pref-event-trader-glowy');
    const eventTraderStarryInput = document.getElementById('welcome-pref-event-trader-starry');

    const epState = playerObj?.income?.eventPass || {};
    const etState = playerObj?.income?.eventTrader || epState?.trader || {};
    const etPacks = etState?.packs || {};

    welcomeState.tempEventPassBuy = epState.enabled !== undefined
        ? epState.enabled
        : (epState.eventPass !== undefined ? epState.eventPass : false);
    welcomeState.tempEventIncludeEquipment = epState.includeEquipment || false;
    welcomeState.tempEventBonusMedals = epState.bonusTrackMedals || 0;
    welcomeState.tempEventPurchasedMedals = epState.purchasedMedals || 0;
    welcomeState.tempEventTraderBuy = etState.enabled !== undefined
        ? etState.enabled
        : (etPacks.shiny > 0 || etPacks.glowy > 0 || etPacks.starry > 0);
    welcomeState.tempEventTraderShiny = etPacks.shiny || 0;
    welcomeState.tempEventTraderGlowy = etPacks.glowy || 0;
    welcomeState.tempEventTraderStarry = etPacks.starry || 0;

    if (eventPassBuySwitch) eventPassBuySwitch.checked = welcomeState.tempEventPassBuy;
    if (eventIncludeEquipmentSwitch) eventIncludeEquipmentSwitch.checked = welcomeState.tempEventIncludeEquipment;
    if (eventBonusMedalsInput) eventBonusMedalsInput.value = welcomeState.tempEventBonusMedals;
    if (eventPurchasedMedalsInput) eventPurchasedMedalsInput.value = welcomeState.tempEventPurchasedMedals;
    if (eventTraderBuySwitch) eventTraderBuySwitch.checked = welcomeState.tempEventTraderBuy;
    if (eventTraderShinyInput) eventTraderShinyInput.value = String(welcomeState.tempEventTraderShiny);
    if (eventTraderGlowyInput) eventTraderGlowyInput.value = String(welcomeState.tempEventTraderGlowy);
    if (eventTraderStarryInput) eventTraderStarryInput.value = String(welcomeState.tempEventTraderStarry);

    const goldPassSwitch = document.getElementById('welcome-pref-gold-pass');
    welcomeState.tempGoldPass = playerObj?.income?.goldPass?.enabled || false;
    if (goldPassSwitch) goldPassSwitch.checked = welcomeState.tempGoldPass;

    const cloudSyncSwitch = document.getElementById('welcome-pref-cloud-sync');
    welcomeState.tempCloudSync = state.uiSettings?.cloudSync !== false;
    if (cloudSyncSwitch) {
        if (isGuest) {
            cloudSyncSwitch.disabled = true;
            cloudSyncSwitch.checked = false;
        } else {
            cloudSyncSwitch.disabled = false;
            cloudSyncSwitch.checked = welcomeState.tempCloudSync;
        }
    }

    toggleSubpanels();
}

/**
 * Toggles the visibility of income source configuration subpanels based on their parent switches.
 */
export function toggleSubpanels() {
    const raidMedalsSub = document.getElementById('welcome-pref-raid-medals-panel');
    const gemsSub = document.getElementById('welcome-pref-gems-panel');
    const shopOffersSub = document.getElementById('welcome-pref-shop-offers-panel');
    const clanWarsSub = document.getElementById('welcome-pref-clan-wars-panel');
    const cwlSub = document.getElementById('welcome-pref-cwl-panel');
    const eventPassSub = document.getElementById('welcome-pref-event-pass-panel');
    const eventTraderSub = document.getElementById('welcome-pref-event-trader-panel');

    const raidMedalsBuy = document.getElementById('welcome-pref-raid-medals-buy');
    const gemsBuy = document.getElementById('welcome-pref-gems-buy');
    const shopOffersBuy = document.getElementById('welcome-pref-shop-offers-buy');
    const clanWars = document.getElementById('welcome-pref-clan-wars-buy');
    const cwl = document.getElementById('welcome-pref-cwl-buy');
    const eventPassBuy = document.getElementById('welcome-pref-event-pass-buy');
    const eventTraderBuy = document.getElementById('welcome-pref-event-trader-buy');

    if (raidMedalsSub && raidMedalsBuy) raidMedalsSub.style.display = raidMedalsBuy.checked ? 'flex' : 'none';
    if (gemsSub && gemsBuy) {
        gemsSub.style.display = gemsBuy.checked ? 'flex' : 'none';
        gemsSub.classList.toggle('has-gold-pass', Boolean(welcomeState.tempGoldPass));
    }
    if (shopOffersSub && shopOffersBuy) shopOffersSub.style.display = shopOffersBuy.checked ? 'flex' : 'none';
    if (clanWarsSub && clanWars) clanWarsSub.style.display = clanWars.checked ? 'flex' : 'none';
    if (cwlSub && cwl) cwlSub.style.display = cwl.checked ? 'flex' : 'none';
    if (eventPassSub && eventPassBuy) eventPassSub.style.display = eventPassBuy.checked ? 'flex' : 'none';
    if (eventTraderSub && eventTraderBuy) {
        eventTraderSub.style.display = eventTraderBuy.checked ? 'flex' : 'none';
        eventTraderSub.classList.toggle('has-event-pass', Boolean(welcomeState.tempEventPassBuy));
        eventTraderSub.classList.toggle('include-equipment', Boolean(welcomeState.tempEventIncludeEquipment));
    }
}
