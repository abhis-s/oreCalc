import { test, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));

if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (key) => store.get(key) || null,
        setItem: (key, val) => store.set(key, String(val)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
        get length() { return store.size; }
    };
}

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        addEventListener: () => {},
        removeEventListener: () => {},
        requestAnimationFrame: (cb) => { cb(); return 1; },
        cancelAnimationFrame: () => {},
        getComputedStyle: () => ({ display: 'block' }),
        matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
        location: { reload: () => {} }
    };
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

globalThis.fetch = async (url) => {
    if (typeof url === 'string' && url.includes('en.json')) {
        return { ok: true, json: async () => enJson };
    }
    return { ok: false, status: 404 };
};

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
        this._innerHTML = '';
        this.textContent = '';
        this.disabled = false;
        this.eventListeners = new Map();

        if (id) this.attributes.set('id', id);
        if (className) this.attributes.set('class', className);
    }

    get className() {
        return this.classList ? this.classList.toString() : this._className;
    }

    set className(value) {
        this._className = String(value || '');
        this.classList = new MockClassList(this._className);
        this.attributes.set('class', this._className);
    }

    get innerHTML() {
        return this._innerHTML;
    }

    set innerHTML(value) {
        this._innerHTML = String(value || '');
        if (!value) {
            this.children = [];
        }
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
        if (name === 'id') this.id = String(value);
        if (name === 'class') {
            this.className = String(value);
        }
        if (name.startsWith('data-')) {
            const dataKey = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
            this.dataset[dataKey] = String(value);
        }
    }

    getAttribute(name) {
        if (name === 'class') return this.className;
        return this.attributes.get(name) || null;
    }

    appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
    }

    closest(selector) {
        let current = this;
        const selectors = selector.split(',').map(s => s.trim());
        while (current) {
            for (const sel of selectors) {
                if (sel.startsWith('.') && current.classList.contains(sel.slice(1))) return current;
                if (sel.startsWith('#') && current.id === sel.slice(1)) return current;
            }
            current = current.parentNode;
        }
        return null;
    }

    querySelector(selector) {
        const all = this.querySelectorAll(selector);
        return all.length > 0 ? all[0] : null;
    }

    querySelectorAll(selector) {
        const classes = selector.split(',').map(s => s.trim().replace(/^\./, ''));
        return this.children.filter(c => classes.some(cls => c.classList.contains(cls)));
    }

    addEventListener(event, handler) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(handler);
    }

    dispatchEvent(evt) {
        const eventType = typeof evt === 'string' ? evt : (evt.type || 'click');
        const handlers = this.eventListeners.get(eventType) || [];
        const eventObj = typeof evt === 'string'
            ? { type: evt, target: this, currentTarget: this, preventDefault: () => {}, stopPropagation: () => {} }
            : { target: this, currentTarget: this, preventDefault: () => {}, stopPropagation: () => {}, ...evt };
        handlers.forEach(fn => fn.call(this, eventObj));
        return true;
    }

    focus() {}
}

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        createElement: (tag) => new MockDOMElement(tag),
        getElementById: (id) => null,
        querySelector: (sel) => null,
        querySelectorAll: (sel) => [],
        addEventListener: () => {},
        removeEventListener: () => {}
    };
}

const { state } = await import('../../js/core/state.js');
const { dom } = await import('../../js/dom/domElements.js');
const { loadTranslations } = await import('../../js/i18n/translator.js');
const { renderPlayerDropdown, invalidatePlayerDropdownCache, renderStandaloneDropdownMarkup } = await import('../../js/components/player/playerDropdownDisplay.js');
const { getAddPlayerHelpContent } = await import('../../js/utils/cardHelpPopover.js');

await loadTranslations('en');

describe('playerDropdownDisplay: Obsolete Cache Icon Removal & Rendering', () => {
    let mockContainer;
    let mockLabel;

    beforeEach(() => {
        invalidatePlayerDropdownCache();

        mockContainer = new MockDOMElement('div', 'player-items-container', 'player-dropdown-list-items');
        mockLabel = new MockDOMElement('span', 'selected-player-name', 'selected-player-name');

        dom.player = {
            playerItemsContainer: mockContainer,
            selectedPlayerName: mockLabel
        };

        state.savedPlayerTags = ['TAG1', 'TAG2', 'TAG3'];
        state.uiSettings = { language: 'en', currency: { code: 'USD' } };
        state.allPlayersData = {
            'TAG1': { playerProfile: { name: 'Chief Archer' } },
            'TAG2': { playerProfile: { name: 'Barbarian King' } },
            'TAG3': { playerProfile: { name: 'Grand Warden' } }
        };
    });

    test('renders player dropdown items with name, tag, and delete button', () => {
        renderPlayerDropdown();

        assert.match(mockContainer.innerHTML, /Chief Archer/);
        assert.match(mockContainer.innerHTML, /Barbarian King/);
        assert.match(mockContainer.innerHTML, /Grand Warden/);
        assert.match(mockContainer.innerHTML, /#TAG1/);
        assert.match(mockContainer.innerHTML, /#TAG2/);
        assert.match(mockContainer.innerHTML, /#TAG3/);
        assert.match(mockContainer.innerHTML, /player-info-text/);
        assert.match(mockContainer.innerHTML, /delete-player-button/);

        const itemCount = (mockContainer.innerHTML.match(/class="[^"]*player-dropdown-item/g) || []).length;
        assert.equal(itemCount, 3);
    });

    test('highlights the active player item and updates selected player label', () => {
        renderPlayerDropdown();

        assert.equal(mockLabel.textContent, 'Chief Archer');
        assert.match(mockContainer.innerHTML, /player-dropdown-item is-active"[^>]*data-tag="TAG1"/);
        assert.doesNotMatch(mockContainer.innerHTML, /player-dropdown-item is-active"[^>]*data-tag="TAG2"/);
        assert.doesNotMatch(mockContainer.innerHTML, /player-dropdown-item is-active"[^>]*data-tag="TAG3"/);
    });

    test('filters out DEFAULT0 placeholder tag from rendered player items list', () => {
        state.savedPlayerTags = ['DEFAULT0'];
        state.allPlayersData = {};

        renderPlayerDropdown();

        assert.equal(mockContainer.innerHTML, '');
        assert.equal(mockLabel.textContent, 'Add a player');
    });

    test('renders player items with correct data attributes and accessible roles', () => {
        renderPlayerDropdown();

        assert.match(mockContainer.innerHTML, /data-tag="TAG1"/);
        assert.match(mockContainer.innerHTML, /data-tag="TAG2"/);
        assert.match(mockContainer.innerHTML, /data-tag="TAG3"/);
        assert.match(mockContainer.innerHTML, /role="option"/);
        assert.match(mockContainer.innerHTML, /tabindex="0"/);
    });

    test('renders delete buttons with correct data-tag attribute and accessible aria-label', () => {
        renderPlayerDropdown();

        assert.match(mockContainer.innerHTML, /class="[^"]*delete-player-button[^"]*"[^>]*data-tag="TAG2"/);
        assert.match(mockContainer.innerHTML, /aria-label="[^"]*Chief Archer[^"]*"/);
    });

    test('memoizes rendering and avoids redundant innerHTML writes unless invalidated', () => {
        let innerHtmlSetCount = 0;
        let originalSetter = Object.getOwnPropertyDescriptor(MockDOMElement.prototype, 'innerHTML').set;

        Object.defineProperty(mockContainer, 'innerHTML', {
            get() { return this._innerHTML; },
            set(val) {
                innerHtmlSetCount++;
                originalSetter.call(this, val);
            },
            configurable: true
        });

        renderPlayerDropdown();
        assert.equal(innerHtmlSetCount, 1);

        renderPlayerDropdown();
        assert.equal(innerHtmlSetCount, 1);

        invalidatePlayerDropdownCache();
        renderPlayerDropdown();
        assert.equal(innerHtmlSetCount, 2);
    });

    test('renders trash icon for saved profiles', () => {
        invalidatePlayerDropdownCache();
        renderPlayerDropdown();

        assert.match(mockContainer.innerHTML, /#icon-trash/, 'Saved profiles must render trash icon');
    });

    test('always renders Saved Profiles section at the top with player items', () => {
        state.savedPlayerTags = ['#TAG1', '#TAG2'];
        state.allPlayersData['TAG1'] = { playerProfile: { name: 'Player 1', townHallLevel: 16 } };
        state.allPlayersData['TAG2'] = { playerProfile: { name: 'Player 2', townHallLevel: 15 } };
        globalThis.localStorage.setItem('oreCalc_playerTags', JSON.stringify(['TAG1', 'TAG2']));

        invalidatePlayerDropdownCache();
        renderPlayerDropdown();

        // Top section header must be Saved Profiles
        assert.match(mockContainer.innerHTML, /player\.savedProfiles/);
        assert.match(mockContainer.innerHTML, /data-tag="TAG1"/);
        assert.match(mockContainer.innerHTML, /player-dropdown-item is-active"[^>]*data-tag="TAG1"/);
    });

    test('getAddPlayerHelpContent dynamically includes Guided Setup paragraph only when guided setup button is visible', () => {
        const origGetById = globalThis.document?.getElementById;

        // Scenario 1: Guided Setup button is absent
        globalThis.document.getElementById = () => null;
        const contentNoBtn = getAddPlayerHelpContent();
        assert.match(contentNoBtn, /To find your player tag/);
        assert.doesNotMatch(contentNoBtn, /Guided Setup/);

        // Scenario 2: Guided Setup button is hidden
        globalThis.document.getElementById = (id) => {
            if (id === 'add-player-guided-setup-btn') {
                return { style: { display: 'none' }, hidden: true, getAttribute: () => null };
            }
            return null;
        };
        const contentHiddenBtn = getAddPlayerHelpContent();
        assert.match(contentHiddenBtn, /To find your player tag/);
        assert.doesNotMatch(contentHiddenBtn, /Guided Setup/);

        // Scenario 3: Guided Setup button is visible
        globalThis.document.getElementById = (id) => {
            if (id === 'add-player-guided-setup-btn') {
                return { style: { display: '' }, hidden: false, getAttribute: () => null };
            }
            return null;
        };
        const contentVisibleBtn = getAddPlayerHelpContent();
        assert.match(contentVisibleBtn, /To find your player tag/);
        assert.match(contentVisibleBtn, /Guided Setup/);

        // Restore
        if (origGetById) {
            globalThis.document.getElementById = origGetById;
        }
    });

    test('keyboard navigation handles ArrowDown, ArrowUp, Home, End, Escape, and Delete', async () => {
        const { initializePlayerDropdown } = await import('../../js/components/player/playerDropdownInputs.js');

        const mockDropdownBtn = new MockDOMElement('button', 'player-selection-btn');
        const mockDropdownList = new MockDOMElement('div', 'player-dropdown-list');
        const mockAddBtn = new MockDOMElement('button', 'add-player-btn');
        mockDropdownList.appendChild(mockContainer);
        mockDropdownList.appendChild(mockAddBtn);

        dom.player.dropdownButton = mockDropdownBtn;
        dom.player.dropdownList = mockDropdownList;
        dom.player.addPlayerButton = mockAddBtn;

        initializePlayerDropdown();
        renderPlayerDropdown();

        const item1 = new MockDOMElement('div', '', 'player-dropdown-item is-active');
        item1.setAttribute('tabindex', '0');
        item1.dataset.tag = 'TAG1';
        const item2 = new MockDOMElement('div', '', 'player-dropdown-item');
        item2.setAttribute('tabindex', '-1');
        item2.dataset.tag = 'TAG2';
        const item3 = new MockDOMElement('div', '', 'player-dropdown-item');
        item3.setAttribute('tabindex', '-1');
        item3.dataset.tag = 'TAG3';
        mockContainer.appendChild(item1);
        mockContainer.appendChild(item2);
        mockContainer.appendChild(item3);

        // Open dropdown via keyboard on dropdown button
        mockDropdownBtn.dispatchEvent({
            type: 'keydown',
            key: 'ArrowDown',
            preventDefault: () => {}
        });

        assert.ok(mockDropdownList.classList.contains('show'), 'Dropdown should be open');

        const items = mockContainer.querySelectorAll('.player-dropdown-item');
        assert.equal(items.length, 3);

        // ArrowDown on items[0]
        items[1].scrollIntoView = () => {};

        mockContainer.dispatchEvent({
            type: 'keydown',
            key: 'ArrowDown',
            target: items[0],
            preventDefault: () => {}
        });

        assert.equal(items[0].getAttribute('tabindex'), '-1');
        assert.equal(items[1].getAttribute('tabindex'), '0');

        // Home key on items[1] -> moves back to items[0]
        mockContainer.dispatchEvent({
            type: 'keydown',
            key: 'Home',
            target: items[1],
            preventDefault: () => {}
        });

        assert.equal(items[0].getAttribute('tabindex'), '0');
        assert.equal(items[1].getAttribute('tabindex'), '-1');

        // Escape closes dropdown
        mockContainer.dispatchEvent({
            type: 'keydown',
            key: 'Escape',
            target: items[0],
            preventDefault: () => {},
            stopPropagation: () => {}
        });

        assert.ok(!mockDropdownList.classList.contains('show'), 'Escape must close dropdown');
    });

    test('renderStandaloneDropdownMarkup renders sync/refresh button and localized TH alt text for saved player profiles', () => {
        const markup = renderStandaloneDropdownMarkup({
            savedProfiles: [{ cleanTag: 'TAG1', name: 'Chief Archer', townHallLevel: 16 }],
            activeCleanTag: 'TAG1'
        });
        assert.ok(markup.includes('refresh-player-button'), 'Dropdown item must include refresh button');
        assert.ok(markup.includes('data-tag="TAG1"'), 'Refresh button must contain target player tag');
        assert.ok(markup.includes('alt="Town Hall 16"'), 'Dropdown item must render localized Town Hall alt text');
    });
});
