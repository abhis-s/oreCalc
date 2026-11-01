const fs = require('node:fs');
const path = require('node:path');
const sass = require('sass');

const projectRoot = path.resolve(__dirname, '..');

/**
 * Documented JavaScript DOM query hooks and system theme markers present in HTML templates.
 * These classes do not carry dedicated styling rules because they function exclusively
 * as behavioral event targets, view switchers, or animation targets.
 */
const HTML_ALLOWED_JS_HOOKS = [
    { name: 'dark-mode', rationale: 'System theme toggle class applied to <body> elements across page templates' },
    { name: 'calc-offense-modal', rationale: 'Queried by damageCalcOffenseModalDisplay.js to locate the offense dialog' },
    { name: 'calc-target-combos-modal', rationale: 'Queried by damageCalcTargetCombosModalDisplay.js to locate target combos dialog' },
    { name: 'icon-vis-on', rationale: 'Queried by password input modules to toggle visibility icon states' },
    { name: 'icon-vis-off', rationale: 'Queried by password input modules to toggle visibility icon states' },
    { name: 'account-pairing-timer', rationale: 'Queried by accountPageSessionsDisplay.js to update the live pairing countdown' },
    { name: 'auth-view', rationale: 'Queried by accountPageDisplay.js and authModalDisplay.js for view switching' },
    { name: 'custom-chip-section', rationale: 'Queried by createCustomChipsModalInputs.js to toggle section visibility' },
    { name: 'income-table-value', rationale: 'Queried by homeTableNumberAnimation.js to animate calculated ore income cells' },
    { name: 'income-table-resource', rationale: 'Queried by homeTableNumberAnimation.js to animate calculated ore income cells' },
    { name: 'calendar-track', rationale: 'Queried by calendarInputs.js to coordinate calendar scroll and chip placements' },
    { name: 'development-list', rationale: 'Queried by settingsPricingInputs.js to mount development support action buttons' }
];

/**
 * Dynamic template wildcard patterns generated at runtime in JavaScript modules.
 */
const DYNAMIC_TEMPLATE_ALLOWLIST = [
    { name: 'star-bonus-${n}x', pattern: /^star-bonus-\d+x$/ },
    { name: 'type-${commitType}', pattern: /^type-(?:feat|fix|chore|docs|perf|refactor|style|test)$/ },
    { name: 'spotright-tag--${rarity}', pattern: /^spotright-tag--(?:common|epic)$/ },
    { name: 'badge-result-${result}', pattern: /^badge-result-(?:win|loss|draw)$/ },
    { name: 'badge-${type/rarity}', pattern: /^badge-(?:active|passive|common|epic)$/ },
    { name: 'ore-text-${ore}', pattern: /^ore-text-(?:shiny|glowy|starry)$/ },
    { name: 'ore-badge-${ore}', pattern: /^ore-badge-(?:shiny|glowy|starry)$/ },
    { name: 'toast-${type}', pattern: /^toast-(?:info|success|warning|error)$/ },
    { name: 'is-${type}', pattern: /^is-(?:error|notice)$/ }
];

function findFiles(dir, exts, excludes = ['node_modules', 'dist', '.git', '.gemini', 'coverage', 'scratch']) {
    const results = [];
    const fullDir = path.isAbsolute(dir) ? dir : path.join(projectRoot, dir);
    if (!fs.existsSync(fullDir)) return results;
    for (const entry of fs.readdirSync(fullDir, { withFileTypes: true })) {
        if (excludes.includes(entry.name)) {
            continue;
        }
        const full = path.join(fullDir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findFiles(full, exts, excludes));
        } else if (exts.some(e => entry.name.endsWith(e))) {
            results.push(full);
        }
    }
    return results;
}

function getProductionHtmlFiles() {
    const rootTemplates = [
        path.join(projectRoot, 'index.html'),
        path.join(projectRoot, 'hero-journey/index.html'),
        path.join(projectRoot, 'damage-calculator/index.html'),
        path.join(projectRoot, 'ore-calculator/index.html'),
        path.join(projectRoot, 'account/index.html'),
        path.join(projectRoot, '404.html')
    ].filter(f => fs.existsSync(f));

    return [
        ...rootTemplates,
        ...findFiles('partials', ['.html']),
        ...findFiles('legal', ['.html'])
    ];
}

function compileAndExtractCssClasses() {
    const entryPoints = [
        path.join(projectRoot, 'css/main.scss'),
        path.join(projectRoot, 'css/hero-journey.scss'),
        path.join(projectRoot, 'css/landing.scss'),
        path.join(projectRoot, 'css/damage-calculator.scss'),
        path.join(projectRoot, 'css/account.scss'),
        path.join(projectRoot, 'legal/legal.scss')
    ];

    const classSet = new Set();
    for (const entry of entryPoints) {
        if (!fs.existsSync(entry)) continue;
        const res = sass.compile(entry, { style: 'expanded' });
        const cleanCss = res.css.replace(/\/\*[\s\S]*?\*\//g, '');
        const ruleRegex = /([^{}]+)\{/g;
        let rMatch;
        while ((rMatch = ruleRegex.exec(cleanCss)) !== null) {
            const selectorPart = rMatch[1];
            if (selectorPart.includes('@keyframes') || selectorPart.includes('@media') || selectorPart.includes('@container')) {
                continue;
            }
            const classRegex = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g;
            let cMatch;
            while ((cMatch = classRegex.exec(selectorPart)) !== null) {
                classSet.add(cMatch[1]);
            }
        }
    }
    return classSet;
}

function extractHtmlClassTokens(htmlFiles) {
    const htmlClasses = new Map(); // className -> Set of files
    for (const file of htmlFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const classMatches = content.matchAll(/\bclass\s*=\s*["']([^"']+)["']/g);
        for (const m of classMatches) {
            const tokens = m[1].split(/\s+/).filter(Boolean);
            for (const t of tokens) {
                if (!htmlClasses.has(t)) {
                    htmlClasses.set(t, new Set());
                }
                htmlClasses.get(t).add(path.relative(projectRoot, file));
            }
        }
    }
    return htmlClasses;
}

function scanJsTokens(htmlFiles) {
    const jsFiles = findFiles('js', ['.js']);
    const i18nFiles = findFiles('js/i18n', ['.json']);

    const jsTexts = jsFiles.map(f => fs.readFileSync(f, 'utf8'));

    // Extract inline <script> tags from HTML templates
    for (const file of htmlFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const scriptMatches = content.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi);
        for (const sm of scriptMatches) {
            jsTexts.push(sm[1]);
        }
    }

    const allJsText = jsTexts
        .join('\n')
        .replace(/getElementById\s*\(\s*['"][^'"]+['"]\s*\)/g, '');

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

    // Add classes found inside localized i18n HTML markup strings
    for (const f of i18nFiles) {
        const content = fs.readFileSync(f, 'utf8');
        const i18nClassRegex = /class\\*=\\*["\\]*([^"\\\\]+)["\\]*/g;
        while ((m = i18nClassRegex.exec(content)) !== null) {
            m[1].split(/\s+/).forEach(token => {
                if (token) jsTokens.add(token);
            });
        }
    }

    return jsTokens;
}

function runAudit() {
    const args = process.argv.slice(2);
    const runOnlyCoverage = args.includes('--coverage');
    const runOnlyReachability = args.includes('--reachability');
    const isVerbose = args.includes('--verbose');

    console.log('--- CSS Architecture, Reachability & Coverage Audit ---');

    const compiledClasses = compileAndExtractCssClasses();
    console.log(`[OK] Compiled 6 Sass entry points (${compiledClasses.size} unique class selectors).`);

    const htmlFiles = getProductionHtmlFiles();
    const htmlClasses = extractHtmlClassTokens(htmlFiles);
    console.log(`[OK] Parsed ${htmlFiles.length} HTML files (${htmlClasses.size} unique class tokens).`);

    let hasErrors = false;

    // Part A: Reverse CSS Coverage (HTML -> CSS / JS Hooks)
    if (!runOnlyReachability) {
        const jsHookNames = new Set(HTML_ALLOWED_JS_HOOKS.map(h => h.name));
        const unstyledHtmlClasses = [];

        for (const [cls, files] of htmlClasses.entries()) {
            const isCoveredByCss = compiledClasses.has(cls);
            const isCoveredByJsHook = jsHookNames.has(cls);
            if (!isCoveredByCss && !isCoveredByJsHook) {
                unstyledHtmlClasses.push({ cls, files: Array.from(files) });
            }
        }

        if (unstyledHtmlClasses.length > 0) {
            console.error(`[ERROR] Found ${unstyledHtmlClasses.length} unstyled HTML class token(s):`);
            for (const item of unstyledHtmlClasses) {
                console.error(`        .${item.cls} in: ${item.files.join(', ')}`);
            }
            hasErrors = true;
        } else {
            console.log('[OK] 100% of HTML class tokens resolve to active CSS rules or documented JS hooks.');
        }

        // Stale JS hooks check
        const staleHooks = [];
        for (const hook of HTML_ALLOWED_JS_HOOKS) {
            if (!htmlClasses.has(hook.name)) {
                staleHooks.push(hook.name);
            }
        }
        if (staleHooks.length > 0) {
            console.error(`[ERROR] Stale JS hook(s) in allowlist not found in any HTML template: ${staleHooks.join(', ')}`);
            hasErrors = true;
        } else {
            console.log('[OK] All documented JS query hooks actively exist in HTML templates.');
        }
    }

    // Part B: Dead CSS Selector Reachability (CSS -> HTML / JS)
    if (!runOnlyCoverage) {
        const jsTokens = scanJsTokens(htmlFiles);
        const initiallyUnreferenced = [];

        for (const cls of compiledClasses) {
            if (htmlClasses.has(cls) || jsTokens.has(cls)) continue;
            initiallyUnreferenced.push(cls);
        }

        const remainingUnreferenced = [];
        const skippedByAllowlist = [];

        for (const cls of initiallyUnreferenced) {
            const matchedRule = DYNAMIC_TEMPLATE_ALLOWLIST.find(rule => rule.pattern.test(cls));
            if (matchedRule) {
                skippedByAllowlist.push({ cls, rule: matchedRule.name });
            } else {
                remainingUnreferenced.push(cls);
            }
        }

        if (isVerbose) {
            console.log(`\n[VERBOSE] Dynamic allowlist accounted for ${skippedByAllowlist.length} generated classes:`);
            for (const item of skippedByAllowlist) {
                console.log(`          .${item.cls} (${item.rule})`);
            }
        }

        if (remainingUnreferenced.length > 0) {
            console.error(`[ERROR] Found ${remainingUnreferenced.length} dead CSS class selector(s) in compiled stylesheets:`);
            for (const cls of remainingUnreferenced) {
                console.error(`        .${cls}`);
            }
            hasErrors = true;
        } else {
            console.log('[OK] Zero unreferenced dead CSS class selectors across compiled stylesheets.');
        }
    }

    if (hasErrors) {
        console.error('\n[FAIL] CSS architecture and coverage audit failed.');
        process.exit(1);
    } else {
        console.log('[SUCCESS] CSS architecture, reachability, and coverage audit passed cleanly.\n');
    }
}

runAudit();
