import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTranslations } from '../../js/i18n/translator.js';
import { getButtonHotkey, renderPopoverContent } from '../../js/utils/inputPopoverRenderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));

test('inputPopoverRenderer - renderPopoverContent & getButtonHotkey Suite', async (t) => {
    globalThis.fetch = async (url) => {
        if (typeof url === 'string' && url.includes('/en.json')) return { ok: true, json: async () => enJson };
        return { ok: false, status: 404 };
    };
    await loadTranslations('en');
    await t.test('resolves hotkeys correctly for custom, disable, and generic buttons', () => {
        assert.equal(getButtonHotkey({ hotkey: 'k' }, 'Custom Label'), 'k');
        assert.equal(getButtonHotkey({}, 'Disable'), 'd');
        assert.equal(getButtonHotkey({}, 'Deaktivieren'), 'd');
        assert.equal(getButtonHotkey({}, 'Enable'), 'd');
        assert.equal(getButtonHotkey({}, 'Min'), null);
    });

    await t.test('renders default min button with N hotkey when no custom minLabel is provided', () => {
        const html = renderPopoverContent({
            val: 5,
            recVal: 0,
            currMin: 0,
            currMax: 10,
            showTitle: false,
            showRange: false,
            showMin: true,
            showMax: false,
            showRecNow: false,
            enableValidationColoring: true,
            clickToFill: { min: true },
            allowHotkeys: true,
            customButtons: []
        });

        assert.match(html, /data-action="min"/);
        assert.match(html, />Min <kbd class="popover-key-badge">N<\/kbd></);
        assert.match(html, /<strong>0<\/strong>/);
    });

    await t.test('renders customized min button with D hotkey when minLabel is Disable', () => {
        const html = renderPopoverContent({
            val: 5,
            recVal: 0,
            currMin: 0,
            currMax: 10,
            showTitle: false,
            showRange: false,
            showMin: true,
            minLabel: 'Disable',
            showMax: false,
            showRecNow: false,
            enableValidationColoring: true,
            clickToFill: { min: true },
            allowHotkeys: true,
            customButtons: []
        });

        assert.match(html, /data-action="min"/);
        assert.match(html, />Disable <kbd class="popover-key-badge">D<\/kbd></);
        assert.match(html, /<strong>0<\/strong>/);
    });

    await t.test('renders customized max button when maxLabel is provided', () => {
        const html = renderPopoverContent({
            val: 5,
            recVal: 0,
            currMin: 0,
            currMax: 10,
            showTitle: false,
            showRange: false,
            showMin: false,
            showMax: true,
            maxLabel: 'Max Limit',
            showRecNow: false,
            enableValidationColoring: true,
            clickToFill: { max: true },
            allowHotkeys: true,
            customButtons: []
        });

        assert.match(html, /data-action="max"/);
        assert.match(html, />Max Limit <kbd class="popover-key-badge">X<\/kbd></);
        assert.match(html, /<strong>10<\/strong>/);
    });
});
