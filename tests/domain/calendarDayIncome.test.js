import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDailyCalendarIncome } from '../../js/domain/income/calendarDayIncome.js';
import { getStarBonusForTownHall } from '../../js/data/incomeSources/starBonus.js';

describe('Calendar Day Income Aggregator Suite', () => {
    test('calculateDailyCalendarIncome returns zeros for null or undefined arguments', () => {
        assert.deepEqual(calculateDailyCalendarIncome(null, null), { shiny: 0, glowy: 0, starry: 0 });
        assert.deepEqual(calculateDailyCalendarIncome(new Date(), null), { shiny: 0, glowy: 0, starry: 0 });
        assert.deepEqual(calculateDailyCalendarIncome(null, {}), { shiny: 0, glowy: 0, starry: 0 });
    });

    test('accrues baseline daily Star Bonus for Town Hall 16', () => {
        const testDate = new Date('2026-05-15T12:00:00Z');
        const state = {
            playerProfile: { townHallLevel: 16 },
            income: {
                starBonus: { townHall: 16 }
            },
            planner: {
                calendar: {
                    dates: {}
                }
            }
        };

        const sbTh16 = getStarBonusForTownHall(16);
        const dayIncome = calculateDailyCalendarIncome(testDate, state);

        assert.equal(dayIncome.shiny, Math.round(sbTh16.shiny));
        assert.equal(dayIncome.glowy, Math.round(sbTh16.glowy));
        assert.equal(dayIncome.starry, Math.round(sbTh16.starry));
    });

    test('multiplies Star Bonus when multiplier chip is placed on calendar date', () => {
        const testDate = new Date('2026-05-15T12:00:00Z');
        const state = {
            playerProfile: { townHallLevel: 16 },
            income: {
                starBonus: { townHall: 16 }
            },
            planner: {
                calendar: {
                    dates: {
                        '2026-05': {
                            '15': ['starBonus4x-1']
                        }
                    }
                }
            }
        };

        const sbTh16 = getStarBonusForTownHall(16);
        const dayIncome = calculateDailyCalendarIncome(testDate, state);

        assert.equal(dayIncome.shiny, Math.round(sbTh16.shiny * 4));
        assert.equal(dayIncome.glowy, Math.round(sbTh16.glowy * 4));
        assert.equal(dayIncome.starry, Math.round(sbTh16.starry * 4));
    });

    test('accrues custom chip ore values when custom chip ID is mapped in customChipData', () => {
        const testDate = new Date('2026-06-20T12:00:00Z');
        const state = {
            playerProfile: { townHallLevel: 16 },
            income: {
                starBonus: { townHall: 16 }
            },
            planner: {
                calendar: {
                    dates: {
                        '2026-06': {
                            '20': ['custom-bonus-1']
                        }
                    },
                    customChipData: {
                        'custom-bonus-1': { shiny: 1500, glowy: 120, starry: 15 }
                    }
                }
            }
        };

        const sbTh16 = getStarBonusForTownHall(16);
        const dayIncome = calculateDailyCalendarIncome(testDate, state);

        assert.equal(dayIncome.shiny, Math.round(sbTh16.shiny) + 1500);
        assert.equal(dayIncome.glowy, Math.round(sbTh16.glowy) + 120);
        assert.equal(dayIncome.starry, Math.round(sbTh16.starry) + 15);
    });

    test('custom-starBonus chip overrides baseline automatic Star Bonus', () => {
        const testDate = new Date('2026-07-10T12:00:00Z');
        const state = {
            playerTownHall: 16,
            income: {
                starBonus: { townHall: 16 }
            },
            planner: {
                calendar: {
                    dates: {
                        '2026-07': {
                            '10': ['custom-starBonus-override']
                        }
                    },
                    customChipData: {
                        'custom-starBonus-override': { shiny: 2000, glowy: 150, starry: 20 }
                    }
                }
            }
        };

        const dayIncome = calculateDailyCalendarIncome(testDate, state);
        assert.equal(dayIncome.shiny, 2000);
        assert.equal(dayIncome.glowy, 150);
        assert.equal(dayIncome.starry, 20);
    });
});
