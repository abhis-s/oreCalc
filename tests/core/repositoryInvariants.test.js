import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

/**
 * Recursively collect file paths matching a filter predicate.
 * @param {string} dir
 * @param {(filePath: string) => boolean} [filter]
 * @returns {string[]}
 */
function scanDir(dir, filter = () => true) {
    if (!fs.existsSync(dir)) return [];
    let results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'cache') {
                continue;
            }
            results = results.concat(scanDir(fullPath, filter));
        } else if (entry.isFile() && filter(fullPath)) {
            results.push(fullPath);
        }
    }
    return results;
}

describe('Repository Invariants & Code Hygiene Compliance', () => {
    const candidateFiles = scanDir(projectRoot, f => {
        const rel = path.relative(projectRoot, f).replace(/\\/g, '/');
        const base = path.basename(f);
        if (base === '.DS_Store' || rel.startsWith('.git/') || rel.startsWith('node_modules/') || rel.startsWith('dist/') || rel.startsWith('scratch/')) {
            return false;
        }
        if (rel === '.env' || rel.endsWith('/.env')) {
            return false;
        }
        return /\.(js|mjs|cjs|ts|scss|css|html|json|yaml|yml|md|txt|editorconfig)$/.test(f) ||
            /^\.[a-zA-Z0-9_-]+/.test(base);
    });

    test('zero emoji characters across all production and test source files', () => {
        const emojiPattern = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}]/u;
        const violations = [];

        const sourceFiles = candidateFiles.filter(f => {
            const rel = path.relative(projectRoot, f).replace(/\\/g, '/');
            if (rel === 'js/data/languagesData.js') return false;
            if (rel.endsWith('.md')) return false;
            if (rel === '404.html' || rel.startsWith('legal/') || rel.startsWith('scratch/')) return false;
            return /\.(js|scss|html)$/.test(f);
        });

        for (const file of sourceFiles) {
            const relPath = path.relative(projectRoot, file);
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');

            lines.forEach((line, idx) => {
                if (emojiPattern.test(line)) {
                    violations.push(`${relPath}:${idx + 1} -> ${line.trim()}`);
                }
            });
        }

        assert.equal(
            violations.length,
            0,
            `Found emoji characters violating repository policy:\n${violations.join('\n')}`
        );
    });

    test('zero lines with trailing whitespace characters across all project files', () => {
        const trailingWhitespaceRegex = /[ \t]+$/;
        const violations = [];

        for (const file of candidateFiles) {
            const relPath = path.relative(projectRoot, file);
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');

            lines.forEach((rawLine, idx) => {
                const line = rawLine.replace(/\r$/, '');
                if (trailingWhitespaceRegex.test(line)) {
                    violations.push(`${relPath}:${idx + 1} -> "${line}"`);
                }
            });
        }

        assert.equal(
            violations.length,
            0,
            `Found lines with trailing whitespace characters:\n${violations.join('\n')}`
        );
    });

    test('zero occurrences of more than 1 consecutive empty or whitespace-only lines across all project files', () => {
        const violations = [];

        for (const file of candidateFiles) {
            const relPath = path.relative(projectRoot, file);
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');

            let consecutiveEmptyCount = 0;

            lines.forEach((rawLine, idx) => {
                const line = rawLine.replace(/\r$/, '');
                if (line.trim() === '') {
                    consecutiveEmptyCount++;
                    if (consecutiveEmptyCount > 1) {
                        violations.push(`${relPath}:${idx + 1} (consecutive empty line #${consecutiveEmptyCount})`);
                    }
                } else {
                    consecutiveEmptyCount = 0;
                }
            });
        }

        assert.equal(
            violations.length,
            0,
            `Found more than 1 consecutive empty or whitespace-only lines:\n${violations.join('\n')}`
        );
    });

    test('every text file ends with exactly one newline character and no trailing empty lines', () => {
        const missingNewline = [];
        const multipleNewlines = [];

        for (const file of candidateFiles) {
            const relPath = path.relative(projectRoot, file).replace(/\\/g, '/');
            const content = fs.readFileSync(file, 'utf8');

            if (content.length === 0) continue;

            if (!content.endsWith('\n')) {
                missingNewline.push(relPath);
            } else if (content.endsWith('\n\n') || content.endsWith('\r\n\r\n')) {
                multipleNewlines.push(relPath);
            }
        }

        assert.equal(
            missingNewline.length,
            0,
            `Found text files missing trailing newline character (\\n) at EOF:\n${missingNewline.join('\n')}`
        );

        assert.equal(
            multipleNewlines.length,
            0,
            `Found text files ending with multiple trailing empty lines at EOF:\n${multipleNewlines.join('\n')}`
        );
    });

    test('all inline script tags inside HTML files have valid JavaScript syntax', async () => {
        const htmlFiles = candidateFiles.filter(f => f.endsWith('.html'));
        const syntaxErrors = [];
        const eslint = new ESLint();

        for (const file of htmlFiles) {
            const relPath = path.relative(projectRoot, file).replace(/\\/g, '/');
            const content = fs.readFileSync(file, 'utf8');
            const scriptRegex = /<script(?:\s+[^>]*?)?>([\s\S]*?)<\/script>/gi;
            let match;
            let scriptIndex = 1;

            while ((match = scriptRegex.exec(content)) !== null) {
                const scriptOpeningTag = match[0].split('>')[0];
                const scriptBody = match[1];

                if (/src\s*=/i.test(scriptOpeningTag)) continue;
                if (/type\s*=\s*['"]application\/(?:ld\+)?json['"]/i.test(scriptOpeningTag)) continue;
                if (!scriptBody.trim()) continue;

                const isModule = /type\s*=\s*['"]module['"]/i.test(scriptOpeningTag);
                const virtualFileName = isModule ? `${relPath}.inline_${scriptIndex}.mjs` : `${relPath}.inline_${scriptIndex}.js`;

                try {
                    const lintResults = await eslint.lintText(scriptBody, { filePath: virtualFileName });
                    if (lintResults && lintResults.length > 0) {
                        const fatalErrors = lintResults[0].messages.filter(m => m.fatal);
                        fatalErrors.forEach(m => {
                            syntaxErrors.push(`${relPath} (inline script #${scriptIndex}, line ${m.line}, col ${m.column}): ${m.message}`);
                        });
                    }
                } catch (err) {
                    syntaxErrors.push(`${relPath} (inline script #${scriptIndex}): ${err.message}`);
                }
                scriptIndex++;
            }
        }

        assert.equal(
            syntaxErrors.length,
            0,
            `Found inline script syntax errors in HTML files:\n${syntaxErrors.join('\n')}`
        );
    });
});
