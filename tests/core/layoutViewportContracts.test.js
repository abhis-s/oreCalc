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

    describe('Universal Header Shell Accessibility Contracts', () => {
        test('All three application headers utilize semantic button with aria-controls for hamburger', () => {
            const hjHtml = fs.readFileSync(path.join(projectRoot, 'hero-journey/index.html'), 'utf8');
            const headerHtml = fs.readFileSync(path.join(projectRoot, 'partials/header.html'), 'utf8');
            const landingHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');

            assert.match(hjHtml, /<button[^>]*class="[^"]*hamburger[^"]*"[^>]*aria-controls="navigation-drawer"/);
            assert.match(headerHtml, /<button[^>]*class="[^"]*hamburger[^"]*"[^>]*aria-controls="navigation-drawer"/);
            assert.match(landingHtml, /<button[^>]*class="[^"]*hamburger[^"]*"[^>]*aria-controls="navigation-drawer"/);
        });
    });
});
