import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getEquipmentUpgradeCost } from '../../js/data/equipmentCommonData.js';
import {
    convertOres,
    getStepValue,
    findOptimalConversionSchedule,
    getProspectorConversions,
    getProspectorIncomeForDate,
    calculateProspectorIncome,
    getUpgradeRequirements
} from '../../js/domain/income/prospectorManager.js';

describe('Prospector Manager Domain Suite', () => {
    test('convertOres returns same amount when converting between same ore types', () => {
        assert.equal(convertOres('shiny', 'shiny', 500), 500);
        assert.equal(convertOres('glowy', 'glowy', 100), 100);
        assert.equal(convertOres('starry', 'starry', 20), 20);
    });

    test('convertOres converts from shiny to glowy correctly', () => {
        const converted = convertOres('shiny', 'glowy', 500);
        assert.ok(converted > 0 && converted < 500);
    });

    test('convertOres converts from glowy to starry correctly', () => {
        const converted = convertOres('glowy', 'starry', 100);
        assert.ok(converted > 0 && converted < 100);
    });

    test('getStepValue returns expected discrete step increments', () => {
        const shinyToGlowy = getStepValue('shiny', 'glowy');
        assert.ok(shinyToGlowy > 0);
        const glowyToStrry = getStepValue('glowy', 'starry');
        assert.ok(glowyToStrry > 0);
    });

    test('findOptimalConversionSchedule suggests conversions to satisfy ore bottlenecks', () => {
        const req = { shiny: 0, glowy: 5000, starry: 500 };
        const stored = { shiny: 50000, glowy: 0, starry: 0 };
        const baseIncome = { shiny: 1000, glowy: 10, starry: 1 };

        const schedule = findOptimalConversionSchedule(req, stored, baseIncome);
        assert.ok(schedule);
        assert.ok(Array.isArray(schedule.conversions));
    });

    test('getProspectorConversions resolves manual settings when assistedConversion is false', () => {
        const state = {
            income: {
                prospector: {
                    goldPass: true,
                    assistedConversion: false,
                    fromOre: 'shiny',
                    toOre: 'glowy',
                    fromAmount: 500
                }
            }
        };

        const convs = getProspectorConversions(state);
        assert.equal(convs.length, 1);
        assert.equal(convs[0].from, 'shiny');
        assert.equal(convs[0].to, 'glowy');
        assert.equal(convs[0].days, 30);
    });

    test('getProspectorIncomeForDate clamps day 31 safely to day 29', () => {
        const state = {
            income: {
                prospector: {
                    goldPass: true,
                    assistedConversion: false,
                    fromOre: 'shiny',
                    toOre: 'glowy',
                    fromAmount: 500
                }
            },
            derived: {
                requiredOres: { shiny: 0, glowy: 1000, starry: 0 }
            }
        };

        const day1 = new Date('2026-05-01T12:00:00Z');
        const day31 = new Date('2026-05-31T12:00:00Z');

        const inc1 = getProspectorIncomeForDate(day1, state);
        const inc31 = getProspectorIncomeForDate(day31, state);

        assert.equal(inc1.shiny, -500);
        assert.ok(inc1.glowy > 0);
        // Day 31 must clamp to last index and not throw or return NaN
        assert.equal(inc31.shiny, -500);
        assert.ok(inc31.glowy > 0);
    });

    test('calculateProspectorIncome computes monthly net changes', () => {
        const prospectorState = {
            goldPass: true,
            assistedConversion: false,
            fromOre: 'shiny',
            toOre: 'glowy',
            fromAmount: 500
        };

        const result = calculateProspectorIncome(prospectorState);
        assert.ok(result.monthly);
        assert.equal(result.monthly.shiny, -500 * 30);
        assert.ok(result.monthly.glowy > 0);
    });

    test('getUpgradeRequirements resolves custom comingSoon Legendary item and deducts Craft Pass Lv 15 start level', () => {
        const appState = {
            heroes: {
                barbarianKing: {
                    equipment: {
                        comingSoon: {
                            level: 15,
                            checked: true,
                            type: 'legendary',
                            isCustom: true
                        }
                    }
                }
            }
        };
        const items = [
            { heroName: 'barbarianKing', name: 'Coming Soon', targetLevel: 18 }
        ];

        const req = getUpgradeRequirements(items, false, appState);
        let expectedShiny = 0;
        let expectedGlowy = 0;
        let expectedStarry = 0;
        for (let lvl = 16; lvl <= 18; lvl++) {
            const c = getEquipmentUpgradeCost(lvl, 'legendary', 'modern');
            expectedShiny += c.shiny || 0;
            expectedGlowy += c.glowy || 0;
            expectedStarry += c.starry || 0;
        }
        assert.deepEqual(req, {
            shiny: expectedShiny,
            glowy: expectedGlowy,
            starry: expectedStarry
        });
    });
});
