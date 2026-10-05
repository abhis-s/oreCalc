import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const require = createRequire(import.meta.url);
const {
    getAllKeys,
    ALLOWED_DUPLICATE_KEYS,
    findDuplicateEnStrings
} = require('../../scripts/validate-i18n.js');

describe('en.json Canonical Duplicate String Value Prevention', () => {
    const enFilePath = path.join(projectRoot, 'js/i18n/en.json');
    const enData = JSON.parse(fs.readFileSync(enFilePath, 'utf8'));
    const enKeysMap = getAllKeys(enData);

    test('prohibits adding unallowed duplicate string values to en.json', () => {
        const { unauthorizedDuplicates } = findDuplicateEnStrings(enKeysMap, ALLOWED_DUPLICATE_KEYS);

        if (unauthorizedDuplicates.length > 0) {
            const errorDetails = unauthorizedDuplicates.map(dup => {
                return `  - Value "${dup.value}" is shared by [${dup.collidingKeys.join(', ')}]. Unauthorized keys: [${dup.unallowedKeys.join(', ')}]`;
            }).join('\n');

            assert.fail(
                `Detected ${unauthorizedDuplicates.length} unauthorized duplicate string value(s) in en.json:\n${errorDetails}\n\n` +
                'Rule: Never add duplicate strings to en.json. Reuse the existing canonical key.\n' +
                'If this is a verified cross-lingual false friend (e.g. noun vs verb, different words in German/Turkish/Chinese), ' +
                'register the key in ALLOWED_DUPLICATE_KEYS in scripts/validate-i18n.js with linguistic justification.'
            );
        }

        assert.equal(unauthorizedDuplicates.length, 0);
    });

    test('verifies allowlist hygiene (no stale or single-key entries)', () => {
        const valueToKeys = {};
        for (const [key, rawVal] of Object.entries(enKeysMap)) {
            if (typeof rawVal !== 'string') continue;
            const val = rawVal.trim();
            if (!valueToKeys[val]) {
                valueToKeys[val] = [];
            }
            valueToKeys[val].push(key);
        }

        for (const [key, rationale] of Object.entries(ALLOWED_DUPLICATE_KEYS)) {
            assert.ok(key in enKeysMap, `Allowlist entry "${key}" does not exist in en.json.`);
            assert.ok(rationale && rationale.length > 5, `Allowlist entry "${key}" must provide a descriptive justification.`);

            const val = enKeysMap[key];
            const sharingKeys = valueToKeys[val] || [];
            assert.ok(
                sharingKeys.length > 1,
                `Allowlist entry "${key}" with value "${val}" is not actually a duplicate in en.json. Remove stale allowlist entry.`
            );
        }
    });

    test('prohibits accidental case-insensitive discrepancies in en.json', () => {
        const { caseDiscrepancies } = findDuplicateEnStrings(enKeysMap, ALLOWED_DUPLICATE_KEYS);

        if (caseDiscrepancies.length > 0) {
            const details = caseDiscrepancies.map(d => {
                return `  - Casing conflict for "${d.lower}": variations [${d.variations.join(', ')}] across keys: ${d.keys.join(', ')}`;
            }).join('\n');
            assert.fail(`Detected accidental case variations in en.json:\n${details}`);
        }

        assert.equal(caseDiscrepancies.length, 0);
    });
});
