import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { getMaxTownHall, getTHReleaseDate } from '../../js/domain/townHall/townHallSchedule.js';

describe('Town Hall Release Schedule Domain Suite', () => {

    test('getMaxTownHall calculates correct maximum released Town Hall across month/year boundaries', () => {
        // Prior to TH 17 release in November 2024
        assert.equal(getMaxTownHall(new Date(Date.UTC(2024, 9, 31))), 16); // Oct 31, 2024

        // TH 17 release window
        assert.equal(getMaxTownHall(new Date(Date.UTC(2024, 10, 1))), 17); // Nov 1, 2024
        assert.equal(getMaxTownHall(new Date(Date.UTC(2024, 11, 31))), 17); // Dec 31, 2024

        // Throughout 2025 until TH 18 release
        assert.equal(getMaxTownHall(new Date(Date.UTC(2025, 0, 15))), 17); // Jan 15, 2025
        assert.equal(getMaxTownHall(new Date(Date.UTC(2025, 9, 31))), 17); // Oct 31, 2025
        assert.equal(getMaxTownHall(new Date(Date.UTC(2025, 10, 1))), 18); // Nov 1, 2025

        // Throughout 2026 until TH 19 release
        assert.equal(getMaxTownHall(new Date(Date.UTC(2026, 8, 25))), 18); // Sep 25, 2026
        assert.equal(getMaxTownHall(new Date(Date.UTC(2026, 9, 31))), 18); // Oct 31, 2026
        assert.equal(getMaxTownHall(new Date(Date.UTC(2026, 10, 1))), 19); // Nov 1, 2026

        // Long-term projection
        assert.equal(getMaxTownHall(new Date(Date.UTC(2030, 10, 1))), 23); // Nov 1, 2030

        // Default argument (current date)
        const currentMaxTH = getMaxTownHall();
        assert.ok(typeof currentMaxTH === 'number');
        assert.ok(currentMaxTH >= 17);
    });

    test('getTHReleaseDate returns predicted release year based on annual cadence', () => {
        // Levels up to and including TH 17 anchor at 2024
        assert.equal(getTHReleaseDate(1), 2024);
        assert.equal(getTHReleaseDate(14), 2024);
        assert.equal(getTHReleaseDate(16), 2024);
        assert.equal(getTHReleaseDate(17), 2024);

        // Subsequent Town Halls increment by 1 year each
        assert.equal(getTHReleaseDate(18), 2025);
        assert.equal(getTHReleaseDate(19), 2026);
        assert.equal(getTHReleaseDate(20), 2027);
        assert.equal(getTHReleaseDate(25), 2032);
    });
});
