import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, 'dist');

describe('Landing Page Routes & Multi-Tool Domain Integrity', () => {
    test('verifies root dist/index.html contains ClashCalc Landing Portal markup', () => {
        const rootIndex = path.join(distDir, 'index.html');
        assert.equal(fs.existsSync(rootIndex), true, 'dist/index.html must exist');

        const content = fs.readFileSync(rootIndex, 'utf8');
        assert.ok(content.includes('<html lang="en">'), 'Root index must declare lang="en"');
        assert.ok(content.includes('id="landing-search-form"'), 'Must contain landing search form');
        assert.ok(content.includes('id="landing-search-input"'), 'Must contain landing search input');
        assert.ok(content.includes('id="landing-active-profile"'), 'Must contain active profile showcase');
        assert.ok(content.includes('id="landing-saved-accounts"'), 'Must contain saved accounts section');
        assert.ok(content.includes('id="landing-accounts-list"'), 'Must contain accounts list container');
        assert.ok(content.includes('href="/ore-calculator/"'), 'Must link to ore-calculator tool');
        assert.ok(content.includes('href="/hero-journey/"'), 'Must link to hero-journey tool');
        assert.ok(content.includes('src="/js/landingApp.js'), 'Must load landingApp.js');
        assert.ok(content.includes('href="/css/landing.min.css'), 'Must link to landing.min.css');
        assert.ok(content.includes('id="header-account-btn"'), 'Must contain landing account button');
        assert.ok(content.includes('id="app-account-popover"'), 'Must contain landing account popover');
        assert.ok(content.includes('id="app-accent-picker"'), 'Must contain accent picker');
        assert.ok(content.includes('class="header-placeholder"'), 'Must contain header placeholder');
        assert.ok(content.includes('landing-tool-card--damage'), 'Must contain equipment damage calculator card');
        assert.ok(content.includes('id="landing-launch-damage"'), 'Must contain launch damage calculator button');
        assert.ok(content.includes('href="/damage-calculator/"'), 'Must link to damage calculator tool');
    });

    test('verifies localized landing pages contain localized titles and tool routes', () => {
        const locales = [
            { code: 'de', expectedTitleSnippet: 'ClashCalc' },
            { code: 'tr', expectedTitleSnippet: 'ClashCalc' },
            { code: 'zh', expectedTitleSnippet: 'ClashCalc' }
        ];

        for (const { code, expectedTitleSnippet } of locales) {
            const localizedIndex = path.join(distDir, code, 'index.html');
            assert.equal(fs.existsSync(localizedIndex), true, `dist/${code}/index.html must exist`);

            const content = fs.readFileSync(localizedIndex, 'utf8');
            assert.ok(content.includes(`<html lang="${code}">`), `dist/${code}/index.html must declare lang="${code}"`);
            assert.ok(content.includes(expectedTitleSnippet), `Title must include ${expectedTitleSnippet}`);
            assert.ok(content.includes('id="landing-search-form"'), 'Must contain landing search form');
            assert.ok(content.includes('href="/ore-calculator/"') || content.includes(`href="/${code}/ore-calculator/"`), 'Must link to ore calculator');
            assert.ok(content.includes('href="/hero-journey/"') || content.includes(`href="/${code}/hero-journey/"`), 'Must link to hero journey');
            assert.ok(content.includes('landing-tool-card--damage'), `dist/${code}/index.html must contain equipment damage calculator card`);
            assert.ok(content.includes('id="landing-launch-damage"'), `dist/${code}/index.html must contain launch damage calculator button`);
        }
    });

    test('verifies standalone ore-calculator and hero-journey routes exist independently', () => {
        const oreIndex = path.join(distDir, 'ore-calculator', 'index.html');
        const hjIndex = path.join(distDir, 'hero-journey', 'index.html');

        assert.equal(fs.existsSync(oreIndex), true, 'dist/ore-calculator/index.html must exist');
        assert.equal(fs.existsSync(hjIndex), true, 'dist/hero-journey/index.html must exist');

        const oreContent = fs.readFileSync(oreIndex, 'utf8');
        const hjContent = fs.readFileSync(hjIndex, 'utf8');

        assert.ok(oreContent.includes('js/app.js'), 'Ore calculator must load app.js');
        assert.ok(hjContent.includes('js/heroJourneyApp.js'), 'Hero journey must load heroJourneyApp.js');
    });
});
