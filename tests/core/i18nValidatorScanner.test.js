import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const {
    getAllKeys,
    checkAlphabeticalSort,
    validateTemplateLiteral,
    scanCodebaseKeys,
    validateDomainEnumerations,
    validateDictionaries
} = require('../../scripts/validate-i18n.js');

const enFilePath = path.join(projectRoot, 'js/i18n/en.json');
const enData = JSON.parse(fs.readFileSync(enFilePath, 'utf8'));
const enKeysMap = getAllKeys(enData);
const totalEnKeys = Object.keys(enKeysMap).length;

describe('i18n Validator & Template Literal Scanner Suite', () => {

    describe('validateTemplateLiteral - Valid Namespace Patterns', () => {
        test('allows valid equipment modifier template literal', () => {
            const errors = validateTemplateLiteral(
                'views.equipment.modifiers.${mKey}',
                '/test/equipmentDetailsModalDisplay.js',
                62,
                enKeysMap
            );
            assert.deepEqual(errors, []);
        });

        test('allows valid equipment rarity template literal', () => {
            const errors = validateTemplateLiteral(
                'views.equipment.${effectiveRarity.toLowerCase()}',
                '/test/equipmentDetailsModalDisplay.js',
                135,
                enKeysMap
            );
            assert.deepEqual(errors, []);
        });

        test('allows valid equipment type template literal', () => {
            const errors = validateTemplateLiteral(
                'views.equipment.${effectiveType.toLowerCase()}',
                '/test/equipmentDetailsModalDisplay.js',
                136,
                enKeysMap
            );
            assert.deepEqual(errors, []);
        });

        test('allows valid equipment stat category template literal', () => {
            const errors = validateTemplateLiteral(
                'views.equipment.${group.category}',
                '/test/equipmentDetailsModalDisplay.js',
                1398,
                enKeysMap
            );
            assert.deepEqual(errors, []);
        });

        test('allows valid equipment item name template literal', () => {
            const errors = validateTemplateLiteral(
                'entities.equipment.${toCamelCase(equipmentName)}',
                '/test/equipmentDetailsModalDisplay.js',
                198,
                enKeysMap
            );
            assert.deepEqual(errors, []);
        });

        test('allows valid ore type template literal', () => {
            const errors = validateTemplateLiteral(
                'entities.ores.${oreType}',
                '/test/storageInputs.js',
                17,
                enKeysMap
            );
            assert.deepEqual(errors, []);
        });

        test('allows valid hero entity template literal', () => {
            const errors = validateTemplateLiteral(
                'entities.heroes.${heroKey}',
                '/test/heroPlannerCarousel.js',
                35,
                enKeysMap
            );
            assert.deepEqual(errors, []);
        });

        test('allows valid stat entity template literal', () => {
            const errors = validateTemplateLiteral(
                'entities.stats.${meta.key}',
                '/test/equipmentDetailsModalDisplay.js',
                262,
                enKeysMap
            );
            assert.deepEqual(errors, []);
        });

        test('allows valid income source title template literal', () => {
            const errors = validateTemplateLiteral(
                'views.income.${data.type}.title',
                '/test/chipFactory.js',
                118,
                enKeysMap
            );
            assert.deepEqual(errors, []);
        });
    });

    describe('validateTemplateLiteral - Semantic Misuse & Non-Existent Namespaces', () => {
        test('flags equipment rarity queried under entities.equipment.*', () => {
            const errors = validateTemplateLiteral(
                'entities.equipment.${effectiveRarity.toLowerCase()}',
                '/test/badFile.js',
                10,
                enKeysMap
            );
            assert.equal(errors.length, 1);
            assert.ok(errors[0].includes('Namespace misuse'));
            assert.ok(errors[0].includes('entities.equipment.*'));
            assert.ok(errors[0].includes('views.equipment.*'));
        });

        test('flags equipment type queried under entities.equipment.*', () => {
            const errors = validateTemplateLiteral(
                'entities.equipment.${effectiveType}',
                '/test/badFile.js',
                12,
                enKeysMap
            );
            assert.equal(errors.length, 1);
            assert.ok(errors[0].includes('Namespace misuse'));
        });

        test('flags equipment category queried under entities.equipment.*', () => {
            const errors = validateTemplateLiteral(
                'entities.equipment.${group.category}',
                '/test/badFile.js',
                15,
                enKeysMap
            );
            assert.equal(errors.length, 1);
            assert.ok(errors[0].includes('Namespace misuse'));
        });

        test('flags equipment item name queried under views.equipment.*', () => {
            const errors = validateTemplateLiteral(
                'views.equipment.${toCamelCase(equipName)}',
                '/test/badFile.js',
                20,
                enKeysMap
            );
            assert.equal(errors.length, 1);
            assert.ok(errors[0].includes('Namespace misuse'));
            assert.ok(errors[0].includes('views.equipment.*'));
            assert.ok(errors[0].includes('entities.equipment.*'));
        });

        test('flags non-existent namespace prefix', () => {
            const errors = validateTemplateLiteral(
                'entities.nonExistentDomain.${itemKey}',
                '/test/badFile.js',
                30,
                enKeysMap
            );
            assert.equal(errors.length, 1);
            assert.ok(errors[0].includes('Non-existent namespace prefix'));
            assert.ok(errors[0].includes('entities.nonExistentDomain.'));
        });

        test('flags unrecognized dynamic pattern format missing static prefix', () => {
            const errors = validateTemplateLiteral(
                '${someVariable}',
                '/test/badFile.js',
                40,
                enKeysMap
            );
            assert.equal(errors.length, 1);
            assert.ok(errors[0].includes('Unrecognized dynamic translation pattern'));
        });
    });

    describe('validateDomainEnumerations', () => {
        test('verifies all domain enumerations in canonical en.json with zero errors', () => {
            const { errors, count } = validateDomainEnumerations(enKeysMap, projectRoot);
            assert.deepEqual(errors, []);
            assert.ok(count >= 290, `Expected at least 290 domain entities/enumerations verified, got ${count}`);
        });

        test('flags missing domain enumeration when key is omitted from map', () => {
            const modifiedKeysMap = { ...enKeysMap };
            delete modifiedKeysMap['views.equipment.common'];
            delete modifiedKeysMap['entities.ores.shiny'];
            delete modifiedKeysMap['entities.heroes.dragonDuke'];

            const { errors } = validateDomainEnumerations(modifiedKeysMap, projectRoot);
            assert.equal(errors.length, 3);
            assert.ok(errors.some(e => e.includes('views.equipment.common')));
            assert.ok(errors.some(e => e.includes('entities.ores.shiny')));
            assert.ok(errors.some(e => e.includes('entities.heroes.dragonDuke')));
        });
    });

    describe('checkAlphabeticalSort', () => {
        test('passes on sorted dictionary object', () => {
            const sortedObj = {
                a: '1',
                b: {
                    c: '2',
                    d: '3'
                },
                e: '4'
            };
            const errors = checkAlphabeticalSort(sortedObj);
            assert.deepEqual(errors, []);
        });

        test('detects unsorted keys', () => {
            const unsortedObj = {
                z: '1',
                a: '2'
            };
            const errors = checkAlphabeticalSort(unsortedObj);
            assert.ok(errors.length > 0);
            assert.ok(errors[0].includes('should be after'));
        });
    });

    describe('validateDictionaries - Developer vs Community Validation Policy', () => {
        const os = require('os');

        test('validates production dictionaries with zero errors', () => {
            const i18nDir = path.join(projectRoot, 'js/i18n');
            const { hasErrors, report, errors } = validateDictionaries(i18nDir, enKeysMap, totalEnKeys, ['en', 'de', 'tr', 'zh']);
            assert.equal(hasErrors, false);
            assert.deepEqual(errors, []);
            assert.ok(report.length >= 4);
        });

        test('triggers fatal error when German (developer-maintained) has missing keys', () => {
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-test-de-'));
            try {
                fs.writeFileSync(path.join(tmpDir, 'en.json'), JSON.stringify({ a: 'Alpha', b: 'Beta' }, null, 2));
                fs.writeFileSync(path.join(tmpDir, 'de.json'), JSON.stringify({ a: 'Alpha DE' }, null, 2)); // missing 'b'

                const mockEnMap = { a: 'Alpha', b: 'Beta' };
                const { hasErrors, report } = validateDictionaries(tmpDir, mockEnMap, 2, ['en', 'de']);

                assert.equal(hasErrors, true, 'Missing keys in German must trigger hasErrors: true');
                const deReport = report.find(r => r.lang === 'de');
                assert.ok(deReport.status.includes('MISSING KEYS'));
                assert.equal(deReport.missing, 1);
            } finally {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            }
        });

        test('produces soft warning without fatal error when Turkish or Chinese (community) has missing keys', () => {
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-test-comm-'));
            try {
                fs.writeFileSync(path.join(tmpDir, 'en.json'), JSON.stringify({ a: 'Alpha', b: 'Beta' }, null, 2));
                fs.writeFileSync(path.join(tmpDir, 'de.json'), JSON.stringify({ a: 'Alpha DE', b: 'Beta DE' }, null, 2));
                fs.writeFileSync(path.join(tmpDir, 'tr.json'), JSON.stringify({ a: 'Alpha TR' }, null, 2)); // missing 'b'

                const mockEnMap = { a: 'Alpha', b: 'Beta' };
                const { hasErrors, report } = validateDictionaries(tmpDir, mockEnMap, 2, ['en', 'de', 'tr']);

                assert.equal(hasErrors, false, 'Missing keys in Turkish must NOT trigger fatal error (soft warning)');
                const trReport = report.find(r => r.lang === 'tr');
                assert.ok(trReport.status.includes('INCOMPLETE'));
                assert.equal(trReport.missing, 1);
                assert.equal(trReport.completion, '50.0%');
            } finally {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            }
        });

        test('triggers fatal error when placeholder syntax is mismatched in community language', () => {
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-test-ph-'));
            try {
                fs.writeFileSync(path.join(tmpDir, 'en.json'), JSON.stringify({ msg: 'Level {level}' }, null, 2));
                fs.writeFileSync(path.join(tmpDir, 'de.json'), JSON.stringify({ msg: 'Stufe {level}' }, null, 2));
                fs.writeFileSync(path.join(tmpDir, 'zh.json'), JSON.stringify({ msg: '等级 {wrong_param}' }, null, 2)); // broken placeholder

                const mockEnMap = { msg: 'Level {level}' };
                const { hasErrors, report, errors } = validateDictionaries(tmpDir, mockEnMap, 1, ['en', 'de', 'zh']);

                assert.equal(hasErrors, true, 'Placeholder mismatch must trigger fatal error');
                const zhReport = report.find(r => r.lang === 'zh');
                assert.ok(zhReport.status.includes('PLACEHOLDER ERROR'));
                assert.ok(errors.some(e => e.includes('Missing required placeholder {level}') || e.includes('Unexpected placeholder {wrong_param}')));
            } finally {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            }
        });
    });
});
