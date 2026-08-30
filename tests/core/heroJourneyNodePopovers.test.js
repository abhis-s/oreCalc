import { test, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        innerWidth: 1024,
        innerHeight: 768,
        addEventListener: () => {},
        removeEventListener: () => {},
        getComputedStyle: () => ({ display: 'block' }),
        requestAnimationFrame: (cb) => { cb(); return 1; },
        cancelAnimationFrame: () => {},
        matchMedia: () => ({ matches: true })
    };
} else {
    if (!globalThis.window.innerWidth) globalThis.window.innerWidth = 1024;
    if (!globalThis.window.innerHeight) globalThis.window.innerHeight = 768;
    if (!globalThis.window.getComputedStyle) globalThis.window.getComputedStyle = () => ({ display: 'block' });
    if (!globalThis.window.requestAnimationFrame) globalThis.window.requestAnimationFrame = (cb) => { cb(); return 1; };
    if (!globalThis.window.matchMedia) globalThis.window.matchMedia = () => ({ matches: true });
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
        this.src = '';
        this.offsetWidth = 100;
        this.clientHeight = 100;
        this.clientWidth = 100;

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
        this._innerHTML = val || '';
        if (typeof val === 'string' && !this._textContent) {
            this._textContent = val.replace(/<[^>]+>/g, '');
        }
    }

    get textContent() {
        return this._textContent;
    }

    set textContent(val) {
        this._textContent = val || '';
        this._innerHTML = val || '';
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
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
            child.parentElement = this;
            this.children.push(child);
        }
        return child;
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
            const classes = selector.slice(1).split('.');
            let cur = this;
            while (cur) {
                if (cur.classList && classes.every(c => cur.classList.contains(c))) return cur;
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
            if (domStore.has(searchId)) return domStore.get(searchId);
            return this._findChild(el => el.id === searchId);
        }
        if (selector.startsWith('.')) {
            const classes = selector.slice(1).split('.');
            return this._findChild(el => el.classList && classes.every(c => el.classList.contains(c)));
        }
        const tag = selector.toUpperCase();
        return this._findChild(el => el.tagName === tag);
    }

    querySelectorAll(selector) {
        const results = [];
        if (!selector) return results;
        if (selector.startsWith('.')) {
            const classes = selector.slice(1).split('.');
            this._collectChildren(el => el.classList && classes.every(c => el.classList.contains(c)), results);
        } else if (selector.startsWith('#')) {
            const searchId = selector.slice(1);
            this._collectChildren(el => el.id === searchId, results);
        } else {
            const tag = selector.toUpperCase();
            this._collectChildren(el => el.tagName === tag, results);
        }
        return results;
    }

    _findChild(predicate) {
        for (const child of this.children) {
            if (predicate(child)) return child;
            if (child._findChild) {
                const found = child._findChild(predicate);
                if (found) return found;
            }
        }
        return null;
    }

    _collectChildren(predicate, results) {
        for (const child of this.children) {
            if (predicate(child)) results.push(child);
            if (child._collectChildren) {
                child._collectChildren(predicate, results);
            }
        }
    }

    getBoundingClientRect() {
        return {
            top: 100,
            left: 100,
            bottom: 140,
            right: 200,
            width: 100,
            height: 40,
            x: 100,
            y: 100
        };
    }
}

const mockBody = new MockDOMElement('body', 'body');

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        body: mockBody,
        getElementById: (id) => domStore.get(id) || null,
        querySelector: (sel) => {
            if (sel.startsWith('#')) return domStore.get(sel.slice(1)) || null;
            if (sel.startsWith('.')) {
                const classes = sel.slice(1).split('.');
                for (const el of domStore.values()) {
                    if (el.classList && classes.every(c => el.classList.contains(c))) return el;
                }
            }
            return null;
        },
        querySelectorAll: (sel) => {
            if (sel.startsWith('.')) {
                const classes = sel.slice(1).split('.');
                const results = [];
                for (const el of domStore.values()) {
                    if (el.classList && classes.every(c => el.classList.contains(c))) results.push(el);
                }
                return results;
            }
            return [];
        },
        createElement: (tag) => new MockDOMElement(tag),
        addEventListener: () => {},
        removeEventListener: () => {}
    };
} else {
    if (!globalThis.document.body) {
        globalThis.document.body = mockBody;
    }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));
const deJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/de.json'), 'utf8'));

globalThis.fetch = async (url) => {
    if (url.includes('/en.json')) return { ok: true, json: async () => enJson };
    if (url.includes('/de.json')) return { ok: true, json: async () => deJson };
    return { ok: false, status: 404 };
};

const { state } = await import('../../js/core/state.js');
const { loadTranslations, translate } = await import('../../js/i18n/translator.js');
const { showNodeTooltip, hideNodeTooltip } = await import('../../js/components/home/heroJourneyPopovers.js');

describe("Hero's Journey Milestone Node Popovers Suite", () => {
    let popoverElem;

    beforeEach(async () => {
        state.uiSettings = { language: 'en' };
        await loadTranslations('en');

        const modals = Array.from(domStore.values()).filter(el => el.classList && el.classList.contains('modal'));
        modals.forEach(m => m.classList.remove('show'));

        popoverElem = globalThis.document.getElementById('card-help-popover');
        if (!popoverElem) {
            popoverElem = new MockDOMElement('div', 'card-help-popover', 'card-help-popover');
            globalThis.document.body.appendChild(popoverElem);
        } else {
            popoverElem.innerHTML = '';
            popoverElem.classList.remove('show');
        }
    });

    describe('Magic Item Popover Formatting', () => {
        test('formats single magic item title with multiplier prefix (1x Hero Potion)', () => {
            const chip = new MockDOMElement('div', '', 'hero-journey-node-chip');
            chip.dataset.nodeLevel = '5';

            showNodeTooltip(chip);

            assert.ok(popoverElem.classList.contains('show'));
            assert.ok(popoverElem.innerHTML.includes('<span class="popover-title">1x Hero Potion</span>'));
            assert.ok(popoverElem.innerHTML.includes(`<span class="popover-badge">${translate('views.home.heroJourney.magicItemBadge')}</span>`));
            assert.ok(popoverElem.innerHTML.includes(translate('entities.magicItemDescriptions.heroPotion')));
        });

        test('formats multi-quantity magic items with correct multiplier (3x Mighty Morsel, 2x Hero Potion)', () => {
            const chip21 = new MockDOMElement('div', '', 'hero-journey-node-chip');
            chip21.dataset.nodeLevel = '21';
            showNodeTooltip(chip21);

            assert.ok(popoverElem.innerHTML.includes('<span class="popover-title">3x Mighty Morsel</span>'));
            assert.ok(popoverElem.innerHTML.includes(`<span class="popover-badge">${translate('views.home.heroJourney.magicItemBadge')}</span>`));

            const chip195 = new MockDOMElement('div', '', 'hero-journey-node-chip');
            chip195.dataset.nodeLevel = '195';
            showNodeTooltip(chip195);

            assert.ok(popoverElem.innerHTML.includes('<span class="popover-title">2x Hero Potion</span>'));
        });

        test('formats Book of Heroes single item (1x Book of Heroes)', () => {
            const chip64 = new MockDOMElement('div', '', 'hero-journey-node-chip');
            chip64.dataset.nodeLevel = '64';
            showNodeTooltip(chip64);

            assert.ok(popoverElem.innerHTML.includes('<span class="popover-title">1x Book of Heroes</span>'));
            assert.ok(popoverElem.innerHTML.includes(translate('entities.magicItemDescriptions.bookOfHeroes')));
        });
    });

    describe('Ore Reward Popover Formatting', () => {
        test('formats Shiny Ore popover title without multiplier prefix (2,500 Shiny Ore)', () => {
            const chip = new MockDOMElement('div', '', 'hero-journey-node-chip');
            chip.dataset.nodeLevel = '29';

            showNodeTooltip(chip);

            assert.ok(popoverElem.classList.contains('show'));
            assert.ok(popoverElem.innerHTML.includes('<span class="popover-title">2,500 Shiny Ore</span>'));
            assert.ok(!popoverElem.innerHTML.includes('2,500x Shiny Ore'));
            assert.ok(popoverElem.innerHTML.includes(`<span class="popover-badge">${translate('views.home.heroJourney.oreRewardBadge')}</span>`));
            assert.ok(popoverElem.innerHTML.includes('Claiming this milestone awards <strong>2,500 Shiny Ore</strong>.'));
        });

        test('formats Glowy Ore popover title without multiplier prefix (200 Glowy Ore)', () => {
            const chip = new MockDOMElement('div', '', 'hero-journey-node-chip');
            chip.dataset.nodeLevel = '69';

            showNodeTooltip(chip);

            assert.ok(popoverElem.innerHTML.includes('<span class="popover-title">200 Glowy Ore</span>'));
            assert.ok(!popoverElem.innerHTML.includes('200x Glowy Ore'));
            assert.ok(popoverElem.innerHTML.includes(`<span class="popover-badge">${translate('views.home.heroJourney.oreRewardBadge')}</span>`));
            assert.ok(popoverElem.innerHTML.includes('Claiming this milestone awards <strong>200 Glowy Ore</strong>.'));
        });

        test('formats Starry Ore popover title without multiplier prefix (10 Starry Ore)', () => {
            const chip = new MockDOMElement('div', '', 'hero-journey-node-chip');
            chip.dataset.nodeLevel = '92';

            showNodeTooltip(chip);

            assert.ok(popoverElem.innerHTML.includes('<span class="popover-title">10 Starry Ore</span>'));
            assert.ok(!popoverElem.innerHTML.includes('10x Starry Ore'));
            assert.ok(popoverElem.innerHTML.includes(`<span class="popover-badge">${translate('views.home.heroJourney.oreRewardBadge')}</span>`));
            assert.ok(popoverElem.innerHTML.includes('Claiming this milestone awards <strong>10 Starry Ore</strong>.'));
        });
    });

    describe('Resource Reward Popover Formatting', () => {
        test('formats Dark Elixir popover title without multiplier prefix (3,000 Dark Elixir)', () => {
            const chip = new MockDOMElement('div', '', 'hero-journey-node-chip');
            chip.dataset.nodeLevel = '2';

            showNodeTooltip(chip);

            assert.ok(popoverElem.classList.contains('show'));
            assert.ok(popoverElem.innerHTML.includes('<span class="popover-title">3,000 Dark Elixir</span>'));
            assert.ok(!popoverElem.innerHTML.includes('3,000x Dark Elixir'));
            assert.ok(popoverElem.innerHTML.includes(`<span class="popover-badge">${translate('views.home.heroJourney.resourceRewardBadge')}</span>`));
            assert.ok(popoverElem.innerHTML.includes('Claiming this milestone awards <strong>3,000 Dark Elixir</strong>.'));
        });

        test('formats large Dark Elixir rewards (50,000 Dark Elixir)', () => {
            const chip = new MockDOMElement('div', '', 'hero-journey-node-chip');
            chip.dataset.nodeLevel = '83';

            showNodeTooltip(chip);

            assert.ok(popoverElem.innerHTML.includes('<span class="popover-title">50,000 Dark Elixir</span>'));
            assert.ok(!popoverElem.innerHTML.includes('50,000x Dark Elixir'));
            assert.ok(popoverElem.innerHTML.includes('Claiming this milestone awards <strong>50,000 Dark Elixir</strong>.'));
        });

        test('formats Elixir popover title without multiplier prefix (5,000,000 Elixir, 10,000,000 Elixir)', () => {
            const chip110 = new MockDOMElement('div', '', 'hero-journey-node-chip');
            chip110.dataset.nodeLevel = '110';
            showNodeTooltip(chip110);

            assert.ok(popoverElem.innerHTML.includes('<span class="popover-title">5,000,000 Elixir</span>'));
            assert.ok(!popoverElem.innerHTML.includes('5,000,000x Elixir'));
            assert.ok(popoverElem.innerHTML.includes(`<span class="popover-badge">${translate('views.home.heroJourney.resourceRewardBadge')}</span>`));
            assert.ok(popoverElem.innerHTML.includes('Claiming this milestone awards <strong>5,000,000 Elixir</strong>.'));

            const chip211 = new MockDOMElement('div', '', 'hero-journey-node-chip');
            chip211.dataset.nodeLevel = '211';
            showNodeTooltip(chip211);

            assert.ok(popoverElem.innerHTML.includes('<span class="popover-title">10,000,000 Elixir</span>'));
            assert.ok(!popoverElem.innerHTML.includes('10,000,000x Elixir'));
        });
    });

    describe('Equipment, Skin, and Quest Popover Formatting', () => {
        test('formats equipment node popover with Epic Equipment badge and Equipment Pool', () => {
            const chip = new MockDOMElement('div', '', 'hero-journey-node-chip');
            chip.dataset.nodeLevel = '20';

            showNodeTooltip(chip);

            assert.ok(popoverElem.innerHTML.includes(`<span class="popover-badge">${translate('views.home.heroJourney.epicEquipmentBadge')}</span>`));
            assert.ok(popoverElem.innerHTML.includes('Giant Gauntlet'));
            assert.ok(popoverElem.innerHTML.includes('popover-equipment-pool'));
            assert.ok(popoverElem.innerHTML.includes('Barbarian King Equipment Pool'));
        });

        test('formats future equipment node popover with Awarded at Lvl X badges for earlier items', () => {
            const chip = new MockDOMElement('div', '', 'hero-journey-node-chip');
            chip.dataset.nodeLevel = '180';

            showNodeTooltip(chip);

            assert.ok(popoverElem.innerHTML.includes('Spiky Ball'));
            assert.ok(popoverElem.innerHTML.includes('badge--awarded-earlier'));
            assert.ok(popoverElem.innerHTML.includes('Awarded at Lvl 20'));
        });

        test('formats skin node popover with accent-text and Legendary Hero Skin badge', () => {
            const chip = new MockDOMElement('div', '', 'hero-journey-node-chip');
            chip.dataset.nodeLevel = '125';

            showNodeTooltip(chip);

            assert.ok(popoverElem.innerHTML.includes('<span class="accent-text">Majestic</span> Barbarian King'));
            assert.ok(popoverElem.innerHTML.includes(`<span class="popover-badge">${translate('views.home.heroJourney.legendaryHeroSkinBadge')}</span>`));
            assert.ok(popoverElem.innerHTML.includes(translate('views.home.heroJourney.skinPopoverBody')));
        });

        test('formats quest node popover with chest ore ranges and Hero Quest badge', () => {
            const chip = new MockDOMElement('div', '', 'hero-journey-node-chip');
            chip.dataset.nodeLevel = '13';

            showNodeTooltip(chip);

            assert.ok(popoverElem.innerHTML.includes('Quest - Barbarian King'));
            assert.ok(popoverElem.innerHTML.includes(`<span class="popover-badge">${translate('views.home.heroJourney.heroQuestBadge')}</span>`));
            assert.ok(popoverElem.innerHTML.includes('popover-chest-breakdown'));
            assert.ok(popoverElem.innerHTML.includes('chest-ore-inline-chip'));
        });

        test('renders popover-unowned-alert when equipment milestone is claimed but unowned on server', () => {
            state.playerProfile = {
                tag: '#UNOWNED_CLAIMED',
                townHallLevel: 14,
                ownedHeroes: {
                    'Archer Queen': { level: 55 }
                },
                ownedEquipment: {
                    // Frozen Arrow not owned
                }
            };

            const chip = new MockDOMElement('div', '', 'hero-journey-node-chip claimed reached');
            chip.dataset.nodeLevel = '50';
            chip.dataset.isClaimed = 'true';

            showNodeTooltip(chip, state);

            assert.ok(popoverElem.innerHTML.includes('popover-unowned-alert'), 'Popover must contain unowned alert');
            assert.ok(popoverElem.innerHTML.includes('name="close"'), 'Alert must use close icon');
            assert.ok(popoverElem.innerHTML.includes(translate('views.home.heroJourney.unownedClaimedTitle')));
            assert.ok(popoverElem.innerHTML.includes(translate('views.home.heroJourney.poolIntroText')), 'Unowned popover must show pool intro and full pool');
            assert.ok(popoverElem.innerHTML.includes('popover-equipment-pool'), 'Unowned popover must show equipment pool section');
        });

        test('renders popover-unowned-alert with unownedClaimedDescWithLevel when equipment is awarded later', () => {
            state.playerProfile = {
                tag: '#MISSED_GAUNTLET_OWNED_SPIKY',
                townHallLevel: 14,
                ownedHeroes: {
                    'Barbarian King': { level: 25 }
                },
                ownedEquipment: {
                    'Spiky Ball': 18
                }
            };

            const chip = new MockDOMElement('div', '', 'hero-journey-node-chip claimed reached');
            chip.dataset.nodeLevel = '20';
            chip.dataset.isClaimed = 'true';

            showNodeTooltip(chip, state);

            assert.ok(popoverElem.innerHTML.includes('popover-unowned-alert'), 'Popover must contain unowned alert');
            assert.ok(popoverElem.innerHTML.includes(translate('views.home.heroJourney.unownedClaimedDescWithLevel', { level: 180 })));
            assert.ok(popoverElem.innerHTML.includes(translate('views.home.heroJourney.poolNowAwardedAtLevel', { level: 180 })));
        });

        test('renders popover-unowned-alert when triggered from table info button on missed equipment row', () => {
            state.playerProfile = {
                tag: '#MISSED_TABLE',
                townHallLevel: 14,
                ownedHeroes: {
                    'Archer Queen': { level: 55 }
                },
                ownedEquipment: {}
            };

            const infoBtn = new MockDOMElement('button', '', 'info-btn hj-table-info-btn');
            infoBtn.dataset.level = '50';
            infoBtn.dataset.isClaimed = 'true';

            showNodeTooltip(infoBtn, state);

            assert.ok(popoverElem.innerHTML.includes('popover-unowned-alert'), 'Table info button popover must contain unowned alert');
            assert.ok(popoverElem.innerHTML.includes(translate('views.home.heroJourney.unownedClaimedTitle')));
            assert.ok(popoverElem.innerHTML.includes(translate('views.home.heroJourney.unownedClaimedDesc')));
        });

        test('renders At Lvl X badge for equipment scheduled on another node, and In Queue for equipment not on any node', () => {
            state.playerProfile = null; // guest profile baseline

            const chip = new MockDOMElement('div', '', 'hero-journey-node-chip');
            chip.dataset.nodeLevel = '20';

            showNodeTooltip(chip, state);

            // BK Node 20 awards Giant Gauntlet. Spiky Ball is scheduled at Node 180.
            assert.ok(popoverElem.innerHTML.includes(translate('views.home.heroJourney.poolAtLevel', { level: 180 })), 'Spiky Ball should show At Lvl 180 badge');
            assert.ok(popoverElem.innerHTML.includes('badge--queued'), 'At Lvl badge should retain badge--queued class');
        });
    });

    describe('Lifecycle and Safety Guards', () => {
        test('does not show popover if a modal is open (.modal.show)', () => {
            const openModal = new MockDOMElement('div', 'test-modal', 'modal show');
            mockBody.appendChild(openModal);

            const chip = new MockDOMElement('div', '', 'hero-journey-node-chip');
            chip.dataset.nodeLevel = '29';

            showNodeTooltip(chip);

            assert.strictEqual(popoverElem.classList.contains('show'), false);
        });

        test('handles non-existent or invalid node levels gracefully', () => {
            const invalidChip = new MockDOMElement('div', '', 'hero-journey-node-chip');
            invalidChip.dataset.nodeLevel = '9999';

            assert.doesNotThrow(() => {
                showNodeTooltip(invalidChip);
            });
            assert.strictEqual(popoverElem.classList.contains('show'), false);
        });

        test('hideNodeTooltip removes show class from popover', () => {
            popoverElem.classList.add('show');
            hideNodeTooltip();
            assert.strictEqual(popoverElem.classList.contains('show'), false);
        });
    });
});
