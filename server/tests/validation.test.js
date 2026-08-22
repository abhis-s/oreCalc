const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
    isValidTag,
    normalizeTag,
    isValidUserId,
    isValidMonthStr
} = require('../utils/validation.js');

test('isValidTag validates Clash of Clans tags against official character set', () => {
    assert.equal(isValidTag('#2PP0V2RGY'), true);
    assert.equal(isValidTag('2PP0V2RGY'), true);
    assert.equal(isValidTag('0289CGJLOPQRUV'), true);
    assert.equal(isValidTag('#0289cgjlopqruv'), true);

    assert.equal(isValidTag('2P'), false);
    assert.equal(isValidTag('0289CGJLOPQRUVY0289CGJLOPQRUVY'), false);
    assert.equal(isValidTag('ABCDEFGH'), false);
    assert.equal(isValidTag('TAG_WITH_INVALID_S'), false);
    assert.equal(isValidTag(''), false);
    assert.equal(isValidTag(null), false);
    assert.equal(isValidTag(undefined), false);
    assert.equal(isValidTag(12345), false);
});

test('normalizeTag strips leading hashtag, trims, and uppercases tag cleanly', () => {
    assert.equal(normalizeTag('#2pp0v2rgy'), '2PP0V2RGY');
    assert.equal(normalizeTag('  #2pp0v2rgy  '), '2PP0V2RGY');
    assert.equal(normalizeTag('2pp0v2rgy'), '2PP0V2RGY');
    assert.equal(normalizeTag(''), '');
    assert.equal(normalizeTag(null), '');
    assert.equal(normalizeTag(undefined), '');
});

test('isValidUserId validates user token structure and length bounds', () => {
    assert.equal(isValidUserId('usr_1234567890abcdef'), true);
    assert.equal(isValidUserId('a1b2c3d4e5f6g7h8i9j0'), true);
    assert.equal(isValidUserId('user-with-dash-12345'), true);

    assert.equal(isValidUserId('short'), false);
    assert.equal(isValidUserId('usr with space 12345'), false);
    assert.equal(isValidUserId('usr!@#$%^&*()12345'), false);
    assert.equal(isValidUserId(''), false);
    assert.equal(isValidUserId(null), false);
    assert.equal(isValidUserId(123456789012), false);
});

test('isValidMonthStr validates YYYY-MM format correctly', () => {
    assert.equal(isValidMonthStr('2026-08'), true);
    assert.equal(isValidMonthStr('2025-01'), true);
    assert.equal(isValidMonthStr('2025-12'), true);

    assert.equal(isValidMonthStr('2026-00'), false);
    assert.equal(isValidMonthStr('2026-13'), false);
    assert.equal(isValidMonthStr('2026/08'), false);
    assert.equal(isValidMonthStr('2026-8'), false);
    assert.equal(isValidMonthStr('August 2026'), false);
    assert.equal(isValidMonthStr(''), false);
    assert.equal(isValidMonthStr(null), false);
});
