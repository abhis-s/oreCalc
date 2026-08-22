import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { showChangelogModal } from '../../js/components/changelog/changelogModal.js';
import { dom } from '../../js/dom/domElements.js';

describe('Changelog Modal & Commits Button Visibility Domain Suite', () => {
    let originalWindow;
    let originalDocument;
    let mockElements;

    beforeEach(() => {
        originalWindow = global.window;
        originalDocument = global.document;

        mockElements = {
            'changelog-modal': {
                id: 'changelog-modal',
                classList: {
                    _classes: new Set(),
                    add(c) { this._classes.add(c); },
                    remove(c) { this._classes.delete(c); },
                    contains(c) { return this._classes.has(c); }
                }
            },
            'changelog-modal-body': {
                id: 'changelog-modal-body',
                innerHTML: ''
            },
            'changelog-commits-btn': {
                id: 'changelog-commits-btn',
                style: { display: 'none' }
            },
            'welcome-modal': {
                id: 'welcome-modal',
                classList: { contains: () => false }
            },
            'consent-banner': {
                id: 'consent-banner',
                classList: { contains: () => false }
            },
            'consent-modal': {
                id: 'consent-modal',
                classList: { contains: () => false }
            }
        };

        dom.overlay = {
            classList: {
                _classes: new Set(),
                add(c) { this._classes.add(c); },
                remove(c) { this._classes.delete(c); },
                contains(c) { return this._classes.has(c); }
            }
        };

        global.document = {
            getElementById: (id) => mockElements[id] || null,
            querySelector: () => null
        };

        global.window = {
            __ENV__: {
                COMMITS_SINCE_TAG: [
                    { hash: 'a673992', subject: 'test: validate inline HTML script syntax' },
                    { hash: '407d3e0', subject: 'feat: optimize error alerts' }
                ]
            },
            isAppStartingUp: false
        };
    });

    afterEach(() => {
        global.window = originalWindow;
        global.document = originalDocument;
    });

    test('commits button is displayed as inline-flex when commits exist and changelog is non-empty', () => {
        const sampleChangelog = '<div class="changelog-container"><h3>v2.2.0</h3><ul><li>Feature 1</li></ul></div>';
        showChangelogModal(sampleChangelog);

        const commitsBtn = mockElements['changelog-commits-btn'];
        const modal = mockElements['changelog-modal'];

        assert.equal(commitsBtn.style.display, 'inline-flex');
        assert.equal(modal.classList.contains('show'), true);
        assert.equal(mockElements['changelog-modal-body'].innerHTML, sampleChangelog);
    });

    test('commits button is hidden when COMMITS_SINCE_TAG is empty', () => {
        global.window.__ENV__.COMMITS_SINCE_TAG = [];
        const sampleChangelog = '<div class="changelog-container"><h3>v2.2.0</h3></div>';
        showChangelogModal(sampleChangelog);

        const commitsBtn = mockElements['changelog-commits-btn'];
        assert.equal(commitsBtn.style.display, 'none');
    });

    test('commits button is hidden when changelog content is empty', () => {
        showChangelogModal('');

        const commitsBtn = mockElements['changelog-commits-btn'];
        assert.equal(commitsBtn.style.display, 'none');
    });

    test('commits button is hidden when COMMITS_SINCE_TAG is undefined or non-array', () => {
        global.window.__ENV__.COMMITS_SINCE_TAG = undefined;
        const sampleChangelog = '<div class="changelog-container"><h3>v2.2.0</h3></div>';
        showChangelogModal(sampleChangelog);

        const commitsBtn = mockElements['changelog-commits-btn'];
        assert.equal(commitsBtn.style.display, 'none');
    });
});
