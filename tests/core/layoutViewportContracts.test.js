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

    describe('Universal Header Shell & Partial Parity Contracts', () => {
        const entrypointFiles = [
            'index.html',
            'ore-calculator/index.html',
            'hero-journey/index.html',
            'damage-calculator/index.html',
            'account/index.html'
        ];

        test('All five route index.html shells include universal head, top shell, header-account, and modal partials', () => {
            const headerFiles = [
                'index.html',
                'partials/header.html',
                'damage-calculator/index.html',
                'hero-journey/index.html',
                'account/index.html'
            ];

            for (const relPath of headerFiles) {
                const html = fs.readFileSync(path.join(projectRoot, relPath), 'utf8');
                assert.match(
                    html,
                    /<button[^>]*id="hamburger-btn"[^>]*class="[^"]*app-header__hamburger[^"]*"[^>]*aria-controls="navigation-drawer"/,
                    `${relPath} must define #hamburger-btn with .app-header__hamburger and aria-controls="navigation-drawer"`
                );
            }

            for (const relPath of entrypointFiles) {
                let html = fs.readFileSync(path.join(projectRoot, relPath), 'utf8');
                if (html.includes('partials/header.html')) {
                    html += '\n' + fs.readFileSync(path.join(projectRoot, 'partials/header.html'), 'utf8');
                }
                assert.ok(html.includes('partials/head-theme-bootstrap.html'), `${relPath} must include partials/head-theme-bootstrap.html`);
                assert.ok(html.includes('partials/shell-top.html'), `${relPath} must include partials/shell-top.html`);
                assert.ok(html.includes('partials/header-account.html'), `${relPath} must include partials/header-account.html`);
                assert.ok(html.includes('partials/shell-modals.html'), `${relPath} must include partials/shell-modals.html`);
            }
        });

        test('partials/header-account.html and partials/header-player-dropdown.html provide canonical interactive controls', () => {
            const popoverHtml = fs.readFileSync(path.join(projectRoot, 'partials/header-account.html'), 'utf8');
            assert.ok(popoverHtml.includes('id="header-account-btn"'));
            assert.ok(popoverHtml.includes('id="account-popover-guest-avatar-link"'));
            assert.ok(popoverHtml.includes('id="account-popover-guest-manage-link"'));
            assert.ok(popoverHtml.includes('id="account-popover-signin-btn"'));
            assert.match(popoverHtml, /<div\s+id="app-account-popover"[^>]*\bhidden\b/);
            assert.ok(popoverHtml.includes('id="account-popover-panels"'));
            assert.ok(popoverHtml.includes('id="account-popover-logout-btn"'));

            const dropdownHtml = fs.readFileSync(path.join(projectRoot, 'partials/header-player-dropdown.html'), 'utf8');
            assert.ok(dropdownHtml.includes('id="player-dropdown-btn"'));
            assert.ok(dropdownHtml.includes('id="selected-player-name"'));
            assert.ok(dropdownHtml.includes('id="player-dropdown-list"'));
            assert.ok(dropdownHtml.includes('id="player-items-container"'));
            assert.ok(dropdownHtml.includes('id="add-player-btn"'));
        });
    });
});
