import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

describe('Native HTMLDialogElement Overlay Architecture', () => {
    describe('HTML Partial Templates Verification', () => {
        test('All modal partial templates in partials/modals/*.html use <dialog> elements', () => {
            const modalsDir = path.join(projectRoot, 'partials/modals');
            const modalFiles = fs.readdirSync(modalsDir).filter(file => file.endsWith('.html'));

            assert.ok(modalFiles.length >= 20, `Must find at least 20 modal template files in ${modalsDir}`);

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

    describe('Native HTML Popover & Accessible Tooltip Runtime Attributes', () => {
        test('showCardHelpPopover configures popover="auto", role="tooltip", and aria-describedby on target', async () => {
            const { showCardHelpPopover, hideCardHelpPopover } = await import('../../js/utils/cardHelpPopover.js');
            const prevDoc = globalThis.document;
            const prevWin = globalThis.window;

            const attrs = new Map();
            const targetAttrs = new Map();
            const createdPopover = {
                id: '',
                className: '',
                innerHTML: '',
                style: {},
                dataset: {},
                classList: {
                    add() {},
                    remove() {},
                    contains() { return false; }
                },
                setAttribute(k, v) { attrs.set(k, v); },
                getAttribute(k) { return attrs.get(k) ?? null; },
                hasAttribute(k) { return attrs.has(k); },
                addEventListener() {},
                getBoundingClientRect() {
                    return { top: 0, left: 0, width: 100, height: 40, bottom: 40, right: 100 };
                }
            };

            const targetEl = {
                setAttribute(k, v) { targetAttrs.set(k, v); },
                getAttribute(k) { return targetAttrs.get(k) ?? null; },
                removeAttribute(k) { targetAttrs.delete(k); },
                contains() { return false; },
                getBoundingClientRect() {
                    return { top: 50, left: 50, width: 24, height: 24, bottom: 74, right: 74 };
                }
            };

            globalThis.window = /** @type {any} */ ({
                innerWidth: 1024,
                innerHeight: 768
            });
            globalThis.document = /** @type {any} */ ({
                body: {
                    appendChild() {}
                },
                getElementById(id) {
                    return id === 'card-help-popover' ? createdPopover : null;
                },
                createElement() {
                    return createdPopover;
                },
                addEventListener() {}
            });

            try {
                showCardHelpPopover(/** @type {any} */ (targetEl), 'Helpful tooltip text');
                assert.equal(createdPopover.getAttribute('popover'), 'auto');
                assert.equal(createdPopover.getAttribute('role'), 'tooltip');
                assert.equal(targetEl.getAttribute('aria-describedby'), 'card-help-popover');

                hideCardHelpPopover();
                assert.equal(targetEl.getAttribute('aria-describedby'), null);
            } finally {
                globalThis.document = prevDoc;
                globalThis.window = prevWin;
            }
        });
    });

    describe('Accessibility Landmark Architecture', () => {
        test('All primary tool HTML templates define canonical main-content ID on <main>', () => {
            const toolTemplates = [
                'index.html',
                'ore-calculator/index.html',
                'hero-journey/index.html',
                'damage-calculator/index.html',
                'account/index.html'
            ];

            for (const relPath of toolTemplates) {
                const fullPath = path.join(projectRoot, relPath);
                assert.equal(fs.existsSync(fullPath), true, `${relPath} must exist in source tree`);
                const html = fs.readFileSync(fullPath, 'utf8');
                assert.ok(
                    html.includes('id="main-content"'),
                    `${relPath} must define id="main-content" on its <main> element`
                );
            }
        });
    });
});
