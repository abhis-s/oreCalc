import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

function scanDir(dir, filter) {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let files = [];
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
            files.push(...scanDir(fullPath, filter));
        } else if (filter(entry.name)) {
            files.push(fullPath);
        }
    }
    return files;
}

describe('CSS Architecture Quality & Style Invariants', () => {

    describe('Milestone 1: Dead SCSS Rules & Obsolete Keyframes', () => {
        const scssFiles = scanDir(path.join(projectRoot, 'css'), f => f.endsWith('.scss'));

        test('ensures obsolete legacy selectors are completely removed', () => {
            const obsoleteSelectors = [
                /\.th-badge-icon\b/,
                /\.status-icon-wrapper\b/,
                /\.compact-icon-wrapper\b/,
                /#welcome-profile-th-badge\b/,
                /\.welcome-stat-icon-img\b/
            ];

            const violations = [];

            for (const file of scssFiles) {
                const content = fs.readFileSync(file, 'utf8');
                const relPath = path.relative(projectRoot, file);
                const lines = content.split('\n');

                lines.forEach((line, idx) => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
                    for (const pattern of obsoleteSelectors) {
                        if (pattern.test(trimmed)) {
                            violations.push(`${relPath}:${idx + 1} -> ${trimmed}`);
                        }
                    }
                });
            }

            assert.equal(
                violations.length,
                0,
                `Found obsolete legacy selectors in SCSS:\n${violations.join('\n')}`
            );
        });

        test('ensures obsolete keyframe animations are removed', () => {
            const obsoleteKeyframes = [
                /@keyframes\s+pulse-once\b/,
                /@keyframes\s+glow-pulse\b/,
                /@keyframes\s+subpanelSlideDown\b/
            ];

            const violations = [];

            for (const file of scssFiles) {
                const content = fs.readFileSync(file, 'utf8');
                const relPath = path.relative(projectRoot, file);
                for (const pattern of obsoleteKeyframes) {
                    if (pattern.test(content)) {
                        violations.push(`${relPath} matches ${pattern}`);
                    }
                }
            }

            assert.equal(
                violations.length,
                0,
                `Found obsolete @keyframes definitions:\n${violations.join('\n')}`
            );
        });
    });

    describe('Milestone 2: Component SCSS Deduplication & Sheet Centralization', () => {
        test('ensures deleted fragmented modal files do not exist', () => {
            const fragmentedFiles = [
                path.join(projectRoot, 'css/components/_stats-modal.scss'),
                path.join(projectRoot, 'css/components/_equipment-modal.scss'),
                path.join(projectRoot, 'css/components/_import-data-modal.scss'),
                path.join(projectRoot, 'css/components/_delete-player-modal.scss')
            ];

            for (const file of fragmentedFiles) {
                assert.equal(
                    fs.existsSync(file),
                    false,
                    `Fragmented modal stylesheet should be deleted and centralized in _player-modal.scss: ${path.relative(projectRoot, file)}`
                );
            }
        });

        test('ensures all SCSS partials in components/ and pages/ are included in main.scss', () => {
            const mainScssPath = path.join(projectRoot, 'css/main.scss');
            assert.equal(fs.existsSync(mainScssPath), true);
            const mainScssContent = fs.readFileSync(mainScssPath, 'utf8');

            const partialDirs = [
                path.join(projectRoot, 'css/components'),
                path.join(projectRoot, 'css/pages')
            ];

            const missingPartials = [];

            for (const dir of partialDirs) {
                const files = fs.readdirSync(dir).filter(f => f.startsWith('_') && f.endsWith('.scss'));
                for (const file of files) {
                    const partialName = file.replace(/^_/, '').replace(/\.scss$/, '');
                    const dirName = path.basename(dir);
                    const useRegex = new RegExp(`@use\\s+['"]${dirName}/${partialName}['"]`);
                    if (!useRegex.test(mainScssContent)) {
                        missingPartials.push(`${dirName}/${file}`);
                    }
                }
            }

            assert.equal(
                missingPartials.length,
                0,
                `SCSS partials not @use'd in css/main.scss:\n${missingPartials.join('\n')}`
            );
        });
    });

    describe('Milestone 3: HTML Static Inline Style Elimination', () => {
        const htmlFiles = [
            path.join(projectRoot, 'index.html'),
            ...scanDir(path.join(projectRoot, 'partials'), f => f.endsWith('.html'))
        ];

        test('verifies that zero static style attributes exist across all HTML partials and index.html', () => {
            const staticStyleViolations = [];

            for (const file of htmlFiles) {
                const content = fs.readFileSync(file, 'utf8');
                const relPath = path.relative(projectRoot, file);
                const lines = content.split('\n');

                lines.forEach((line, idx) => {
                    const match = line.match(/style="([^"]*)"/);
                    if (match) {
                        const styleValue = match[1].trim();
                        const isDynamicDisplayNone = /^display:\s*none;?$/.test(styleValue);
                        const isDynamicWidthZero = /^width:\s*0%?;?$/.test(styleValue);

                        if (!isDynamicDisplayNone && !isDynamicWidthZero) {
                            staticStyleViolations.push(`${relPath}:${idx + 1} -> ${match[0]}`);
                        }
                    }
                });
            }

            assert.equal(
                staticStyleViolations.length,
                0,
                `Found static inline styles that must be extracted to SCSS classes:\n${staticStyleViolations.join('\n')}`
            );
        });
    });

    describe('Milestone 4: Strict Variable Discipline & Design Tokens', () => {
        const scssFiles = scanDir(path.join(projectRoot, 'css'), f => f.endsWith('.scss'));

        test('ensures text variables ($text-*) are not used for background or border properties', () => {
            const violations = [];

            for (const file of scssFiles) {
                if (file.includes('_variables.scss') || file.includes('_palette.scss')) continue;

                const content = fs.readFileSync(file, 'utf8');
                const relPath = path.relative(projectRoot, file);
                const lines = content.split('\n');

                lines.forEach((line, idx) => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) return;

                    if (/(background|background-color|border|border-color|outline|box-shadow)\s*:[^;]*\$text-/.test(trimmed)) {
                        violations.push(`${relPath}:${idx + 1} -> ${trimmed}`);
                    }
                });
            }

            assert.equal(
                violations.length,
                0,
                `Variable discipline violations ($text-* used for bg/border):\n${violations.join('\n')}`
            );
        });

        test('ensures border variables ($border-*) are not used for text color or background properties', () => {
            const violations = [];

            for (const file of scssFiles) {
                if (file.includes('_variables.scss') || file.includes('_palette.scss')) continue;

                const content = fs.readFileSync(file, 'utf8');
                const relPath = path.relative(projectRoot, file);
                const lines = content.split('\n');

                lines.forEach((line, idx) => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) return;

                    if (/(?<!border-|outline-)color\s*:[^;]*\$border-/.test(trimmed) ||
                        /background\s*:[^;]*\$border-/.test(trimmed) ||
                        /background-color\s*:[^;]*\$border-/.test(trimmed)) {
                        violations.push(`${relPath}:${idx + 1} -> ${trimmed}`);
                    }
                });
            }

            assert.equal(
                violations.length,
                0,
                `Variable discipline violations ($border-* used for color/bg):\n${violations.join('\n')}`
            );
        });

        test('ensures background variables ($bg-*) are not used for text color or borders', () => {
            const violations = [];

            for (const file of scssFiles) {
                if (file.includes('_variables.scss') || file.includes('_palette.scss')) continue;

                const content = fs.readFileSync(file, 'utf8');
                const relPath = path.relative(projectRoot, file);
                const lines = content.split('\n');

                lines.forEach((line, idx) => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) return;

                    if (/(?<!background-)color\s*:[^;]*\$bg-(?!app)/.test(trimmed) ||
                        /border\s*:[^;]*\$bg-/.test(trimmed) ||
                        /border-color\s*:[^;]*\$bg-/.test(trimmed)) {
                        violations.push(`${relPath}:${idx + 1} -> ${trimmed}`);
                    }
                });
            }

            assert.equal(
                violations.length,
                0,
                `Variable discipline violations ($bg-* used for color/border):\n${violations.join('\n')}`
            );
        });
    });

    describe('Strict Zero-Emoji Policy Compliance', () => {
        const candidateFiles = [
            ...scanDir(path.join(projectRoot, 'css'), f => f.endsWith('.scss')),
            ...scanDir(path.join(projectRoot, 'partials'), f => f.endsWith('.html')),
            ...scanDir(path.join(projectRoot, 'js'), f => f.endsWith('.js')),
            ...scanDir(path.join(projectRoot, 'scripts'), f => f.endsWith('.js')),
            ...scanDir(path.join(projectRoot, 'tests'), f => f.endsWith('.js')),
            path.join(projectRoot, 'index.html')
        ];

        test('verifies that zero emoji characters exist in source, template, and test files', () => {
            const emojiPattern = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}]/u;
            const emojiViolations = [];

            for (const file of candidateFiles) {
                const relPath = path.relative(projectRoot, file);
                if (relPath === 'js/data/languagesData.js') continue; // Country flags in language picker metadata
                const content = fs.readFileSync(file, 'utf8');
                const lines = content.split('\n');

                lines.forEach((line, idx) => {
                    if (emojiPattern.test(line)) {
                        emojiViolations.push(`${relPath}:${idx + 1} -> ${line.trim()}`);
                    }
                });
            }

            assert.equal(
                emojiViolations.length,
                0,
                `Found emoji characters violating repository policy:\n${emojiViolations.join('\n')}`
            );
        });
    });

    describe('Milestone 6: Responsive Breakpoint Token Centralization', () => {
        const scssFiles = scanDir(path.join(projectRoot, 'css'), f => f.endsWith('.scss'));

        test('ensures all 4 standard responsive breakpoint tokens are defined in _variables.scss', () => {
            const varPath = path.join(projectRoot, 'css/abstracts/_variables.scss');
            const varContent = fs.readFileSync(varPath, 'utf8');

            assert.match(varContent, /\$breakpoint-compact:\s*425px;/, '_variables.scss must define $breakpoint-compact: 425px');
            assert.match(varContent, /\$breakpoint-phone:\s*480px;/, '_variables.scss must define $breakpoint-phone: 480px');
            assert.match(varContent, /\$breakpoint-modal:\s*625px;/, '_variables.scss must define $breakpoint-modal: 625px');
            assert.match(varContent, /\$breakpoint-desktop:\s*780px;/, '_variables.scss must define $breakpoint-desktop: 780px');
        });

        test('ensures no ad-hoc raw pixel media queries remain in component and layout stylesheets', () => {
            // Legacy raw pixel breakpoint blacklist
            const legacyBreakpointRegex = /@media[^{]*\b(380px|399px|400px|420px|425px|426px|560px|576px|580px|599px|600px|601px|650px|779px|780px)\b/;
            const violations = [];

            for (const file of scssFiles) {
                if (file.includes('_variables.scss')) continue;
                const content = fs.readFileSync(file, 'utf8');
                const relPath = path.relative(projectRoot, file);
                const lines = content.split('\n');

                lines.forEach((line, idx) => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
                    if (legacyBreakpointRegex.test(trimmed)) {
                        violations.push(`${relPath}:${idx + 1} -> ${trimmed}`);
                    }
                });
            }

            assert.equal(
                violations.length,
                0,
                `Found uncentralized ad-hoc breakpoint values in media queries:\n${violations.join('\n')}`
            );
        });
    });
});
