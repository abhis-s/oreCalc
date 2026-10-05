import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import * as appSettings from '../../js/components/common/appSettings.js';

describe('Damage Calculator Header, Base Controls & Parity Invariants', () => {
    const projectRoot = process.cwd();
    const sourceHtmlPath = path.join(projectRoot, 'damage-calculator/index.html');

    test('damage-calculator/index.html contains canonical app header shell with inner wrapper', () => {
        const content = fs.readFileSync(sourceHtmlPath, 'utf8');
        assert.ok(
            content.includes('class="app-header header-container damage-calc-page__header"'),
            'Must contain canonical app-header and header-container classes'
        );
        assert.ok(
            content.includes('class="app-header__inner header-inner damage-calc-page__header-inner"'),
            'Must contain header-inner and app-header__inner wrapper'
        );
        assert.ok(
            content.includes('class="app-header__brand header-brand damage-calc-page__brand"'),
            'Must contain app-header__brand brand lockup'
        );
        assert.ok(
            content.includes('class="brand-page-pill"'),
            'Must contain brand-page-pill tool indicator'
        );
    });

    test('damage-calculator/index.html defines desktop tabs and bottom navigation bar partial', () => {
        const content = fs.readFileSync(sourceHtmlPath, 'utf8');
        assert.ok(
            content.includes('class="app-header__tabs tab-bar-container"'),
            'Must contain desktop app-header__tabs tab-bar-container'
        );
        assert.ok(
            content.includes('<!-- include: partials/bottom-nav.html -->'),
            'Must contain partials/bottom-nav.html include for mobile navigation'
        );
        assert.ok(
            content.includes('data-tab="zapquake"'),
            'Must contain zapquake tab button'
        );
        assert.ok(
            content.includes('data-tab="cluster_planner"'),
            'Must contain cluster_planner tab button'
        );
    });

    test('damage-calculator/index.html defines village player dropdown with button and container', () => {
        const content = fs.readFileSync(sourceHtmlPath, 'utf8');
        assert.ok(
            content.includes('class="app-header__player-dropdown player-dropdown-container"'),
            'Must contain player dropdown container in header'
        );
        assert.ok(
            content.includes('id="player-dropdown-button"'),
            'Must contain #player-dropdown-button'
        );
        assert.ok(
            content.includes('id="selected-player-name"'),
            'Must contain #selected-player-name'
        );
        assert.ok(
            content.includes('id="player-dropdown-list"'),
            'Must contain #player-dropdown-list'
        );
        assert.ok(
            content.includes('id="player-items-container"'),
            'Must contain #player-items-container for saved villages'
        );
        assert.ok(
            content.includes('id="add-player-button"'),
            'Must contain #add-player-button'
        );
    });

    test('damage-calculator/index.html defines account button and popover with preferences', () => {
        const content = fs.readFileSync(path.join(projectRoot, 'partials/header-account.html'), 'utf8');
        assert.ok(
            content.includes('id="header-account-btn"'),
            'Must contain #header-account-btn'
        );
        assert.ok(
            content.includes('id="app-account-popover"'),
            'Must contain #app-account-popover'
        );
        assert.ok(
            content.includes('id="app-language-select"'),
            'Must contain #app-language-select'
        );
        assert.ok(
            content.includes('class="switch theme-switch"'),
            'Must contain theme-switch wrapper'
        );
        assert.ok(
            content.includes('id="app-accent-picker"'),
            'Must contain #app-accent-picker'
        );
    });

    test('damage-calculator/index.html includes necessary modals and layout placeholder', () => {
        const content = fs.readFileSync(sourceHtmlPath, 'utf8');
        assert.ok(
            content.includes('class="header-placeholder app-header-placeholder"'),
            'Must contain header-placeholder to prevent content clipping under fixed header'
        );
        assert.ok(
            content.includes('partials/modals/add-player.html'),
            'Must include add-player modal partial'
        );
        assert.ok(
            content.includes('partials/modals/changelog.html'),
            'Must include changelog modal partial'
        );
        assert.ok(
            content.includes('partials/modals/commits.html'),
            'Must include commits modal partial'
        );
        assert.ok(
            content.includes('partials/modals/privacy.html'),
            'Must include privacy modal partial'
        );
        assert.ok(
            content.includes('partials/modals/terms.html'),
            'Must include terms modal partial'
        );
        assert.ok(
            content.includes('partials/modals/notice.html'),
            'Must include notice modal partial'
        );
    });

    test('appSettings.js provides dedicated settings engine', () => {
        assert.equal(typeof appSettings.getAppSettings, 'function', 'Must export getAppSettings');
        assert.equal(typeof appSettings.initAppSettings, 'function', 'Must export initAppSettings');
        assert.equal(typeof appSettings.injectSettingsContent, 'function', 'Must export injectSettingsContent');
    });
});
