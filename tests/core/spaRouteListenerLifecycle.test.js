import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map();
    globalThis.localStorage = /** @type {any} */ ({
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => { store.set(k, String(v)); },
        removeItem: (k) => { store.delete(k); },
        clear: () => { store.clear(); }
    });
}
globalThis.HTMLElement ??= /** @type {any} */ (class {});
globalThis.customElements ??= /** @type {any} */ ({ get: () => null, define: () => {} });
globalThis.MutationObserver ??= /** @type {any} */ (class { observe() {} disconnect() {} });
globalThis.fetch = async (url) => (typeof url === 'string' && url.includes('en.json') ? { ok: true, json: async () => ({}) } : { ok: false, status: 404 });

function createClassList(initial = '') {
    const classes = new Set(String(initial).split(/\s+/).filter(Boolean));
    return {
        add: (...tokens) => { tokens.forEach(t => { if (t) classes.add(t); }); },
        remove: (...tokens) => { tokens.forEach(t => classes.delete(t)); },
        contains: (token) => classes.has(token),
        toggle: (token, force) => {
            const shouldAdd = typeof force === 'boolean' ? force : !classes.has(token);
            if (shouldAdd) classes.add(token);
            else classes.delete(token);
            return shouldAdd;
        }
    };
}

function createTargetNode(props = {}) {
    return Object.assign(new EventTarget(), {
        dataset: {},
        style: {},
        innerHTML: '',
        textContent: '',
        classList: createClassList(props.initialClasses),
        appendChild: (child) => child,
        closest: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        getAttribute: () => null,
        setAttribute: () => {},
        removeAttribute: () => {},
        hasAttribute: () => false,
        contains: () => false,
        focus: () => {},
        getBoundingClientRect: () => ({ top: 100, bottom: 120, left: 100, right: 120, width: 20, height: 20 }),
        ...props
    });
}

describe('SPA Route Listener Lifecycle & DOM Re-Binding Suite', () => {
    test('heroJourneyScrollManager does not attach window resize at import time and cleans up via RouteLifecycleScope', async () => {
        const cancelledFrames = [];
        let rafCount = 0;
        let nextFrameId = 10;

        const origWindow = globalThis.window;
        const origRaf = globalThis.requestAnimationFrame;
        const origCancelRaf = globalThis.cancelAnimationFrame;

        const requestAnimationFrame = () => {
            rafCount += 1;
            nextFrameId += 1;
            return nextFrameId;
        };
        const cancelAnimationFrame = (id) => {
            cancelledFrames.push(id);
        };
        globalThis.requestAnimationFrame = requestAnimationFrame;
        globalThis.cancelAnimationFrame = cancelAnimationFrame;
        globalThis.window = /** @type {any} */ (Object.assign(new EventTarget(), {
            location: { host: 'clashcalc.com', pathname: '/ore-calculator/', search: '', hash: '' },
            history: { state: null, pushState: () => {}, replaceState: () => {}, back: () => {} },
            innerWidth: 1024,
            scrollY: 0,
            requestAnimationFrame,
            cancelAnimationFrame
        }));

        try {
            const { initHeroJourneyResizeListener } = await import('../../js/components/home/heroJourneyScrollManager.js');
            globalThis.window.dispatchEvent(new Event('resize'));
            assert.equal(rafCount, 0, 'Module import must not schedule resize work before init');

            const { RouteLifecycleScope } = await import('../../js/core/routeLifecycleScope.js');
            const scope = new RouteLifecycleScope();

            initHeroJourneyResizeListener(scope);
            initHeroJourneyResizeListener(scope);
            globalThis.window.dispatchEvent(new Event('resize'));
            assert.equal(rafCount, 1, 'Repeated init on same window must not stack resize listeners');

            scope.dispose();
            assert.deepEqual(cancelledFrames, [11]);

            globalThis.window.dispatchEvent(new Event('resize'));
            assert.equal(rafCount, 1, 'Disposing scope must detach window resize listener');
        } finally {
            globalThis.window = origWindow;
            globalThis.requestAnimationFrame = origRaf;
            globalThis.cancelAnimationFrame = origCancelRaf;
        }
    });

    test('heroCard prevents listener stacking on double-init and re-binds when SPA replaces DOM', async () => {
        const { RouteLifecycleScope } = await import('../../js/core/routeLifecycleScope.js');
        const { dom } = await import('../../js/dom/domElements.js');
        const { state } = await import('../../js/core/state.js');
        const { initializeHeroCards } = await import('../../js/components/equipment/heroCard.js');

        const makeSet = () => ({
            container: createTargetNode({ id: 'heroes-container' }),
            comingSoonSwitch: createTargetNode({ id: 'eq-coming-soon-switch', checked: false }),
            emptyAddComingSoonBtn: createTargetNode({ id: 'eq-empty-add-coming-soon-btn' })
        });

        const first = makeSet();
        const second = makeSet();
        let csShowCalls = 0;
        const csHeroOpts = createTargetNode({ id: 'coming-soon-hero-options' });
        const csModal = createTargetNode({
            id: 'add-coming-soon-modal',
            open: false,
            initialClasses: 'modal',
            querySelector: (sel) => (sel === '#coming-soon-hero-options' ? csHeroOpts : null),
            showModal() {
                this.open = true;
                csShowCalls += 1;
            }
        });

        const origDoc = globalThis.document;
        const origDomEq = dom.equipment;
        const origHeroes = state.heroes;
        let current = first;
        state.heroes = state.heroes || {};

        globalThis.document = /** @type {any} */ ({
            body: createTargetNode(),
            createElement: () => createTargetNode(),
            querySelector: () => null,
            querySelectorAll: () => [],
            getElementById: (id) => ({
                'heroes-container': current.container,
                'eq-coming-soon-switch': current.comingSoonSwitch,
                'eq-empty-add-coming-soon-btn': current.emptyAddComingSoonBtn,
                'equipment-details-modal': createTargetNode({ id: 'equipment-details-modal' }),
                'add-coming-soon-modal': csModal
            })[id] || null
        });

        try {
            const scope1 = new RouteLifecycleScope();
            dom.equipment = {
                heroesContainer: first.container,
                comingSoonSwitch: first.comingSoonSwitch,
                emptyAddComingSoonBtn: first.emptyAddComingSoonBtn
            };
            initializeHeroCards(state.heroes, state.uiSettings, state.planner, scope1);
            initializeHeroCards(state.heroes, state.uiSettings, state.planner, scope1);

            first.emptyAddComingSoonBtn.dispatchEvent(new Event('click'));
            assert.equal(csShowCalls, 1, 'Repeated init on same DOM must not stack button listeners');

            csModal.open = false;
            scope1.dispose();

            current = second;
            dom.equipment = {
                heroesContainer: second.container,
                comingSoonSwitch: second.comingSoonSwitch,
                emptyAddComingSoonBtn: second.emptyAddComingSoonBtn
            };
            const scope2 = new RouteLifecycleScope();
            initializeHeroCards(state.heroes, state.uiSettings, state.planner, scope2);
            initializeHeroCards(state.heroes, state.uiSettings, state.planner, scope2);

            second.emptyAddComingSoonBtn.dispatchEvent(new Event('click'));
            assert.equal(csModal.open, true, 'Replaced DOM button must bind cleanly in new scope');
            assert.equal(csShowCalls, 2, 'Repeated init on replaced DOM must not stack button listeners');
            scope2.dispose();
        } finally {
            state.heroes = origHeroes;
            dom.equipment = origDomEq;
            globalThis.document = origDoc;
        }
    });

    test('addComingSoonModal and storedOresModal re-bind cleanly when dialogs are replaced across SPA navigation', async () => {
        const { openAddComingSoonModal } = await import('../../js/components/equipment/addComingSoonModal.js');
        const { initializeStoredOresModal } = await import('../../js/components/planner/storedOresModal.js');

        const makeAddComingSoonSet = () => {
            const heroOpts = createTargetNode({ id: 'coming-soon-hero-options' });
            return {
                modal: createTargetNode({
                    id: 'add-coming-soon-modal',
                    open: false,
                    initialClasses: 'modal',
                    querySelector: (sel) => (sel === '#coming-soon-hero-options' ? heroOpts : null),
                    showModal() { this.open = true; },
                    close() { this.open = false; }
                }),
                closeBtn: createTargetNode({ id: 'close-add-coming-soon-modal-btn' }),
                cancelBtn: createTargetNode({ id: 'cancel-add-coming-soon-modal-btn' }),
                confirmBtn: createTargetNode({ id: 'confirm-add-coming-soon-btn' })
            };
        };

        const makeStoredOresSet = () => ({
            modal: createTargetNode({ id: 'stored-ores-modal', open: true, initialClasses: 'modal', close() { this.open = false; } }),
            closeBtn: createTargetNode({ id: 'close-stored-ores-modal-btn' }),
            cancelBtn: createTargetNode({ id: 'cancel-stored-ores-modal-btn' }),
            saveBtn: createTargetNode({ id: 'save-stored-ores-modal-btn' })
        });

        let activeCs = makeAddComingSoonSet();
        let activeStored = makeStoredOresSet();
        const origDoc = globalThis.document;

        globalThis.document = /** @type {any} */ ({
            body: createTargetNode(),
            createElement: () => createTargetNode(),
            querySelector: () => null,
            querySelectorAll: () => [],
            getElementById: (id) => ({
                'add-coming-soon-modal': activeCs.modal,
                'close-add-coming-soon-modal-btn': activeCs.closeBtn,
                'cancel-add-coming-soon-modal-btn': activeCs.cancelBtn,
                'confirm-add-coming-soon-btn': activeCs.confirmBtn,
                'stored-ores-modal': activeStored.modal,
                'close-stored-ores-modal-btn': activeStored.closeBtn,
                'cancel-stored-ores-modal-btn': activeStored.cancelBtn,
                'save-stored-ores-modal-btn': activeStored.saveBtn
            })[id] || null
        });

        try {
            openAddComingSoonModal();
            activeCs = makeAddComingSoonSet();
            openAddComingSoonModal();
            activeCs.cancelBtn.dispatchEvent(new Event('click'));
            assert.equal(activeCs.modal.classList.contains('closing'), true);

            initializeStoredOresModal();
            activeStored = makeStoredOresSet();
            initializeStoredOresModal();
            activeStored.closeBtn.dispatchEvent(new Event('click'));
            assert.equal(activeStored.modal.classList.contains('closing'), true);
        } finally {
            globalThis.document = origDoc;
        }
    });

    test('damageCalcFilterInputs deduplicates root click listeners, uses latest state, and detaches on dispose()', async () => {
        const { RouteLifecycleScope } = await import('../../js/core/routeLifecycleScope.js');
        const { attachDamageCalcFilterListeners } = await import('../../js/components/damage/damageCalcFilterInputs.js');

        const root = createTargetNode();
        const origDoc = globalThis.document;
        globalThis.document = /** @type {any} */ ({
            body: root,
            getElementById: () => null,
            querySelector: () => null,
            querySelectorAll: () => []
        });

        try {
            const scope1 = new RouteLifecycleScope();
            const state1 = { zapQuake: { searchQuery: 'first', buildingFilter: 'all' } };
            const state2 = { zapQuake: { searchQuery: 'second', buildingFilter: 'all' } };

            attachDamageCalcFilterListeners(state1, root, () => {}, scope1);
            attachDamageCalcFilterListeners(state2, root, () => {}, scope1);

            const clickEv = new Event('click', { bubbles: true });
            Object.defineProperty(clickEv, 'target', {
                value: { closest: (sel) => (sel === '[data-action="clear-zq-search"]' ? {} : null) },
                enumerable: true
            });
            root.dispatchEvent(clickEv);

            assert.equal(state2.zapQuake.searchQuery, '');
            assert.equal(state1.zapQuake.searchQuery, 'first');

            scope1.dispose();
            state2.zapQuake.searchQuery = 'archer';
            root.dispatchEvent(clickEv);
            assert.equal(state2.zapQuake.searchQuery, 'archer');

            const scope2 = new RouteLifecycleScope();
            attachDamageCalcFilterListeners(state2, root, () => {}, scope2);
            root.dispatchEvent(clickEv);
            assert.equal(state2.zapQuake.searchQuery, '');
            scope2.dispose();
        } finally {
            globalThis.document = origDoc;
        }
    });

    test('damageCalcPopoversInputs ignores bare .info-btn triggers and cleans up popover state on dispose()', async () => {
        const { RouteLifecycleScope } = await import('../../js/core/routeLifecycleScope.js');
        const { attachDamageCalcPopoverListeners } = await import('../../js/components/damage/damageCalcPopoversInputs.js');

        const root = createTargetNode();
        const helpPopover = createTargetNode({ id: 'card-help-popover' });
        const origDoc = globalThis.document;
        const origWindow = globalThis.window;

        globalThis.window = /** @type {any} */ ({ innerWidth: 1024, innerHeight: 768 });
        globalThis.document = /** @type {any} */ ({
            body: root,
            addEventListener: () => {},
            removeEventListener: () => {},
            getElementById: (id) => (id === 'card-help-popover' ? helpPopover : null),
            querySelector: () => null,
            querySelectorAll: () => []
        });

        const makeTrigger = (selectors, attrs = {}) => {
            const selectorSet = new Set(selectors);
            const node = createTargetNode({
                getAttribute: (name) => (Object.hasOwn(attrs, name) ? attrs[name] : null),
                closest: (sel) => (sel.split(',').some(part => selectorSet.has(part.trim())) ? node : null)
            });
            return node;
        };

        const dispatchRootEvent = (type, target, extra = {}) => {
            let propagated = true;
            const ev = Object.assign(new Event(type, { bubbles: true, cancelable: true }), extra);
            ev.stopPropagation = () => { propagated = false; };
            Object.defineProperty(ev, 'target', { value: target, enumerable: true });
            root.dispatchEvent(ev);
            return propagated;
        };

        try {
            const bareInfoBtn = makeTrigger(['.info-btn']);
            const calcInfoBtn = makeTrigger(['[data-calc-info]', '.info-btn'], { 'data-calc-info': 'supercharge' });

            const scope1 = new RouteLifecycleScope();
            attachDamageCalcPopoverListeners(root, {}, scope1);
            attachDamageCalcPopoverListeners(root, {}, scope1);

            // Bare .info-btn without Damage Calculator attributes must not open or stopPropagation
            assert.equal(dispatchRootEvent('click', bareInfoBtn), true);
            assert.equal(helpPopover.classList.contains('show'), false);

            // Hovering calc trigger opens popover; moving pointer out of bare .info-btn must keep it open
            dispatchRootEvent('pointerover', calcInfoBtn, { pointerType: 'mouse' });
            assert.equal(helpPopover.classList.contains('show'), true);

            dispatchRootEvent('pointerout', bareInfoBtn, { pointerType: 'mouse', relatedTarget: null });
            assert.equal(helpPopover.classList.contains('show'), true);

            dispatchRootEvent('pointerout', calcInfoBtn, { pointerType: 'mouse', relatedTarget: null });
            assert.equal(helpPopover.classList.contains('show'), false);

            // Clicking twice-initialized trigger toggles once (open), proving no stacked listeners
            assert.equal(dispatchRootEvent('click', calcInfoBtn), false);
            assert.equal(helpPopover.classList.contains('show'), true);

            scope1.dispose();
            assert.equal(helpPopover.classList.contains('show'), false);
            assert.equal(dispatchRootEvent('click', calcInfoBtn), true);
            assert.equal(helpPopover.classList.contains('show'), false);

            const scope2 = new RouteLifecycleScope();
            attachDamageCalcPopoverListeners(root, {}, scope2);
            dispatchRootEvent('click', calcInfoBtn);
            assert.equal(helpPopover.classList.contains('show'), true);
            scope2.dispose();
            await new Promise(resolve => setTimeout(resolve, 10));
        } finally {
            globalThis.window = origWindow;
            globalThis.document = origDoc;
        }
    });

    test('damageCalcClusterInputs mobile dock scroll listener detaches on RouteLifecycleScope.dispose()', async () => {
        const { RouteLifecycleScope } = await import('../../js/core/routeLifecycleScope.js');
        const { attachClusterPlannerListeners } = await import('../../js/components/damage/damageCalcClusterInputs.js');

        const origWindow = globalThis.window;
        const origDoc = globalThis.document;
        const dock = createTargetNode({ id: 'calc-mobile-spell-dock' });
        const root = createTargetNode();
        const win = Object.assign(new EventTarget(), { scrollY: 150 });

        globalThis.window = /** @type {any} */ (win);
        globalThis.document = /** @type {any} */ ({
            body: root,
            getElementById: (id) => (id === 'calc-mobile-spell-dock' ? dock : null)
        });

        try {
            const scope1 = new RouteLifecycleScope();
            const clusterState = { zapQuake: { mobileDockExpanded: false } };
            attachClusterPlannerListeners(clusterState, root, () => {}, scope1);

            win.scrollY = 200;
            win.dispatchEvent(new Event('scroll'));
            assert.equal(dock.classList.contains('is-scrolled-down'), true);

            dock.classList.remove('is-scrolled-down');
            scope1.dispose();
            win.scrollY = 260;
            win.dispatchEvent(new Event('scroll'));
            assert.equal(dock.classList.contains('is-scrolled-down'), false);

            const scope2 = new RouteLifecycleScope();
            attachClusterPlannerListeners(clusterState, root, () => {}, scope2);
            win.scrollY = 320;
            win.dispatchEvent(new Event('scroll'));
            assert.equal(dock.classList.contains('is-scrolled-down'), true);
            scope2.dispose();
        } finally {
            globalThis.window = origWindow;
            globalThis.document = origDoc;
        }
    });

    test('shopOffersInputs scopes languageChanged listener via RouteLifecycleScope without stacking across SPA visits', async () => {
        const { RouteLifecycleScope } = await import('../../js/core/routeLifecycleScope.js');
        const { dom } = await import('../../js/dom/domElements.js');
        const { initializeShopOffers } = await import('../../js/components/income/shopOffersInputs.js');

        let optionCreates = 0;
        const doc = new EventTarget();
        const origDoc = globalThis.document;
        const origDomIncome = dom.income;

        globalThis.document = /** @type {any} */ (Object.assign(doc, {
            createElement: (tag) => {
                if (tag === 'option') optionCreates += 1;
                return createTargetNode();
            },
            getElementById: () => null,
            querySelector: () => null,
            querySelectorAll: () => []
        }));

        try {
            const selector = createTargetNode({ id: 'inc-shop-offers-select' });
            const checkboxes = createTargetNode({ id: 'inc-shop-offers-checkboxes' });
            dom.income = { shopOffers: { dropdown: selector, checkboxes } };

            const scope1 = new RouteLifecycleScope();
            initializeShopOffers(scope1);
            const singleRenderOptionCount = optionCreates;
            assert.ok(singleRenderOptionCount > 0);

            initializeShopOffers(scope1);
            optionCreates = 0;
            doc.dispatchEvent(new Event('languageChanged'));
            assert.equal(optionCreates, singleRenderOptionCount, 'Double init must not stack languageChanged listeners');

            scope1.dispose();
            optionCreates = 0;
            doc.dispatchEvent(new Event('languageChanged'));
            assert.equal(optionCreates, 0, 'Disposing scope must detach languageChanged listener');

            const scope2 = new RouteLifecycleScope();
            initializeShopOffers(scope2);
            optionCreates = 0;
            doc.dispatchEvent(new Event('languageChanged'));
            assert.equal(optionCreates, singleRenderOptionCount);
            scope2.dispose();
        } finally {
            dom.income = origDomIncome;
            globalThis.document = origDoc;
        }
    });
});
