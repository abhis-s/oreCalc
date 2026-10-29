import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

describe('Header Account Popover & Modal Parity Suite', () => {
    const entrypointFiles = [
        'index.html',
        'hero-journey/index.html',
        'damage-calculator/index.html',
        'ore-calculator/index.html'
    ];

    it('ensures all entrypoints include the unified header account component', () => {
        const headerPartial = fs.readFileSync(path.join(projectRoot, 'partials/header.html'), 'utf8');
        assert.ok(headerPartial.includes('partials/header-account.html'), 'partials/header.html must include partials/header-account.html');

        for (const relPath of ['index.html', 'hero-journey/index.html', 'damage-calculator/index.html']) {
            const content = fs.readFileSync(path.join(projectRoot, relPath), 'utf8');
            assert.ok(content.includes('partials/header-account.html'), `${relPath} must include partials/header-account.html`);
        }
    });

    it('ensures all entrypoints include the complete set of support, sync, and legal modals', () => {
        const requiredModals = [
            'partials/modals/licenses.html',
            'partials/modals/bug-report.html',
            'partials/modals/contact.html',
            'partials/modals/running-costs.html'
        ];

        for (const relPath of entrypointFiles) {
            const content = fs.readFileSync(path.join(projectRoot, relPath), 'utf8');
            for (const modal of requiredModals) {
                assert.ok(content.includes(modal), `${relPath} must include ${modal}`);
            }
        }
    });

    it('verifies header-account.html structure has modular guest nav and no contact accordion', () => {
        const popoverHtml = fs.readFileSync(path.join(projectRoot, 'partials/header-account.html'), 'utf8');

        // Modular guest avatar and management navigation
        assert.ok(popoverHtml.includes('id="account-popover-guest-avatar-btn"'), 'Must have clickable #account-popover-guest-avatar-btn');
        assert.ok(popoverHtml.includes('id="account-popover-guest-manage-btn"'), 'Must have #account-popover-guest-manage-btn');
        assert.ok(popoverHtml.includes('id="account-popover-signin-btn"'), 'Must have #account-popover-signin-btn');

        // Header account button structure (unified circular icon button)
        assert.ok(popoverHtml.includes('id="header-account-btn"'), 'Must have #header-account-btn');
        assert.ok(popoverHtml.includes('id="header-account-icon-wrapper"'), 'Must have #header-account-icon-wrapper');
        assert.ok(popoverHtml.includes('id="header-account-avatar-img"'), 'Must have #header-account-avatar-img');

        // Popover initial display must be hidden attribute
        assert.ok(popoverHtml.includes('id="app-account-popover"'), 'Must have #app-account-popover');
        assert.match(
            popoverHtml,
            /<div\s+id="app-account-popover"[^>]*\bhidden\b/,
            '#app-account-popover must declare initial hidden attribute for accessible visibility control'
        );

        // Popover modular panels container and settings panel
        assert.ok(popoverHtml.includes('id="account-popover-panels"'), 'Must have #account-popover-panels');
        assert.ok(popoverHtml.includes('data-popover-panel="settings"'), 'Must have data-popover-panel="settings"');
        assert.ok(popoverHtml.includes('data-popover-option="account-sync"'), 'Must have data-popover-option="account-sync"');
        assert.ok(popoverHtml.includes('id="account-popover-logout-btn"'), 'Must have non-removable #account-popover-logout-btn');
    });

    it('verifies landing accounts actions has the refresh button ordered before manage', () => {
        const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
        assert.ok(indexHtml.includes('id="landing-refresh-accounts-btn"'), 'index.html must have #landing-refresh-accounts-btn');
        assert.ok(indexHtml.includes('id="landing-manage-accounts-btn"'), 'index.html must have #landing-manage-accounts-btn');
        assert.ok(
            indexHtml.indexOf('landing-refresh-accounts-btn') < indexHtml.indexOf('landing-manage-accounts-btn'),
            '#landing-refresh-accounts-btn must appear before #landing-manage-accounts-btn'
        );
    });
});
