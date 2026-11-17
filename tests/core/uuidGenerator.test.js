import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateUUID, isValidUUID } from '../../js/utils/uuidGenerator.js';

describe('UUID Generator & Validator Suite (uuidGenerator.js)', () => {
    test('generateUUID produces valid RFC 4122 version 4 UUIDs', () => {
        const id1 = generateUUID();
        const id2 = generateUUID();

        assert.equal(typeof id1, 'string');
        assert.equal(typeof id2, 'string');
        assert.notEqual(id1, id2);

        assert.equal(isValidUUID(id1), true);
        assert.equal(isValidUUID(id2), true);
        assert.equal(id1.length, 36);
        assert.equal(id2.length, 36);
    });

    test('generateUUID creates high-entropy collision-free identifiers', () => {
        const sampleSize = 100;
        const generated = new Set();
        for (let i = 0; i < sampleSize; i++) {
            const uuid = generateUUID();
            assert.equal(isValidUUID(uuid), true);
            generated.add(uuid);
        }
        assert.equal(generated.size, sampleSize);
    });

    test('isValidUUID rejects malformed, non-v4, or non-string inputs', () => {
        assert.equal(isValidUUID(null), false);
        assert.equal(isValidUUID(undefined), false);
        assert.equal(isValidUUID(''), false);
        assert.equal(isValidUUID(12345), false);
        assert.equal(isValidUUID({}), false);
        assert.equal(isValidUUID('not-a-valid-uuid'), false);

        // Version 1 UUID (should fail v4 regex check)
        const v1Uuid = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
        assert.equal(isValidUUID(v1Uuid), false);

        // Invalid variant (needs 8, 9, a, or b at variant position)
        const invalidVariant = 'c9a646d3-9c61-4cc9-783b-e44873d10660';
        assert.equal(isValidUUID(invalidVariant), false);

        // Truncated UUID
        const truncated = 'c9a646d3-9c61-4cc9-883b-e44873d1066';
        assert.equal(isValidUUID(truncated), false);
    });
});
