import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

/**
 * Dynamic template interpolation allowlist rules.
 * Captures classes generated at runtime via template literals in JS.
 */
export const DYNAMIC_TEMPLATE_ALLOWLIST = [
    {
        name: 'star-bonus-${n}x',
        pattern: /^star-bonus-\d+x$/,
        rationale: 'Dynamically constructed in js/data/incomeSourceRegistry.js via `star-bonus-${multiplierStr}`'
    },
    {
        name: 'type-${commitType}',
        pattern: /^type-(?:feat|fix|chore|docs|perf|refactor|style|test)$/,
        rationale: 'Dynamically constructed in js/components/changelog/commitsModal.js via `type-${escapeHTML(type)}`'
    },
    {
        name: 'spotright-tag--${rarity}',
        pattern: /^spotright-tag--(?:common|epic)$/,
        rationale: 'Dynamically constructed in js/components/spotright/spotrightDisplay.js via `spotright-tag--${item.rarity}`'
    },
    {
        name: 'badge-result-${result}',
        pattern: /^badge-result-(?:win|loss|draw)$/,
        rationale: 'Dynamically constructed in js/utils/chipFactory.js via `badge-result-${data.result}`'
    },
    {
        name: 'badge-${type/rarity}',
        pattern: /^badge-(?:active|passive|common|epic)$/,
        rationale: 'Dynamically constructed in js/components/equipment/equipmentDetailsHeaderDisplay.js via `badge-${effectiveType}` and `badge-${effectiveRarity}`'
    },
    {
        name: 'ore-text-${ore}',
        pattern: /^ore-text-(?:shiny|glowy|starry)$/,
        rationale: 'Dynamically constructed in js/components/planner/priorityListModalDisplay.js and heroJourneyTableRenderer.js via `ore-text-${resourceType}`'
    },
    {
        name: 'ore-badge-${ore}',
        pattern: /^ore-badge-(?:shiny|glowy|starry)$/,
        rationale: 'Dynamically paired with ore-text in css/components/cards/_cards-popovers.scss via `.ore-badge-${ore}`'
    },
    {
        name: 'toast-${type}',
        pattern: /^toast-(?:info|success|warning|error)$/,
        rationale: 'Dynamically constructed in js/ui/toast.js via `toast-${type}`'
    },
    {
        name: 'is-${type}',
        pattern: /^is-(?:error|notice)$/,
        rationale: 'Dynamically constructed in js/components/landing/landingSearchController.js via `is-${type}`'
    }
];

/**
 * Recursively find all files matching given extensions within a directory.
 * @param {string} dir
 * @param {string[]} exts
 * @returns {string[]}
 */
function findFiles(dir, exts) {
    const results = [];
    const fullDir = path.isAbsolute(dir) ? dir : path.join(projectRoot, dir);
    if (!fs.existsSync(fullDir)) return results;
    for (const entry of fs.readdirSync(fullDir, { withFileTypes: true })) {
        if (['node_modules', 'dist', '.git', '.gemini', 'server', 'tests', 'coverage'].includes(entry.name)) {
            continue;
        }
        const full = path.join(fullDir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findFiles(full, exts));
        } else if (exts.some(e => entry.name.endsWith(e))) {
            results.push(full);
        }
    }
    return results;
}

/**
 * Analyzes compiled SCSS stylesheets against HTML partials and JS source modules.
 * Builds single-pass token sets across HTML and JS for O(1) selector lookup.
 * Applies the dynamic template interpolation allowlist to filter runtime-interpolated classes.
 * @returns {{
 *   totalSelectors: number,
 *   referencedCount: number,
 *   initiallyFlaggedCount: number,
 *   allowedCount: number,
 *   allowedBreakdown: Array<{ name: string, pattern: string, count: number, classes: string[] }>,
 *   unreferenced: string[],
 *   categorized: Record<string, string[]>
 * }}
 */
export function scanCssReachability() {
    const htmlFiles = [
        path.join(projectRoot, 'index.html'),
        path.join(projectRoot, 'hero-journey/index.html'),
        path.join(projectRoot, 'damage-calculator/index.html'),
        path.join(projectRoot, 'ore-calculator/index.html'),
        path.join(projectRoot, 'account/index.html'),
        ...findFiles('partials', ['.html']),
        ...findFiles('legal', ['.html'])
    ];

    const jsFiles = findFiles('js', ['.js']);
    const i18nFiles = findFiles('js/i18n', ['.json']);

    const htmlContents = htmlFiles.map(f => fs.readFileSync(f, 'utf8'));

    // Strip getElementById calls so DOM IDs do not falsely mask unreferenced CSS classes
    const allJsText = jsFiles
        .map(f => fs.readFileSync(f, 'utf8'))
        .join('\n')
        .replace(/getElementById\s*\(\s*['"][^'"]+['"]\s*\)/g, '');

    // Extract all class attributes from HTML files and i18n localized markup
    const htmlTokens = new Set();
    for (const content of htmlContents) {
        const classAttrRegex = /class\s*=\s*["']([^"']+)["']/g;
        let match;
        while ((match = classAttrRegex.exec(content)) !== null) {
            match[1].split(/\s+/).forEach(token => {
                if (token) htmlTokens.add(token);
            });
        }
    }

    for (const f of i18nFiles) {
        const content = fs.readFileSync(f, 'utf8');
        const classAttrRegex = /class\\*=\\*["\\]*([^"\\\\]+)["\\]*/g;
        let match;
        while ((match = classAttrRegex.exec(content)) !== null) {
            match[1].split(/\s+/).forEach(token => {
                if (token) htmlTokens.add(token);
            });
        }
    }

    // Pre-extract dot selectors, template classes, and string literals from JS in a single pass
    const jsTokens = new Set();
    let m;

    const dotRegex = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g;
    while ((m = dotRegex.exec(allJsText)) !== null) {
        jsTokens.add(m[1]);
    }

    const classAttrRegex = /class\s*=\s*["']([^"']+)["']/g;
    while ((m = classAttrRegex.exec(allJsText)) !== null) {
        const tokens = m[1].match(/[a-zA-Z_-][a-zA-Z0-9_-]*/g) || [];
        tokens.forEach(t => {
            if (t) jsTokens.add(t);
        });
    }

    const classNameRegex = /className\s*=\s*[`'"]([^\n;`'"]*)[`'"]/g;
    while ((m = classNameRegex.exec(allJsText)) !== null) {
        const staticText = m[1].replace(/\$\{[^}]*\}/g, ' ');
        const tokens = staticText.match(/[a-zA-Z_-][a-zA-Z0-9_-]*/g) || [];
        tokens.forEach(t => {
            if (t) jsTokens.add(t);
        });
    }

    const stringLiteralRegex = /['"`]([a-zA-Z0-9_\-\s]{2,80})['"`]/g;
    while ((m = stringLiteralRegex.exec(allJsText)) !== null) {
        m[1].split(/\s+/).forEach(t => {
            if (t) jsTokens.add(t);
        });
    }

    const entryFiles = [
        path.join(projectRoot, 'css/main.scss'),
        path.join(projectRoot, 'css/hero-journey.scss'),
        path.join(projectRoot, 'css/damage-calculator.scss'),
        path.join(projectRoot, 'css/landing.scss'),
        path.join(projectRoot, 'css/account.scss')
    ];

    const classSet = new Set();
    for (const entry of entryFiles) {
        if (!fs.existsSync(entry)) continue;
        const res = sass.compile(entry);
        const css = res.css.replace(/\/\*[\s\S]*?\*\//g, '');
        const ruleRegex = /([^{};@]+)\{/g;
        let match;
        while ((match = ruleRegex.exec(css)) !== null) {
            const selectorPart = match[1].trim();
            if (selectorPart.startsWith('@') || selectorPart.includes('%')) continue;
            const classRegex = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g;
            let cMatch;
            while ((cMatch = classRegex.exec(selectorPart)) !== null) {
                classSet.add(cMatch[1]);
            }
        }
    }

    // Identify initially unreferenced classes
    const initiallyFlagged = [];
    for (const cls of classSet) {
        if (htmlTokens.has(cls) || jsTokens.has(cls)) continue;
        initiallyFlagged.push(cls);
    }

    initiallyFlagged.sort();

    // Evaluate dynamic template allowlist
    const allowedBreakdown = DYNAMIC_TEMPLATE_ALLOWLIST.map(rule => ({
        name: rule.name,
        pattern: rule.pattern.toString(),
        count: 0,
        classes: []
    }));

    const unreferenced = [];
    let allowedCount = 0;

    for (const cls of initiallyFlagged) {
        let matchedRule = null;
        for (let i = 0; i < DYNAMIC_TEMPLATE_ALLOWLIST.length; i++) {
            if (DYNAMIC_TEMPLATE_ALLOWLIST[i].pattern.test(cls)) {
                matchedRule = allowedBreakdown[i];
                break;
            }
        }

        if (matchedRule) {
            matchedRule.count++;
            matchedRule.classes.push(cls);
            allowedCount++;
        } else {
            unreferenced.push(cls);
        }
    }

    unreferenced.sort();

    const categorized = {
        legacyModalsAndAuth: [],
        legacySettings: [],
        damageCalculator: [],
        landing: [],
        statusAndModifiers: [],
        general: []
    };

    for (const cls of unreferenced) {
        if (cls.startsWith('passkey') || cls.startsWith('auth-') || cls.includes('modal') || cls.startsWith('btn-download') || cls.startsWith('btn-data-info') || cls.startsWith('reset-data-')) {
            categorized.legacyModalsAndAuth.push(cls);
        } else if (cls.startsWith('app-settings-')) {
            categorized.legacySettings.push(cls);
        } else if (cls.startsWith('calc-') || cls.startsWith('solution-')) {
            categorized.damageCalculator.push(cls);
        } else if (cls.startsWith('landing-')) {
            categorized.landing.push(cls);
        } else if (cls.startsWith('is-') || cls.includes('--disabled') || cls.includes('--active') || cls.startsWith('push-')) {
            categorized.statusAndModifiers.push(cls);
        } else {
            categorized.general.push(cls);
        }
    }

    return {
        totalSelectors: classSet.size,
        referencedCount: classSet.size - initiallyFlagged.length,
        initiallyFlaggedCount: initiallyFlagged.length,
        allowedCount,
        allowedBreakdown,
        unreferenced,
        categorized
    };
}

describe('CSS Selector Reachability & Dead Class Audit Suite', () => {
    let auditResult;

    test('compiles stylesheets and parses class selectors across all entry points', () => {
        auditResult = scanCssReachability();
        assert.ok(auditResult.totalSelectors > 1500, `Expected > 1500 class selectors, found ${auditResult.totalSelectors}`);
        assert.ok(auditResult.referencedCount > 1000, `Expected > 1000 referenced classes, found ${auditResult.referencedCount}`);
    });

    test('evaluates dynamic template allowlist and logs skipped wildcard patterns', () => {
        assert.ok(auditResult.allowedCount > 0, 'Expected dynamic allowlist to match dynamic runtime classes');

        console.log('\n--- Dynamic Template Interpolation Allowlist Evaluation ---');
        for (const item of auditResult.allowedBreakdown) {
            console.log(`[ALLOWLIST] ${item.name} (${item.pattern}) skipped ${item.count} classes:`);
            console.log(`            ${item.classes.join(', ')}`);
        }
        console.log(`\n[SUMMARY] Initially unreferenced: ${auditResult.initiallyFlaggedCount}`);
        console.log(`[SUMMARY] Skipped via dynamic allowlist: ${auditResult.allowedCount}`);
        console.log(`[SUMMARY] Remaining dead CSS candidates: ${auditResult.unreferenced.length}\n`);

        const starBonusRule = auditResult.allowedBreakdown.find(r => r.name === 'star-bonus-${n}x');
        assert.ok(starBonusRule && starBonusRule.count >= 4, 'star-bonus-${n}x pattern must match all dynamic multipliers');
    });

    test('verifies zero false positives on known active header and navigation components', () => {
        const activeKnownClasses = [
            'app-header',
            'header-account-btn',
            'player-dropdown-button',
            'tab-bar-container',
            'account-user-profile-card',
            'account-popover-panel-summary',
            'account-popover-panel-body',
            'brand-title'
        ];

        for (const cls of activeKnownClasses) {
            assert.equal(
                auditResult.unreferenced.includes(cls),
                false,
                `Active class '${cls}' must not be marked as unreferenced`
            );
        }
    });

    test('verifies zero unreferenced dead CSS classes across compiled stylesheets', () => {
        assert.ok(Array.isArray(auditResult.unreferenced));
        assert.strictEqual(auditResult.unreferenced.length, 0, 'Must have zero unreferenced dead CSS classes across compiled stylesheets');
    });
});
