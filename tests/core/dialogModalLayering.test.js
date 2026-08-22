import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { openModal, closeModalAnimated } from '../../js/utils/modalHistoryManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

class MockClassList {
    constructor(initial = '') {
        this._set = new Set(initial.split(/\s+/).filter(Boolean));
    }
    add(...tokens) { tokens.forEach(t => this._set.add(t)); }
    remove(...tokens) { tokens.forEach(t => this._set.delete(t)); }
    contains(token) { return this._set.has(token); }
    has(token) { return this._set.has(token); }
    get size() { return this._set.size; }
    toString() { return Array.from(this._set).join(' '); }
}

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        getElementById: () => null,
        querySelectorAll: () => [],
        querySelector: () => null,
        activeElement: null,
        body: {
            classList: new MockClassList(),
            style: {}
        },
        dispatchEvent: () => true
    };
}

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        addEventListener: () => {},
        removeEventListener: () => {},
        history: { pushState: () => {}, back: () => {} }
    };
}

class MockDialogElement {
    constructor(id = 'test-dialog-modal') {
        this.id = id;
        this.tagName = 'DIALOG';
        this.classList = new MockClassList('modal');
        this.open = false;
        this.closeCalled = false;
        this.showModalCalled = false;
        this.style = {};
        this.dataset = {};
    }

    showModal() {
        this.showModalCalled = true;
        this.open = true;
    }

    close() {
        this.closeCalled = true;
        this.open = false;
    }

    hasAttribute(name) {
        return name in this.style || false;
    }

    getAttribute(name) {
        return null;
    }

    setAttribute(name, value) {
        if (name === 'class') {
            this.classList = new MockClassList(String(value));
        }
    }

    removeAttribute(name) {}

    addEventListener(event, handler) {}

    removeEventListener(event, handler) {}

    querySelectorAll() {

        return [];
    }

    querySelector() {
        return null;
    }

    contains() {
        return false;
    }

    dispatchEvent() {
        return true;
    }
}

describe('Top-Layer Dialog Lifecycle & Text Selection Invariants', () => {

    describe('Modal Dismissal & Top-Layer Lifecycle Integrity', () => {

        test('openModal invokes showModal() and adds show class to native dialog', () => {
            const dialog = new MockDialogElement('test-modal');
            openModal(dialog);

            assert.equal(dialog.showModalCalled, true);
            assert.equal(dialog.open, true);
            assert.equal(dialog.classList.contains('show'), true);
        });

        test('closeModalAnimated removes modal from top layer via modal.close() and cleans up classes', (t, done) => {
            const dialog = new MockDialogElement('test-modal');
            openModal(dialog);

            closeModalAnimated(dialog, () => {
                assert.equal(dialog.closeCalled, true);
                assert.equal(dialog.open, false);
                assert.equal(dialog.classList.contains('show'), false);
                assert.equal(dialog.classList.contains('closing'), false);
                done();
            });
        });

        test('ensures modal controllers across codebase route dismissal through closeModalAnimated or native close', () => {
            const controllersDir = path.join(projectRoot, 'js/components');
            const servicesDir = path.join(projectRoot, 'js/services');

            const scanFiles = (dir) => {
                if (!fs.existsSync(dir)) return [];
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                let files = [];
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        files.push(...scanFiles(fullPath));
                    } else if (entry.name.endsWith('.js')) {
                        files.push(fullPath);
                    }
                }
                return files;
            };

            const jsFiles = [...scanFiles(controllersDir), ...scanFiles(servicesDir)];
            const violations = [];

            for (const file of jsFiles) {
                const content = fs.readFileSync(file, 'utf8');
                const relPath = path.relative(projectRoot, file);

                // Static inspection: classList.remove('show') bypass without dialog closure
                const lines = content.split('\n');
                lines.forEach((line, idx) => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) return;

                    if (/modal\.classList\.remove\(['"]show['"]\)/.test(trimmed) &&
                        !content.includes('closeModalAnimated') &&
                        !content.includes('modal.close()')) {
                        violations.push(`${relPath}:${idx + 1} -> raw modal.classList.remove('show') without modal.close()`);
                    }
                });
            }

            assert.equal(
                violations.length,
                0,
                `Found modal controllers bypassing Top Layer modal.close():\n${violations.join('\n')}`
            );
        });
    });
});
