const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
    sanitizePreferences,
    sanitizePlayerData
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
