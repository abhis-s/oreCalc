import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createDevServerParams, watchCallback } = require('../../scripts/dev/start-dev-server.js');

describe('Dev Server Watcher & Dist Immunity Suite', () => {
    test('createDevServerParams defines ignore rules and ignorePattern', () => {
        const params = createDevServerParams();
        assert.ok(Array.isArray(params.ignore), 'params.ignore must be an array');
        assert.ok(params.ignore.includes('dist'), 'params.ignore must contain "dist"');
        assert.ok(params.ignorePattern instanceof RegExp, 'params.ignorePattern must be a RegExp');
    });

    test('params.ignorePattern correctly identifies ignored vs watched paths', () => {
        const params = createDevServerParams();
        const pattern = params.ignorePattern;

        const ignoredPaths = [
            'dist',
            'dist/index.html',
            'dist/css/main.min.css',
            './dist/index.html',
            'node_modules/express/index.js',
            'scratch/temp/cache.json',
            'tests/core/someTest.test.js'
        ];

        for (const p of ignoredPaths) {
            assert.equal(pattern.test(p), true, `Expected ${p} to match ignorePattern`);
        }

        const watchedPaths = [
            'index.html',
            'ore-calculator/index.html',
            'hero-journey/index.html',
            'css/main.css',
            'css/landing.scss',
            'js/app.js',
            'partials/footer.html',
            'assets/shiny_ore.png'
        ];

        for (const p of watchedPaths) {
            assert.equal(pattern.test(p), false, `Expected ${p} NOT to match ignorePattern`);
        }
    });

    test('watchCallback ignores dist html files and does not throw', () => {
        assert.doesNotThrow(() => {
            watchCallback('change', 'dist/index.html');
            watchCallback('change', 'dist/ore-calculator/index.html');
            watchCallback('change', 'dist');
        });
    });

    test('chokidar with dev server ignore rules completely ignores dist modifications', async () => {
        const lsPath = require.resolve('live-server');
        const chokidar = require(require.resolve('chokidar', { paths: [lsPath] }));

        const params = createDevServerParams();
        const ignored = [
            function(testPath) {
                return testPath !== '.' && /(^[.#]|(?:__|~)$)/.test(path.basename(testPath));
            }
        ].concat(params.ignore);

        if (params.ignorePattern) {
            ignored.push(params.ignorePattern);
        }

        const watcher = chokidar.watch('.', {
            ignored,
            ignoreInitial: true
        });

        const detectedEvents = [];
        watcher.on('all', (event, filePath) => {
            detectedEvents.push({ event, filePath });
        });

        await new Promise((resolve) => watcher.on('ready', resolve));

        const distTestFile = path.join(process.cwd(), 'dist', 'dev-immunity-probe.tmp');
        fs.writeFileSync(distTestFile, 'immunity probe');

        await new Promise((resolve) => setTimeout(resolve, 300));

        try {
            fs.unlinkSync(distTestFile);
        } catch (_) {}

        await new Promise((resolve) => setTimeout(resolve, 300));
        await watcher.close();

        const distDetected = detectedEvents.some((e) => e.filePath.includes('dist'));
        assert.equal(distDetected, false, 'Watcher must not emit any events for files inside dist/');
    });
});
