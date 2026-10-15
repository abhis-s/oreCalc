import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openBugReportModal, openFeedbackModal } from '../../js/components/appSettings/settingsSupportModals.js';

class MockClassList {
    constructor() {
        this._classes = new Set();
    }
    /** @param {string} token */
    add(token) {
        this._classes.add(token);
    }
    /** @param {string} token */
    remove(token) {
        this._classes.delete(token);
    }
    /** @param {string} token */
    contains(token) {
        return this._classes.has(token);
    }
    /**
     * @param {string} token
     * @param {boolean} [force]
     */
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
}

class MockElement {
    /**
     * @param {string} id
     */
    constructor(id = '') {
        this.id = id;
        this.classList = new MockClassList();
        this.attributes = new Map();
        this.value = '';
        this.textContent = '';
        this.placeholder = '';
        this.hidden = false;
        this.disabled = false;
        /** @type {((e: any) => void) | null} */
        this.onclick = null;
        /** @type {((e: any) => void) | null} */
        this.oninput = null;
    }

    /**
     * @param {string} k
     * @param {string} v
     */
    setAttribute(k, v) {
        this.attributes.set(k, String(v));
    }

    /**
     * @param {string} k
     */
    getAttribute(k) {
        return this.attributes.get(k) || null;
    }

    /**
     * @param {string} k
     */
    hasAttribute(k) {
        return this.attributes.has(k);
    }

    /**
     * @param {string} k
     */
    removeAttribute(k) {
        this.attributes.delete(k);
    }

    /**
     * @param {string} selector
     */
    querySelectorAll(selector) {
        return [];
    }
}

describe('Support & Feedback Dual-Mode Modal Domain Suite', () => {
    let originalDoc;
    let originalWindow;
    /** @type {Map<string, MockElement>} */
    let elementsMap;

    beforeEach(() => {
        originalDoc = globalThis.document;
        originalWindow = globalThis.window;

        elementsMap = new Map();
        const ids = [
            'bug-report-modal',
            'support-modal-title',
            'bug-report-modal-title',
            'support-tab-bug',
            'support-tab-feedback',
            'support-modal-info-bug',
            'support-modal-info-feedback',
            'support-desc-label',
            'support-attach-group',
            'support-sw-troubleshoot-box',
            'support-privacy-bug',
            'support-privacy-feedback',
            'support-email',
            'support-email-error',
            'support-desc',
            'support-desc-error',
            'support-char-count',
            'support-attach-checkbox',
            'submit-support-btn',
            'close-support-header-btn',
            'close-support-modal-btn',
            'support-reset-sw-btn',
            'bug-report-email',
            'bug-report-email-error',
            'bug-report-desc',
            'bug-report-desc-error',
            'bug-report-char-count',
            'bug-report-attach-checkbox',
            'submit-bug-report-btn',
            'close-bug-report-header-btn',
            'close-bug-report-modal-btn',
            'bug-report-reset-sw-btn'
        ];

        ids.forEach(id => {
            const el = new MockElement(id);
            elementsMap.set(id, el);
        });

        const modalEl = elementsMap.get('bug-report-modal');
        if (modalEl) {
            modalEl.querySelectorAll = () => [];
        }

        globalThis.document = /** @type {any} */ ({
            getElementById: (id) => elementsMap.get(id) || null,
            querySelectorAll: () => []
        });

        globalThis.window = /** @type {any} */ ({
            addEventListener: () => {},
            removeEventListener: () => {},
            location: { reload: () => {} }
        });
    });

    afterEach(() => {
        globalThis.document = originalDoc;
        globalThis.window = originalWindow;
    });

    test('openBugReportModal defaults to bug mode with troubleshooter and attach group visible', () => {
        openBugReportModal();

        const title = elementsMap.get('support-modal-title') || elementsMap.get('bug-report-modal-title');
        const tabBug = elementsMap.get('support-tab-bug');
        const tabFeedback = elementsMap.get('support-tab-feedback');
        const infoBug = elementsMap.get('support-modal-info-bug');
        const infoFeedback = elementsMap.get('support-modal-info-feedback');
        const attachGroup = elementsMap.get('support-attach-group');
        const swBox = elementsMap.get('support-sw-troubleshoot-box');

        assert.equal(title?.getAttribute('data-i18n'), 'views.settings.bugReport.title');
        assert.equal(tabBug?.classList.contains('active'), true, 'Bug tab should be active');
        assert.equal(tabFeedback?.classList.contains('active'), false, 'Feedback tab should be inactive');
        assert.equal(infoBug?.hidden, false, 'Bug info text should be visible');
        assert.equal(infoFeedback?.hidden, true, 'Feedback info text should be hidden');
        assert.equal(attachGroup?.hidden, false, 'Attach group should be visible in bug mode');
        assert.equal(swBox?.hidden, false, 'SW troubleshooter should be visible in bug mode');
    });

    test('openFeedbackModal opens directly in feedback mode with stripped-down sections hidden', () => {
        openFeedbackModal();

        const title = elementsMap.get('support-modal-title') || elementsMap.get('bug-report-modal-title');
        const tabBug = elementsMap.get('support-tab-bug');
        const tabFeedback = elementsMap.get('support-tab-feedback');
        const infoBug = elementsMap.get('support-modal-info-bug');
        const infoFeedback = elementsMap.get('support-modal-info-feedback');
        const attachGroup = elementsMap.get('support-attach-group');
        const swBox = elementsMap.get('support-sw-troubleshoot-box');

        assert.equal(title?.getAttribute('data-i18n'), 'views.settings.feedback.title');
        assert.equal(tabBug?.classList.contains('active'), false, 'Bug tab should be inactive');
        assert.equal(tabFeedback?.classList.contains('active'), true, 'Feedback tab should be active');
        assert.equal(infoBug?.hidden, true, 'Bug info text should be hidden');
        assert.equal(infoFeedback?.hidden, false, 'Feedback info text should be visible');
        assert.equal(attachGroup?.hidden, true, 'Attach group must be hidden in feedback mode');
        assert.equal(swBox?.hidden, true, 'SW troubleshooter must be hidden in feedback mode');
    });

    test('clicking tabs in support modal switches between bug and feedback modes', () => {
        openBugReportModal();

        const tabFeedback = elementsMap.get('support-tab-feedback');
        const tabBug = elementsMap.get('support-tab-bug');
        const swBox = elementsMap.get('support-sw-troubleshoot-box');
        const attachGroup = elementsMap.get('support-attach-group');

        assert.equal(swBox?.hidden, false, 'Initial bug mode: SW box visible');

        // Click feedback tab
        assert.ok(typeof tabFeedback?.onclick === 'function');
        tabFeedback.onclick({ preventDefault: () => {} });

        assert.equal(swBox?.hidden, true, 'Switched to feedback: SW box hidden');
        assert.equal(attachGroup?.hidden, true, 'Switched to feedback: attach group hidden');
        assert.equal(tabFeedback?.classList.contains('active'), true);
        assert.equal(tabBug?.classList.contains('active'), false);

        // Click bug tab
        assert.ok(typeof tabBug?.onclick === 'function');
        tabBug.onclick({ preventDefault: () => {} });

        assert.equal(swBox?.hidden, false, 'Switched back to bug: SW box visible');
        assert.equal(attachGroup?.hidden, false, 'Switched back to bug: attach group visible');
        assert.equal(tabBug?.classList.contains('active'), true);
        assert.equal(tabFeedback?.classList.contains('active'), false);
    });
});
