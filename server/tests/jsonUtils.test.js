const { test } = require('node:test');
const assert = require('node:assert/strict');

const { safeJsonParse } = require('../utils/jsonUtils.js');

test('safeJsonParse parses valid JSON strings accurately', () => {
    const result = safeJsonParse('{"appVersion":"2.1.0","active":true}');
    assert.deepEqual(result, { appVersion: '2.1.0', active: true });
});

test('safeJsonParse returns fallback when input is invalid or corrupted JSON', () => {
    assert.equal(safeJsonParse('{invalid json', null), null);
    assert.equal(safeJsonParse('undefined', 'DEFAULT'), 'DEFAULT');
    assert.deepEqual(safeJsonParse('', {}), {});
    assert.deepEqual(safeJsonParse(null, []), []);
    assert.deepEqual(safeJsonParse(undefined, { fallback: true }), { fallback: true });
});

test('safeJsonParse parses primitive valid JSON values', () => {
    assert.equal(safeJsonParse('123'), 123);
    assert.equal(safeJsonParse('"hello"'), 'hello');
    assert.equal(safeJsonParse('true'), true);
});
