const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
    sanitizePreferences,
    sanitizePlayerData,
    preserveExistingPlayerSlices
} = require('../services/userDataSanitizer.js');

test('sanitizePreferences preserves all supported league modifiers', () => {
    const modifiers = ['standard', 'legend3', 'legend2', 'legend1', 'esports'];
    for (const mod of modifiers) {
        const result = sanitizePreferences({ leagueModifier: mod });
        assert.equal(result.leagueModifier, mod);
    }

    const invalidResult = sanitizePreferences({ leagueModifier: 'invalidLeague' });
    assert.equal(invalidResult.leagueModifier, undefined);
});

test('sanitizePreferences preserves auto and supported languages', () => {
    const langs = ['auto', 'en', 'de', 'tr', 'zh'];
    for (const lang of langs) {
        const result = sanitizePreferences({ language: lang });
        assert.equal(result.language, lang);
    }

    const invalidResult = sanitizePreferences({ language: 'fr' });
    assert.equal(invalidResult.language, undefined);
});

test('sanitizePreferences preserves modern UI settings and route preferences', () => {
    const result = sanitizePreferences({
        screenWakeLock: true,
        hapticsEnabled: false,
        startupRoute: '/planner',
        enableLevelInput: true,
        hideMaxedEquipment: true,
        hideLockedEquipment: false,
        hideProfileStats: false,
        cloudSync: true
    });

    assert.equal(result.screenWakeLock, true);
    assert.equal(result.hapticsEnabled, false);
    assert.equal(result.startupRoute, '/planner');
    assert.equal(result.enableLevelInput, true);
    assert.equal(result.hideMaxedEquipment, true);
    assert.equal(result.hideLockedEquipment, false);
    assert.equal(result.cloudSync, true);
});

test('sanitizePreferences rejects malformed or oversized startupRoute', () => {
    const invalidChars = sanitizePreferences({ startupRoute: '<script>alert(1)</script>' });
    assert.equal(invalidChars.startupRoute, undefined);

    const tooLong = sanitizePreferences({ startupRoute: '/' + 'a'.repeat(70) });
    assert.equal(tooLong.startupRoute, undefined);
});

test('sanitizePlayerData normalizes lab troops using canonical scaling keys', () => {
    const rawData = {
        playerProfile: {
            tag: '#8PJYGUJC',
            name: 'TestPlayer',
            troops: [
                { name: 'Barbarian', village: 'home', level: 12 },
                { name: 'Archer', village: 'home', level: 11 },
                { name: 'Sneaky Goblin', village: 'home', level: 8 },
                { name: 'Barbarian', village: 'builderBase', level: 20 }
            ]
        }
    };

    const sanitized = sanitizePlayerData(rawData);
    assert.deepEqual(sanitized.playerProfile.labTroops, {
        barbarian: 12,
        archer: 11
    });
});

test('preserveExistingPlayerSlices retains existing income, raidMedals, heroes, storedOres, and planner when saving partial Hero Journey payload', () => {
    const existingDocData = {
        playerProfile: { tag: '8PJYGUJC', name: 'Chief', townHallLevel: 16 },
        heroes: { barbarianKing: { level: 95, enabled: true, equipment: {} } },
        storedOres: { shiny: 5000, glowy: 400, starry: 50 },
        income: {
            raidMedals: { enabled: true, earned: 1300, packs: { shiny: 0, glowy: 2, starry: 2 } }
        },
        planner: { calendar: { dates: {} } },
        currency: { code: 'EUR', globalPricing: {} },
        onboardingTimestamp: 1781000000000,
        heroJourney: { acceleratedRewards: false, revealBeyondTH: false, hidden: false }
    };

    const incomingPartialHjPayload = sanitizePlayerData({
        lastRefreshedAt: 1795000000000,
        playerProfile: { tag: '#8PJYGUJC', name: 'Chief', townHallLevel: 16 },
        heroJourney: { acceleratedRewards: true, revealBeyondTH: true, hidden: false }
    });

    const merged = preserveExistingPlayerSlices(incomingPartialHjPayload, existingDocData);
    assert.deepEqual(merged.income.raidMedals, {
        enabled: true,
        earned: 1300,
        packs: { shiny: 0, glowy: 2, starry: 2 }
    });
    assert.deepEqual(merged.storedOres, { shiny: 5000, glowy: 400, starry: 50 });
    assert.deepEqual(merged.heroes, existingDocData.heroes);
    assert.deepEqual(merged.planner, existingDocData.planner);
    assert.deepEqual(merged.currency, existingDocData.currency);
    assert.equal(merged.onboardingTimestamp, 1781000000000);
    assert.deepEqual(merged.heroJourney, {
        acceleratedRewards: true,
        revealBeyondTH: true,
        hidden: false
    });
});

test('preserveExistingPlayerSlices enforces slice-level Last-Write-Wins so stale or default slices do not clobber newer cloud slices', () => {
    const existingDocData = {
        playerProfile: { tag: '8PJYGUJC', name: 'Chief', townHallLevel: 16 },
        heroes: { barbarianKing: { level: 90, enabled: true, equipment: {} } },
        storedOres: { shiny: 5000, glowy: 400, starry: 50 },
        income: {
            raidMedals: { enabled: true, earned: 1300, packs: { shiny: 0, glowy: 2, starry: 2 } }
        },
        sliceTimestamps: {
            heroes: 1700000000000,
            storedOres: 1700000000000,
            income: 1750000000000,
            planner: 1700000000000,
            heroJourney: 1700000000000,
            currency: 1700000000000
        }
    };

    // Incoming payload from another device has newer heroes (1760000000000) but untouched/stale income (0)
    const incomingPayload = sanitizePlayerData({
        playerProfile: { tag: '#8PJYGUJC', name: 'Chief', townHallLevel: 16 },
        heroes: { barbarianKing: { level: 95, enabled: true, equipment: {} } },
        storedOres: { shiny: 0, glowy: 0, starry: 0 },
        income: {
            raidMedals: { enabled: false, earned: 1200, packs: { shiny: 0, glowy: 0, starry: 0 } }
        },
        sliceTimestamps: {
            heroes: 1760000000000,
            storedOres: 0,
            income: 0,
            planner: 0,
            heroJourney: 0,
            currency: 0
        }
    });

    const merged = preserveExistingPlayerSlices(incomingPayload, existingDocData);
    assert.equal(merged.heroes.barbarianKing.level, 95, 'Newer incoming heroes slice must be accepted');
    assert.equal(merged.sliceTimestamps.heroes, 1760000000000);
    assert.deepEqual(merged.income.raidMedals, {
        enabled: true,
        earned: 1300,
        packs: { shiny: 0, glowy: 2, starry: 2 }
    }, 'Newer existing income slice must not be clobbered by untouched incoming income slice');
    assert.equal(merged.sliceTimestamps.income, 1750000000000);
    assert.deepEqual(merged.storedOres, { shiny: 5000, glowy: 400, starry: 50 });
    assert.equal(merged.sliceTimestamps.storedOres, 1700000000000);
});
