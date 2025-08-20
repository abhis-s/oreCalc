import { renderTabs } from '../components/layout/tabs.js';
import { renderModeToggle } from '../components/layout/modeToggle.js';
import { renderAppSettings } from '../components/appSettings/appSettings.js';
import { renderFab } from '../components/fab/fab.js';
import { renderHeroCards } from '../components/equipment/heroCardDisplay.js';
import { renderStorageInputs } from '../components/equipment/storageInputs.js';
import { renderPlayerDropdown } from '../components/player/playerDropdown.js';

import { renderStarBonusSelector } from '../components/income/starBonusSelector.js';
import { renderClanWarInputs } from '../components/income/clanWarInputs.js';
import { renderCwlInputs } from '../components/income/cwlInputs.js';
import { renderEventPassInputs } from '../components/income/eventPassInputs.js';
import { renderRaidMedalTraderGrid, renderRaidMedalTraderDisplay } from '../components/income/raidMedalTrader.js';
import { renderGemTraderGrid } from '../components/income/gemTrader.js';
import { renderEventTraderGrid } from '../components/income/eventTrader.js';
import { renderShopOfferSelector, renderShopOfferGrid } from '../components/income/shopOffers.js';

import { renderRequiredOres } from '../components/equipment/requiredOresDisplay.js';
import { renderRemainingTime } from '../components/equipment/remainingTimeDisplay.js';
import { renderStarBonusDisplay } from '../components/income/starBonusDisplay.js';
import { renderClanWarHomeDisplay, renderClanWarIncomeTabDisplay } from '../components/income/clanWarDisplay.js';
import { renderCwlHomeDisplay, renderCwlIncomeTabDisplay } from '../components/income/cwlDisplay.js';
import { renderGemHomeDisplay } from '../components/income/gemTraderDisplay.js';
import { renderEventPassHomeDisplay } from '../components/income/eventPassDisplay.js';
import { renderEventTraderHomeDisplay } from '../components/income/eventTraderDisplay.js';
import { renderShopOfferHomeDisplay } from '../components/income/shopOfferDisplay.js';
import { renderIncomeCard } from '../components/income/incomeCardHandler.js';
import { renderPlanner } from '../components/planner/planner.js';
import { renderIncomeChips } from '../components/planner/incomeChips.js';
import { renderCalendar } from '../components/planner/calendar.js';

export function renderApp(state) {
    const timeframe = state.uiSettings.incomeTimeframe;
    const incomeSources = state.derived.incomeSources;

    renderTabs(state.activeTab);
    renderModeToggle(state.uiSettings);
    renderAppSettings(state.uiSettings);
    renderFab(state.lastPlayerTag);
    renderPlanner(state.planner);
    renderCalendar(state.planner);
    renderIncomeChips(parseInt(state.planner.calendar.month.split('-')[1], 10), parseInt(state.planner.calendar.month.split('-')[0], 10) - 1);

    renderHeroCards(state.heroes, state.uiSettings, state.planner);
    renderStorageInputs(state.storedOres);
    renderPlayerDropdown();

    renderStarBonusSelector(state.income.starBonusLeague);
    renderClanWarInputs(state.income.clanWar);
    renderCwlInputs(state.income.cwl);
    renderEventPassInputs(state.income.eventPass);
    
    renderRaidMedalTraderGrid(state.income.raidMedals);
    renderGemTraderGrid(state.income.gems);
    renderEventTraderGrid(state.income.eventTrader);
    renderShopOfferSelector(state.income.shopOffers);
    renderShopOfferGrid(state.income.shopOffers);

    renderRequiredOres(state.derived.requiredOres);
    renderRemainingTime(state.derived.remainingTime);

    const starBonusIncome = incomeSources.starBonus || {};
    renderStarBonusDisplay(starBonusIncome, state.income.starBonusLeague, state.playerData, timeframe);

    const clanWarIncome = incomeSources.clanWar || {};
    renderClanWarHomeDisplay(clanWarIncome[timeframe] || {}, state.income.clanWar, state.playerData);
    renderClanWarIncomeTabDisplay(clanWarIncome, state.income.clanWar);

    const cwlIncome = incomeSources.cwl || {};
    renderCwlHomeDisplay(cwlIncome[timeframe] || {}, state.income.cwl);
    renderCwlIncomeTabDisplay(cwlIncome, state.income.cwl);

    const raidMedalIncome = incomeSources.raidMedalTrader || {};
    renderRaidMedalTraderDisplay(raidMedalIncome, timeframe);

    const gemIncome = incomeSources.gemTrader || {};
    renderGemHomeDisplay(gemIncome, timeframe);

    const eventPassIncome = incomeSources.eventPass || {};
    renderEventPassHomeDisplay(eventPassIncome, timeframe, state.uiSettings);

    const eventTraderIncome = incomeSources.eventTrader || {};
    renderEventTraderHomeDisplay(eventTraderIncome, timeframe);

    const shopOfferIncome = incomeSources.shopOffers || {};
    renderShopOfferHomeDisplay(shopOfferIncome, timeframe, state.uiSettings);

    renderIncomeCard(state.uiSettings.incomeCardExpanded, state.derived.totalIncome, state.uiSettings, state.derived.totalMoneyCost);
}
