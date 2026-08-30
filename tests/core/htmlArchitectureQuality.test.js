import { test, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

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
        this.disabled = false;
        this.hidden = false;
        this.tabIndex = 0;
        this.eventListeners = new Map();
        this.focused = false;
        this.open = false;

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

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
        if (name === 'id') this.id = String(value);
        if (name === 'class') this.className = String(value);
        if (name === 'open') this.open = true;
    }

    getAttribute(name) {
        if (this.attributes.has(name)) return this.attributes.get(name);
        if (name === 'class') return this.classList.toString();
        if (name === 'id') return this.id || null;
        if (name === 'open') return this.open ? '' : null;
        return null;
    }

    hasAttribute(name) {
        return this.attributes.has(name) || (name === 'id' && !!this.id) || (name === 'class' && this.classList.length > 0) || (name === 'open' && this.open);
    }

    removeAttribute(name) {
        this.attributes.delete(name);
        if (name === 'class') this.className = '';
        if (name === 'id') this.id = '';
        if (name === 'open') this.open = false;
    }

    addEventListener(event, handler, options) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push({ handler, options });
    }

    removeEventListener(event, handler) {
        if (!this.eventListeners.has(event)) return;
        const listeners = this.eventListeners.get(event).filter(l => l.handler !== handler);
        this.eventListeners.set(event, listeners);
    }

    dispatchEvent(event) {
        const listeners = this.eventListeners.get(event.type) || [];
        listeners.forEach(({ handler }) => {
            handler.call(this, event);
        });
        return !event.defaultPrevented;
    }

    querySelector(selector) {
        const list = this.querySelectorAll(selector);
        return list.length > 0 ? list[0] : null;
    }

    querySelectorAll(selector) {
        const results = [];
        const selectorList = selector.split(',').map(s => s.trim());

        const traverse = (node) => {
            for (const child of node.children) {
                for (const sel of selectorList) {
                    if (sel.startsWith('.')) {
                        const cls = sel.slice(1);
                        if (child.classList && child.classList.contains(cls)) {
                            results.push(child);
                            break;
                        }
                    } else if (sel.startsWith('#')) {
                        const targetId = sel.slice(1);
                        if (child.id === targetId) {
                            results.push(child);
                            break;
                        }
                    } else if (child.tagName === sel.toUpperCase()) {
                        results.push(child);
                        break;
                    }
                }
                traverse(child);
            }
        };

        traverse(this);
        return results;
    }

    appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
    }

    focus() {
        this.focused = true;
    }

    blur() {
        this.focused = false;
    }

    showModal() {
        this.open = true;
        this.setAttribute('open', '');
    }

    close() {
        this.open = false;
        this.removeAttribute('open');
    }

    showPopover() {
        this.popoverOpen = true;
    }

    hidePopover() {
        this.popoverOpen = false;
    }

    matches(selector) {
        if (selector === ':popover-open') return !!this.popoverOpen;
        if (selector === '[open]') return !!this.open;
        if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
        if (selector.startsWith('#')) return this.id === selector.slice(1);
        return this.tagName === selector.toUpperCase();
    }

    closest(selector) {
        let curr = this;
        while (curr) {
            if (curr.matches && curr.matches(selector)) return curr;
            curr = curr.parentNode;
        }
        return null;
    }

    contains(node) {
        if (node === this) return true;
        for (const child of this.children) {
            if (child === node || (child.contains && child.contains(node))) return true;
        }
        return false;
    }

    getBoundingClientRect() {
        return {
            top: 100,
            left: 100,
            bottom: 140,
            right: 200,
            width: 100,
            height: 40
        };
    }

    removeChild(child) {
        const index = this.children.indexOf(child);
        if (index > -1) {
            this.children.splice(index, 1);
            child.parentNode = null;
        }
        return child;
    }
}

if (typeof globalThis.HTMLElement === 'undefined') {
    globalThis.HTMLElement = class {};
}

if (typeof globalThis.HTMLDialogElement === 'undefined') {
    globalThis.HTMLDialogElement = class {};
}

if (typeof globalThis.MutationObserver === 'undefined') {
    globalThis.MutationObserver = class {
        constructor(callback) {
            this.callback = callback;
        }
        observe() {}
        disconnect() {}
    };
}

if (typeof globalThis.CustomEvent === 'undefined') {
    globalThis.CustomEvent = class {
        constructor(type, init = {}) {
            this.type = type;
            this.bubbles = Boolean(init.bubbles);
            this.detail = init.detail || null;
            this.defaultPrevented = false;
        }
        preventDefault() {
            this.defaultPrevented = true;
        }
        stopPropagation() {}
    };
}

if (typeof globalThis.Event === 'undefined') {
    globalThis.Event = class {
        constructor(type, init = {}) {
            this.type = type;
            this.bubbles = Boolean(init.bubbles);
            this.defaultPrevented = false;
        }
        preventDefault() {
            this.defaultPrevented = true;
        }
        stopPropagation() {}
    };
}

if (typeof globalThis.requestAnimationFrame === 'undefined') {
    globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}

const mockHistoryState = [];
if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        history: {
            state: null,
            pushState: (stateObj) => {
                mockHistoryState.push(stateObj);
                globalThis.window.history.state = stateObj;
            },
            back: () => {
                mockHistoryState.pop();
                globalThis.window.history.state = mockHistoryState[mockHistoryState.length - 1] || null;
            }
        },
        innerHeight: 800,
        innerWidth: 1200,
        scrollY: 0,
        scrollX: 0,
        addEventListener: () => {},
        removeEventListener: () => {},
        requestAnimationFrame: (cb) => setTimeout(cb, 0),
        cancelAnimationFrame: (id) => clearTimeout(id)
    };
} else {
    if (typeof globalThis.window.innerHeight === 'undefined') globalThis.window.innerHeight = 800;
    if (typeof globalThis.window.innerWidth === 'undefined') globalThis.window.innerWidth = 1200;
    if (typeof globalThis.window.scrollY === 'undefined') globalThis.window.scrollY = 0;
    if (typeof globalThis.window.scrollX === 'undefined') globalThis.window.scrollX = 0;
}

const mockBody = new MockDOMElement('body');
const elementsMap = new Map();

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        body: mockBody,
        activeElement: null,
        createElement: (tag) => new MockDOMElement(tag),
        getElementById: (id) => {
            if (elementsMap.has(id)) return elementsMap.get(id);
            for (const child of mockBody.children) {
                if (child.id === id) return child;
            }
            return null;
        },
        querySelector: (sel) => mockBody.querySelector(sel),
        querySelectorAll: (sel) => mockBody.querySelectorAll(sel),
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true
    };
} else {
    globalThis.document.body = mockBody;
    globalThis.document.createElement = (tag) => new MockDOMElement(tag);
    globalThis.document.getElementById = (id) => {
        if (elementsMap.has(id)) return elementsMap.get(id);
        for (const child of mockBody.children) {
            if (child.id === id) return child;
        }
        return null;
    };
}

const { openModal, closeModal, closeModalAnimated, handleModalStateChange, closeAllModals } = await import('../../js/utils/modalHistoryManager.js');
const { registerInputPopover } = await import('../../js/utils/inputPopoverProvider.js');
const { showCardHelpPopover, hideCardHelpPopover } = await import('../../js/utils/cardHelpPopover.js');

describe('Native HTMLDialogElement Overlay Architecture', () => {

    describe('HTML Partial Templates Verification', () => {

        test('All 25 modal partial templates in partials/modals/*.html use <dialog> elements', () => {
            const modalsDir = path.join(projectRoot, 'partials/modals');
            const modalFiles = fs.readdirSync(modalsDir).filter(file => file.endsWith('.html') && file !== 'consent-banner.html');

            assert.ok(modalFiles.length >= 24, `Must find at least 24 modal template files in ${modalsDir}`);

            for (const file of modalFiles) {
                const filePath = path.join(modalsDir, file);
                const content = fs.readFileSync(filePath, 'utf8').trim();

                assert.match(
                    content,
                    /^<dialog\s+id="[^"]+"\s+class="modal/m,
                    `Modal file partials/modals/${file} must declare <dialog id="..." class="modal"> as root tag`
                );
                assert.match(
                    content,
                    /<\/dialog>\s*$/,
                    `Modal file partials/modals/${file} must close with </dialog>`
                );
            }
        });

        test('Navigation drawer partial uses <dialog id="navigation-drawer" class="navigation-drawer">', () => {
            const drawerPath = path.join(projectRoot, 'partials/navigation-drawer.html');
            const content = fs.readFileSync(drawerPath, 'utf8').trim();

            assert.match(
                content,
                /<dialog\s+id="navigation-drawer"\s+class="navigation-drawer"/m,
                'Navigation drawer partial must use <dialog id="navigation-drawer" class="navigation-drawer">'
            );
            assert.match(
                content,
                /<\/dialog>\s*$/,
                'Navigation drawer partial must close with </dialog>'
            );
        });

        test('Dynamic level select modal template generates <dialog id="level-select-modal">', () => {
            const levelSelectPath = path.join(projectRoot, 'js/components/planner/levelSelectModal.js');
            const content = fs.readFileSync(levelSelectPath, 'utf8');

            assert.match(
                content,
                /<dialog\s+id="level-select-modal"\s+class="modal/m,
                'Dynamic template in levelSelectModal.js must generate <dialog id="level-select-modal" class="modal">'
            );
        });

        test('Zero orphaned .modal-backdrop tags exist in partials', () => {
            const partialsDir = path.join(projectRoot, 'partials');
            const allHtmlFiles = [];

            const scanDir = (dir) => {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const full = path.join(dir, entry.name);
                    if (entry.isDirectory()) scanDir(full);
                    else if (entry.name.endsWith('.html')) allHtmlFiles.push(full);
                }
            };
            scanDir(partialsDir);

            for (const file of allHtmlFiles) {
                const content = fs.readFileSync(file, 'utf8');
                assert.doesNotMatch(
                    content,
                    /<div\s+class="[^"]*modal-backdrop[^"]*"/,
                    `Orphaned modal-backdrop found in ${path.relative(projectRoot, file)}`
                );
            }
        });
    });

    describe('SCSS Overlay Architecture Verification', () => {

        test('modal backdrop stylesheet declares dialog.modal UA resets, native backdrop, and starting-style', () => {
            const modalScssPath = path.join(projectRoot, 'css/base/modal/_modal-backdrop.scss');
            const content = fs.readFileSync(modalScssPath, 'utf8');

            assert.match(content, /dialog\.modal/, '_modal-backdrop.scss must style dialog.modal');
            assert.match(content, /::backdrop/, '_modal-backdrop.scss must style native ::backdrop');
            assert.match(content, /@starting-style/, '_modal-backdrop.scss must define @starting-style entrance transition');
            assert.match(content, /allow-discrete/, '_modal-backdrop.scss must declare transition-behavior allow-discrete');
        });

        test('navigation stylesheet declares dialog drawer and native backdrop styling', () => {
            const navScssPath = fs.existsSync(path.join(projectRoot, 'css/layout/navigation/_nav-drawer.scss'))
                ? path.join(projectRoot, 'css/layout/navigation/_nav-drawer.scss')
                : path.join(projectRoot, 'css/layout/_navigation.scss');
            const content = fs.readFileSync(navScssPath, 'utf8');

            assert.match(content, /dialog\.navigation-drawer/, '_navigation.scss must target dialog.navigation-drawer');
            assert.match(content, /::backdrop/, '_navigation.scss must style native ::backdrop');
        });
    });

    describe('JavaScript Modal Lifecycle & Dialog Operations', () => {
        let testModal;
        let testTrigger;

        beforeEach(() => {
            testModal = new MockDOMElement('dialog', 'test-feature-modal', 'modal');
            testTrigger = new MockDOMElement('button', 'open-test-btn');
            const body = testModal.appendChild(new MockDOMElement('div', '', 'modal-body'));
            body.appendChild(new MockDOMElement('input', 'test-input', ''));

            elementsMap.set('test-feature-modal', testModal);
            globalThis.document.activeElement = testTrigger;
        });

        test('openModal invokes dialog.showModal(), adds .show class, and pushes history state', () => {
            let showModalCalled = false;
            testModal.showModal = () => {
                showModalCalled = true;
                testModal.open = true;
            };

            openModal(testModal);

            assert.equal(showModalCalled, true);
            assert.equal(testModal.classList.contains('show'), true);
            assert.equal(testModal.open, true);
            assert.ok(globalThis.window.history.state?.modalStateId);
        });

        test('closeModal coordinates animated closure, calls dialog.close(), and restores focus', (t, done) => {
            openModal(testModal);
            assert.equal(testModal.open, true);

            let closeCalled = false;
            testModal.close = () => {
                closeCalled = true;
                testModal.open = false;
            };

            closeModal(testModal, () => {
                assert.equal(closeCalled, true);
                assert.equal(testModal.classList.contains('show'), false);
                assert.equal(testTrigger.focused, true);
                done();
            });
        });

        test('cancel event on native <dialog> intercepts instant browser close and coordinates animation', () => {
            let defaultPrevented = false;
            const cancelEvent = new globalThis.CustomEvent('cancel', { bubbles: false });
            cancelEvent.preventDefault = () => { defaultPrevented = true; };

            testModal.addEventListener('cancel', (e) => {
                e.preventDefault();
                closeModalAnimated(testModal);
            });

            openModal(testModal);
            testModal.dispatchEvent(cancelEvent);

            assert.equal(defaultPrevented, true);
            assert.equal(testModal.classList.contains('closing'), true);
        });

        test('Backdrop click dismissal triggers when clicking <dialog> element directly', () => {
            testModal.addEventListener('click', (e) => {
                if (e.target === testModal) {
                    closeModalAnimated(testModal);
                }
            });

            openModal(testModal);

            const clickBackdropEvent = { type: 'click', target: testModal, defaultPrevented: false };
            testModal.dispatchEvent(clickBackdropEvent);

            assert.equal(testModal.classList.contains('closing'), true);
        });

        test('Backdrop click dismissal is ignored when clicking inside modal content', () => {
            const modalContent = testModal.querySelector('.modal-body');
            testModal.addEventListener('click', (e) => {
                if (e.target === testModal) {
                    closeModalAnimated(testModal);
                }
            });

            openModal(testModal);

            const clickInsideEvent = { type: 'click', target: modalContent, defaultPrevented: false };
            testModal.dispatchEvent(clickInsideEvent);

            assert.equal(testModal.classList.contains('closing'), false);
        });

        test('Welcome modal is exempted from history stack popping and backdrop click dismissal', () => {
            const welcomeModal = new MockDOMElement('dialog', 'welcome-modal', 'modal');
            elementsMap.set('welcome-modal', welcomeModal);

            const initialHistoryLen = mockHistoryState.length;
            handleModalStateChange(welcomeModal, true);

            assert.equal(mockHistoryState.length, initialHistoryLen);
        });
    });

    describe('Native HTML Popover API Architecture', () => {

        test('inputPopoverProvider sets manual popover mode and controls visibility', () => {
            const inputPopoverPath = path.join(projectRoot, 'js/utils/inputPopoverProvider.js');
            const positionerPath = path.join(projectRoot, 'js/utils/inputPopoverPositioner.js');
            let content = fs.readFileSync(inputPopoverPath, 'utf8');
            if (fs.existsSync(positionerPath)) {
                content += '\n' + fs.readFileSync(positionerPath, 'utf8');
            }

            assert.match(content, /setAttribute\(['"]popover['"],\s*['"]manual['"]\)/, 'inputPopoverProvider.js must set popover="manual" on popover creation');
            assert.match(content, /popover\.showPopover\(\)/, 'inputPopoverProvider.js must invoke popover.showPopover()');
            assert.match(content, /popover\.hidePopover\(\)/, 'inputPopoverProvider.js must invoke popover.hidePopover()');
        });

        test('cardHelpPopover sets auto popover mode, tooltip role, and controls visibility', () => {
            const cardHelpPath = path.join(projectRoot, 'js/utils/cardHelpPopover.js');
            const content = fs.readFileSync(cardHelpPath, 'utf8');

            assert.match(content, /setAttribute\(['"]popover['"],\s*['"]auto['"]\)/, 'cardHelpPopover.js must set popover="auto"');
            assert.match(content, /setAttribute\(['"]role['"],\s*['"]tooltip['"]\)/, 'cardHelpPopover.js must set role="tooltip"');
            assert.match(content, /showPopover\(\)/, 'cardHelpPopover.js must call showPopover()');
            assert.match(content, /hidePopover\(\)/, 'cardHelpPopover.js must call hidePopover()');
            assert.match(content, /aria-describedby/, 'cardHelpPopover.js must manage aria-describedby association');
        });

        test('card popovers define popover-open starting styles and discrete transitions', () => {
            const cardsScssPath = fs.existsSync(path.join(projectRoot, 'css/components/cards/_cards-popovers.scss'))
                ? path.join(projectRoot, 'css/components/cards/_cards-popovers.scss')
                : path.join(projectRoot, 'css/components/_cards.scss');
            const content = fs.readFileSync(cardsScssPath, 'utf8');

            assert.match(content, /\.card-help-popover[\s\S]*?:popover-open/, '_cards.scss must style .card-help-popover with :popover-open');
            assert.match(content, /\.card-help-popover[\s\S]*?@starting-style/, '_cards.scss must define @starting-style for .card-help-popover');
            assert.match(content, /\.card-help-popover[\s\S]*?allow-discrete/, '_cards.scss must declare allow-discrete transition on .card-help-popover');
            assert.match(content, /\.card-help-popover[\s\S]*?inset:\s*unset/, '_cards.scss must reset inset: unset on .card-help-popover');

            assert.match(content, /\.input-feature-popover[\s\S]*?:popover-open/, '_cards.scss must style .input-feature-popover with :popover-open');
            assert.match(content, /\.input-feature-popover[\s\S]*?@starting-style/, '_cards.scss must define @starting-style for .input-feature-popover');
            assert.match(content, /\.input-feature-popover[\s\S]*?allow-discrete/, '_cards.scss must declare allow-discrete transition on .input-feature-popover');
            assert.match(content, /\.input-feature-popover[\s\S]*?inset:\s*unset/, '_cards.scss must reset inset: unset on .input-feature-popover');
        });

        test('registerInputPopover controls popover visibility on focus and blur', (t, done) => {
            const parent = new MockDOMElement('div', 'input-container', 'popover-wrapper');
            const input = new MockDOMElement('input', 'hero-level-input', 'updatable');
            parent.appendChild(input);
            mockBody.appendChild(parent);

            registerInputPopover(input, { min: 1, max: 95, recommended: 45 });

            const popoverEl = mockBody.children.find(c => c.classList.contains('input-feature-popover'));
            assert.ok(popoverEl);
            assert.equal(popoverEl.getAttribute('popover'), 'manual');

            input.dispatchEvent(new globalThis.CustomEvent('focus'));
            assert.equal(popoverEl.classList.contains('show'), true);
            assert.equal(popoverEl.popoverOpen, true);

            const escEvent = new globalThis.CustomEvent('keydown');
            escEvent.key = 'Escape';
            input.dispatchEvent(escEvent);

            assert.equal(popoverEl.classList.contains('show'), false);
            assert.equal(popoverEl.popoverOpen, false);
            done();
        });

        test('card help popover handlers manage accessibility tooltip attributes', () => {
            const trigger = new MockDOMElement('button', 'milestone-node-btn', 'hero-journey-node-chip');
            mockBody.appendChild(trigger);

            showCardHelpPopover(trigger, {
                header: '<span>Giant Gauntlet</span>',
                body: '<p>Unlocks at Hero Level 20</p>'
            });

            const popoverEl = mockBody.children.find(c => c.id === 'card-help-popover');
            assert.ok(popoverEl);
            assert.equal(popoverEl.getAttribute('popover'), 'auto');
            assert.equal(popoverEl.getAttribute('role'), 'tooltip');
            assert.equal(popoverEl.classList.contains('show'), true);
            assert.equal(popoverEl.popoverOpen, true);
            assert.equal(trigger.getAttribute('aria-describedby'), 'card-help-popover');

            hideCardHelpPopover();

            assert.equal(popoverEl.classList.contains('show'), false);
            assert.equal(popoverEl.popoverOpen, false);
            assert.equal(trigger.hasAttribute('aria-describedby'), false);
        });
    });

    describe('Accessible Tooltip Architecture ([role="tooltip"] & aria-describedby)', () => {

        test('income chips and calendar popovers define tooltip accessibility styles', () => {
            const incomeChipsScssPath = path.join(projectRoot, 'css/components/_income-chips.scss');
            const calendarScssPath = path.join(projectRoot, 'css/components/calendar/_calendar-popovers.scss');

            const incomeChipsContent = fs.readFileSync(incomeChipsScssPath, 'utf8');
            const calendarContent = fs.readFileSync(calendarScssPath, 'utf8');

            assert.match(incomeChipsContent, /\[role=["']tooltip["']\]/, '_income-chips.scss must declare [role="tooltip"] selector');
            assert.match(calendarContent, /\[role=["']tooltip["']\]/, '_calendar-popovers.scss must declare [role="tooltip"] selector');
        });

        test('chipFactory sets tooltip role and links aria-describedby', () => {
            const chipFactoryPath = path.join(projectRoot, 'js/utils/chipFactory.js');
            const content = fs.readFileSync(chipFactoryPath, 'utf8');

            assert.match(content, /tooltip\.setAttribute\(['"]role['"],\s*['"]tooltip['"]\)/, 'chipFactory.js must set role="tooltip" on tooltips');
            assert.match(content, /chip\.setAttribute\(['"]aria-describedby['"]/, 'chipFactory.js must attach aria-describedby to chip');
            assert.match(content, /chip\.removeAttribute\(['"]aria-describedby['"]\)/, 'chipFactory.js must remove aria-describedby on hide');
        });

        test('calendar milestones renderer sets tooltip role and aria-describedby', () => {
            const calendarDisplayPath = path.join(projectRoot, 'js/components/planner/calendarMilestonesRenderer.js');
            const content = fs.readFileSync(calendarDisplayPath, 'utf8');

            assert.match(content, /tooltip\.setAttribute\(['"]role['"],\s*['"]tooltip['"]\)/, 'calendarMilestonesRenderer.js must set role="tooltip"');
            assert.match(content, /badge\.setAttribute\(['"]aria-describedby['"]/, 'calendarMilestonesRenderer.js must attach aria-describedby to equipment badge');
            assert.match(content, /dayCell\.setAttribute\(['"]aria-describedby['"]/, 'calendarMilestonesRenderer.js must attach aria-describedby to dayCell');
            assert.match(content, /removeAttribute\(['"]aria-describedby['"]\)/, 'calendarMilestonesRenderer.js must remove aria-describedby on mouseleave');
        });
    });

    describe('Modal Collision Safety & closeAllModals()', () => {
        test('closeAllModals closes open native dialogs, removes modal classes, and resets overlays', () => {
            const modal1 = new MockDOMElement('dialog', 'settings-modal', 'modal show');
            modal1.open = true;
            const modal2 = new MockDOMElement('dialog', 'player-modal', 'modal show');
            modal2.open = true;
            const overlay = new MockDOMElement('div', 'overlay', 'modal-overlay show active');

            mockBody.appendChild(modal1);
            mockBody.appendChild(modal2);
            mockBody.appendChild(overlay);

            openModal(modal1);
            openModal(modal2);

            assert.equal(modal1.open, true);
            assert.equal(modal2.open, true);

            closeAllModals();

            assert.equal(modal1.open, false);
            assert.equal(modal1.classList.contains('show'), false);
            assert.equal(modal2.open, false);
            assert.equal(modal2.classList.contains('show'), false);
            assert.equal(overlay.classList.contains('show'), false);
        });
    });
});
