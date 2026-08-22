import { test, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));

let nextRafId = 1;
const rafCallbacks = new Map();

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        innerWidth: 1024,
        innerHeight: 768,
        addEventListener: () => {},
        removeEventListener: () => {},
        getComputedStyle: () => ({ display: 'block', getPropertyValue: () => '' }),
        requestAnimationFrame: (cb) => {
            const id = nextRafId++;
            rafCallbacks.set(id, cb);
            cb(performance.now() + 1000);
            return id;
        },
        cancelAnimationFrame: (id) => {
            rafCallbacks.delete(id);
        },
        matchMedia: () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} })
    };
} else {
    if (!globalThis.window.getComputedStyle) {
        globalThis.window.getComputedStyle = () => ({ display: 'block', getPropertyValue: () => '' });
    }
    if (!globalThis.window.requestAnimationFrame) {
        globalThis.window.requestAnimationFrame = (cb) => {
            const id = nextRafId++;
            rafCallbacks.set(id, cb);
            cb(performance.now() + 1000);
            return id;
        };
    }
    if (!globalThis.window.cancelAnimationFrame) {
        globalThis.window.cancelAnimationFrame = (id) => {
            rafCallbacks.delete(id);
        };
    }
    if (!globalThis.window.matchMedia) {
        globalThis.window.matchMedia = () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} });
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
    globalThis.requestAnimationFrame = globalThis.window.requestAnimationFrame;
}

if (typeof globalThis.cancelAnimationFrame === 'undefined') {
    globalThis.cancelAnimationFrame = globalThis.window.cancelAnimationFrame;
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

const domStore = new Map();

class MockDOMElement {
    constructor(tagName = 'div', id = '', className = '') {
        this.tagName = tagName.toUpperCase();
        this.id = id;
        this._className = className;
        this.classList = new MockClassList(className);
        this.children = [];
        this.parentNode = null;
        this.parentElement = null;
        this.attributes = new Map();
        this.style = {};
        this.dataset = {};
        this._innerHTML = '';
        this._textContent = '';
        this.disabled = false;
        this.title = '';
        this.isConnected = true;

        if (id) {
            domStore.set(id, this);
        }
    }

    get className() {
        return this.classList.toString();
    }

    set className(val) {
        this._className = val || '';
        this.classList = new MockClassList(val);
    }

    get innerHTML() {
        return this._innerHTML;
    }

    set innerHTML(val) {
        this._innerHTML = String(val || '');
        this.children = [];
        if (this._innerHTML) {
            this._parseHTMLToChildren(this._innerHTML);
            this._textContent = this._innerHTML.replace(/<[^>]+>/g, '');
        } else {
            this._textContent = '';
        }
    }

    get textContent() {
        return this._textContent;
    }

    set textContent(val) {
        this._textContent = String(val || '');
        this._innerHTML = this._textContent;
        this.children = [];
    }

    _parseHTMLToChildren(html) {
        const tagRegex = /<([a-zA-Z0-9-]+)([^>]*)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9-]+)([^>]*)\/?>/g;
        let match;
        while ((match = tagRegex.exec(html)) !== null) {
            const tagName = match[1] || match[4];
            const attrString = match[2] || match[5] || '';
            const innerContent = match[3] || '';

            const child = new MockDOMElement(tagName);

            const classMatch = attrString.match(/class="([^"]+)"/);
            if (classMatch) {
                child.className = classMatch[1];
            }

            const idMatch = attrString.match(/id="([^"]+)"/);
            if (idMatch) {
                child.id = idMatch[1];
            }

            const dataRegex = /data-([a-zA-Z0-9_-]+)="([^"]+)"/g;
            let dataMatch;
            while ((dataMatch = dataRegex.exec(attrString)) !== null) {
                const key = dataMatch[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
                child.dataset[key] = dataMatch[2];
                child.setAttribute(`data-${dataMatch[1]}`, dataMatch[2]);
            }

            const genericAttrRegex = /([a-zA-Z0-9_-]+)="([^"]+)"/g;
            let genMatch;
            while ((genMatch = genericAttrRegex.exec(attrString)) !== null) {
                child.setAttribute(genMatch[1], genMatch[2]);
            }

            if (innerContent) {
                child.innerHTML = innerContent;
            }

            this.appendChild(child);
        }
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
        if (name.startsWith('data-')) {
            const camelKey = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            this.dataset[camelKey] = String(value);
        }
    }

    getAttribute(name) {
        return this.attributes.has(name) ? this.attributes.get(name) : null;
    }

    removeAttribute(name) {
        this.attributes.delete(name);
        if (name.startsWith('data-')) {
            const camelKey = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            delete this.dataset[camelKey];
        }
    }

    hasAttribute(name) {
        return this.attributes.has(name);
    }

    appendChild(child) {
        if (child) {
            child.parentNode = this;
            child.parentElement = this;
            child.isConnected = true;
            this.children.push(child);
        }
        return child;
    }

    removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx !== -1) {
            this.children.splice(idx, 1);
            child.parentElement = null;
            child.parentNode = null;
            child.isConnected = false;
        }
        return child;
    }

    remove() {
        if (this.parentElement) {
            this.parentElement.removeChild(this);
        }
    }

    contains(node) {
        if (node === this) return true;
        for (const child of this.children) {
            if (child === node || (child.contains && child.contains(node))) {
                return true;
            }
        }
        return false;
    }

    closest(selector) {
        if (!selector) return null;
        if (selector.startsWith('.')) {
            const cls = selector.slice(1);
            let cur = this;
            while (cur) {
                if (cur.classList && cur.classList.contains(cls)) return cur;
                cur = cur.parentElement || cur.parentNode;
            }
        }
        if (selector.startsWith('#')) {
            const searchId = selector.slice(1);
            let cur = this;
            while (cur) {
                if (cur.id === searchId) return cur;
                cur = cur.parentElement || cur.parentNode;
            }
        }
        return null;
    }

    querySelector(selector) {
        if (!selector) return null;
        if (selector.startsWith('#')) {
            const searchId = selector.slice(1);
            return domStore.get(searchId) || this._findChild(el => el.id === searchId);
        }

        const classAttrMatch = selector.match(/^\.([a-zA-Z0-9_-]+)\[([a-zA-Z0-9_-]+)="([^"]+)"\]$/);
        if (classAttrMatch) {
            const [, cls, attr, val] = classAttrMatch;
            const dataKey = attr.startsWith('data-') ? attr.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()) : null;
            return this._findChild(el => {
                const matchesClass = el.classList && el.classList.contains(cls);
                const matchesAttr = (dataKey && el.dataset[dataKey] === val) || el.getAttribute(attr) === val;
                return matchesClass && matchesAttr;
            });
        }

        if (selector.startsWith('.')) {
            const cls = selector.slice(1);
            return this._findChild(el => el.classList && el.classList.contains(cls));
        }

        const tag = selector.toUpperCase();
        return this._findChild(el => el.tagName === tag);
    }

    querySelectorAll(selector) {
        const results = [];
        if (!selector) return results;

        if (selector.startsWith('#')) {
            const searchId = selector.slice(1);
            const found = domStore.get(searchId) || this._findChild(el => el.id === searchId);
            if (found) results.push(found);
            return results;
        }

        const notMatch = selector.match(/^\.([a-zA-Z0-9_-]+):not\(\.([a-zA-Z0-9_-]+)\)$/);
        if (notMatch) {
            const [, incCls, excCls] = notMatch;
            this._collectChildren(el => el.classList && el.classList.contains(incCls) && !el.classList.contains(excCls), results);
            return results;
        }

        const classAttrMatch = selector.match(/^\.([a-zA-Z0-9_-]+)\[([a-zA-Z0-9_-]+)="([^"]+)"\]$/);
        if (classAttrMatch) {
            const [, cls, attr, val] = classAttrMatch;
            const dataKey = attr.startsWith('data-') ? attr.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()) : null;
            this._collectChildren(el => {
                const matchesClass = el.classList && el.classList.contains(cls);
                const matchesAttr = (dataKey && el.dataset[dataKey] === val) || el.getAttribute(attr) === val;
                return matchesClass && matchesAttr;
            }, results);
            return results;
        }

        if (selector.startsWith('.')) {
            const cls = selector.slice(1);
            this._collectChildren(el => el.classList && el.classList.contains(cls), results);
            return results;
        }

        const tag = selector.toUpperCase();
        this._collectChildren(el => el.tagName === tag, results);
        return results;
    }

    _findChild(predicate) {
        for (const child of this.children) {
            if (predicate(child)) return child;
            if (child.children && child.children.length > 0) {
                const found = child._findChild(predicate);
                if (found) return found;
            }
        }
        return null;
    }

    _collectChildren(predicate, results) {
        for (const child of this.children) {
            if (predicate(child)) results.push(child);
            if (child.children && child.children.length > 0) {
                child._collectChildren(predicate, results);
            }
        }
    }
}

function createMockElement(tagName = 'div', id = '', className = '') {
    return new MockDOMElement(tagName, id, className);
}

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        createElement: (tagName) => createMockElement(tagName),
        getElementById: (id) => domStore.get(id) || null,
        querySelector: (sel) => {
            if (sel.startsWith('#')) return domStore.get(sel.slice(1)) || null;
            if (sel.startsWith('.')) {
                const cls = sel.slice(1);
                for (const el of domStore.values()) {
                    if (el.classList && el.classList.contains(cls)) return el;
                }
            }
            return null;
        },
        querySelectorAll: (sel) => {
            if (sel.startsWith('.')) {
                const cls = sel.slice(1);
                const results = [];
                for (const el of domStore.values()) {
                    if (el.classList && el.classList.contains(cls)) results.push(el);
                }
                return results;
            }
            return [];
        }
    };
}

globalThis.fetch = async (url) => {
    if (typeof url === 'string' && url.includes('en.json')) {
        return { ok: true, json: async () => enJson };
    }
    return { ok: false, status: 404 };
};

const { renderNodesTrack } = await import('../../js/components/home/heroJourneyNodesDisplay.js');
const { loadTranslations } = await import('../../js/i18n/translator.js');
await loadTranslations('en');

describe("Hero's Journey Quest Chest Ore Reward Number Animation & Track Node DOM Retention (WP 39)", () => {
    let mockTrack;

    beforeEach(() => {
        domStore.clear();
        mockTrack = createMockElement('div', 'home-hj-nodes-track', 'hero-journey-nodes-track');
    });

    test('renders structured ore spans with data-ore and boost icon slot for quest nodes', () => {
        const state = {
            heroJourney: {
                acceleratedRewards: false,
                unclaimedOnly: false,
                typeFilter: null,
                revealBeyondTH: false,
                overrideUnclaimed: []
            },
            playerProfile: { townHallLevel: 16 },
            heroes: {
                barbarianKing: { level: 90 },
                archerQueen: { level: 90 },
                grandWarden: { level: 65 },
                royalChampion: { level: 40 },
                minionPrince: { level: 0 }
            }
        };

        renderNodesTrack(state, 285, 16);

        const questChips = mockTrack.querySelectorAll('.hero-journey-node-chip');
        assert.ok(questChips.length > 0);

        const questChip = questChips.find(chip => chip.querySelector('.node-sub-ore-val[data-ore="shiny"]'));
        assert.ok(questChip);

        const shinyVal = questChip.querySelector('.node-sub-ore-val[data-ore="shiny"]');
        const glowyVal = questChip.querySelector('.node-sub-ore-val[data-ore="glowy"]');
        const starryVal = questChip.querySelector('.node-sub-ore-val[data-ore="starry"]');

        assert.ok(shinyVal);
        assert.ok(glowyVal);
        assert.ok(starryVal);

        assert.ok(shinyVal.textContent.length > 0);
        assert.ok(glowyVal.textContent.length > 0);
        assert.ok(starryVal.textContent.length > 0);

        const boostSlots = questChip.querySelectorAll('.ore-boost-icon-slot');
        assert.equal(boostSlots.length, 3);
    });

    test('retains track node DOM element instances in-place when toggling Accelerated Rewards', () => {
        const state = {
            heroJourney: {
                acceleratedRewards: false,
                unclaimedOnly: false,
                typeFilter: null,
                revealBeyondTH: false,
                overrideUnclaimed: []
            },
            playerProfile: { townHallLevel: 16 },
            heroes: {
                barbarianKing: { level: 90 },
                archerQueen: { level: 90 },
                grandWarden: { level: 65 },
                royalChampion: { level: 40 },
                minionPrince: { level: 0 }
            }
        };

        renderNodesTrack(state, 285, 16);

        const chipsBefore = mockTrack.querySelectorAll('.hero-journey-node-chip');
        assert.ok(chipsBefore.length > 0);
        const firstChipBefore = chipsBefore[0];
        const questChipBefore = chipsBefore.find(c => c.querySelector('.node-sub-ore-val[data-ore="shiny"]'));
        assert.ok(questChipBefore);

        state.heroJourney.acceleratedRewards = true;
        renderNodesTrack(state, 285, 16);

        const chipsAfter = mockTrack.querySelectorAll('.hero-journey-node-chip');
        assert.equal(chipsAfter.length, chipsBefore.length);
        assert.strictEqual(chipsAfter[0], firstChipBefore);

        const questChipAfter = chipsAfter.find(c => c.querySelector('.node-sub-ore-val[data-ore="shiny"]'));
        assert.strictEqual(questChipAfter, questChipBefore);
    });

    test('triggers smooth numeric updates via updateCalculatedValue on quest ore spans when toggling accelerated rewards', () => {
        const state = {
            heroJourney: {
                acceleratedRewards: false,
                unclaimedOnly: false,
                typeFilter: null,
                revealBeyondTH: false,
                overrideUnclaimed: []
            },
            playerProfile: { townHallLevel: 16 },
            heroes: {
                barbarianKing: { level: 90 },
                archerQueen: { level: 90 },
                grandWarden: { level: 65 },
                royalChampion: { level: 40 },
                minionPrince: { level: 0 }
            }
        };

        renderNodesTrack(state, 285, 16);

        const questChip = mockTrack.querySelectorAll('.hero-journey-node-chip')
            .find(c => c.querySelector('.node-sub-ore-val[data-ore="shiny"]'));
        assert.ok(questChip);

        const shinyValEl = questChip.querySelector('.node-sub-ore-val[data-ore="shiny"]');
        const glowyValEl = questChip.querySelector('.node-sub-ore-val[data-ore="glowy"]');
        const starryValEl = questChip.querySelector('.node-sub-ore-val[data-ore="starry"]');

        const initialShiny = parseInt(shinyValEl.textContent.replace(/[^0-9]/g, ''), 10);
        const initialGlowy = parseInt(glowyValEl.textContent.replace(/[^0-9]/g, ''), 10);
        const initialStarry = parseInt(starryValEl.textContent.replace(/[^0-9]/g, ''), 10);

        state.heroJourney.acceleratedRewards = true;
        renderNodesTrack(state, 285, 16);

        const accelShiny = shinyValEl._currentNumericValue;
        const accelGlowy = glowyValEl._currentNumericValue;
        const accelStarry = starryValEl._currentNumericValue;

        assert.ok(accelShiny > initialShiny);
        assert.ok(accelGlowy > initialGlowy);
        assert.ok(accelStarry > initialStarry);

        const boostSlot = questChip.querySelector('.ore-boost-icon-slot');
        assert.ok(boostSlot.innerHTML.includes('ore-accel-arrow-icon'));

        state.heroJourney.acceleratedRewards = false;
        renderNodesTrack(state, 285, 16);

        assert.equal(shinyValEl._currentNumericValue, initialShiny);
        assert.equal(glowyValEl._currentNumericValue, initialGlowy);
        assert.equal(starryValEl._currentNumericValue, initialStarry);
    });

    test('executes full DOM rebuild when filter criteria change node sequence', () => {
        const state = {
            heroJourney: {
                acceleratedRewards: false,
                unclaimedOnly: false,
                typeFilter: null,
                revealBeyondTH: false,
                overrideUnclaimed: []
            },
            playerProfile: {
                tag: '#P12345',
                townHallLevel: 16,
                ownedHeroes: {
                    barbarianKing: { level: 90 },
                    archerQueen: { level: 90 },
                    grandWarden: { level: 65 },
                    royalChampion: { level: 40 }
                }
            },
            heroes: {
                barbarianKing: { level: 90 },
                archerQueen: { level: 90 },
                grandWarden: { level: 65 },
                royalChampion: { level: 40 },
                minionPrince: { level: 0 }
            }
        };

        renderNodesTrack(state, 285, 16);
        const initialChips = mockTrack.querySelectorAll('.hero-journey-node-chip');
        const firstChip = initialChips[0];

        state.heroJourney.typeFilter = 'equipment';
        renderNodesTrack(state, 285, 16);

        const eqChips = mockTrack.querySelectorAll('.hero-journey-node-chip');
        assert.notEqual(eqChips.length, initialChips.length);
        assert.notStrictEqual(eqChips[0], firstChip);

        state.heroJourney.typeFilter = null;
        state.heroJourney.unclaimedOnly = true;
        renderNodesTrack(state, 285, 16);

        const unclaimedChips = mockTrack.querySelectorAll('.hero-journey-node-chip');
        assert.ok(unclaimedChips.length < initialChips.length);

        state.heroJourney.unclaimedOnly = false;
        state.heroJourney.revealBeyondTH = true;
        renderNodesTrack(state, 285, 16);

        const revealedChips = mockTrack.querySelectorAll('.hero-journey-node-chip');
        assert.ok(revealedChips.length >= initialChips.length);
    });

    test('updates claim button and checkmark status correctly during in-place pass', () => {
        const state = {
            heroJourney: {
                acceleratedRewards: false,
                unclaimedOnly: false,
                typeFilter: null,
                revealBeyondTH: false,
                overrideUnclaimed: [13]
            },
            playerProfile: {
                tag: '#P12345',
                townHallLevel: 16,
                ownedHeroes: {
                    barbarianKing: { level: 15 }
                }
            },
            heroes: {
                barbarianKing: { level: 15 }
            }
        };

        renderNodesTrack(state, 15, 16);
        const chip13 = mockTrack.querySelectorAll('.hero-journey-node-chip')
            .find(c => c.dataset.nodeLevel === '13');
        assert.ok(chip13);
        assert.equal(chip13.classList.contains('claimed'), false);

        const btn = chip13.querySelector('.node-claim-btn');
        assert.ok(btn);
        assert.equal(btn.classList.contains('btn-unclaimed'), true);

        state.heroJourney.overrideUnclaimed = [];
        renderNodesTrack(state, 15, 16);

        assert.equal(chip13.classList.contains('claimed'), true);
        assert.equal(btn.classList.contains('btn-claimed'), true);
        const checkmark = chip13.querySelector('.node-claimed-checkmark');
        assert.ok(checkmark);
    });

    test('handles guest and true max players without claim buttons', () => {
        const guestState = {
            heroJourney: {
                acceleratedRewards: false,
                unclaimedOnly: false,
                typeFilter: null,
                revealBeyondTH: false,
                overrideUnclaimed: []
            },
            playerProfile: { tag: 'DEFAULT0', townHallLevel: 16 },
            heroes: {}
        };

        renderNodesTrack(guestState, 0, 16);
        const guestButtons = mockTrack.querySelectorAll('.node-claim-btn');
        assert.equal(guestButtons.length, 0);
    });

    test('handles unreleased and zero ore fallback conditions gracefully', () => {
        const state = {
            heroJourney: {
                acceleratedRewards: false,
                unclaimedOnly: false,
                typeFilter: null,
                revealBeyondTH: false,
                overrideUnclaimed: []
            },
            playerProfile: { townHallLevel: 0 },
            heroes: {}
        };

        renderNodesTrack(state, 0, 0);
        assert.doesNotThrow(() => {
            renderNodesTrack(state, 0, 0);
        });
    });
});
