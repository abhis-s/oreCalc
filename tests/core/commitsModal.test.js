import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { showCommitsModal, initializeCommitsModal } from '../../js/components/changelog/commitsModal.js';

describe('Commits Modal Domain Suite', () => {
    let originalWindow;
    let originalDocument;
    let mockElements;
    let listenersMap;

    beforeEach(() => {
        originalWindow = global.window;
        originalDocument = global.document;
        listenersMap = new Map();

        mockElements = {
            'commits-modal': {
                id: 'commits-modal',
                open: false,
                dataset: {},
                classList: {
                    _classes: new Set(),
                    add(c) { this._classes.add(c); },
                    remove(c) { this._classes.delete(c); },
                    contains(c) { return this._classes.has(c); }
                },
                querySelector(selector) {
                    if (selector.includes('h2')) {
                        return mockElements['commits-modal-title'];
                    }
                    return null;
                },
                showModal() {
                    this.open = true;
                },
                close() {
                    this.open = false;
                }
            },
            'commits-modal-title': {
                textContent: '',
                setAttribute(k, v) { this[k] = v; }
            },
            'commits-modal-body': {
                id: 'commits-modal-body',
                innerHTML: ''
            },
            'close-commits-modal-btn': {
                id: 'close-commits-modal-btn',
                addEventListener(event, fn) {
                    if (!listenersMap.has('close-btn')) {
                        listenersMap.set('close-btn', []);
                    }
                    listenersMap.get('close-btn').push({ event, fn });
                }
            }
        };

        global.document = {
            getElementById: (id) => mockElements[id] || null,
            querySelector: () => null,
            querySelectorAll: () => []
        };

        global.window = {
            __ENV__: {
                COMMITS_SINCE_TAG: []
            },
            isAppStartingUp: false
        };
    });

    afterEach(() => {
        global.window = originalWindow;
        global.document = originalDocument;
    });

    test('showCommitsModal opens modal and populates body without requiring dom.overlay', () => {
        const sampleCommits = [
            { hash: 'a1b2c3d', subject: 'feat(planner): add live summary calculation' },
            { hash: 'e4f5g6h', subject: 'fix(profile): prevent chip overflow' }
        ];

        showCommitsModal(sampleCommits);

        const modal = mockElements['commits-modal'];
        const body = mockElements['commits-modal-body'];

        assert.equal(modal.open, true);
        assert.equal(modal.classList.contains('show'), true);
        assert.ok(body.innerHTML.includes('type-feat'));
        assert.ok(body.innerHTML.includes('planner:'));
        assert.ok(body.innerHTML.includes('add live summary calculation'));
        assert.ok(body.innerHTML.includes('a1b2c3d'));
        assert.ok(body.innerHTML.includes('type-fix'));
        assert.ok(body.innerHTML.includes('prevent chip overflow'));
    });

    test('showCommitsModal parses milestone subjects into highlights section', () => {
        const sampleCommits = [
            { hash: 'm123456', subject: 'milestone(v2.3): Major feature release' },
            { hash: 'c789012', subject: 'chore(deps): bump dependencies' }
        ];

        showCommitsModal(sampleCommits);

        const body = mockElements['commits-modal-body'];
        assert.ok(body.innerHTML.includes('milestones-section'));
        assert.ok(body.innerHTML.includes('Major feature release'));
        assert.ok(body.innerHTML.includes('type-chore'));
        assert.ok(body.innerHTML.includes('bump dependencies'));
    });

    test('showCommitsModal activates overlay when overlay element exists in DOM', () => {
        const overlayElement = {
            classList: {
                _classes: new Set(),
                add(c) { this._classes.add(c); },
                remove(c) { this._classes.delete(c); },
                contains(c) { return this._classes.has(c); }
            }
        };
        mockElements['overlay'] = overlayElement;

        const sampleCommits = [
            { hash: '1234567', subject: 'feat: test overlay activation' }
        ];

        showCommitsModal(sampleCommits);

        assert.equal(overlayElement.classList.contains('show'), true);
    });

    test('initializeCommitsModal is idempotent and prevents duplicate listener registrations', () => {
        initializeCommitsModal();
        assert.equal(listenersMap.get('close-btn')?.length, 1);
        assert.equal(mockElements['commits-modal'].dataset.commitsInitialized, 'true');

        initializeCommitsModal();
        assert.equal(listenersMap.get('close-btn')?.length, 1);
    });

    test('showCommitsModal does not open when application is starting up', () => {
        global.window.isAppStartingUp = true;
        const sampleCommits = [{ hash: '1234567', subject: 'feat: ignored commit' }];

        showCommitsModal(sampleCommits);

        const modal = mockElements['commits-modal'];
        assert.equal(modal.open, false);
        assert.equal(modal.classList.contains('show'), false);
    });
});
