import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

const createMemoryStorage = () => {
    const store = new Map();
    return {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => { store.set(k, String(v)); },
        removeItem: (k) => { store.delete(k); },
        clear: () => { store.clear(); }
    };
};

if (typeof globalThis.localStorage === 'undefined') {
    globalThis.localStorage = /** @type {any} */ (createMemoryStorage());
}

if (typeof globalThis.HTMLElement === 'undefined') {
    globalThis.HTMLElement = /** @type {any} */ (class {});
}

if (typeof globalThis.requestAnimationFrame === 'undefined') {
    globalThis.requestAnimationFrame = (cb) => {
        cb(0);
        return 1;
    };
    globalThis.cancelAnimationFrame = () => {};
}

if (typeof globalThis.window === 'undefined') {
    globalThis.window = /** @type {any} */ ({
        location: { host: 'clashcalc.com', href: 'https://clashcalc.com/', pathname: '/ore-calculator/', search: '', hash: '' },
        history: { state: null, pushState: () => {}, replaceState: () => {}, back: () => {} },
        navigator: { clipboard: { readText: async () => '' } },
        addEventListener: () => {},
        removeEventListener: () => {}
    });
}

function createClassList(initial = '') {
    const classes = new Set(String(initial).split(/\s+/).filter(Boolean));
    return {
        add: (...tokens) => { tokens.forEach(t => { if (t) classes.add(t); }); },
        remove: (...tokens) => { tokens.forEach(t => classes.delete(t)); },
        contains: (token) => classes.has(token)
    };
}

function createNode(id = '', initialClasses = '', extra = {}) {
    const node = Object.assign(new EventTarget(), {
        id,
        classList: createClassList(initialClasses),
        style: {},
        closest: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        getAttribute: () => null,
        setAttribute: () => {},
        focus: () => {},
        ...extra
    });
    return node;
}

function createModalNode(id) {
    const modal = createNode(id, 'modal show', {
        open: true,
        showModal() { modal.open = true; },
        close() { modal.open = false; }
    });
    return modal;
}

function createDocHost(elementsById, openModalsProvider) {
    return Object.assign(new EventTarget(), {
        body: createNode(),
        activeElement: null,
        getElementById: (id) => elementsById.get(id) || null,
        querySelector: (selector) => {
            if (selector.includes('.modal.show')) {
                const candidates = openModalsProvider();
                return candidates.find(m => m.id !== 'guided-setup-modal' && m.id !== 'notice-modal') || null;
            }
            return null;
        },
        querySelectorAll: (selector) => (selector.includes('.modal.show') ? openModalsProvider() : []),
        createElement: () => createNode('', '', { textContent: '', value: '', disabled: false })
    });
}

function dispatchKey(target, key) {
    const ev = new Event('keydown', { cancelable: true });
    Object.assign(ev, { key });
    target.dispatchEvent(ev);
}

function dispatchClick(target, clickTarget) {
    const ev = new Event('click', { cancelable: true, bubbles: true });
    Object.defineProperty(ev, 'target', { value: clickTarget, enumerable: true });
    target.dispatchEvent(ev);
}

describe('Modal Dismissal & Escape Ownership Suite', () => {
    test('appEventInterceptors ignores #notice-modal backdrop and #overlay when #notice-modal is open', async () => {
        const noticeModal = createModalNode('notice-modal');
        const overlay = createNode('overlay', 'show');
        const settingsModal = createModalNode('app-settings-modal');

        let activeModals = [settingsModal, noticeModal];
        const map = new Map([
            ['notice-modal', noticeModal],
            ['overlay', overlay],
            ['app-settings-modal', settingsModal]
        ]);
        const doc = createDocHost(map, () => activeModals);
        const origDoc = globalThis.document;
        globalThis.document = /** @type {any} */ (doc);

        try {
            const { initializeGlobalInterceptors } = await import('../../js/core/appEventInterceptors.js');
            initializeGlobalInterceptors();

            dispatchClick(doc, noticeModal);
            assert.equal(noticeModal.classList.contains('closing'), false);

            dispatchClick(doc, overlay);
            assert.equal(noticeModal.classList.contains('closing'), false);
            assert.equal(settingsModal.classList.contains('closing'), false);

            activeModals = [settingsModal];
            dispatchClick(doc, overlay);
            assert.equal(settingsModal.classList.contains('closing'), true);
        } finally {
            globalThis.document = origDoc;
        }
    });

    test('appEventInterceptors Escape closes topmost modal and yields while #notice-modal is open', async () => {
        const firstModal = createModalNode('priority-list-modal');
        const topModal = createModalNode('stored-ores-modal');
        const noticeModal = createModalNode('notice-modal');

        let activeModals = [firstModal, topModal, noticeModal];
        const map = new Map([
            ['priority-list-modal', firstModal],
            ['stored-ores-modal', topModal],
            ['notice-modal', noticeModal]
        ]);
        const doc = createDocHost(map, () => activeModals);
        const origDoc = globalThis.document;
        globalThis.document = /** @type {any} */ (doc);

        try {
            const { initializeGlobalInterceptors } = await import('../../js/core/appEventInterceptors.js');
            initializeGlobalInterceptors();

            // Escape yields while #notice-modal is open even when other modals appear earlier in DOM order
            dispatchKey(doc, 'Escape');
            assert.equal(firstModal.classList.contains('closing'), false);
            assert.equal(topModal.classList.contains('closing'), false);
            assert.equal(noticeModal.classList.contains('closing'), false);

            // Once #notice-modal closes, Escape dismisses the topmost modal rather than the first modal
            activeModals = [firstModal, topModal];
            dispatchKey(doc, 'Escape');
            assert.equal(topModal.classList.contains('closing'), true);
            assert.equal(firstModal.classList.contains('closing'), false);
        } finally {
            globalThis.document = origDoc;
        }
    });

    test('playerModalInputs and standaloneAddPlayerModal Escape handlers respect topmost modal and RouteLifecycleScope teardown', async () => {
        const { RouteLifecycleScope } = await import('../../js/core/routeLifecycleScope.js');
        const { initializePlayerModal } = await import('../../js/components/player/playerModalInputs.js');
        const { initStandaloneAddPlayerModal } = await import('../../js/components/player/standaloneAddPlayerModal.js');

        const makeAddPlayerElements = () => ({
            modal: createModalNode('add-player-modal'),
            cancelBtn: createNode('cancel-add-player-modal-btn'),
            loadBtn: createNode('load-player-modal-btn', '', { disabled: false }),
            tagInput: createNode('player-tag-input-modal', '', { value: '' }),
            errorEl: createNode('player-tag-error-message', '', { textContent: '' })
        });

        const firstSet = makeAddPlayerElements();
        const noticeModal = createModalNode('notice-modal');
        let openList = [firstSet.modal, noticeModal];

        const map = new Map();
        const syncMap = (set) => {
            map.set('add-player-modal', set.modal);
            map.set('cancel-add-player-modal-btn', set.cancelBtn);
            map.set('load-player-modal-btn', set.loadBtn);
            map.set('player-tag-input-modal', set.tagInput);
            map.set('player-tag-error-message', set.errorEl);
            map.set('notice-modal', noticeModal);
        };
        syncMap(firstSet);

        const doc = createDocHost(map, () => openList);
        const origDoc = globalThis.document;
        globalThis.document = /** @type {any} */ (doc);

        try {
            const mainScope = new RouteLifecycleScope();
            initializePlayerModal(mainScope);
            firstSet.modal.classList.remove('closing');
            firstSet.modal.classList.add('show');
            firstSet.modal.open = true;

            dispatchKey(doc, 'Escape');
            assert.equal(firstSet.modal.classList.contains('closing'), false);

            openList = [firstSet.modal];
            dispatchKey(doc, 'Escape');
            assert.equal(firstSet.modal.classList.contains('closing'), true);

            firstSet.modal.classList.remove('closing');
            mainScope.dispose();
            dispatchKey(doc, 'Escape');
            assert.equal(firstSet.modal.classList.contains('closing'), false);

            const nextSet = makeAddPlayerElements();
            syncMap(nextSet);
            openList = [nextSet.modal];

            const standaloneScope = new RouteLifecycleScope();
            initStandaloneAddPlayerModal({
                onLoadPlayer: async () => ({ success: true }),
                scope: standaloneScope
            });

            dispatchKey(doc, 'Escape');
            assert.equal(nextSet.modal.classList.contains('closing'), true);

            nextSet.modal.classList.remove('closing');
            standaloneScope.dispose();
            dispatchKey(doc, 'Escape');
            assert.equal(nextSet.modal.classList.contains('closing'), false);
        } finally {
            globalThis.document = origDoc;
        }
    });
});
