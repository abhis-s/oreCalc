import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { calculateStorageForecast } from '../../js/domain/equipment/storageForecastDomain.js';

describe('Storage Forecast Domain Engine (storageForecastDomain.js)', () => {

    test('calculateStorageForecast accurately flags initial Day 0 full storages', () => {
        const today = new Date(Date.UTC(2026, 5, 1));
        const end = new Date(Date.UTC(2026, 5, 10));
        const appState = {
            storedOres: { shiny: 50000, glowy: 5000, starry: 1000 },
            playerProfile: { townHallLevel: 16 },
            income: {},
            planner: { calendar: { dates: {} } }
        };

        const forecast = calculateStorageForecast(appState, today, end);
        assert.ok(forecast.firstFullDates.shiny);
        assert.equal(forecast.firstFullDates.shiny.alreadyFull, true);
        assert.equal(forecast.firstFullDates.shiny.daysFromToday, 0);

        assert.ok(forecast.firstFullDates.glowy);
        assert.equal(forecast.firstFullDates.glowy.alreadyFull, true);

        assert.ok(forecast.firstFullDates.starry);
        assert.equal(forecast.firstFullDates.starry.alreadyFull, true);
    });

    test('calculateStorageForecast accurately simulates filling from below cap and detects transition milestone', () => {
        const today = new Date(Date.UTC(2026, 5, 1));
        const end = new Date(Date.UTC(2026, 5, 10));

        // Start glowy 50 below cap, so daily income on day 1 puts it over 5000
        const appState = {
            storedOres: { shiny: 10000, glowy: 4980, starry: 200 },
            playerProfile: { townHallLevel: 16 },
            income: {},
            planner: { calendar: { dates: {} } }
        };

        const forecast = calculateStorageForecast(appState, today, end);
        assert.equal(forecast.firstFullDates.shiny, null); // 10k shiny won't reach 50k in 10 days
        assert.ok(forecast.firstFullDates.glowy);
        assert.equal(forecast.firstFullDates.glowy.alreadyFull, false);
        assert.equal(forecast.firstFullDates.glowy.daysFromToday, 1);
        assert.equal(forecast.firstFullDates.glowy.dateStr, '2026-06-02');

        assert.ok(forecast.milestonesByDate['2026-06-02']);
        assert.ok(forecast.milestonesByDate['2026-06-02'].some(m => m.ore === 'glowy'));

        // Subsequent days should show overflow for glowy
        assert.ok(forecast.overflowByDate['2026-06-03']);
        assert.ok(forecast.overflowByDate['2026-06-03'].glowy);
        assert.ok(forecast.overflowByDate['2026-06-03'].glowy.dailyExcess > 0);
    });

    test('calculateStorageForecast deducts planned equipment upgrade costs before refilling', () => {
        const today = new Date(Date.UTC(2026, 5, 1));
        const end = new Date(Date.UTC(2026, 5, 5));

        const appState = {
            storedOres: { shiny: 49500, glowy: 4980, starry: 990 },
            playerProfile: { townHallLevel: 16 },
            income: {},
            planner: { calendar: { dates: {} } }
        };

        // Milestone spending 20,000 shiny on 2026-06-02
        const equipmentSchedule = {
            milestones: {
                '2026-06-02': [
                    { requiredOres: { shiny: 20000, glowy: 1000, starry: 100 } }
                ]
            }
        };

        const forecast = calculateStorageForecast(appState, today, end, equipmentSchedule);
        const day2Bal = forecast.dailyBalancesByDate['2026-06-02'];
        assert.ok(day2Bal);
        assert.ok(day2Bal.shiny < 35000, 'Shiny balance on day 2 must reflect deduction of 20,000 shiny');
    });

});
