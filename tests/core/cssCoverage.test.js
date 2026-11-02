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
 * Verified JavaScript DOM query hooks and system theme markers present in HTML templates.
 * These classes do not carry dedicated styling rules because they function exclusively
 * as behavioral event targets, view switchers, or animation targets.
 */
export const HTML_ALLOWED_JS_HOOKS = [
    {
        name: 'dark-mode',
        rationale: 'System theme toggle class applied to <body> elements across page templates'
    },
    {
        name: 'calc-offense-modal',
        rationale: 'Queried by damageCalcOffenseModalDisplay.js to locate the offense dialog'
    },
    {
        name: 'calc-target-combos-modal',
        rationale: 'Queried by damageCalcTargetCombosModalDisplay.js to locate target combos dialog'
    },
    {
        name: 'icon-vis-on',
        rationale: 'Queried by password input modules to toggle visibility icon states'
    },
    {
        name: 'icon-vis-off',
        rationale: 'Queried by password input modules to toggle visibility icon states'
    },
    {
        name: 'account-pairing-timer',
        rationale: 'Queried by accountPageSessionsDisplay.js to update the live pairing countdown'
    },
    {
        name: 'auth-view',
        rationale: 'Queried by accountPageDisplay.js and authModalDisplay.js for view switching'
    },
    {
        name: 'custom-chip-section',
        rationale: 'Queried by createCustomChipsModalInputs.js to toggle section visibility'
    },
    {
        name: 'income-table-value',
        rationale: 'Queried by homeTableNumberAnimation.js to animate calculated ore income cells'
    },
    {
        name: 'income-table-resource',
        rationale: 'Queried by homeTableNumberAnimation.js to animate calculated ore income cells'
    },
    {
        name: 'calendar-track',
        rationale: 'Queried by calendarInputs.js to coordinate calendar scroll and chip placements'
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
        if (['node_modules', 'dist', '.git', '.gemini', 'server', 'tests', 'coverage', 'scratch'].includes(entry.name)) {
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
 * Returns all production HTML files across the application.
 * @returns {string[]}
 */
function getProductionHtmlFiles() {
    return [
        path.join(projectRoot, 'index.html'),
        path.join(projectRoot, 'hero-journey/index.html'),
        path.join(projectRoot, 'damage-calculator/index.html'),
        path.join(projectRoot, 'ore-calculator/index.html'),
        path.join(projectRoot, 'account/index.html'),
        ...findFiles('partials', ['.html']),
        ...findFiles('legal', ['.html'])
    ];
}

/**
 * Compiles all entry stylesheets and extracts all declared CSS class selectors.
 * @returns {Set<string>}
 */
function getCompiledCssClasses() {
    const entryFiles = [
        path.join(projectRoot, 'css/main.scss'),
        path.join(projectRoot, 'css/hero-journey.scss'),
        path.join(projectRoot, 'css/damage-calculator.scss'),
        path.join(projectRoot, 'css/landing.scss'),
        path.join(projectRoot, 'css/account.scss'),
        path.join(projectRoot, 'legal/legal.scss')
    ];

    const cssClasses = new Set();
    for (const entry of entryFiles) {
        if (!fs.existsSync(entry)) continue;
        const res = sass.compile(entry);
        const css = res.css.replace(/\/\*[\s\S]*?\*\//g, '');
        const classRegex = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g;
        let match;
        while ((match = classRegex.exec(css)) !== null) {
            cssClasses.add(match[1]);
        }
    }
    return cssClasses;
}

describe('Reverse CSS Coverage & Element Styling Guardrail Suite', () => {
    test('100% of HTML class tokens resolve to active CSS rules or documented JS hooks', () => {
        const cssClasses = getCompiledCssClasses();
        const htmlFiles = getProductionHtmlFiles();
        const allowedHooksSet = new Set(HTML_ALLOWED_JS_HOOKS.map(h => h.name));

        const unstyledViolations = [];
        const seenHtmlClasses = new Set();

        for (const filePath of htmlFiles) {
            const content = fs.readFileSync(filePath, 'utf8');
            const classAttrRegex = /\bclass\s*=\s*["']([^"']+)["']/g;
            let match;
            while ((match = classAttrRegex.exec(content)) !== null) {
                const tokens = match[1].split(/\s+/).filter(Boolean);
                for (const token of tokens) {
                    seenHtmlClasses.add(token);
                    if (!cssClasses.has(token) && !allowedHooksSet.has(token)) {
                        unstyledViolations.push({
                            file: path.relative(projectRoot, filePath),
                            className: token
                        });
                    }
                }
            }
        }

        assert.deepEqual(
            unstyledViolations,
            [],
            `Found ${unstyledViolations.length} HTML class token(s) lacking CSS rules or allowlist registration:\n` +
            unstyledViolations.map(v => `  - ${v.file}: .${v.className}`).join('\n')
        );
    });

    test('all registered JS hooks in allowlist actively exist in HTML templates (zero stale allowlist entries)', () => {
        const htmlFiles = getProductionHtmlFiles();
        const seenHtmlClasses = new Set();

        for (const filePath of htmlFiles) {
            const content = fs.readFileSync(filePath, 'utf8');
            const classAttrRegex = /\bclass\s*=\s*["']([^"']+)["']/g;
            let match;
            while ((match = classAttrRegex.exec(content)) !== null) {
                match[1].split(/\s+/).filter(Boolean).forEach(t => seenHtmlClasses.add(t));
            }
        }

        const staleHooks = [];
        for (const hook of HTML_ALLOWED_JS_HOOKS) {
            if (!seenHtmlClasses.has(hook.name)) {
                staleHooks.push(hook.name);
            }
        }

        assert.deepEqual(
            staleHooks,
            [],
            `Found ${staleHooks.length} stale JS hook(s) in allowlist not present in HTML templates: ${staleHooks.join(', ')}`
        );
    });
});
