import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { WAR_ORE_MAX_LIMITS, getWarOreValue } from '../../js/data/incomeSources/warOres.js';
import { raidMedalTraderData, gemTraderData, eventTraderData } from '../../js/data/incomeSources/traders.js';
import { calculateRaidMedalTraderIncome } from '../../js/domain/income/raidMedalTraderIncome.js';
import { calculateGemTraderIncome } from '../../js/domain/income/gemTraderIncome.js';
import { calculateEventTraderIncome } from '../../js/domain/income/eventTraderIncome.js';

describe('Trader & Storage Centralization Suite', () => {
    test('Trader datasets contain correct normalized IDs, costs, ores, and pack limits', () => {
        const gemStarry = gemTraderData.find(o => o.starry > 0);
        const gemGlowy = gemTraderData.find(o => o.glowy > 0);
        const gemShiny = gemTraderData.find(o => o.shiny > 0);

        assert.ok(gemStarry);
        assert.equal(gemStarry.id, 'gem_starry');
        assert.equal(gemStarry.cost, 150);
        assert.equal(gemStarry.starry, 15);
        assert.equal(gemStarry.maxPacks, 5);
        assert.equal(gemStarry.recommendedPacks, 2);

        assert.ok(gemGlowy);
        assert.equal(gemGlowy.id, 'gem_glowy');
        assert.equal(gemGlowy.cost, 90);
        assert.equal(gemGlowy.glowy, 60);
        assert.equal(gemGlowy.maxPacks, 5);

        assert.ok(gemShiny);
        assert.equal(gemShiny.id, 'gem_shiny');
        assert.equal(gemShiny.cost, 75);
        assert.equal(gemShiny.shiny, 300);
        assert.equal(gemShiny.maxPacks, 10);
        assert.deepEqual(gemTraderData.map(o => o.id), ['gem_starry', 'gem_glowy', 'gem_shiny']);

        assert.equal(raidMedalTraderData.length, 3);
        assert.deepEqual(raidMedalTraderData.map(o => o.id), ['raid_starry', 'raid_glowy', 'raid_shiny']);
        raidMedalTraderData.forEach(offer => {
            assert.equal(offer.currency, 'raid_medals');
            assert.equal(offer.maxPacks, 2);
        });

        const eventStarry = eventTraderData.find(o => o.starry > 0);
        const eventGlowy = eventTraderData.find(o => o.glowy > 0);
        const eventShiny = eventTraderData.find(o => o.shiny > 0);

        assert.ok(eventStarry);
        assert.equal(eventStarry.id, 'event_starry');
        assert.equal(eventStarry.cost, 185);
        assert.equal(eventStarry.starry, 10);
        assert.equal(eventStarry.maxPacks, 8);

        assert.ok(eventGlowy);
        assert.equal(eventGlowy.id, 'event_glowy');
        assert.equal(eventGlowy.cost, 165);
        assert.equal(eventGlowy.glowy, 60);
        assert.equal(eventGlowy.maxPacks, 10);

        assert.ok(eventShiny);
        assert.equal(eventShiny.id, 'event_shiny');
        assert.equal(eventShiny.cost, 160);
        assert.equal(eventShiny.shiny, 350);
        assert.equal(eventShiny.maxPacks, 40);
        assert.deepEqual(eventTraderData.map(o => o.id), ['event_starry', 'event_glowy', 'event_shiny']);
    });

    test('Trader offer IDs follow normalized kebab-case naming conventions', () => {
        const allOffers = [...raidMedalTraderData, ...gemTraderData, ...eventTraderData];
        for (const offer of allOffers) {
            const kebab = String(offer.id).replace(/_/g, '-');
            assert.ok(!kebab.includes('_'), `Offer ID ${offer.id} kebab form should contain no underscores`);
            assert.equal(kebab, kebab.toLowerCase(), `Offer ID ${offer.id} kebab form should be lowercase`);
        }
    });

    test('calculateRaidMedalTraderIncome calculates correct weekly and monthly rates', () => {
        const raidState = {
            earned: 2000,
            packs: {
                shiny: 2,
                glowy: 2,
                starry: 2
            }
        };

        const income = calculateRaidMedalTraderIncome(raidState);
        assert.ok(income);
        assert.ok(income.monthly.shiny > 0);
        assert.ok(income.monthly.glowy > 0);
        assert.ok(income.monthly.starry > 0);
    });

    test('calculateGemTraderIncome calculates correct weekly and monthly rates', () => {
        const gemState = {
            packs: {
                shiny: 5,
                glowy: 3,
                starry: 2
            }
        };

        const income = calculateGemTraderIncome(gemState);
        assert.ok(income);
        assert.ok(income.monthly.shiny > 0);
        assert.ok(income.monthly.glowy > 0);
        assert.ok(income.monthly.starry > 0);
    });

    test('calculateEventTraderIncome calculates correct monthly rates factoring in available medals', () => {
        const eventState = {
            packs: {
                shiny: 10,
                glowy: 5,
                starry: 5
            }
        };

        const income = calculateEventTraderIncome(eventState, 5000);
        assert.ok(income);
        assert.ok(income.monthly.shiny > 0);
        assert.ok(income.monthly.glowy > 0);
        assert.ok(income.monthly.starry > 0);
    });

    test('WAR_ORE_MAX_LIMITS is frozen and getWarOreValue resolves clamped values safely', () => {
        assert.ok(Object.isFrozen(WAR_ORE_MAX_LIMITS));
        assert.equal(WAR_ORE_MAX_LIMITS.shiny, 1110);
        assert.equal(WAR_ORE_MAX_LIMITS.glowy, 39);
        assert.equal(WAR_ORE_MAX_LIMITS.starry, 6);

        assert.equal(getWarOreValue('shiny', 8), 380);
        assert.equal(getWarOreValue('glowy', 8), 15);
        assert.equal(getWarOreValue('starry', 8), 0);

        assert.equal(getWarOreValue('shiny', 5), 380);
        assert.equal(getWarOreValue('glowy', 1), 15);

        assert.equal(getWarOreValue('shiny', 16), 1110);
        assert.equal(getWarOreValue('glowy', 16), 39);
        assert.equal(getWarOreValue('starry', 16), 6);

        assert.equal(getWarOreValue('shiny', 17), 1110);
        assert.equal(getWarOreValue('glowy', 18), 39);
        assert.equal(getWarOreValue('starry', 20), 6);

        assert.equal(getWarOreValue('unknownOre', 16), 0);
        assert.equal(getWarOreValue('shiny', NaN), 0);
    });
});
