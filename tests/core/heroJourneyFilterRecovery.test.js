import { test, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';

const computedStyles = new Map();

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        addEventListener: () => {},
        removeEventListener: () => {},
        getComputedStyle: (el) => computedStyles.get(el) || { display: 'block', paddingLeft: '0px', paddingRight: '0px' },
        requestAnimationFrame: (cb) => { cb(); return 1; },
        cancelAnimationFrame: () => {},
        innerWidth: 1024
    };
} else {
    const origGetComputedStyle = globalThis.window.getComputedStyle;
    globalThis.window.getComputedStyle = (el) => computedStyles.get(el) || (origGetComputedStyle ? origGetComputedStyle(el) : { display: 'block', paddingLeft: '0px', paddingRight: '0px' });
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

function createMockElement(id = '', initialClassName = '') {
    let _clientWidth = 100;
    const el = {
        id,
        classList: new ClassList(),
        get className() {
            return Array.from(this.classList.classes).join(' ');
        },
        set className(val) {
            this.classList = new ClassList();
            if (val) {
                val.split(/\s+/).forEach(c => this.classList.add(c));
            }
        },
        offsetWidth: 100,
        dataset: {},
        get clientWidth() {
            if (el.classList.contains('filter-stage-3') || el.classList.contains('filter-stage-4')) {
                return 0;
            }
            return _clientWidth;
        },
        set clientWidth(val) {
            _clientWidth = val;
        },
        offsetParent: {},
        style: {},
        children: [],
        parentElement: null,
        innerHTML: '',
        setAttribute: (name, val) => {
            el[name] = val;
        },
        getAttribute: (name) => el[name] || null,
        addEventListener: () => {},
        removeEventListener: () => {},
        remove: () => {
            if (el.parentElement) {
                el.parentElement.children = el.parentElement.children.filter(c => c !== el);
                el.parentElement = null;
            }
        },
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
        appendChild: (child) => {
            child.parentElement = el;
            el.children.push(child);
            return child;
        }
    };
    if (initialClassName) {
        el.className = initialClassName;
    }
    if (id) {
        domStore.set(id, el);
    }
    return el;
}

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        createElement: (tag) => createMockElement('', ''),
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
} else {
    if (!globalThis.document.createElement) {
        globalThis.document.createElement = (tag) => createMockElement('', '');
    }
}

const { updateFilterRowLayout } = await import('../../js/components/home/heroJourneyScrollManager.js');

const { renderNodesTrack } = await import('../../js/components/home/heroJourneyNodesDisplay.js');

describe('Hero Journey Filter Row Responsive Recovery Suite', () => {
    let card;
    let filterContainer;
    let claimSwitch;
    let typeFilters;
    let typeButtons;
    let typeSelect;
    let scrollControls;

    beforeEach(() => {
        domStore.clear();
        computedStyles.clear();

        card = createMockElement('home-hj-card', 'card full-width-card hero-journey-card');
        computedStyles.set(card, {
            display: 'block',
            paddingLeft: '16px',
            paddingRight: '16px'
        });

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

        card.appendChild(filterContainer);
    });

    test('measures available content width from card subtracting horizontal padding', () => {
        card.clientWidth = 932;
        updateFilterRowLayout();
        assert.ok(filterContainer.classList.contains('filter-stage-1'));
    });

    test('progressively narrows through all 4 filter stages as card width contracts', () => {
        card.clientWidth = 932;
        updateFilterRowLayout();
        assert.ok(filterContainer.classList.contains('filter-stage-1'));

        card.clientWidth = 582;
        updateFilterRowLayout();
        assert.ok(filterContainer.classList.contains('filter-stage-2'));

        card.clientWidth = 432;
        updateFilterRowLayout();
        assert.ok(filterContainer.classList.contains('filter-stage-3'));
        assert.strictEqual(filterContainer.clientWidth, 0);

        card.clientWidth = 312;
        typeSelect.offsetWidth = 280;
        claimSwitch.offsetWidth = 280;
        scrollControls.offsetWidth = 280;
        updateFilterRowLayout();
        assert.ok(filterContainer.classList.contains('filter-stage-4'));
        assert.strictEqual(filterContainer.clientWidth, 0);
    });

    test('seamlessly recovers from filter-stage-4 back up to stage-3, stage-2, and stage-1 despite display: contents collapsing filterContainer.clientWidth to 0', () => {
        card.clientWidth = 312;
        typeSelect.offsetWidth = 280;
        claimSwitch.offsetWidth = 280;
        scrollControls.offsetWidth = 280;
        updateFilterRowLayout();
        assert.ok(filterContainer.classList.contains('filter-stage-4'));
        assert.strictEqual(filterContainer.clientWidth, 0);

        card.clientWidth = 452;
        typeSelect.offsetWidth = 420;
        claimSwitch.offsetWidth = 420;
        scrollControls.offsetWidth = 420;
        updateFilterRowLayout();
        assert.ok(filterContainer.classList.contains('filter-stage-3'));
        assert.strictEqual(filterContainer.classList.contains('filter-stage-4'), false);

        card.clientWidth = 632;
        updateFilterRowLayout();
        assert.ok(filterContainer.classList.contains('filter-stage-2'));
        assert.strictEqual(filterContainer.classList.contains('filter-stage-3'), false);

        card.clientWidth = 932;
        updateFilterRowLayout();
        assert.ok(filterContainer.classList.contains('filter-stage-1'));
        assert.strictEqual(filterContainer.classList.contains('filter-stage-2'), false);
    });

    test('gracefully falls back when home-hj-card is not in the DOM', () => {
        domStore.delete('home-hj-card');
        card.parentElement = null;
        filterContainer.parentElement = null;
        filterContainer.clientWidth = 900;

        updateFilterRowLayout();
        assert.ok(filterContainer.classList.contains('filter-stage-1'));
    });
});

describe('Hero Journey Track Empty Filter State', () => {
    test('renders .hero-journey-empty-filter-card with reset button when no nodes match filters', () => {
        const track = createMockElement('home-hj-nodes-track', 'hero-journey-track');
        const state = {
            playerProfile: {
                tag: '#PLAYER',
                ownedHeroes: { bk: true }
            },
            savedPlayerTags: ['#PLAYER'],
            heroJourney: {
                unclaimedOnly: true,
                typeFilter: 'skins',
                revealBeyondTH: false
            },
            heroes: {
                barbarianKing: { level: 95 }
            }
        };

        renderNodesTrack(state, 400, 16);

        const emptyCard = track.children.find(c => c.classList.contains('hero-journey-empty-filter-card'));
        assert.ok(emptyCard);
        assert.ok(emptyCard.innerHTML.includes('empty-filter-title'));
        assert.ok(emptyCard.innerHTML.includes('empty-filter-desc'));
        assert.ok(emptyCard.innerHTML.includes('id="home-hj-reset-filters-btn"'));
    });
});
