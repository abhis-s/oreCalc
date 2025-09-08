import { getNavigationDOMElements } from './navigationDom.js';
import { getPlayerDOMElements } from './playerDom.js';
import { getEquipmentDOMElements } from './equipmentDom.js';
import { getIncomeDOMElements } from './incomeDom.js';
import { getPlannerDOMElements } from './plannerDom.js';
import { getAppSettingsDOMElements } from './appSettingsDom.js';

export let dom = {};

export function initializeDOMElements() {
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