const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

/**
 * Recursively find all files matching given extensions.
 *
 * @param {string} dir - Directory to scan.
 * @param {string[]} [exts=['.js', '.mjs', '.html']] - File extensions to include.
 * @returns {string[]} Absolute file paths.
 */
function findFiles(dir, exts = ['.js', '.mjs', '.html']) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git' || entry.name === '.gemini') {
            continue;
        }
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results = results.concat(findFiles(fullPath, exts));
        } else if (entry.isFile()) {
            if (exts.some(ext => entry.name.endsWith(ext))) {
                results.push(fullPath);
            }
        }
    }
    return results;
}

/**
 * Strips comments from code string while preserving line breaks.
 *
 * @param {string} code - Source code string.
 * @returns {string} Stripped code string.
 */
function stripComments(code) {
    if (!code) return '';
    return code
        .replace(/\/\*[\s\S]*?\*\//g, match => '\n'.repeat(match.split('\n').length - 1))
        .replace(/\/\/.*$/gm, '');
}

/**
 * Extracts line number from string offset (1-indexed).
 *
 * @param {string} content - Full text.
 * @param {number} index - Character offset.
 * @returns {number} 1-based line number.
 */
function getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
}

/**
 * Parses variable identifiers from a declaration clause.
 *
 * @param {string} declText - Code following 'export const/let/var '.
 * @returns {string[]} List of declared identifier names.
 */
function extractDeclaredVariables(declText) {
    const names = [];
    let i = 0;
    let inParen = 0, inBrace = 0, inBracket = 0;
    let currentId = '';
    let readingId = true;

    while (i < declText.length) {
        const ch = declText[i];
        if (ch === '(') inParen++;
        else if (ch === ')') inParen--;
        else if (ch === '{') inBrace++;
        else if (ch === '}') inBrace--;
        else if (ch === '[') inBracket++;
        else if (ch === ']') inBracket--;

        if (inParen === 0 && inBrace === 0 && inBracket === 0) {
            if (ch === '=') {
                if (currentId.trim()) {
                    names.push(currentId.trim());
                    currentId = '';
                }
                readingId = false;
            } else if (ch === ',') {
                if (readingId && currentId.trim()) {
                    names.push(currentId.trim());
                }
                currentId = '';
                readingId = true;
            } else if (ch === ';') {
                if (readingId && currentId.trim()) {
                    names.push(currentId.trim());
                }
                break;
            } else if (ch === '\n' || ch === '\r') {
                // If we're not inside assignment or braces, newline can end statement in ASI
                if (readingId && currentId.trim()) {
                    names.push(currentId.trim());
                    break;
                }
            } else if (readingId) {
                currentId += ch;
            }
        }
        i++;
    }

    if (readingId && currentId.trim()) {
        names.push(currentId.trim());
    }

    return names.filter(n => /^[a-zA-Z0-9_$]+$/.test(n));
}

/**
 * Extracts exported symbols from a JavaScript module.
 *
 * @param {string} filePath - Path to file.
 * @param {string} content - Source code content.
 * @returns {Array<{ name: string, type: string, file: string, line: number }>} Extracted exports.
 */
function extractExports(filePath, content) {
    const exports = [];
    const cleanContent = stripComments(content);

    // 1. export (async) function <name>
    const funcRegex = /export\s+(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/g;
    let match;
    while ((match = funcRegex.exec(cleanContent)) !== null) {
        exports.push({
            name: match[1],
            type: 'function',
            file: filePath,
            line: getLineNumber(content, match.index)
        });
    }

    // 2. export class <name>
    const classRegex = /export\s+class\s+([a-zA-Z0-9_$]+)/g;
    while ((match = classRegex.exec(cleanContent)) !== null) {
        exports.push({
            name: match[1],
            type: 'class',
            file: filePath,
            line: getLineNumber(content, match.index)
        });
    }

    // 3. export const/let/var declarations
    const declRegex = /export\s+(?:const|let|var)\s+/g;
    while ((match = declRegex.exec(cleanContent)) !== null) {
        const remaining = cleanContent.substring(match.index + match[0].length);
        const declNames = extractDeclaredVariables(remaining);
        for (const id of declNames) {
            exports.push({
                name: id,
                type: 'variable',
                file: filePath,
                line: getLineNumber(content, match.index)
            });
        }
    }

    // 4. export { a, b as c } [from './...']
    const namedExportRegex = /export\s*\{([^}]+)\}(?:\s*from\s*['"]([^'"]+)['"])?/g;
    while ((match = namedExportRegex.exec(cleanContent)) !== null) {
        const specifiers = match[1].split(',');
        const fromModule = match[2];
        for (const spec of specifiers) {
            const trimmed = spec.trim();
            if (!trimmed) continue;
            const parts = trimmed.split(/\s+as\s+/);
            const exportedName = parts.length > 1 ? parts[1].trim() : parts[0].trim();
            if (/^[a-zA-Z0-9_$]+$/.test(exportedName)) {
                exports.push({
                    name: exportedName,
                    type: fromModule ? 're-export' : 'named',
                    file: filePath,
                    line: getLineNumber(content, match.index)
                });
            }
        }
    }

    return exports;
}

/**
 * Root application bootstrap functions and lifecycle entry points whitelist.
 */
const DEFAULT_WHITELIST = new Set([
    'initApp',
    'updateUIWithTranslations',
    'applyThemeSettings',
    'applyTheme'
]);

/**
 * Scans codebase to find unused exports across js/ directory.
 *
 * @param {object} [options={}] - Options.
 * @param {string} [options.projectRoot] - Custom project root directory.
 * @param {Set<string>} [options.whitelist] - Custom entry-point whitelist.
 * @param {string[]} [options.sourceFiles] - Optional explicit list of source files to scan.
 * @param {string[]} [options.consumerFiles] - Optional explicit list of consumer files.
 * @returns {{ totalExports: number, scannedModules: number, unusedExports: Array<{ name: string, type: string, file: string, line: number }> }}
 */
function findUnusedExports(options = {}) {
    const root = options.projectRoot || projectRoot;
    const whitelist = options.whitelist || DEFAULT_WHITELIST;

    const jsDir = path.join(root, 'js');
    const sourceFiles = options.sourceFiles || findFiles(jsDir, ['.js', '.mjs']).filter(f => {
        const base = path.basename(f);
        return base !== 'qr-code-styling.js' && base !== 'workbox-window.js';
    });

    const consumerFiles = options.consumerFiles || [
        ...findFiles(path.join(root, 'js'), ['.js', '.mjs']),
        ...findFiles(path.join(root, 'partials'), ['.html', '.js']),
        ...findFiles(path.join(root, 'server'), ['.js']),
        ...findFiles(path.join(root, 'tests'), ['.js']),
        ...findFiles(path.join(root, 'scripts'), ['.js']),
        path.join(root, 'index.html'),
        path.join(root, 'service-worker-src.js'),
        path.join(root, 'service-worker.js')
    ].filter(f => fs.existsSync(f));

    const fileContents = new Map();
    for (const f of consumerFiles) {
        fileContents.set(f, fs.readFileSync(f, 'utf8'));
    }

    const allExports = [];
    for (const file of sourceFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const fileExports = extractExports(file, content);
        allExports.push(...fileExports);
    }

    const unused = [];

    for (const exp of allExports) {
        if (exp.name === 'default' || whitelist.has(exp.name)) continue;

        let isConsumed = false;
        const symRegex = new RegExp(`\\b${exp.name}\\b`);

        for (const [consumerFile, content] of fileContents.entries()) {
            if (consumerFile === exp.file) continue;

            if (symRegex.test(content)) {
                isConsumed = true;
                break;
            }
        }

        if (!isConsumed) {
            unused.push({
                name: exp.name,
                type: exp.type,
                file: path.relative(root, exp.file),
                line: exp.line
            });
        }
    }

    return {
        totalExports: allExports.length,
        scannedModules: sourceFiles.length,
        unusedExports: unused
    };
}

/**
 * Executes CLI runner and reports status.
 *
 * @returns {number} Exit code (0 on success, 1 on errors).
 */
function runLinterCli() {
    console.log('--- Dead & Unused Export Linter ---');

    const result = findUnusedExports({ projectRoot });

    console.log(`[exports] Scanned ${result.scannedModules} JS modules across js/ (${result.totalExports} exports analyzed).`);

    if (result.unusedExports.length === 0) {
        console.log('[OK] All exported symbols are actively consumed across the codebase.\n');
        return 0;
    }

    console.error(`\n[ERROR] Found ${result.unusedExports.length} unused export(s) across codebase:`);
    result.unusedExports.forEach(u => {
        console.error(`  - ${u.name} (${u.type}) in ${u.file}:${u.line}`);
    });
    console.error('\n');
    return 1;
}

if (require.main === module) {
    const exitCode = runLinterCli();
    process.exit(exitCode);
}

module.exports = {
    findFiles,
    stripComments,
    extractExports,
    DEFAULT_WHITELIST,
    findUnusedExports,
    runLinterCli
};
