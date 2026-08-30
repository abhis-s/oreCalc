import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlayerTag, formatDisplayTag } from '../../js/core/localStorageManager.js';
import { getTagFromUrl } from '../../js/components/heroJourney/heroJourneyState.js';

test('Hero Journey Player Tag Routing & DEFAULT0 Isolation Suite', async (t) => {
    await t.test('normalizePlayerTag isolates DEFAULT0 and cleans hashes and casings', () => {
        assert.equal(normalizePlayerTag('DEFAULT0'), 'DEFAULT0');
        assert.equal(normalizePlayerTag('#DEFAULT0'), 'DEFAULT0');
        assert.equal(normalizePlayerTag('default0'), 'DEFAULT0');
        assert.equal(normalizePlayerTag('#mocktag1'), 'MOCKTAG1');
        assert.equal(normalizePlayerTag('  #TESTTAG99  '), 'TESTTAG99');
        assert.equal(normalizePlayerTag(''), '');
        assert.equal(normalizePlayerTag(null), '');
    });

    await t.test('formatDisplayTag formats valid tags and returns empty string for DEFAULT0 and empty tags', () => {
        assert.equal(formatDisplayTag('DEFAULT0'), '');
        assert.equal(formatDisplayTag('#DEFAULT0'), '');
        assert.equal(formatDisplayTag('default0'), '');
        assert.equal(formatDisplayTag('MOCKTAG1'), '#MOCKTAG1');
        assert.equal(formatDisplayTag('#TESTTAG99'), '#TESTTAG99');
        assert.equal(formatDisplayTag(''), '');
        assert.equal(formatDisplayTag(null), '');
    });

    await t.test('openUrl logic creates clean /hero-journey/ for guest and DEFAULT0 profiles', () => {
        const createOpenUrl = (isGuest, playerProfileTag, savedPlayerTags) => {
            const rawTag = (!isGuest && playerProfileTag) ? playerProfileTag : (savedPlayerTags?.[0] || '');
            const cleanTag = normalizePlayerTag(rawTag);
            const playerTag = (!isGuest && cleanTag && cleanTag !== 'DEFAULT0') ? cleanTag : '';
            return playerTag ? `/hero-journey/?tag=${encodeURIComponent(playerTag)}` : '/hero-journey/';
        };

        // Guest profile
        assert.equal(createOpenUrl(true, 'DEFAULT0', ['DEFAULT0']), '/hero-journey/');
        assert.equal(createOpenUrl(true, '#DEFAULT0', ['#DEFAULT0']), '/hero-journey/');
        assert.equal(createOpenUrl(true, null, ['DEFAULT0']), '/hero-journey/');
        assert.equal(createOpenUrl(true, null, []), '/hero-journey/');

        // Connected player
        assert.equal(createOpenUrl(false, '#MOCKTAG1', ['MOCKTAG1']), '/hero-journey/?tag=MOCKTAG1');
        assert.equal(createOpenUrl(false, 'TESTTAG99', ['TESTTAG99']), '/hero-journey/?tag=TESTTAG99');
    });

    await t.test('getTagFromUrl sanitizes window search params and ignores DEFAULT0', () => {
        const originalWindow = globalThis.window;

        try {
            // Test 1: tag=DEFAULT0
            globalThis.window = /** @type {any} */ ({
                location: { search: '?tag=DEFAULT0', hash: '' }
            });
            assert.equal(getTagFromUrl(), '');

            // Test 2: tag=default0
            globalThis.window = /** @type {any} */ ({
                location: { search: '?tag=default0', hash: '' }
            });
            assert.equal(getTagFromUrl(), '');

            // Test 3: p=%23DEFAULT0
            globalThis.window = /** @type {any} */ ({
                location: { search: '?p=%23DEFAULT0', hash: '' }
            });
            assert.equal(getTagFromUrl(), '');

            // Test 4: hash=#DEFAULT0
            globalThis.window = /** @type {any} */ ({
                location: { search: '', hash: '#DEFAULT0' }
            });
            assert.equal(getTagFromUrl(), '');

            // Test 5: valid player tag tag=MOCKTAG1
            globalThis.window = /** @type {any} */ ({
                location: { search: '?tag=MOCKTAG1', hash: '' }
            });
            assert.equal(getTagFromUrl(), 'MOCKTAG1');

            // Test 6: valid player tag tag=%23TESTTAG99
            globalThis.window = /** @type {any} */ ({
                location: { search: '?tag=%23TESTTAG99', hash: '' }
            });
            assert.equal(getTagFromUrl(), 'TESTTAG99');
        } finally {
            globalThis.window = originalWindow;
        }
    });
});
