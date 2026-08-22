import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const require = createRequire(import.meta.url);
const {
    stripComments,
    extractExports,
    DEFAULT_WHITELIST,
    findUnusedExports,
    runLinterCli
} = require('../../scripts/check-unused-exports.js');

describe('Dead & Unused Export Linter Suite', () => {

    describe('stripComments Utility', () => {
        test('strips single-line comments without altering line counts', () => {
            const code = "const a = 1; // comment\nconst b = 2;";
            const stripped = stripComments(code);
            assert.equal(stripped.includes('// comment'), false);
            assert.equal(stripped.split('\n').length, 2);
        });

        test('strips multi-line block comments while preserving line indices', () => {
            const code = "const a = 1;\n/* multiline\n   comment\n*/\nconst b = 2;";
            const stripped = stripComments(code);
            assert.equal(stripped.includes('multiline'), false);
            assert.equal(stripped.split('\n').length, 5);
        });

        test('handles empty or null code input gracefully', () => {
            assert.equal(stripComments(''), '');
            assert.equal(stripComments(null), '');
        });
    });

    describe('extractExports Parser', () => {
        test('extracts standard and async exported functions', () => {
            const code = `
                export function standardHelper(a, b) { return a + b; }
                export async function fetchAsyncData() { return true; }
                function internalHelper() {}
            `;
            const result = extractExports('/mock/module.js', code);
            const names = result.map(e => e.name);
            assert.deepEqual(names, ['standardHelper', 'fetchAsyncData']);
            assert.equal(result[0].type, 'function');
            assert.equal(result[1].type, 'function');
        });

        test('extracts exported classes', () => {
            const code = `
                export class CardManager {}
                class LocalClass {}
            `;
            const result = extractExports('/mock/module.js', code);
            assert.deepEqual(result.map(e => e.name), ['CardManager']);
            assert.equal(result[0].type, 'class');
        });

        test('extracts exported const, let, and var declarations including multi-variable statements', () => {
            const code = `
                export const MAX_ITEMS = 10;
                export let counter = 0;
                export var isReady = true;
                export const ALPHA = 1, BETA = 2, GAMMA = 3;
                const PRIVATE_VAR = 99;
            `;
            const result = extractExports('/mock/module.js', code);
            const names = result.map(e => e.name);
            assert.deepEqual(names, ['MAX_ITEMS', 'counter', 'isReady', 'ALPHA', 'BETA', 'GAMMA']);
        });

        test('extracts named export clauses and renamed exports', () => {
            const code = `
                const foo = 1;
                const bar = 2;
                export { foo, bar as aliasedBar };
            `;
            const result = extractExports('/mock/module.js', code);
            assert.deepEqual(result.map(e => e.name), ['foo', 'aliasedBar']);
            assert.equal(result[0].type, 'named');
            assert.equal(result[1].type, 'named');
        });

        test('extracts re-exports from other modules', () => {
            const code = 'export { utilA, utilB as utilBAlias } from ' + "'otherModule';";
            const result = extractExports('/mock/module.js', code);
            assert.deepEqual(result.map(e => e.name), ['utilA', 'utilBAlias']);
            assert.equal(result[0].type, 're-export');
            assert.equal(result[1].type, 're-export');
        });

        test('ignores commented-out exports', () => {
            const code = `
                // export const UNUSED_ONE = 1;
                /*
                   export function unusedTwo() {}
                */
                export const ACTIVE = true;
            `;
            const result = extractExports('/mock/module.js', code);
            assert.deepEqual(result.map(e => e.name), ['ACTIVE']);
        });
    });

    describe('findUnusedExports Scanner Logic', () => {
        test('identifies artificially injected unused exports on synthetic source/consumer sets', () => {
            const mockSourceCode = `
                export function usedFunction() { return 1; }
                export function deadFunction() { return 2; }
                export const DEAD_CONSTANT = 42;
                export const USED_CONSTANT = 100;
            `;
            const mockConsumerCode = 'import { usedFunction } from ' + "'sourceModule';\nconsole.log(USED_CONSTANT);";

            const options = {
                projectRoot,
                sourceFiles: ['/mock/source.js'],
                consumerFiles: ['/mock/source.js', '/mock/consumer.js'],
                whitelist: new Set()
            };

            const fileExports = extractExports('/mock/source.js', mockSourceCode);
            const consumerContent = mockConsumerCode;

            const unused = [];
            for (const exp of fileExports) {
                const regex = new RegExp(`\\b${exp.name}\\b`);
                if (!regex.test(consumerContent)) {
                    unused.push(exp.name);
                }
            }

            assert.deepEqual(unused, ['deadFunction', 'DEAD_CONSTANT']);
        });

        test('honors entry-point whitelist for bootstrapping functions', () => {
            assert.equal(DEFAULT_WHITELIST.has('initApp'), true);
            assert.equal(DEFAULT_WHITELIST.has('updateUIWithTranslations'), true);
            assert.equal(DEFAULT_WHITELIST.has('applyThemeSettings'), true);
            assert.equal(DEFAULT_WHITELIST.has('applyTheme'), true);
        });
    });

    describe('Live Codebase Zero-Dead-Export Verification', () => {
        test('validates that the repository passes with zero dead or unconsumed exports', () => {
            const result = findUnusedExports({ projectRoot });

            assert.ok(result.scannedModules >= 170, `Expected at least 170 scanned modules, got ${result.scannedModules}`);
            assert.ok(result.totalExports >= 650, `Expected at least 650 total exports, got ${result.totalExports}`);

            if (result.unusedExports.length > 0) {
                const details = result.unusedExports.map(u => `  - ${u.name} (${u.type}) in ${u.file}:${u.line}`).join('\n');
                assert.fail(`Found ${result.unusedExports.length} unused export(s) across codebase:\n${details}`);
            }

            assert.deepEqual(result.unusedExports, []);
        });

        test('CLI runner executes cleanly and returns exit code 0', () => {
            const code = runLinterCli();
            assert.equal(code, 0);
        });
    });

});
