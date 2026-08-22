import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertOres } from '../../js/domain/income/prospectorManager.js';

test('convertOres returns same amount when converting between same ore types', () => {
    assert.equal(convertOres('shiny', 'shiny', 500), 500);
    assert.equal(convertOres('glowy', 'glowy', 100), 100);
    assert.equal(convertOres('starry', 'starry', 20), 20);
});

test('convertOres converts from shiny to glowy correctly', () => {
    const converted = convertOres('shiny', 'glowy', 500);
    assert.ok(converted > 0 && converted < 500);
});

test('convertOres converts from glowy to starry correctly', () => {
    const converted = convertOres('glowy', 'starry', 100);
    assert.ok(converted > 0 && converted < 100);
});
