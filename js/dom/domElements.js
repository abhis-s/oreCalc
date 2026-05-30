import { getNavigationDOMElements } from './navigationDom.js';
import { getPlayerDOMElements } from './playerDom.js';
import { getEquipmentDOMElements } from './equipmentDom.js';
import { getIncomeDOMElements } from './incomeDom.js';
import { getPlannerDOMElements } from './plannerDom.js';
import { getAppSettingsDOMElements } from './appSettingsDom.js';
import { populateOreContainer } from '../components/common/oreDisplayFactory.js';
import { populateTimeframeGrid } from '../components/common/timeframeGridFactory.js';

export let dom = {};

export function initializeDOMElements() {
    populateOreContainer('home-result-quantity-card', {
        type: 'value',
        idFormat: (oreType) => `home-result-quantity-${oreType}`
    });
    
    populateOreContainer('home-result-time-card', {
        type: 'time',
        timeIdFormat: (oreType, unit) => `home-result-time-${oreType}-${unit}`,
        dateIdFormat: (oreType) => `home-result-date-${oreType}`
    });

    populateOreContainer('eq-results-container-card', {
        type: 'value',
        idFormat: (oreType) => `eq-${oreType}-ore-result`
    });

    populateOreContainer('eq-storage-container-card', {
        type: 'input',
        idFormat: (oreType) => `eq-${oreType}-ore-storage`
    });

    populateTimeframeGrid('inc-star-bonus-card', ['daily', 'monthly'], 'star-bonus');
    populateTimeframeGrid('inc-shop-offers-card', ['monthly'], 'shop-offers');
    populateTimeframeGrid('inc-raid-medal-trader-card', ['weekly', 'monthly'], 'raid-medal');
    populateTimeframeGrid('inc-gem-trader-card', ['weekly', 'monthly'], 'gem');
    populateTimeframeGrid('inc-event-pass-card', ['bimonthly', 'monthly'], 'event-pass');
    populateTimeframeGrid('inc-event-trader-card', ['bimonthly', 'monthly'], 'event-trader');
    populateTimeframeGrid('inc-clan-war-card', ['perWar', 'monthly'], 'clan-war');
    populateTimeframeGrid('inc-cwl-card', ['perHit', 'monthly'], 'cwl');
    populateTimeframeGrid('inc-supercell-events-card', ['perEvent', 'monthly'], 'supercell-events');
    populateTimeframeGrid('inc-prospector-card', ['daily', 'monthly'], 'prospector');

    const { drawer, tabs, fab } = getNavigationDOMElements();

    Object.assign(dom, {
        preloader: document.getElementById('preloader'),
        overlay: document.getElementById('overlay'),

        controls: {
            saveButton: document.getElementById('floating-save-btn'),
            resetDataButton: document.getElementById('reset-data-btn'),
            refreshButton: document.getElementById('refresh-button'),
        },

        header: {
            container: document.querySelector('.header-container'),
            placeholder: document.querySelector('.header-placeholder'),
        },

        drawer: drawer,
        tabs: tabs,
        fab: fab,

        player: getPlayerDOMElements(),
        equipment: getEquipmentDOMElements(),
        income: getIncomeDOMElements(),
        planner: getPlannerDOMElements(),
        appSettings: getAppSettingsDOMElements(),
    });
}