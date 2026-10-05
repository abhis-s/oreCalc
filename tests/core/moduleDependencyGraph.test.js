import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

/**
 * Recursively scans directory for JavaScript source files.
 *
 * @param {string} dir
 * @returns {string[]}
 */
function scanJsFiles(dir) {
    let results = [];
    const fullDir = path.isAbsolute(dir) ? dir : path.join(projectRoot, dir);
    if (!fs.existsSync(fullDir)) return results;

    const entries = fs.readdirSync(fullDir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
        const fullPath = path.join(fullDir, entry.name);
        if (entry.isDirectory()) {
            results = results.concat(scanJsFiles(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
            if (!entry.name.endsWith('qr-code-styling.js') && !entry.name.endsWith('workbox-window.js')) {
                results.push(fullPath);
            }
        }
    }
    return results;
}

/**
 * Strips comments from code string while preserving character count structure.
 *
 * @param {string} code
 * @returns {string}
 */
function stripComments(code) {
    return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/**
 * Builds a directed adjacency graph of module import dependencies.
 *
 * @param {string[]} files
 * @returns {Map<string, string[]>}
 */
export function buildModuleDependencyGraph(files) {
    const graph = new Map();

    for (const file of files) {
        const rawContent = fs.readFileSync(file, 'utf8');
        const content = stripComments(rawContent);
        const dir = path.dirname(file);
        const deps = new Set();

        const importRegex = /(?:from\s*['"]|import\s*\(\s*['"])([^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const importPath = match[1];
            if (importPath.startsWith('.')) {
                const resolved = path.resolve(dir, importPath);
                if (fs.existsSync(resolved) && (resolved.endsWith('.js') || resolved.endsWith('.mjs'))) {
                    deps.add(resolved);
                }
            }
        }
        graph.set(file, Array.from(deps));
    }

    return graph;
}

/**
 * Finds all simple circular dependency cycles in a directed graph using DFS.
 *
 * @param {Map<string, string[]>} graph
 * @returns {string[][]} Array of cycle paths.
 */
export function findCircularDependencies(graph) {
    const visited = new Set();
    const visiting = new Set();
    const cycles = [];

    function dfs(node, pathStack) {
        visiting.add(node);
        pathStack.push(node);

        const neighbors = graph.get(node) || [];
        for (const neighbor of neighbors) {
            if (visiting.has(neighbor)) {
                const cycleStartIndex = pathStack.indexOf(neighbor);
                if (cycleStartIndex !== -1) {
                    const cyclePath = pathStack.slice(cycleStartIndex).concat(neighbor);
                    // Cycle deduplication via sorted key
                    const cycleKey = cyclePath.slice(0, -1).sort().join('|');
                    const exists = cycles.some(c => c.slice(0, -1).sort().join('|') === cycleKey);
                    if (!exists) {
                        cycles.push(cyclePath);
                    }
                }
            } else if (!visited.has(neighbor)) {
                dfs(neighbor, pathStack);
            }
        }

        pathStack.pop();
        visiting.delete(node);
        visited.add(node);
    }

    for (const file of graph.keys()) {
        if (!visited.has(file)) {
            dfs(file, []);
        }
    }

    return cycles;
}

/**
 * Authorized Component Façades that serve as public feature entry-points.
 */
export const AUTHORIZED_COMPONENT_FACADES = new Set([
    'js/components/appSettings/appSettings.js',
    'js/components/appSettings/settingsModals.js',
    'js/components/equipment/equipmentDetailsModal.js',
    'js/components/planner/calendar.js',
    'js/components/planner/priorityListModal.js',
    'js/components/player/playerDropdown.js',
    'js/components/player/playerModal.js',
    'js/components/guidedSetup/guidedSetupModal.js'
]);

/**
 * Finds unauthorized or redundant pass-through re-exports.
 *
 * Rules:
 * 1. ZERO re-exports in js/utils/, js/domain/, js/data/, js/core/, and server/.
 * 2. In js/components/, only AUTHORIZED_COMPONENT_FACADES may re-export.
 *
 * @param {string[]} files
 * @returns {Array<{ file: string, symbol: string, source: string, reason: string }>}
 */
export function findPassThroughReExportViolations(files) {
    const violations = [];

    for (const file of files) {
        const relPath = path.relative(projectRoot, file);
        const rawContent = fs.readFileSync(file, 'utf8');
        const content = stripComments(rawContent);
        const isAuthorizedFacade = AUTHORIZED_COMPONENT_FACADES.has(relPath);

        // Symbol import registry mapping
        const importedSymbols = new Map();
        const importNamedRegex = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
        let match;
        while ((match = importNamedRegex.exec(content)) !== null) {
            const symbols = match[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
            symbols.forEach(s => importedSymbols.set(s, match[2]));
        }

        // Direct re-export inspection: export { x } from './y.js'
        const reExportFromRegex = /export\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
        while ((match = reExportFromRegex.exec(content)) !== null) {
            const symbols = match[1].split(',').map(s => s.trim()).filter(Boolean);
            if (!isAuthorizedFacade) {
                symbols.forEach(symbol => {
                    violations.push({
                        file: relPath,
                        symbol,
                        source: match[2],
                        reason: 'Non-façade module is not permitted to use "export { ... } from"'
                    });
                });
            }
        }

        // Indirect pass-through re-export inspection
        const namedExportRegex = /export\s*\{([^}]+)\}(?!\s*from)/g;
        while ((match = namedExportRegex.exec(content)) !== null) {
            const exportedSpecs = match[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
            for (const sym of exportedSpecs) {
                if (importedSymbols.has(sym)) {
                    if (!isAuthorizedFacade) {
                        violations.push({
                            file: relPath,
                            symbol: sym,
                            source: importedSymbols.get(sym),
                            reason: 'Module imported symbol solely to re-export it without ownership'
                        });
                    }
                }
            }
        }
    }

    return violations;
}

/**
 * Detects inward façade leaks where component sub-files import from their parent façade.
 *
 * @param {string[]} files
 * @returns {Array<{ file: string, facade: string }>}
 */
export function findInwardFacadeImportViolations(files) {
    const violations = [];

    for (const file of files) {
        const relPath = path.relative(projectRoot, file);
        if (!relPath.startsWith('js/components/')) continue;
        if (AUTHORIZED_COMPONENT_FACADES.has(relPath)) continue;

        const rawContent = fs.readFileSync(file, 'utf8');
        const content = stripComments(rawContent);
        const dir = path.dirname(file);
        const componentDir = relPath.split('/').slice(0, 3).join('/');

        const importRegex = /(?:from\s*['"]|import\s*\(\s*['"])([^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const importPath = match[1];
            if (importPath.startsWith('.')) {
                const resolved = path.resolve(dir, importPath);
                const resolvedRel = path.relative(projectRoot, resolved);
                if (AUTHORIZED_COMPONENT_FACADES.has(resolvedRel) && resolvedRel.startsWith(componentDir)) {
                    violations.push({
                        file: relPath,
                        facade: resolvedRel
                    });
                }
            }
        }
    }

    return violations;
}

describe('Module Dependency Graph & Invariant Re-Export Guardrail Suite', () => {

    test('synthetic cycle detector accurately identifies circular dependencies', () => {
        const syntheticGraph = new Map([
            ['/a.js', ['/b.js']],
            ['/b.js', ['/c.js']],
            ['/c.js', ['/a.js']],
            ['/d.js', ['/e.js']],
            ['/e.js', []]
        ]);

        const cycles = findCircularDependencies(syntheticGraph);
        assert.equal(cycles.length, 1);
        assert.deepEqual(cycles[0], ['/a.js', '/b.js', '/c.js', '/a.js']);
    });

    test('zero circular dependency cycles across all codebase modules', () => {
        const sourceFiles = scanJsFiles('js');
        const graph = buildModuleDependencyGraph(sourceFiles);
        const cycles = findCircularDependencies(graph);

        if (cycles.length > 0) {
            const formatted = cycles.map((c, i) => `  Cycle #${i + 1}: ${c.map(p => path.relative(projectRoot, p)).join(' -> ')}`).join('\n');
            assert.fail(`Found ${cycles.length} circular dependency cycle(s):\n${formatted}`);
        }
        assert.equal(cycles.length, 0);
    });

    test('zero pass-through re-exports in utils, domain, data, core, and non-façade components', () => {
        const sourceFiles = scanJsFiles('js');
        const violations = findPassThroughReExportViolations(sourceFiles);

        if (violations.length > 0) {
            const formatted = violations.map(v => `  - [PASS-THROUGH] ${v.file}: re-exports "${v.symbol}" from "${v.source}" (${v.reason})`).join('\n');
            assert.fail(`Found ${violations.length} pass-through re-export violation(s):\n${formatted}`);
        }
        assert.equal(violations.length, 0);
    });

    test('zero inward façade imports (component sub-files must not import from parent façade)', () => {
        const sourceFiles = scanJsFiles('js');
        const violations = findInwardFacadeImportViolations(sourceFiles);

        if (violations.length > 0) {
            const formatted = violations.map(v => `  - [INWARD FAÇADE LEAK] ${v.file} imports from parent façade "${v.facade}"`).join('\n');
            assert.fail(`Found ${violations.length} inward façade leak(s):\n${formatted}`);
        }
        assert.equal(violations.length, 0);
    });

    test('Rule 12: pure domain calculation modules in js/domain/ have zero DOM or Tier 3/4 imports', () => {
        const domainFiles = scanJsFiles('js/domain');
        assert.ok(domainFiles.length > 0, 'Must find domain modules to test');
        const violations = [];

        const forbiddenGlobalsRegex = /\b(document|window|HTMLElement|localStorage|sessionStorage|CustomEvent)\b/;

        for (const file of domainFiles) {
            const relPath = path.relative(projectRoot, file).replace(/\\/g, '/');
            const rawContent = fs.readFileSync(file, 'utf8');
            const content = stripComments(rawContent);

            const domMatch = forbiddenGlobalsRegex.exec(content);
            if (domMatch) {
                violations.push({
                    file: relPath,
                    reason: `Domain module accesses DOM global "${domMatch[0]}" (domain calculations must be 100% pure)`
                });
            }

            const importRegex = /(?:from\s*['"]|import\s*\(\s*['"])([^'"]+)['"]/g;
            let match;
            const dir = path.dirname(file);
            while ((match = importRegex.exec(content)) !== null) {
                const importPath = match[1];
                if (importPath.startsWith('.')) {
                    const resolved = path.resolve(dir, importPath);
                    const resolvedRel = path.relative(projectRoot, resolved).replace(/\\/g, '/');
                    const isTier1 = resolvedRel.startsWith('js/data/') || resolvedRel === 'js/core/constants.js' || resolvedRel === 'js/core/types.js';
                    const isTier2 = resolvedRel.startsWith('js/domain/') || resolvedRel.startsWith('js/utils/');
                    if (!isTier1 && !isTier2) {
                        violations.push({
                            file: relPath,
                            reason: `Domain module imports from higher tier: "${resolvedRel}" (must only import Tier 1 Data or Tier 2 Utils)`
                        });
                    }
                }
            }
        }

        if (violations.length > 0) {
            const formatted = violations.map(v => `  - [DOMAIN PURITY VIOLATION] ${v.file}: ${v.reason}`).join('\n');
            assert.fail(`Found ${violations.length} domain purity violation(s):\n${formatted}`);
        }
        assert.equal(violations.length, 0);
    });

    test('Rule 12: Tier 1 (data) and Tier 2 (utils) never import Tier 4 (components/ui/apps)', () => {
        const lowerTierFiles = [
            ...scanJsFiles('js/data'),
            ...scanJsFiles('js/utils')
        ];
        assert.ok(lowerTierFiles.length > 0, 'Must find lower tier files');
        const violations = [];

        function isTier4Path(rel) {
            return rel.startsWith('js/components/') ||
                rel.startsWith('js/ui/') ||
                rel.startsWith('js/layout/') ||
                rel === 'js/app.js' ||
                rel === 'js/damageApp.js' ||
                rel === 'js/heroJourneyApp.js' ||
                rel === 'js/console.js' ||
                rel === 'js/landingApp.js';
        }

        for (const file of lowerTierFiles) {
            const relPath = path.relative(projectRoot, file).replace(/\\/g, '/');
            const rawContent = fs.readFileSync(file, 'utf8');
            const content = stripComments(rawContent);
            const dir = path.dirname(file);

            const importRegex = /(?:from\s*['"]|import\s*\(\s*['"])([^'"]+)['"]/g;
            let match;
            while ((match = importRegex.exec(content)) !== null) {
                const importPath = match[1];
                if (importPath.startsWith('.')) {
                    const resolved = path.resolve(dir, importPath);
                    const resolvedRel = path.relative(projectRoot, resolved).replace(/\\/g, '/');
                    if (isTier4Path(resolvedRel)) {
                        violations.push({
                            file: relPath,
                            target: resolvedRel,
                            reason: 'Lower tier module must never import Tier 4 UI components or application controllers'
                        });
                    }
                }
            }
        }

        if (violations.length > 0) {
            const formatted = violations.map(v => `  - [TIER VIOLATION] ${v.file} imports ${v.target} (${v.reason})`).join('\n');
            assert.fail(`Found ${violations.length} lower-to-higher tier violation(s):\n${formatted}`);
        }
        assert.equal(violations.length, 0);
    });

    test('Rule 13: Display and Renderer modules have zero state mutations and zero interactive event listeners', () => {
        const allSourceFiles = scanJsFiles('js');
        const displayAndRendererFiles = allSourceFiles.filter(file => {
            const name = path.basename(file);
            return name.endsWith('Display.js') || name.endsWith('Renderer.js');
        });
        assert.ok(displayAndRendererFiles.length > 50, 'Must find display and renderer files');

        // Allowlisted composite controllers with presentation-only event triggers:
        // - navigationDrawerRenderer: manages cross-app navigation links and drawer toggling
        // - priorityListModalDisplay: manages read-only priority ore popover positioning and dismissal (0 state mutations)
        const ALLOWED_RENDERER_INTERACTIONS = new Set([
            'js/components/common/navigationDrawerRenderer.js',
            'js/components/planner/priorityListModalDisplay.js'
        ]);

        const violations = [];

        for (const file of displayAndRendererFiles) {
            const relPath = path.relative(projectRoot, file).replace(/\\/g, '/');
            const rawContent = fs.readFileSync(file, 'utf8');
            const content = stripComments(rawContent);

            if (content.includes('handleStateUpdate')) {
                violations.push({
                    file: relPath,
                    reason: 'Display/Renderer module must never execute handleStateUpdate transactions'
                });
            }

            const stateMutationRegex = /\bstate(?:\.[a-zA-Z0-9_$]+)+\s*=(?!=)/g;
            let stateMatch;
            while ((stateMatch = stateMutationRegex.exec(content)) !== null) {
                violations.push({
                    file: relPath,
                    reason: `Display/Renderer module directly mutates global state: "${stateMatch[0]}"`
                });
            }

            if (!ALLOWED_RENDERER_INTERACTIONS.has(relPath)) {
                if (content.includes('addEventListener')) {
                    violations.push({
                        file: relPath,
                        reason: 'Display/Renderer module must never attach event listeners directly (delegate to *Inputs.js)'
                    });
                }
            }
        }

        if (violations.length > 0) {
            const formatted = violations.map(v => `  - [RULE 13 VIOLATION] ${v.file}: ${v.reason}`).join('\n');
            assert.fail(`Found ${violations.length} Display/Renderer purity violation(s):\n${formatted}`);
        }
        assert.equal(violations.length, 0);
    });
});
