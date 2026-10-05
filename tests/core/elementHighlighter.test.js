import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

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
}

class MockElement {
    constructor(tagName) {
        this.tagName = String(tagName).toUpperCase();
        this.classList = new MockClassList();
        this.attributes = new Map();
        this.children = [];
        this.parentNode = null;
        this.parentElement = null;
        this.offsetWidth = 0;
        this.offsetHeight = 0;
        this.style = {};
    }

    get className() {
        return Array.from(this.classList._classes).join(' ');
    }

    set className(val) {
        this.classList = new MockClassList(val);
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    getAttribute(name) {
        return this.attributes.get(name) ?? null;
    }

    appendChild(child) {
        this.children.push(child);
        child.parentNode = this;
        child.parentElement = this;
        return child;
    }

    removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx !== -1) {
            this.children.splice(idx, 1);
            child.parentNode = null;
            child.parentElement = null;
        }
        return child;
    }

    remove() {
        if (this.parentNode) {
            this.parentNode.removeChild(this);
        }
    }

    closest() {
        return null;
    }

    scrollIntoView() {}
}

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        createElement(tag) {
            return new MockElement(tag);
        },
        createElementNS(ns, tag) {
            return new MockElement(tag);
        },
        querySelector() {
            return null;
        },
        addEventListener() {},
        removeEventListener() {}
    };
} else {
    if (!globalThis.document.createElement) {
        globalThis.document.createElement = (tag) => new MockElement(tag);
    }
    if (!globalThis.document.createElementNS) {
        globalThis.document.createElementNS = (ns, tag) => new MockElement(tag);
    }
}

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        getComputedStyle() {
            return { borderRadius: '12px' };
        }
    };
}

const { highlightElementWithSnake } = await import('../../js/ui/elementHighlighter.js');

describe('Element Highlighter with Snake Animation Suite', () => {
    let mockTarget;

    beforeEach(() => {
        mockTarget = new MockElement('div');
        mockTarget.offsetWidth = 400;
        mockTarget.offsetHeight = 120;
    });

    afterEach(() => {
        mockTarget = null;
    });

    test('gracefully handles null, undefined, or missing target without throwing', () => {
        const dismiss1 = highlightElementWithSnake(null);
        assert.equal(typeof dismiss1, 'function');
        dismiss1();

        const dismiss2 = highlightElementWithSnake(undefined);
        assert.equal(typeof dismiss2, 'function');
        dismiss2();

        const dismiss3 = highlightElementWithSnake('#non-existent-selector-12345');
        assert.equal(typeof dismiss3, 'function');
        dismiss3();
    });

    test('injects snake overlay and SVG rect with correct attributes on valid element', () => {
        const dismiss = highlightElementWithSnake(mockTarget, {
            durationMs: 0,
            offset: 4,
            borderRadius: 16,
            strokeWidth: 2.5
        });

        assert.equal(mockTarget.classList.contains('has-snake-highlight'), true);
        assert.equal(mockTarget.children.length, 1);

        const overlay = mockTarget.children[0];
        assert.equal(overlay.className, 'snake-highlight-overlay');
        assert.equal(overlay.children.length, 1);

        const svg = overlay.children[0];
        assert.equal(svg.children.length, 1);

        const rect = svg.children[0];
        assert.equal(rect.getAttribute('fill'), 'none');
        assert.equal(rect.getAttribute('stroke-linecap'), 'round');
        assert.equal(rect.getAttribute('stroke-width'), '2.5');

        // Geometric verification for 400x120 target with offset 4:
        // svgW = 400 + 8 = 408, svgH = 120 + 8 = 128
        assert.equal(rect.getAttribute('x'), '-4');
        assert.equal(rect.getAttribute('y'), '-4');
        assert.equal(rect.getAttribute('width'), '408');
        assert.equal(rect.getAttribute('height'), '128');
        assert.equal(rect.getAttribute('rx'), '16');
        assert.equal(rect.getAttribute('ry'), '16');

        // Perimeter math: 2 * (408 + 128) - 8 * 16 + 2 * Math.PI * 16
        // = 2 * 536 - 128 + 32 * Math.PI = 1072 - 128 + 100.53096... = 1044.53096...
        const expectedPerimeter = 2 * (408 + 128) - 8 * 16 + 2 * Math.PI * 16;
        const expectedSnakeLen = expectedPerimeter * 0.15;
        const expectedDur = (expectedPerimeter / 260).toFixed(3);

        assert.equal(
            rect.getAttribute('stroke-dasharray'),
            `${expectedSnakeLen} ${expectedPerimeter - expectedSnakeLen}`
        );

        const anim = rect.children[0];
        assert.equal(anim.getAttribute('dur'), `${expectedDur}s`);
        assert.equal(anim.getAttribute('values'), `0;${-expectedPerimeter}`);

        dismiss();
    });

    test('dismiss function cleanly initiates fade-out and unregisters active state', () => {
        const dismiss = highlightElementWithSnake(mockTarget, { durationMs: 0 });
        const overlay = mockTarget.children[0];

        assert.equal(overlay.classList.contains('fade-out'), false);
        dismiss();
        assert.equal(overlay.classList.contains('fade-out'), true);

        // Calling dismiss again is idempotent and does not error
        dismiss();
    });

    test('re-highlighting the same target automatically cleans up previous active highlight', () => {
        const _dismiss1 = highlightElementWithSnake(mockTarget, { durationMs: 0 });
        const firstOverlay = mockTarget.children[0];
        assert.equal(firstOverlay.classList.contains('fade-out'), false);

        // Trigger second highlight on same element
        const dismiss2 = highlightElementWithSnake(mockTarget, { durationMs: 0 });
        assert.equal(firstOverlay.classList.contains('fade-out'), true);

        dismiss2();
    });
});
