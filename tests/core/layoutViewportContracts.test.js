import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

/**
 * Pure coordinate clamping algorithm for contextual tooltips and popovers.
 * @param {{
 *   elemRect: { top: number, bottom: number, left: number, width: number, height: number },
 *   popoverRect: { width: number, height: number },
 *   viewport: { width: number, height: number },
 *   margin?: number
 * }} params
 * @returns {{ top: number, left: number }}
 */
function computePopoverCoordinates({
    elemRect,
    popoverRect,
    viewport,
    margin = 12
}) {
    const popoverHeight = popoverRect.height || 140;
    const popoverWidth = popoverRect.width || 230;

    const spaceAbove = elemRect.top;
    const spaceBelow = viewport.height - elemRect.bottom;

    let top = 0;
    if (spaceAbove >= popoverHeight + 10 || spaceAbove >= spaceBelow) {
        top = elemRect.top - popoverHeight - 6;
    } else {
        top = elemRect.bottom + 6;
    }

    const effectiveHeight = Math.min(popoverHeight, Math.max(0, viewport.height - (margin * 2)));
    const effectiveWidth = Math.min(popoverWidth, Math.max(0, viewport.width - (margin * 2)));

    top = Math.max(margin, Math.min(top, viewport.height - effectiveHeight - margin));

    let left = elemRect.left + (elemRect.width / 2) - (effectiveWidth / 2);
    left = Math.max(margin, Math.min(left, viewport.width - effectiveWidth - margin));

    return { top, left };
}

/**
 * Pure right-aligned popover positioning algorithm (e.g. settings popover).
 * @param {{
 *   btnRect: { right: number },
 *   popoverWidth: number,
 *   viewportWidth: number,
 *   margin?: number
 * }} params
 * @returns {{ rightOffset: number, computedLeft: number }}
 */
function computeSettingsPopoverOffset({
    btnRect,
    popoverWidth,
    viewportWidth,
    margin = 12
}) {
    const naturalLeft = btnRect.right - popoverWidth;
    let rightOffset = 0;

    if (naturalLeft < margin) {
        rightOffset = -(margin - naturalLeft);
    }

    // In CSS with position: absolute; right: ${rightOffset}px,
    // a negative right value (e.g. -3px) extends the right boundary by 3px past btnRect.right
    const computedRight = btnRect.right - rightOffset;
    const computedLeft = computedRight - popoverWidth;
    return { rightOffset, computedLeft, computedRight };
}

/**
 * Hero Journey Header dynamic layout decision algorithm.
 * @param {{
 *   containerWidth: number,
 *   brandTitleWidth?: number,
 *   separatorWidth?: number,
 *   pillWidth?: number,
 *   actionsWidth?: number,
 *   searchBtnWidth?: number
 * }} params
 * @returns {{ isStacked: boolean, isCompact: boolean }}
 */
function computeHeroJourneyHeaderLayout({
    containerWidth,
    brandTitleWidth = 75,
    separatorWidth = 8,
    pillWidth = 105,
    actionsWidth = 80,
    searchBtnWidth = 58
}) {
    const minSearchInputWidth = 145;
    const searchExtra = 56;
    const minSearchWidth = minSearchInputWidth + searchBtnWidth + searchExtra;

    const gap = 16;
    const stackedGap = 16;

    const fullBrandWidth = brandTitleWidth + separatorWidth + pillWidth + 12;
    const compactBrandWidth = brandTitleWidth;

    const singleRowFullWidth = fullBrandWidth + minSearchWidth + actionsWidth + (2 * gap);
    const singleRowCompactWidth = compactBrandWidth + minSearchWidth + actionsWidth + (2 * gap);

    let nextStacked = false;
    let nextCompact = false;

    if (containerWidth >= singleRowFullWidth) {
        nextStacked = false;
        nextCompact = false;
    } else if (containerWidth >= singleRowCompactWidth) {
        nextStacked = false;
        nextCompact = true;
    } else {
        nextStacked = true;
        const row1Needed = fullBrandWidth + actionsWidth + stackedGap;
        nextCompact = containerWidth < row1Needed;
    }

    return { isStacked: nextStacked, isCompact: nextCompact };
}

describe('Layout & Viewport Hardening Contracts', () => {

    describe('Responsive Breakpoint Tokens & Z-Index Tokens Invariant', () => {
        const variablesScss = fs.readFileSync(path.join(projectRoot, 'css/abstracts/_variables.scss'), 'utf8');

        test('defines standard responsive breakpoint tokens', () => {
            assert.match(variablesScss, /\$breakpoint-compact:\s*425px;/, 'Must define $breakpoint-compact: 425px');
            assert.match(variablesScss, /\$breakpoint-phone:\s*480px;/, 'Must define $breakpoint-phone: 480px');
            assert.match(variablesScss, /\$breakpoint-modal:\s*625px;/, 'Must define $breakpoint-modal: 625px');
            assert.match(variablesScss, /\$breakpoint-desktop:\s*780px;/, 'Must define $breakpoint-desktop: 780px');
        });

        test('defines monotonically ordered z-index design tokens', () => {
            const extractZIndex = (name) => {
                const match = variablesScss.match(new RegExp(`\\$${name}:\\s*(-?\\d+);`));
                return match ? parseInt(match[1], 10) : null;
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

    describe('Profile Header & Popover Responsive CSS Contracts', () => {
        const profileHeaderScss = fs.readFileSync(path.join(projectRoot, 'css/components/profile/_profile-header.scss'), 'utf8');
        const cardsPopoversScss = fs.readFileSync(path.join(projectRoot, 'css/components/cards/_cards-popovers.scss'), 'utf8');
        const settingsPopoverScss = fs.readFileSync(path.join(projectRoot, 'css/hero-journey/_hero-journey-settings.scss'), 'utf8');

        test('verifies desktop player-identity-info is unconstrained and modal breakpoint applies max-width: 58%', () => {
            assert.match(
                profileHeaderScss,
                /\.player-identity-info\s*\{[\s\S]*?max-width:\s*100%;[\s\S]*?@media\s*\(max-width:\s*\$breakpoint-modal\)\s*\{\s*max-width:\s*58%;\s*\}/,
                'player-identity-info must have max-width: 100% on desktop and max-width: 58% at $breakpoint-modal'
            );
        });

        test('verifies player-name and mobile clan-name-mini include overflow-wrap: anywhere and word-break: break-word', () => {
            assert.match(
                profileHeaderScss,
                /\.player-name\s*\{[\s\S]*?overflow-wrap:\s*anywhere;[\s\S]*?word-break:\s*break-word;/,
                'player-name must declare overflow-wrap: anywhere and word-break: break-word'
            );

            assert.match(
                profileHeaderScss,
                /\.clan-name-mini\s*\{[\s\S]*?overflow-wrap:\s*anywhere;[\s\S]*?word-break:\s*break-word;/,
                'mobile clan-name-mini must declare overflow-wrap: anywhere and word-break: break-word'
            );
        });

        test('verifies card-help-popover and equipment pool popover enforce responsive viewport max-width constraints', () => {
            assert.match(
                cardsPopoversScss,
                /max-width:\s*min\(240px,\s*calc\(100vw\s*-\s*24px\)\);/,
                'Base card-help-popover must enforce min(240px, calc(100vw - 24px))'
            );

            assert.match(
                cardsPopoversScss,
                /width:\s*min\(280px,\s*calc\(100vw\s*-\s*24px\)\);/,
                'Equipment pool popover must enforce width: min(280px, calc(100vw - 24px))'
            );
        });

        test('verifies settings popover enforces responsive viewport min/max constraints', () => {
            assert.match(
                settingsPopoverScss,
                /max-width:\s*min\(440px,\s*calc\(100vw\s*-\s*24px\)\);/,
                'Settings popover must declare max-width: min(440px, calc(100vw - 24px))'
            );
        });
    });

    describe('Popover Coordinate Clamping & Boundary Mathematics', () => {
        const testViewports = [
            { width: 280, height: 500, name: 'Ultra-narrow 280px' },
            { width: 320, height: 568, name: 'Compact Phone 320px' },
            { width: 375, height: 667, name: 'Standard Phone 375px' },
            { width: 480, height: 800, name: 'Large Phone 480px' },
            { width: 768, height: 1024, name: 'Tablet 768px' },
            { width: 1280, height: 800, name: 'Desktop 1280px' }
        ];

        test('clamps popover left and top coordinates strictly within viewport bounds across all screen widths', () => {
            for (const vp of testViewports) {
                // Test multiple anchor trigger positions: left edge, center, right edge
                const anchorPositions = [
                    { top: 50, bottom: 90, left: 10, width: 40, height: 40 },
                    { top: 200, bottom: 240, left: vp.width / 2 - 20, width: 40, height: 40 },
                    { top: 400, bottom: 440, left: vp.width - 50, width: 40, height: 40 }
                ];

                for (const elemRect of anchorPositions) {
                    const coords = computePopoverCoordinates({
                        elemRect,
                        popoverRect: { width: 280, height: 160 },
                        viewport: { width: vp.width, height: vp.height },
                        margin: 12
                    });

                    assert.ok(
                        coords.left >= 12,
                        `Left coordinate (${coords.left}px) must be >= 12px for ${vp.name}`
                    );

                    const effectiveWidth = Math.min(280, Math.max(0, vp.width - 24));
                    const maxAllowedLeft = Math.max(12, vp.width - effectiveWidth - 12);
                    assert.ok(
                        coords.left <= maxAllowedLeft,
                        `Left coordinate (${coords.left}px) must be <= maxAllowedLeft (${maxAllowedLeft}px) for ${vp.name}`
                    );

                    assert.ok(
                        coords.top >= 12,
                        `Top coordinate (${coords.top}px) must be >= 12px for ${vp.name}`
                    );
                }
            }
        });

        test('ensures settings popover right offset shift guarantees left edge >= 12px', () => {
            for (const vp of testViewports) {
                // Button positioned near right edge (e.g. right = vp.width - 15)
                const btnRect = { right: vp.width - 15 };
                const popoverWidth = Math.min(320, vp.width - 24);

                const result = computeSettingsPopoverOffset({
                    btnRect,
                    popoverWidth,
                    viewportWidth: vp.width,
                    margin: 12
                });

                assert.ok(
                    result.computedLeft >= 12,
                    `Computed left edge (${result.computedLeft}px) must be >= 12px for ${vp.name}`
                );
            }
        });
    });

    describe('Hero Journey Header Dynamic Geometry Mathematics', () => {
        test('determines single-row desktop layout for wide containers', () => {
            const layout = computeHeroJourneyHeaderLayout({
                containerWidth: 1130
            });
            assert.equal(layout.isStacked, false, 'Desktop 1130px should not be stacked');
            assert.equal(layout.isCompact, false, 'Desktop 1130px should not be compact');
        });

        test('determines single-row layout with icon actions for tablet containers', () => {
            const layout = computeHeroJourneyHeaderLayout({
                containerWidth: 706,
                actionsWidth: 80
            });
            assert.equal(layout.isStacked, false, 'Tablet 706px should fit in single row');
            assert.equal(layout.isCompact, false, 'Tablet 706px should retain full brand pill');
        });

        test('transitions to 2-row stacked layout when width drops below singleRowCompactWidth', () => {
            const layout = computeHeroJourneyHeaderLayout({
                containerWidth: 440
            });
            assert.equal(layout.isStacked, true, '440px container must switch to stacked 2-row mode');
            assert.equal(layout.isCompact, false, '440px container has room for full brand in Row 1');
        });

        test('activates compact brand when container drops below row 1 requirement in stacked mode', () => {
            const layout = computeHeroJourneyHeaderLayout({
                containerWidth: 280
            });
            assert.equal(layout.isStacked, true, '280px container must switch to stacked 2-row mode');
            assert.equal(layout.isCompact, true, '280px container must activate compact brand');
        });
    });
});
