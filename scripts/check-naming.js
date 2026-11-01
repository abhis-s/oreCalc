const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');

/**
 * Recursively find all files matching given extensions within a directory.
 * @param {string} dir
 * @param {string[]} exts
 * @param {string[]} [excludes]
 * @returns {string[]}
 */
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

function runNamingChecks() {
    let hasErrors = false;
    const htmlFiles = getProductionHtmlFiles();

    console.log('--- DOM & BEM Naming Convention Linter ---');

    // 1. DOM Element IDs
    const nonKebabIds = [];
    for (const filePath of htmlFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        const idMatches = content.matchAll(/\bid\s*=\s*["']([^"'\s>]+)["']/g);
        for (const match of idMatches) {
            const idVal = match[1];
            if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(idVal)) {
                nonKebabIds.push({ file: path.relative(projectRoot, filePath), id: idVal });
            }
        }
    }
    if (nonKebabIds.length > 0) {
        console.error(`[ERROR] Found ${nonKebabIds.length} non-kebab DOM ID(s):`);
        for (const item of nonKebabIds) {
            console.error(`        ${item.file}: id="${item.id}"`);
        }
        hasErrors = true;
    } else {
        console.log('[OK] All DOM element IDs follow lowercase kebab-case.');
    }

    // 2. Checkbox input suffixes
    const nonCompliantCheckboxes = [];
    for (const filePath of htmlFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        const inputMatches = content.matchAll(/<input\b[^>]*type=["']checkbox["'][^>]*>/gi);
        for (const match of inputMatches) {
            const tag = match[0];
            const idMatch = tag.match(/\bid=["']([^"']+)["']/i);
            if (idMatch) {
                const idVal = idMatch[1];
                if (idVal.endsWith('-toggle') || idVal.endsWith('-btn') || idVal.endsWith('-button')) {
                    nonCompliantCheckboxes.push({ file: path.relative(projectRoot, filePath), id: idVal });
                }
            }
        }
    }
    if (nonCompliantCheckboxes.length > 0) {
        console.error(`[ERROR] Found ${nonCompliantCheckboxes.length} checkbox input(s) with prohibited -toggle/-btn suffix:`);
        for (const item of nonCompliantCheckboxes) {
            console.error(`        ${item.file}: id="${item.id}"`);
        }
        hasErrors = true;
    } else {
        console.log('[OK] Zero prohibited control suffixes on checkbox inputs.');
    }

    // 3. Feature Switches
    const expectedSwitchIds = [
        'app-theme-switch',
        'settings-theme-switch',
        'settings-cozy-quilt-switch',
        'eq-enable-level-edit-switch',
        'eq-hide-maxed-switch',
        'eq-hide-locked-switch',
        'home-hj-accelerated-switch',
        'inc-event-pass-switch',
        'inc-event-include-equipment-switch'
    ];
    const detectedSwitchIds = new Set();
    for (const filePath of htmlFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        const switchMatches = content.matchAll(/\bid=["']([^"']*-switch)["']/gi);
        for (const match of switchMatches) {
            detectedSwitchIds.add(match[1]);
        }
    }
    const missingSwitches = expectedSwitchIds.filter(id => !detectedSwitchIds.has(id));
    if (missingSwitches.length > 0) {
        console.error(`[ERROR] Missing expected canonical UI -switch identifiers: ${missingSwitches.join(', ')}`);
        hasErrors = true;
    } else {
        console.log('[OK] All feature switches enforce semantic -switch suffix.');
    }

    // 4. Double-Element BEM Chains
    const scssFiles = findFiles('css', ['.scss']);
    const doubleElementViolations = [];
    for (const filePath of htmlFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        const classMatches = content.matchAll(/\bclass\s*=\s*["']([^"']+)["']/g);
        for (const match of classMatches) {
            const tokens = match[1].split(/\s+/);
            for (const token of tokens) {
                if (/__[a-z0-9-]+__/.test(token)) {
                    doubleElementViolations.push({ file: path.relative(projectRoot, filePath), token });
                }
            }
        }
    }
    for (const filePath of scssFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        const selectorMatches = content.matchAll(/\.([a-zA-Z0-9_-]+)/g);
        for (const match of selectorMatches) {
            const selector = match[1];
            if (/__[a-z0-9-]+__/.test(selector)) {
                doubleElementViolations.push({ file: path.relative(projectRoot, filePath), token: selector });
            }
        }
    }
    if (doubleElementViolations.length > 0) {
        console.error(`[ERROR] Found ${doubleElementViolations.length} double-element BEM violation(s):`);
        for (const item of doubleElementViolations) {
            console.error(`        ${item.file}: .${item.token}`);
        }
        hasErrors = true;
    } else {
        console.log('[OK] Zero double-element BEM chains across HTML templates and stylesheets.');
    }

    // 5. Duplicate Class Tokens
    const duplicates = [];
    for (const filePath of htmlFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        const classMatches = content.matchAll(/\bclass\s*=\s*["']([^"']+)["']/g);
        for (const match of classMatches) {
            const rawAttr = match[1];
            const tokens = rawAttr.split(/\s+/).filter(Boolean);
            const seen = new Set();
            for (const t of tokens) {
                if (seen.has(t)) {
                    duplicates.push({
                        file: path.relative(projectRoot, filePath),
                        attribute: rawAttr,
                        duplicateToken: t
                    });
                    break;
                }
                seen.add(t);
            }
        }
    }
    if (duplicates.length > 0) {
        console.error(`[ERROR] Found ${duplicates.length} duplicate class token(s) within single class attributes:`);
        for (const item of duplicates) {
            console.error(`        ${item.file}: "${item.attribute}" (duplicate: ${item.duplicateToken})`);
        }
        hasErrors = true;
    } else {
        console.log('[OK] Zero duplicate class tokens in HTML template attributes.');
    }

    // 6. Legacy Action Button Classes
    const jsFiles = findFiles('js', ['.js']);
    const legacyMatches = [];
    const legacyClassPatterns = [
        { name: 'reject-button', regex: /\breject-button\b/ },
        { name: 'accept-button', regex: /\baccept-button\b/ },
        { name: 'confirm-button', regex: /\bconfirm-button\b/ },
        { name: 'modal-close-icon', regex: /\bmodal-close-icon\b/ }
    ];
    for (const filePath of htmlFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        for (const { name, regex } of legacyClassPatterns) {
            if (regex.test(content)) {
                legacyMatches.push({ file: path.relative(projectRoot, filePath), legacyClass: name });
            }
        }
    }
    for (const filePath of jsFiles) {
        const relPath = path.relative(projectRoot, filePath);
        if (relPath === 'js/utils/modalFocusManager.js') continue;
        const content = fs.readFileSync(filePath, 'utf8');
        for (const { name, regex } of legacyClassPatterns) {
            if (regex.test(content)) {
                legacyMatches.push({ file: relPath, legacyClass: name });
            }
        }
    }
    if (legacyMatches.length > 0) {
        console.error(`[ERROR] Found ${legacyMatches.length} legacy button/action class reference(s):`);
        for (const item of legacyMatches) {
            console.error(`        ${item.file}: ${item.legacyClass}`);
        }
        hasErrors = true;
    } else {
        console.log('[OK] Zero legacy action button classes across templates and JS modules.');
    }

    // 7. Modal Close and Footer Action Buttons
    const modalFiles = findFiles('partials/modals', ['.html']);
    const nonCanonicalButtons = [];
    for (const filePath of modalFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        const buttonMatches = content.matchAll(/<button\b([^>]*)>/gi);
        for (const match of buttonMatches) {
            const attrs = match[1];
            const idMatch = attrs.match(/\bid=["']([^"']+)["']/i);
            const classMatch = attrs.match(/\bclass=["']([^"']+)["']/i);
            if (!idMatch || !classMatch) continue;

            const idVal = idMatch[1];
            const classAttr = classMatch[1];
            const tokens = classAttr.split(/\s+/);

            if (/^close-[a-z0-9-]+-modal-btn$/.test(idVal)) {
                if (!tokens.includes('modal__close-btn') || tokens.includes('close-button')) {
                    nonCanonicalButtons.push({
                        file: path.relative(projectRoot, filePath),
                        id: idVal,
                        role: 'header-close',
                        classAttr
                    });
                }
            } else if (/^close-[a-z0-9-]+-footer-btn$/.test(idVal)) {
                if (!tokens.includes('btn') || !tokens.includes('btn--secondary') || tokens.includes('close-button')) {
                    nonCanonicalButtons.push({
                        file: path.relative(projectRoot, filePath),
                        id: idVal,
                        role: 'footer-close',
                        classAttr
                    });
                }
            }
        }
    }
    if (nonCanonicalButtons.length > 0) {
        console.error(`[ERROR] Found ${nonCanonicalButtons.length} non-canonical modal button(s):`);
        for (const item of nonCanonicalButtons) {
            console.error(`        ${item.file} (#${item.id}, ${item.role}): class="${item.classAttr}"`);
        }
        hasErrors = true;
    } else {
        console.log('[OK] All modal header and footer close buttons enforce canonical classes.');
    }

    // 8. File Casing Standards
    const VENDOR_ALLOWLIST = new Set(['js/qr-code-styling.js']);
    const nonCamelCaseFiles = [];
    for (const filePath of jsFiles) {
        const relPath = path.relative(projectRoot, filePath);
        if (VENDOR_ALLOWLIST.has(relPath)) continue;
        const basename = path.basename(filePath);
        if (!/^[a-z][a-zA-Z0-9]*\.js$/.test(basename)) {
            nonCamelCaseFiles.push({ file: relPath, basename });
        }
    }
    const nonKebabScssFiles = [];
    for (const filePath of scssFiles) {
        const relPath = path.relative(projectRoot, filePath);
        const basename = path.basename(filePath);
        if (!/^_?[a-z0-9]+(-[a-z0-9]+)*\.scss$/.test(basename)) {
            nonKebabScssFiles.push({ file: relPath, basename });
        }
    }
    const partialHtmlFiles = findFiles('partials', ['.html']);
    const nonKebabPartialFiles = [];
    for (const filePath of partialHtmlFiles) {
        const relPath = path.relative(projectRoot, filePath);
        const basename = path.basename(filePath);
        if (!/^[a-z0-9]+(-[a-z0-9]+)*\.html$/.test(basename)) {
            nonKebabPartialFiles.push({ file: relPath, basename });
        }
    }
    const permanentTestFiles = [
        ...findFiles('tests/core', ['.test.js']),
        ...findFiles('tests/domain', ['.test.js'])
    ];
    const nonCamelCaseTests = [];
    for (const filePath of permanentTestFiles) {
        const relPath = path.relative(projectRoot, filePath);
        const basename = path.basename(filePath);
        if (!/^[a-z][a-zA-Z0-9]*\.test\.js$/.test(basename)) {
            nonCamelCaseTests.push({ file: relPath, basename });
        }
    }

    const allCasingViolations = [
        ...nonCamelCaseFiles,
        ...nonKebabScssFiles,
        ...nonKebabPartialFiles,
        ...nonCamelCaseTests
    ];
    if (allCasingViolations.length > 0) {
        console.error(`[ERROR] Found ${allCasingViolations.length} file casing violation(s):`);
        for (const item of allCasingViolations) {
            console.error(`        ${item.file}: "${item.basename}"`);
        }
        hasErrors = true;
    } else {
        console.log('[OK] 100% of source files, stylesheets, templates, and tests follow casing standards.');
    }

    // 9. Zero colliding filenames across subdirectories in css/ and js/
    const collidingFiles = [];
    for (const { dir, exts, label } of [
        { dir: 'css', exts: ['.scss'], label: 'SCSS' },
        { dir: 'js', exts: ['.js'], label: 'JS' }
    ]) {
        const files = findFiles(dir, exts);
        const byBase = new Map();
        for (const f of files) {
            const base = path.basename(f);
            if (!byBase.has(base)) byBase.set(base, []);
            byBase.get(base).push(path.relative(projectRoot, f));
        }
        for (const [base, paths] of byBase.entries()) {
            if (paths.length > 1) {
                collidingFiles.push({ label, base, paths });
            }
        }
    }
    if (collidingFiles.length > 0) {
        console.error(`[ERROR] Found ${collidingFiles.length} colliding filename(s) in subdirectories:`);
        for (const item of collidingFiles) {
            console.error(`        ${item.label} collision "${item.base}":\n          ${item.paths.join('\n          ')}`);
        }
        hasErrors = true;
    } else {
        console.log('[OK] Zero colliding SCSS and JS filenames across subdirectories in css/ and js/.');
    }

    if (hasErrors) {
        console.error('\n[FAIL] DOM & BEM naming convention checks failed.');
        process.exit(1);
    } else {
        console.log('[SUCCESS] All DOM and BEM naming convention checks passed cleanly.\n');
    }
}

runNamingChecks();
