/**
 * Feature Domain Tests for Defense Targets Boot Hygiene.
 * Validates defensive fallbacks, root-relative URL requests, idempotency,
 * and immutable caching of target definitions.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const _testDir = path.dirname(fileURLToPath(import.meta.url));
const _targetsDir = path.resolve(_testDir, '../../js/data/targets');

const requestedUrls = [];
globalThis.fetch = (url) => {
    requestedUrls.push(String(url));
    const file = String(url).split('/').pop();
    const data = JSON.parse(readFileSync(path.resolve(_targetsDir, file), 'utf8'));
    return Promise.resolve({ json: () => Promise.resolve(data) });
};

import { preloadDefensesData, getDefensesData } from '../../js/data/defenseTargetsData.js';

test('Defense Targets Boot Hygiene and Data Contract', async (t) => {
    await t.test('getDefensesData returns safe object fallback when called before resolution', () => {
        const initialData = getDefensesData();
        assert.ok(initialData !== null, 'getDefensesData must never return null');
        assert.equal(typeof initialData, 'object', 'getDefensesData must return an object');
        assert.equal(initialData.cake_a_pult, undefined, 'Accessing uninitialized defense key must yield undefined without throwing');
    });

    await t.test('preloadDefensesData requests root-relative paths and populates target dictionary', async () => {
        const promiseA = preloadDefensesData();
        const promiseB = preloadDefensesData();
        assert.equal(promiseA, promiseB, 'preloadDefensesData must be idempotent');

        await promiseA;

        assert.ok(requestedUrls.includes('/js/data/targets/buildings.json'), 'Must fetch root-relative buildings.json');
        assert.ok(requestedUrls.includes('/js/data/targets/heroes.json'), 'Must fetch root-relative heroes.json');
        assert.ok(requestedUrls.includes('/js/data/targets/guardians.json'), 'Must fetch root-relative guardians.json');

        const resolved = getDefensesData();
        assert.ok(resolved.air_defense, 'Resolved dictionary must contain canonical air_defense');
        assert.ok(resolved.town_hall, 'Resolved dictionary must contain canonical town_hall');
        assert.ok(Object.isFrozen(resolved), 'Resolved dictionary must be frozen to prevent mutation');
    });
});
