import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { MAX_TOWN_HALL } from '../../js/core/constants.js';
import { getTHReleaseDate, getTownHallIconUrl } from '../../js/domain/townHall/townHallSchedule.js';

describe('Town Hall Schedule & Icon Resolution Domain Suite', () => {

    test('MAX_TOWN_HALL is a static positive integer configured for the active release', () => {
        assert.equal(Number.isInteger(MAX_TOWN_HALL), true);
        assert.ok(MAX_TOWN_HALL >= 18);
        assert.equal(MAX_TOWN_HALL, 18);
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

    test('getTownHallIconUrl resolves bounded TH icon URLs with relative and root-relative paths', () => {
        assert.equal(getTownHallIconUrl(), `assets/th/th${Math.min(MAX_TOWN_HALL, 18)}.png`);
        assert.equal(getTownHallIconUrl(12), 'assets/th/th12.png');
        assert.equal(getTownHallIconUrl(0), 'assets/th/th1.png');
        assert.equal(getTownHallIconUrl(19), 'assets/th/th18.png');
        assert.equal(getTownHallIconUrl(18, { rootRelative: true }), '/assets/th/th18.png');
    });
});
