import { renderAppSettings } from '../components/appSettings/appSettings.js';
import { renderClanWarIncomeTabDisplay } from '../components/income/clanWarDisplay.js';
import { renderClanWarInputs } from '../components/income/clanWarInputs.js';
import { renderCwlIncomeTabDisplay } from '../components/income/cwlDisplay.js';
import { renderCwlInputs } from '../components/income/cwlInputs.js';
import { renderEventPassIncomeTabDisplay } from '../components/income/eventPassDisplay.js';
import { renderEventPassInputs } from '../components/income/eventPassInputs.js';
import { renderEventTraderGrid } from '../components/income/eventTraderDisplay.js';
import { renderEventTraderIncomeTabDisplay } from '../components/income/eventTraderDisplay.js';
import { renderFab } from '../components/fab/fab.js';
import { renderGemIncomeTabDisplay } from '../components/income/gemTraderDisplay.js';
import { renderGemTraderGrid } from '../components/income/gemTraderDisplay.js';
import { renderHeroCards } from '../components/equipment/heroCardDisplay.js';
import { renderHomeIncomeTable } from '../components/home/homeTableRenderer.js';
import { renderHomeResourcesFooter } from '../components/home/homeResourcesRenderer.js';
import { renderHomeProfile } from '../components/home/homeProfileRenderer.js';
import { renderIncomeCard } from '../components/income/incomeCardHandler.js';
import { renderNavigation } from '../components/layout/navigationRenderer.js';
import { renderPlanner } from '../components/planner/planner.js';
import { renderPlayerDropdown } from '../components/player/playerDropdown.js';
import { renderPriorityListModal } from '../components/planner/priorityListModal.js';
import { renderProspector } from '../components/income/prospectorInputs.js';
import { renderProspectorIncomeDisplay } from '../components/income/prospectorDisplay.js';
import { renderRaidMedalTraderGrid, renderRaidMedalTraderDisplay } from '../components/income/raidMedalTraderDisplay.js';
import { renderRemainingTime } from '../components/equipment/remainingTimeDisplay.js';
import { renderRequiredOres } from '../components/equipment/requiredOresDisplay.js';
import { renderShopOfferIncomeTabDisplay } from '../components/income/shopOffersDisplay.js';
import { renderShopOfferSelector, renderShopOfferGrid } from '../components/income/shopOffersDisplay.js';
import { renderStarBonusControls } from '../components/income/starBonusInputs.js';
import { renderStarBonusDisplay } from '../components/income/starBonusDisplay.js';
import { renderStorageInputs } from '../components/equipment/storageInputs.js';
import { renderSupercellEventsDisplay } from '../components/income/supercellEventsDisplay.js';
import { renderSupercellEventsInputs } from '../components/income/supercellEventsInputs.js';
import { renderTabs } from '../components/layout/tabs.js';


export function renderApp(state) {
    const timeframe = state.uiSettings.incomeCard?.timeframe || 'monthly';
    const incomeSources = state.derived.incomeSources;
    const remainingTime = state.derived.remainingTime;


    renderTabs(state.activeTab);
    renderNavigation(state.activeTab);
    renderAppSettings(state.uiSettings);
    renderFab(state.savedPlayerTags[0]);
    renderPlanner(state.planner);
    renderPriorityListModal(state);

    renderHeroCards(state.heroes, state.uiSettings, state.planner);
    renderStorageInputs(state.storedOres);
    renderPlayerDropdown();

    renderStarBonusControls(state.income);
    renderClanWarInputs(state.income.clanWar);
    renderCwlInputs(state.income.cwl);
    renderEventPassInputs(state.income.eventPass);
    renderSupercellEventsInputs(state.income);
    renderRaidMedalTraderGrid(state.income.raidMedals);
    renderGemTraderGrid(state.income.gems);
    renderEventTraderGrid(state.income.eventTrader);
    renderShopOfferSelector(state.income.shopOffers);
    renderShopOfferGrid(state.income.shopOffers);
    renderProspector(state.income.prospector);

    renderRequiredOres(state.derived.requiredOres);
    renderRemainingTime(state.derived.remainingTime);

    renderHomeIncomeTable(state);
    renderHomeResourcesFooter(state);
    renderHomeProfile(state);

    const starBonusIncome = incomeSources.starBonus || {};
    renderStarBonusDisplay(starBonusIncome, state.income.starBonus?.league || 105000000, state.playerProfile, timeframe);

    const clanWarIncome = incomeSources.clanWar || {};
    renderClanWarIncomeTabDisplay(clanWarIncome, state.income.clanWar);

    const cwlIncome = incomeSources.cwl || {};
    renderCwlIncomeTabDisplay(cwlIncome, state.income.cwl);

    const supercellEventsIncome = incomeSources.supercellEvents || {};
    renderSupercellEventsDisplay(supercellEventsIncome, timeframe);

    const raidMedalIncome = incomeSources.raidMedalTrader || {};
    renderRaidMedalTraderDisplay(raidMedalIncome, timeframe);

    const gemIncome = incomeSources.gemTrader || {};
    renderGemIncomeTabDisplay(gemIncome);

    const eventPassIncome = incomeSources.eventPass || {};
    renderEventPassIncomeTabDisplay(eventPassIncome);

    const eventTraderIncome = incomeSources.eventTrader || {};
    renderEventTraderIncomeTabDisplay(eventTraderIncome);

    const shopOfferIncome = incomeSources.shopOffers || {};
    renderShopOfferIncomeTabDisplay(shopOfferIncome, state.uiSettings);

    const prospectorIncome = incomeSources.prospector || {};
    renderProspectorIncomeDisplay(prospectorIncome);

    renderIncomeCard(state.derived.totalIncome, state.uiSettings, state.derived.totalMoneyCost);
}
