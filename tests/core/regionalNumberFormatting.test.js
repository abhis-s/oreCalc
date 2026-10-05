import test from 'node:test';
import assert from 'node:assert/strict';
import { formatNumber, formatCurrency } from '../../js/utils/numberFormatter.js';
import { state } from '../../js/core/state.js';

test('regionalNumberFormatting - Regional Formatting & Delimiter Suite', async (t) => {
    const originalLanguage = state.uiSettings?.language;

    t.afterEach(() => {
        if (!state.uiSettings) {
            state.uiSettings = {};
        }
        state.uiSettings.language = originalLanguage || 'en';
    });

    await t.test('formatNumber formats integers with thousands separator according to active language', () => {
        state.uiSettings = { language: 'en' };
        assert.equal(formatNumber(1092), '1,092');
        assert.equal(formatNumber(1234567), '1,234,567');
        assert.equal(formatNumber(500), '500');

        state.uiSettings = { language: 'de' };
        assert.equal(formatNumber(1092), '1.092');
        assert.equal(formatNumber(1234567), '1.234.567');
        assert.equal(formatNumber(500), '500');
    });

    await t.test('formatNumber formats decimals with regional decimal point according to active language', () => {
        state.uiSettings = { language: 'en' };
        assert.equal(formatNumber(37.5), '37.5');
        assert.equal(formatNumber(71.25), '71.25');

        state.uiSettings = { language: 'de' };
        assert.equal(formatNumber(37.5), '37,5');
        assert.equal(formatNumber(71.25), '71,25');
    });

    await t.test('formatCurrency formats currency amounts with two decimal places according to active language', () => {
        state.uiSettings = { language: 'en' };
        assert.equal(formatCurrency(1.99), '1.99');
        assert.equal(formatCurrency(12.5), '12.50');

        state.uiSettings = { language: 'de' };
        assert.equal(formatCurrency(1.99), '1,99');
        assert.equal(formatCurrency(12.5), '12,50');
    });

    await t.test('non-digit trophy string parsing correctly strips commas, dots, and non-breaking spaces across locales', () => {
        const enTrophyText = '1,092';
        const deTrophyText = '1.092';
        const frTrophyText = '1\u00A0092';
        const simpleTrophyText = '500';

        assert.equal(Number(enTrophyText.replace(/\D/g, '')), 1092);
        assert.equal(Number(deTrophyText.replace(/\D/g, '')), 1092);
        assert.equal(Number(frTrophyText.replace(/\D/g, '')), 1092);
        assert.equal(Number(simpleTrophyText.replace(/\D/g, '')), 500);
        assert.equal(Number(''.replace(/\D/g, '')) || 0, 0);
    });
});
