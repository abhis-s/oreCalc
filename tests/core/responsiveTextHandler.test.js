import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

class MockElement {
    constructor(tagName, id = '', className = '') {
        this.tagName = tagName.toUpperCase();
        this.id = id;
        this.className = className;
        this.classList = {
            contains: (c) => this.className.split(/\s+/).includes(c)
        };
        this.parentElement = null;
        this.attributes = new Map();
        this.textContent = '';
        this.scrollWidth = 100;
        this.clientWidth = 100;
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    getAttribute(name) {
        return this.attributes.get(name) ?? null;
    }

    matches(selector) {
        if (selector.startsWith('.')) {
            return this.classList.contains(selector.slice(1));
        }
        if (selector.startsWith('#')) {
            return this.id === selector.slice(1);
        }
        return this.tagName.toLowerCase() === selector.toLowerCase();
    }

    closest(selector) {
        let current = this;
        while (current) {
            if (current.matches && current.matches(selector)) {
                return current;
            }
            current = current.parentElement;
        }
        return null;
    }
}

const elementsById = new Map();
const elementsBySelector = new Map();

if (typeof globalThis.window === 'undefined') {
    globalThis.window = /** @type {any} */ ({
        addEventListener: () => {},
        removeEventListener: () => {},
        requestAnimationFrame: (cb) => {
            cb();
            return 1;
        }
    });
}

if (typeof globalThis.document === 'undefined') {
    globalThis.document = /** @type {any} */ ({
        addEventListener: () => {},
        removeEventListener: () => {},
        getElementById: (id) => elementsById.get(id) || null,
        querySelector: (sel) => elementsBySelector.get(sel) || null,
        body: new MockElement('body')
    });
}

const { updateResponsiveText, requestResponsiveTextUpdate } = await import('../../js/utils/responsiveTextHandler.js');

describe('Responsive Text Handler Feature Domain Suite', () => {
    let incomeHeader;
    let incomeSummaryTitle;
    let equipmentHeader;
    let resultsTitleSpan;

    beforeEach(() => {
        elementsById.clear();
        elementsBySelector.clear();

        // Build mock DOM for Income Summary
        incomeHeader = new MockElement('div', '', 'income-header');
        incomeSummaryTitle = new MockElement('h2', '', 'income-summary-title');
        incomeSummaryTitle.parentElement = incomeHeader;

        elementsBySelector.set('.income-summary-title', incomeSummaryTitle);

        // Build mock DOM for Equipment Required Ores
        equipmentHeader = new MockElement('h2', 'results-title', 'results-title');
        resultsTitleSpan = new MockElement('span', 'results-title-text');
        resultsTitleSpan.parentElement = equipmentHeader;

        elementsById.set('results-title-text', resultsTitleSpan);
    });

    test('resolves .income-header container for .income-summary-title and avoids self-matching h2', () => {
        incomeHeader.clientWidth = 500;
        incomeHeader.scrollWidth = 250;

        updateResponsiveText();

        assert.equal(incomeSummaryTitle.getAttribute('data-i18n'), 'views.income.summaryTitle');
        assert.ok(incomeSummaryTitle.textContent.length > 0);
    });

    test('switches .income-summary-title to summaryTitleShort when .income-header overflows', () => {
        incomeHeader.clientWidth = 240;
        incomeHeader.scrollWidth = 360;

        updateResponsiveText();

        assert.equal(incomeSummaryTitle.getAttribute('data-i18n'), 'views.income.summaryTitleShort');
        assert.ok(incomeSummaryTitle.textContent.length > 0);
    });

    test('switches results-title-text to short key when h2 container overflows', () => {
        equipmentHeader.clientWidth = 120;
        equipmentHeader.scrollWidth = 220;

        updateResponsiveText();

        assert.equal(resultsTitleSpan.getAttribute('data-i18n'), 'views.income.ores.requiredShort');
        assert.ok(resultsTitleSpan.textContent.length > 0);
    });

    test('restores full key when overflowing container is enlarged and no longer overflows', () => {
        incomeHeader.clientWidth = 200;
        incomeHeader.scrollWidth = 350;
        updateResponsiveText();
        assert.equal(incomeSummaryTitle.getAttribute('data-i18n'), 'views.income.summaryTitleShort');

        incomeHeader.clientWidth = 600;
        incomeHeader.scrollWidth = 250;
        updateResponsiveText();
        assert.equal(incomeSummaryTitle.getAttribute('data-i18n'), 'views.income.summaryTitle');
    });

    test('requestResponsiveTextUpdate successfully schedules and runs without throwing', () => {
        assert.doesNotThrow(() => {
            requestResponsiveTextUpdate();
        });
    });
});
