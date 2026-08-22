import test from 'node:test';
import assert from 'node:assert/strict';
import { safeJsonParse } from '../../js/utils/jsonUtils.js';

test('jsonUtils - safeJsonParse Suite', async (t) => {
    await t.test('parses valid JSON strings correctly', () => {
        const obj = { id: 'test', val: 123 };
        const parsed = safeJsonParse(JSON.stringify(obj));
        assert.deepEqual(parsed, obj);
    });

    await t.test('parses valid JSON arrays correctly', () => {
        const arr = ['tag1', 'tag2', 'tag3'];
        const parsed = safeJsonParse(JSON.stringify(arr));
        assert.deepEqual(parsed, arr);
    });

    await t.test('returns fallback on null, undefined, or empty string', () => {
        assert.equal(safeJsonParse(null, 'default'), 'default');
        assert.equal(safeJsonParse(undefined, 'default'), 'default');
        assert.equal(safeJsonParse('', 'default'), 'default');
        assert.equal(safeJsonParse('   ', 'default'), 'default');
    });

    await t.test('returns fallback on non-string inputs', () => {
        assert.equal(safeJsonParse(12345, null), null);
        assert.equal(safeJsonParse({}, null), null);
        assert.equal(safeJsonParse(true, 'fallback'), 'fallback');
    });

    await t.test('returns fallback on malformed JSON without throwing', () => {
        assert.equal(safeJsonParse('{ id: invalid json }', null), null);
        assert.equal(safeJsonParse('{"incomplete":', 'fallback'), 'fallback');
        assert.equal(safeJsonParse('undefined', null), null);
    });
});
