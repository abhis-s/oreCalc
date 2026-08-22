const fs = require('fs');
const path = require('path');
const { ESLint } = require('eslint');

const projectRoot = process.cwd();

/**
 * Recursively traverses a directory and returns an array of absolute file paths matching .js extension.
 *
 * @param {string} dir - Directory path to scan.
 * @returns {string[]} List of full file paths.
 */
function getJsFiles(dir) {
    let results = [];
    const fullDir = path.isAbsolute(dir) ? dir : path.join(projectRoot, dir);
    if (!fs.existsSync(fullDir)) return results;

    const list = fs.readdirSync(fullDir);
    list.forEach((file) => {
        const fullPath = path.join(fullDir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
                results = results.concat(getJsFiles(fullPath));
            }
        } else if (file.endsWith('.js') || file.endsWith('.mjs')) {
            results.push(fullPath);
        }
    });
    return results;
}

/**
 * Verifies that all relative ESM imports point to valid existing files and exported symbols exist.
 *
 * @returns {number} Total count of broken imports or export mismatches found.
 */
function checkModuleImportBindings() {
    const jsFiles = [
        ...getJsFiles('js'),
        ...getJsFiles('tests'),
        ...getJsFiles('scripts'),
        ...getJsFiles('server')
    ];

    let errors = 0;

    for (const file of jsFiles) {
        if (file.endsWith('qr-code-styling.js') || file.endsWith('workbox-window.js') || file.endsWith('check-undefined-vars.js')) {
            continue;
        }

        let content = fs.readFileSync(file, 'utf8');
        // Strip block comments and line comments
        content = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        const dir = path.dirname(file);
        const relPath = path.relative(projectRoot, file);

        // 1. Static imports: import ... from "./..."
        const staticImportRegex = /from\s*['"]([^'"]+)['"]/g;
        let match;
        while ((match = staticImportRegex.exec(content)) !== null) {
            const importPath = match[1];
            if (importPath.startsWith('.')) {
                const resolvedPath = path.resolve(dir, importPath);
                if (!fs.existsSync(resolvedPath)) {
                    console.error(`[BROKEN IMPORT] in ${relPath}: Cannot resolve "${importPath}"`);
                    errors++;
                }
            }
        }

        // 2. Dynamic imports: import("./...")
        const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        while ((match = dynamicImportRegex.exec(content)) !== null) {
            const importPath = match[1];
            if (importPath.startsWith('.')) {
                const resolvedPath = path.resolve(dir, importPath);
                if (!fs.existsSync(resolvedPath)) {
                    console.error(`[BROKEN DYNAMIC IMPORT] in ${relPath}: Cannot resolve "${importPath}"`);
                    errors++;
                }
            }
        }

        // 3. Named export verification: import { foo } from "./path.js"
        const namedImportRegex = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
        while ((match = namedImportRegex.exec(content)) !== null) {
            const symbols = match[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
            const importPath = match[2];
            if (importPath.startsWith('.')) {
                const resolvedPath = path.resolve(dir, importPath);
                if (fs.existsSync(resolvedPath)) {
                    const targetContent = fs.readFileSync(resolvedPath, 'utf8');
                    symbols.forEach(sym => {
                        const hasExportFunction = new RegExp(`export\\s+(?:async\\s+)?function\\s+${sym}\\b`).test(targetContent);
                        const hasExportConst = new RegExp(`export\\s+(?:const|let|var|class)\\s+${sym}\\b`).test(targetContent);
                        const hasExportNamed = new RegExp(`export\\s*\\{[^}]*\\b${sym}\\b[^}]*\\}`).test(targetContent);
                        const hasExportDefault = sym === 'default' && /export\s+default\b/.test(targetContent);

                        if (!hasExportFunction && !hasExportConst && !hasExportNamed && !hasExportDefault) {
                            console.error(`[EXPORT MISMATCH] in ${relPath}: "${sym}" is imported from "${importPath}", but is not exported.`);
                            errors++;
                        }
                    });
                }
            }
        }

        // 4. Late Static Import Detection (imports must be at top of module)
        if (file.endsWith('.js') && !file.includes('/tests/') && !file.includes('/scripts/') && !file.includes('/server/')) {
            const rawLines = fs.readFileSync(file, 'utf8').split('\n');
            let seenNonImportCode = false;
            let inBlockComment = false;
            let inMultiLineImport = false;
            for (let i = 0; i < rawLines.length; i++) {
                let line = rawLines[i].trim();
                if (inBlockComment) {
                    if (line.includes('*/')) {
                        inBlockComment = false;
                        line = line.substring(line.indexOf('*/') + 2).trim();
                    } else {
                        continue;
                    }
                }
                if (line.startsWith('/*')) {
                    if (!line.includes('*/')) {
                        inBlockComment = true;
                        continue;
                    } else {
                        line = line.substring(line.indexOf('*/') + 2).trim();
                    }
                }
                if (!line || line.startsWith('//') || line === "'use strict';" || line === '"use strict";') {
                    continue;
                }
                if (inMultiLineImport) {
                    if (line.includes('from ') || line.includes("';") || line.includes('";') || line.endsWith(';')) {
                        inMultiLineImport = false;
                    }
                    continue;
                }
                if (/^import\s+(?!type\s)/.test(line)) {
                    if (seenNonImportCode) {
                        console.error(`[LATE IMPORT] in ${relPath}:${i + 1}: Static import '${line}' found after executable code.`);
                        errors++;
                    }
                    if (!line.includes('from ') && !line.endsWith(';') && !line.includes("';") && !line.includes('";')) {
                        inMultiLineImport = true;
                    }
                } else {
                    seenNonImportCode = true;
                }
            }
        }
    }

    return errors;
}

/**
 * Verifies that all JSON.parse calls in js/ are routed through js/utils/jsonUtils.js.
 *
 * @returns {number} Count of naked JSON.parse violations.
 */
function checkSafeJsonParsing() {
    const jsFiles = [...getJsFiles('js'), ...getJsFiles('server')];
    let errors = 0;

    for (const file of jsFiles) {
        if (file.endsWith('jsonUtils.js')) continue;

        let content = fs.readFileSync(file, 'utf8');
        content = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

        if (/JSON\.parse\s*\(/.test(content)) {
            const relPath = path.relative(projectRoot, file);
            console.error(`[ERROR] Direct naked JSON.parse() call found in "${relPath}". Must use safeJsonParse.`);
            errors++;
        }
    }

    return errors;
}

/**
 * Validates the JavaScript syntax of all inline <script> blocks inside HTML files using ESLint parser.
 *
 * @param {ESLint} eslint - Active ESLint instance.
 * @returns {Promise<number>} Total syntax errors found across HTML inline scripts.
 */
async function checkInlineHtmlScriptSyntax(eslint) {
    function getHtmlFiles(dir) {
        let results = [];
        const fullDir = path.isAbsolute(dir) ? dir : path.join(projectRoot, dir);
        if (!fs.existsSync(fullDir)) return results;
        const list = fs.readdirSync(fullDir);
        list.forEach((file) => {
            const fullPath = path.join(fullDir, file);
            const stat = fs.statSync(fullPath);
            if (stat && stat.isDirectory()) {
                if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
                    results = results.concat(getHtmlFiles(fullPath));
                }
            } else if (file.endsWith('.html')) {
                results.push(fullPath);
            }
        });
        return results;
    }

    const htmlFiles = [
        path.join(projectRoot, 'index.html'),
        path.join(projectRoot, '404.html'),
        ...getHtmlFiles('partials'),
        ...getHtmlFiles('legal')
    ].filter(f => fs.existsSync(f));

    let syntaxErrors = 0;

    for (const file of htmlFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const relPath = path.relative(projectRoot, file);
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
                        console.error(`[SYNTAX ERROR] In ${relPath} (inline script #${scriptIndex}, line ${m.line}, col ${m.column}): ${m.message}`);
                        syntaxErrors++;
                    });
                }
            } catch (err) {
                console.error(`[SYNTAX ERROR] In ${relPath} inline script #${scriptIndex}:`, err.message);
                syntaxErrors++;
            }
            scriptIndex++;
        }
    }

    return syntaxErrors;
}

/**
 * Main execution runner.
 */
async function main() {
    console.log('--- Static Scope & Undefined Variable Linter ---');

    // 1. Check module import/export bindings
    const bindingErrors = checkModuleImportBindings();

    // 2. Check safe JSON parsing enforcement
    const jsonErrors = checkSafeJsonParsing();

    const eslint = new ESLint();

    // 3. Check HTML inline script syntax
    const inlineScriptErrors = await checkInlineHtmlScriptSyntax(eslint);

    // 4. ESLint scope analysis
    const results = await eslint.lintFiles([
        'js/**/*.js',
        'tests/**/*.js',
        'scripts/**/*.js',
        'server/**/*.js',
        'service-worker-src.js',
        'service-worker.js',
        '*.js',
        '*.mjs'
    ]);

    let eslintErrorCount = 0;
    results.forEach(r => {
        eslintErrorCount += r.errorCount;
    });

    if (eslintErrorCount > 0) {
        const formatter = await eslint.loadFormatter('stylish');
        const resultText = formatter.format(results);
        console.error(resultText);
    }

    const totalErrors = bindingErrors + jsonErrors + inlineScriptErrors + eslintErrorCount;

    if (totalErrors === 0) {
        console.log('[OK] All JavaScript modules pass strict static scope & undefined identifier checks.');
        console.log('[OK] All HTML inline <script> blocks pass strict JavaScript syntax validation.');
        console.log('[OK] All import bindings and named exports resolve cleanly.');
        console.log('[OK] All JSON deserialization routed via safeJsonParse.\n');
        process.exit(0);
    } else {
        console.error(`\n[FAIL] Found ${totalErrors} unresolved or undeclared symbol error(s).\n`);
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('Fatal error during static scope analysis:', err);
    process.exit(1);
});
