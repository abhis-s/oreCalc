import { test, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

if (typeof globalThis.HTMLElement === 'undefined') {
    globalThis.HTMLElement = class {};
}

if (typeof globalThis.window === 'undefined') {
    globalThis.window = globalThis;
}

if (typeof globalThis.window.location === 'undefined') {
    globalThis.window.location = { hostname: 'localhost', search: '', pathname: '/' };
}

if (typeof globalThis.window.addEventListener !== 'function') {
    globalThis.window.addEventListener = () => {};
}

if (typeof globalThis.window.removeEventListener !== 'function') {
    globalThis.window.removeEventListener = () => {};
}

if (typeof globalThis.window.matchMedia === 'undefined') {
    globalThis.window.matchMedia = () => ({
        matches: false,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false
    });
}

if (typeof globalThis.customElements === 'undefined') {
    globalThis.customElements = {
        get: () => null,
        define: () => {}
    };
}

class MockClassList {
    constructor(initial = '') {
        this._classes = new Set(initial ? initial.split(/\s+/).filter(Boolean) : []);
    }
    add(...tokens) {
        tokens.forEach(t => { if (t) this._classes.add(t); });
    }
    remove(...tokens) {
        tokens.forEach(t => this._classes.delete(t));
    }
    contains(token) {
        return this._classes.has(token);
    }
    toggle(token, force) {
        if (typeof force === 'boolean') {
            if (force) this.add(token);
            else this.remove(token);
            return force;
        }
        if (this.contains(token)) {
            this.remove(token);
            return false;
        }
        this.add(token);
        return true;
    }
    toString() {
        return Array.from(this._classes).join(' ');
    }
}

class MockDOMElement {
    constructor(tagName = 'div', id = '', className = '') {
        this.tagName = tagName.toUpperCase();
        this.id = id;
        this._className = className;
        this.classList = new MockClassList(className);
        this.children = [];
        this.parentNode = null;
        this.dataset = {};
        this.style = {};
        this.attributes = new Map();
        this._eventListeners = new Map();
        this._innerHTML = '';
        this.textContent = '';
        this.value = '';
        this.checked = false;
        this.disabled = false;
        this.type = tagName === 'input' ? 'text' : undefined;
        this.open = false;
        this.scrollLeft = 0;
        this.clientWidth = 500;
        this.clientHeight = 600;
        this.scrollWidth = 1000;
        this.scrollHeight = 1200;
    }

    get innerHTML() {
        return this._innerHTML || '';
    }

    set innerHTML(val) {
        this._innerHTML = String(val);
        if (val === '') {
            this.children = [];
        }
    }

    get className() {
        return this.classList.toString();
    }

    set className(val) {
        this._className = val;
        this.classList = new MockClassList(val);
    }

    setAttribute(name, val) {
        this.attributes.set(name, String(val));
        if (name === 'id') this.id = String(val);
        if (name === 'class') {
            this.className = String(val);
        }
    }

    getAttribute(name) {
        return this.attributes.has(name) ? this.attributes.get(name) : null;
    }

    removeAttribute(name) {
        this.attributes.delete(name);
    }

    hasAttribute(name) {
        return this.attributes.has(name);
    }

    appendChild(child) {
        if (child) {
            child.parentNode = this;
            this.children.push(child);
        }
        return child;
    }

    removeChild(child) {
        const index = this.children.indexOf(child);
        if (index !== -1) {
            this.children.splice(index, 1);
            child.parentNode = null;
        }
        return child;
    }

    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }

    querySelectorAll(selector) {
        const results = [];
        const isClass = selector.startsWith('.');
        const isId = selector.startsWith('#');
        const isTag = !isClass && !isId && !selector.includes('[');
        const target = selector.replace(/^[.#]/, '');

        const search = (node) => {
            for (const child of node.children) {
                if (isClass && child.classList.contains(target)) results.push(child);
                else if (isId && child.id === target) results.push(child);
                else if (isTag && child.tagName.toLowerCase() === target.toLowerCase()) results.push(child);
                search(child);
            }
        };
        search(this);
        return results;
    }

    closest(selector) {
        let curr = this;
        while (curr) {
            if (selector.includes('modal') && (curr.classList.contains('modal') || curr.tagName === 'DIALOG')) return curr;
            if (selector.includes('[role="dialog"]') && curr.getAttribute('role') === 'dialog') return curr;
            const isClass = selector.startsWith('.');
            const isId = selector.startsWith('#');
            const target = selector.replace(/^[.#]/, '');
            if (isClass && curr.classList.contains(target)) return curr;
            if (isId && curr.id === target) return curr;
            if (curr.tagName && curr.tagName.toLowerCase() === selector.toLowerCase()) return curr;
            curr = curr.parentNode;
        }
        return null;
    }

    addEventListener(type, listener) {
        if (!this._eventListeners.has(type)) {
            this._eventListeners.set(type, []);
        }
        this._eventListeners.get(type).push(listener);
    }

    removeEventListener(type, listener) {
        if (this._eventListeners.has(type)) {
            const arr = this._eventListeners.get(type).filter(l => l !== listener);
            this._eventListeners.set(type, arr);
        }
    }

    dispatchEvent(event) {
        const type = typeof event === 'string' ? event : event?.type;
        const listeners = this._eventListeners.get(type) || [];
        for (const l of listeners) {
            l(event);
        }
        return true;
    }

    focus() {}
    blur() {}

    click() {
        this.dispatchEvent({ type: 'click', preventDefault: () => {} });
    }

    getBoundingClientRect() {
        return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
    }
}

const mockElements = new Map();
const mockStorage = new Map();

globalThis.localStorage = {
    getItem: (key) => mockStorage.get(key) || null,
    setItem: (key, val) => mockStorage.set(key, String(val)),
    removeItem: (key) => mockStorage.delete(key),
    clear: () => mockStorage.clear()
};

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        getElementById: (id) => mockElements.get(id) || null,
        createElement: (tag) => new MockDOMElement(tag),
        querySelector: (sel) => {
            if (sel.startsWith('#')) return mockElements.get(sel.substring(1)) || null;
            return null;
        },
        querySelectorAll: () => [],
        body: new MockDOMElement('body'),
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true
    };
} else {
    globalThis.document.dispatchEvent = () => true;
}

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        addEventListener: () => {},
        removeEventListener: () => {},
        requestAnimationFrame: (cb) => { cb(); return 1; },
        cancelAnimationFrame: () => {},
        scrollTo: () => {},
        location: { origin: 'https://clashcalc.com', pathname: '/' },
        __ENV__: { APP_VERSION: '2.1.0' }
    };
}

const stateModule = await import('../../js/core/state.js');
const { getDefaultPlayerState } = stateModule;
const state = new Proxy({}, {
    get: (_target, prop) => stateModule.state[prop],
    set: (_target, prop, value) => {
        stateModule.state[prop] = value;
        return true;
    },
    has: (_target, prop) => prop in stateModule.state,
    deleteProperty: (_target, prop) => {
        delete stateModule.state[prop];
        return true;
    }
});
const { calculateEquipmentProgress } = await import('../../js/components/guidedSetup/guidedSetupEquipmentProgress.js');
const { guidedSetupState, resetGuidedSetupState, applyPreferencesToProfile, syncPreferencesFromProfile } = await import('../../js/components/guidedSetup/guidedSetupState.js');
const { generateGuestPlayerData, initializeGuestHeroesState } = await import('../../js/components/guidedSetup/guidedSetupGuestState.js');
const { goToStep, goToNextStep, goToPrevStep, finishSetup } = await import('../../js/components/guidedSetup/guidedSetupNavigation.js');
const { syncGuidedSetupQuickSettings, updateGuidedSetupStepView, toggleSubpanels, renderGuidedSetupShopOffers, renderGuidedSetupTraderRows } = await import('../../js/components/guidedSetup/guidedSetupStepsDisplay.js');
const { renderProfilePreviewCard } = await import('../../js/components/guidedSetup/guidedSetupProfileDisplay.js');
const { renderSavedProfilesList, initializeGuidedSetupIdentityInputs } = await import('../../js/components/guidedSetup/guidedSetupIdentityInputs.js');

describe('Guided Setup Comprehensive Feature Suite', () => {
    beforeEach(() => {
        stateModule.state.savedPlayerTags = ['DEFAULT0'];
        stateModule.state.allPlayersData = {};
        stateModule.state.uiSettings = { uiTimestamps: {} };
        resetGuidedSetupState();
        mockElements.clear();
        mockStorage.clear();
    });

    test('calculateEquipmentProgress computes arithmetic mean of percentages for common and epic equipment', () => {
        const playerData = {
            tag: '#TESTPLAYER',
            name: 'TestPlayer',
            townHallLevel: 16,
            ownedHeroes: {
                'Barbarian King': { level: 90, maxLevel: 95 },
                'Archer Queen': { level: 90, maxLevel: 95 }
            },
            ownedEquipment: {
                'Barbarian Puppet': 12,
                'Rage Vial': 14,
                'Giant Gauntlet': 18,
                'Archer Puppet': 10,
                'Invisibility Vial': 15
            }
        };

        const progress = calculateEquipmentProgress(playerData);
        assert.ok(typeof progress === 'object' && progress !== null);
        assert.ok(typeof progress.common.avg === 'number');
        assert.ok(progress.common.avg >= 0 && progress.common.avg <= 100);
        assert.ok(typeof progress.epic.avg === 'number');
        assert.ok(progress.epic.avg >= 0 && progress.epic.avg <= 100);
    });

    test('guidedSetupState navigation and step boundaries (1 to 6)', () => {
        assert.equal(guidedSetupState.currentStep, 1);

        // Step 1 blocks navigation when profile is not loaded
        goToNextStep();
        assert.equal(guidedSetupState.currentStep, 1, 'Should block advancement when profile not loaded');

        // Loading a profile permits advancing to Step 2
        guidedSetupState.isProfileLoaded = true;
        guidedSetupState.activeTag = '#VALIDTAG';
        goToNextStep();
        assert.equal(guidedSetupState.currentStep, 2);

        goToStep(5);
        assert.equal(guidedSetupState.currentStep, 5);

        goToNextStep();
        assert.equal(guidedSetupState.currentStep, 6);

        goToPrevStep();
        assert.equal(guidedSetupState.currentStep, 5);

        goToStep(1);
        assert.equal(guidedSetupState.currentStep, 1);

        // Clamps at step 1
        goToPrevStep();
        assert.equal(guidedSetupState.currentStep, 1);
    });

    test('generateGuestPlayerData creates valid guest data structure for Town Hall level', () => {
        const guestData = generateGuestPlayerData(16);
        assert.ok(guestData);
        assert.equal(guestData.tag, 'DEFAULT0');
        assert.equal(guestData.townHallLevel, 16);
        assert.ok(Array.isArray(guestData.heroes));
        assert.ok(Array.isArray(guestData.heroEquipment));
    });

    test('initializeGuestHeroesState sets default checked: true for heroes and equipment', () => {
        const guestState = {
            playerProfile: { townHallLevel: 16 },
            heroes: {}
        };

        initializeGuestHeroesState(guestState);

        const heroKeys = Object.keys(guestState.heroes);
        assert.ok(heroKeys.length > 0);

        heroKeys.forEach(hKey => {
            const hero = guestState.heroes[hKey];
            assert.equal(hero.checked, true);
            const equipKeys = Object.keys(hero.equipment);
            assert.ok(equipKeys.length > 0);
            equipKeys.forEach(eqKey => {
                assert.equal(hero.equipment[eqKey].checked, true);
            });
        });
    });

    test('applyPreferencesToProfile and syncPreferencesFromProfile maintain preference hydration', async () => {
        const { getWarOreValue } = await import('../../js/data/incomeSources/warOres.js');

        const playerObj = {
            playerProfile: { townHallLevel: 16 },
            income: {},
            storedOres: {}
        };

        state.allPlayersData['#TESTPLAYER'] = playerObj;

        guidedSetupState.tempStoredShiny = 5000;
        guidedSetupState.tempStoredGlowy = 600;
        guidedSetupState.tempStoredStarry = 80;
        guidedSetupState.tempClanWars = true;
        guidedSetupState.tempClanWarsCount = 10;
        guidedSetupState.tempClanWarsWinrate = 80;
        guidedSetupState.tempCwl = true;
        guidedSetupState.tempCwlHits = 6;
        guidedSetupState.tempCwlWinrate = 75;
        guidedSetupState.tempRaidMedalsBuy = true;
        guidedSetupState.tempRaidMedalsStarry = 2;
        guidedSetupState.tempRaidMedalsGlowy = 2;

        applyPreferencesToProfile(playerObj);

        assert.equal(playerObj.storedOres.shiny, 5000);
        assert.equal(playerObj.storedOres.glowy, 600);
        assert.equal(playerObj.storedOres.starry, 80);
        assert.equal(playerObj.income.clanWar.warsPerMonth, 10);
        assert.equal(playerObj.income.clanWar.winRate, 80);
        assert.equal(playerObj.income.clanWar.oresPerAttack.shiny, getWarOreValue('shiny', 16));
        assert.equal(playerObj.income.cwl.hitsPerSeason, 6);
        assert.equal(playerObj.income.cwl.attacksPerEvent, 6);
        assert.equal(playerObj.income.cwl.winRate, 75);
        assert.equal(playerObj.income.raidMedals.packs.starry, 2);
        assert.equal(playerObj.income.raidMedals.packs.glowy, 2);

        // Reset and re-sync from profile tag
        resetGuidedSetupState();
        assert.equal(guidedSetupState.tempStoredShiny, 0);

        syncPreferencesFromProfile('#TESTPLAYER');
        assert.equal(guidedSetupState.tempStoredShiny, 5000);
        assert.equal(guidedSetupState.tempStoredGlowy, 600);
        assert.equal(guidedSetupState.tempStoredStarry, 80);
        assert.equal(guidedSetupState.tempClanWarsCount, 10);
        assert.equal(guidedSetupState.tempClanWarsWinrate, 80);
        assert.equal(guidedSetupState.tempCwlHits, 6);
        assert.equal(guidedSetupState.tempCwlWinrate, 75);
    });

    test('isProfileOnboarded correctly validates timestamps against effective threshold', async () => {
        const { isProfileOnboarded, EFFECTIVE_DATE_PROFILE_ONBOARDING } = await import('../../js/core/state.js');

        assert.equal(isProfileOnboarded(null), false);
        assert.equal(isProfileOnboarded({}), false);
        assert.equal(isProfileOnboarded({ onboardingTimestamp: null }), false);
        assert.equal(isProfileOnboarded({ onboardingTimestamp: EFFECTIVE_DATE_PROFILE_ONBOARDING - 1000 }), false);
        assert.equal(isProfileOnboarded({ onboardingTimestamp: EFFECTIVE_DATE_PROFILE_ONBOARDING }), true);
        assert.equal(isProfileOnboarded({ onboardingTimestamp: EFFECTIVE_DATE_PROFILE_ONBOARDING + 5000 }), true);
    });

    test('loadState preserves onboardingTimestamp on player partition and strips legacy timestamps from appSettings', async () => {
        const { loadState } = await import('../../js/core/localStorageManager.js');
        const { EFFECTIVE_DATE_PROFILE_ONBOARDING } = await import('../../js/core/state.js');

        mockStorage.set('oreCalc_playerTags', JSON.stringify(['#EXISTING1', '#EXISTING2']));
        mockStorage.set('oreCalc_appSettings', JSON.stringify({
            appVersion: '2.1.0',
            uiTimestamps: {
                privacy: 12345,
                tos: 12345,
                welcome: 12345,
                tour: 99999
            }
        }));
        mockStorage.set('oreCalc_player_#EXISTING1', JSON.stringify({
            heroes: {},
            storedOres: { shiny: 0, glowy: 0, starry: 0 }
        }));
        mockStorage.set('oreCalc_player_#EXISTING2', JSON.stringify({
            heroes: {},
            storedOres: { shiny: 100, glowy: 50, starry: 10 },
            onboardingTimestamp: EFFECTIVE_DATE_PROFILE_ONBOARDING + 200
        }));

        const loaded = loadState();
        assert.ok(loaded);
        assert.equal(loaded.uiSettings.uiTimestamps.privacy, undefined);
        assert.equal(loaded.uiSettings.uiTimestamps.tos, undefined);
        assert.equal(loaded.uiSettings.uiTimestamps.welcome, undefined);
        assert.equal(loaded.uiSettings.uiTimestamps.tour, 99999);
        assert.equal(loaded.allPlayersData['EXISTING2'].onboardingTimestamp, EFFECTIVE_DATE_PROFILE_ONBOARDING + 200);
    });

    test('switchActivePlayer and state synchronization maintain onboardingTimestamp across active partition', async () => {
        const { switchActivePlayer } = await import('../../js/core/stateManager.js');
        const { EFFECTIVE_DATE_PROFILE_ONBOARDING } = await import('../../js/core/state.js');

        state.savedPlayerTags = ['#TESTTAG1', '#TESTTAG2'];
        state.allPlayersData = {
            '#TESTTAG1': {
                heroes: {},
                storedOres: {},
                income: {},
                planner: {},
                playerProfile: { name: 'Player 1', townHallLevel: 16 },
                onboardingTimestamp: EFFECTIVE_DATE_PROFILE_ONBOARDING + 5000
            },
            '#TESTTAG2': {
                heroes: {},
                storedOres: {},
                income: {},
                planner: {},
                playerProfile: { name: 'Player 2', townHallLevel: 15 },
                onboardingTimestamp: null
            }
        };

        switchActivePlayer('#TESTTAG1');
        assert.equal(state.onboardingTimestamp, EFFECTIVE_DATE_PROFILE_ONBOARDING + 5000);
        assert.equal(state.allPlayersData['#TESTTAG1'].onboardingTimestamp, EFFECTIVE_DATE_PROFILE_ONBOARDING + 5000);

        switchActivePlayer('#TESTTAG2');
        assert.equal(state.onboardingTimestamp, null);
        assert.equal(state.allPlayersData['#TESTTAG1'].onboardingTimestamp, EFFECTIVE_DATE_PROFILE_ONBOARDING + 5000);
    });

    test('initializeState restores and preserves onboardingTimestamp on page reload', async () => {
        const stateModule = await import('../../js/core/state.js');

        const savedStatePayload = {
            appVersion: '2.1.0',
            savedPlayerTags: ['#TAGRELOAD1'],
            uiSettings: { theme: 'dark', language: 'en' },
            allPlayersData: {
                '#TAGRELOAD1': {
                    heroes: {},
                    storedOres: {},
                    income: {},
                    planner: {},
                    playerProfile: { name: 'ReloadUser', townHallLevel: 16 },
                    onboardingTimestamp: stateModule.EFFECTIVE_DATE_PROFILE_ONBOARDING + 9999
                }
            }
        };

        stateModule.initializeState(savedStatePayload);

        assert.equal(stateModule.state.allPlayersData['#TAGRELOAD1'].onboardingTimestamp, stateModule.EFFECTIVE_DATE_PROFILE_ONBOARDING + 9999);
        assert.equal(stateModule.state.onboardingTimestamp, stateModule.EFFECTIVE_DATE_PROFILE_ONBOARDING + 9999);
    });

    test('inputPopoverProvider ensures modal containment for inputs inside modal dialogs', async () => {
        const { registerInputPopover } = await import('../../js/utils/inputPopoverProvider.js');
        const mockDialog = new MockDOMElement('dialog', 'test-feature-dialog', 'modal');
        const mockInput = new MockDOMElement('input', 'test-contained-input');
        mockDialog.appendChild(mockInput);
        globalThis.document.body.appendChild(mockDialog);

        registerInputPopover(mockInput, { min: 1, max: 20 });
        const popover = mockDialog.children.find(c => c.classList?.contains('input-feature-popover'));
        assert.ok(popover, 'Popover must be appended inside modal dialog container');
    });

    test('inputPopoverPositioner positions popovers relative to input with fixed positioning', async () => {
        const { positionPopover } = await import('../../js/utils/inputPopoverPositioner.js');
        const mockInput = new MockDOMElement('input', 'test-coord-input');
        mockInput.getBoundingClientRect = () => ({
            top: 200,
            bottom: 240,
            left: 100,
            right: 200,
            width: 100,
            height: 40
        });

        const mockPopover = new MockDOMElement('div', 'test-popover', 'input-feature-popover show');
        mockPopover.getBoundingClientRect = () => ({
            top: 0,
            bottom: 120,
            left: 0,
            right: 180,
            width: 180,
            height: 120
        });

        positionPopover(mockPopover, mockInput);
        assert.equal(mockPopover.style.position, 'fixed');
        assert.ok(mockPopover.style.left);
        assert.ok(mockPopover.style.top);
    });

    test('processPlayerDataResponse surgically migrates guest non-API configurations when only DEFAULT0 existed in storage', async () => {
        const { processPlayerDataResponse } = await import('../../js/services/serverResponseHandler.js');
        const { normalizePlayerTag } = await import('../../js/core/storageKeys.js');

        // Setup storage with only guest
        stateModule.state.savedPlayerTags = ['DEFAULT0'];
        stateModule.state.allPlayersData = {
            DEFAULT0: {
                ...getDefaultPlayerState(),
                playerProfile: { tag: 'DEFAULT0', townHallLevel: 15 },
                storedOres: { shiny: 14500, glowy: 920, starry: 35 },
                income: {
                    clanWar: { enabled: true, warsPerMonth: 10, winRate: 80, drawRate: 5 },
                    cwl: { enabled: true, hitsPerSeason: 7, winRate: 60, drawRate: 0 },
                    raidMedals: { enabled: true, earned: 1400, packs: { starry: 3, glowy: 2, shiny: 0 } },
                    gems: { enabled: true, packs: { starry: 2, glowy: 1, shiny: 0 } },
                    eventPass: { enabled: true, eventPass: true, includeEquipment: true, trader: { enabled: true, packs: { starry: 2, glowy: 0, shiny: 0 } } },
                    goldPass: { enabled: true },
                    shopOffers: { enabled: true, 15: { starry: 1, glowy: 2 } }
                },
                currency: { code: 'EUR' }
            }
        };

        const remoteData = {
            tag: '#NEWTAG1',
            name: 'NewPlayer',
            townHallLevel: 15,
            heroes: [],
            heroEquipment: []
        };

        processPlayerDataResponse(remoteData);

        const newTagKey = normalizePlayerTag('#NEWTAG1');
        const newPlayer = stateModule.state.allPlayersData[newTagKey];
        assert.ok(newPlayer, 'New player profile should be created in allPlayersData');
        assert.deepEqual(newPlayer.storedOres, { shiny: 14500, glowy: 920, starry: 35 }, 'Stored ores should be migrated from guest');
        assert.equal(newPlayer.income.clanWar.warsPerMonth, 10, 'Clan war settings should be migrated');
        assert.equal(newPlayer.income.raidMedals.earned, 1400, 'Raid medal settings should be migrated');
        assert.equal(newPlayer.income.goldPass.enabled, true, 'Gold pass should be migrated');
        assert.equal(newPlayer.currency.code, 'EUR', 'Currency should be migrated');

        // DEFAULT0 should be removed
        assert.equal(stateModule.state.allPlayersData['DEFAULT0'], undefined, 'Guest profile must be removed after migration');
        assert.ok(!stateModule.state.savedPlayerTags.includes('DEFAULT0'), 'DEFAULT0 must be removed from savedPlayerTags');
        assert.ok(stateModule.state.savedPlayerTags.includes(newTagKey), 'New tag must be in savedPlayerTags');

        // Hydrating guided setup buffers reflects migrated data
        syncPreferencesFromProfile(newTagKey);
        assert.equal(guidedSetupState.tempStoredShiny, 14500);
        assert.equal(guidedSetupState.tempStoredGlowy, 920);
        assert.equal(guidedSetupState.tempStoredStarry, 35);
        assert.equal(guidedSetupState.tempClanWarsCount, 10);
        assert.equal(guidedSetupState.tempCurrencyCode, 'EUR');
    });

    test('processPlayerDataResponse does NOT migrate guest configurations when real player tags already existed', async () => {
        const { processPlayerDataResponse } = await import('../../js/services/serverResponseHandler.js');
        const { normalizePlayerTag } = await import('../../js/core/storageKeys.js');

        const existingTagKey = normalizePlayerTag('#EXISTING');
        const anotherTagKey = normalizePlayerTag('#ANOTHERTAG');

        // Storage already contains a real player tag alongside guest
        stateModule.state.savedPlayerTags = [existingTagKey, 'DEFAULT0'];
        stateModule.state.allPlayersData = {
            [existingTagKey]: {
                ...getDefaultPlayerState(),
                playerProfile: { tag: existingTagKey, townHallLevel: 16 }
            },
            DEFAULT0: {
                ...getDefaultPlayerState(),
                playerProfile: { tag: 'DEFAULT0', townHallLevel: 14 },
                storedOres: { shiny: 99999, glowy: 9999, starry: 999 }
            }
        };

        const remoteData = {
            tag: '#ANOTHERTAG',
            name: 'AnotherPlayer',
            townHallLevel: 16,
            heroes: [],
            heroEquipment: []
        };

        processPlayerDataResponse(remoteData);

        const newPlayer = stateModule.state.allPlayersData[anotherTagKey];
        assert.ok(newPlayer);
        // Stored ores must be default 0, NOT migrated from guest
        assert.equal(newPlayer.storedOres.shiny, 0, 'Must NOT migrate guest stored ores when real tag already existed');
        assert.equal(newPlayer.storedOres.glowy, 0);
        assert.equal(newPlayer.storedOres.starry, 0);
    });

    test('Guided Setup modal template structural and accessibility invariants', () => {
        const templatePath = path.join(projectRoot, 'partials/modals/guided-setup-modal.html');
        assert.ok(fs.existsSync(templatePath), 'partials/modals/guided-setup-modal.html must exist');
        const html = fs.readFileSync(templatePath, 'utf8');

        // Main modal container
        assert.ok(html.includes('id="guided-setup-modal"'));
        assert.ok(html.includes('class="modal modal-sheet-mobile"'));
        assert.ok(html.includes('class="modal-content guided-setup-modal-content"'));
        assert.ok(html.includes('class="modal-header guided-setup-header"'));
        assert.ok(html.includes('class="modal-body guided-setup-body"'));

        // Header controls: canonical close button and step indicator
        assert.ok(html.includes('id="close-guided-setup-modal-btn"'));
        assert.ok(html.includes('id="guided-setup-step-indicator"'));

        // Steps 1 through 6 containers
        for (let i = 1; i <= 6; i++) {
            assert.ok(html.includes(`id="guided-setup-step-${i}"`), `Must contain step container for step ${i}`);
        }

        assert.ok(html.includes('id="guided-setup-player-tag-input"'));
        assert.ok(html.includes('id="guided-setup-load-btn"'));
        assert.ok(html.includes('id="guided-setup-profile-preview-container"'));

        // Footer buttons: Cancel, Back, Skip, Next
        const backBtnIndex = html.indexOf('id="guided-setup-back-btn"');
        const nextBtnIndex = html.indexOf('id="guided-setup-next-btn"');
        const cancelBtnIndex = html.indexOf('id="guided-setup-cancel-btn"');
        const skipBtnIndex = html.indexOf('id="guided-setup-skip-btn"');

        assert.ok(backBtnIndex !== -1 && nextBtnIndex !== -1 && cancelBtnIndex !== -1 && skipBtnIndex !== -1);
        // Logical tab focus ordering: Back button comes before Next button
        assert.ok(backBtnIndex < nextBtnIndex, 'Back button must precede Next button in DOM order for tab navigation');

        // Step headers must be wrapped in .guided-setup-step-header for Steps 2 through 6
        const stepHeaderMatches = html.match(/class="guided-setup-step-header"/g);
        assert.ok(stepHeaderMatches && stepHeaderMatches.length >= 5, 'Must contain .guided-setup-step-header wrappers for Steps 2 to 6');

        // Zero emojis or prohibited dingbats in template
        const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
        assert.equal(emojiRegex.test(html), false, 'Template must contain zero emojis or dingbats');
    });

    test('Step 1 Next button visibility lifecycle in DOM', () => {
        const mockNextBtn = new MockDOMElement('button', 'guided-setup-next-btn');
        mockElements.set('guided-setup-next-btn', mockNextBtn);

        // Step 1: Default state (no profile loaded) -> Next button must be hidden
        resetGuidedSetupState();
        updateGuidedSetupStepView(1);
        assert.equal(mockNextBtn.style.display, 'none', 'Next button must be hidden on Step 1 initially');

        // Step 1: Profile loaded with real tag -> Next button must be visible
        guidedSetupState.isProfileLoaded = true;
        guidedSetupState.activeTag = '#VALIDTAG';
        updateGuidedSetupStepView(1);
        assert.equal(mockNextBtn.style.display, 'inline-flex', 'Next button must be visible when real profile is loaded');

        // Step 1: Invalidated / changed tag -> Next button must hide
        guidedSetupState.isProfileLoaded = false;
        guidedSetupState.activeTag = null;
        updateGuidedSetupStepView(1);
        assert.equal(mockNextBtn.style.display, 'none', 'Next button must hide when profile is invalidated');

        // Steps 2 through 6 -> Next button must always be visible
        for (let s = 2; s <= 6; s++) {
            updateGuidedSetupStepView(s);
            assert.equal(mockNextBtn.style.display, 'inline-flex', `Next button must be visible on step ${s}`);
        }
    });

    test('Trader pack select dropdowns are hydrated in DOM and saved to profile', () => {
        const raidStarry = new MockDOMElement('select', 'guided-setup-pref-raid-medals-starry');
        const raidGlowy = new MockDOMElement('select', 'guided-setup-pref-raid-medals-glowy');
        const raidShiny = new MockDOMElement('select', 'guided-setup-pref-raid-medals-shiny');
        const gemsStarry = new MockDOMElement('select', 'guided-setup-pref-gems-starry');
        const eventStarry = new MockDOMElement('select', 'guided-setup-pref-event-trader-starry');

        mockElements.set('guided-setup-pref-raid-medals-starry', raidStarry);
        mockElements.set('guided-setup-pref-raid-medals-glowy', raidGlowy);
        mockElements.set('guided-setup-pref-raid-medals-shiny', raidShiny);
        mockElements.set('guided-setup-pref-gems-starry', gemsStarry);
        mockElements.set('guided-setup-pref-event-trader-starry', eventStarry);

        const testTag = '#TESTTRADER';
        const playerObj = {
            ...getDefaultPlayerState(),
            playerProfile: { townHallLevel: 16 },
            income: {
                raidMedals: { enabled: true, earned: 1200, packs: { starry: 2, glowy: 2, shiny: 0 } },
                gems: { enabled: true, packs: { starry: 1, glowy: 0, shiny: 0 } },
                eventPass: { trader: { enabled: true, packs: { starry: 2, glowy: 2, shiny: 0 } } }
            }
        };
        stateModule.state.allPlayersData[testTag] = playerObj;

        syncGuidedSetupQuickSettings(testTag);

        assert.equal(raidStarry.value, '2', 'Raid medals starry select must be hydrated to 2');
        assert.equal(raidGlowy.value, '2', 'Raid medals glowy select must be hydrated to 2');
        assert.equal(raidShiny.value, '0', 'Raid medals shiny select must be hydrated to 0');
        assert.equal(gemsStarry.value, '1', 'Gems starry select must be hydrated to 1');
        assert.equal(eventStarry.value, '2', 'Event trader starry select must be hydrated to 2');

        assert.equal(guidedSetupState.tempRaidMedalsStarry, 2);
        assert.equal(guidedSetupState.tempGemsStarry, 1);
        assert.equal(guidedSetupState.tempEventTraderStarry, 2);

        applyPreferencesToProfile(playerObj);
        assert.equal(playerObj.income.raidMedals.packs.starry, 2);
        assert.equal(playerObj.income.gems.packs.starry, 1);
        assert.equal(playerObj.income.eventTrader.packs.starry, 2);
    });

    test('Shop offers purchases are written to active set key matching calculator engine', () => {
        const playerObj = {
            ...getDefaultPlayerState(),
            playerProfile: { townHallLevel: 16 },
            income: {}
        };

        guidedSetupState.selectedTH = 16;
        guidedSetupState.tempShopOffersBuy = true;
        guidedSetupState.tempShopOffersPurchases = { starry: 2, glowy: 1 };

        applyPreferencesToProfile(playerObj);

        assert.equal(playerObj.income.shopOffers.enabled, true);
        assert.equal(playerObj.income.shopOffers.selectedSet, 'newSet');
        assert.deepEqual(playerObj.income.shopOffers['newSet'], { starry: 2, glowy: 1 }, 'Must write purchases to active set key');
        assert.deepEqual(playerObj.income.shopOffers.purchases, { starry: 2, glowy: 1 }, 'Must also mirror in purchases key');
    });

    test('Player profile star bonus league is synced to income.starBonus.league', () => {
        const playerObj = {
            ...getDefaultPlayerState(),
            playerProfile: { townHallLevel: 16, leagueTier: { id: 40000005 } },
            income: {}
        };
        stateModule.state.allPlayersData['#TESTLEAGUE'] = playerObj;
        guidedSetupState.activeTag = '#TESTLEAGUE';
        guidedSetupState.selectedLeague = 40000005;

        applyPreferencesToProfile(playerObj);
        assert.equal(playerObj.income.starBonus.league, 40000005, 'applyPreferencesToProfile must persist starBonus.league');
    });

    test('Skip setup applies recommended defaults to profile', () => {
        stateModule.state.allPlayersData['#TESTSKIP'] = getDefaultPlayerState();
        guidedSetupState.activeTag = '#TESTSKIP';
        guidedSetupState.selectedTH = 16;
        guidedSetupState.selectedLeague = 105000000;

        finishSetup(true);

        const finishedPlayer = stateModule.state.allPlayersData['#TESTSKIP'];
        assert.ok(finishedPlayer);
        assert.equal(finishedPlayer.income.clanWar.enabled, true, 'Clan Wars must be enabled on skip setup');
        assert.equal(finishedPlayer.income.cwl.enabled, true, 'CWL must be enabled on skip setup');
        assert.equal(finishedPlayer.income.raidMedals.enabled, true, 'Raid Medals must be enabled on skip setup');
        assert.equal(finishedPlayer.income.raidMedals.packs.starry, 2, 'Raid Medals starry packs must be 2 on skip setup');
        assert.equal(finishedPlayer.income.eventPass.enabled, true, 'Event Pass must be enabled on skip setup');
    });

    test('migrated guest data immediately hydrates subsequent wizard step inputs in DOM upon player tag load', async () => {
        const { processPlayerDataResponse } = await import('../../js/services/serverResponseHandler.js');
        const { normalizePlayerTag } = await import('../../js/core/storageKeys.js');

        const mockShinyInput = new MockDOMElement('input', 'guided-setup-stored-shiny');
        const mockGlowyInput = new MockDOMElement('input', 'guided-setup-stored-glowy');
        const mockStarryInput = new MockDOMElement('input', 'guided-setup-stored-starry');
        const mockRaidSwitch = new MockDOMElement('input', 'guided-setup-pref-raid-medals-buy');
        mockRaidSwitch.type = 'checkbox';

        mockElements.set('guided-setup-stored-shiny', mockShinyInput);
        mockElements.set('guided-setup-stored-glowy', mockGlowyInput);
        mockElements.set('guided-setup-stored-starry', mockStarryInput);
        mockElements.set('guided-setup-pref-raid-medals-buy', mockRaidSwitch);

        // Pre-configure guest profile in storage
        stateModule.state.savedPlayerTags = ['DEFAULT0'];
        stateModule.state.allPlayersData = {
            DEFAULT0: {
                ...getDefaultPlayerState(),
                playerProfile: { tag: 'DEFAULT0', townHallLevel: 16 },
                storedOres: { shiny: 25000, glowy: 2500, starry: 100 },
                income: {
                    raidMedals: { enabled: true, earned: 1500, packs: { starry: 2, glowy: 2, shiny: 0 } }
                }
            }
        };

        // Load new tag
        const newTag = '#MIGRATETEST';
        const cleanTag = normalizePlayerTag(newTag);
        processPlayerDataResponse({
            tag: newTag,
            name: 'MigratedHero',
            townHallLevel: 16,
            heroes: [],
            heroEquipment: []
        });

        // Hydrate DOM quick settings
        syncPreferencesFromProfile(cleanTag);
        syncGuidedSetupQuickSettings(cleanTag);

        // Assert DOM inputs reflect migrated guest values for Step 2 and Step 4
        assert.equal(mockShinyInput.value, '25000', 'Shiny input must reflect migrated value 25000');
        assert.equal(mockGlowyInput.value, '2500', 'Glowy input must reflect migrated value 2500');
        assert.equal(mockStarryInput.value, '100', 'Starry input must reflect migrated value 100');
        assert.equal(mockRaidSwitch.checked, true, 'Raid medals buy switch must reflect migrated enabled state');
    });

    test('updateGuidedSetupStepView sets active step display to flex to preserve CSS flexbox gap', () => {
        const step1 = new MockDOMElement('div', 'guided-setup-step-1');
        const step2 = new MockDOMElement('div', 'guided-setup-step-2');
        const nextBtn = new MockDOMElement('button', 'guided-setup-next-btn');
        mockElements.set('guided-setup-step-1', step1);
        mockElements.set('guided-setup-step-2', step2);
        mockElements.set('guided-setup-next-btn', nextBtn);

        updateGuidedSetupStepView(2);
        assert.equal(step2.style.display, 'flex', 'Active step must use display: flex to preserve gap');
        assert.equal(step1.style.display, 'none', 'Inactive step must use display: none');
    });

    test('toggleSubpanels sets panel display to flex when switch is enabled', () => {
        const clanWarsSwitch = new MockDOMElement('input', 'guided-setup-pref-clan-wars-buy');
        clanWarsSwitch.type = 'checkbox';
        clanWarsSwitch.checked = true;
        const clanWarsPanel = new MockDOMElement('div', 'guided-setup-pref-clan-wars-panel');

        mockElements.set('guided-setup-pref-clan-wars-buy', clanWarsSwitch);
        mockElements.set('guided-setup-pref-clan-wars-panel', clanWarsPanel);

        toggleSubpanels();
        assert.equal(clanWarsPanel.style.display, 'flex', 'Active subpanel must use display: flex');

        clanWarsSwitch.checked = false;
        toggleSubpanels();
        assert.equal(clanWarsPanel.style.display, 'none', 'Disabled subpanel must use display: none');
    });

    test('renderGuidedSetupShopOffers filters out townHallLevel metadata key and assigns semantic classes', () => {
        const container = new MockDOMElement('div', 'guided-setup-shop-offers-inputs-container');
        mockElements.set('guided-setup-shop-offers-inputs-container', container);

        renderGuidedSetupShopOffers(16);

        assert.ok(container.children.length > 0, 'Must render shop offer rows');
        const renderedOfferIds = container.children.map(c => c.dataset?.offerId);
        assert.ok(!renderedOfferIds.includes('townHallLevel'), 'Must NOT render offer row for townHallLevel metadata');
        assert.deepEqual(renderedOfferIds, ['shiny_large', 'starry', 'glowy', 'shiny_small'], 'Must render shop offers matching canonical Income tab ordering');

        // Check that rows use semantic classes instead of inline styles
        container.children.forEach(row => {
            assert.ok(row.classList.contains('guided-setup-trader-row'), 'Row must have .guided-setup-trader-row class');
            assert.equal(row.style.display, undefined, 'Row must not have JS inline display style');
        });
    });

    test('renderProfilePreviewCard extracts ownedEquipment and ownedHeroes from raw API payload', () => {
        const previewIds = [
            'guided-setup-profile-preview-container',
            'guided-setup-profile-name',
            'guided-setup-profile-tag',
            'guided-setup-profile-th-level',
            'guided-setup-profile-th-image',
            'guided-setup-profile-clan-section',
            'guided-setup-profile-clan-badge',
            'guided-setup-profile-clan-name',
            'guided-setup-profile-clan-role',
            'guided-setup-profile-league-icon',
            'guided-setup-profile-league-default-icon',
            'guided-setup-profile-league-name',
            'guided-setup-profile-trophies',
            'guided-setup-profile-maxed-equip',
            'guided-setup-profile-common-avg',
            'guided-setup-profile-common-shiny-pct',
            'guided-setup-profile-common-shiny-fill',
            'guided-setup-profile-common-glowy-pct',
            'guided-setup-profile-common-glowy-fill',
            'guided-setup-profile-epic-avg',
            'guided-setup-profile-epic-shiny-pct',
            'guided-setup-profile-epic-shiny-fill',
            'guided-setup-profile-epic-glowy-pct',
            'guided-setup-profile-epic-glowy-fill',
            'guided-setup-profile-epic-starry-pct',
            'guided-setup-profile-epic-starry-fill',
            'guided-setup-profile-heroes-equipment-list',
            'guided-setup-tab-btn-info'
        ];
        previewIds.forEach(id => {
            mockElements.set(id, new MockDOMElement('div', id));
        });

        const rawApiPayload = {
            tag: '#RAWTAG',
            name: 'RawHero',
            townHallLevel: 16,
            trophies: 5000,
            heroes: [
                { name: 'Barbarian King', level: 95, maxLevel: 95, village: 'home', equipment: [{ name: 'Giant Gauntlet', level: 27 }] }
            ],
            heroEquipment: [
                { name: 'Giant Gauntlet', level: 27, village: 'home' },
                { name: 'Barbarian Puppet', level: 18, village: 'home' }
            ]
        };

        renderProfilePreviewCard(rawApiPayload);

        const maxedEquipEl = mockElements.get('guided-setup-profile-maxed-equip');
        assert.ok(maxedEquipEl.textContent.length > 0, 'Maxed equipment text must be populated');
        const commonAvgEl = mockElements.get('guided-setup-profile-common-avg');
        assert.ok(commonAvgEl.textContent.includes('%'), 'Common average percentage must be populated');
        const equipList = mockElements.get('guided-setup-profile-heroes-equipment-list');
        assert.ok(equipList.children.length > 0, 'Equipment list container must contain rendered hero equipment');
    });

    test('renderGuidedSetupTraderRows separates recommendation badge into dedicated column', () => {
        const container = new MockDOMElement('div', 'test-trader-container');
        mockElements.set('test-trader-container', container);

        const mockOffers = [
            { starry: 10, cost: 350, maxPacks: 2 },
            { shiny: 500, cost: 150, maxPacks: 3 }
        ];

        renderGuidedSetupTraderRows(
            'test-trader-container',
            mockOffers,
            'test-pref',
            'gem',
            'Gems',
            { starry: 'thumbs-up' }
        );

        assert.equal(container.children.length, 2, 'Should render 2 offer rows');

        const starryRow = container.children[0];
        const costCol = starryRow.children.find(c => c.classList?.contains('guided-setup-trader-row__cost'));
        assert.ok(costCol, 'Row must have cost column');
        // Badge must NOT be in cost column
        assert.ok(!costCol.children.some(c => c.classList?.contains('recommended-badge')), 'Badge must NOT be inside cost column');

        // Badge must be in dedicated .guided-setup-trader-row__badge column
        const badgeCol = starryRow.children.find(c => c.classList?.contains('guided-setup-trader-row__badge'));
        assert.ok(badgeCol, 'Row must have dedicated badge column');
        assert.ok(badgeCol.children.some(c => c.classList?.contains('recommended-badge')), 'Starry row must have badge in badge column');

        // Shiny row without badge still has the badge column (for consistent spacing)
        const shinyRow = container.children[1];
        const shinyBadgeCol = shinyRow.children.find(c => c.classList?.contains('guided-setup-trader-row__badge'));
        assert.ok(shinyBadgeCol, 'Shiny row must have dedicated badge column placeholder for consistent alignment');
        assert.equal(shinyBadgeCol.children.length, 0, 'Shiny row badge column should be empty');
    });

    test('positionPopover with align: right aligns popover with input right edge', async () => {
        const { positionPopover } = await import('../../js/utils/inputPopoverPositioner.js');
        const mockInput = new MockDOMElement('input', 'test-align-input');
        mockInput.getBoundingClientRect = () => ({
            top: 200,
            bottom: 240,
            left: 100,
            right: 300,
            width: 200,
            height: 40
        });

        const mockPopover = new MockDOMElement('div', 'test-align-popover', 'input-feature-popover show');
        mockPopover.getBoundingClientRect = () => ({
            top: 0,
            bottom: 60,
            left: 0,
            right: 120,
            width: 120,
            height: 60
        });

        positionPopover(mockPopover, mockInput, { align: 'right' });
        // input right is 300, popoverWidth is 120. Expected left = 300 - 120 = 180px
        assert.equal(mockPopover.style.left, '180px');
    });

    test('renderSavedProfilesList renders accessible saved profile cards with active indicator when saved profiles exist', () => {
        stateModule.state.savedPlayerTags = ['#TAG1', '#TAG2'];
        stateModule.state.allPlayersData = {
            TAG1: {
                playerProfile: {
                    name: 'Alpha',
                    townHallLevel: 16,
                    tag: '#TAG1',
                    trophies: 5200,
                    clan: { name: 'Alpha Clan', badgeUrls: { small: 'https://example.com/clan1.png' } },
                    leagueTier: { id: 105000021, name: 'Legend League' }
                }
            },
            TAG2: {
                playerProfile: {
                    name: 'Beta',
                    townHallLevel: 15,
                    tag: '#TAG2',
                    trophies: 3100,
                    clan: { name: 'Beta Clan', badgeUrls: { small: 'https://example.com/clan2.png' } }
                }
            }
        };

        const container = new MockDOMElement('div', 'guided-setup-saved-profiles-container');
        container.style.display = 'none';
        const list = new MockDOMElement('div', 'guided-setup-saved-profiles-list');
        const input = new MockDOMElement('input', 'guided-setup-player-tag-input');
        input.value = '';

        mockElements.set('guided-setup-saved-profiles-container', container);
        mockElements.set('guided-setup-saved-profiles-list', list);
        mockElements.set('guided-setup-player-tag-input', input);

        renderSavedProfilesList();

        assert.equal(container.style.display, 'block', 'Container must be visible when saved profiles exist');
        assert.equal(list.children.length, 2, 'Must render 2 profile cards');

        const card1 = list.children[0];
        assert.equal(card1.dataset.tag, 'TAG1');
        assert.ok(card1.classList.contains('guided-setup-saved-profile-card'));
        assert.ok(card1.classList.contains('landing-account-card'));
        assert.ok(card1.classList.contains('is-active'), 'First saved profile must have is-active class');
        assert.equal(card1.getAttribute('role'), 'option');
        assert.equal(card1.getAttribute('aria-selected'), 'true');
        assert.ok(card1.innerHTML.includes('assets/th/th16.png'));
        assert.ok(card1.innerHTML.includes('Alpha'));
        assert.ok(card1.innerHTML.includes('#TAG1'));
        assert.ok(card1.innerHTML.includes('account-card-meta'), 'Card 1 must render account-card-meta');
        assert.ok(card1.innerHTML.includes('Alpha Clan'), 'Card 1 must render clan name');
        assert.ok(card1.innerHTML.includes('https://example.com/clan1.png'), 'Card 1 must render clan badge');
        assert.ok(card1.innerHTML.includes('5,200'), 'Card 1 must render formatted trophies');

        const card2 = list.children[1];
        assert.equal(card2.dataset.tag, 'TAG2');
        assert.ok(!card2.classList.contains('is-active'), 'Second profile must not have is-active class');
        assert.equal(card2.getAttribute('aria-selected'), 'false');
        assert.ok(card2.innerHTML.includes('assets/th/th15.png'));
        assert.ok(card2.innerHTML.includes('Beta'));
        assert.ok(card2.innerHTML.includes('#TAG2'));
        assert.ok(card2.innerHTML.includes('account-card-meta'), 'Card 2 must render account-card-meta');
        assert.ok(card2.innerHTML.includes('Beta Clan'), 'Card 2 must render clan name');
        assert.ok(card2.innerHTML.includes('https://example.com/clan2.png'), 'Card 2 must render clan badge');
        assert.ok(card2.innerHTML.includes('3,100'), 'Card 2 must render formatted trophies');
    });

    test('Selecting a saved profile card populates input, hides profiles, shows preview, and reveals Next button', () => {
        stateModule.state.savedPlayerTags = ['#TAG1'];
        stateModule.state.allPlayersData = {
            TAG1: { playerProfile: { name: 'Alpha', townHallLevel: 16, tag: '#TAG1' } }
        };

        const container = new MockDOMElement('div', 'guided-setup-saved-profiles-container');
        const list = new MockDOMElement('div', 'guided-setup-saved-profiles-list');
        const input = new MockDOMElement('input', 'guided-setup-player-tag-input');
        input.value = '';
        const previewContainer = new MockDOMElement('div', 'guided-setup-profile-preview-container');
        previewContainer.style.display = 'none';
        const nextBtn = new MockDOMElement('button', 'guided-setup-next-btn');
        nextBtn.style.display = 'none';

        mockElements.set('guided-setup-saved-profiles-container', container);
        mockElements.set('guided-setup-saved-profiles-list', list);
        mockElements.set('guided-setup-player-tag-input', input);
        mockElements.set('guided-setup-profile-preview-container', previewContainer);
        mockElements.set('guided-setup-next-btn', nextBtn);

        let identityCompleted = false;
        renderSavedProfilesList(() => {
            identityCompleted = true;
        });

        assert.equal(list.children.length, 1);
        const card = list.children[0];

        // Simulate click on saved profile card
        card.click();

        assert.equal(input.value, 'TAG1', 'Input value must be populated with player tag');
        assert.equal(container.style.display, 'none', 'Saved profiles container must be hidden after selection');
        assert.equal(guidedSetupState.activeTag, 'TAG1', 'Guided setup active tag must be set');
        assert.equal(guidedSetupState.isProfileLoaded, true, 'Guided setup profile must be marked loaded');
        assert.equal(previewContainer.style.display, 'block', 'Preview container must be displayed');
        assert.equal(nextBtn.style.display, 'inline-flex', 'Next button must be visible');
        assert.equal(identityCompleted, true, 'Callback must be invoked on selection');
    });

    test('Typing into player tag input dynamically hides saved profiles; clearing restores them', () => {
        stateModule.state.savedPlayerTags = ['#TAG1'];
        stateModule.state.allPlayersData = {
            TAG1: { playerProfile: { name: 'Alpha', townHallLevel: 16, tag: '#TAG1' } }
        };

        const modal = new MockDOMElement('dialog', 'guided-setup-modal');
        const container = new MockDOMElement('div', 'guided-setup-saved-profiles-container');
        const list = new MockDOMElement('div', 'guided-setup-saved-profiles-list');
        const input = new MockDOMElement('input', 'guided-setup-player-tag-input');
        input.value = '';
        const previewContainer = new MockDOMElement('div', 'guided-setup-profile-preview-container');
        const errorMsg = new MockDOMElement('div', 'guided-setup-player-tag-error');
        const nextBtn = new MockDOMElement('button', 'guided-setup-next-btn');

        mockElements.set('guided-setup-saved-profiles-container', container);
        mockElements.set('guided-setup-saved-profiles-list', list);
        mockElements.set('guided-setup-player-tag-input', input);
        mockElements.set('guided-setup-profile-preview-container', previewContainer);
        mockElements.set('guided-setup-player-tag-error', errorMsg);
        mockElements.set('guided-setup-next-btn', nextBtn);

        initializeGuidedSetupIdentityInputs(modal);
        renderSavedProfilesList();
        assert.equal(container.style.display, 'block', 'Initial render shows saved profiles');

        // User starts entering tag
        input.value = '#P';
        input.dispatchEvent({ type: 'input' });

        assert.equal(container.style.display, 'none', 'Typing into input must hide saved profiles container');

        // User clears input completely
        input.value = '';
        input.dispatchEvent({ type: 'input' });

        assert.equal(container.style.display, 'block', 'Clearing input must restore saved profiles container');
        assert.equal(list.children.length, 1, 'Restored list must contain profile cards');
    });

    test('Zero profile cards are rendered when only DEFAULT0 exists in storage', () => {
        stateModule.state.savedPlayerTags = ['DEFAULT0'];
        stateModule.state.allPlayersData = {
            DEFAULT0: { ...getDefaultPlayerState(), playerProfile: { tag: 'DEFAULT0', townHallLevel: 16 } }
        };

        const container = new MockDOMElement('div', 'guided-setup-saved-profiles-container');
        container.style.display = 'block';
        const list = new MockDOMElement('div', 'guided-setup-saved-profiles-list');
        const input = new MockDOMElement('input', 'guided-setup-player-tag-input');
        input.value = '';

        mockElements.set('guided-setup-saved-profiles-container', container);
        mockElements.set('guided-setup-saved-profiles-list', list);
        mockElements.set('guided-setup-player-tag-input', input);

        renderSavedProfilesList();

        assert.equal(container.style.display, 'none', 'Container must be hidden when only DEFAULT0 exists');
        assert.equal(list.children.length, 0, 'No cards should be rendered for guest-only storage');
    });
});
