/**
 * Test Suite: Building Asset Integrity
 * Feature Domain: Static Game Assets & Defenses Registry
 *
 * Verifies that all 29 Home Village structures defined in getDefensesData().js have
 * complete, valid, non-zero-byte asset files in assets/buildings/<id>/level_<N>.png,
 * and that all heroes and guardians have valid asset files.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const _testDir = path.dirname(fileURLToPath(import.meta.url));
const _targetsDir = path.resolve(_testDir, '../../js/data/targets');
globalThis.fetch = (url) => {
    const file = String(url).split('/').pop();
    const data = JSON.parse(readFileSync(path.resolve(_targetsDir, file), 'utf8'));
    return Promise.resolve({ json: () => Promise.resolve(data) });
};

import { preloadDefensesData, getDefensesData } from '../../js/data/defenseTargetsData.js';
import { getBuildingAssetUrl } from '../../js/core/buildingAssetHelper.js';
await preloadDefensesData();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const BUILDINGS_ASSETS_DIR = path.join(REPO_ROOT, 'assets/buildings');

test('Building Assets - Directory exists for all 29 canonical defenses and structures', () => {
    assert.ok(fs.existsSync(BUILDINGS_ASSETS_DIR), 'assets/buildings directory must exist');

    const buildingEntries = Object.entries(getDefensesData()).filter(([_, d]) => d.category !== 'hero' && d.category !== 'guardian');
    assert.strictEqual(buildingEntries.length, 29, 'getDefensesData() must contain exactly 29 building structures');
    assert.strictEqual(Object.hasOwn(getDefensesData(), 'blacksmith'), false, 'getDefensesData() must not contain blacksmith');
    assert.strictEqual(Object.hasOwn(getDefensesData(), 'walls'), false, 'getDefensesData() must not contain walls');

    for (const [key] of buildingEntries) {
        const dirPath = path.join(BUILDINGS_ASSETS_DIR, key);
        assert.ok(
            fs.existsSync(dirPath),
            `Asset directory for building "${key}" must exist at ${dirPath}`
        );
        const stat = fs.statSync(dirPath);
        assert.ok(stat.isDirectory(), `Path for "${key}" must be a directory`);
    }
});

test('Building Assets - Every level from 1 to maxLevel resolves to a non-zero size asset via getBuildingAssetUrl', () => {
    const buildingEntries = Object.entries(getDefensesData()).filter(([_, d]) => d.category !== 'hero' && d.category !== 'guardian');
    for (const [key, def] of buildingEntries) {
        const maxLvl = def.maxLevel || 1;

        for (let lvl = 1; lvl <= maxLvl; lvl++) {
            const assetUrl = getBuildingAssetUrl(key, lvl);
            assert.ok(assetUrl, `Asset URL for "${key}" level ${lvl} must not be empty`);
            const filePath = path.join(REPO_ROOT, assetUrl.replace(/^\//, ''));
            assert.ok(
                fs.existsSync(filePath),
                `Building "${key}" level ${lvl} resolved asset must exist at ${filePath}`
            );

            const stat = fs.statSync(filePath);
            assert.ok(
                stat.size > 0,
                `Building "${key}" level ${lvl} asset must have non-zero file size (found ${stat.size} bytes)`
            );
        }
    }
});

test('Crafted Building Assets - Tier fallback resolves intermediate levels to anchor assets (1, 4, 7, 10)', () => {
    const craftedKeys = ['cake_a_pult', 'hero_hunter', 'hot_candle'];
    for (const key of craftedKeys) {
        assert.strictEqual(getBuildingAssetUrl(key, 1), `/assets/buildings/${key}/level_1.png`);
        assert.strictEqual(getBuildingAssetUrl(key, 2), `/assets/buildings/${key}/level_1.png`);
        assert.strictEqual(getBuildingAssetUrl(key, 3), `/assets/buildings/${key}/level_1.png`);
        assert.strictEqual(getBuildingAssetUrl(key, 4), `/assets/buildings/${key}/level_4.png`);
        assert.strictEqual(getBuildingAssetUrl(key, 5), `/assets/buildings/${key}/level_4.png`);
        assert.strictEqual(getBuildingAssetUrl(key, 6), `/assets/buildings/${key}/level_4.png`);
        assert.strictEqual(getBuildingAssetUrl(key, 7), `/assets/buildings/${key}/level_7.png`);
        assert.strictEqual(getBuildingAssetUrl(key, 8), `/assets/buildings/${key}/level_7.png`);
        assert.strictEqual(getBuildingAssetUrl(key, 9), `/assets/buildings/${key}/level_7.png`);
        assert.strictEqual(getBuildingAssetUrl(key, 10), `/assets/buildings/${key}/level_10.png`);
    }
});

test('Hero & Guardian Assets - All hero and guardian assets exist with non-zero size', () => {
    const heroKeys = ['barbarian_king', 'archer_queen', 'grand_warden', 'royal_champion', 'minion_prince', 'dragon_duke'];
    for (const key of heroKeys) {
        assert.ok(getDefensesData()[key], `Hero "${key}" must exist in getDefensesData()`);
        const url = getBuildingAssetUrl(key, 1);
        assert.ok(url.startsWith('/assets/heroes/'), `Hero url must point to /assets/heroes/`);
        const fullPath = path.join(REPO_ROOT, url.replace(/^\//, ''));
        assert.ok(fs.existsSync(fullPath), `Hero asset must exist at ${fullPath}`);
        assert.ok(fs.statSync(fullPath).size > 0, `Hero asset must be non-zero size`);
    }

    const guardianKeys = ['smasher', 'logger', 'longshot'];
    for (const key of guardianKeys) {
        assert.ok(getDefensesData()[key], `Guardian "${key}" must exist in getDefensesData()`);
        const url = getBuildingAssetUrl(key, 1);
        assert.ok(url.startsWith('/assets/guardians/'), `Guardian url must point to /assets/guardians/`);
        const fullPath = path.join(REPO_ROOT, url.replace(/^\//, ''));
        assert.ok(fs.existsSync(fullPath), `Guardian asset must exist at ${fullPath}`);
        assert.ok(fs.statSync(fullPath).size > 0, `Guardian asset must be non-zero size`);
    }
});
