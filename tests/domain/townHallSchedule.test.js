import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { MAX_TOWN_HALL } from '../../js/core/constants.js';
import { getTHReleaseDate, getTownHallIconUrl } from '../../js/domain/townHall/townHallSchedule.js';

describe('Town Hall Schedule & Icon Resolution Domain Suite', () => {

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
        const maxIconUrl = `assets/th/th${MAX_TOWN_HALL}.png`;
        assert.equal(getTownHallIconUrl(), maxIconUrl);
        assert.equal(getTownHallIconUrl(12), 'assets/th/th12.png');
        assert.equal(getTownHallIconUrl(0), 'assets/th/th1.png');
        assert.equal(getTownHallIconUrl(19), 'assets/th/th19.png');
        assert.equal(getTownHallIconUrl(99), maxIconUrl);
        assert.equal(getTownHallIconUrl(18, { rootRelative: true }), '/assets/th/th18.png');
    });
});
