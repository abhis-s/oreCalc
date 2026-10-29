import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    createRouteTransitionLoaderElement,
    showRouteTransitionLoader,
    hideRouteTransitionLoader
} from '../../js/components/common/routeTransitionLoader.js';

describe('Route Transition Loader Component Suite', () => {

    /**
     * Minimal DOM node shim for Node.js test environment.
     * @param {string} tagName
     * @returns {any}
     */
    function createMockElement(tagName) {
        const children = [];
        const attributes = new Map();
        const classListSet = new Set();

        const el = {
            tagName: tagName.toUpperCase(),
            children,
            textContent: '',
            get className() {
                return Array.from(classListSet).join(' ');
            },
            set className(val) {
                classListSet.clear();
                if (val) {
                    val.split(/\s+/).filter(Boolean).forEach(c => classListSet.add(c));
                }
            },
            classList: {
                add: (c) => classListSet.add(c),
                remove: (c) => classListSet.delete(c),
                contains: (c) => classListSet.has(c)
            },
            setAttribute: (name, val) => attributes.set(name, String(val)),
            getAttribute: (name) => attributes.get(name) || null,
            appendChild: (child) => {
                children.push(child);
                child.parentElement = el;
                return child;
            },
            replaceChildren: (...newChildren) => {
                children.length = 0;
                newChildren.forEach(c => {
                    children.push(c);
                    c.parentElement = el;
                });
            },
            querySelector: (selector) => {
                if (selector === '.route-transition-loader') {
                    return children.find(c => c.classList?.contains('route-transition-loader')) || null;
                }
                return null;
            },
            remove: () => {
                if (el.parentElement) {
                    const idx = el.parentElement.children.indexOf(el);
                    if (idx !== -1) el.parentElement.children.splice(idx, 1);
                }
            }
        };

        return el;
    }

    test('createRouteTransitionLoaderElement constructs accessible 5-dot hierarchy', () => {
        const originalDocument = globalThis.document;
        globalThis.document = {
            createElement: (tag) => createMockElement(tag)
        };

        try {
            const loader = createRouteTransitionLoaderElement();

            assert.equal(loader.className, 'route-transition-loader');
            assert.equal(loader.getAttribute('role'), 'status');
            assert.equal(loader.getAttribute('aria-live'), 'polite');

            const srOnly = loader.children[0];
            assert.ok(srOnly);
            assert.equal(srOnly.className, 'sr-only');
            assert.equal(srOnly.textContent, 'Loading');

            const spinner = loader.children[1];
            assert.ok(spinner);
            assert.equal(spinner.className, 'route-transition-loader__spinner');
            assert.equal(spinner.getAttribute('aria-hidden'), 'true');
            assert.equal(spinner.children.length, 5);

            spinner.children.forEach((dotWrapper) => {
                assert.equal(dotWrapper.className, 'route-transition-loader__dot-wrapper');
                assert.equal(dotWrapper.children.length, 1);
                assert.equal(dotWrapper.children[0].className, 'route-transition-loader__dot');
            });
        } finally {
            globalThis.document = originalDocument;
        }
    });

    test('showRouteTransitionLoader mounts loader into target container', () => {
        const originalDocument = globalThis.document;
        globalThis.document = {
            createElement: (tag) => createMockElement(tag)
        };

        try {
            const container = createMockElement('main');
            const initialChild = createMockElement('div');
            container.appendChild(initialChild);
            assert.equal(container.children.length, 1);

            const loader = showRouteTransitionLoader(container);

            assert.ok(loader);
            assert.equal(container.children.length, 1);
            assert.equal(container.children[0], loader);
            assert.equal(loader.classList.contains('route-transition-loader'), true);
        } finally {
            globalThis.document = originalDocument;
        }
    });

    test('showRouteTransitionLoader returns null when container is missing', () => {
        const result = showRouteTransitionLoader(null);
        assert.equal(result, null);
    });

    test('hideRouteTransitionLoader triggers is-leaving animation and unmounts', async () => {
        const originalDocument = globalThis.document;
        globalThis.document = {
            createElement: (tag) => createMockElement(tag)
        };

        try {
            const container = createMockElement('main');
            const loader = showRouteTransitionLoader(container);
            assert.ok(loader);
            assert.equal(container.children.length, 1);

            hideRouteTransitionLoader(container);
            assert.equal(loader.classList.contains('is-leaving'), true);

            await new Promise(resolve => setTimeout(resolve, 200));
            assert.equal(container.children.length, 0);
        } finally {
            globalThis.document = originalDocument;
        }
    });

    test('hideRouteTransitionLoader handles absent or null container safely', () => {
        assert.doesNotThrow(() => {
            hideRouteTransitionLoader(null);
        });

        const emptyContainer = createMockElement('main');
        assert.doesNotThrow(() => {
            hideRouteTransitionLoader(emptyContainer);
        });
    });
});
