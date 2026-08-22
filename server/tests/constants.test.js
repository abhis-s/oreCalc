const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
    COC_TAG_REGEX,
    USER_ID_REGEX,
    BILLING_MONTH_REGEX,
    ALLOWED_ORIGINS,
    RATE_LIMIT_DEFAULTS,
    SERVER_CONSTANTS
} = require('../constants.js');

test('SERVER_CONSTANTS is deeply frozen and defines valid operational parameters', () => {
    assert.ok(Object.isFrozen(SERVER_CONSTANTS));
    assert.equal(SERVER_CONSTANTS.PORT_DEFAULT, 3000);
    assert.equal(SERVER_CONSTANTS.INACTIVE_USER_DAYS_THRESHOLD, 90);
    assert.equal(SERVER_CONSTANTS.PRUNE_BATCH_LIMIT, 25);
    assert.equal(SERVER_CONSTANTS.MAX_HISTORICAL_BILLING_MONTHS, 6);
    assert.equal(SERVER_CONSTANTS.NEGLIGIBLE_COST_THRESHOLD, 0.01);
});

test('ALLOWED_ORIGINS is deeply frozen and contains production and local development origins', () => {
    assert.ok(Object.isFrozen(ALLOWED_ORIGINS));
    assert.ok(ALLOWED_ORIGINS.includes('https://orecalc.tech'));
    assert.ok(ALLOWED_ORIGINS.includes('https://www.orecalc.tech'));
    assert.ok(ALLOWED_ORIGINS.includes('https://beta.orecalc.tech'));
    assert.ok(ALLOWED_ORIGINS.includes('https://orecalc-beta.pages.dev'));
    assert.ok(ALLOWED_ORIGINS.includes('http://localhost:8080'));
});

test('RATE_LIMIT_DEFAULTS is deeply frozen and defines windows and max counts', () => {
    assert.ok(Object.isFrozen(RATE_LIMIT_DEFAULTS));
    assert.equal(RATE_LIMIT_DEFAULTS.general.max, 500);
    assert.equal(RATE_LIMIT_DEFAULTS.sensitive.max, 5);
    assert.equal(RATE_LIMIT_DEFAULTS.proxy.max, 250);
});

test('Regular expression patterns validate expected formats correctly', () => {
    assert.ok(COC_TAG_REGEX.test('2PP0V2RGY'));
    assert.ok(COC_TAG_REGEX.test('0289CGJLOPQRUV'));
    assert.equal(COC_TAG_REGEX.test('INVALID_TAG_S'), false);

    assert.ok(USER_ID_REGEX.test('usr_1234567890abcdef'));
    assert.equal(USER_ID_REGEX.test('short'), false);

    assert.ok(BILLING_MONTH_REGEX.test('2026-08'));
    assert.equal(BILLING_MONTH_REGEX.test('2026-13'), false);
    assert.equal(BILLING_MONTH_REGEX.test('2026/08'), false);
});
