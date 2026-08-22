import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, migrateAppSettings } from '../../js/core/stateCleanup.js';

test('compareVersions accurately compares semantic versions', () => {
    assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
    assert.equal(compareVersions('2.1.0', '2.0.9'), 1);
    assert.equal(compareVersions('1.9.5', '2.0.0'), -1);
    assert.equal(compareVersions('v2.1.0+build123', '2.1.0'), 0);
});

test('migrateAppSettings creates normalized schema with currency object', () => {
    const oldUI = {
        currency: 'EUR',
        language: 'de',
        incomeTimeframe: 'weekly'
    };
    const migrated = migrateAppSettings(oldUI);

    assert.equal(migrated.currency.code, 'EUR');
    assert.equal(migrated.language, 'de');
    assert.equal(migrated.summaryTimeframe, 'weekly');
    assert.ok(migrated.uiTimestamps !== undefined);
});
