import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

describe('Layout & Viewport Hardening Contracts', () => {
    describe('Z-Index Tokens Invariant', () => {
        const variablesScss = fs.readFileSync(path.join(projectRoot, 'css/abstracts/_variables.scss'), 'utf8');

        test('defines monotonically ordered z-index design tokens', () => {
            const extractZIndex = (name) => {
                const match = variablesScss.match(new RegExp(`\\$${name}:\\s*(-?\\d+);`));
                return match ? Number(match[1]) : null;
            };

            const zLayout = extractZIndex('z-index-layout');
            const zDrawer = extractZIndex('z-index-drawer');
            const zModal = extractZIndex('z-index-modal');
            const zPopover = extractZIndex('z-index-popover');
            const zTooltip = extractZIndex('z-index-tooltip');
            const zToast = extractZIndex('z-index-toast');
            const zPreloader = extractZIndex('z-index-preloader');
            const zHighPriority = extractZIndex('z-index-high-priority-modal');

            assert.ok(zLayout !== null && zModal !== null && zPopover !== null && zTooltip !== null);
            assert.ok(zLayout < zDrawer, 'Layout z-index must be lower than drawer');
            assert.ok(zDrawer < zModal, 'Drawer z-index must be lower than modal');
            assert.ok(zModal < zPopover, 'Modal z-index must be lower than popover');
            assert.ok(zPopover <= zTooltip, 'Popover z-index must be <= tooltip');
            assert.ok(zTooltip < zToast, 'Tooltip z-index must be lower than toast');
            assert.ok(zToast < zPreloader, 'Toast z-index must be lower than preloader');
            assert.ok(zPreloader < zHighPriority, 'Preloader z-index must be lower than high priority modal');
        });
    });

    describe('Universal Header Shell & Navigation Drawer Accessibility Contracts', () => {
        const headerFiles = [
            'index.html',
            'partials/header.html',
            'damage-calculator/index.html',
            'hero-journey/index.html',
            'account/index.html'
        ];

        test('All application headers declare accessible hamburger navigation trigger for drawer', () => {
            for (const relPath of headerFiles) {
                const html = fs.readFileSync(path.join(projectRoot, relPath), 'utf8');
                assert.ok(html.includes('id="hamburger-btn"'), `${relPath} must define #hamburger-btn`);
                assert.ok(html.includes('aria-controls="navigation-drawer"'), `${relPath} must control navigation-drawer`);
                assert.ok(html.includes('app-header__hamburger'), `${relPath} must use app-header__hamburger class`);
            }
        });
    });
});
