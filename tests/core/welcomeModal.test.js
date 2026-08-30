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
    get length() {
        return this._classes.size;
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
        this.attributes = new Map();
        this.style = {};
        this.dataset = {};
        this.textContent = '';
        this.innerHTML = '';
        this.value = '';
        this.checked = false;
        this.disabled = false;
        this.scrollLeft = 0;
        this.clientWidth = 400;
        this.scrollWidth = 1200;
    }
    get className() {
        return this.classList.toString();
    }
    set className(val) {
        this._className = val;
        this.classList = new MockClassList(val);
    }
    setAttribute(name, val) { this.attributes.set(name, String(val)); }
    removeAttribute(name) { this.attributes.delete(name); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    hasAttribute(name) { return this.attributes.has(name); }
    appendChild(child) {
        if (child) {
            child.parentNode = this;
            this.children.push(child);
        }
        return child;
    }
    removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx !== -1) {
            this.children.splice(idx, 1);
            child.parentNode = null;
        }
        return child;
    }
    addEventListener() {}
    removeEventListener() {}
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
    scrollTo({ left }) {
        this.scrollLeft = left;
    }
}

const mockElements = new Map();
function getOrCreateMockElement(id, tagName = 'div', className = '') {
    if (!mockElements.has(id)) {
        const el = new MockDOMElement(tagName, id, className);
        mockElements.set(id, el);
    }
    return mockElements.get(id);
}

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
        location: { origin: 'https://orecalc.tech', pathname: '/' },
        __ENV__: { APP_VERSION: '2.1.0' }
    };
}

const { calculateEquipmentProgress } = await import('../../js/components/welcome/welcomeEquipmentProgress.js');

describe('Welcome Modal Comprehensive Feature Suite', () => {
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

    test('UI Fidelity & Contrast Invariants in welcome SCSS partials', () => {
        const carouselScssPath = path.join(projectRoot, 'css/components/welcome/_welcome-carousel.scss');
        const carouselScssContent = fs.readFileSync(carouselScssPath, 'utf8');
        const thBadgesScssPath = path.join(projectRoot, 'css/components/welcome/welcome-profiles/_welcome-th-badges.scss');
        const thBadgesScssContent = fs.readFileSync(thBadgesScssPath, 'utf8');
        const syncScssPath = path.join(projectRoot, 'css/components/welcome/_welcome-sync.scss');
        const syncScssContent = fs.readFileSync(syncScssPath, 'utf8');

        assert.match(thBadgesScssContent, /\.th-badge-img\s*\{[^}]*max-width:\s*32px;[^}]*max-height:\s*32px;/, 'Must constrain th-badge-img dimensions');
        assert.match(carouselScssContent, /\.welcome-dot,\s*\.welcome-wizard-dot\s*\{[^}]*background-color:\s*\$bg-surface-secondary;/, 'Must define semantic background for inactive dots');
        assert.match(carouselScssContent, /\.welcome-header-skip-btn\s*\{[^}]*background-color:\s*color-mix\(in srgb,\s*\$bg-surface-secondary\s+75%,\s*transparent\);/, 'Must use surface background');
        assert.match(syncScssContent, /\.sync-disabled-overlay\s*\{[^}]*border-radius:\s*inherit;/, 'Must use border-radius: inherit on overlay for rounded element clipping');
    });

    test('Welcome wizard step navigation and state transitions', async () => {
        const { getWizardState, resetWizardState, setWizardState, goToNextWizardStep, goToPrevWizardStep } = await import('../../js/components/welcome/welcomeWizardState.js');
        resetWizardState();
        setWizardState({ currentWizardStepIndex: 0, wizardSteps: [1, 2, 3], selectedTH: 16 });

        assert.equal(getWizardState().currentWizardStepIndex, 0);
        assert.equal(getWizardState().selectedTH, 16);

        goToNextWizardStep();
        assert.equal(getWizardState().currentWizardStepIndex, 1);

        goToPrevWizardStep();
        assert.equal(getWizardState().currentWizardStepIndex, 0);
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

    test('input feature popover uses fixed positioning and popover z-index token', () => {
        const popoverScssPath = path.join(projectRoot, 'css/components/cards/_cards-popovers.scss');
        const content = fs.readFileSync(popoverScssPath, 'utf8');

        assert.match(content, /\.input-feature-popover\s*\{[\s\S]*?position:\s*fixed;/, 'Must declare position: fixed');
        assert.match(content, /\.input-feature-popover\s*\{[\s\S]*?z-index:\s*\$z-index-popover;/, 'Must use $z-index-popover token');
    });

    test('Welcome modal and wizard bottom buttons ordering and non-mobile flex styling', () => {
        const welcomeHtmlPath = path.join(projectRoot, 'partials/modals/welcome-modal.html');
        const welcomeHtml = fs.readFileSync(welcomeHtmlPath, 'utf8');
        const wizardHtmlPath = path.join(projectRoot, 'partials/modals/welcome/setup-wizard-view.html');
        const wizardHtml = fs.readFileSync(wizardHtmlPath, 'utf8');
        const carouselScssPath = path.join(projectRoot, 'css/components/welcome/_welcome-carousel.scss');
        const carouselScss = fs.readFileSync(carouselScssPath, 'utf8');

        // Tab focus DOM order assertion
        const guestBtnIndex = welcomeHtml.indexOf('id="welcome-guest-btn"');
        const continueBtnIndex = welcomeHtml.indexOf('id="welcome-continue-btn"');
        const submitBtnIndex = welcomeHtml.indexOf('id="welcome-submit-btn"');
        const rejectBtnIndex = welcomeHtml.indexOf('id="welcome-sync-device-start-btn"');
        const backBtnIndex = welcomeHtml.indexOf('id="welcome-back-btn"');

        assert.ok(rejectBtnIndex !== -1 && backBtnIndex !== -1 && continueBtnIndex !== -1);
        assert.ok(continueBtnIndex < rejectBtnIndex);
        assert.ok(continueBtnIndex < backBtnIndex);
        assert.ok(guestBtnIndex < backBtnIndex);
        assert.ok(submitBtnIndex < backBtnIndex);

        // Wizard footer DOM sequence assertion
        const wizardNextIndex = welcomeHtml.indexOf('id="welcome-wizard-next-btn"');
        const wizardBackIndex = welcomeHtml.indexOf('id="welcome-wizard-back-btn"');
        assert.ok(wizardBackIndex !== -1 && wizardNextIndex !== -1);
        assert.ok(wizardNextIndex < wizardBackIndex);

        // SCSS flex layout, min-height token, and flex order assertions
        assert.match(carouselScss, /\.welcome-actions\s*\{[\s\S]*?flex-direction:\s*row;/, 'Must use flex-direction: row for non-mobile');
        assert.match(carouselScss, /(\.reject-button|\.btn-secondary)[\s\S]*?min-height:\s*44px;/, 'Must standardize min-height to 44px');
        assert.match(carouselScss, /(\.reject-button|\.btn-secondary)\s*\{[\s\S]*?order:\s*1;/, 'Reject/secondary button must have order: 1 (left)');
        assert.match(carouselScss, /(\.accept-button|\.btn-primary)\s*\{[\s\S]*?order:\s*2;/, 'Accept/primary button must have order: 2 (right)');

        // Viewport media query layout inversion
        assert.match(carouselScss, /@media\s*\(max-width:\s*\$breakpoint-modal\)\s*\{[\s\S]*?flex-direction:\s*column;[\s\S]*?(\.accept-button|\.btn-primary)[\s\S]*?order:\s*1;[\s\S]*?(\.reject-button|\.btn-secondary)[\s\S]*?order:\s*2;/, 'On narrow devices, accept button must be above reject button');
    });

    test('Welcome carousel visual index mapping converts correctly between 0-indexed and 1-indexed', async () => {
        const { getPageFromVisualIndex, getVisualIndexFromPage } = await import('../../js/components/welcome/welcomeCarouselDisplay.js');
        assert.equal(getPageFromVisualIndex(0), 1);
        assert.equal(getPageFromVisualIndex(1), 2);
        assert.equal(getVisualIndexFromPage(1), 0);
        assert.equal(getVisualIndexFromPage(2), 1);
    });

    test('welcome modal sync page blurs cloud sync and QR code for guest profiles', async () => {
        const { state } = await import('../../js/core/state.js');
        const { updateWelcomeSyncState } = await import('../../js/components/welcome/welcomeSyncDisplay.js');
        const { welcomeState } = await import('../../js/components/welcome/welcomeModalState.js');

        // DOM fixtures initialization
        const cloudSyncGuestOverlay = new MockDOMElement('div', 'welcome-cloud-sync-guest-overlay');
        const cloudSyncOverlayText = new MockDOMElement('span', 'welcome-cloud-sync-overlay-text');
        const qrGuestOverlay = new MockDOMElement('div', 'welcome-sync-qr-guest-overlay');
        const deviceSyncOverlay = new MockDOMElement('div', 'welcome-device-sync-overlay');
        const cloudSyncPref = new MockDOMElement('input', 'welcome-pref-cloud-sync');
        cloudSyncPref.type = 'checkbox';
        const linkDeviceDetails = new MockDOMElement('details', 'welcome-link-device-details');
        const yourSyncCodeDetails = new MockDOMElement('details', 'welcome-your-sync-code-details');
        yourSyncCodeDetails.open = true;
        const yourSyncCodeWrapper = new MockDOMElement('div', 'welcome-your-sync-code-wrapper');
        const deviceSyncSection = new MockDOMElement('div', '', 'group-content welcome-device-sync-section');

        globalThis.document.getElementById = (id) => {
            if (id === 'welcome-cloud-sync-guest-overlay') return cloudSyncGuestOverlay;
            if (id === 'welcome-cloud-sync-overlay-text') return cloudSyncOverlayText;
            if (id === 'welcome-sync-qr-guest-overlay') return qrGuestOverlay;
            if (id === 'welcome-your-sync-code-wrapper') return yourSyncCodeWrapper;
            if (id === 'welcome-device-sync-overlay') return deviceSyncOverlay;
            if (id === 'welcome-pref-cloud-sync') return cloudSyncPref;
            if (id === 'welcome-link-device-details') return linkDeviceDetails;
            if (id === 'welcome-your-sync-code-details') return yourSyncCodeDetails;
            return null;
        };
        globalThis.document.querySelector = (sel) => {
            if (sel === '.welcome-device-sync-section') return deviceSyncSection;
            return null;
        };

        // State partition: Guest profile fallback
        state.savedPlayerTags = ['DEFAULT0'];
        updateWelcomeSyncState();

        assert.equal(cloudSyncGuestOverlay.style.display, 'flex');
        assert.equal(cloudSyncOverlayText.getAttribute('data-i18n'), 'views.welcome.cloudSyncPlayerTagRequired');
        assert.equal(qrGuestOverlay.style.display, 'flex');
        assert.equal(yourSyncCodeWrapper.classList.contains('sync-disabled'), true);
        assert.equal(cloudSyncPref.disabled, true);
        assert.equal(cloudSyncPref.checked, false);
        assert.equal(deviceSyncOverlay.style.display, 'none');
        assert.equal(yourSyncCodeDetails.open, false);
        assert.equal(linkDeviceDetails.open, true);

        // State partition: Registered player profile
        state.savedPlayerTags = ['#2PP', 'DEFAULT0'];
        state.uiSettings = { cloudSync: true };
        updateWelcomeSyncState();

        assert.equal(cloudSyncGuestOverlay.style.display, 'none');
        assert.equal(qrGuestOverlay.style.display, 'none');
        assert.equal(yourSyncCodeWrapper.classList.contains('sync-disabled'), false);
        assert.equal(cloudSyncPref.disabled, false);
        assert.equal(cloudSyncPref.checked, true);
        assert.equal(deviceSyncOverlay.style.display, 'none');

        // State partition: Remote device linking entry
        welcomeState.cameFromSyncStartBtn = true;
        updateWelcomeSyncState();

        assert.equal(cloudSyncGuestOverlay.style.display, 'flex');
        assert.equal(cloudSyncOverlayText.getAttribute('data-i18n'), 'views.welcome.cloudSyncRequiredForDeviceLink');
        assert.equal(qrGuestOverlay.style.display, 'none');
        assert.equal(yourSyncCodeWrapper.classList.contains('sync-disabled'), false);
        assert.equal(cloudSyncPref.disabled, true);
        assert.equal(cloudSyncPref.checked, true);
        assert.equal(deviceSyncOverlay.style.display, 'none');
        assert.equal(linkDeviceDetails.open, true);

        welcomeState.cameFromSyncStartBtn = false;
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

    test('loadState automatically backfills onboardingTimestamp for existing globally-onboarded users', async () => {
        const { loadState } = await import('../../js/core/localStorageManager.js');
        const { EFFECTIVE_DATE_WELCOME } = await import('../../js/core/state.js');

        const mockStorage = new Map();
        mockStorage.set('oreCalc_playerTags', JSON.stringify(['#EXISTING1', '#EXISTING2']));
        mockStorage.set('oreCalc_appSettings', JSON.stringify({
            appVersion: '2.1.0',
            uiTimestamps: {
                welcome: EFFECTIVE_DATE_WELCOME + 100
            }
        }));
        mockStorage.set('oreCalc_player_#EXISTING1', JSON.stringify({
            heroes: {},
            storedOres: { shiny: 0, glowy: 0, starry: 0 }
        }));
        mockStorage.set('oreCalc_player_#EXISTING2', JSON.stringify({
            heroes: {},
            storedOres: { shiny: 100, glowy: 50, starry: 10 },
            onboardingTimestamp: EFFECTIVE_DATE_WELCOME + 200
        }));

        globalThis.localStorage = {
            getItem: (key) => mockStorage.get(key) || null,
            setItem: (key, val) => mockStorage.set(key, String(val)),
            removeItem: (key) => mockStorage.delete(key),
            clear: () => mockStorage.clear()
        };

        const state = loadState();
        assert.ok(state);
        assert.equal(state.allPlayersData['EXISTING1'].onboardingTimestamp, EFFECTIVE_DATE_WELCOME + 100);
        assert.equal(state.allPlayersData['EXISTING2'].onboardingTimestamp, EFFECTIVE_DATE_WELCOME + 200);
    });

    test('showWelcomeModal modular startPage and entrySource bypasses Page 1', async () => {
        const { showWelcomeModal } = await import('../../js/components/welcome/welcomeModalInputs.js');
        const { welcomeState } = await import('../../js/components/welcome/welcomeModalState.js');
        const { state } = await import('../../js/core/state.js');

        state.savedPlayerTags = [];
        state.allPlayersData = {};

        const modal = new MockDOMElement('dialog', 'welcome-modal');
        const carousel = new MockDOMElement('div', 'welcome-carousel');
        carousel.clientWidth = 500;
        const mainActions = new MockDOMElement('div', 'welcome-main-actions');
        const continueBtn = new MockDOMElement('button', 'welcome-continue-btn');
        const backBtn = new MockDOMElement('button', 'welcome-back-btn');
        const guestBtn = new MockDOMElement('button', 'welcome-guest-btn');
        const submitBtn = new MockDOMElement('button', 'welcome-submit-btn');
        const dotsContainer = new MockDOMElement('div', 'welcome-dots');

        const page1 = new MockDOMElement('div', 'welcome-page-1');
        const page2 = new MockDOMElement('div', 'welcome-page-2');
        const dot1 = new MockDOMElement('span', 'dot-1');
        dot1.setAttribute('data-page', '1');
        dotsContainer.children.push(dot1);
        dotsContainer.querySelector = (selector) => {
            if (selector.includes('data-page="1"')) return dot1;
            return null;
        };

        globalThis.document.getElementById = (id) => {
            if (id === 'welcome-modal') return modal;
            if (id === 'welcome-carousel') return carousel;
            if (id === 'welcome-main-actions') return mainActions;
            if (id === 'welcome-continue-btn') return continueBtn;
            if (id === 'welcome-back-btn') return backBtn;
            if (id === 'welcome-guest-btn') return guestBtn;
            if (id === 'welcome-submit-btn') return submitBtn;
            if (id === 'welcome-dots') return dotsContainer;
            if (id === 'welcome-page-1') return page1;
            if (id === 'welcome-page-2') return page2;
            return null;
        };

        showWelcomeModal(true, { startPage: 2, entrySource: 'playerModal' });

        assert.equal(welcomeState.currentPage, 2);
        assert.equal(welcomeState.entrySource, 'playerModal');
        assert.equal(carousel.scrollLeft, 500);
        assert.equal(backBtn.getAttribute('data-i18n'), 'views.welcome.cancelSetup');
        assert.equal(dot1.style.display, 'none');
        assert.ok(page1.hasAttribute('inert'));
        assert.ok(modal.classList.contains('show'));

        showWelcomeModal(false);
        assert.equal(welcomeState.entrySource, 'onboarding');
    });

    test('loadPlayerData preserves onboardingTimestamp and finishWizard stamps valid threshold timestamp', async () => {
        const { loadPlayerData } = await import('../../js/core/localStorageManager.js');
        const { state, isProfileOnboarded, EFFECTIVE_DATE_PROFILE_ONBOARDING } = await import('../../js/core/state.js');
        const { finishWizard, openSetupWizard } = await import('../../js/components/welcome/welcomeWizardState.js');

        state.savedPlayerTags = ['#TESTTAG1'];
        state.allPlayersData['#TESTTAG1'] = {
            heroes: {},
            storedOres: {},
            income: {},
            planner: {},
            playerProfile: { name: 'Tester', townHallLevel: 16 },
            onboardingTimestamp: EFFECTIVE_DATE_PROFILE_ONBOARDING + 1000
        };

        const loaded = loadPlayerData('#TESTTAG1');
        assert.ok(loaded);
        assert.equal(loaded.onboardingTimestamp, EFFECTIVE_DATE_PROFILE_ONBOARDING + 1000);
        assert.equal(isProfileOnboarded(loaded), true);

        openSetupWizard('#TESTTAG1');
        finishWizard(false, {});

        const updated = state.allPlayersData['#TESTTAG1'];
        assert.ok(typeof updated.onboardingTimestamp === 'number');
        assert.ok(updated.onboardingTimestamp >= EFFECTIVE_DATE_PROFILE_ONBOARDING);
        assert.equal(isProfileOnboarded(updated), true);
    });

    test('switchActivePlayer and state synchronization maintain onboardingTimestamp across active partition', async () => {
        const { switchActivePlayer } = await import('../../js/core/stateManager.js');
        const { state, EFFECTIVE_DATE_PROFILE_ONBOARDING } = await import('../../js/core/state.js');

        state.savedPlayerTags = ['#TESTTAG1', '#TESTTAG2'];
        state.allPlayersData['#TESTTAG1'] = {
            heroes: {},
            storedOres: {},
            income: {},
            planner: {},
            playerProfile: { name: 'Player 1', townHallLevel: 16 },
            onboardingTimestamp: EFFECTIVE_DATE_PROFILE_ONBOARDING + 5000
        };
        state.allPlayersData['#TESTTAG2'] = {
            heroes: {},
            storedOres: {},
            income: {},
            planner: {},
            playerProfile: { name: 'Player 2', townHallLevel: 15 },
            onboardingTimestamp: null
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

    test('applyChecklistToProfile auto-populates Clan War, CWL, and Raid Medal defaults', async () => {
        const { applyChecklistToProfile, resetWizardState } = await import('../../js/components/welcome/welcomeWizardState.js');
        const { welcomeState } = await import('../../js/components/welcome/welcomeModalState.js');
        const { getWarOreValue } = await import('../../js/data/incomeSources/warOres.js');

        resetWizardState();

        const playerObj = {
            playerProfile: { townHallLevel: 16 },
            income: {}
        };

        welcomeState.tempClanWars = true;
        welcomeState.tempCwl = true;
        welcomeState.tempRaidMedalsBuy = true;
        welcomeState.tempRaidMedalsStarry = 0;
        welcomeState.tempRaidMedalsGlowy = 0;
        welcomeState.tempRaidMedalsShiny = 0;

        applyChecklistToProfile(playerObj);

        // Clan Wars TH16 auto-ores
        assert.equal(playerObj.income.clanWar.oresPerAttack.shiny, getWarOreValue('shiny', 16));
        assert.equal(playerObj.income.clanWar.oresPerAttack.glowy, getWarOreValue('glowy', 16));
        assert.equal(playerObj.income.clanWar.oresPerAttack.starry, getWarOreValue('starry', 16));
        assert.equal(playerObj.income.clanWar.oresPerAttack.shiny, 1110);
        assert.equal(playerObj.income.clanWar.oresPerAttack.glowy, 39);
        assert.equal(playerObj.income.clanWar.oresPerAttack.starry, 6);

        // CWL TH16 auto-ores
        assert.equal(playerObj.income.cwl.oresPerAttack.shiny, getWarOreValue('shiny', 16));
        assert.equal(playerObj.income.cwl.oresPerAttack.glowy, getWarOreValue('glowy', 16));
        assert.equal(playerObj.income.cwl.oresPerAttack.starry, getWarOreValue('starry', 16));

        // Raid Medals default starry=2 and glowy=2
        assert.equal(playerObj.income.raidMedals.packs.starry, 2);
        assert.equal(playerObj.income.raidMedals.packs.glowy, 2);
        assert.equal(playerObj.income.raidMedals.packs.shiny, 0);
    });

    test('initializeGuestHeroesState sets default checked: true for heroes and equipment', async () => {
        const { initializeGuestHeroesState } = await import('../../js/components/welcome/welcomeGuestHeroState.js');

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
});
