import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getApiBaseUrl } from '../../js/services/apiService.js';

test('getApiBaseUrl resolves api.clashcalc.com for clashcalc.com origins', () => {
    assert.equal(getApiBaseUrl('clashcalc.com'), 'https://api.clashcalc.com');
    assert.equal(getApiBaseUrl('www.clashcalc.com'), 'https://api.clashcalc.com');
    assert.equal(getApiBaseUrl('beta.clashcalc.com'), 'https://api.clashcalc.com');
    assert.equal(getApiBaseUrl('staging.clashcalc.com'), 'https://api.clashcalc.com');
});

test('getApiBaseUrl resolves api.orecalc.tech for orecalc.tech origins', () => {
    assert.equal(getApiBaseUrl('orecalc.tech'), 'https://api.orecalc.tech');
    assert.equal(getApiBaseUrl('www.orecalc.tech'), 'https://api.orecalc.tech');
    assert.equal(getApiBaseUrl('beta.orecalc.tech'), 'https://api.orecalc.tech');
});

test('getApiBaseUrl falls back safely for localhost or empty hosts', () => {
    assert.equal(getApiBaseUrl('localhost'), 'https://api.orecalc.tech');
    assert.equal(getApiBaseUrl(''), 'https://api.orecalc.tech');
    assert.equal(getApiBaseUrl(undefined), 'https://api.orecalc.tech');
});
