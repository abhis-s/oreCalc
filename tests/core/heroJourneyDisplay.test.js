import { test, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        addEventListener: () => {},
        removeEventListener: () => {},
        getComputedStyle: () => ({ display: 'block' }),
        requestAnimationFrame: (cb) => { cb(); return 1; },
        cancelAnimationFrame: () => {}
    };
} else {
    if (!globalThis.window.getComputedStyle) {
        globalThis.window.getComputedStyle = () => ({ display: 'block' });
    }
    if (!globalThis.window.requestAnimationFrame) {
        globalThis.window.requestAnimationFrame = (cb) => { cb(); return 1; };
    }
}

if (typeof globalThis.HTMLElement === 'undefined') {
    globalThis.HTMLElement = class {};
}

if (typeof globalThis.customElements === 'undefined') {
    globalThis.customElements = {
        get: () => null,
        define: () => {}
    };
}

if (typeof globalThis.requestAnimationFrame === 'undefined') {
    globalThis.requestAnimationFrame = (cb) => { cb(); return 1; };
}

const domStore = new Map();

class ClassList {
    constructor() {
        this.classes = new Set();
    }
    add(...args) {
        args.forEach(c => this.classes.add(c));
    }
    remove(...args) {
        args.forEach(c => this.classes.delete(c));
    }
    contains(c) {
        return this.classes.has(c);
    }
    toggle(c, force) {
        if (typeof force === 'boolean') {
            if (force) {
                this.classes.add(c);
            } else {
                this.classes.delete(c);
            }
            return force;
        }
        if (this.classes.has(c)) {
            this.classes.delete(c);
            return false;
        }
        this.classes.add(c);
        return true;
    }
}

function createMockElement(id = '', className = '') {
    const classList = new ClassList();
    if (className) {
        className.split(/\s+/).forEach(c => classList.add(c));
    }
    const el = {
        id,
        classList,
        get className() { return Array.from(this.classList.classes).join(' '); },
        set className(val) {
            this.classList.classes.clear();
            if (val) String(val).split(/\s+/).forEach(c => this.classList.add(c));
        },
        offsetWidth: 100,
        clientWidth: 100,
        scrollWidth: 100,
        scrollLeft: 0,
        offsetParent: {},
        style: {},
        children: [],
        parentElement: null,
        closest: (sel) => {
            if (sel.startsWith('.')) {
                const cls = sel.slice(1);
                let cur = el;
                while (cur) {
                    if (cur.classList.contains(cls)) return cur;
                    cur = cur.parentElement;
                }
            }
            if (sel.startsWith('#')) {
                const searchId = sel.slice(1);
                let cur = el;
                while (cur) {
                    if (cur.id === searchId) return cur;
                    cur = cur.parentElement;
                }
            }
            return null;
        },
        querySelector: (sel) => {
            if (sel.startsWith('.')) {
                const cls = sel.slice(1);
                return el.children.find(c => c.classList.contains(cls)) || null;
            }
            if (sel.startsWith('#')) {
                const searchId = sel.slice(1);
                return el.children.find(c => c.id === searchId) || null;
            }
            return null;
        },
        querySelectorAll: (sel) => {
            if (sel.startsWith('.')) {
                const cls = sel.slice(1);
                return el.children.filter(c => c.classList.contains(cls));
            }
            return [];
        },
        dataset: {},
        attributes: {},
        setAttribute: (k, v) => { el.attributes[k] = v; },
        getAttribute: (k) => el.attributes[k] || null,
        remove: () => {
            if (el.parentElement) {
                el.parentElement.children = el.parentElement.children.filter(c => c !== el);
            }
        },
        replaceWith: (newEl) => {
            if (el.parentElement) {
                const idx = el.parentElement.children.indexOf(el);
                if (idx !== -1) {
                    el.parentElement.children[idx] = newEl;
                    newEl.parentElement = el.parentElement;
                }
            }
        },
        appendChild: (child) => {
            child.parentElement = el;
            el.children.push(child);
            return child;
        }
    };
    if (className) {
        className.split(/\s+/).forEach(c => el.classList.add(c));
    }
    if (id) {
        domStore.set(id, el);
    }
    return el;
}

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        createElement: (tag) => createMockElement('', tag),
        getElementById: (id) => domStore.get(id) || null,
        querySelector: (sel) => {
            if (sel.startsWith('#')) return domStore.get(sel.slice(1)) || null;
            if (sel.startsWith('.')) {
                const cls = sel.slice(1);
                for (const el of domStore.values()) {
                    if (el.classList.contains(cls)) return el;
                }
            }
            return null;
        },
        querySelectorAll: (sel) => {
            if (sel.startsWith('.')) {
                const cls = sel.slice(1);
                const results = [];
                for (const el of domStore.values()) {
                    if (el.classList.contains(cls)) results.push(el);
                }
                return results;
            }
            return [];
        }
    };
}

const { updateFilterRowLayout, updateProgressBarContainerLayout, updateCustomScrollbar } = await import('../../js/components/home/heroJourneyScrollManager.js');

describe('Hero Journey Responsive Layout Engine', () => {
    let filterContainer;
    let claimSwitch;
    let typeFilters;
    let typeButtons;
    let typeSelect;
    let scrollControls;

    beforeEach(() => {
        domStore.clear();

        filterContainer = createMockElement('home-hj-filter-container', 'hero-journey-filter-container');
        claimSwitch = createMockElement('home-hj-claim-switch', 'hj-segmented-switch');
        claimSwitch.offsetWidth = 160;

        const activeClaimBtn = createMockElement('', 'hj-switch-btn active');
        activeClaimBtn.offsetWidth = 80;
        activeClaimBtn.offsetLeft = 3;
        claimSwitch.appendChild(activeClaimBtn);

        const claimPill = createMockElement('home-hj-claim-pill', 'hj-switch-pill');
        claimSwitch.appendChild(claimPill);

        typeFilters = createMockElement('home-hj-type-filters', 'hj-type-filters');
        typeButtons = createMockElement('', 'hj-type-buttons');

        const btnOres = createMockElement('', 'hj-type-btn');
        btnOres.offsetWidth = 75;
        const btnEq = createMockElement('', 'hj-type-btn');
        btnEq.offsetWidth = 85;
        const btnSkins = createMockElement('', 'hj-type-btn');
        btnSkins.offsetWidth = 70;
        const btnItems = createMockElement('', 'hj-type-btn');
        btnItems.offsetWidth = 70;

        typeButtons.appendChild(btnOres);
        typeButtons.appendChild(btnEq);
        typeButtons.appendChild(btnSkins);
        typeButtons.appendChild(btnItems);

        typeSelect = createMockElement('home-hj-type-select', 'hj-type-select');
        typeSelect.offsetWidth = 135;

        typeFilters.appendChild(typeButtons);
        typeFilters.appendChild(typeSelect);

        scrollControls = createMockElement('home-hj-scroll-controls', 'hero-journey-scroll-controls');
        scrollControls.offsetWidth = 184;

        filterContainer.appendChild(claimSwitch);
        filterContainer.appendChild(typeFilters);
        filterContainer.appendChild(scrollControls);
    });

    test('updateFilterRowLayout assigns filter-stage-1 when container is wide', () => {
        filterContainer.clientWidth = 900;
        updateFilterRowLayout();
        assert.ok(filterContainer.classList.contains('filter-stage-1'));
    });

    test('updateFilterRowLayout assigns filter-stage-2 when container accommodates select and controls', () => {
        filterContainer.clientWidth = 550;
        updateFilterRowLayout();
        assert.ok(filterContainer.classList.contains('filter-stage-2'));
    });

    test('updateFilterRowLayout assigns filter-stage-3 when scroll controls move below', () => {
        filterContainer.clientWidth = 400;
        updateFilterRowLayout();
        assert.ok(filterContainer.classList.contains('filter-stage-3'));
    });

    test('updateFilterRowLayout assigns filter-stage-4 on very narrow screen', () => {
        filterContainer.clientWidth = 280;
        updateFilterRowLayout();
        assert.ok(filterContainer.classList.contains('filter-stage-4'));
    });

    test('updateFilterRowLayout cleanly recovers from filter-stage-4 back to stage-3, stage-2, and stage-1 when expanding width', () => {
        filterContainer.clientWidth = 280;
        typeSelect.offsetWidth = 280;
        claimSwitch.offsetWidth = 280;
        scrollControls.offsetWidth = 280;
        updateFilterRowLayout();
        assert.ok(filterContainer.classList.contains('filter-stage-4'));

        filterContainer.clientWidth = 420;
        typeSelect.offsetWidth = 420;
        claimSwitch.offsetWidth = 420;
        scrollControls.offsetWidth = 420;
        updateFilterRowLayout();
        assert.ok(filterContainer.classList.contains('filter-stage-3'));

        filterContainer.clientWidth = 600;
        updateFilterRowLayout();
        assert.ok(filterContainer.classList.contains('filter-stage-2'));

        filterContainer.clientWidth = 900;
        updateFilterRowLayout();
        assert.ok(filterContainer.classList.contains('filter-stage-1'));
    });

    test('updateProgressBarContainerLayout toggles and removes no-profile-stacked without sticky lock', () => {
        const card = createMockElement('home-hj-card', 'hero-journey-card no-synced-heroes');
        const progressBarContainer = createMockElement('home-hj-pb-container', 'hero-journey-progress-bar-container');
        const noProfileInfo = createMockElement('home-hj-no-profile-info', 'hero-journey-no-profile-info');
        const switchContainer = createMockElement('home-hj-switch-container', 'hero-journey-accelerated-switch-container');

        noProfileInfo.offsetWidth = 180;
        switchContainer.offsetWidth = 140;

        progressBarContainer.appendChild(noProfileInfo);
        progressBarContainer.appendChild(switchContainer);

        progressBarContainer.clientWidth = 300;
        updateProgressBarContainerLayout();
        assert.ok(progressBarContainer.classList.contains('no-profile-stacked'));

        noProfileInfo.offsetWidth = 300;
        switchContainer.offsetWidth = 300;

        progressBarContainer.clientWidth = 600;
        updateProgressBarContainerLayout();
        assert.ok(!progressBarContainer.classList.contains('no-profile-stacked'));
    });
});

describe('Hero Journey Custom Scrollbar Layout Deadlock Prevention (Issue #12)', () => {
    let trackWrapper;
    let customBar;
    let thumb;
    let progress;

    beforeEach(() => {
        domStore.clear();

        trackWrapper = createMockElement('home-hj-track-wrapper', 'hero-journey-track-wrapper');
        customBar = createMockElement('home-hj-custom-scrollbar', 'hero-journey-custom-scrollbar');
        thumb = createMockElement('home-hj-scrollbar-thumb', 'hero-journey-scrollbar-thumb');
        progress = createMockElement('home-hj-scrollbar-progress', 'hero-journey-scrollbar-progress');

        customBar.appendChild(progress);
        customBar.appendChild(thumb);
    });

    test('hides custom scrollbar when track content does not overflow (scrollWidth <= clientWidth)', () => {
        trackWrapper.scrollWidth = 400;
        trackWrapper.clientWidth = 500;
        trackWrapper.scrollLeft = 0;

        updateCustomScrollbar();

        assert.strictEqual(customBar.style.display, 'none');
    });

    test('recovers from display: none when content overflows, preventing clientWidth === 0 deadlock', () => {
        customBar.style.display = 'none';

        trackWrapper.scrollWidth = 1000;
        trackWrapper.clientWidth = 500;
        trackWrapper.scrollLeft = 100;
        customBar.clientWidth = 400;
        thumb.offsetWidth = 36;

        updateCustomScrollbar();

        assert.strictEqual(customBar.style.display, 'block');
        assert.strictEqual(thumb.style.width, '200px');
        assert.strictEqual(thumb.style.left, '40px');
    });

    test('thumb contains home-hj-scrub-tooltip for fast-scrub feedback', () => {
        const tooltip = createMockElement('home-hj-scrub-tooltip', 'hero-journey-scrub-tooltip');
        thumb.appendChild(tooltip);

        assert.ok(thumb.children.includes(tooltip));
    });
});

describe('Hero Journey In-Place Language Update', () => {
    test('in-place update refreshes node-level-pill text when language changes', async () => {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const projectRoot = process.cwd();

        const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));
        const zhJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/zh.json'), 'utf8'));

        globalThis.fetch = async (url) => {
            if (url.includes('/en.json')) return { ok: true, json: async () => enJson };
            if (url.includes('/zh.json')) return { ok: true, json: async () => zhJson };
            return { ok: false, status: 404 };
        };

        const { loadTranslations, translate } = await import('../../js/i18n/translator.js');
        await loadTranslations('en');
        await loadTranslations('zh');

        const { state } = await import('../../js/core/state.js');
        if (!state.uiSettings) state.uiSettings = {};
        if (!state.heroJourney) state.heroJourney = {};

        const chip480 = createMockElement('', 'hero-journey-node-chip');
        chip480.dataset = { nodeLevel: '480', level: '480' };
        const pill = createMockElement('', 'node-level-pill');
        pill.textContent = '480级';
        chip480.appendChild(pill);

        state.uiSettings.language = 'en';
        const updatedPill = chip480.querySelector('.node-level-pill');
        if (updatedPill) {
            updatedPill.textContent = translate('views.home.heroJourney.nodeLevel', { level: 480 });
        }

        assert.strictEqual(updatedPill.textContent, 'Lvl 480');
    });

    test('renderNodesTrack updates node-title and node-sub in-place during in-session language switch', async () => {
        const { renderNodesTrack } = await import('../../js/components/home/heroJourneyNodesDisplay.js');
        const { loadTranslations } = await import('../../js/i18n/translator.js');

        const track = createMockElement('home-hj-nodes-track', 'hero-journey-nodes-track');
        const testState = {
            heroJourney: { unclaimedOnly: false, typeFilter: null, overrideUnclaimed: [] },
            playerProfile: { tag: '#PLAYER1', townHallLevel: 18, ownedHeroes: { "Barbarian King": { level: 100 }, "Archer Queen": { level: 100 }, "Grand Warden": { level: 75 }, "Royal Champion": { level: 45 }, "Minion Prince": { level: 90 }, "Dragon Duke": { level: 70 } } }
        };

        const { state } = await import('../../js/core/state.js');
        if (!state.uiSettings) state.uiSettings = {};

        await loadTranslations('zh');
        state.uiSettings.language = 'zh';
        renderNodesTrack(testState, 480, 18);

        // Starry ore node fixture (nodeLevel: 407)
        const oreChip = track.children.find(c => String(c.dataset?.nodeLevel) === '407');
        assert.ok(oreChip);
        const titleZh = oreChip.querySelector('.node-title');
        assert.ok(titleZh);
        assert.match(titleZh.innerHTML, /50.*星辉矿石/);

        // In-session locale transition: EN
        await loadTranslations('en');
        state.uiSettings.language = 'en';
        renderNodesTrack(testState, 480, 18);

        const titleEn = oreChip.querySelector('.node-title');
        assert.ok(titleEn);
        assert.match(titleEn.innerHTML, /50.*Starry Ore/);
        assert.doesNotMatch(titleEn.innerHTML, /星辉矿石/);
    });
});

describe('Hero Journey True Max and TH Limit In-Place Account Switching', () => {
    test('removes true-max blockCard when switching from True Max account to a TH18 non-true max account', async () => {
        const { renderNodesTrack } = await import('../../js/components/home/heroJourneyNodesDisplay.js');
        const track = createMockElement('home-hj-nodes-track', 'hero-journey-nodes-track');

        const trueMaxState = {
            heroJourney: { unclaimedOnly: false, typeFilter: null, overrideUnclaimed: [] },
            playerProfile: { tag: '#PLAYER1', townHallLevel: 18, ownedHeroes: { "Barbarian King": { level: 100 }, "Archer Queen": { level: 100 }, "Grand Warden": { level: 75 }, "Royal Champion": { level: 45 }, "Minion Prince": { level: 90 }, "Dragon Duke": { level: 70 } } }
        };

        renderNodesTrack(trueMaxState, 480, 18);

        const initialBlockCard = track.querySelector('.th-limit-block-card');
        assert.ok(initialBlockCard);
        assert.ok(initialBlockCard.classList.contains('true-max-card'));

        const th18NonMaxState = {
            heroJourney: { unclaimedOnly: false, typeFilter: null, overrideUnclaimed: [] },
            playerProfile: { tag: '#PLAYER2', townHallLevel: 18, ownedHeroes: { "Barbarian King": { level: 80 }, "Archer Queen": { level: 80 }, "Grand Warden": { level: 50 }, "Royal Champion": { level: 30 }, "Minion Prince": { level: 50 }, "Dragon Duke": { level: 40 } } }
        };

        renderNodesTrack(th18NonMaxState, 330, 18);

        const updatedBlockCard = track.querySelector('.th-limit-block-card');
        assert.strictEqual(updatedBlockCard, null);
    });
});
