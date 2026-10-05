import { resolveBestMatchShopOfferSet } from '../../data/incomeSources/shopOffers.js';
import { getWarOreValue } from '../../data/incomeSources/warOres.js';

import { isProfileOnboarded, state } from '../../core/state.js';

/**
 * Unified reactive state container for the Guided Setup modal and wizard flow.
 */
export const guidedSetupState = {
    // Modal & Flow Lifecycle
    isOpen: false,
    currentStep: 1,
    activeTag: /** @type {string|null} */ (null),
    isProfileLoaded: false,
    isInputProfileLoading: false,
    wasAlreadyOnboarded: false,

    // Village identity
    selectedTH: 16,
    selectedLeague: 105000000,

    // Stored ores & guidance
    tempStoredShiny: 0,
    tempStoredGlowy: 0,
    tempStoredStarry: 0,
    tempRecommendations: true,

    // Clan wars & CWL
    tempClanWars: false,
    tempClanWarsCount: 8,
    tempClanWarsWinrate: 70,
    tempClanWarsDrawrate: 0,
    tempCwl: false,
    tempCwlHits: 7,
    tempCwlWinrate: 50,
    tempCwlDrawrate: 0,

    // Traders
    tempRaidMedalsBuy: false,
    tempRaidMedalsEarned: 1200,
    tempRaidMedalsStarry: 0,
    tempRaidMedalsGlowy: 0,
    tempRaidMedalsShiny: 0,
    tempGemsBuy: false,
    tempGemsStarry: 0,
    tempGemsGlowy: 0,
    tempGemsShiny: 0,

    // Events
    tempEventPassBuy: false,
    tempEventIncludeEquipment: false,
    tempEventBonusMedals: 0,
    tempEventPurchasedMedals: 0,
    tempEventTraderBuy: false,
    tempEventTraderShiny: 0,
    tempEventTraderGlowy: 0,
    tempEventTraderStarry: 0,

    // Progression & shop offers
    tempCurrencyCode: 'USD',
    tempGoldPass: false,
    tempShopOffersBuy: false,
    tempShopOffersPurchases: /** @type {Record<string, number>} */ ({})
};

/**
 * Returns a cloned snapshot of the active Guided Setup state.
 * @returns {typeof guidedSetupState}
 */
export function getGuidedSetupState() {
    return { ...guidedSetupState };
}

/**
 * Updates properties on the guidedSetupState object.
 * @param {Partial<typeof guidedSetupState>} [updates={}]
 */
export function setGuidedSetupState(updates = {}) {
    Object.assign(guidedSetupState, updates);
}

/**
 * Resets all temporary guided setup fields and buffers to canonical defaults.
 */
export function resetGuidedSetupState() {
    guidedSetupState.currentStep = 1;
    guidedSetupState.activeTag = null;
    guidedSetupState.isProfileLoaded = false;
    guidedSetupState.isInputProfileLoading = false;
    guidedSetupState.wasAlreadyOnboarded = false;
    guidedSetupState.selectedTH = 16;
    guidedSetupState.selectedLeague = 105000000;

    guidedSetupState.tempStoredShiny = 0;
    guidedSetupState.tempStoredGlowy = 0;
    guidedSetupState.tempStoredStarry = 0;
    guidedSetupState.tempRecommendations = true;

    guidedSetupState.tempClanWars = false;
    guidedSetupState.tempClanWarsCount = 8;
    guidedSetupState.tempClanWarsWinrate = 70;
    guidedSetupState.tempClanWarsDrawrate = 0;
    guidedSetupState.tempCwl = false;
    guidedSetupState.tempCwlHits = 7;
    guidedSetupState.tempCwlWinrate = 50;
    guidedSetupState.tempCwlDrawrate = 0;

    guidedSetupState.tempRaidMedalsBuy = false;
    guidedSetupState.tempRaidMedalsEarned = 1200;
    guidedSetupState.tempRaidMedalsStarry = 0;
    guidedSetupState.tempRaidMedalsGlowy = 0;
    guidedSetupState.tempRaidMedalsShiny = 0;
    guidedSetupState.tempGemsBuy = false;
    guidedSetupState.tempGemsStarry = 0;
    guidedSetupState.tempGemsGlowy = 0;
    guidedSetupState.tempGemsShiny = 0;

    guidedSetupState.tempEventPassBuy = false;
    guidedSetupState.tempEventIncludeEquipment = false;
    guidedSetupState.tempEventBonusMedals = 0;
    guidedSetupState.tempEventPurchasedMedals = 0;
    guidedSetupState.tempEventTraderBuy = false;
    guidedSetupState.tempEventTraderShiny = 0;
    guidedSetupState.tempEventTraderGlowy = 0;
    guidedSetupState.tempEventTraderStarry = 0;

    guidedSetupState.tempCurrencyCode = state.uiSettings?.currency?.code || 'USD';
    guidedSetupState.tempGoldPass = false;
    guidedSetupState.tempShopOffersBuy = false;
    guidedSetupState.tempShopOffersPurchases = {};

    if (typeof document !== 'undefined') {
        const errorMsg = document.getElementById('guided-setup-player-tag-error');
        if (errorMsg) {
            errorMsg.textContent = '';
            errorMsg.classList.remove('show');
        }
        const tagInput = document.getElementById('guided-setup-player-tag-input');
        if (tagInput) {
            tagInput.classList.remove('input-error', 'shake');
        }
    }
}

/**
 * Commits temporary guided setup configurations and stored ores into a target player profile.
 * @param {any} playerObj - Target player data object in allPlayersData.
 */
export function applyPreferencesToProfile(playerObj) {
    if (!playerObj) return;

    if (!playerObj.storedOres) {
        playerObj.storedOres = { shiny: 0, glowy: 0, starry: 0 };
    }
    playerObj.storedOres.shiny = guidedSetupState.tempStoredShiny;
    playerObj.storedOres.glowy = guidedSetupState.tempStoredGlowy;
    playerObj.storedOres.starry = guidedSetupState.tempStoredStarry;

    if (!playerObj.income) {
        playerObj.income = {};
    }

    // Raid Medals Trader
    if (!playerObj.income.raidMedals) {
        playerObj.income.raidMedals = { enabled: false, earned: 1200, packs: { shiny: 0, glowy: 0, starry: 0 } };
    }
    if (!playerObj.income.raidMedals.packs) {
        playerObj.income.raidMedals.packs = { shiny: 0, glowy: 0, starry: 0 };
    }
    playerObj.income.raidMedals.enabled = guidedSetupState.tempRaidMedalsBuy;
    playerObj.income.raidMedals.earned = guidedSetupState.tempRaidMedalsBuy ? guidedSetupState.tempRaidMedalsEarned : 0;
    if (guidedSetupState.tempRaidMedalsBuy) {
        let starry = guidedSetupState.tempRaidMedalsStarry;
        let glowy = guidedSetupState.tempRaidMedalsGlowy;
        let shiny = guidedSetupState.tempRaidMedalsShiny;
        if (starry === 0 && glowy === 0 && shiny === 0) {
            starry = 2;
            glowy = 2;
        }
        playerObj.income.raidMedals.packs.shiny = shiny;
        playerObj.income.raidMedals.packs.glowy = glowy;
        playerObj.income.raidMedals.packs.starry = starry;
    } else {
        playerObj.income.raidMedals.packs.shiny = 0;
        playerObj.income.raidMedals.packs.glowy = 0;
        playerObj.income.raidMedals.packs.starry = 0;
    }

    // Gems Trader
    if (!playerObj.income.gems) {
        playerObj.income.gems = { enabled: false, packs: { shiny: 0, glowy: 0, starry: 0 } };
    }
    if (!playerObj.income.gems.packs) {
        playerObj.income.gems.packs = { shiny: 0, glowy: 0, starry: 0 };
    }
    playerObj.income.gems.enabled = guidedSetupState.tempGemsBuy;
    if (guidedSetupState.tempGemsBuy) {
        playerObj.income.gems.packs.shiny = guidedSetupState.tempGemsShiny;
        playerObj.income.gems.packs.glowy = guidedSetupState.tempGemsGlowy;
        playerObj.income.gems.packs.starry = guidedSetupState.tempGemsStarry;
    } else {
        playerObj.income.gems.packs.shiny = 0;
        playerObj.income.gems.packs.glowy = 0;
        playerObj.income.gems.packs.starry = 0;
    }

    const thLevel = playerObj?.playerProfile?.townHallLevel || guidedSetupState.selectedTH || 16;

    // Shop Offers
    if (!playerObj.income.shopOffers) {
        playerObj.income.shopOffers = { enabled: false, selectedSet: "0", purchases: {} };
    }
    if (!playerObj.income.shopOffers.purchases) {
        playerObj.income.shopOffers.purchases = {};
    }
    playerObj.income.shopOffers.enabled = guidedSetupState.tempShopOffersBuy;
    const bestMatchSet = resolveBestMatchShopOfferSet(thLevel);
    playerObj.income.shopOffers.selectedSet = bestMatchSet;
    const purchasesObj = guidedSetupState.tempShopOffersBuy
        ? structuredClone(guidedSetupState.tempShopOffersPurchases || {})
        : {};
    playerObj.income.shopOffers[bestMatchSet] = purchasesObj;
    playerObj.income.shopOffers.purchases = purchasesObj;

    // Clan Wars
    if (!playerObj.income.clanWar) {
        playerObj.income.clanWar = { enabled: false, warsPerMonth: 8, winRate: 70, drawRate: 0, oresPerAttack: { shiny: 0, glowy: 0, starry: 0 }, warPerformance: { thLevel: 16 } };
    }
    if (!playerObj.income.clanWar.oresPerAttack) {
        playerObj.income.clanWar.oresPerAttack = { shiny: 0, glowy: 0, starry: 0 };
    }
    playerObj.income.clanWar.enabled = guidedSetupState.tempClanWars;
    if (guidedSetupState.tempClanWars) {
        playerObj.income.clanWar.warsPerMonth = guidedSetupState.tempClanWarsCount;
        playerObj.income.clanWar.winRate = guidedSetupState.tempClanWarsWinrate;
        playerObj.income.clanWar.drawRate = guidedSetupState.tempClanWarsDrawrate;
        playerObj.income.clanWar.warPerformance = { thLevel };
        if (!playerObj.income.clanWar.oresPerAttack.shiny &&
            !playerObj.income.clanWar.oresPerAttack.glowy &&
            !playerObj.income.clanWar.oresPerAttack.starry) {
            playerObj.income.clanWar.oresPerAttack = {
                shiny: getWarOreValue('shiny', thLevel),
                glowy: getWarOreValue('glowy', thLevel),
                starry: getWarOreValue('starry', thLevel)
            };
        }
    }

    // CWL
    if (!playerObj.income.cwl) {
        playerObj.income.cwl = { enabled: false, hitsPerSeason: 7, attacksPerEvent: 7, winRate: 50, drawRate: 0, oresPerAttack: { shiny: 0, glowy: 0, starry: 0 } };
    }
    if (!playerObj.income.cwl.oresPerAttack) {
        playerObj.income.cwl.oresPerAttack = { shiny: 0, glowy: 0, starry: 0 };
    }
    playerObj.income.cwl.enabled = guidedSetupState.tempCwl;
    if (guidedSetupState.tempCwl) {
        playerObj.income.cwl.hitsPerSeason = guidedSetupState.tempCwlHits;
        playerObj.income.cwl.attacksPerEvent = guidedSetupState.tempCwlHits;
        playerObj.income.cwl.winRate = guidedSetupState.tempCwlWinrate;
        playerObj.income.cwl.drawRate = guidedSetupState.tempCwlDrawrate;
        if (!playerObj.income.cwl.oresPerAttack.shiny &&
            !playerObj.income.cwl.oresPerAttack.glowy &&
            !playerObj.income.cwl.oresPerAttack.starry) {
            playerObj.income.cwl.oresPerAttack = {
                shiny: getWarOreValue('shiny', thLevel),
                glowy: getWarOreValue('glowy', thLevel),
                starry: getWarOreValue('starry', thLevel)
            };
        }
    }

    // Event Pass & Event Trader
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
    playerObj.income.eventPass.enabled = guidedSetupState.tempEventPassBuy;
    playerObj.income.eventPass.eventPass = guidedSetupState.tempEventPassBuy;
    playerObj.income.eventPass.includeEquipment = guidedSetupState.tempEventIncludeEquipment;
    playerObj.income.eventPass.bonusTrackMedals = guidedSetupState.tempEventBonusMedals;
    playerObj.income.eventPass.purchasedMedals = guidedSetupState.tempEventPurchasedMedals;
    playerObj.income.eventPass.trader.enabled = guidedSetupState.tempEventTraderBuy;
    if (guidedSetupState.tempEventTraderBuy) {
        playerObj.income.eventPass.trader.packs.shiny = guidedSetupState.tempEventTraderShiny;
        playerObj.income.eventPass.trader.packs.glowy = guidedSetupState.tempEventTraderGlowy;
        playerObj.income.eventPass.trader.packs.starry = guidedSetupState.tempEventTraderStarry;
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
    playerObj.income.eventTrader.enabled = guidedSetupState.tempEventTraderBuy;
    if (guidedSetupState.tempEventTraderBuy) {
        playerObj.income.eventTrader.packs.shiny = guidedSetupState.tempEventTraderShiny;
        playerObj.income.eventTrader.packs.glowy = guidedSetupState.tempEventTraderGlowy;
        playerObj.income.eventTrader.packs.starry = guidedSetupState.tempEventTraderStarry;
    } else {
        playerObj.income.eventTrader.packs.shiny = 0;
        playerObj.income.eventTrader.packs.glowy = 0;
        playerObj.income.eventTrader.packs.starry = 0;
    }

    // Gold Pass
    if (!playerObj.income.goldPass) {
        playerObj.income.goldPass = { enabled: false };
    }
    playerObj.income.goldPass.enabled = guidedSetupState.tempGoldPass;
    if (!playerObj.income.prospector) {
        playerObj.income.prospector = {};
    }
    playerObj.income.prospector.goldPass = guidedSetupState.tempGoldPass;

    // Currency
    if (!playerObj.currency) {
        playerObj.currency = { code: guidedSetupState.tempCurrencyCode || 'USD' };
    } else {
        playerObj.currency.code = guidedSetupState.tempCurrencyCode || 'USD';
    }

    if (state.uiSettings) {
        if (!state.uiSettings.currency) {
            state.uiSettings.currency = { code: guidedSetupState.tempCurrencyCode || 'USD' };
        } else {
            state.uiSettings.currency.code = guidedSetupState.tempCurrencyCode || 'USD';
        }
    }

    // Star Bonus League
    const targetLeague = playerObj.playerProfile?.leagueTier?.id || playerObj.playerProfile?.league?.id || guidedSetupState.selectedLeague || 105000000;

    if (!playerObj.income.starBonus) {
        playerObj.income.starBonus = { league: targetLeague };
    } else {
        playerObj.income.starBonus.league = targetLeague;
    }
}

/**
 * Populates temporary guided setup preferences from an existing profile.
 * @param {string} tag - Player profile tag.
 */
export function syncPreferencesFromProfile(tag) {
    if (!tag) return;
    const playerObj = state.allPlayersData?.[tag];
    if (!playerObj) return;

    guidedSetupState.activeTag = tag;
    guidedSetupState.wasAlreadyOnboarded = isProfileOnboarded(playerObj);

    const profile = playerObj.playerProfile || playerObj.playerData || {};
    guidedSetupState.selectedTH = profile.townHallLevel || 16;
    guidedSetupState.selectedLeague = profile.leagueTier?.id || profile.league?.id || 105000000;

    if (playerObj.storedOres) {
        guidedSetupState.tempStoredShiny = playerObj.storedOres.shiny || 0;
        guidedSetupState.tempStoredGlowy = playerObj.storedOres.glowy || 0;
        guidedSetupState.tempStoredStarry = playerObj.storedOres.starry || 0;
    }

    const income = playerObj.income || {};
    if (income.clanWar) {
        guidedSetupState.tempClanWars = Boolean(income.clanWar.enabled);
        guidedSetupState.tempClanWarsCount = income.clanWar.warsPerMonth ?? 8;
        guidedSetupState.tempClanWarsWinrate = income.clanWar.winRate ?? 70;
        guidedSetupState.tempClanWarsDrawrate = income.clanWar.drawRate ?? 0;
    }
    if (income.cwl) {
        guidedSetupState.tempCwl = Boolean(income.cwl.enabled);
        guidedSetupState.tempCwlHits = income.cwl.hitsPerSeason ?? 7;
        guidedSetupState.tempCwlWinrate = income.cwl.winRate ?? 50;
        guidedSetupState.tempCwlDrawrate = income.cwl.drawRate ?? 0;
    }
    if (income.raidMedals) {
        guidedSetupState.tempRaidMedalsBuy = Boolean(income.raidMedals.enabled);
        guidedSetupState.tempRaidMedalsEarned = income.raidMedals.earned ?? 1200;
        guidedSetupState.tempRaidMedalsShiny = income.raidMedals.packs?.shiny || 0;
        guidedSetupState.tempRaidMedalsGlowy = income.raidMedals.packs?.glowy || 0;
        guidedSetupState.tempRaidMedalsStarry = income.raidMedals.packs?.starry || 0;
    }
    if (income.gems) {
        guidedSetupState.tempGemsBuy = Boolean(income.gems.enabled);
        guidedSetupState.tempGemsShiny = income.gems.packs?.shiny || 0;
        guidedSetupState.tempGemsGlowy = income.gems.packs?.glowy || 0;
        guidedSetupState.tempGemsStarry = income.gems.packs?.starry || 0;
    }
    if (income.eventPass) {
        guidedSetupState.tempEventPassBuy = Boolean(income.eventPass.enabled || income.eventPass.eventPass);
        guidedSetupState.tempEventIncludeEquipment = Boolean(income.eventPass.includeEquipment);
        guidedSetupState.tempEventBonusMedals = income.eventPass.bonusTrackMedals || 0;
        guidedSetupState.tempEventPurchasedMedals = income.eventPass.purchasedMedals || 0;
        guidedSetupState.tempEventTraderBuy = Boolean(income.eventPass.trader?.enabled || income.eventTrader?.enabled);
        const traderPacks = income.eventPass.trader?.packs || income.eventTrader?.packs || {};
        guidedSetupState.tempEventTraderShiny = traderPacks.shiny || 0;
        guidedSetupState.tempEventTraderGlowy = traderPacks.glowy || 0;
        guidedSetupState.tempEventTraderStarry = traderPacks.starry || 0;
    }
    if (income.goldPass || income.prospector) {
        guidedSetupState.tempGoldPass = Boolean(income.goldPass?.enabled || income.prospector?.goldPass);
    }
    if (income.shopOffers) {
        guidedSetupState.tempShopOffersBuy = Boolean(income.shopOffers.enabled);
        const bestMatchSet = resolveBestMatchShopOfferSet(guidedSetupState.selectedTH);
        guidedSetupState.tempShopOffersPurchases = structuredClone(
            income.shopOffers[bestMatchSet] || income.shopOffers.purchases || {}
        );
    }

    guidedSetupState.tempCurrencyCode = playerObj.currency?.code || state.uiSettings?.currency?.code || 'USD';
}
