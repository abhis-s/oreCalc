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

            assert.ok(modalFiles.length >= 24, `Must find at least 24 modal template files in ${modalsDir}`);

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

    describe('SCSS Overlay Architecture Verification', () => {
        test('modal backdrop stylesheet declares dialog.modal UA resets, native backdrop, and starting-style', () => {
            const modalScssPath = path.join(projectRoot, 'css/base/modal/_modal-backdrop.scss');
            const content = fs.readFileSync(modalScssPath, 'utf8');

            assert.match(content, /dialog\.modal/, '_modal-backdrop.scss must style dialog.modal');
            assert.match(content, /::backdrop/, '_modal-backdrop.scss must style native ::backdrop');
            assert.match(content, /@starting-style/, '_modal-backdrop.scss must define @starting-style entrance transition');
            assert.match(content, /allow-discrete/, '_modal-backdrop.scss must declare transition-behavior allow-discrete');
        });

        test('navigation stylesheet declares dialog drawer and native backdrop styling', () => {
            const navScssPath = fs.existsSync(path.join(projectRoot, 'css/components/_navigation-drawer.scss'))
                ? path.join(projectRoot, 'css/components/_navigation-drawer.scss')
                : (fs.existsSync(path.join(projectRoot, 'css/layout/navigation/_nav-drawer.scss'))
                    ? path.join(projectRoot, 'css/layout/navigation/_nav-drawer.scss')
                    : path.join(projectRoot, 'css/layout/_navigation.scss'));
            const content = fs.readFileSync(navScssPath, 'utf8');

            assert.match(content, /dialog\.navigation-drawer/, '_navigation.scss must target dialog.navigation-drawer');
            assert.match(content, /::backdrop/, '_navigation.scss must style native ::backdrop');
        });
    });

    describe('Native HTML Popover API Architecture', () => {
        test('card popovers define popover-open starting styles and discrete transitions', () => {
            const cardsScssPath = fs.existsSync(path.join(projectRoot, 'css/components/cards/_cards-popovers.scss'))
                ? path.join(projectRoot, 'css/components/cards/_cards-popovers.scss')
                : path.join(projectRoot, 'css/components/_cards.scss');
            const content = fs.readFileSync(cardsScssPath, 'utf8');

            assert.match(content, /\.card-help-popover[\s\S]*?:popover-open/, '_cards.scss must style .card-help-popover with :popover-open');
            assert.match(content, /\.card-help-popover[\s\S]*?@starting-style/, '_cards.scss must define @starting-style for .card-help-popover');
            assert.match(content, /\.card-help-popover[\s\S]*?allow-discrete/, '_cards.scss must declare allow-discrete transition on .card-help-popover');
            assert.match(content, /\.card-help-popover[\s\S]*?inset:\s*unset/, '_cards.scss must reset inset: unset on .card-help-popover');

            assert.match(content, /\.input-feature-popover[\s\S]*?:popover-open/, '_cards.scss must style .input-feature-popover with :popover-open');
            assert.match(content, /\.input-feature-popover[\s\S]*?@starting-style/, '_cards.scss must define @starting-style for .input-feature-popover');
            assert.match(content, /\.input-feature-popover[\s\S]*?allow-discrete/, '_cards.scss must declare allow-discrete transition on .input-feature-popover');
            assert.match(content, /\.input-feature-popover[\s\S]*?inset:\s*unset/, '_cards.scss must reset inset: unset on .input-feature-popover');
        });
    });

    describe('Accessible Tooltip Architecture ([role="tooltip"] & aria-describedby)', () => {
        test('income chips and calendar popovers define tooltip accessibility styles', () => {
            const incomeChipsScssPath = path.join(projectRoot, 'css/components/_income-chips.scss');
            const calendarScssPath = path.join(projectRoot, 'css/components/calendar/_calendar-popovers.scss');

            const incomeChipsContent = fs.readFileSync(incomeChipsScssPath, 'utf8');
            const calendarContent = fs.readFileSync(calendarScssPath, 'utf8');

            assert.match(incomeChipsContent, /\[role=["']tooltip["']\]/, '_income-chips.scss must declare [role="tooltip"] selector');
            assert.match(calendarContent, /\[role=["']tooltip["']\]/, '_calendar-popovers.scss must declare [role="tooltip"] selector');
        });
    });
});
