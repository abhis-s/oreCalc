import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('SVG Sprite Sheet Integrity & Symbol Completeness Suite', () => {
    const projectRoot = process.cwd();
    const spritePath = path.join(projectRoot, 'partials/svg-sprites.html');

    test('statically asserts every SVG icon name referenced across codebase is defined in sprite sheet', () => {
        assert.ok(fs.existsSync(spritePath), 'partials/svg-sprites.html must exist');
        const spriteContent = fs.readFileSync(spritePath, 'utf8');
        const definedSymbols = new Set(
            [...spriteContent.matchAll(/id="icon-([a-zA-Z0-9_-]+)"/g)].map(m => m[1])
        );

        assert.ok(definedSymbols.size > 50, 'Sprite sheet should contain at least 50 registered symbols');

        const scanDirs = ['js', 'partials', 'legal'];
        const rootFiles = ['index.html', 'hero-journey.html', '404.html'];
        const referencedIcons = new Map();

        function scanFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf8');
            const relPath = path.relative(projectRoot, filePath);

            function recordIcon(iconName) {
                if (!iconName) return;
                if (!referencedIcons.has(iconName)) {
                    referencedIcons.set(iconName, []);
                }
                referencedIcons.get(iconName).push(relPath);
            }

            // 1. Match static <orecalc-assets-svg name="icon-name">
            for (const match of content.matchAll(/<orecalc-assets-svg[^>]+name=['"]([a-zA-Z0-9_-]+)['"]/g)) {
                recordIcon(match[1]);
            }

            // 2. Match getSVG('icon-name', ...)
            for (const match of content.matchAll(/getSVG\(\s*['"]([a-zA-Z0-9_-]+)['"]/g)) {
                recordIcon(match[1]);
            }

            // 3. Match dynamic template ternaries: name="${cond ? 'icon1' : 'icon2'}"
            for (const match of content.matchAll(/name=['"]\$\{[^}]*?\?\s*['"]([a-zA-Z0-9_-]+)['"]\s*:\s*['"]([a-zA-Z0-9_-]+)['"]/g)) {
                recordIcon(match[1]);
                recordIcon(match[2]);
            }

            // 4. Match static setAttribute('name', 'icon-name')
            for (const match of content.matchAll(/setAttribute\(\s*['"]name['"]\s*,\s*['"]([a-zA-Z0-9_-]+)['"]\)/g)) {
                recordIcon(match[1]);
            }

            // 5. Match dynamic setAttribute ternaries: setAttribute('name', cond ? 'icon1' : 'icon2')
            for (const match of content.matchAll(/setAttribute\(\s*['"]name['"]\s*,\s*[^,\n]+\?\s*['"]([a-zA-Z0-9_-]+)['"]\s*:\s*['"]([a-zA-Z0-9_-]+)['"]\)/g)) {
                recordIcon(match[1]);
                recordIcon(match[2]);
            }

            // 6. Match #icon-name references (e.g. navigation registry or <use href="#icon-...">)
            for (const match of content.matchAll(/#icon-([a-zA-Z0-9_-]+)/g)) {
                recordIcon(match[1]);
            }

            // 7. Match ternaries assigned to icon variables: const iconName = cond ? 'icon1' : 'icon2'
            for (const match of content.matchAll(/(?:let|const|var)\s+[a-zA-Z0-9_]*[iI]con[a-zA-Z0-9_]*\s*=\s*[^;\n]+\?\s*['"]([a-zA-Z0-9_-]+)['"]\s*:\s*['"]([a-zA-Z0-9_-]+)['"]/g)) {
                recordIcon(match[1]);
                recordIcon(match[2]);
            }
        }

        function scanDirectory(dir) {
            const fullDir = path.join(projectRoot, dir);
            if (!fs.existsSync(fullDir)) return;

            const entries = fs.readdirSync(fullDir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(fullDir, entry.name);
                if (entry.isDirectory()) {
                    if (['node_modules', 'dist', 'scratch', '.git', 'temp'].includes(entry.name)) continue;
                    scanDirectory(path.relative(projectRoot, fullPath));
                } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.html'))) {
                    scanFile(fullPath);
                }
            }
        }

        for (const file of rootFiles) {
            const fullPath = path.join(projectRoot, file);
            if (fs.existsSync(fullPath)) {
                scanFile(fullPath);
            }
        }

        for (const dir of scanDirs) {
            scanDirectory(dir);
        }

        const missingIcons = [];
        for (const [iconName, locations] of referencedIcons.entries()) {
            if (!definedSymbols.has(iconName)) {
                missingIcons.push({ iconName, locations });
            }
        }

        assert.strictEqual(
            missingIcons.length,
            0,
            `Missing SVG symbols in partials/svg-sprites.html:\n${JSON.stringify(missingIcons, null, 2)}`
        );
    });
});
