import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

function getAllScssFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let files = [];
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files = files.concat(getAllScssFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.scss')) {
            files.push(fullPath);
        }
    }
    return files;
}

describe('Badge System Standardization & Pulse Animation Removal', () => {
    const scssFiles = getAllScssFiles(path.join(projectRoot, 'css'));

    describe('1. Global Pulse Animation Elimination', () => {
        test('zero occurrences of @keyframes badge-pulse across all SCSS files', () => {
            for (const file of scssFiles) {
                const content = fs.readFileSync(file, 'utf8');
                assert.equal(
                    content.includes('@keyframes badge-pulse'),
                    false,
                    `File ${path.relative(projectRoot, file)} must not contain @keyframes badge-pulse`
                );
            }
        });

        test('zero occurrences of @keyframes badge-pulse-success across all SCSS files', () => {
            for (const file of scssFiles) {
                const content = fs.readFileSync(file, 'utf8');
                assert.equal(
                    content.includes('@keyframes badge-pulse-success'),
                    false,
                    `File ${path.relative(projectRoot, file)} must not contain @keyframes badge-pulse-success`
                );
            }
        });

        test('zero occurrences of @keyframes badge-scale-pulse across all SCSS files', () => {
            for (const file of scssFiles) {
                const content = fs.readFileSync(file, 'utf8');
                assert.equal(
                    content.includes('@keyframes badge-scale-pulse'),
                    false,
                    `File ${path.relative(projectRoot, file)} must not contain @keyframes badge-scale-pulse`
                );
            }
        });

        test('zero occurrences of badge-pulse or badge-scale-pulse animation declarations', () => {
            const badgePulseRegex = /animation:\s*badge-(?:pulse|scale-pulse|pulse-success)/;
            for (const file of scssFiles) {
                const content = fs.readFileSync(file, 'utf8');
                assert.equal(
                    badgePulseRegex.test(content),
                    false,
                    `File ${path.relative(projectRoot, file)} must not contain badge pulse animation declarations`
                );
            }
        });
    });

    describe('2. Income Chips Isolation', () => {
        const incomeChipsScssPath = path.join(projectRoot, 'css/components/_income-chips.scss');
        const incomeChipsContent = fs.readFileSync(incomeChipsScssPath, 'utf8');

        test('.chip-badge remains decoupled from .badge and preserves micro-pin properties', () => {
            assert.equal(
                incomeChipsContent.includes('@extend .badge'),
                false,
                '_income-chips.scss must not @extend .badge'
            );

            assert.ok(incomeChipsContent.includes('.chip-badge'));
            assert.ok(incomeChipsContent.includes('.badge-result-win'));
            assert.ok(incomeChipsContent.includes('.badge-result-loss'));
            assert.ok(incomeChipsContent.includes('.badge-result-draw'));
        });
    });

    describe('3. Settings View Badge Removal & Active Badges Preservation', () => {
        const settingsHtmlPath = path.join(projectRoot, 'partials/tabs/settings.html');
        const settingsContent = fs.readFileSync(settingsHtmlPath, 'utf8');

        test('settings.html contains zero beta-badge or new-badge elements', () => {
            assert.equal(
                settingsContent.includes('class="beta-badge"'),
                false,
                'partials/tabs/settings.html must not contain beta-badge'
            );
            assert.equal(
                settingsContent.includes('class="new-badge"'),
                false,
                'partials/tabs/settings.html must not contain new-badge'
            );
            assert.equal(
                settingsContent.includes('class="coming-soon-badge"'),
                false,
                'partials/tabs/settings.html must not contain coming-soon-badge'
            );
            assert.equal(
                settingsContent.includes('views.settings.badges.'),
                false,
                'partials/tabs/settings.html must not reference views.settings.badges translation keys'
            );
        });

        test('Active badges in Hero Journey and Stored Ores modal remain preserved', () => {
            const homeHtmlPath = path.join(projectRoot, 'partials/tabs/home.html');
            const homeContent = fs.readFileSync(homeHtmlPath, 'utf8');
            assert.ok(
                homeContent.includes('class="beta-badge" data-i18n="views.settings.badges.beta"'),
                'partials/tabs/home.html must preserve Hero Journey beta-badge'
            );

            const storedOresModalPath = path.join(projectRoot, 'partials/modals/stored-ores-modal.html');
            const storedOresContent = fs.readFileSync(storedOresModalPath, 'utf8');
            assert.ok(
                storedOresContent.includes('class="coming-soon-badge" data-i18n="views.settings.badges.comingSoon"'),
                'partials/modals/stored-ores-modal.html must preserve Auto Predict coming-soon-badge'
            );
        });
    });
});
