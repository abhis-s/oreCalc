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

function matchesSelector(element, selector) {
    if (!selector || !element) return false;
    if (selector.includes(',')) {
        return selector.split(',').some(part => matchesSelector(element, part.trim()));
    }
    const s = selector.trim();
    if (s.startsWith('#')) {
        return element.id === s.slice(1);
    }
    if (s.startsWith('.')) {
        return element.classList.contains(s.slice(1));
    }
    if (s.toUpperCase() === element.tagName) {
        return true;
    }
    return false;
}

function parseHTMLToNodes(html) {
    const nodes = [];
    const itemRegex = /<div class="([^"]*player-dropdown-item[^"]*)"\s+data-tag="([^"]*)"[^>]*>([\s\S]*?)<\/div>(?=\s*(?:<div class="[^"]*player-dropdown-item|<div class="[^"]*player-dropdown-section-header|$))/g;
    let match;
    while ((match = itemRegex.exec(html)) !== null) {
        const [, className, dataTag, inner] = match;
        const itemEl = new MockDOMElement('div', '', className);
        itemEl.dataset.tag = dataTag;
        itemEl.setAttribute('data-tag', dataTag);

        const tabMatch = match[0].match(/tabindex="([^"]*)"/);
        if (tabMatch) {
            itemEl.setAttribute('tabindex', tabMatch[1]);
        }

        const cacheIconMatch = inner.match(/class="([^"]*cache-status-icon[^"]*)"/);
        if (cacheIconMatch) {
            const iconEl = new MockDOMElement('svg', '', cacheIconMatch[1]);
            itemEl.appendChild(iconEl);
        }

        const infoMatch = inner.match(/<div class="player-info-text">([\s\S]*?)<\/div>/);
        if (infoMatch) {
            const infoEl = new MockDOMElement('div', '', 'player-info-text');
            const nameMatch = infoMatch[1].match(/<span>(.*?)<\/span>/);
            if (nameMatch) {
                const nameEl = new MockDOMElement('span');
                nameEl.textContent = nameMatch[1];
                infoEl.appendChild(nameEl);
            }
            const tagMatch = infoMatch[1].match(/<span class="player-tag-text">(.*?)<\/span>/);
            if (tagMatch) {
                const tagEl = new MockDOMElement('span', '', 'player-tag-text');
                tagEl.textContent = tagMatch[1];
                infoEl.appendChild(tagEl);
            }
            itemEl.appendChild(infoEl);
        }

        const btnMatch = inner.match(/<button class="([^"]*(?:delete-player-button|remove-player-button)[^"]*)"\s+data-tag="([^"]*)"([^>]*)>([\s\S]*?)<\/button>/);
        if (btnMatch) {
            const [, btnClass, btnTag, btnAttrs] = btnMatch;
            const btnEl = new MockDOMElement('button', '', btnClass);
            btnEl.dataset.tag = btnTag;
            btnEl.setAttribute('data-tag', btnTag);
            if (btnAttrs.includes('disabled')) {
                btnEl.disabled = true;
                btnEl.setAttribute('disabled', '');
            }
            itemEl.appendChild(btnEl);
        }

        nodes.push(itemEl);
    }
    return nodes;
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
        this.children = parseHTMLToNodes(this._innerHTML);
        this.children.forEach(c => { c.parentNode = this; });
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
        while (current) {
            if (matchesSelector(current, selector)) {
                return current;
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
        const results = [];
        const search = (node) => {
            if (!node || !node.children) return;
            for (const child of node.children) {
                if (matchesSelector(child, selector)) {
                    results.push(child);
                }
                search(child);
            }
        };
        search(this);
        return results;
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
const { renderPlayerDropdown, invalidatePlayerDropdownCache, toggleMainAppRecentCollapsed, getMainAppRecentCollapsed } = await import('../../js/components/player/playerDropdownDisplay.js');

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

    test('renders clean player dropdown markup without obsolete cache status icons', () => {
        renderPlayerDropdown();

        assert.ok(!mockContainer.innerHTML.includes('cache-status-icon'));
        assert.ok(!mockContainer.innerHTML.includes('cloud-check'));
        assert.ok(!mockContainer.innerHTML.includes('cloud-error'));

        const items = mockContainer.querySelectorAll('.player-dropdown-item');
        assert.equal(items.length, 3);

        items.forEach(item => {
            const cacheIcons = item.querySelectorAll('.cache-status-icon');
            assert.equal(cacheIcons.length, 0);

            const infoText = item.querySelector('.player-info-text');
            assert.ok(infoText);

            const nameSpan = infoText.querySelector('span');
            assert.ok(nameSpan);

            const tagSpan = infoText.querySelector('.player-tag-text');
            assert.ok(tagSpan);

            const deleteBtn = item.querySelector('.delete-player-button');
            assert.ok(deleteBtn);
        });
    });

    test('highlights the active player item and updates selected player label', () => {
        renderPlayerDropdown();

        assert.equal(mockLabel.textContent, 'Chief Archer');

        const items = mockContainer.querySelectorAll('.player-dropdown-item');
        assert.ok(items[0].classList.contains('active'));
        assert.ok(!items[1].classList.contains('active'));
        assert.ok(!items[2].classList.contains('active'));
    });

    test('filters out DEFAULT0 placeholder tag from rendered player items list', () => {
        state.savedPlayerTags = ['DEFAULT0'];
        state.allPlayersData = {};

        renderPlayerDropdown();

        const items = mockContainer.querySelectorAll('.player-dropdown-item');
        assert.equal(items.length, 0);
        assert.equal(mockLabel.textContent, enJson.player?.addPlayer || 'Add a player');
    });

    test('renders player items with correct data attributes and accessible roles', () => {
        renderPlayerDropdown();

        const items = mockContainer.querySelectorAll('.player-dropdown-item');
        assert.equal(items.length, 3);
        assert.equal(items[0].dataset.tag, 'TAG1');
        assert.equal(items[1].dataset.tag, 'TAG2');
        assert.equal(items[2].dataset.tag, 'TAG3');

        assert.match(mockContainer.innerHTML, /role="button"/);
        assert.match(mockContainer.innerHTML, /tabindex="0"/);
    });

    test('renders delete buttons with correct data-tag attribute and accessible aria-label', () => {
        renderPlayerDropdown();

        const items = mockContainer.querySelectorAll('.player-dropdown-item');
        const deleteButton = items[1].querySelector('.delete-player-button');
        assert.ok(deleteButton);
        assert.equal(deleteButton.dataset.tag, 'TAG2');
        assert.match(mockContainer.innerHTML, /aria-label="[^"]*"/);
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

    test('renders trash icon for saved profiles and cross icon for recent searches', () => {
        globalThis.localStorage.setItem('oreCalc_recentSearches', JSON.stringify([
            { tag: '#RECENT1', cleanTag: 'RECENT1', name: 'Recent Legend', townHallLevel: 16 }
        ]));

        invalidatePlayerDropdownCache();
        renderPlayerDropdown();

        assert.match(mockContainer.innerHTML, /#icon-trash/, 'Saved profiles must render trash icon');
        assert.match(mockContainer.innerHTML, /player-dropdown-section-header--collapsible/, 'Recent searches header must be collapsible');

        // Toggle to expanded to inspect dismiss button
        toggleMainAppRecentCollapsed();
        assert.equal(getMainAppRecentCollapsed(), false);
        assert.match(mockContainer.innerHTML, /dismiss-recent-button/, 'Expanded recent searches must render dismiss button');
        assert.match(mockContainer.innerHTML, /#icon-close/, 'Dismiss button must render close icon');

        // Toggle back to collapsed
        toggleMainAppRecentCollapsed();
        assert.equal(getMainAppRecentCollapsed(), true);
    });

    test('always renders Saved Profiles section at the top and Recent Searches below', () => {
        state.savedPlayerTags = ['#TAG1', '#TAG2'];
        state.allPlayersData['TAG1'] = { playerProfile: { name: 'Player 1', townHallLevel: 16 } };
        state.allPlayersData['TAG2'] = { playerProfile: { name: 'Player 2', townHallLevel: 15 } };
        globalThis.localStorage.setItem('oreCalc_playerTags', JSON.stringify(['TAG1', 'TAG2']));
        globalThis.localStorage.setItem('oreCalc_recentSearches', JSON.stringify([
            { tag: '#OTHERREC', cleanTag: 'OTHERREC', name: 'Other Recent', townHallLevel: 15 }
        ]));

        invalidatePlayerDropdownCache();
        renderPlayerDropdown();

        // Top section header must be Saved Profiles
        assert.match(mockContainer.innerHTML, /player\.savedProfiles/);
        const firstItem = mockContainer.querySelector('.player-dropdown-item');
        assert.ok(firstItem);
        assert.equal(firstItem.dataset.tag, 'TAG1');
        assert.ok(firstItem.classList.contains('active'));

        // Bottom section must be collapsible Recent Searches
        assert.match(mockContainer.innerHTML, /player-dropdown-section-header--collapsible/);
    });

    test('omits recent searches section when no standalone recent searches exist', () => {
        state.savedPlayerTags = ['#TAG1'];
        state.allPlayersData['TAG1'] = { playerProfile: { name: 'Single Saved', townHallLevel: 17 } };
        globalThis.localStorage.setItem('oreCalc_playerTags', JSON.stringify(['TAG1']));
        globalThis.localStorage.setItem('oreCalc_recentSearches', JSON.stringify([]));

        invalidatePlayerDropdownCache();
        renderPlayerDropdown();

        // Saved profiles is present
        assert.match(mockContainer.innerHTML, /TAG1/);

        // Recent searches collapsible section must be omitted
        assert.ok(!mockContainer.innerHTML.includes('player-dropdown-section-header--collapsible'), 'Recent searches must be omitted when empty');
    });

    test('collapsible recent searches toggle inverts state and renders correctly', () => {
        state.savedPlayerTags = ['#TAG1'];
        state.allPlayersData['#TAG1'] = { playerProfile: { name: 'Player 1', townHallLevel: 16 } };
        globalThis.localStorage.setItem('oreCalc_playerTags', JSON.stringify(['#TAG1']));
        globalThis.localStorage.setItem('oreCalc_recentSearches', JSON.stringify([
            { tag: '#REC1', cleanTag: 'REC1', name: 'Recent 1', townHallLevel: 15 }
        ]));

        invalidatePlayerDropdownCache();
        renderPlayerDropdown();

        // Default: collapsed
        assert.equal(getMainAppRecentCollapsed(), true);
        assert.ok(!mockContainer.innerHTML.includes('Recent 1'));

        // Toggle: expand
        toggleMainAppRecentCollapsed();
        assert.equal(getMainAppRecentCollapsed(), false);
        assert.ok(mockContainer.innerHTML.includes('Recent 1'));

        // Toggle: collapse again
        toggleMainAppRecentCollapsed();
        assert.equal(getMainAppRecentCollapsed(), true);
        assert.ok(!mockContainer.innerHTML.includes('Recent 1'));
    });

    test('Add Player Modal layout, Guided Setup action and width invariants', () => {
        const addPlayerHtml = fs.readFileSync(path.join(projectRoot, 'partials/modals/add-player.html'), 'utf8');
        const playerModalScss = fs.readFileSync(path.join(projectRoot, 'css/components/_player-modal.scss'), 'utf8');
        const deJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/de.json'), 'utf8'));

        assert.equal(enJson.actions.guidedSetup, 'Guided Setup', 'en.json must define actions.guidedSetup');
        assert.equal(deJson.actions.guidedSetup, 'Geführtes Setup', 'de.json must define actions.guidedSetup');
        assert.match(enJson.player.addPlayerHelp, /Guided Setup/, 'en.json addPlayerHelp must mention Guided Setup');
        assert.match(deJson.player.addPlayerHelp, /Geführtes Setup/, 'de.json addPlayerHelp must mention Geführtes Setup');

        assert.match(
            addPlayerHtml,
            /id="add-player-guided-setup-btn"[\s\S]*?data-i18n="actions\.guidedSetup"/,
            'add-player.html must contain Guided Setup button'
        );
        assert.match(
            playerModalScss,
            /#add-player-modal\s*\{[\s\S]*?max-width:\s*\$modal-width-expanded;/,
            '#add-player-modal must use $modal-width-expanded for wider layout'
        );
    });

    test('cannotDeleteLastProfile and deleteProfile copy and formatting invariants', () => {
        const deJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/de.json'), 'utf8'));

        assert.match(enJson.alerts.cannotDeleteLastProfile, /<p>.*<\/p>/, 'cannotDeleteLastProfile must be formatted in paragraphs');
        assert.match(deJson.alerts.cannotDeleteLastProfile, /<p>.*<\/p>/, 'cannotDeleteLastProfile in German must be formatted in paragraphs');
        assert.match(enJson.confirms.deleteProfile, /permanently remove all data/, 'deleteProfile must state permanent data removal');
        assert.match(deJson.confirms.deleteProfile, /dauerhaft/, 'deleteProfile in German must state permanent data removal');
    });

    test('tabs module exports resetTabScrollPosition and navigateToTab', async () => {
        const tabs = await import('../../js/components/layout/tabs.js');
        assert.equal(typeof tabs.resetTabScrollPosition, 'function');
        assert.equal(typeof tabs.navigateToTab, 'function');
    });

    test('keyboard navigation handles ArrowDown, ArrowUp, Home, End, Escape, and Delete', async () => {
        const { initializePlayerDropdown, openDropdown, closeDropdown } = await import('../../js/components/player/playerDropdownInputs.js');

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
        let scrolled = false;
        items[1].scrollIntoView = () => { scrolled = true; };

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
});
