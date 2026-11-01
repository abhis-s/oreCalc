import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

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

describe('DOM Identifier & Semantic Control Suffix Invariants', () => {
    test('every DOM element id across all production HTML templates is lowercase kebab-case', () => {
        const htmlFiles = getProductionHtmlFiles();
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

        assert.deepEqual(
            nonKebabIds,
            [],
            `Found ${nonKebabIds.length} non-kebab DOM ID(s) across production HTML templates:\n` +
            nonKebabIds.map(item => `  - ${item.file}: id="${item.id}"`).join('\n')
        );
    });

    test('zero checkbox inputs use prohibited -toggle, -btn, or -button id suffixes', () => {
        const htmlFiles = getProductionHtmlFiles();
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
                        nonCompliantCheckboxes.push({
                            file: path.relative(projectRoot, filePath),
                            id: idVal
                        });
                    }
                }
            }
        }

        assert.deepEqual(
            nonCompliantCheckboxes,
            [],
            `Found ${nonCompliantCheckboxes.length} checkbox input(s) with prohibited -toggle/-btn suffix:\n` +
            nonCompliantCheckboxes.map(item => `  - ${item.file}: id="${item.id}"`).join('\n')
        );
    });

    test('all feature toggle switches strictly enforce semantic -switch id suffix', () => {
        const htmlFiles = getProductionHtmlFiles();
        const detectedSwitches = [];

        for (const filePath of htmlFiles) {
            const content = fs.readFileSync(filePath, 'utf8');
            const switchMatches = content.matchAll(/\bid=["']([^"']*-switch)["']/gi);
            for (const match of switchMatches) {
                detectedSwitches.push({
                    file: path.relative(projectRoot, filePath),
                    id: match[1]
                });
            }
        }

        // Verify that canonical UI feature switches are detected and enforce -switch
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

        const detectedIds = new Set(detectedSwitches.map(s => s.id));
        const missingSwitches = expectedSwitchIds.filter(id => !detectedIds.has(id));

        assert.deepEqual(
            missingSwitches,
            [],
            `Missing expected canonical UI -switch identifiers: ${missingSwitches.join(', ')}`
        );
    });
});

describe('BEM Class Architecture & Dual-Class Invariants', () => {
    test('zero double-element chains (__.*__) across HTML templates and SCSS stylesheets', () => {
        const htmlFiles = getProductionHtmlFiles();
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

        assert.deepEqual(
            doubleElementViolations,
            [],
            `Found ${doubleElementViolations.length} double-element BEM violation(s):\n` +
            doubleElementViolations.map(item => `  - ${item.file}: .${item.token}`).join('\n')
        );
    });

    test('zero duplicate class tokens within individual class attributes in HTML templates', () => {
        const htmlFiles = getProductionHtmlFiles();
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

        assert.deepEqual(
            duplicates,
            [],
            `Found ${duplicates.length} duplicate class token(s) within single class attributes:\n` +
            duplicates.map(item => `  - ${item.file}: "${item.attribute}" (duplicate: ${item.duplicateToken})`).join('\n')
        );
    });

    test('zero legacy action button classes in production HTML templates and JS components', () => {
        const htmlFiles = getProductionHtmlFiles();
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

        // JS files: exclude fallback selectors in modalFocusManager.js
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

        assert.deepEqual(
            legacyMatches,
            [],
            `Found ${legacyMatches.length} legacy button/action class reference(s):\n` +
            legacyMatches.map(item => `  - ${item.file}: ${item.legacyClass}`).join('\n')
        );
    });

    test('modal close buttons strictly use canonical modal__close-btn and footer action buttons use btn--secondary', () => {
        const modalFiles = findFiles('partials/modals', ['.html']);
        const nonCanonicalHeaderClose = [];
        const nonCanonicalFooterClose = [];

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
                        nonCanonicalHeaderClose.push({
                            file: path.relative(projectRoot, filePath),
                            id: idVal,
                            classAttr
                        });
                    }
                } else if (/^close-[a-z0-9-]+-footer-btn$/.test(idVal)) {
                    if (!tokens.includes('btn') || !tokens.includes('btn--secondary') || tokens.includes('close-button')) {
                        nonCanonicalFooterClose.push({
                            file: path.relative(projectRoot, filePath),
                            id: idVal,
                            classAttr
                        });
                    }
                }
            }
        }

        assert.deepEqual(
            nonCanonicalHeaderClose,
            [],
            `Found ${nonCanonicalHeaderClose.length} non-canonical modal header close button(s):\n` +
            nonCanonicalHeaderClose.map(item => `  - ${item.file} (#${item.id}): class="${item.classAttr}"`).join('\n')
        );

        assert.deepEqual(
            nonCanonicalFooterClose,
            [],
            `Found ${nonCanonicalFooterClose.length} non-canonical modal footer close button(s):\n` +
            nonCanonicalFooterClose.map(item => `  - ${item.file} (#${item.id}): class="${item.classAttr}"`).join('\n')
        );
    });
});

describe('File Casing & Extension Standards', () => {
    test('100% of internal JavaScript source modules in js/ follow camelCase.js', () => {
        const jsFiles = findFiles('js', ['.js']);
        const VENDOR_ALLOWLIST = new Set([
            'js/qr-code-styling.js'
        ]);

        const nonCamelCaseFiles = [];
        for (const filePath of jsFiles) {
            const relPath = path.relative(projectRoot, filePath);
            if (VENDOR_ALLOWLIST.has(relPath)) continue;
            const baseName = path.basename(filePath, '.js');
            if (!/^[a-z][a-zA-Z0-9]*$/.test(baseName)) {
                nonCamelCaseFiles.push(relPath);
            }
        }

        assert.deepEqual(
            nonCamelCaseFiles,
            [],
            `Found ${nonCamelCaseFiles.length} non-camelCase JS module(s):\n` +
            nonCamelCaseFiles.map(f => `  - ${f}`).join('\n')
        );
    });

    test('100% of Sass stylesheets in css/ follow _kebab-case.scss or kebab-case.scss', () => {
        const scssFiles = findFiles('css', ['.scss']);
        const nonKebabScss = [];

        for (const filePath of scssFiles) {
            const baseName = path.basename(filePath);
            if (!/^(_[a-z0-9-]+|[a-z0-9-]+)\.scss$/.test(baseName)) {
                nonKebabScss.push(path.relative(projectRoot, filePath));
            }
        }

        assert.deepEqual(
            nonKebabScss,
            [],
            `Found ${nonKebabScss.length} non-kebab SCSS file(s):\n` +
            nonKebabScss.map(f => `  - ${f}`).join('\n')
        );
    });

    test('100% of HTML partials in partials/ follow kebab-case.html', () => {
        const htmlPartials = findFiles('partials', ['.html']);
        const nonKebabPartials = [];

        for (const filePath of htmlPartials) {
            const baseName = path.basename(filePath);
            if (!/^[a-z0-9-]+\.html$/.test(baseName)) {
                nonKebabPartials.push(path.relative(projectRoot, filePath));
            }
        }

        assert.deepEqual(
            nonKebabPartials,
            [],
            `Found ${nonKebabPartials.length} non-kebab HTML partial(s):\n` +
            nonKebabPartials.map(f => `  - ${f}`).join('\n')
        );
    });

    test('100% of permanent test suites in tests/core/ and tests/domain/ follow camelCase.test.js', () => {
        const coreTests = findFiles('tests/core', ['.test.js']);
        const domainTests = findFiles('tests/domain', ['.test.js']);
        const allPermanentTests = [...coreTests, ...domainTests];

        const nonCamelCaseTests = [];
        for (const filePath of allPermanentTests) {
            const baseName = path.basename(filePath, '.test.js');
            if (!/^[a-z][a-zA-Z0-9]*$/.test(baseName)) {
                nonCamelCaseTests.push(path.relative(projectRoot, filePath));
            }
        }

        assert.deepEqual(
            nonCamelCaseTests,
            [],
            `Found ${nonCamelCaseTests.length} non-camelCase test file(s):\n` +
            nonCamelCaseTests.map(f => `  - ${f}`).join('\n')
        );
    });

    test('zero duplicate SCSS basenames exist across subdirectories in css/', () => {
        const scssFiles = findFiles('css', ['.scss']);
        const byBase = new Map();
        for (const filePath of scssFiles) {
            const baseName = path.basename(filePath);
            if (!byBase.has(baseName)) byBase.set(baseName, []);
            byBase.get(baseName).push(path.relative(projectRoot, filePath));
        }

        const collisions = [];
        for (const [baseName, paths] of byBase.entries()) {
            if (paths.length > 1) {
                collisions.push(`${baseName} (${paths.join(', ')})`);
            }
        }

        assert.deepEqual(
            collisions,
            [],
            `Found ${collisions.length} colliding SCSS filename(s):\n` +
            collisions.map(c => `  - ${c}`).join('\n')
        );
    });

    test('zero duplicate JavaScript basenames exist across subdirectories in js/', () => {
        const jsFiles = findFiles('js', ['.js']);
        const byBase = new Map();
        for (const filePath of jsFiles) {
            const baseName = path.basename(filePath);
            if (!byBase.has(baseName)) byBase.set(baseName, []);
            byBase.get(baseName).push(path.relative(projectRoot, filePath));
        }

        const collisions = [];
        for (const [baseName, paths] of byBase.entries()) {
            if (paths.length > 1) {
                collisions.push(`${baseName} (${paths.join(', ')})`);
            }
        }

        assert.deepEqual(
            collisions,
            [],
            `Found ${collisions.length} colliding JavaScript filename(s):\n` +
            collisions.map(c => `  - ${c}`).join('\n')
        );
    });
});
