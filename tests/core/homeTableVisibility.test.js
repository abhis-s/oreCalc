import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { isHomeTableRowVisible } from '../../js/components/home/homeTableDisplay.js';
import { incomeData } from '../../js/data/incomeSourceRegistry.js';
import { state, getDefaultState } from '../../js/core/state.js';

describe('Home Income Table Conditional Row Filtering Suite', () => {
    beforeEach(() => {
        const fresh = getDefaultState();
        Object.keys(state).forEach(k => delete state[k]);
        Object.assign(state, fresh);
    });

    test('isHomeTableRowVisible handles missing state gracefully', () => {
        assert.equal(isHomeTableRowVisible('clanWar', null), false);
        assert.equal(isHomeTableRowVisible('clanWar', undefined), false);
        assert.equal(isHomeTableRowVisible('unknownSource', state), false);
    });

    test('guest users (DEFAULT0) always see all 12 rows even when all disabling conditions are met', () => {
        state.savedPlayerTags = ['DEFAULT0'];
        state.income.shopOffers = { selectedSet: '0' };
        state.income.gems = { packs: { shiny: 0, glowy: 0, starry: 0 } };
        state.income.supercellEvents = { worldChampionship: false };
        state.income.prospector = { goldPass: false };
        state.income.clanWar = { warsPerMonth: 0 };
        state.income.cwl = { hitsPerSeason: 0 };

        const homeTableSources = Object.keys(incomeData).filter(key => incomeData[key].showInHomeTable);
        assert.equal(homeTableSources.length, 12);

        for (const src of homeTableSources) {
            assert.equal(isHomeTableRowVisible(src, state), true, `Source ${src} must be visible for guest users`);
        }
    });

    test('tagged players conditionally hide shopOffers when Month End shop offer is set to none (0, none, null)', () => {
        state.savedPlayerTags = ['8PJYGUJC'];
        state.income.shopOffers = { selectedSet: 'newSet' };
        assert.equal(isHomeTableRowVisible('shopOffers', state), true);

        state.income.shopOffers.selectedSet = '0';
        assert.equal(isHomeTableRowVisible('shopOffers', state), false);

        state.income.shopOffers.selectedSet = 'none';
        assert.equal(isHomeTableRowVisible('shopOffers', state), false);

        state.income.shopOffers.selectedSet = null;
        assert.equal(isHomeTableRowVisible('shopOffers', state), false);

        state.income.shopOffers.selectedSet = '16';
        assert.equal(isHomeTableRowVisible('shopOffers', state), true);
    });

    test('tagged players conditionally hide gemTrader when all packs are 0, and show it when any pack > 0', () => {
        state.savedPlayerTags = ['8PJYGUJC'];
        state.income.gems = { packs: { shiny: 0, glowy: 0, starry: 0 } };
        assert.equal(isHomeTableRowVisible('gemTrader', state), false);

        state.income.gems.packs = {};
        assert.equal(isHomeTableRowVisible('gemTrader', state), false);

        state.income.gems.packs = { glowy: 1 };
        assert.equal(isHomeTableRowVisible('gemTrader', state), true);

        state.income.gems.packs = { shiny: 0, glowy: 0, starry: 3 };
        assert.equal(isHomeTableRowVisible('gemTrader', state), true);
    });

    test('tagged players conditionally hide supercellEvents when the switch is off', () => {
        state.savedPlayerTags = ['8PJYGUJC'];
        state.income.supercellEvents = { worldChampionship: true };
        assert.equal(isHomeTableRowVisible('supercellEvents', state), true);

        state.income.supercellEvents.worldChampionship = false;
        assert.equal(isHomeTableRowVisible('supercellEvents', state), false);

        delete state.income.supercellEvents.worldChampionship;
        assert.equal(isHomeTableRowVisible('supercellEvents', state), false);
    });

    test('tagged players conditionally hide prospector when Gold Pass is false', () => {
        state.savedPlayerTags = ['8PJYGUJC'];
        state.income.prospector = { goldPass: true };
        assert.equal(isHomeTableRowVisible('prospector', state), true);

        state.income.prospector.goldPass = false;
        assert.equal(isHomeTableRowVisible('prospector', state), false);

        delete state.income.prospector.goldPass;
        assert.equal(isHomeTableRowVisible('prospector', state), false);
    });

    test('tagged players conditionally hide clanWar when attacks (warsPerMonth) <= 0', () => {
        state.savedPlayerTags = ['8PJYGUJC'];
        state.income.clanWar = { warsPerMonth: 8 };
        assert.equal(isHomeTableRowVisible('clanWar', state), true);

        state.income.clanWar.warsPerMonth = 0;
        assert.equal(isHomeTableRowVisible('clanWar', state), false);

        state.income.clanWar.warsPerMonth = -1;
        assert.equal(isHomeTableRowVisible('clanWar', state), false);
    });

    test('tagged players conditionally hide cwl when attacks (hitsPerSeason) <= 0', () => {
        state.savedPlayerTags = ['8PJYGUJC'];
        state.income.cwl = { hitsPerSeason: 7 };
        assert.equal(isHomeTableRowVisible('cwl', state), true);

        state.income.cwl.hitsPerSeason = 0;
        assert.equal(isHomeTableRowVisible('cwl', state), false);

        state.income.cwl.hitsPerSeason = -2;
        assert.equal(isHomeTableRowVisible('cwl', state), false);
    });

    test('starBonus, raidMedalTrader, eventPass, eventTrader, craftPass, craftPassTrader are never hidden', () => {
        state.savedPlayerTags = ['8PJYGUJC'];
        const invariantSources = ['starBonus', 'raidMedalTrader', 'eventPass', 'eventTrader', 'craftPass', 'craftPassTrader'];
        for (const src of invariantSources) {
            assert.equal(isHomeTableRowVisible(src, state), true);
        }
    });
});
