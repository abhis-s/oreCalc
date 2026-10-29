import { getAppSettingsDOMElements } from './appSettingsDom.js';
import { getEquipmentDOMElements } from './equipmentDom.js';
import { getIncomeDOMElements } from './incomeDom.js';
import { getNavigationDOMElements } from './navigationDom.js';
import { getPlannerDOMElements } from './plannerDom.js';
import { getPlayerDOMElements } from './playerDom.js';
import { populateOreContainer } from '../components/common/oreDisplayFactory.js';
import { populateTimeframeGrid } from '../components/common/timeframeGridFactory.js';

/**
 * Global cached DOM elements map.
 * @type {Record<string, any>}
 */
export const dom = {};

/**
 * Dynamically populates reusable ore displays and initializes global DOM element cache tree.
 */
export function initializeDOMElements() {
    populateOreContainer('orecalc-home-quantity-card', {
        type: 'value',
        idFormat: (oreType) => `home-result-quantity-${oreType}`
    });

    populateOreContainer('orecalc-home-time-card', {
        type: 'time',
        timeIdFormat: (oreType, unit) => `home-result-time-${oreType}-${unit}`,
        dateIdFormat: (oreType) => `home-result-date-${oreType}`
    });

    populateOreContainer('orecalc-equipment-results-card', {
        type: 'value',
        idFormat: (oreType) => `eq-${oreType}-ore-result`
    });

    populateOreContainer('orecalc-equipment-storage-card', {
        type: 'input',
        idFormat: (oreType) => `eq-${oreType}-ore-storage`
    });

    populateTimeframeGrid('orecalc-income-star-bonus-card', ['daily', 'monthly'], 'star-bonus');
    populateTimeframeGrid('orecalc-income-shop-offers-card', ['monthly'], 'shop-offers');
    populateTimeframeGrid('orecalc-income-raid-medal-card', ['weekly', 'monthly'], 'raid-medal');
    populateTimeframeGrid('orecalc-income-gem-card', ['weekly', 'monthly'], 'gem');
    populateTimeframeGrid('orecalc-income-event-pass-card', ['bimonthly', 'monthly'], 'event-pass');
    populateTimeframeGrid('orecalc-income-event-trader-card', ['bimonthly', 'monthly'], 'event-trader');
    populateTimeframeGrid('orecalc-income-clan-war-card', ['perWar', 'monthly'], 'clan-war');
    populateTimeframeGrid('orecalc-income-cwl-card', ['perHit', 'monthly'], 'cwl');
    populateTimeframeGrid('orecalc-income-supercell-events-card', ['perEvent', 'monthly'], 'supercell-events');
    populateTimeframeGrid('orecalc-income-prospector-card', ['daily', 'monthly'], 'prospector');

    const { drawer, tabs, fab } = getNavigationDOMElements();

    Object.assign(dom, {
        preloader: document.getElementById('preloader'),
        overlay: document.getElementById('overlay'),

        controls: {
            saveButton: document.getElementById('floating-save-btn'),
            resetDataButton: document.getElementById('reset-data-btn'),
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
