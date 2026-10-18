import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSpotrightDialog } from '../../js/components/spotright/spotrightDisplay.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

describe('Spotright Brand & Beta Indicator Suite', () => {
    /** @type {any} */
    let originalDocument;

    beforeEach(() => {
        originalDocument = globalThis.document;
    });

    afterEach(() => {
        globalThis.document = originalDocument;
    });

    test('createSpotrightDialog generates footer brand lockup with Spotright label and Beta chip', () => {
        /** @type {Record<string, any>} */
        const mockDialog = {
            id: '',
            className: '',
            innerHTML: '',
            setAttribute(name, value) {
                this[name] = value;
            }
        };

        // @ts-ignore
        globalThis.document = {
            createElement(tag) {
                if (tag === 'dialog') return mockDialog;
                return {};
            }
        };

        const dialog = createSpotrightDialog();
        const html = dialog.innerHTML;

        assert.match(html, /class="spotright-footer-brand"/, 'Must contain spotright-footer-brand container');
        assert.match(html, /class="spotright-footer-brand-name">Spotright<\/span>/, 'Must render Spotright brand label');
        assert.match(html, /class="spotright-footer-beta-chip"[^>]*data-i18n="views\.spotright\.beta"/, 'Beta chip must bind to views.spotright.beta');
        assert.match(html, /data-i18n-title="views\.spotright\.betaTooltip"/, 'Brand lockup must bind to views.spotright.betaTooltip');

        // Rule 3: Zero prohibited dingbats or emojis
        const prohibitedPattern = /[\u2190-\u21FF\u2500-\u257F\u25A0-\u25FF\u2600-\u26FF\u2700-\u27BF\u2022]/u;
        assert.equal(prohibitedPattern.test(html), false, 'Spotright dialog markup must contain zero prohibited dingbats');
    });

    test('i18n dictionaries define canonical views.spotright.beta and betaTooltip keys with German parity', () => {
        const enPath = path.join(projectRoot, 'js/i18n/en.json');
        const dePath = path.join(projectRoot, 'js/i18n/de.json');
        const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
        const de = JSON.parse(fs.readFileSync(dePath, 'utf8'));

        assert.equal(en.views?.spotright?.beta, 'Beta', 'en.json must contain views.spotright.beta = "Beta"');
        assert.equal(de.views?.spotright?.beta, 'Beta', 'de.json must contain views.spotright.beta = "Beta"');

        assert.ok(en.views?.spotright?.betaTooltip, 'en.json must contain views.spotright.betaTooltip');
        assert.ok(de.views?.spotright?.betaTooltip, 'de.json must contain views.spotright.betaTooltip');
    });
});
