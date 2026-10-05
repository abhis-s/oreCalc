import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatDate, formatRegionalDate } from '../../js/utils/dateUtils.js';
import { formatInvoiceMonth } from '../../js/components/appSettings/settingsSupportModals.js';
import { state } from '../../js/core/state.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

test('dateFormatInvariants - Textual Month & Numeric Ambiguity Prevention Suite', async (t) => {
    const originalLanguage = state.uiSettings?.language;

    t.afterEach(() => {
        if (!state.uiSettings) {
            state.uiSettings = {};
        }
        state.uiSettings.language = originalLanguage || 'en';
    });

    const ambiguousNumericPattern = /^\d{1,2}[-/. ]\d{1,2}([-/. ]\d{2,4})?$/;
    const locales = ['en', 'de', 'tr', 'zh'];

    await t.test('formatDate never produces ambiguous numeric MM-DD or DD-MM dates across all locales', () => {
        const testDates = [
            new Date(Date.UTC(2026, 0, 5)),   // Jan 5
            new Date(Date.UTC(2026, 2, 4)),   // Mar 4
            new Date(Date.UTC(2026, 8, 25)),  // Sep 25
            new Date(Date.UTC(2026, 11, 31))  // Dec 31
        ];

        locales.forEach(loc => {
            testDates.forEach(date => {
                const formatted = formatDate(date, undefined, loc);
                assert.ok(
                    !ambiguousNumericPattern.test(formatted.trim()),
                    `formatDate(${loc}) produced ambiguous numeric date: "${formatted}"`
                );
            });
        });
    });

    await t.test('formatDate normalizes dateStyle medium/short into textual month format', () => {
        const testDate = new Date(Date.UTC(2026, 8, 25));
        locales.forEach(loc => {
            const formatted = formatDate(testDate, { dateStyle: 'medium' }, loc);
            assert.ok(
                !ambiguousNumericPattern.test(formatted.trim()),
                `dateStyle: medium in ${loc} produced numeric date: "${formatted}"`
            );
        });
    });

    await t.test('formatRegionalDate formats ISO dates with short textual month', () => {
        const testIso = '2026-08-01';
        locales.forEach(loc => {
            const formatted = formatRegionalDate(testIso, loc);
            assert.ok(
                !ambiguousNumericPattern.test(formatted.trim()),
                `formatRegionalDate in ${loc} produced numeric date: "${formatted}"`
            );
            assert.ok(formatted.includes('2026'), `formatRegionalDate in ${loc} missing year 2026`);
        });
    });

    await t.test('formatInvoiceMonth formats YYYY-MM with long textual month and year', () => {
        state.uiSettings = { language: 'en' };
        assert.equal(formatInvoiceMonth('2026-05'), 'May 2026');

        state.uiSettings = { language: 'de' };
        assert.equal(formatInvoiceMonth('2026-05'), 'Mai 2026');

        state.uiSettings = { language: 'tr' };
        assert.equal(formatInvoiceMonth('2026-05'), 'Mayıs 2026');

        state.uiSettings = { language: 'zh' };
        assert.equal(formatInvoiceMonth('2026-05'), '2026年5月');
    });

    await t.test('partials templates contain zero hardcoded raw numeric dates in user-facing spans', () => {
        const partialsDir = path.join(projectRoot, 'partials');
        const files = fs.readdirSync(partialsDir, { recursive: true })
            .filter(f => typeof f === 'string' && f.endsWith('.html'))
            .map(f => path.join(partialsDir, f));

        const numericDateInSpanRegex = /<span[^>]*>\s*\d{4}-\d{2}-\d{2}\s*<\/span>/i;

        for (const file of files) {
            const content = fs.readFileSync(file, 'utf8');
            const match = content.match(numericDateInSpanRegex);
            assert.ok(!match, `Found hardcoded raw numeric date in template ${file}: ${match ? match[0] : ''}`);
        }
    });
});
