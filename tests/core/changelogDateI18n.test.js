import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { state } from '../../js/core/state.js';
import { loadTranslations } from '../../js/i18n/translator.js';
import { getChangelogHtml } from '../../js/services/changelogService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));
const deJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/de.json'), 'utf8'));
const zhJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/zh.json'), 'utf8'));

test('changelogDateI18n - getChangelogHtml localized release date rendering Suite', async (t) => {
    globalThis.fetch = async (url) => {
        if (typeof url === 'string') {
            if (url.includes('/en.json')) return { ok: true, json: async () => enJson };
            if (url.includes('/de.json')) return { ok: true, json: async () => deJson };
            if (url.includes('/zh.json')) return { ok: true, json: async () => zhJson };
        }
        return { ok: false, status: 404 };
    };

    await t.test('formats changelog release date in English', async () => {
        state.uiSettings = { language: 'en' };
        await loadTranslations('en');

        const html = getChangelogHtml();
        assert.match(html, /<span class="changelog-date">August 22, 2026<\/span>/);
    });

    await t.test('formats changelog release date in German', async () => {
        state.uiSettings = { language: 'de' };
        await loadTranslations('de');

        const html = getChangelogHtml();
        assert.match(html, /<span class="changelog-date">22\. August 2026<\/span>/);
    });

    await t.test('formats changelog release date in Simplified Chinese', async () => {
        state.uiSettings = { language: 'zh' };
        await loadTranslations('zh');

        const html = getChangelogHtml();
        assert.match(html, /<span class="changelog-date">2026年8月22日<\/span>/);
    });
});
