import { getIncomeDOMElements } from './incomeDom.js';
import { getEquipmentDOMElements } from './equipmentDom.js';
import { getPlayerDOMElements } from './playerDom.js';
import { getAppSettingsDOMElements } from './appSettingsDom.js';

export let dom = {};

export function initializeDOMElements() {
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

        tabs: {
            buttons: document.querySelectorAll('.tab-button, .nav-button'),
            contents: document.querySelectorAll('.tab-content'),
        },

        fab: {
            main: document.getElementById('main-fab'),
            menu: document.querySelector('.fab-menu'),
            pills: {
                refresh: document.getElementById('fab-refresh-pill'),
                saveData: document.getElementById('fab-save-data-pill'),
            },
        },

        player: getPlayerDOMElements(),
        equipment: getEquipmentDOMElements(),
        income: getIncomeDOMElements(),
        appSettings: getAppSettingsDOMElements(),
    });
}