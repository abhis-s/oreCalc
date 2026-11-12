import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

describe('Native HTMLDialogElement Overlay Architecture', () => {
    describe('HTML Partial Templates Verification', () => {
        test('All modal partial templates in partials/modals/*.html use <dialog> elements', () => {
            const modalsDir = path.join(projectRoot, 'partials/modals');
            const modalFiles = fs.readdirSync(modalsDir).filter(file => file.endsWith('.html'));

            assert.ok(modalFiles.length >= 20, `Must find at least 20 modal template files in ${modalsDir}`);

            for (const file of modalFiles) {
                const filePath = path.join(modalsDir, file);
                const content = fs.readFileSync(filePath, 'utf8').trim();

                assert.match(
                    content,
                    /^<dialog\s+id="[^"]+"\s+class="modal/m,
                    `Modal file partials/modals/${file} must declare <dialog id="..." class="modal"> as root tag`
                );
                assert.match(
                    content,
                    /<\/dialog>\s*$/,
                    `Modal file partials/modals/${file} must close with </dialog>`
                );
            }
        });

        test('Navigation drawer partial uses <dialog id="navigation-drawer" class="navigation-drawer">', () => {
            const drawerPath = path.join(projectRoot, 'partials/navigation-drawer.html');
            const content = fs.readFileSync(drawerPath, 'utf8').trim();

            assert.match(
                content,
                /<dialog\s+id="navigation-drawer"\s+class="navigation-drawer"/m,
                'Navigation drawer partial must use <dialog id="navigation-drawer" class="navigation-drawer">'
            );
            assert.match(
                content,
                /<\/dialog>\s*$/,
                'Navigation drawer partial must close with </dialog>'
            );
        });

        test('Zero orphaned .modal-backdrop tags exist in partials', () => {
            const partialsDir = path.join(projectRoot, 'partials');
            const allHtmlFiles = [];

            const scanDir = (dir) => {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const full = path.join(dir, entry.name);
                    if (entry.isDirectory()) scanDir(full);
                    else if (entry.name.endsWith('.html')) allHtmlFiles.push(full);
                }
            };
            scanDir(partialsDir);

            for (const file of allHtmlFiles) {
                const content = fs.readFileSync(file, 'utf8');
                assert.doesNotMatch(
                    content,
                    /<div\s+class="[^"]*modal-backdrop[^"]*"/,
                    `Orphaned modal-backdrop found in ${path.relative(projectRoot, file)}`
                );
            }
        });
    });

    describe('Native HTML Popover & Accessible Tooltip Runtime Attributes', () => {
        test('showCardHelpPopover configures popover="auto", role="tooltip", and aria-describedby on target', async () => {
            const { showCardHelpPopover, hideCardHelpPopover } = await import('../../js/utils/cardHelpPopover.js');
            const prevDoc = globalThis.document;
            const prevWin = globalThis.window;

            const attrs = new Map();
            const targetAttrs = new Map();
            const createdPopover = {
                id: '',
                className: '',
                innerHTML: '',
                style: {},
                dataset: {},
                classList: {
                    add() {},
                    remove() {},
                    contains() { return false; }
                },
                setAttribute(k, v) { attrs.set(k, v); },
                getAttribute(k) { return attrs.get(k) ?? null; },
                hasAttribute(k) { return attrs.has(k); },
                addEventListener() {},
                getBoundingClientRect() {
                    return { top: 0, left: 0, width: 100, height: 40, bottom: 40, right: 100 };
                }
            };

            const targetEl = {
                setAttribute(k, v) { targetAttrs.set(k, v); },
                getAttribute(k) { return targetAttrs.get(k) ?? null; },
                removeAttribute(k) { targetAttrs.delete(k); },
                contains() { return false; },
                getBoundingClientRect() {
                    return { top: 50, left: 50, width: 24, height: 24, bottom: 74, right: 74 };
                }
            };

            globalThis.window = /** @type {any} */ ({
                innerWidth: 1024,
                innerHeight: 768
            });
            globalThis.document = /** @type {any} */ ({
                body: {
                    appendChild() {}
                },
                getElementById(id) {
                    return id === 'card-help-popover' ? createdPopover : null;
                },
                createElement() {
                    return createdPopover;
                },
                addEventListener() {}
            });

            try {
                showCardHelpPopover(/** @type {any} */ (targetEl), 'Helpful tooltip text');
                assert.equal(createdPopover.getAttribute('popover'), 'auto');
                assert.equal(createdPopover.getAttribute('role'), 'tooltip');
                assert.equal(targetEl.getAttribute('aria-describedby'), 'card-help-popover');

                hideCardHelpPopover();
                assert.equal(targetEl.getAttribute('aria-describedby'), null);
            } finally {
                globalThis.document = prevDoc;
                globalThis.window = prevWin;
            }
        });
    });

    describe('Accessibility Landmark Architecture', () => {
        test('All primary tool HTML templates define canonical main-content ID on <main>', () => {
            const toolTemplates = [
                'index.html',
                'ore-calculator/index.html',
                'hero-journey/index.html',
                'damage-calculator/index.html',
                'account/index.html',
                'app-management/index.html'
            ];

            for (const relPath of toolTemplates) {
                const fullPath = path.join(projectRoot, relPath);
                assert.equal(fs.existsSync(fullPath), true, `${relPath} must exist in source tree`);
                const html = fs.readFileSync(fullPath, 'utf8');
                assert.ok(
                    html.includes('id="main-content"'),
                    `${relPath} must define id="main-content" on its <main> element`
                );
            }
        });
    });

    describe('Favicon & App Icon Root-Absolute Path Invariants', () => {
        test('All HTML templates declare root-absolute href="/assets/..." for favicons and touch icons', () => {
            const htmlFiles = [
                'index.html',
                'ore-calculator/index.html',
                'hero-journey/index.html',
                'damage-calculator/index.html',
                'account/index.html',
                'app-management/index.html',
                '404.html',
                'legal/privacy-en.html',
                'legal/privacy-de.html',
                'legal/terms-en.html',
                'legal/terms-de.html',
                'legal/licenses.html'
            ];

            for (const relPath of htmlFiles) {
                const fullPath = path.join(projectRoot, relPath);
                assert.ok(fs.existsSync(fullPath), `${relPath} must exist in source tree`);
                const html = fs.readFileSync(fullPath, 'utf8');

                const iconLinks = html.match(/<link\s+[^>]*rel=["'](?:icon|apple-touch-icon|shortcut icon)["'][^>]*>/gi) ||
                    html.match(/<link\s+[^>]*type=["']image\/(?:x-icon|png)["'][^>]*>/gi) || [];
                assert.ok(iconLinks.length > 0, `${relPath} must define at least one favicon or touch icon link`);

                for (const linkTag of iconLinks) {
                    const hrefMatch = linkTag.match(/href=["']([^"']+)["']/i);
                    assert.ok(hrefMatch, `Icon link tag in ${relPath} must have an href: ${linkTag}`);
                    const hrefVal = hrefMatch[1];
                    assert.ok(
                        hrefVal.startsWith('/assets/'),
                        `${relPath} icon link href "${hrefVal}" must start with root-absolute "/assets/" to prevent 404s on sub-routes`
                    );
                    assert.ok(
                        fs.existsSync(path.join(projectRoot, hrefVal)),
                        `${relPath} referenced icon "${hrefVal}" must physically exist on disk in assets/`
                    );
                }

                const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
                if (ogImageMatch) {
                    const ogUrl = ogImageMatch[1];
                    const assetRel = ogUrl.replace(/^https:\/\/clashcalc\.com/, '');
                    assert.ok(
                        fs.existsSync(path.join(projectRoot, assetRel)),
                        `${relPath} referenced og:image "${ogUrl}" must physically exist on disk in assets/`
                    );
                }
            }
        });

        test('Zero manual modulepreload tags exist in source HTML files', () => {
            const entryPoints = [
                'index.html',
                'ore-calculator/index.html',
                'hero-journey/index.html',
                'damage-calculator/index.html',
                'account/index.html',
                'app-management/index.html'
            ];
            for (const relPath of entryPoints) {
                const fullPath = path.join(projectRoot, relPath);
                const html = fs.readFileSync(fullPath, 'utf8');
                assert.doesNotMatch(html, /<link\s+rel=["']modulepreload["']/i, `${relPath} must not contain manual modulepreload tags`);
            }
        });

        test('Zero <base href> tags exist in tool HTML files', () => {
            const entryPoints = [
                'index.html',
                'ore-calculator/index.html',
                'hero-journey/index.html',
                'damage-calculator/index.html',
                'account/index.html',
                'app-management/index.html'
            ];
            for (const relPath of entryPoints) {
                const fullPath = path.join(projectRoot, relPath);
                const html = fs.readFileSync(fullPath, 'utf8');
                assert.doesNotMatch(html, /<base\s+href=/i, `${relPath} must not contain <base href> tags`);
            }
        });

        test('All tool entry points declare a modular header partial and header placeholder', () => {
            const expectedHeaders = {
                'index.html': 'partials/header-landing.html',
                'ore-calculator/index.html': 'partials/header.html',
                'hero-journey/index.html': 'partials/header-hero-journey.html',
                'damage-calculator/index.html': 'partials/header-damage-calculator.html',
                'account/index.html': 'partials/header-account-page.html',
                'app-management/index.html': 'partials/header-app-management.html'
            };

            for (const [entryRel, headerRel] of Object.entries(expectedHeaders)) {
                const entryHtml = fs.readFileSync(path.join(projectRoot, entryRel), 'utf8');
                assert.ok(
                    entryHtml.includes(`<!-- include: ${headerRel} -->`),
                    `${entryRel} must include dedicated header partial: <!-- include: ${headerRel} -->`
                );
                assert.ok(
                    entryHtml.includes('class="app-header-placeholder"'),
                    `${entryRel} must define .app-header-placeholder directly after header`
                );

                const headerHtml = fs.readFileSync(path.join(projectRoot, headerRel), 'utf8');
                assert.ok(
                    headerHtml.includes('<!-- include: partials/header-actions.html -->'),
                    `${headerRel} must include canonical actions partial: <!-- include: partials/header-actions.html -->`
                );
            }
        });

        test('Zero relative src="assets/ paths exist across all HTML templates, partials, and legal pages', () => {
            const scanHtmlFiles = (dir) => {
                let results = [];
                for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                    const full = path.join(dir, entry.name);
                    if (entry.isDirectory() && !['node_modules', 'dist', '.git', '.gemini', 'scratch'].includes(entry.name)) {
                        results.push(...scanHtmlFiles(full));
                    } else if (entry.name.endsWith('.html')) {
                        results.push(full);
                    }
                }
                return results;
            };

            const allHtmlFiles = scanHtmlFiles(projectRoot);
            assert.ok(allHtmlFiles.length >= 35, `Expected at least 35 HTML files in project, found ${allHtmlFiles.length}`);

            const violations = [];
            for (const file of allHtmlFiles) {
                const rel = path.relative(projectRoot, file).replace(/\\/g, '/');
                const content = fs.readFileSync(file, 'utf8');
                const matches = content.match(/src=["']assets\//gi);
                if (matches) {
                    violations.push(`${rel} contains ${matches.length} relative src="assets/..." occurrences`);
                }
            }

            assert.equal(
                violations.length,
                0,
                `Found relative src="assets/..." paths (must be root-absolute src="/assets/..."): \n${violations.join('\n')}`
            );
        });

        test('All static asset paths in JavaScript modules physically exist on disk', () => {
            const scanJsFiles = (dir) => {
                let results = [];
                for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                    const full = path.join(dir, entry.name);
                    if (entry.isDirectory() && !['node_modules', 'dist', '.git', '.gemini', 'scratch'].includes(entry.name)) {
                        results.push(...scanJsFiles(full));
                    } else if (entry.name.endsWith('.js')) {
                        results.push(full);
                    }
                }
                return results;
            };

            const jsFiles = scanJsFiles(path.join(projectRoot, 'js'));
            const missing = [];

            for (const file of jsFiles) {
                const rel = path.relative(projectRoot, file).replace(/\\/g, '/');
                const content = fs.readFileSync(file, 'utf8');
                const matches = content.matchAll(/["']([^"']*assets\/[^"']*\.(?:png|webp|avif|svg|ico))["']/g);
                for (const m of matches) {
                    const raw = m[1];
                    if (raw.includes('${') || raw.includes('http')) continue;
                    const clean = raw.startsWith('/') ? raw.slice(1) : raw;
                    const assetPath = clean.split('?')[0].split('#')[0];
                    if (!fs.existsSync(path.join(projectRoot, assetPath))) {
                        missing.push(`${rel}: "${raw}" -> ${assetPath} not found`);
                    }
                }
            }

            assert.equal(
                missing.length,
                0,
                `Found JavaScript modules referencing non-existent static assets:\n${missing.join('\n')}`
            );
        });

        test('Legal pages and 404 define canonical apple-touch-icon and standardized twitter:card', () => {
            const legalPages = [
                'legal/privacy-en.html',
                'legal/privacy-de.html',
                'legal/terms-en.html',
                'legal/terms-de.html',
                'legal/licenses.html',
                '404.html'
            ];

            for (const rel of legalPages) {
                const html = fs.readFileSync(path.join(projectRoot, rel), 'utf8');
                assert.ok(
                    html.includes('<link rel="apple-touch-icon" href="/assets/app_icon_large.png">'),
                    `${rel} must declare canonical apple-touch-icon`
                );

                if (rel.startsWith('legal/')) {
                    assert.ok(
                        html.includes('<meta name="twitter:card" content="summary">'),
                        `${rel} must declare standard name="twitter:card"`
                    );
                    assert.doesNotMatch(
                        html,
                        /<meta\s+property=["']twitter:/i,
                        `${rel} must not declare non-standard property="twitter:*"`
                    );
                }
            }
        });

        test('PWA manifest shortcuts enforce canonical names and 512x512 icons', () => {
            const manifestPath = path.join(projectRoot, 'manifest.json');
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

            assert.ok(Array.isArray(manifest.shortcuts), 'manifest.json must declare shortcuts array');
            assert.equal(manifest.shortcuts.length, 4, 'Expected exactly 4 primary tool shortcuts');

            const damageCalcShortcut = manifest.shortcuts.find(s => s.url === '/damage-calculator/');
            assert.ok(damageCalcShortcut, 'DamageCalc shortcut must exist');
            assert.equal(damageCalcShortcut.short_name, 'DamageCalc');
            assert.equal(damageCalcShortcut.name, 'DamageCalc');

            const heroJourneyShortcut = manifest.shortcuts.find(s => s.url === '/hero-journey/');
            assert.ok(heroJourneyShortcut, 'Hero\'s Journey shortcut must exist');
            assert.equal(heroJourneyShortcut.short_name, 'Journey');

            for (const shortcut of manifest.shortcuts) {
                assert.ok(Array.isArray(shortcut.icons) && shortcut.icons.length > 0, `${shortcut.name} must declare icons`);
                const icon512 = shortcut.icons.find(i => i.sizes === '512x512');
                assert.ok(icon512, `${shortcut.name} shortcut must provide a 512x512 icon for Android WebAPK compatibility`);

                const fullPath = path.join(projectRoot, icon512.src);
                assert.ok(fs.existsSync(fullPath), `Shortcut icon ${icon512.src} must physically exist on disk`);
            }
        });
    });
});
