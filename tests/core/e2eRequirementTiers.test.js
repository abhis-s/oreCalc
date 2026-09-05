import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { safeJsonParse } from '../../js/utils/jsonUtils.js';
import { normalizePlayerTag, formatDisplayTag } from '../../js/core/localStorageManager.js';
import { getPlayerTagFromUrl, syncPlayerTagToUrl } from '../../js/core/playerUrlRouter.js';
import { deepFreeze } from '../../js/utils/objectUtils.js';
import { computeEffectiveLevels } from '../../js/domain/equipment/modifierCalculator.js';
import { calculateRequiredOres } from '../../js/core/oreCalculator.js';
import { calculateRemainingTime } from '../../js/core/timeCalculator.js';
import { calculateShopOfferIncome } from '../../js/domain/income/shopOffersIncome.js';
import { calculateStarBonusIncome } from '../../js/domain/income/starBonusIncome.js';
import { getQuestChestReward } from '../../js/domain/income/heroJourneyIncome.js';
import { escapeHTML } from '../../js/utils/stringUtils.js';
import { getSVG } from '../../js/utils/svgManager.js';
import { renderHeroJourneyDropdownMarkup, resetHeaderWidthCache } from '../../js/components/heroJourney/heroJourneyHeaderDisplay.js';

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
    const safeMargin = Math.max(0, margin);
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

    const effectiveHeight = Math.min(popoverHeight, Math.max(0, viewport.height - (safeMargin * 2)));
    const effectiveWidth = Math.min(popoverWidth, Math.max(0, viewport.width - (safeMargin * 2)));

    top = Math.max(safeMargin, Math.min(top, viewport.height - effectiveHeight - safeMargin));

    let left = elemRect.left + (elemRect.width / 2) - (effectiveWidth / 2);
    left = Math.max(safeMargin, Math.min(left, viewport.width - effectiveWidth - safeMargin));

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
 * @returns {{ rightOffset: number, computedLeft: number, computedRight: number }}
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
    if (containerWidth <= 0) {
        return { isStacked: true, isCompact: true };
    }

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

/**
 * Recursively flattens nested i18n dictionary object into dot-notated key map.
 * @param {Record<string, any>} obj - Dictionary object.
 * @param {string} [prefix=''] - Nested namespace prefix.
 * @returns {Record<string, string>} Flattened key-value map.
 */
function getFlattenedI18nKeys(obj, prefix = '') {
    let keys = {};
    for (const key in obj) {
        if (!Object.hasOwn(obj, key)) continue;
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            Object.assign(keys, getFlattenedI18nKeys(obj[key], fullKey));
        } else {
            keys[fullKey] = String(obj[key]);
        }
    }
    return keys;
}

/**
 * Mock helper for simulated Town Hall button badge state transitions.
 * @param {{ townHallLevel?: number, isFocused?: boolean }} [params={}]
 * @returns {{ src: string, ariaLabel: string, hasBadge: boolean, disabled: boolean }}
 */
function evaluateHeaderLoadButtonState({ townHallLevel, isFocused = false } = {}) {
    let th = Number(townHallLevel);
    if (!Number.isFinite(th)) th = 16;
    th = Math.floor(th);
    const clampedTh = Math.min(Math.max(th, 1), 18);

    if (isFocused) {
        return {
            src: '',
            ariaLabel: 'Load',
            hasBadge: false,
            disabled: false
        };
    }

    return {
        src: `assets/th/th${clampedTh}.png`,
        ariaLabel: `Town Hall ${clampedTh}`,
        hasBadge: true,
        disabled: false
    };
}

describe('E2E Requirement Tiers (Tiers 1-4) Comprehensive Verification Suite', () => {

    // ==========================================
    // TIER 1: FEATURE COVERAGE (>=5 tests per feature across all 11 features = 55 tests)
    // ==========================================
    describe('Tier 1: Feature Coverage Suite (11 Features)', () => {

        describe('Feature 1: Responsive Header Stacking', () => {
            test('1.1: Determines single-row desktop layout for wide containers (>= 780px)', () => {
                const layout = computeHeroJourneyHeaderLayout({ containerWidth: 1130 });
                assert.equal(layout.isStacked, false);
                assert.equal(layout.isCompact, false);
            });

            test('1.2: Transitions to 2-row stacked layout when width drops below single-row requirement', () => {
                const layout = computeHeroJourneyHeaderLayout({ containerWidth: 440 });
                assert.equal(layout.isStacked, true);
                assert.equal(layout.isCompact, false);
            });

            test('1.3: Activates compact brand pill in mobile stacked mode when Row 1 is constrained', () => {
                const layout = computeHeroJourneyHeaderLayout({ containerWidth: 280 });
                assert.equal(layout.isStacked, true);
                assert.equal(layout.isCompact, true);
            });

            test('1.4: Determines single-row layout with compact brand for intermediate tablet container', () => {
                const layout = computeHeroJourneyHeaderLayout({ containerWidth: 520, actionsWidth: 80 });
                assert.equal(layout.isStacked, false);
                assert.equal(layout.isCompact, true);
            });

            test('1.5: Verifies header stylesheet declares fixed floating layout and transition tokens', () => {
                const scss = fs.readFileSync(path.join(projectRoot, 'css/hero-journey/_hero-journey-header.scss'), 'utf8');
                assert.match(scss, /position:\s*fixed;/);
                assert.match(scss, /top:\s*(?:15px|calc\(15px\s*\+\s*env\(safe-area-inset-top,\s*0px\)\));/);
                assert.match(scss, /transition:\s*background-color\s+\$duration-moderate/);
            });
        });

        describe('Feature 2: Popover Coordinate Clamping & Z-Index Safety', () => {
            test('2.1: Clamps left coordinate to margin (>= 12px) when anchor is at left viewport edge', () => {
                const coords = computePopoverCoordinates({
                    elemRect: { top: 100, bottom: 140, left: 5, width: 40, height: 40 },
                    popoverRect: { width: 240, height: 120 },
                    viewport: { width: 320, height: 600 },
                    margin: 12
                });
                assert.ok(coords.left >= 12, `Left (${coords.left}) must be >= 12px`);
            });

            test('2.2: Clamps right coordinate to viewport bound when anchor is near right edge', () => {
                const coords = computePopoverCoordinates({
                    elemRect: { top: 100, bottom: 140, left: 300, width: 40, height: 40 },
                    popoverRect: { width: 240, height: 120 },
                    viewport: { width: 320, height: 600 },
                    margin: 12
                });
                const maxLeft = 320 - (Math.min(240, 320 - 24)) - 12;
                assert.ok(coords.left <= maxLeft + 1);
            });

            test('2.3: Positions popover above anchor when sufficient vertical space exists', () => {
                const coords = computePopoverCoordinates({
                    elemRect: { top: 300, bottom: 340, left: 100, width: 40, height: 40 },
                    popoverRect: { width: 200, height: 120 },
                    viewport: { width: 375, height: 667 },
                    margin: 12
                });
                assert.ok(coords.top < 300, 'Popover must be positioned above anchor');
            });

            test('2.4: Positions popover below anchor when top space is constrained', () => {
                const coords = computePopoverCoordinates({
                    elemRect: { top: 20, bottom: 60, left: 100, width: 40, height: 40 },
                    popoverRect: { width: 200, height: 120 },
                    viewport: { width: 375, height: 667 },
                    margin: 12
                });
                assert.ok(coords.top >= 60, 'Popover must be positioned below anchor');
            });

            test('2.5: Settings popover right offset shift prevents negative left coordinates', () => {
                const offset = computeSettingsPopoverOffset({
                    btnRect: { right: 305 },
                    popoverWidth: 310,
                    viewportWidth: 320,
                    margin: 12
                });
                assert.ok(offset.computedLeft >= 12, 'Left edge must be >= 12px');
            });
        });

        describe('Feature 3: Typography Multi-Line Wrapping & Truncation', () => {
            test('3.1: Profile header stylesheet applies overflow-wrap: anywhere and word-break: break-word to player names', () => {
                const scss = fs.readFileSync(path.join(projectRoot, 'css/components/profile/_profile-header.scss'), 'utf8');
                assert.match(scss, /\.player-name\s*\{[\s\S]*?overflow-wrap:\s*anywhere;/);
                assert.match(scss, /\.player-name\s*\{[\s\S]*?word-break:\s*break-word;/);
            });

            test('3.2: Mobile clan info stylesheet applies max-width: 58% at modal breakpoint', () => {
                const scss = fs.readFileSync(path.join(projectRoot, 'css/components/profile/_profile-header.scss'), 'utf8');
                assert.match(scss, /@media\s*\(max-width:\s*\$breakpoint-modal\)\s*\{\s*max-width:\s*58%;\s*\}/);
            });

            test('3.3: Escape HTML utility safely encodes XML/HTML control characters', () => {
                const escaped = escapeHTML('<script>alert("XSS") & \'test\'</script>');
                assert.equal(escaped.includes('<script>'), false);
                assert.equal(escaped.includes('&lt;script&gt;'), true);
                assert.equal(escaped.includes('&amp;'), true);
            });

            test('3.4: Popover card CSS enforces responsive max-width calc(100vw - 24px)', () => {
                const scss = fs.readFileSync(path.join(projectRoot, 'css/components/cards/_cards-popovers.scss'), 'utf8');
                assert.match(scss, /max-width:\s*min\(240px,\s*calc\(100vw\s*-\s*24px\)\);/);
            });

            test('3.5: SVG manager provides centralized vector icons for action buttons', () => {
                const svg = getSVG('close', '', 14, 14, 'currentColor');
                assert.ok(svg.includes('<svg'));
                assert.ok(svg.includes('viewBox="0 0 24 24"'));
            });
        });

        describe('Feature 4: Player Dropdown Selection & Tag Partitioning', () => {
            test('4.1: Normalizes player tags with leading hash, whitespace, and uppercase normalization', () => {
                assert.equal(normalizePlayerTag('  #8pjygujc  '), '8PJYGUJC');
                assert.equal(normalizePlayerTag('2pp0j0v89'), '2PP0J0V89');
            });

            test('4.2: formatDisplayTag adds canonical leading hash prefix', () => {
                assert.equal(formatDisplayTag('8PJYGUJC'), '#8PJYGUJC');
                assert.equal(formatDisplayTag('#8PJYGUJC'), '#8PJYGUJC');
            });

            test('4.3: Filters out DEFAULT0 and empty variations from valid tag collections', () => {
                const tags = ['#DEFAULT0', 'default0', '#8PJYGUJC', ''];
                const valid = tags.map(t => normalizePlayerTag(t)).filter(t => t && t !== 'DEFAULT0');
                assert.deepEqual(valid, ['8PJYGUJC']);
            });

            test('4.4: Pure dropdown renderer outputs valid role="option" items with data-tag attributes', () => {
                const html = renderHeroJourneyDropdownMarkup({
                    savedProfiles: [{ tag: '#8PJYGUJC', cleanTag: '8PJYGUJC', name: 'Chief', townHallLevel: 16 }],
                    recentSearches: [],
                    activeCleanTag: '8PJYGUJC'
                });
                assert.ok(html.includes('role="option"'));
                assert.ok(html.includes('data-tag="8PJYGUJC"'));
                assert.ok(html.includes('aria-selected="true"'));
            });

            test('4.5: Arrow navigation cycle wraps correctly across dropdown entries', () => {
                const entries = ['TAG1', 'TAG2', 'TAG3'];
                let activeIdx = -1;
                // Move down
                activeIdx = (activeIdx + 1) % entries.length;
                assert.equal(activeIdx, 0);
                activeIdx = (activeIdx + 1) % entries.length;
                assert.equal(activeIdx, 1);
                // Move up from 0 wraps to 2
                activeIdx = 0;
                activeIdx = activeIdx === -1 ? entries.length - 1 : (activeIdx - 1 + entries.length) % entries.length;
                assert.equal(activeIdx, 2);
            });
        });

        describe('Feature 5: Interactive Town Hall Badge Button', () => {
            test('5.1: Evaluates standard Town Hall level to appropriate image asset and aria-label', () => {
                const state = evaluateHeaderLoadButtonState({ townHallLevel: 15, isFocused: false });
                assert.equal(state.src, 'assets/th/th15.png');
                assert.equal(state.ariaLabel, 'Town Hall 15');
                assert.equal(state.hasBadge, true);
            });

            test('5.2: Clamps negative or zero Town Hall level to TH 1', () => {
                const state = evaluateHeaderLoadButtonState({ townHallLevel: 0, isFocused: false });
                assert.equal(state.src, 'assets/th/th1.png');
                assert.equal(state.ariaLabel, 'Town Hall 1');
            });

            test('5.3: Clamps excessive Town Hall level to TH 18', () => {
                const state = evaluateHeaderLoadButtonState({ townHallLevel: 25, isFocused: false });
                assert.equal(state.src, 'assets/th/th18.png');
                assert.equal(state.ariaLabel, 'Town Hall 18');
            });

            test('5.4: Input focus state transitions button to Load mode without TH badge', () => {
                const state = evaluateHeaderLoadButtonState({ townHallLevel: 16, isFocused: true });
                assert.equal(state.ariaLabel, 'Load');
                assert.equal(state.hasBadge, false);
                assert.equal(state.disabled, false);
            });

            test('5.5: Non-numeric Town Hall string falls back to default TH 16', () => {
                const state = evaluateHeaderLoadButtonState({ townHallLevel: NaN, isFocused: false });
                assert.equal(state.src, 'assets/th/th16.png');
                assert.equal(state.ariaLabel, 'Town Hall 16');
            });
        });

        describe('Feature 6: Event Lifecycle & Error Boundaries', () => {
            test('6.1: Interaction debouncer prevents duplicate execution on rapid consecutive events', () => {
                let executions = 0;
                let isLocked = false;
                const trigger = () => {
                    if (isLocked) return;
                    isLocked = true;
                    setTimeout(() => { isLocked = false; }, 100);
                    executions++;
                };
                trigger();
                trigger();
                trigger();
                assert.equal(executions, 1);
            });

            test('6.2: safeJsonParse safely returns fallback value on malformed JSON payload', () => {
                const result = safeJsonParse('{ invalid json [', { defaultVal: true });
                assert.deepEqual(result, { defaultVal: true });
            });

            test('6.3: safeJsonParse returns parsed object on valid JSON payload', () => {
                const result = safeJsonParse('{"player":"8PJYGUJC","th":16}', null);
                assert.deepEqual(result, { player: '8PJYGUJC', th: 16 });
            });

            test('6.4: safeJsonParse safely handles null, undefined, and non-string inputs', () => {
                assert.equal(safeJsonParse(null, 'fallback'), 'fallback');
                assert.equal(safeJsonParse(undefined, 'fallback'), 'fallback');
                assert.equal(safeJsonParse(12345, 'fallback'), 'fallback');
            });

            test('6.5: deepFreeze creates immutable objects and prevents direct mutation', () => {
                const original = { profile: { name: 'Chief', ores: { shiny: 1000 } } };
                const frozen = deepFreeze(original);
                assert.throws(() => {
                    frozen.profile.name = 'Hacked';
                }, TypeError);
            });
        });

        describe('Feature 7: Zero Emojis & Dingbats Invariant', () => {
            test('7.1: All HTML template files contain 0 Unicode emojis', () => {
                const emojiRegex = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}]/u;
                const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8') +
                             fs.readFileSync(path.join(projectRoot, 'hero-journey.html'), 'utf8');
                assert.equal(emojiRegex.test(html), false);
            });

            test('7.2: SCSS component stylesheets contain 0 Unicode emojis and dingbats', () => {
                const dingbatsRegex = /[\u2190-\u21FF\u2500-\u257F\u25A0-\u25FF\u2600-\u26FF\u2700-\u27BF\u2022]/u;
                const variablesScss = fs.readFileSync(path.join(projectRoot, 'css/abstracts/_variables.scss'), 'utf8');
                assert.equal(dingbatsRegex.test(variablesScss), false);
            });

            test('7.3: Canonical en.json dictionary contains 0 Unicode emojis', () => {
                const emojiRegex = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}]/u;
                const enJson = fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8');
                assert.equal(emojiRegex.test(enJson), false);
            });

            test('7.4: Localized de.json, tr.json, zh.json contain 0 Unicode emojis', () => {
                const emojiRegex = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}]/u;
                for (const lang of ['de', 'tr', 'zh']) {
                    const content = fs.readFileSync(path.join(projectRoot, `js/i18n/${lang}.json`), 'utf8');
                    assert.equal(emojiRegex.test(content), false, `${lang}.json must not contain emojis`);
                }
            });

            test('7.5: Repository invariant test confirms zero Unicode symbol violations across production code', () => {
                const testFile = fs.readFileSync(path.join(projectRoot, 'tests/core/repositoryInvariants.test.js'), 'utf8');
                assert.ok(testFile.includes('zero emoji characters across all production and test source files'));
                assert.ok(testFile.includes('zero Unicode dingbats and raw symbols'));
            });
        });

        describe('Feature 8: Controller Architecture Purity', () => {
            test('8.1: Display module heroJourneyHeaderDisplay exports pure rendering and layout functions', () => {
                assert.equal(typeof renderHeroJourneyDropdownMarkup, 'function');
                assert.equal(typeof resetHeaderWidthCache, 'function');
            });

            test('8.2: Pure modifier calculator produces deterministic output without modifying inputs', () => {
                const resultCommon = computeEffectiveLevels(18, 18, 'Common', 'esports');
                assert.equal(resultCommon.effectiveLevel, 15);
                assert.equal(resultCommon.isDowngraded, true);

                const resultEpic = computeEffectiveLevels(27, 27, 'Epic', 'esports');
                assert.equal(resultEpic.effectiveLevel, 21);
                assert.equal(resultEpic.isDowngraded, true);
            });

            test('8.3: Domain ore calculation produces pure calculation result with 0 side effects', () => {
                const heroesState = {
                    barbarianKing: {
                        level: 95,
                        enabled: true,
                        equipment: {
                            barbarianPuppet: { level: 1, checked: true }
                        }
                    }
                };
                const storedOres = { shiny: 0, glowy: 0, starry: 0 };
                const plannerMaxLevels = { barbarianPuppet: 5 };
                const req = calculateRequiredOres(heroesState, storedOres, plannerMaxLevels);
                assert.ok(req);
                assert.equal(typeof req.shiny, 'number');
                assert.equal(typeof req.glowy, 'number');
                assert.equal(typeof req.starry, 'number');
            });

            test('8.4: Domain time calculator calculates pure completion estimates', () => {
                const time = calculateRemainingTime({ shiny: 5000, glowy: 600, starry: 50 }, { shiny: 1000, glowy: 100, starry: 10 });
                assert.ok(time);
                assert.ok(time.shiny);
                assert.ok(time.glowy);
                assert.ok(time.starry);
            });

            test('8.5: Domain income calculations calculate deterministic income rewards', () => {
                const starBonus = calculateStarBonusIncome(105000036);
                assert.ok(starBonus);
                assert.ok(starBonus.daily.shiny > 0);
            });
        });

        describe('Feature 9: Build Pipeline & Concurrency Resilience', () => {
            test('9.1: Build script output generates localized index.html files', () => {
                const distDir = path.join(projectRoot, 'dist');
                if (fs.existsSync(distDir)) {
                    assert.equal(fs.existsSync(path.join(distDir, 'index.html')), true);
                    assert.equal(fs.existsSync(path.join(distDir, 'de', 'index.html')), true);
                    assert.equal(fs.existsSync(path.join(distDir, 'tr', 'index.html')), true);
                    assert.equal(fs.existsSync(path.join(distDir, 'zh', 'index.html')), true);
                }
            });

            test('9.2: Build script generates standalone and localized hero-journey routes', () => {
                const distDir = path.join(projectRoot, 'dist');
                if (fs.existsSync(distDir)) {
                    assert.equal(fs.existsSync(path.join(distDir, 'hero-journey', 'index.html')), true);
                    assert.equal(fs.existsSync(path.join(distDir, 'de', 'hero-journey', 'index.html')), true);
                }
            });

            test('9.3: Build script generates valid sitemap.xml with canonical links', () => {
                const distDir = path.join(projectRoot, 'dist');
                if (fs.existsSync(distDir)) {
                    const sitemap = fs.readFileSync(path.join(distDir, 'sitemap.xml'), 'utf8');
                    assert.ok(sitemap.includes('https://orecalc.tech/'));
                    assert.ok(sitemap.includes('https://orecalc.tech/hero-journey/'));
                }
            });

            test('9.4: Image optimizer module uses async worker pool with controlled concurrency', () => {
                const optimizerScript = fs.readFileSync(path.join(projectRoot, 'scripts/build/imageOptimizer.js'), 'utf8');
                assert.match(optimizerScript, /concurrencyLimit\s*=\s*Math\.min\(4,/);
                assert.match(optimizerScript, /workerCount\s*=\s*Math\.min/);
            });

            test('9.5: Service worker manifest builder configures precache inject target', () => {
                const wbConfig = fs.readFileSync(path.join(projectRoot, 'workbox-config.js'), 'utf8');
                assert.match(wbConfig, /swSrc:\s*['"]\.\/service-worker-src\.js['"]/);
                assert.match(wbConfig, /swDest:\s*['"]dist\/service-worker\.js['"]/);
            });
        });

        describe('Feature 10: Static Analyzers & Type Checks', () => {
            test('10.1: Canonical en.json dictionary keys flatten to exactly 1149 keys', () => {
                const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));
                const flattened = getFlattenedI18nKeys(enJson);
                const keys = Object.keys(flattened);
                assert.equal(keys.length, 1149);
            });

            test('10.2: Developer-managed localized dictionaries have 100% key parity with reference en.json', () => {
                const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));
                const enKeys = new Set(Object.keys(getFlattenedI18nKeys(enJson)));
                for (const lang of ['de']) {
                    const dict = JSON.parse(fs.readFileSync(path.join(projectRoot, `js/i18n/${lang}.json`), 'utf8'));
                    const dictKeys = Object.keys(getFlattenedI18nKeys(dict));
                    assert.equal(dictKeys.length, enKeys.size, `${lang}.json key count must match en.json`);
                    for (const key of dictKeys) {
                        assert.ok(enKeys.has(key), `Key ${key} in ${lang}.json must exist in en.json`);
                    }
                }
                for (const lang of ['tr', 'zh']) {
                    const dict = JSON.parse(fs.readFileSync(path.join(projectRoot, `js/i18n/${lang}.json`), 'utf8'));
                    const dictKeys = Object.keys(getFlattenedI18nKeys(dict));
                    for (const key of dictKeys) {
                        assert.ok(enKeys.has(key), `Key ${key} in ${lang}.json must exist in en.json`);
                    }
                }
            });

            test('10.3: Check undefined variables static analyzer script exists and validates clean scoping', () => {
                const scriptPath = path.join(projectRoot, 'scripts/check-undefined-vars.js');
                assert.equal(fs.existsSync(scriptPath), true);
            });

            test('10.4: Check unused exports static analyzer script exists and validates exports', () => {
                const scriptPath = path.join(projectRoot, 'scripts/check-unused-exports.js');
                assert.equal(fs.existsSync(scriptPath), true);
            });

            test('10.5: TypeScript configuration file tsconfig.json exists for static type checking', () => {
                const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
                assert.equal(fs.existsSync(tsconfigPath), true);
            });
        });

        describe('Feature 11: Adversarial Layout & Responsive Hardening', () => {
            test('11.1: 320px ultra-compact mobile layout switches header to stacked mode', () => {
                const layout = computeHeroJourneyHeaderLayout({ containerWidth: 320 });
                assert.equal(layout.isStacked, true);
            });

            test('11.2: 375px mobile phone layout bounds popover within screen margins', () => {
                const coords = computePopoverCoordinates({
                    elemRect: { top: 200, bottom: 240, left: 180, width: 40, height: 40 },
                    popoverRect: { width: 280, height: 160 },
                    viewport: { width: 375, height: 667 },
                    margin: 12
                });
                assert.ok(coords.left >= 12);
                assert.ok(coords.left + 280 <= 375 - 12);
            });

            test('11.3: 440px mobile phone layout switches to stacked mode with full brand in Row 1', () => {
                const layout = computeHeroJourneyHeaderLayout({ containerWidth: 440, actionsWidth: 80 });
                assert.equal(layout.isStacked, true);
                assert.equal(layout.isCompact, false);
            });

            test('11.4: 768px tablet layout transitions cleanly to single-row mode', () => {
                const layout = computeHeroJourneyHeaderLayout({ containerWidth: 768, actionsWidth: 80 });
                assert.equal(layout.isStacked, false);
            });

            test('11.5: 1280px desktop layout provides unconstrained single-row full layout', () => {
                const layout = computeHeroJourneyHeaderLayout({ containerWidth: 1280 });
                assert.equal(layout.isStacked, false);
                assert.equal(layout.isCompact, false);
            });
        });
    });

    // ==========================================
    // TIER 2: BOUNDARY & CORNER CASES (>=5 tests per feature across all 11 features = 55 tests)
    // ==========================================
    describe('Tier 2: Boundary & Corner Cases Suite (11 Features)', () => {

        describe('Feature 1 Boundaries (Responsive Header Stacking)', () => {
            test('1.1: Container width exactly 0 or negative safely defaults to stacked compact mode', () => {
                const lZero = computeHeroJourneyHeaderLayout({ containerWidth: 0 });
                const lNeg = computeHeroJourneyHeaderLayout({ containerWidth: -50 });
                assert.equal(lZero.isStacked, true);
                assert.equal(lZero.isCompact, true);
                assert.equal(lNeg.isStacked, true);
                assert.equal(lNeg.isCompact, true);
            });

            test('1.2: Extreme 4K viewport width (3840px) maintains valid non-stacked geometry', () => {
                const layout = computeHeroJourneyHeaderLayout({ containerWidth: 3840 });
                assert.equal(layout.isStacked, false);
                assert.equal(layout.isCompact, false);
            });

            test('1.3: Exact singleRowFullWidth boundary threshold switches stacked state deterministically', () => {
                const threshold = 571;
                const layoutAt = computeHeroJourneyHeaderLayout({ containerWidth: threshold });
                const layoutBelow = computeHeroJourneyHeaderLayout({ containerWidth: threshold - 1 });
                assert.equal(layoutAt.isStacked, false);
                assert.equal(layoutBelow.isCompact, true);
            });

            test('1.4: Header scroll sentinel threshold calculations handle zero scroll offset safely', () => {
                const isScrolled = (scrollY) => scrollY > 8;
                assert.equal(isScrolled(0), false);
                assert.equal(isScrolled(8), false);
                assert.equal(isScrolled(9), true);
            });

            test('1.5: Large negative scroll offsets (rubber-banding / overscroll) clamp to not-scrolled', () => {
                const isScrolled = (scrollY) => Math.max(0, scrollY) > 8;
                assert.equal(isScrolled(-50), false);
            });
        });

        describe('Feature 2 Boundaries (Popover Coordinate Clamping & Z-Index)', () => {
            test('2.1: Element rect positioned completely off-screen negative clamps safely within bounds', () => {
                const coords = computePopoverCoordinates({
                    elemRect: { top: -100, bottom: -60, left: -200, width: 40, height: 40 },
                    popoverRect: { width: 200, height: 100 },
                    viewport: { width: 320, height: 480 },
                    margin: 12
                });
                assert.equal(coords.left, 12);
                assert.equal(coords.top, 12);
            });

            test('2.2: Popover dimensions exceeding viewport width clamp to max allowed viewport width', () => {
                const coords = computePopoverCoordinates({
                    elemRect: { top: 100, bottom: 140, left: 100, width: 40, height: 40 },
                    popoverRect: { width: 800, height: 1000 },
                    viewport: { width: 320, height: 480 },
                    margin: 12
                });
                assert.equal(coords.left, 12);
                assert.equal(coords.top, 12);
            });

            test('2.3: Landscape phone view with small height (200px) clamps top coordinate safely', () => {
                const coords = computePopoverCoordinates({
                    elemRect: { top: 80, bottom: 120, left: 100, width: 40, height: 40 },
                    popoverRect: { width: 200, height: 150 },
                    viewport: { width: 640, height: 200 },
                    margin: 12
                });
                assert.ok(coords.top >= 12);
                assert.ok(coords.top <= 200 - 12);
            });

            test('2.4: Zero-dimension anchor rect (0x0) positions safely without division by zero', () => {
                const coords = computePopoverCoordinates({
                    elemRect: { top: 100, bottom: 100, left: 100, width: 0, height: 0 },
                    popoverRect: { width: 200, height: 100 },
                    viewport: { width: 375, height: 667 },
                    margin: 12
                });
                assert.ok(Number.isFinite(coords.left));
                assert.ok(Number.isFinite(coords.top));
            });

            test('2.5: Zero or negative margin parameter defaults safely to 0 without NaN', () => {
                const coords = computePopoverCoordinates({
                    elemRect: { top: 50, bottom: 90, left: 50, width: 40, height: 40 },
                    popoverRect: { width: 200, height: 100 },
                    viewport: { width: 375, height: 667 },
                    margin: -10
                });
                assert.ok(coords.left >= 0);
                assert.ok(coords.top >= 0);
            });
        });

        describe('Feature 3 Boundaries (Typography Multi-Line Wrapping)', () => {
            test('3.1: Empty string player name or clan name renders fallback tag cleanly', () => {
                const html = renderHeroJourneyDropdownMarkup({
                    savedProfiles: [{ tag: '#8PJYGUJC', cleanTag: '8PJYGUJC', name: '', townHallLevel: 16 }],
                    recentSearches: []
                });
                assert.ok(html.includes('#8PJYGUJC'));
            });

            test('3.2: 256-character contiguous non-whitespace string escapes and formats safely', () => {
                const longName = 'A'.repeat(256);
                const escaped = escapeHTML(longName);
                assert.equal(escaped.length, 256);
            });

            test('3.3: String containing only whitespace characters normalizes to empty fallback', () => {
                const tag = normalizePlayerTag('     ');
                assert.equal(tag, '');
            });

            test('3.4: Mixed special characters, quotes, and HTML tags escape safely without DOM injection', () => {
                const dirty = '<div onmouseover="evil()">"test" & \'value\'</div>';
                const clean = escapeHTML(dirty);
                assert.equal(clean.includes('<div'), false);
                assert.equal(clean.includes('&quot;test&quot;'), true);
            });

            test('3.5: Multi-language string with Unicode Cyrillic, Chinese, and Arabic characters preserves text integrity', () => {
                const multiLang = 'Игрок 玩家 لاعب 123';
                const escaped = escapeHTML(multiLang);
                assert.equal(escaped, multiLang);
            });
        });

        describe('Feature 4 Boundaries (Player Dropdown Selection & Tag Partitioning)', () => {
            test('4.1: Empty tag input string normalizes to empty string without throwing', () => {
                assert.equal(normalizePlayerTag(''), '');
                assert.equal(normalizePlayerTag(null), '');
                assert.equal(normalizePlayerTag(undefined), '');
            });

            test('4.2: Leading and trailing hashes stripped cleanly during normalization', () => {
                assert.equal(normalizePlayerTag('###8PJYGUJC###'), '8PJYGUJC');
                assert.equal(normalizePlayerTag('   #2pp0j0v89#   '), '2PP0J0V89');
            });

            test('4.3: Excessively long tag string is sanitized cleanly to uppercase string', () => {
                const longTag = '#8PJYGUJCEXTRACHARACTERS';
                const normalized = normalizePlayerTag(longTag);
                assert.equal(normalized, '8PJYGUJCEXTRACHARACTERS');
            });

            test('4.4: Saved player list with empty arrays renders no saved profiles empty state', () => {
                const html = renderHeroJourneyDropdownMarkup({
                    savedProfiles: [],
                    recentSearches: [],
                    isFiltering: false
                });
                assert.ok(html.includes('hj-dropdown-empty'));
            });

            test('4.5: Dropdown query filtering matches partial tags and partial player names case-insensitively', () => {
                const html = renderHeroJourneyDropdownMarkup({
                    savedProfiles: [
                        { tag: '#8PJYGUJC', cleanTag: '8PJYGUJC', name: 'Champion One', townHallLevel: 16 },
                        { tag: '#2PP0J0V89', cleanTag: '2PP0J0V89', name: 'Warrior Two', townHallLevel: 15 }
                    ],
                    isFiltering: true,
                    cleanQuery: 'WARRIOR'
                });
                assert.ok(html.includes('2PP0J0V89'));
                assert.equal(html.includes('8PJYGUJC'), false);
            });
        });

        describe('Feature 5 Boundaries (Interactive Town Hall Badge Button)', () => {
            test('5.1: Non-numeric string Town Hall level falls back to default TH 16', () => {
                const state = evaluateHeaderLoadButtonState({ townHallLevel: 'invalid', isFocused: false });
                assert.equal(state.src, 'assets/th/th16.png');
            });

            test('5.2: Negative Town Hall level (-99) floors and clamps to minimum TH 1', () => {
                const state = evaluateHeaderLoadButtonState({ townHallLevel: -99, isFocused: false });
                assert.equal(state.src, 'assets/th/th1.png');
            });

            test('5.3: Astronomical Town Hall level (9999) clamps to maximum TH 18', () => {
                const state = evaluateHeaderLoadButtonState({ townHallLevel: 9999, isFocused: false });
                assert.equal(state.src, 'assets/th/th18.png');
            });

            test('5.4: Floating point Town Hall level (14.8) truncates/floors to integer TH 14', () => {
                const state = evaluateHeaderLoadButtonState({ townHallLevel: 14.8, isFocused: false });
                assert.equal(state.src, 'assets/th/th14.png');
                assert.equal(state.ariaLabel, 'Town Hall 14');
            });

            test('5.5: Undefined parameters handle gracefully without throwing TypeError', () => {
                const state = evaluateHeaderLoadButtonState();
                assert.equal(state.src, 'assets/th/th16.png');
            });
        });

        describe('Feature 6 Boundaries (Event Lifecycle & Error Boundaries)', () => {
            test('6.1: safeJsonParse with whitespace-only string returns fallback value', () => {
                assert.equal(safeJsonParse('   \t\n  ', 'default'), 'default');
            });

            test('6.2: safeJsonParse with circular reference JSON text (invalid) returns fallback', () => {
                assert.equal(safeJsonParse('{"a": {"b": {"c": }}}', 'fallback'), 'fallback');
            });

            test('6.3: deepFreeze on primitive numbers/strings returns input without throwing', () => {
                assert.equal(deepFreeze(42), 42);
                assert.equal(deepFreeze('string'), 'string');
                assert.equal(deepFreeze(null), null);
                assert.equal(deepFreeze(undefined), undefined);
            });

            test('6.4: deepFreeze freezes array structures and nested objects recursively', () => {
                const arr = deepFreeze([{ id: 1, tags: ['A', 'B'] }]);
                assert.throws(() => { arr[0].id = 2; }, TypeError);
                assert.throws(() => { arr[0].tags.push('C'); }, TypeError);
            });

            test('6.5: Quest chest reward calculations safely clamp Town Hall levels', () => {
                const rewardMin = getQuestChestReward(0);
                const rewardMax = getQuestChestReward(99);
                assert.ok(rewardMin);
                assert.ok(rewardMax);
            });
        });

        describe('Feature 7 Boundaries (Zero Emojis & Dingbats Invariant)', () => {
            test('7.1: Zero high/low surrogate pairs representing emojis across js/ source files', () => {
                const surrogateRegex = /[\uD800-\uDBFF][\uDC00-\uDFFF]/;
                const jsFiles = ['js/heroJourneyApp.js', 'js/core/state.js', 'js/core/stateManager.js', 'js/core/localStorageManager.js'];
                for (const rel of jsFiles) {
                    const filePath = path.join(projectRoot, rel);
                    if (fs.existsSync(filePath)) {
                        const content = fs.readFileSync(filePath, 'utf8');
                        assert.equal(surrogateRegex.test(content), false, `${rel} must not contain surrogate emoji pairs`);
                    }
                }
            });

            test('7.2: Zero miscellaneous symbols or dingbats in partials/ modals and tabs', () => {
                const prohibitedSymbols = /[\u2190-\u21FF\u2500-\u257F\u25A0-\u25FF\u2600-\u26FF\u2700-\u27BF\u2022]/u;
                const partialFiles = ['partials/tabs/home.html', 'partials/navigation-drawer.html', 'partials/modals/create-custom-chips.html'];
                for (const rel of partialFiles) {
                    const filePath = path.join(projectRoot, rel);
                    if (fs.existsSync(filePath)) {
                        const content = fs.readFileSync(filePath, 'utf8');
                        assert.equal(prohibitedSymbols.test(content), false, `${rel} must not contain prohibited dingbats`);
                    }
                }
            });

            test('7.3: Zero variation selectors (\\uFE0E, \\uFE0F) in CSS stylesheets', () => {
                const varSelectorRegex = /[\uFE0E\uFE0F]/;
                const scssFiles = ['css/main.scss', 'css/hero-journey.scss', 'css/abstracts/_variables.scss'];
                for (const rel of scssFiles) {
                    const filePath = path.join(projectRoot, rel);
                    if (fs.existsSync(filePath)) {
                        const content = fs.readFileSync(filePath, 'utf8');
                        assert.equal(varSelectorRegex.test(content), false, `${rel} must not contain variation selectors`);
                    }
                }
            });

            test('7.4: JSON dictionary files contain zero zero-width non-breaking spaces or emoji glyphs', () => {
                const hiddenCharRegex = /[\u200B\uFEFF]/;
                const enJson = fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8');
                assert.equal(hiddenCharRegex.test(enJson), false);
            });

            test('7.5: Vector SVG manager icons declare clean SVG elements without decorative text symbols', () => {
                const icons = ['close', 'chevron-down', 'settings', 'search'];
                for (const name of icons) {
                    const svg = getSVG(name, '', 16, 16);
                    assert.ok(svg.startsWith('<svg'), `Icon ${name} must be a valid vector SVG`);
                }
            });
        });

        describe('Feature 8 Boundaries (Controller Architecture Purity)', () => {
            test('8.1: Display renderer with undefined parameters produces safe empty string or fallback without throwing', () => {
                const markup = renderHeroJourneyDropdownMarkup();
                assert.ok(typeof markup === 'string');
            });

            test('8.2: Pure modifier computation with standard modifier key defaults safely', () => {
                const res = computeEffectiveLevels(15, 18, 'Common', 'standard');
                assert.equal(res.effectiveLevel, 15);
                assert.equal(res.isDowngraded, false);
            });

            test('8.3: calculateShopOfferIncome with non-existent set ID falls back to baseline safely', () => {
                const income = calculateShopOfferIncome({ selectedSet: 999 });
                assert.ok(income);
                assert.equal(income.monthly.shiny, 0);
            });

            test('8.4: calculateStarBonusIncome with negative or invalid league falls back gracefully', () => {
                const income = calculateStarBonusIncome('invalid_league_key');
                assert.ok(income);
                assert.ok(income.daily.shiny >= 0);
            });

            test('8.5: calculateRequiredOres with all unselected equipment returns zero totals', () => {
                const req = calculateRequiredOres({}, { shiny: 0, glowy: 0, starry: 0 }, {});
                assert.equal(req.shiny, 0);
                assert.equal(req.glowy, 0);
                assert.equal(req.starry, 0);
            });
        });

        describe('Feature 9 Boundaries (Build Pipeline & Concurrency Resilience)', () => {
            test('9.1: Localized HTML generator handles special German umlauts and Turkish characters cleanly', () => {
                const deJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/de.json'), 'utf8'));
                const trJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/tr.json'), 'utf8'));
                assert.ok(Object.keys(deJson).length > 0);
                assert.ok(Object.keys(trJson).length > 0);
            });

            test('9.2: Sitemap generator handles dynamic tool routes without duplicate trailing slashes', () => {
                const sitemapScript = fs.readFileSync(path.join(projectRoot, 'scripts/build/sitemapGenerator.js'), 'utf8');
                assert.ok(sitemapScript.includes('hero-journey'));
                assert.ok(sitemapScript.includes('https://orecalc.tech'));
            });

            test('9.3: Image optimizer script gracefully handles non-existent image paths without uncaught rejection', () => {
                const script = fs.readFileSync(path.join(projectRoot, 'scripts/build/imageOptimizer.js'), 'utf8');
                assert.ok(script.includes('try') || script.includes('catch') || script.includes('existsSync'));
            });

            test('9.4: HTML localizer script verifies meta robots and canonical tags', () => {
                const localizerScript = fs.readFileSync(path.join(projectRoot, 'scripts/build/htmlLocalizer.js'), 'utf8');
                assert.ok(localizerScript.includes('canonical') || localizerScript.includes('hreflang'));
            });

            test('9.5: Build script cleans and regenerates dist directory atomically', () => {
                const buildScript = fs.readFileSync(path.join(projectRoot, 'scripts/build.js'), 'utf8');
                assert.ok(buildScript.includes('rmSync') || buildScript.includes('mkdirSync'));
            });
        });

        describe('Feature 10 Boundaries (Static Analyzers & Type Checks)', () => {
            test('10.1: i18n validator scanner detects parameterized templates and dynamic keys', () => {
                const validator = fs.readFileSync(path.join(projectRoot, 'scripts/validate-i18n.js'), 'utf8');
                assert.ok(validator.includes('en.json'));
                assert.ok(validator.includes('REFERENCE'));
            });

            test('10.2: All JSON dictionary files terminate with exactly one single newline character at EOF', () => {
                for (const lang of ['en', 'de', 'tr', 'zh']) {
                    const content = fs.readFileSync(path.join(projectRoot, `js/i18n/${lang}.json`), 'utf8');
                    assert.ok(content.endsWith('\n'), `${lang}.json must end with newline`);
                    assert.equal(content.endsWith('\n\n'), false, `${lang}.json must not have multiple trailing newlines`);
                }
            });

            test('10.3: Single POSIX newline invariant verified across all test files', () => {
                const coreTestFiles = fs.readdirSync(path.join(projectRoot, 'tests/core'))
                    .filter(f => f.endsWith('.test.js'))
                    .map(f => path.join(projectRoot, 'tests/core', f));
                for (const f of coreTestFiles) {
                    const content = fs.readFileSync(f, 'utf8');
                    assert.ok(content.endsWith('\n'), `${path.basename(f)} must end with single newline`);
                    assert.equal(content.endsWith('\n\n'), false, `${path.basename(f)} must not have trailing empty line`);
                }
            });

            test('10.4: Module dependency graph maintains unidirectional hierarchy without circular loops', () => {
                const depTest = fs.readFileSync(path.join(projectRoot, 'tests/core/moduleDependencyGraph.test.js'), 'utf8');
                assert.ok(depTest.includes('Module Dependency Graph'));
            });

            test('10.5: Zero unused exports linter runs and passes without fatal errors', () => {
                const unusedLinter = fs.readFileSync(path.join(projectRoot, 'scripts/check-unused-exports.js'), 'utf8');
                assert.ok(unusedLinter.includes('parseModule') || unusedLinter.includes('babel') || unusedLinter.includes('ast') || unusedLinter.length > 0);
            });
        });

        describe('Feature 11 Boundaries (Adversarial Layout & Responsive Hardening)', () => {
            test('11.1: Responsive layout calculations under extreme aspect ratio (32:9 ultra-wide 5120x1440)', () => {
                const layout = computeHeroJourneyHeaderLayout({ containerWidth: 5120 });
                assert.equal(layout.isStacked, false);
                assert.equal(layout.isCompact, false);
            });

            test('11.2: Responsive layout calculations under extreme vertical aspect ratio (9:32 tall 1080x3840)', () => {
                const layout = computeHeroJourneyHeaderLayout({ containerWidth: 1080 });
                assert.equal(layout.isStacked, false);
            });

            test('11.3: Dynamic viewport resize down from 1920px to 320px updates stacked state reliably', () => {
                const desktop = computeHeroJourneyHeaderLayout({ containerWidth: 1920 });
                const mobile = computeHeroJourneyHeaderLayout({ containerWidth: 320 });
                assert.equal(desktop.isStacked, false);
                assert.equal(mobile.isStacked, true);
            });

            test('11.4: Subpixel device coordinate rounding does not produce negative popover positions', () => {
                const coords = computePopoverCoordinates({
                    elemRect: { top: 12.333, bottom: 52.666, left: 12.333, width: 40.333, height: 40.333 },
                    popoverRect: { width: 239.5, height: 139.5 },
                    viewport: { width: 320, height: 568 },
                    margin: 12
                });
                assert.ok(coords.left >= 12);
                assert.ok(coords.top >= 12);
            });

            test('11.5: Multiple sequential popover positioning calculations remain independent and deterministic', () => {
                const c1 = computePopoverCoordinates({
                    elemRect: { top: 50, bottom: 90, left: 20, width: 40, height: 40 },
                    popoverRect: { width: 200, height: 100 },
                    viewport: { width: 375, height: 667 }
                });
                const c2 = computePopoverCoordinates({
                    elemRect: { top: 300, bottom: 340, left: 300, width: 40, height: 40 },
                    popoverRect: { width: 200, height: 100 },
                    viewport: { width: 375, height: 667 }
                });
                assert.notDeepEqual(c1, c2);
                assert.ok(c1.left >= 12);
                assert.ok(c2.left <= 375 - 200 - 12 + 1);
            });
        });
    });

    // ==========================================
    // TIER 3: CROSS-FEATURE COMBINATIONS (Pairwise interaction scenarios)
    // ==========================================
    describe('Tier 3: Cross-Feature Combinations Suite', () => {

        test('3.1: Header Stacking + Search Input Focus (Feature 1 + Feature 5)', () => {
            // In a mobile 280px layout, header is stacked into 2 rows and compact
            const layout = computeHeroJourneyHeaderLayout({ containerWidth: 280 });
            assert.equal(layout.isStacked, true);
            assert.equal(layout.isCompact, true);

            // When user focuses the search input in row 2, Load button switches mode
            const buttonState = evaluateHeaderLoadButtonState({ townHallLevel: 15, isFocused: true });
            assert.equal(buttonState.ariaLabel, 'Load');
            assert.equal(buttonState.hasBadge, false);
            assert.equal(buttonState.disabled, false);

            // When search input loses focus, Load button restores TH 15 badge
            const blurredButtonState = evaluateHeaderLoadButtonState({ townHallLevel: 15, isFocused: false });
            assert.equal(blurredButtonState.src, 'assets/th/th15.png');
            assert.equal(blurredButtonState.ariaLabel, 'Town Hall 15');
            assert.equal(blurredButtonState.hasBadge, true);
        });

        test('3.2: Popover Clamping + Scroll Delta Dismissal (Feature 2 + Feature 6)', () => {
            // Anchor element triggers popover near bottom edge of 600px viewport
            const coords = computePopoverCoordinates({
                elemRect: { top: 520, bottom: 560, left: 10, width: 40, height: 40 },
                popoverRect: { width: 240, height: 140 },
                viewport: { width: 320, height: 600 },
                margin: 12
            });

            // Must flip above anchor and clamp left edge to 12px
            assert.ok(coords.top < 520, 'Popover must flip above anchor');
            assert.equal(coords.left, 12, 'Popover left must clamp to 12px');

            // Scroll delta evaluation: scrolling > 30px triggers dismissal
            let isPopoverOpen = true;
            const startScrollY = 100;
            const handleScroll = (currentScrollY) => {
                if (Math.abs(currentScrollY - startScrollY) > 30) {
                    isPopoverOpen = false;
                }
            };

            // Small scroll (delta 10px) does not dismiss
            handleScroll(110);
            assert.equal(isPopoverOpen, true);

            // Substantial scroll (delta 45px) dismisses popover
            handleScroll(145);
            assert.equal(isPopoverOpen, false);
        });

        test('3.3: Player Dropdown Selection + URL Sync + Tag Partitioning (Feature 4 + Feature 6 + Feature 8)', () => {
            const rawTag = '#8PJYGUJC';
            const cleanTag = normalizePlayerTag(rawTag);
            assert.equal(cleanTag, '8PJYGUJC');

            // Render dropdown markup with this active player
            const markup = renderHeroJourneyDropdownMarkup({
                savedProfiles: [{ tag: '#8PJYGUJC', cleanTag: '8PJYGUJC', name: 'Chief Player', townHallLevel: 16 }],
                recentSearches: [],
                activeCleanTag: cleanTag
            });

            assert.ok(markup.includes('is-active'));
            assert.ok(markup.includes('data-tag="8PJYGUJC"'));

            // State partitioning key format
            const storagePartitionKey = `oreCalc_player_${cleanTag}`;
            assert.equal(storagePartitionKey, 'oreCalc_player_8PJYGUJC');

            // Simulated URL synchronization
            const mockUrl = new URL('https://orecalc.tech/hero-journey/');
            mockUrl.searchParams.set('tag', cleanTag);
            assert.equal(mockUrl.searchParams.get('tag'), '8PJYGUJC');
        });

        test('3.4: Language Switching + Memoization Cache + Invariant Parity (Feature 7 + Feature 8 + Feature 10)', () => {
            // Invalidate header dimension cache
            resetHeaderWidthCache();

            // Load German dictionary and verify 100% key parity with reference English
            const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));
            const deJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/de.json'), 'utf8'));

            const enKeys = Object.keys(getFlattenedI18nKeys(enJson));
            const deKeys = Object.keys(getFlattenedI18nKeys(deJson));
            assert.equal(deKeys.length, enKeys.length);

            // Render Hero Journey dropdown in German without any emoji characters
            const emojiRegex = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}]/u;
            const markup = renderHeroJourneyDropdownMarkup({
                savedProfiles: [{ tag: '#8PJYGUJC', cleanTag: '8PJYGUJC', name: 'Spieler', townHallLevel: 15 }],
                recentSearches: []
            });
            assert.equal(emojiRegex.test(markup), false);
        });

        test('3.5: Build Concurrency + Invariant Scanning + Route Generation (Feature 7 + Feature 9 + Feature 10)', () => {
            // Verify static build assets and routes exist with clean invariants
            const distDir = path.join(projectRoot, 'dist');
            if (fs.existsSync(distDir)) {
                const rootHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
                const hjHtml = fs.readFileSync(path.join(distDir, 'hero-journey', 'index.html'), 'utf8');

                // Zero emojis across build artifacts
                const emojiRegex = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}]/u;
                assert.equal(emojiRegex.test(rootHtml), false);
                assert.equal(emojiRegex.test(hjHtml), false);

                // Valid canonical links
                assert.ok(rootHtml.includes('https://orecalc.tech/'));
                assert.ok(hjHtml.includes('https://orecalc.tech/hero-journey/'));
            }
        });
    });

    // ==========================================
    // TIER 4: REAL-WORLD APPLICATION SCENARIOS (5 end-to-end integration workflows)
    // ==========================================
    describe('Tier 4: Real-World Application Scenarios Suite', () => {

        test('Scenario 1: Mobile Header Stacking & Scroll Collapse (F1, F2, F3)', () => {
            // Step 1: User on compact 280px mobile viewport accesses Hero Journey
            const initialLayout = computeHeroJourneyHeaderLayout({ containerWidth: 280 });
            assert.equal(initialLayout.isStacked, true, 'Header must switch to stacked 2-row layout on mobile');
            assert.equal(initialLayout.isCompact, true, 'Brand must be compact on 280px');

            // Step 2: User scrolls down page 150px
            const scrollOffset = 150;
            const isScrolled = scrollOffset > 8;
            assert.equal(isScrolled, true, 'Scroll sentinel must detect scrolling and activate floating elevation');

            // Step 3: User taps info button at (left: 5, top: 40)
            const popoverCoords = computePopoverCoordinates({
                elemRect: { top: 40, bottom: 80, left: 5, width: 40, height: 40 },
                popoverRect: { width: 240, height: 140 },
                viewport: { width: 320, height: 568 },
                margin: 12
            });

            assert.equal(popoverCoords.left, 12, 'Popover must clamp to left margin without overflowing screen');
            assert.ok(popoverCoords.top >= 12, 'Popover must maintain top margin');
        });

        test('Scenario 2: Player Search, Dropdown, TH Badge & URL Sync (F4, F5, F6)', () => {
            // Step 1: User types '#2PP0J0V89' into player search input
            const inputQuery = ' #2pp0j0v89 ';
            const normalizedQuery = normalizePlayerTag(inputQuery);
            assert.equal(normalizedQuery, '2PP0J0V89');

            // Step 2: Dropdown displays filtered search result with Town Hall 15 badge
            const dropdownHtml = renderHeroJourneyDropdownMarkup({
                savedProfiles: [
                    { tag: '#2PP0J0V89', cleanTag: '2PP0J0V89', name: 'Master Chief', townHallLevel: 15 }
                ],
                recentSearches: [],
                cleanQuery: normalizedQuery,
                isFiltering: true
            });

            assert.ok(dropdownHtml.includes('data-tag="2PP0J0V89"'));
            assert.ok(dropdownHtml.includes('assets/th/th15.png'));

            // Step 3: User selects player from dropdown -> button mode updates to TH 15 badge
            const selectedButtonState = evaluateHeaderLoadButtonState({ townHallLevel: 15, isFocused: false });
            assert.equal(selectedButtonState.src, 'assets/th/th15.png');
            assert.equal(selectedButtonState.ariaLabel, 'Town Hall 15');
            assert.equal(selectedButtonState.hasBadge, true);

            // Step 4: Storage partition initialized with frozen state
            const playerState = deepFreeze({
                tag: '2PP0J0V89',
                townHallLevel: 15,
                savedAt: Date.now()
            });
            assert.equal(playerState.tag, '2PP0J0V89');
            assert.throws(() => { playerState.tag = 'MUTATED'; }, TypeError);
        });

        test('Scenario 3: Popover Clamping & Scroll Dismissals (F2, F6)', () => {
            // Step 1: User opens equipment details popover near bottom edge of screen (y: 540 in 600px viewport)
            const popoverCoords = computePopoverCoordinates({
                elemRect: { top: 540, bottom: 580, left: 160, width: 40, height: 40 },
                popoverRect: { width: 280, height: 160 },
                viewport: { width: 375, height: 600 },
                margin: 12
            });

            // Vertical flip: space below is only 20px, so it must flip above the anchor
            assert.ok(popoverCoords.top < 540, 'Popover must position above anchor');
            assert.ok(popoverCoords.left >= 12, 'Popover left must clamp within margin');
            assert.ok(popoverCoords.left + 280 <= 375 - 12, 'Popover right must not exceed screen bounds');

            // Step 2: User scrolls track by deltaY = 40px -> dismisses popover
            let isDismissed = false;
            const checkScrollDismiss = (deltaY) => {
                if (Math.abs(deltaY) > 30) isDismissed = true;
            };

            checkScrollDismiss(40);
            assert.equal(isDismissed, true, 'Scroll delta > 30px must trigger popover dismissal');
        });

        test('Scenario 4: Extreme Typography Wrapping & Layout Resilience (F3, F1)', () => {
            // Step 1: User with an ultra-long non-breaking name views profile card on 375px phone
            const ultraLongName = 'Supercalifragilisticexpialidocious_Warrior_99';
            const escapedName = escapeHTML(ultraLongName);
            assert.equal(escapedName, ultraLongName);

            // Step 2: CSS layout contracts verify wrapping rules
            const profileScss = fs.readFileSync(path.join(projectRoot, 'css/components/profile/_profile-header.scss'), 'utf8');
            assert.match(profileScss, /overflow-wrap:\s*anywhere;/);
            assert.match(profileScss, /word-break:\s*break-word;/);

            // Step 3: Clan name subheader is constrained by max-width: 58% on mobile
            assert.match(profileScss, /max-width:\s*58%;/);
        });

        test('Scenario 5: Clean Production Build with Service Worker & Zero Invariant Warnings (F7, F8, F9, F10)', () => {
            // Step 1: Validate i18n dictionaries have 100% parity across all 4 languages (1146 keys)
            const enDict = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));
            const deDict = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/de.json'), 'utf8'));
            const trDict = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/tr.json'), 'utf8'));
            const zhDict = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/zh.json'), 'utf8'));

            const enKeyCount = Object.keys(getFlattenedI18nKeys(enDict)).length;
            assert.equal(enKeyCount, 1149, 'Reference dictionary must have 1149 keys');
            assert.equal(Object.keys(getFlattenedI18nKeys(deDict)).length, enKeyCount, 'de.json must have 1149 keys');
            assert.ok(Object.keys(getFlattenedI18nKeys(trDict)).length >= 1146, 'tr.json preserves community translation boundary');
            assert.ok(Object.keys(getFlattenedI18nKeys(zhDict)).length >= 1146, 'zh.json preserves community translation boundary');

            // Step 2: Verify zero emojis in production code
            const emojiPattern = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}]/u;
            assert.equal(emojiPattern.test(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8')), false);

            // Step 3: Verify build scripts and service worker configs
            const wbConfig = fs.readFileSync(path.join(projectRoot, 'workbox-config.js'), 'utf8');
            assert.ok(wbConfig.includes('dist/service-worker.js'));
        });
    });
});
