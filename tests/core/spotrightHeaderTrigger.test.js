import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initSpotrightHeaderTrigger } from '../../js/components/spotright/spotrightController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

describe('Spotright Header Trigger Button Suite', () => {
    /** @type {any} */
    let originalDocument;

    beforeEach(() => {
        originalDocument = globalThis.document;
    });

    afterEach(() => {
        globalThis.document = originalDocument;
    });

    test('partials/header-spotright.html adheres to Option 3 segmented keycap structure and invariants', () => {
        const partialPath = path.join(projectRoot, 'partials/header-spotright.html');
        const content = fs.readFileSync(partialPath, 'utf8');

        assert.match(content, /id="header-spotright-btn"/, 'Header button must have id header-spotright-btn');
        assert.match(content, /class="[^"]*header-spotright-btn[^"]*"/, 'Header button must have class header-spotright-btn');
        assert.match(content, /<clashcalc-assets-svg name="travel-explore"/, 'Must contain travel-explore search icon');
        assert.match(content, /class="header-spotright-label"/, 'Must contain header-spotright-label container');
        assert.match(content, /data-i18n="actions\.search"/, 'Label must bind to canonical actions.search translation key');
        assert.match(content, /class="header-spotright-keys"[^>]*aria-hidden="true"/, 'Keys container must be aria-hidden for screen reader cleanliness');
        assert.match(content, /id="header-spotright-mod-key"/, 'Modifier key must have id header-spotright-mod-key');
        assert.match(content, /<clashcalc-assets-svg name="keyboard-command"/, 'Default template must use vector SVG command icon adhering to Rule 3');
        assert.match(content, /class="[^"]*header-spotright-key--letter[^"]*">K<\/kbd>/, 'Letter keycap must render K');

        // Rule 3: Zero prohibited dingbats or emojis
        const prohibitedPattern = /[\u2190-\u21FF\u2500-\u257F\u25A0-\u25FF\u2600-\u26FF\u2700-\u27BF\u2022]/u;
        assert.equal(prohibitedPattern.test(content), false, 'header-spotright.html must contain zero prohibited dingbats');
    });

    test('i18n dictionaries define canonical actions.search key with German parity', () => {
        const enPath = path.join(projectRoot, 'js/i18n/en.json');
        const dePath = path.join(projectRoot, 'js/i18n/de.json');
        const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
        const de = JSON.parse(fs.readFileSync(dePath, 'utf8'));

        assert.equal(en.actions?.search, 'Search', 'en.json must contain actions.search = "Search"');
        assert.equal(de.actions?.search, 'Suchen', 'de.json must contain actions.search = "Suchen"');
    });

    test('initSpotrightHeaderTrigger dynamically adapts keycap and title for macOS', () => {
        /** @type {Record<string, any>} */
        const elements = {
            'header-spotright-mod-key': {
                className: '',
                innerHTML: '',
                textContent: ''
            },
            'header-spotright-btn': {
                title: ''
            }
        };

        // @ts-ignore
        globalThis.document = {
            getElementById(id) {
                return elements[id] || null;
            }
        };

        initSpotrightHeaderTrigger(true);

        const modKey = elements['header-spotright-mod-key'];
        const btn = elements['header-spotright-btn'];

        assert.match(modKey.innerHTML, /name="keyboard-command"/, 'Mac must render keyboard-command SVG');
        assert.equal(modKey.className, 'header-spotright-key', 'Mac must use standard key class');
        assert.match(btn.title, /⌘K/, 'Tooltip must indicate ⌘K on macOS');
    });

    test('initSpotrightHeaderTrigger dynamically adapts keycap and title for Windows and Linux', () => {
        /** @type {Record<string, any>} */
        const elements = {
            'header-spotright-mod-key': {
                className: '',
                innerHTML: '',
                textContent: ''
            },
            'header-spotright-btn': {
                title: ''
            }
        };

        // @ts-ignore
        globalThis.document = {
            getElementById(id) {
                return elements[id] || null;
            }
        };

        initSpotrightHeaderTrigger(false);

        const modKey = elements['header-spotright-mod-key'];
        const btn = elements['header-spotright-btn'];

        assert.equal(modKey.textContent, 'Ctrl', 'Non-Mac must render text "Ctrl"');
        assert.match(modKey.className, /header-spotright-key--ctrl/, 'Non-Mac must apply --ctrl sizing modifier');
        assert.match(btn.title, /Ctrl\+K/, 'Tooltip must indicate Ctrl+K on non-Mac');
    });

    test('initSpotrightHeaderTrigger degrades safely when DOM elements are null or missing', () => {
        // @ts-ignore
        globalThis.document = {
            getElementById() {
                return null;
            }
        };

        assert.doesNotThrow(() => {
            initSpotrightHeaderTrigger(true);
            initSpotrightHeaderTrigger(false);
        }, 'Should safely handle null DOM without crashing');
    });
});
