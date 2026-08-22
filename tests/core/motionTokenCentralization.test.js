import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    MOTION_DURATION_INSTANT_MS,
    MOTION_DURATION_FAST_MS,
    MOTION_DURATION_EXIT_MS,
    MOTION_DURATION_BASE_MS,
    MOTION_DURATION_MODERATE_MS,
    MOTION_DURATION_SLOW_MS
} from '../../js/core/constants.js';

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

describe('Global Motion, Easing Curves & Animation Token Centralization', () => {

    const variablesScssPath = path.join(projectRoot, 'css/abstracts/_variables.scss');
    const baseScssPath = path.join(projectRoot, 'css/base/_base.scss');
    const mixinsScssPath = path.join(projectRoot, 'css/abstracts/_mixins.scss');

    describe('Pillar 1: SCSS Motion Tokens in _variables.scss', () => {
        const content = fs.readFileSync(variablesScssPath, 'utf8');

        test('defines standard easing curve tokens', () => {
            const expectedEasings = [
                { token: '$ease-enter', expected: 'cubic-bezier(0.16, 1, 0.3, 1)' },
                { token: '$ease-decelerate', expected: 'cubic-bezier(0.0, 0.0, 0.2, 1)' },
                { token: '$ease-exit', expected: 'cubic-bezier(0.4, 0, 0.8, 0.2)' },
                { token: '$ease-accelerate', expected: 'cubic-bezier(0.4, 0.0, 1, 1)' },
                { token: '$ease-standard', expected: 'cubic-bezier(0.2, 0, 0, 1)' },
                { token: '$ease-smooth', expected: 'cubic-bezier(0.25, 1, 0.5, 1)' },
                { token: '$ease-spring', expected: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
                { token: '$ease-bounce', expected: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' }
            ];

            for (const { token, expected } of expectedEasings) {
                const regex = new RegExp(`\\${token}:\\s*([^;]+);`);
                const match = content.match(regex);
                assert.ok(match, `Expected ${token} to be defined in _variables.scss`);
                assert.equal(
                    match[1].replace(/\s+/g, ' ').trim(),
                    expected,
                    `Token ${token} value mismatch`
                );
            }
        });

        test('defines modular duration scale tokens in milliseconds', () => {
            const expectedDurations = [
                { token: '$duration-instant', expected: '100ms' },
                { token: '$duration-fast', expected: '150ms' },
                { token: '$duration-exit', expected: '180ms' },
                { token: '$duration-base', expected: '250ms' },
                { token: '$duration-moderate', expected: '300ms' },
                { token: '$duration-slow', expected: '400ms' }
            ];

            for (const { token, expected } of expectedDurations) {
                const regex = new RegExp(`\\${token}:\\s*([^;]+);`);
                const match = content.match(regex);
                assert.ok(match, `Expected ${token} to be defined in _variables.scss`);
                assert.equal(
                    match[1].trim(),
                    expected,
                    `Token ${token} value mismatch`
                );
            }
        });

        test('defines standardized motion mixins in _variables.scss and _mixins.scss', () => {
            const mixinContent = fs.existsSync(mixinsScssPath)
                ? fs.readFileSync(mixinsScssPath, 'utf8')
                : '';
            const combinedContent = content + '\n' + mixinContent;

            const expectedMixins = [
                '@mixin transition',
                '@mixin motion-enter',
                '@mixin motion-exit',
                '@mixin motion-interactive'
            ];

            for (const mixin of expectedMixins) {
                assert.ok(
                    combinedContent.includes(mixin),
                    `Expected mixin ${mixin} to be declared in abstracts`
                );
            }
        });
    });

    describe('Pillar 2: CSS Custom Properties on :root & Reduced Motion in _base.scss', () => {
        let content = fs.readFileSync(baseScssPath, 'utf8');
        if (content.includes('@forward')) {
            const rootTokensPath = path.join(projectRoot, 'css/base/_root-tokens.scss');
            const elementsResetPath = path.join(projectRoot, 'css/base/_elements-reset.scss');
            if (fs.existsSync(rootTokensPath)) {
                content += '\n' + fs.readFileSync(rootTokensPath, 'utf8');
            }
            if (fs.existsSync(elementsResetPath)) {
                content += '\n' + fs.readFileSync(elementsResetPath, 'utf8');
            }
        }

        test('exposes easing curves as custom properties on :root', () => {
            const expectedProperties = [
                '--ease-enter',
                '--ease-decelerate',
                '--ease-exit',
                '--ease-accelerate',
                '--ease-standard',
                '--ease-smooth',
                '--ease-spring',
                '--ease-bounce'
            ];

            for (const prop of expectedProperties) {
                const regex = new RegExp(`${prop}:\\s*cubic-bezier\\([^)]+\\);`);
                assert.ok(
                    regex.test(content),
                    `Expected ${prop} custom property defined on :root in _base.scss`
                );
            }
        });

        test('exposes durations as custom properties on :root', () => {
            const expectedDurations = [
                { prop: '--duration-instant', value: '100ms' },
                { prop: '--duration-fast', value: '150ms' },
                { prop: '--duration-exit', value: '180ms' },
                { prop: '--duration-base', value: '250ms' },
                { prop: '--duration-moderate', value: '300ms' },
                { prop: '--duration-slow', value: '400ms' }
            ];

            for (const { prop, value } of expectedDurations) {
                const regex = new RegExp(`${prop}:\\s*${value};`);
                assert.ok(
                    regex.test(content),
                    `Expected ${prop}: ${value} defined on :root in _base.scss`
                );
            }
        });

        test('implements universal prefers-reduced-motion media query', () => {
            assert.ok(
                content.includes('@media (prefers-reduced-motion: reduce)'),
                'Expected universal prefers-reduced-motion media query in _base.scss'
            );
            assert.ok(
                content.includes('--duration-instant: 0.01ms') ||
                content.includes('animation-duration: 0.01ms') ||
                content.includes('transition-duration: 0.01ms'),
                'Expected reduced motion duration override rules in _base.scss'
            );
        });
    });

    describe('Pillar 3: Zero Raw cubic-bezier Literals in Component & Page SCSS', () => {
        const scssFiles = scanDir(path.join(projectRoot, 'css'), f => f.endsWith('.scss'));
        const allowedFiles = new Set([
            path.normalize(variablesScssPath),
            path.normalize(baseScssPath),
            path.normalize(path.join(projectRoot, 'css/base/_root-tokens.scss')),
            path.normalize(mixinsScssPath)
        ]);

        test('ensures no component, layout, or page SCSS file contains raw cubic-bezier(...) literals', () => {
            const violations = [];

            for (const file of scssFiles) {
                const normalized = path.normalize(file);
                if (allowedFiles.has(normalized)) continue;

                const fileContent = fs.readFileSync(file, 'utf8');
                const lines = fileContent.split('\n');

                lines.forEach((line, idx) => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
                    if (trimmed.includes('cubic-bezier(')) {
                        const relPath = path.relative(projectRoot, file);
                        violations.push(`${relPath}:${idx + 1} -> ${trimmed}`);
                    }
                });
            }

            assert.equal(
                violations.length,
                0,
                `Found forbidden raw cubic-bezier(...) literals outside variables/base:\n${violations.join('\n')}`
            );
        });
    });

    describe('Pillar 4: JavaScript Constants & SCSS Parity Synchronization', () => {
        const scssVariablesContent = fs.readFileSync(variablesScssPath, 'utf8');

        test('exports immutable motion duration constants in js/core/constants.js', () => {
            assert.equal(MOTION_DURATION_INSTANT_MS, 100);
            assert.equal(MOTION_DURATION_FAST_MS, 150);
            assert.equal(MOTION_DURATION_EXIT_MS, 180);
            assert.equal(MOTION_DURATION_BASE_MS, 250);
            assert.equal(MOTION_DURATION_MODERATE_MS, 300);
            assert.equal(MOTION_DURATION_SLOW_MS, 400);
        });

        test('synchronizes JS motion duration values exactly with SCSS $duration-* tokens', () => {
            const mapping = [
                { jsVal: MOTION_DURATION_INSTANT_MS, scssToken: '$duration-instant' },
                { jsVal: MOTION_DURATION_FAST_MS, scssToken: '$duration-fast' },
                { jsVal: MOTION_DURATION_EXIT_MS, scssToken: '$duration-exit' },
                { jsVal: MOTION_DURATION_BASE_MS, scssToken: '$duration-base' },
                { jsVal: MOTION_DURATION_MODERATE_MS, scssToken: '$duration-moderate' },
                { jsVal: MOTION_DURATION_SLOW_MS, scssToken: '$duration-slow' }
            ];

            for (const { jsVal, scssToken } of mapping) {
                const regex = new RegExp(`\\${scssToken}:\\s*(\\d+)ms;`);
                const match = scssVariablesContent.match(regex);
                assert.ok(match, `Could not find numeric ms value for ${scssToken}`);
                const scssVal = parseInt(match[1], 10);
                assert.equal(
                    jsVal,
                    scssVal,
                    `JS constant value (${jsVal}ms) does not match SCSS token ${scssToken} (${scssVal}ms)`
                );
            }
        });
    });
});
